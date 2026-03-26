/*
 * ProfitRTDBridge.cs  v3.1
 * ═══════════════════════════════════════════════════════════════════════════
 * CORREÇÃO v3.0: Late binding via "dynamic" — sem cast de interface COM
 * CORREÇÃO v3.1: callback COM com IID real de IRTDUpdateEvent (ServerStart)
 *
 * HISTÓRICO DE ERROS E CORREÇÕES:
 *   v2.0 — REGDB_E_CLASSNOTREG (0x80040154)
 *          Causa:  Bridge era 64-bit, COM do Profit é 32-bit
 *          Fix:    Compilar como win-x86
 *
 *   v2.1 — "Specified cast is not valid"
 *          Causa:  (IRtdServer)instance falha — Profit não expõe vtable IUnknown
 *          Fix:    Trocar interface para IDispatch
 *
 *   v2.2 — "Specified cast is not valid" (mesmo erro com IDispatch)
 *          Causa:  Cast explícito para IRtdServer ainda falha porque o Profit
 *                  usa uma implementação COM não-padrão (wrapper nativo)
 *          Fix:    Usar "dynamic" — late binding puro via IDispatch.
 *                  O CLR chama os métodos pelo nome sem nenhum cast de interface.
 *                  Também usar RtdUpdateCallback como "object" sem ComImport.
 *
 * ARQUITETURA:
 *   Profit Pro (32-bit) → COM ProgID RTDTrading.RTDServer
 *        ↓  dynamic late binding (IDispatch)
 *   ProfitRTDBridge.exe (win-x86, STA thread)
 *        ↓  WebSocket ws://localhost:8765
 *   opcoesprox.com.br (navegador)
 * ═══════════════════════════════════════════════════════════════════════════
 */

using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Runtime.InteropServices;
using System.Threading;
using Microsoft.Win32;
using Fleck;
using Newtonsoft.Json;

namespace ProfitRTDBridge
{
    // ── Callback COM com IID oficial do Excel RTD ─────────────────────────────
    // O Profit/RTD pode validar o IID esperado em ServerStart(IRTDUpdateEvent).
    // Por isso expomos explicitamente a interface com GUID oficial.
    [ComVisible(true)]
    [Guid("A43788C1-D91B-11D3-8F39-00C04F3651B8")]
    [InterfaceType(ComInterfaceType.InterfaceIsIDispatch)]
    public interface IRTDUpdateEvent
    {
        [DispId(10)]
        void UpdateNotify();

        [DispId(11)]
        int HeartbeatInterval { get; set; }

        [DispId(12)]
        void Disconnect();
    }

    [ComVisible(true)]
    [Guid("B5C5A2A7-3D6F-4F73-A4A4-CC1B204BFD22")]
    [ClassInterface(ClassInterfaceType.None)]
    [ComDefaultInterface(typeof(IRTDUpdateEvent))]
    public class RtdCallback : IRTDUpdateEvent
    {
        public volatile bool HasUpdate = false;

        // Método que o Profit chama quando há novos dados
        public void UpdateNotify() => HasUpdate = true;

        // Intervalo de heartbeat em milissegundos
        public int HeartbeatInterval { get; set; } = 30000;

        // Chamado quando o servidor encerra
        public void Disconnect() { }
    }

    // ── Mapeamento dos campos RTD ─────────────────────────────────────────────
    static class ProfitFields
    {
        public static readonly string[] All = { "ULT", "PEX", "NEG", "OCP", "OVD", "VINT", "VEXT" };

        public static string ToJsonKey(string f) => f switch
        {
            "ULT"  => "ultimo",
            "PEX"  => "strike",
            "NEG"  => "negocios",
            "OCP"  => "ofCompra",
            "OVD"  => "ofVenda",
            "VINT" => "vInt",
            "VEXT" => "vExt",
            _      => f.ToLower()
        };
    }

    record RtdTopic(int Id, string Ticker, string Field);

    // ═════════════════════════════════════════════════════════════════════════
    class Program
    {
        static readonly string[] RTD_PROGIDS = { "RTDTrading.RTDServer", "rtdtrading.rtdserver" };

