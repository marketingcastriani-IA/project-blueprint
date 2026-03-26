/*
 * ProfitRTDBridge.cs
 * Servidor bridge que lê dados RTD do Profit Pro (Nelogica) via COM/Excel
 * e transmite em tempo real para o app web via WebSocket.
 *
 * REQUISITOS:
 *   - Windows 10/11
 *   - .NET 6+ (ou .NET Framework 4.7.2+)
 *   - Microsoft Excel instalado (qualquer versão)
 *   - Profit Pro aberto e logado
 *   - NuGet: Microsoft.Office.Interop.Excel (via COM reference)
 *             Fleck (WebSocket server) -> Install-Package Fleck
 *             Newtonsoft.Json          -> Install-Package Newtonsoft.Json
 *
 * USO:
 *   1. Compile: dotnet build
 *   2. Execute: dotnet run -- --port 8765 --tickers PETRG345,PETRG340,PETRA3
 *   3. O app web conecta em ws://localhost:8765
 */

using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Fleck;
using Microsoft.Office.Interop.Excel;
using Newtonsoft.Json;

namespace ProfitRTDBridge
{
    class Program
    {
        static volatile bool _running = true;
        static List<IWebSocketConnection> _clients = new();
        static readonly object _lock = new();

        static void Main(string[] args)
        {
            int port = 8765;
            var tickers = new List<string>();

            // Parse args: --port 8765 --tickers PETRG345,PETRG340
            for (int i = 0; i < args.Length - 1; i++)
            {
                if (args[i] == "--port") int.TryParse(args[i + 1], out port);
                if (args[i] == "--tickers") tickers = args[i + 1].Split(',').ToList();
            }

            Console.Title = "ProfitRTD Bridge";
            Console.ForegroundColor = ConsoleColor.Cyan;
            Console.WriteLine("╔══════════════════════════════════════╗");
            Console.WriteLine("║     ProfitRTD Bridge v1.0            ║");
            Console.WriteLine("║     Nelogica → Excel RTD → WebSocket ║");
            Console.WriteLine("╚══════════════════════════════════════╝");
            Console.ResetColor();
            Console.WriteLine($"\n[INFO] WebSocket: ws://localhost:{port}");
            Console.WriteLine($"[INFO] Tickers carregados: {(tickers.Count > 0 ? string.Join(", ", tickers) : "nenhum — adicione via app")}");
            Console.WriteLine("[INFO] Pressione Ctrl+C para encerrar\n");

            // WebSocket server (Fleck)
            var wsServer = new WebSocketServer($"ws://0.0.0.0:{port}");
            wsServer.Start(socket =>
            {
                socket.OnOpen = () =>
                {
                    lock (_lock) _clients.Add(socket);
                    Console.WriteLine($"[WS] Cliente conectado: {socket.ConnectionInfo.ClientIpAddress}");
                    // Envia lista de tickers atual
                    socket.Send(JsonConvert.SerializeObject(new { type = "tickers", data = tickers }));
                };
                socket.OnClose = () =>
                {
                    lock (_lock) _clients.Remove(socket);
                    Console.WriteLine($"[WS] Cliente desconectado");
                };
                socket.OnMessage = msg =>
                {
                    try
                    {
                        var cmd = JsonConvert.DeserializeObject<dynamic>(msg);
                        string type = cmd?.type?.ToString() ?? "";

                        if (type == "add_ticker")
                        {
                            string t = cmd?.ticker?.ToString()?.ToUpper() ?? "";
                            if (!string.IsNullOrEmpty(t) && !tickers.Contains(t))
                            {
                                tickers.Add(t);
                                Console.WriteLine($"[RTD] Ticker adicionado: {t}");
                                Broadcast(new { type = "tickers", data = tickers });
                            }
                        }
                        else if (type == "remove_ticker")
                        {
                            string t = cmd?.ticker?.ToString()?.ToUpper() ?? "";
                            tickers.Remove(t);
                            Console.WriteLine($"[RTD] Ticker removido: {t}");
                            Broadcast(new { type = "tickers", data = tickers });
                        }
                        else if (type == "ping")
                        {
                            socket.Send(JsonConvert.SerializeObject(new { type = "pong" }));
                        }
                    }
                    catch (Exception ex)
                    {
                        Console.WriteLine($"[ERR] Mensagem inválida: {ex.Message}");
                    }
                };
            });

            Console.CancelKeyPress += (_, e) => { e.Cancel = true; _running = false; };

            // RTD polling loop via Excel Interop
            Task.Run(() => RunRtdLoop(tickers));

            while (_running) Thread.Sleep(500);

            wsServer.Dispose();
            Console.WriteLine("[INFO] Bridge encerrado.");
        }

