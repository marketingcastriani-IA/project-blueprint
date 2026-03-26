/*
 * ProfitRTDBridge.cs
 * ─────────────────────────────────────────────────────────────────────────────
 * Bridge SEM Excel — acessa o servidor RTD do Profit Pro (Nelogica)
 * diretamente via COM (IRtdServer / ProgID "rtdtrading.rtdserver")
 * e transmite os dados em tempo real via WebSocket para o app web.
 *
 * REQUISITOS:
 *   - Windows 10/11 (64-bit)
 *   - .NET 6+ (qualquer versão, NÃO precisa de Excel)
 *   - Profit Pro aberto e logado na Nelogica
 *   - NuGet: Fleck (WebSocket)  → já no .csproj
 *            Newtonsoft.Json    → já no .csproj
 *
 * COMO FUNCIONA:
 *   O Profit Pro registra um servidor COM com ProgID "rtdtrading.rtdserver".
 *   Este bridge instancia esse COM object diretamente (sem Excel),
 *   subscreve os tópicos desejados e faz polling dos valores a cada ~800ms.
 *
 * USO:
 *   Execute iniciar_bridge.bat
 *   Ou: dotnet run -- --port 8765
 * ─────────────────────────────────────────────────────────────────────────────
 */

using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.Linq;
using System.Runtime.InteropServices;
using System.Threading;
using System.Threading.Tasks;
using Fleck;
using Newtonsoft.Json;

namespace ProfitRTDBridge
{
    // ── IRtdServer COM interface (idêntica à usada pelo Excel internamente) ──
    [ComImport]
    [Guid("EC0E6191-DB51-11D3-8F3E-00C04F3651B8")]
    [InterfaceType(ComInterfaceType.InterfaceIsIDispatch)]
    interface IRtdServer
    {
        [DispId(10)] int ServerStart(IRTDUpdateEvent callback);
        [DispId(11)] object ConnectData(int topicId, ref Array strings, ref bool newValues);
        [DispId(12)] Array RefreshData(ref int topicCount);
        [DispId(13)] void DisconnectData(int topicId);
        [DispId(14)] int Heartbeat();
        [DispId(15)] void ServerTerminate();
    }

    // ── Callback que o RTD server chama quando há dados novos ──
    [ComImport]
    [Guid("A43788C1-D91B-11D3-8F39-00C04F3651B8")]
    [InterfaceType(ComInterfaceType.InterfaceIsIDispatch)]
    interface IRTDUpdateEvent
    {
        [DispId(10)] void UpdateNotify();
        [DispId(11)] int HeartbeatInterval { get; set; }
        [DispId(12)] void Disconnect();
    }

    // ── Implementação do callback ──
    class RtdUpdateCallback : IRTDUpdateEvent
    {
        public volatile bool HasUpdate = false;
        public void UpdateNotify() => HasUpdate = true;
        public int HeartbeatInterval { get => 30000; set { } }
        public void Disconnect() { }
    }

    // ── Tópico RTD ──
    record RtdTopic(int Id, string Ticker, string Field);

    // ── Campos RTD do Profit ──
    static class ProfitFields
    {
        public static readonly string[] All = { "ULT", "PEX", "NEG", "OCP", "OVD", "VINT", "VEXT" };

        public static string ToJsonKey(string field) => field switch
        {
            "ULT"  => "ultimo",
            "PEX"  => "strike",
            "NEG"  => "negocios",
            "OCP"  => "ofCompra",
            "OVD"  => "ofVenda",
            "VINT" => "vInt",
            "VEXT" => "vExt",
            _      => field.ToLower()
        };
    }

    // ─────────────────────────────────────────────────────────────────────────
    class Program
    {
        const string RTD_PROGID = "rtdtrading.rtdserver";

        static volatile bool _running = true;
        static readonly List<IWebSocketConnection> _clients = new();
        static readonly object _clientLock = new();
        static readonly ConcurrentDictionary<string, Dictionary<string, object?>> _cache = new();