        static volatile bool _running = true;
        static readonly List<IWebSocketConnection> _clients   = new();
        static readonly object                     _clientLock = new();
        static readonly ConcurrentDictionary<string, Dictionary<string, object?>> _cache = new();
        static readonly ConcurrentQueue<string> _pendingAdd    = new();
        static readonly ConcurrentQueue<string> _pendingRemove = new();

        // ── Main ──────────────────────────────────────────────────────────────
        static void Main(string[] args)
        {
            int port = 8765;
            for (int i = 0; i < args.Length - 1; i++)
                if (args[i] == "--port") int.TryParse(args[i + 1], out port);

            Console.Title = "ProfitRTD Bridge v3.1";
            PrintBanner(port);

            // WebSocket server (thread-safe, não-STA)
            var wsServer = new WebSocketServer($"ws://0.0.0.0:{port}");
            wsServer.Start(socket =>
            {
                socket.OnOpen = () =>
                {
                    lock (_clientLock) _clients.Add(socket);
                    Log("WS", $"Cliente conectado: {socket.ConnectionInfo.ClientIpAddress}");
                    if (_cache.Count > 0) SendSnapshot(socket);
                };
                socket.OnClose = () =>
                {
                    lock (_clientLock) _clients.Remove(socket);
                    Log("WS", "Cliente desconectado");
                };
                socket.OnMessage = raw =>
                {
                    try
                    {
                        dynamic? msg = JsonConvert.DeserializeObject(raw);
                        string type = msg?.type?.ToString() ?? "";
                        if (type == "add_ticker")
                        {
                            string t = (msg?.ticker?.ToString() ?? "").ToUpper().Trim();
                            if (!string.IsNullOrEmpty(t))
                            {
                                _pendingAdd.Enqueue(t);
                                Log("CMD", $"Add ticker: {t}");
                            }
                        }
                        else if (type == "remove_ticker")
                        {
                            string t = (msg?.ticker?.ToString() ?? "").ToUpper().Trim();
                            _pendingRemove.Enqueue(t);
                            _cache.TryRemove(t, out _);
                            Log("CMD", $"Remove ticker: {t}");
                        }
                        else if (type == "ping")
                            socket.Send(JsonConvert.SerializeObject(new { type = "pong" }));
                    }
                    catch { }
                };
            });

            Console.CancelKeyPress += (_, e) => { e.Cancel = true; _running = false; };

            // RTD loop DEVE rodar em thread STA (exigência do COM)
            var rtdThread = new Thread(RtdLoop) { IsBackground = true };
            rtdThread.SetApartmentState(ApartmentState.STA);
            rtdThread.Start();

            while (_running) Thread.Sleep(300);
            wsServer.Dispose();
            Log("INFO", "Bridge encerrado.");
        }

