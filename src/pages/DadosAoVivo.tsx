import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  Radio, Plus, Trash2, Wifi, WifiOff, RefreshCw,
  TrendingUp, TrendingDown, Activity, AlertTriangle, CheckCircle2,
  Terminal, Download, ExternalLink, Info
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import Header from "@/components/Header";
import PayoffChart from "@/components/PayoffChart";
import MetricsCards from "@/components/MetricsCards";
import { Leg, PayoffPoint } from "@/lib/types";
import { calculatePayoffAtExpiry, calculatePayoffToday, calculateMetrics } from "@/lib/payoff";
import { cn } from "@/lib/utils";

// ─── Types ───────────────────────────────────────────────────────────────────

type ConStatus = "disconnected" | "connecting" | "connected" | "error";

interface RtdRow {
  ticker: string;
  ultimo: number | null;
  strike: number | null;
  negocios: number | null;
  ofCompra: number | null;
  ofVenda: number | null;
  vInt: number | null;
  vExt: number | null;
  tipo: "call" | "put" | "stock";
  lado: "buy" | "sell";
  selecionado: boolean;
  lastUpdate: number | null;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const WS_URL = "ws://localhost:8765";
const RECONNECT_DELAY = 3000;
const MAX_RECONNECT = 10;

const fmt = (v: number | null, d = 2) =>
  v !== null && v !== undefined ? v.toFixed(d) : "—";

const statusConfig: Record<ConStatus, { color: string; label: string; icon: React.ElementType }> = {
  disconnected: { color: "text-muted-foreground border-border bg-muted/30", label: "Desconectado", icon: WifiOff },
  connecting:   { color: "text-warning border-warning/30 bg-warning/10", label: "Conectando...", icon: RefreshCw },
  connected:    { color: "text-chart-profit border-chart-profit/30 bg-chart-profit/10", label: "Ao Vivo", icon: Wifi },
  error:        { color: "text-destructive border-destructive/30 bg-destructive/10", label: "Erro de Conexão", icon: AlertTriangle },
};

// ─── Hook: WebSocket RTD ──────────────────────────────────────────────────────

function useRtdBridge() {
  const [status, setStatus] = useState<ConStatus>("disconnected");
  const [rows, setRows] = useState<Map<string, RtdRow>>(new Map());
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [reconnectCount, setReconnectCount] = useState(0);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { toast } = useToast();

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;
    setStatus("connecting");

    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      setStatus("connected");
      setErrorMsg("");
      setReconnectCount(0);
      toast({ title: "✅ Bridge conectado!", description: "Dados do Profit chegando em tempo real." });
    };

    ws.onclose = () => {
      setStatus("disconnected");
      setReconnectCount((prev) => {
        const next = prev + 1;
        if (next <= MAX_RECONNECT) {
          reconnectTimer.current = setTimeout(connect, RECONNECT_DELAY);
        } else {
          setStatus("error");
          setErrorMsg("Bridge não encontrado após várias tentativas. Inicie o ProfitRTDBridge.exe.");
        }
        return next;
      });
    };

    ws.onerror = () => {
      setErrorMsg("Não foi possível conectar em ws://localhost:8765");
    };