        static void RunRtdLoop(List<string> tickers)
        {
            Application? excel = null;
            Workbook? wb = null;
            Worksheet? ws = null;

            try
            {
                Console.WriteLine("[Excel] Iniciando instância do Excel...");
                excel = new Application { Visible = false, DisplayAlerts = false };
                wb = excel.Workbooks.Add();
                ws = (Worksheet)wb.Sheets[1];
                Console.WriteLine("[Excel] Excel iniciado com sucesso.");

                // Mapa de campos RTD
                var fields = new Dictionary<string, string>
                {
                    { "ULT",  "ultimo"   },
                    { "PEX",  "strike"   },
                    { "NEG",  "negocios" },
                    { "OCP",  "ofCompra" },
                    { "OVD",  "ofVenda"  },
                    { "VINT", "vInt"     },
                    { "VEXT", "vExt"     },
                };

                int errorCount = 0;

                while (_running)
                {
                    try
                    {
                        if (tickers.Count == 0)
                        {
                            Thread.Sleep(500);
                            continue;
                        }

                        var snapshot = new List<string>(tickers); // thread-safe copy
                        var payload = new List<object>();

                        foreach (var ticker in snapshot)
                        {
                            var tickerData = new Dictionary<string, object?> { { "ticker", ticker } };
                            int col = 1;

                            // Coloca o ticker na célula A1 (temporário)
                            ws.Cells[1, 1] = ticker;

                            foreach (var (rtdField, jsonField) in fields)
                            {
                                try
                                {
                                    // Fórmula RTD: =RTD("rtdtrading.rtdserver";;ticker;campo)
                                    string formula = $"=RTD(\"rtdtrading.rtdserver\",,\"{ticker}\",\"{rtdField}\")";
                                    Range cell = ws.Cells[2, col];
                                    cell.Formula = formula;

                                    // Força cálculo e lê valor
                                    excel.Calculate();
                                    object val = cell.Value2;

                                    if (val != null && val.ToString() != "#N/A" && val.ToString() != "Error")
                                    {
                                        if (double.TryParse(val.ToString(), out double d))
                                            tickerData[jsonField] = d;
                                        else
                                            tickerData[jsonField] = null;
                                    }
                                    else
                                    {
                                        tickerData[jsonField] = null;
                                    }
                                }
                                catch
                                {
                                    tickerData[jsonField] = null;
                                }
                                col++;
                            }

                            tickerData["timestamp"] = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
                            payload.Add(tickerData);
                        }

                        if (payload.Count > 0)
                        {
                            Broadcast(new { type = "rtd_data", data = payload });
                            Console.Write($"\r[RTD] {DateTime.Now:HH:mm:ss} | {snapshot.Count} tickers | {_clients.Count} cliente(s)    ");
                        }

                        errorCount = 0;
                        Thread.Sleep(800); // ~1.2 atualizações/segundo
                    }
                    catch (Exception ex)
                    {
                        errorCount++;
                        Console.WriteLine($"\n[ERR] Loop RTD ({errorCount}): {ex.Message}");
                        if (errorCount > 10)
                        {
                            Console.WriteLine("[ERR] Muitos erros consecutivos. Reconectando Excel...");
                            Thread.Sleep(3000);
                            errorCount = 0;
                        }
                        Thread.Sleep(1000);
                    }
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"\n[FATAL] Falha ao iniciar Excel/RTD: {ex.Message}");
                Console.WriteLine("[DICA] Verifique se o Excel está instalado e o Profit Pro está aberto.");
                Broadcast(new { type = "error", message = "Falha ao conectar com Excel/RTD. Verifique se o Profit Pro e Excel estão abertos." });
            }
            finally
            {
                try
                {
                    wb?.Close(false);
                    excel?.Quit();
                }
                catch { }
            }
        }

        static void Broadcast(object payload)
        {
            string json = JsonConvert.SerializeObject(payload);
            List<IWebSocketConnection> clientsCopy;
            lock (_lock) clientsCopy = new List<IWebSocketConnection>(_clients);
            foreach (var client in clientsCopy)
            {
                try { client.Send(json); }
                catch { }
            }
        }
    }
}