        static void Main(string[] args)
        {
            int port = 8765;
            for (int i = 0; i < args.Length - 1; i++)
                if (args[i] == "--port") int.TryParse(args[i + 1], out port);

            Console.Title = "ProfitRTD Bridge (sem Excel)";
            PrintBanner(port);

            // ── WebSocket server ──
            var wsServer = new WebSocketServer($"ws://0.0.0.0:{port}");
            wsServer.Start(socket =>
            {
                socket.OnOpen = () =>
                {
                    lock (_clientLock) _clients.Add(socket);
                    Log("WS", $"Cliente conectado: {socket.ConnectionInfo.ClientIpAddress}");

                    // Envia snapshot atual do cache imediatamente
                    if (_cache.Count > 0)
                        SendSnapshot(socket);
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
                            if (!string.IsNullOrEmpty(t))
                            {
                                _pendingAdd.Enqueue(t);
                                Log("CMD", $"Ticker a monitorar: {t}");
                            }
                        }
                        else if (type == "remove_ticker")
                        {
                            string t = (cmd?.ticker?.ToString() ?? "").ToUpper().Trim();
                            _pendingRemove.Enqueue(t);
                            _cache.TryRemove(t, out _);
                            Log("CMD", $"Ticker removido: {t}");
                        }
                        else if (type == "ping")
                        {
                            socket.Send(JsonConvert.SerializeObject(new { type = "pong" }));
                        }
                    }
                    catch (Exception ex)
                    {
                        Log("ERR", $"Mensagem inválida: {ex.Message}");
                    }
                };
            });

            Console.CancelKeyPress += (_, e) => { e.Cancel = true; _running = false; };

            // ── RTD loop numa thread STA (obrigatório para COM) ──
            var rtdThread = new Thread(RtdLoop) { IsBackground = true };
            rtdThread.SetApartmentState(ApartmentState.STA);
            rtdThread.Start();

            while (_running) Thread.Sleep(300);