        // ── RTD Loop (STA Thread) ─────────────────────────────────────────────
        static void RtdLoop()
        {
            dynamic? rtd     = null;   // <-- dynamic: sem cast de interface!
            RtdCallback? cb  = null;
            var topics       = new Dictionary<int, RtdTopic>();
            var tickers      = new HashSet<string>();
            int nextId       = 1;
            int errCount     = 0;

            while (_running)
            {
                try
                {
                    // ── 1. Instancia o COM server do Profit ──────────────────
                    if (rtd == null)
                    {
                        Log("RTD", "Localizando servidor RTD do Profit Pro...");

                        Guid? clsid = FindRtdClsid();
                        if (clsid == null)
                        {
                            LogRtdNotFound();
                            Thread.Sleep(7000);
                            continue;
                        }

                        Log("RTD", $"CLSID: {clsid}");

                        // Cria instância como "object" e usa dynamic — sem cast
                        Type? comType = Type.GetTypeFromCLSID(clsid.Value, throwOnError: false);
                        if (comType == null)
                        {
                            Log("ERR", "Type.GetTypeFromCLSID retornou null. Profit está rodando?");
                            Thread.Sleep(5000);
                            continue;
                        }

                        object rawInstance = Activator.CreateInstance(comType)
                            ?? throw new InvalidOperationException("Activator retornou null");

                        // ← CHAVE DA CORREÇÃO: dynamic evita qualquer cast de interface
                        rtd = rawInstance;
                        cb  = new RtdCallback();

                        // ServerStart via dynamic — passando callback com IID correto
                        int startResult;
                        try
                        {
                            startResult = Convert.ToInt32(rtd.ServerStart((IRTDUpdateEvent)cb));
                        }
                        catch (Exception exTyped)
                        {
                            try
                            {
                                startResult = Convert.ToInt32(rtd.ServerStart((object)cb));
                                Log("WARN", "ServerStart com callback tipado falhou; fallback object aplicado.");
                            }
                            catch (Exception exObj)
                            {
                                Log("ERR", $"ServerStart falhou: {exObj.Message}\n" +
                                    $"  → Detalhe callback tipado: {exTyped.Message}\n" +
                                    "  → Execute Profit e Bridge com o MESMO nível de permissão\n" +
                                    "    (ambos Admin, ou ambos usuário normal)\n" +
                                    "  → No Profit: Exportar em Tempo Real (RTD/DDE)\n" +
                                    "    selecione RTD, marque 'Ativar transferência de dados' e clique OK");
                            Broadcast(new { type = "error", message = "Falha em ServerStart. Execute Profit e Bridge com o mesmo nível de permissão (ambos Admin ou ambos Normal)." });
                            rtd = null;
                            Thread.Sleep(6000);
                            continue;
                            }
                        }

                        if (startResult != 1)
                        {
                            Log("WARN", $"ServerStart retornou {startResult} — Profit não está pronto ainda.");
                            rtd = null;
                            Thread.Sleep(3000);
                            continue;
                        }

                        Log("RTD", "✓ Conectado ao Profit Pro com sucesso!");
                        Broadcast(new { type = "bridge_ready" });
                        errCount = 0;

                        // Restaura subscrições existentes após reconexão
                        foreach (var tk in tickers.ToList())
                            SubscribeTicker(rtd, cb, tk, topics, ref nextId);
                    }

                    // ── 2. Processa add/remove de tickers ────────────────────
                    while (_pendingAdd.TryDequeue(out string? addTk))
                        if (tickers.Add(addTk))
                            SubscribeTicker(rtd!, cb!, addTk, topics, ref nextId);

                    while (_pendingRemove.TryDequeue(out string? remTk))
                    {
                        tickers.Remove(remTk);
                        foreach (var id in topics.Where(kv => kv.Value.Ticker == remTk)
                                                 .Select(kv => kv.Key).ToList())
                        {
                            try { rtd!.DisconnectData(id); } catch { }
                            topics.Remove(id);
                        }
                    }

                    if (tickers.Count == 0) { Thread.Sleep(500); continue; }

                    // ── 3. Heartbeat ─────────────────────────────────────────
                    try { rtd!.Heartbeat(); } catch { }

                    // ── 4. Lê dados novos via RefreshData ────────────────────
                    cb!.HasUpdate = false;

                    object? rawRefresh = null;
                    int topicCount = 0;

                    try
                    {
                        // RefreshData retorna SAFEARRAY 2D via dynamic
                        rawRefresh = rtd!.RefreshData(ref topicCount);
                    }
                    catch (Exception ex)
                    {
                        Log("ERR", $"RefreshData: {ex.Message}");
                        rtd = null;
                        Thread.Sleep(2000);
                        continue;
                    }

                    // ── 5. Processa resultado ─────────────────────────────────
                    if (rawRefresh != null && topicCount > 0)
                    {
                        try
                        {
                            // O SAFEARRAY do RTD é sempre object[2, N]:
                            // linha 0 = topicIds, linha 1 = valores
                            Array arr = (Array)rawRefresh;
                            int cols = arr.GetLength(1); // N tópicos atualizados

                            for (int i = 0; i < Math.Min(cols, topicCount); i++)
                            {
                                int    topicId = Convert.ToInt32(arr.GetValue(0, i));
                                object? value  = arr.GetValue(1, i);

                                if (topics.TryGetValue(topicId, out RtdTopic? topic))
                                {
                                    var tc = _cache.GetOrAdd(topic.Ticker, _ => new Dictionary<string, object?>());
                                    lock (tc) tc[ProfitFields.ToJsonKey(topic.Field)] = ParseDouble(value);
                                }
                            }
                        }
                        catch (Exception ex)
                        {
                            Log("WARN", $"Parse RefreshData: {ex.GetType().Name}: {ex.Message}");
                        }
                    }

                    // ── 6. Broadcast para clientes WebSocket ─────────────────
                    if (_cache.Count > 0)
                    {
                        var payload = _cache
                            .Where(kv => tickers.Contains(kv.Key))
                            .Select(kv =>
                            {
                                var d = new Dictionary<string, object?> { ["ticker"] = kv.Key };
                                lock (kv.Value) foreach (var f in kv.Value) d[f.Key] = f.Value;
                                d["timestamp"] = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
                                return d;
                            }).ToList();

                        if (payload.Count > 0)
                        {
                            Broadcast(new { type = "rtd_data", data = payload });
                            Console.Write($"\r[RTD] {DateTime.Now:HH:mm:ss} | {tickers.Count} tickers | {_clients.Count} cliente(s)    ");
                        }
                    }

                    errCount = 0;
                    Thread.Sleep(800);
                }
                catch (Exception ex)
                {
                    errCount++;
                    Log("ERR", $"Loop RTD ({errCount}): {ex.GetType().Name}: {ex.Message}");
                    rtd = null;
                    Thread.Sleep(errCount > 5 ? 7000 : 2000);
                    if (errCount > 5) { errCount = 0; }
                }
            }

            // Cleanup
            try
            {
                if (rtd != null)
                {
                    foreach (var id in topics.Keys) try { rtd.DisconnectData(id); } catch { }
                    rtd.ServerTerminate();
                }
            }
            catch { }
        }