    ws.onmessage = (evt) => {
      try {
        const msg = JSON.parse(evt.data);

        if (msg.type === "rtd_data") {
          setRows((prev) => {
            const next = new Map(prev);
            for (const item of msg.data) {
              const existing = prev.get(item.ticker);
              next.set(item.ticker, {
                ticker: item.ticker,
                ultimo: item.ultimo ?? null,
                strike: item.strike ?? null,
                negocios: item.negocios ?? null,
                ofCompra: item.ofCompra ?? null,
                ofVenda: item.ofVenda ?? null,
                vInt: item.vInt ?? null,
                vExt: item.vExt ?? null,
                tipo: existing?.tipo ?? "call",
                lado: existing?.lado ?? "buy",
                selecionado: existing?.selecionado ?? false,
                lastUpdate: item.timestamp ?? Date.now(),
              });
            }
            return next;
          });
        }

        if (msg.type === "error") {
          setErrorMsg(msg.message);
          toast({ title: "Erro no Bridge", description: msg.message, variant: "destructive" });
        }
      } catch { /* ignore */ }
    };
  }, [toast]);

  useEffect(() => {
    connect();
    return () => {
      reconnectTimer.current && clearTimeout(reconnectTimer.current);
      wsRef.current?.close();
    };
  }, [connect]);

  const send = (payload: object) => {
    if (wsRef.current?.readyState === WebSocket.OPEN)
      wsRef.current.send(JSON.stringify(payload));
  };

  const addTicker = (ticker: string) => send({ type: "add_ticker", ticker });
  const removeTicker = (ticker: string) => {
    send({ type: "remove_ticker", ticker });
    setRows((prev) => { const n = new Map(prev); n.delete(ticker); return n; });
  };

  const updateRow = (ticker: string, field: "tipo" | "lado" | "selecionado", value: unknown) => {
    setRows((prev) => {
      const next = new Map(prev);
      const row = next.get(ticker);
      if (row) next.set(ticker, { ...row, [field]: value });
      return next;
    });
  };

  return { status, rows, errorMsg, reconnectCount, connect, addTicker, removeTicker, updateRow };
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function DadosAoVivo() {
  const { toast } = useToast();
  const { status, rows, errorMsg, reconnectCount, connect, addTicker, removeTicker, updateRow } = useRtdBridge();

  const [newTicker, setNewTicker] = useState("");

  const cfg = statusConfig[status];
  const StatusIcon = cfg.icon;
  const rowsArr = Array.from(rows.values());

  const handleAddTicker = () => {
    if (!newTicker.trim()) return;
    if (status !== "connected") {
      toast({ title: "Bridge não conectado", description: "Inicie o ProfitRTDBridge primeiro.", variant: "destructive" });
      return;
    }
    addTicker(newTicker.trim().toUpperCase());
    setNewTicker("");
  };

  const toggleSelect = (ticker: string) => {
    const row = rows.get(ticker);
    if (row) updateRow(ticker, "selecionado", !row.selecionado);
  };

  // Convert selected rows to Leg[] for payoff
  const legs: Leg[] = useMemo(() => {
    return rowsArr
      .filter(r => r.selecionado && (r.ultimo || r.strike))
      .map(r => ({
        side: r.lado,
        option_type: r.tipo,
        asset: r.ticker,
        strike: r.tipo === 'stock' ? 0 : (r.strike ?? 0),
        price: r.ultimo ?? r.ofCompra ?? r.ofVenda ?? 0,
        quantity: 1,
      }));
  }, [rowsArr]);

  // Calculate payoff
  const { payoffData, metrics } = useMemo(() => {
    if (legs.length === 0) return { payoffData: [] as PayoffPoint[], metrics: null };
    const m = calculateMetrics(legs);
    const strikes = legs.map(l => l.strike || l.price).filter(Boolean);
    const prices = legs.map(l => l.price);
    const allVals = [...strikes, ...prices].filter(v => v > 0);
    if (allVals.length === 0) return { payoffData: [] as PayoffPoint[], metrics: m };
    const minVal = Math.min(...allVals);
    const maxVal = Math.max(...allVals);
    const margin = Math.max((maxVal - minVal) * 0.5, maxVal * 0.15, 5);
    const lower = Math.max(0, minVal - margin);
    const upper = maxVal + margin;
    const step = (upper - lower) / 200;
    const data: PayoffPoint[] = [];
    for (let p = lower; p <= upper; p += step) {
      const price = Math.round(p * 100) / 100;
      data.push({
        price,
        profitAtExpiry: calculatePayoffAtExpiry(legs, price),
        profitToday: calculatePayoffToday(legs, price, 21, 0.1375),
      });
    }
    return { payoffData: data, metrics: m };
  }, [legs]);

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container py-6 space-y-5">

        {/* Header */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10 text-primary">
            <Radio className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tight">Tempo Real — Estruturas</h1>
            <p className="text-xs text-muted-foreground">Profit Pro → RTD Bridge → WebSocket → App</p>
          </div>
          <Badge variant="outline" className={cn("ml-auto flex items-center gap-1.5", cfg.color)}>
            <StatusIcon className={cn("w-3 h-3", status === "connecting" && "animate-spin", status === "connected" && "animate-pulse")} />
            {cfg.label}
            {status === "connected" && rows.size > 0 && (
              <span className="text-[10px] opacity-70">· {rows.size} ticker{rows.size > 1 ? "s" : ""}</span>
            )}
          </Badge>
        </div>

        {/* Setup guide — shown when not connected */}
        {status !== "connected" && (
          <Card className="border-warning/20 bg-warning/5">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2 text-warning">
                <Terminal className="w-4 h-4" />
                Configure o Bridge uma vez — depois é automático
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <ol className="space-y-2 text-sm text-muted-foreground">
                {[
                  { n: "1", text: "Abra o Profit Pro (Nelogica) e faça login" },
                  { n: "2", text: "Baixe o ProfitRTD Bridge (botão abaixo) e descompacte em qualquer pasta" },
                  { n: "3", text: 'Execute "iniciar_bridge.bat" como Administrador — exige .NET 6 e Excel instalados' },
                  { n: "4", text: 'Aguarde a janela exibir "WebSocket rodando na porta 8765"' },
                  { n: "5", text: "Este app detecta e conecta automaticamente. Pronto!" },
                ].map((s) => (
                  <li key={s.n} className="flex items-start gap-3">
                    <span className="shrink-0 w-5 h-5 rounded-full bg-warning/20 text-warning text-xs flex items-center justify-center font-bold mt-0.5">
                      {s.n}
                    </span>
                    <span>{s.text}</span>
                  </li>
                ))}
              </ol>

              {errorMsg && (
                <div className="flex items-start gap-2 p-3 rounded bg-destructive/10 border border-destructive/20 text-xs text-destructive">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" className="gap-2 text-warning border-warning/30" asChild>
                  <a href="/downloads/ProfitRTDBridge.zip" download>
                    <Download className="w-3 h-3" /> Baixar ProfitRTD Bridge
                  </a>
                </Button>
                <Button size="sm" variant="outline" className="gap-2" onClick={connect}>
                  <RefreshCw className="w-3 h-3" />
                  Tentar Reconectar {reconnectCount > 0 && `(${reconnectCount}/${MAX_RECONNECT})`}
                </Button>
                <Button size="sm" variant="ghost" className="gap-2 text-muted-foreground" asChild>
                  <a href="https://dotnet.microsoft.com/download/dotnet/6.0" target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="w-3 h-3" /> Instalar .NET 6 SDK
                  </a>
                </Button>
              </div>

              <div className="p-3 rounded bg-info/10 border border-info/20 text-xs text-info flex items-start gap-2">
                <Info className="w-3 h-3 shrink-0 mt-0.5" />
                <span>
                  O RTD é tecnologia COM/OLE exclusiva do Windows. O bridge roda <strong>localmente na sua máquina</strong> e
                  transmite dados do Profit via WebSocket para este app. <strong>Nenhum dado sai da sua rede local.</strong>
                </span>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Connected: add ticker */}
        {status === "connected" && (
          <Card className="border-chart-profit/20 bg-chart-profit/5">
            <CardContent className="pt-4 space-y-3">
              <div className="flex items-center gap-2 text-chart-profit">
                <CheckCircle2 className="w-4 h-4" />
                <span className="text-sm font-medium">Bridge conectado — dados chegando em tempo real</span>
                <Activity className="w-3.5 h-3.5 animate-pulse ml-1" />
              </div>
              <div className="flex flex-wrap gap-2 items-end">
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-muted-foreground">Ticker a monitorar</label>
                  <Input
                    className="w-40 uppercase font-mono"
                    placeholder="ex: PETRG345"
                    value={newTicker}
                    onChange={(e) => setNewTicker(e.target.value.toUpperCase())}
                    onKeyDown={(e) => e.key === "Enter" && handleAddTicker()}
                  />
                </div>
                <Button onClick={handleAddTicker} className="gap-2">
                  <Plus className="w-4 h-4" /> Monitorar
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Live table */}
        {rowsArr.length > 0 && (
          <Card>
            <CardHeader className="pb-3 flex flex-row items-center justify-between gap-3 flex-wrap">
              <CardTitle className="text-sm flex items-center gap-2">
                <Activity className="w-4 h-4 text-chart-profit animate-pulse" />
                Cotações em Tempo Real
                <Badge variant="secondary">{rowsArr.length}</Badge>
              </CardTitle>
              <Button
                onClick={() => {
                  const selected = rowsArr.filter(r => r.selecionado);
                  if (selected.length === 0) {
                    toast({ title: "Selecione ao menos uma linha", variant: "destructive" });
                  }
                }}
                disabled={!rowsArr.some((r) => r.selecionado)}
                className="gap-2"
              >
                <TrendingUp className="w-4 h-4" />
                {legs.length > 0 ? `${legs.length} perna(s) no Payoff` : 'Selecione para Payoff'}
              </Button>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-8">✓</TableHead>
                      <TableHead>Ticker</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Lado</TableHead>
                      <TableHead className="text-right">Último</TableHead>
                      <TableHead className="text-right">Strike</TableHead>
                      <TableHead className="text-right">Negócios</TableHead>
                      <TableHead className="text-right">Of. Compra</TableHead>
                      <TableHead className="text-right">Of. Venda</TableHead>
                      <TableHead className="text-right">V. Intrínseco</TableHead>
                      <TableHead className="text-right">V. Extrínseco</TableHead>
                      <TableHead className="w-8"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rowsArr.map((row) => {
                      const isStale = row.lastUpdate ? (Date.now() - row.lastUpdate) > 5000 : false;
                      return (
                        <TableRow
                          key={row.ticker}
                          className={cn(
                            "cursor-pointer transition-colors",
                            row.selecionado && "bg-primary/10",
                            isStale && "opacity-50"
                          )}
                          onClick={() => toggleSelect(row.ticker)}
                        >
                          <TableCell>
                            <input
                              type="checkbox"
                              checked={row.selecionado}
                              onChange={() => toggleSelect(row.ticker)}
                              onClick={(e) => e.stopPropagation()}
                              className="accent-primary"
                            />
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono font-bold text-primary">{row.ticker}</span>
                              {!isStale && <span className="w-1.5 h-1.5 rounded-full bg-chart-profit animate-pulse" />}
                            </div>
                          </TableCell>
                          <TableCell onClick={(e) => e.stopPropagation()}>
                            <Select value={row.tipo} onValueChange={(v) => updateRow(row.ticker, "tipo", v)}>
                              <SelectTrigger className="h-7 w-20 text-xs"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="call">Call</SelectItem>
                                <SelectItem value="put">Put</SelectItem>
                                <SelectItem value="stock">Ação</SelectItem>
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell onClick={(e) => e.stopPropagation()}>
                            <Select value={row.lado} onValueChange={(v) => updateRow(row.ticker, "lado", v)}>
                              <SelectTrigger className="h-7 w-28 text-xs"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="buy">
                                  <span className="flex items-center gap-1"><TrendingUp className="w-3 h-3" /> Compra</span>
                                </SelectItem>
                                <SelectItem value="sell">
                                  <span className="flex items-center gap-1"><TrendingDown className="w-3 h-3" /> Venda</span>
                                </SelectItem>
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell className="text-right font-mono font-semibold">{fmt(row.ultimo)}</TableCell>
                          <TableCell className="text-right font-mono">{fmt(row.strike)}</TableCell>
                          <TableCell className="text-right font-mono">{fmt(row.negocios, 0)}</TableCell>
                          <TableCell className="text-right font-mono">{fmt(row.ofCompra)}</TableCell>
                          <TableCell className="text-right font-mono">{fmt(row.ofVenda)}</TableCell>
                          <TableCell className="text-right font-mono">{fmt(row.vInt)}</TableCell>
                          <TableCell className="text-right font-mono">{fmt(row.vExt)}</TableCell>
                          <TableCell onClick={(e) => e.stopPropagation()}>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive"
                              onClick={() => removeTicker(row.ticker)}>
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Payoff — auto-generated from selected rows */}
        {metrics && (
          <div className="space-y-4">
            <MetricsCards metrics={metrics} />
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-primary" />
                  Gráfico Payoff — Tempo Real
                  <Badge variant="outline" className="text-chart-profit border-chart-profit/30">
                    {legs.length} perna{legs.length > 1 ? "s" : ""}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <PayoffChart
                  data={payoffData}
                  breakevens={metrics.breakevens}
                  netCost={metrics.netCost}
                  montageTotal={metrics.montageTotal}
                  maxGain={metrics.maxGain}
                  maxLoss={metrics.maxLoss}
                />
              </CardContent>
            </Card>
          </div>
        )}

        {/* Empty connected state */}
        {rowsArr.length === 0 && status === "connected" && (
          <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground space-y-3">
            <Wifi className="w-12 h-12 opacity-20" />
            <p className="text-sm">Bridge conectado! Adicione tickers para monitorar.</p>
          </div>
        )}
      </main>
    </div>
  );
}