            wsServer.Dispose();
            Log("INFO", "Bridge encerrado.");
        }

        // ── Filas de comandos thread-safe para o loop RTD ──
        static readonly ConcurrentQueue<string> _pendingAdd    = new();
        static readonly ConcurrentQueue<string> _pendingRemove = new();

        // ── Loop principal RTD (thread STA) ──
        static void RtdLoop()
        {
            IRtdServer? rtd = null;
            RtdUpdateCallback? callback = null;
            var topics = new Dictionary<int, RtdTopic>();   // topicId → tópico
            var tickers = new HashSet<string>();
            int nextTopicId = 1;
            int errorCount = 0;

            while (_running)
            {
                try
                {
                    // ── Instancia o COM server do Profit ──
                    if (rtd == null)
                    {
                        Log("RTD", $"Conectando ao servidor COM: {RTD_PROGID}");
                        Type? comType = Type.GetTypeFromProgID(RTD_PROGID, throwOnError: false);

                        if (comType == null)
                        {
                            Log("ERR", "Servidor RTD não encontrado. Profit Pro está aberto e logado?");
                            Broadcast(new { type = "error", message = "Profit Pro não encontrado. Abra o Profit Pro e tente novamente." });
                            Thread.Sleep(5000);
                            continue;
                        }

                        rtd = (IRtdServer)Activator.CreateInstance(comType)!;
                        callback = new RtdUpdateCallback();
                        int result = rtd.ServerStart(callback);

                        if (result != 1)
                        {
                            Log("ERR", $"ServerStart retornou {result}. Profit pode não estar pronto.");
                            rtd = null;
                            Thread.Sleep(3000);
                            continue;
                        }

                        Log("RTD", "Conectado ao Profit Pro com sucesso!");
                        Broadcast(new { type = "bridge_ready" });
                        errorCount = 0;

                        // Re-subscreve tickers já conhecidos após reconexão
                        foreach (var ticker in tickers.ToList())
                            SubscribeTicker(rtd, ticker, topics, ref nextTopicId);
                    }

                    // ── Processa adições pendentes ──
                    while (_pendingAdd.TryDequeue(out string? addTicker))
                    {
                        if (!tickers.Contains(addTicker))
                        {
                            tickers.Add(addTicker);
                            SubscribeTicker(rtd, addTicker, topics, ref nextTopicId);
                        }
                    }

                    // ── Processa remoções pendentes ──
                    while (_pendingRemove.TryDequeue(out string? remTicker))
                    {
                        tickers.Remove(remTicker);
                        var toRemove = topics.Where(kv => kv.Value.Ticker == remTicker).Select(kv => kv.Key).ToList();
                        foreach (var id in toRemove)
                        {
                            try { rtd.DisconnectData(id); } catch { }
                            topics.Remove(id);
                        }
                    }

                    if (tickers.Count == 0)
                    {
                        Thread.Sleep(500);
                        continue;
                    }

                    // ── Heartbeat ──
                    try { rtd.Heartbeat(); } catch { }

                    // ── Lê dados atualizados ──
                    if (callback!.HasUpdate || true) // polling contínuo
                    {
                        callback.HasUpdate = false;
                        int topicCount = 0;
                        Array? updated = null;

                        try
                        {
                            updated = rtd.RefreshData(ref topicCount);
                        }
                        catch (COMException ex)
                        {
                            Log("ERR", $"RefreshData falhou: {ex.Message}");
                            rtd = null; // forçar reconexão
                            Thread.Sleep(2000);
                            continue;
                        }

                        // Atualiza cache com novos valores
                        if (updated != null && topicCount > 0)
                        {
                            for (int i = 0; i < topicCount; i++)
                            {
                                int topicId = (int)updated.GetValue(0, i)!;
                                object? value = updated.GetValue(1, i);

                                if (topics.TryGetValue(topicId, out RtdTopic? topic))
                                {
                                    var tickerCache = _cache.GetOrAdd(topic.Ticker, _ => new Dictionary<string, object?>());
                                    string jsonKey = ProfitFields.ToJsonKey(topic.Field);

                                    double? numVal = null;
                                    if (value != null && double.TryParse(value.ToString()?.Replace(",", "."), out double d))
                                        numVal = d;

                                    lock (tickerCache) tickerCache[jsonKey] = numVal;
                                }
                            }
                        }

                        // Monta e envia payload completo
                        if (_cache.Count > 0)
                        {
                            var payload = _cache
                                .Where(kv => tickers.Contains(kv.Key))
                                .Select(kv =>
                                {
                                    var d = new Dictionary<string, object?> { ["ticker"] = kv.Key };
                                    lock (kv.Value)
                                        foreach (var f in kv.Value) d[f.Key] = f.Value;
                                    d["timestamp"] = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
                                    return d;
                                })
                                .ToList();

                            if (payload.Count > 0)
                            {
                                Broadcast(new { type = "rtd_data", data = payload });
                                Console.Write($"\r[RTD] {DateTime.Now:HH:mm:ss} | {tickers.Count} ticker(s) | {_clients.Count} cliente(s) conectado(s)    ");
                            }
                        }

                        errorCount = 0;
                    }

                    Thread.Sleep(800);
                }
                catch (Exception ex)
                {
                    errorCount++;
                    Log("ERR", $"Loop RTD ({errorCount}): {ex.Message}");
                    rtd = null;

                    if (errorCount > 5)
                    {
                        Broadcast(new { type = "error", message = "Conexão com Profit Pro perdida. Reconectando..." });
                        Thread.Sleep(5000);
                        errorCount = 0;
                    }
                    else
                    {
                        Thread.Sleep(2000);
                    }
                }
            }

            // Cleanup
            try
            {
                if (rtd != null)
                {
                    foreach (var id in topics.Keys)
                        try { rtd.DisconnectData(id); } catch { }
                    rtd.ServerTerminate();
                }
            }
            catch { }
        }

        // ── Subscreve todos os campos de um ticker ──
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

                    // Valor inicial
                    string jsonKey = ProfitFields.ToJsonKey(field);
                    double? numVal = null;
                    if (val != null && double.TryParse(val.ToString()?.Replace(",", "."), out double d))
                        numVal = d;

                    var tickerCache = _cache.GetOrAdd(ticker, _ => new Dictionary<string, object?>());
                    lock (tickerCache) tickerCache[jsonKey] = numVal;
                }
                catch (Exception ex)
                {
                    Log("WARN", $"ConnectData falhou para {ticker}/{field}: {ex.Message}");
                }
            }

            Log("RTD", $"Subscrito: {ticker} ({ProfitFields.All.Length} campos)");
        }

        // ── Envia snapshot atual para um cliente recém-conectado ──
        static void SendSnapshot(IWebSocketConnection socket)
        {
            var payload = _cache.Select(kv =>
            {
                var d = new Dictionary<string, object?> { ["ticker"] = kv.Key };
                lock (kv.Value) foreach (var f in kv.Value) d[f.Key] = f.Value;
                d["timestamp"] = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
                return d;
            }).ToList();

            try { socket.Send(JsonConvert.SerializeObject(new { type = "rtd_data", data = payload })); }
            catch { }
        }

        // ── Broadcast para todos os clientes WS ──
        static void Broadcast(object payload)
        {
            string json = JsonConvert.SerializeObject(payload);
            List<IWebSocketConnection> copy;
            lock (_clientLock) copy = new List<IWebSocketConnection>(_clients);
            foreach (var c in copy) try { c.Send(json); } catch { }
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
╔══════════════════════════════════════════════╗
║   ProfitRTD Bridge v2.0  —  sem Excel        ║
║   Profit Pro → COM direto → WebSocket        ║
╚══════════════════════════════════════════════╝");
            Console.ResetColor();
            Console.WriteLine($"  WebSocket : ws://localhost:{port}");
            Console.WriteLine($"  RTD ProgID: {RTD_PROGID}");
            Console.WriteLine($"  Pressione Ctrl+C para encerrar\n");
        }
    }
}
