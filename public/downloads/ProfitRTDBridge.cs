/*
 * ProfitRTDBridge.cs  v2.2
 * ─────────────────────────────────────────────────────────────────────────────
 * CORREÇÃO v2.2: Interfaces COM corrigidas para IDispatch + DispId
 *
 *   O erro 0x80131506 (ExecutionEngineException em InterfaceMarshaler)
 *   ocorria porque as interfaces IRtdServer e IRTDUpdateEvent estavam
 *   declaradas como InterfaceIsIUnknown, mas o Profit Pro (RTDTrading)
 *   expõe IDispatch. A correção usa InterfaceIsIDispatch com os DispIds
 *   corretos do protocolo RTD (compatível com Excel).
 *
 *   Compilar obrigatoriamente como x86 (32-bit).
 * ─────────────────────────────────────────────────────────────────────────────
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
    // ── IRtdServer — interface COM IDispatch do protocolo RTD ────────────────
    [ComImport]
    [Guid("EC0E6191-DB51-11D3-8F3E-00C04F3651B8")]
    [InterfaceType(ComInterfaceType.InterfaceIsIDispatch)]
    interface IRtdServer
    {
        [DispId(10)]
        int ServerStart([MarshalAs(UnmanagedType.Interface)] IRTDUpdateEvent callback);

        [DispId(11)]
        object ConnectData(int topicId, [MarshalAs(UnmanagedType.SafeArray, SafeArraySubType = VarEnum.VT_VARIANT)] ref Array strings, ref bool newValues);

        [DispId(12)]
        object RefreshData(ref int topicCount);

        [DispId(13)]
        void DisconnectData(int topicId);

        [DispId(14)]
        int Heartbeat();

        [DispId(15)]
        void ServerTerminate();
    }

    // ── IRTDUpdateEvent — callback IDispatch chamado pelo Profit ─────────────
    [ComImport]
    [Guid("A43788C1-D91B-11D3-8F39-00C04F3651B8")]
    [InterfaceType(ComInterfaceType.InterfaceIsIDispatch)]
    interface IRTDUpdateEvent
    {
        [DispId(10)]
        void UpdateNotify();

        [DispId(11)]
        int HeartbeatInterval { get; set; }

        [DispId(12)]
        void Disconnect();
    }

    [ComVisible(true)]
    [ClassInterface(ClassInterfaceType.AutoDispatch)]
    class RtdUpdateCallback : IRTDUpdateEvent
    {
        public volatile bool HasUpdate = false;
        public void UpdateNotify() => HasUpdate = true;
        public int HeartbeatInterval { get => 30000; set { } }
        public void Disconnect() { }
    }

    record RtdTopic(int Id, string Ticker, string Field);

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

    class Program
    {
        // Ambos os ProgIDs usados pelo Profit em diferentes versões
        static readonly string[] RTD_PROGIDS = { "RTDTrading.RTDServer", "rtdtrading.rtdserver" };

        static volatile bool _running = true;
        static readonly List<IWebSocketConnection> _clients = new();
        static readonly object _clientLock = new();
        static readonly ConcurrentDictionary<string, Dictionary<string, object?>> _cache = new();
        static readonly ConcurrentQueue<string> _pendingAdd    = new();
        static readonly ConcurrentQueue<string> _pendingRemove = new();

        static void Main(string[] args)
        {
            int port = 8765;
            for (int i = 0; i < args.Length - 1; i++)
                if (args[i] == "--port") int.TryParse(args[i + 1], out port);

            Console.Title = "ProfitRTD Bridge v2.2 (32-bit)";
            PrintBanner(port);

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
                        dynamic? cmd = JsonConvert.DeserializeObject(raw);
                        string type = cmd?.type?.ToString() ?? "";
                        if (type == "add_ticker")
                        {
                            string t = (cmd?.ticker?.ToString() ?? "").ToUpper().Trim();
                            if (!string.IsNullOrEmpty(t)) { _pendingAdd.Enqueue(t); Log("CMD", $"Ticker: {t}"); }
                        }
                        else if (type == "remove_ticker")
                        {
                            string t = (cmd?.ticker?.ToString() ?? "").ToUpper().Trim();
                            _pendingRemove.Enqueue(t);
                            _cache.TryRemove(t, out _);
                        }
                        else if (type == "ping")
                            socket.Send(JsonConvert.SerializeObject(new { type = "pong" }));
                    }
                    catch { }
                };
            });

            Console.CancelKeyPress += (_, e) => { e.Cancel = true; _running = false; };

            // OBRIGATÓRIO: thread STA para COM
            var rtdThread = new Thread(RtdLoop) { IsBackground = true };
            rtdThread.SetApartmentState(ApartmentState.STA);
            rtdThread.Start();

            while (_running) Thread.Sleep(300);
            wsServer.Dispose();
            Log("INFO", "Bridge encerrado.");
        }

        static void RtdLoop()
        {
            IRtdServer? rtd = null;
            RtdUpdateCallback? cb = null;
            var topics   = new Dictionary<int, RtdTopic>();
            var tickers  = new HashSet<string>();
            int nextId   = 1;
            int errCount = 0;

            while (_running)
            {
                try
                {
                    // ── Conecta ao COM server do Profit ──────────────────────
                    if (rtd == null)
                    {
                        Log("RTD", "Localizando servidor RTD do Profit Pro (32-bit)...");

                        Guid? clsid = FindRtdClsid();

                        if (clsid == null)
                        {
                            Log("ERR", "Servidor RTD não encontrado.\n" +
                                "  → Abra o Profit Pro e faça login\n" +
                                "  → No Profit: Ferramentas > Configurações > Exportação em Tempo Real (RTD/DDE) → HABILITAR\n" +
                                "  → Feche e reabra o Profit após habilitar\n" +
                                "  → Execute Profit e Bridge com o mesmo nível (ambos Admin ou ambos Normal)");
                            Broadcast(new { type = "error", message = "Profit Pro não encontrado. Abra o Profit, habilite RTD/DDE em Ferramentas > Configurações e tente novamente." });
                            Thread.Sleep(6000);
                            continue;
                        }

                        Log("RTD", $"CLSID encontrado: {clsid}");

                        object? instance = null;
                        try
                        {
                            // Instancia via CLSID — como já estamos em 32-bit, resolve direto
                            Type? t = Type.GetTypeFromCLSID(clsid.Value, throwOnError: false);
                            if (t == null) throw new InvalidOperationException("Type.GetTypeFromCLSID retornou null");
                            instance = Activator.CreateInstance(t);
                        }
                        catch (Exception ex)
                        {
                            Log("ERR", $"Falha ao instanciar COM RTD: {ex.Message}\n" +
                                "  → Execute Profit e Bridge com o mesmo usuario/permissao (ambos admin ou ambos normal).");
                            Broadcast(new { type = "error", message = "Falha ao instanciar COM do Profit. Execute Profit e Bridge com o mesmo usuario/permissao (ambos admin ou ambos normal)." });
                            Thread.Sleep(5000);
                            continue;
                        }

                        rtd = (IRtdServer)instance!;
                        cb  = new RtdUpdateCallback();
                        int startResult = rtd.ServerStart(cb);

                        if (startResult != 1)
                        {
                            Log("ERR", $"ServerStart retornou {startResult} — Profit não está pronto. Aguardando...");
                            rtd = null;
                            Thread.Sleep(3000);
                            continue;
                        }

                        Log("RTD", "✓ Conectado ao Profit Pro com sucesso!");
                        Broadcast(new { type = "bridge_ready" });
                        errCount = 0;

                        // Restaura subscrições após reconexão
                        foreach (var tk in tickers.ToList())
                            SubscribeTicker(rtd, tk, topics, ref nextId);
                    }

                    // ── Processa filas de add/remove ─────────────────────────
                    while (_pendingAdd.TryDequeue(out string? addTk))
                        if (tickers.Add(addTk))
                            SubscribeTicker(rtd!, addTk, topics, ref nextId);

                    while (_pendingRemove.TryDequeue(out string? remTk))
                    {
                        tickers.Remove(remTk);
                        foreach (var id in topics.Where(kv => kv.Value.Ticker == remTk).Select(kv => kv.Key).ToList())
                        {
                            try { rtd!.DisconnectData(id); } catch { }
                            topics.Remove(id);
                        }
                    }

                    if (tickers.Count == 0) { Thread.Sleep(500); continue; }

                    // ── Heartbeat ────────────────────────────────────────────
                    try { rtd!.Heartbeat(); } catch { }

                    // ── Lê dados novos via RefreshData ───────────────────────
                    cb!.HasUpdate = false;
                    int topicCount = 0;
                    Array? updated = null;

                    try { updated = rtd!.RefreshData(ref topicCount); }
                    catch (COMException ex)
                    {
                        Log("ERR", $"RefreshData: {ex.Message}");
                        rtd = null;
                        Thread.Sleep(2000);
                        continue;
                    }

                    if (updated != null && topicCount > 0)
                    {
                        for (int i = 0; i < topicCount; i++)
                        {
                            int topicId = Convert.ToInt32(updated.GetValue(0, i));
                            object? value = updated.GetValue(1, i);
                            if (topics.TryGetValue(topicId, out RtdTopic? topic))
                            {
                                var tc = _cache.GetOrAdd(topic.Ticker, _ => new Dictionary<string, object?>());
                                lock (tc) tc[ProfitFields.ToJsonKey(topic.Field)] = ParseDouble(value);
                            }
                        }
                    }

                    // ── Envia payload para clientes WS ───────────────────────
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
                            Console.Write($"\r[RTD] {DateTime.Now:HH:mm:ss} | {tickers.Count} ticker(s) | {_clients.Count} cliente(s)    ");
                        }
                    }

                    errCount = 0;
                    Thread.Sleep(800);
                }
                catch (Exception ex)
                {
                    errCount++;
                    Log("ERR", $"Loop RTD ({errCount}): {ex.Message}");
                    rtd = null;
                    Thread.Sleep(errCount > 5 ? 6000 : 2000);
                    if (errCount > 5) errCount = 0;
                }
            }

            // Cleanup
            try { if (rtd != null) { foreach (var id in topics.Keys) try { rtd.DisconnectData(id); } catch { } rtd.ServerTerminate(); } } catch { }
        }

        // ── Localiza o CLSID do RTD do Profit no registro 32-bit ──────────────
        // Como o processo JÁ é 32-bit, Registry32 e Registry64 apontam para o
        // mesmo hive, mas deixamos ambos para compatibilidade máxima.
        static Guid? FindRtdClsid()
        {
            foreach (var progId in RTD_PROGIDS)
            {
                foreach (var view in new[] { RegistryView.Registry32, RegistryView.Registry64 })
                {
                    try
                    {
                        using var cr   = RegistryKey.OpenBaseKey(RegistryHive.ClassesRoot, view);
                        using var key  = cr.OpenSubKey($@"{progId}\CLSID");
                        string? clsidStr = key?.GetValue(null)?.ToString();
                        if (!string.IsNullOrEmpty(clsidStr) && Guid.TryParse(clsidStr, out Guid g))
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

        static void SubscribeTicker(IRtdServer rtd, string ticker, Dictionary<int, RtdTopic> topics, ref int nextId)
        {
            foreach (var field in ProfitFields.All)
            {
                int id = nextId++;
                Array strings = new string[] { ticker, field };
                bool newValues = true;
                try
                {
                    object? val = rtd.ConnectData(id, ref strings, ref newValues);
                    topics[id] = new RtdTopic(id, ticker, field);
                    var tc = _cache.GetOrAdd(ticker, _ => new Dictionary<string, object?>());
                    lock (tc) tc[ProfitFields.ToJsonKey(field)] = ParseDouble(val);
                }
                catch (Exception ex) { Log("WARN", $"ConnectData {ticker}/{field}: {ex.Message}"); }
            }
            Log("RTD", $"Subscrito: {ticker} ({ProfitFields.All.Length} campos)");
        }

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
            if (v == null) return null;
            string s = v.ToString()?.Trim() ?? "";
            if (double.TryParse(s, NumberStyles.Any, CultureInfo.InvariantCulture, out double d1)) return d1;
            if (double.TryParse(s, NumberStyles.Any, new CultureInfo("pt-BR"), out double d2)) return d2;
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
║   ProfitRTD Bridge v2.2  —  32-bit  —  sem Excel ║
║   Profit Pro (x86) → COM IDispatch → WebSocket    ║
╚══════════════════════════════════════════════════╝");
            Console.ResetColor();
            Console.WriteLine($"  Plataforma : x86 (32-bit) — compatível com Profit Pro");
            Console.WriteLine($"  WebSocket  : ws://localhost:{port}");
            Console.WriteLine($"  RTD ProgID : {string.Join(" | ", RTD_PROGIDS)}");
            Console.WriteLine($"  COM Type   : IDispatch (corrigido v2.2)");
            Console.WriteLine($"  Ctrl+C para encerrar\n");
        }
    }
}