        // ── Subscreve todos os campos de um ticker ────────────────────────────
        static void SubscribeTicker(dynamic rtd, RtdCallback cb, string ticker,
                                    Dictionary<int, RtdTopic> topics, ref int nextId)
        {
            int subscribed = 0;
            foreach (var field in ProfitFields.All)
            {
                int id = nextId++;
                try
                {
                    // ConnectData(topicId, topics[], newValues)
                    // topics[] deve ser SAFEARRAY de strings
                    object[] topicStrings = { ticker, field };
                    bool newValues = true;

                    object? val = rtd.ConnectData(id, ref topicStrings, ref newValues);
                    topics[id] = new RtdTopic(id, ticker, field);

                    var tc = _cache.GetOrAdd(ticker, _ => new Dictionary<string, object?>());
                    lock (tc) tc[ProfitFields.ToJsonKey(field)] = ParseDouble(val);
                    subscribed++;
                }
                catch (Exception ex)
                {
                    Log("WARN", $"ConnectData {ticker}/{field}: {ex.GetType().Name}: {ex.Message}");
                }
            }
            Log("RTD", $"Subscrito: {ticker} ({subscribed}/{ProfitFields.All.Length} campos OK)");
        }

        // ── Localiza CLSID do RTD no registro 32-bit ─────────────────────────
        static Guid? FindRtdClsid()
        {
            foreach (var progId in RTD_PROGIDS)
            {
                foreach (var view in new[] { RegistryView.Registry32, RegistryView.Registry64 })
                {
                    try
                    {
                        using var cr  = RegistryKey.OpenBaseKey(RegistryHive.ClassesRoot, view);
                        using var key = cr.OpenSubKey($@"{progId}\CLSID");
                        string? raw   = key?.GetValue(null)?.ToString();
                        if (!string.IsNullOrEmpty(raw) && Guid.TryParse(raw, out Guid g))
                        {
                            Log("RTD", $"ProgID resolvido ({view}): {progId} → {g}");
                            return g;
                        }
                    }
                    catch { }
                }
            }
            return null;
        }

        static void LogRtdNotFound()
        {
            Log("ERR",
                "Servidor RTD não encontrado no registro Windows.\n" +
                "  → Abra o Profit Pro e faça login\n" +
                "  → No Profit: Exportar em Tempo Real (RTD/DDE)\n" +
                "               > Selecione RTD + marque 'Ativar transferência de dados'\n" +
                "               > Clique OK (ou Copiar) e feche/abra o Profit\n" +
                "  → Execute Bridge com o mesmo nível de permissão do Profit");
            Broadcast(new
            {
                type = "error",
                message = "RTD do Profit não encontrado. No Profit, abra Exportar em Tempo Real (RTD/DDE), selecione RTD e ative transferência de dados; depois reinicie o Profit."
            });
        }

        // ── Helpers ───────────────────────────────────────────────────────────
        static void SendSnapshot(IWebSocketConnection socket)
        {
            var payload = _cache.Select(kv =>
            {
                var d = new Dictionary<string, object?> { ["ticker"] = kv.Key };
                lock (kv.Value) foreach (var f in kv.Value) d[f.Key] = f.Value;
                d["timestamp"] = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
                return d;
            }).ToList();
            try { socket.Send(JsonConvert.SerializeObject(new { type = "rtd_data", data = payload })); } catch { }
        }

        static void Broadcast(object payload)
        {
            string json = JsonConvert.SerializeObject(payload);
            List<IWebSocketConnection> copy;
            lock (_clientLock) copy = new(_clients);
            foreach (var c in copy) try { c.Send(json); } catch { }
        }

        static double? ParseDouble(object? v)
        {
            if (v == null || v is DBNull) return null;

            // ── Se o COM já retornou um tipo numérico, converte direto ──
            // Isso evita problemas de locale (vírgula vs ponto) ao chamar ToString()
            if (v is double dv) return dv;
            if (v is float fv)  return fv;
            if (v is decimal mv) return (double)mv;
            if (v is int iv)    return iv;
            if (v is long lv)   return lv;
            if (v is short sv)  return sv;
            if (v is byte bv)   return bv;
            if (v is uint uv)   return uv;
            if (v is ulong ulv) return ulv;

            // ── Fallback: string → parse com pt-BR primeiro (Profit é brasileiro) ──
            string s = v.ToString()?.Trim() ?? "";
            if (string.IsNullOrEmpty(s)) return null;

            // Tenta pt-BR primeiro (vírgula = decimal, ponto = milhar)
            if (double.TryParse(s, NumberStyles.Any, new CultureInfo("pt-BR"), out double d2)) return d2;
            // Fallback InvariantCulture (ponto = decimal)
            if (double.TryParse(s, NumberStyles.Any, CultureInfo.InvariantCulture, out double d1)) return d1;

            return null;
        }

        static void Log(string tag, string msg)
        {
            Console.ForegroundColor = tag switch
            {
                "RTD"  => ConsoleColor.Cyan,
                "WS"   => ConsoleColor.Green,
                "CMD"  => ConsoleColor.Yellow,
                "ERR"  => ConsoleColor.Red,
                "WARN" => ConsoleColor.DarkYellow,
                _      => ConsoleColor.White,
            };
            Console.WriteLine($"\n[{tag}] {msg}");
            Console.ResetColor();
        }

        static void PrintBanner(int port)
        {
            Console.ForegroundColor = ConsoleColor.Cyan;
            Console.WriteLine(@"
╔══════════════════════════════════════════════════╗
║  ProfitRTD Bridge v3.1 — 32-bit — dynamic COM   ║
║  Profit Pro → IDispatch late binding → WebSocket ║
╚══════════════════════════════════════════════════╝");
            Console.ResetColor();
            Console.WriteLine($"  Plataforma : win-x86 (32-bit)");
            Console.WriteLine($"  WebSocket  : ws://localhost:{port}");
            Console.WriteLine($"  Modo COM   : dynamic late binding (sem cast de interface)");
            Console.WriteLine($"  ProgIDs    : {string.Join(" | ", RTD_PROGIDS)}");
            Console.WriteLine($"  Ctrl+C para encerrar\n");
        }
    }
}
