import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useAccessControl } from "@/hooks/useAccessControl";
import { format } from "date-fns";
import { countBusinessDays } from "@/lib/b3-calendar";
import {
  Radio, Plus, Trash2, Wifi, WifiOff, RefreshCw,
  TrendingUp, TrendingDown, Activity, AlertTriangle, CheckCircle2,
  Terminal, Download, ExternalLink, Info, Save, CalendarIcon, Loader2,
  Edit, DollarSign, Percent, Briefcase, Zap, BookOpen, Database, Search
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import Header from "@/components/Header";
import TickerOpcoes from "@/pages/TickerOpcoes";
import PayoffChart from "@/components/PayoffChart";
import BridgeSetupGuide from "@/components/BridgeSetupGuide";
import MetricsCards from "@/components/MetricsCards";
import { Leg, PayoffPoint } from "@/lib/types";
import { calculatePayoffAtExpiry, calculatePayoffToday, calculateMetrics } from "@/lib/payoff";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

// ─── Types & Hook (shared) ───────────────────────────────────────────────────
import { useSharedRtdBridge } from "@/contexts/RtdBridgeContext";
import { statusConfig, type ConStatus, type RtdRow } from "@/hooks/useRtdBridge";
import { extractStrikeFromTicker } from "@/lib/b3-utils";
import { useB3Options } from "@/contexts/B3OptionsContext";

const fmt = (v: number | null, d = 2) =>
  v !== null && v !== undefined ? v.toFixed(d) : "—";

/** Get best strike: RTD PEX > 0 first, then B3 options DB, then ticker-parsed fallback */
const getStrike = (row: RtdRow, getStrikeAndExpiry?: (ticker: string) => { strike: number; vencimento: string; tipo: "CALL" | "PUT" } | null): number | null => {
  if (row.strike !== null && row.strike > 0) return row.strike;
  if (row.tipo === "stock") return null;
  // Try B3 options database
  const b3Info = getStrikeAndExpiry?.(row.ticker);
  if (b3Info && b3Info.strike > 0) return b3Info.strike;
  const parsed = extractStrikeFromTicker(row.ticker);
  return parsed > 0 ? parsed : null;
};

// ─── Date Picker ─────────────────────────────────────────────────────────────

function InlineDatePicker({ date, onChange }: { date?: Date; onChange: (date?: Date) => void }) {
  const [open, setOpen] = useState(false);
  const isEmpty = !date;
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "h-7 w-full justify-center text-xs px-1.5",
            isEmpty
              ? "border border-muted-foreground/30 text-muted-foreground"
              : "border-success/50 text-success font-bold bg-success/10",
          )}
        >
          <CalendarIcon className={cn("mr-0.5 h-3 w-3", isEmpty ? "text-muted-foreground" : "text-success")} />
          {date ? format(date, "dd/MM/yy") : "Venc."}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={date}
          onSelect={(d) => { onChange(d); setOpen(false); }}
          initialFocus
          className="p-3 pointer-events-auto"
        />
      </PopoverContent>
    </Popover>
  );
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function DadosAoVivo() {
  const { toast } = useToast();
  const { user } = useAuth();
  const navigate = useNavigate();
  const accessControl = useAccessControl();
  const { getStrikeAndExpiry } = useB3Options();
  const { status, rows, errorMsg, reconnectCount, connect, addTicker, removeTicker, updateRow } = useSharedRtdBridge();

  const [newTicker, setNewTicker] = useState("");
  const [showBanco, setShowBanco] = useState(false);
  const [analysisName, setAnalysisName] = useState("");
  const [saving, setSaving] = useState(false);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [showNameDialog, setShowNameDialog] = useState(false);
  const [pendingSaveName, setPendingSaveName] = useState("");

  // Track which tickers were manually added by user (vs auto-subscribed from operations)
  const [manualTickers, setManualTickers] = useState<Set<string>>(new Set());

  // Open operations state — dados crus do banco (sem P&L ao vivo)
  const [openOpsRaw, setOpenOpsRaw] = useState<any[]>([]);
  const [editingNameId, setEditingNameId] = useState<string | null>(null);
  const [editNameValue, setEditNameValue] = useState("");

  const cfg = statusConfig[status];
  const StatusIcon = status === "disconnected" ? WifiOff : status === "connecting" ? RefreshCw : status === "connected" ? Wifi : AlertTriangle;
  const rowsArr = Array.from(rows.values());
  // Only show manually added tickers in the table
  const manualRowsArr = rowsArr.filter(r => manualTickers.has(r.ticker));

  // Busca as operações abertas do banco. Só depende de [user] — NÃO refaz queries
  // a cada tick do RTD. Uma única query de legs (.in) evita N+1.
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    const fetchOps = async () => {
      const { data: analyses } = await supabase
        .from('analyses')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .order('created_at', { ascending: false });
      if (cancelled || !analyses) return;

      const ids = analyses.map((a) => a.id);
      const legsByAnalysis = new Map<string, any[]>();
      if (ids.length > 0) {
        const { data: allLegs } = await supabase
          .from('legs')
          .select('*')
          .in('analysis_id', ids);
        for (const l of allLegs || []) {
          const arr = legsByAnalysis.get(l.analysis_id);
          if (arr) arr.push(l);
          else legsByAnalysis.set(l.analysis_id, [l]);
        }
      }
      if (cancelled) return;

      const ops = analyses.map((a) => {
        const rawLegs = legsByAnalysis.get(a.id) || [];
        const legsList: Leg[] = rawLegs.map((l: any) => ({
          side: l.side as 'buy' | 'sell',
          option_type: l.option_type as 'call' | 'put' | 'stock',
          asset: l.asset,
          strike: l.strike,
          price: l.price,
          quantity: l.quantity,
          expiry_date: l.expiry_date,
        }));
        return { ...a, legs: legsList, rawLegs };
      });
      setOpenOpsRaw(ops);
    };
    fetchOps();
    const interval = setInterval(fetchOps, 30000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [user]);

  // Deriva o P&L ao vivo a partir dos dados crus + cotações RTD.
  // Recalcula a cada tick (só matemática, sem tocar no banco).
  const openOps = useMemo(() => {
    const CDI_ANNUAL = 14.90;
    const now = new Date();
    return openOpsRaw.map((op) => {
      const legsList: Leg[] = op.legs;
      const rawLegs: any[] = op.rawLegs;
      const m = legsList.length > 0 ? calculateMetrics(legsList) : null;
      const investido = legsList.reduce((acc, l) => {
        const cost = l.price * l.quantity * (l.option_type === 'stock' ? 1 : 100);
        return acc + (l.side === 'buy' ? cost : -cost);
      }, 0);

      let lucroAtual = 0;
      let temDadoVivo = false;
      for (let i = 0; i < legsList.length; i++) {
        const leg = legsList[i];
        const dbLeg = rawLegs[i];
        const livePrice = rows.get(leg.asset)?.ultimo;
        const savedPrice = dbLeg?.current_price;
        const exitPrice = (livePrice != null && livePrice > 0) ? livePrice : (savedPrice != null && savedPrice > 0 ? savedPrice : null);

        if (exitPrice != null && exitPrice > 0) {
          temDadoVivo = true;
          const multiplier = leg.side === 'buy' ? 1 : -1;
          lucroAtual += multiplier * (exitPrice - leg.price) * leg.quantity;
        }
      }

      const createdAt = new Date(op.created_at);
      const bizDays = countBusinessDays(createdAt, now);
      const absInvestido = Math.abs(investido);
      const cdiReturn = absInvestido > 0 && bizDays > 0
        ? absInvestido * (Math.pow(1 + CDI_ANNUAL / 100, bizDays / 252) - 1)
        : 0;
      const cdiPct = cdiReturn > 0 ? (lucroAtual / cdiReturn) * 100 : 0;

      return {
        ...op,
        metrics: m,
        investido,
        lucroAtual,
        temDadoVivo,
        pctLucro: investido !== 0 ? (lucroAtual / Math.abs(investido)) * 100 : 0,
        cdiPct,
        cdiReturn,
        bizDays,
      };
    });
  }, [openOpsRaw, rows]);

  const handleAddTicker = () => {
    if (!newTicker.trim()) return;
    if (status !== "connected") {
      toast({ title: "Bridge não conectado", description: "Inicie o ProfitRTDBridge primeiro.", variant: "destructive" });
      return;
    }
    const ticker = newTicker.trim().toUpperCase();
    setManualTickers(prev => new Set(prev).add(ticker));
    addTicker(ticker);
    setNewTicker("");
  };

  // Auto-subscribe tickers from open operations to RTD bridge
  const autoSubscribedRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (status !== "connected" || openOps.length === 0) return;
    const opTickers = new Set<string>();
    for (const op of openOps) {
      for (const leg of (op.legs || [])) {
        if (leg.asset) opTickers.add(leg.asset.toUpperCase());
      }
    }
    for (const ticker of opTickers) {
      if (!autoSubscribedRef.current.has(ticker)) {
        addTicker(ticker);
        autoSubscribedRef.current.add(ticker);
      }
    }
  }, [status, openOps, addTicker]);

  const toggleSelect = (ticker: string) => {
    const row = rows.get(ticker);
    if (row) updateRow(ticker, { selecionado: !row.selecionado });
  };

  // Convert selected MANUAL rows to Leg[] for payoff — using precoEntrada when available
  const legs: Leg[] = useMemo(() => {
    return manualRowsArr
      .filter(r => r.selecionado && (r.ultimo || r.strike || r.precoEntrada))
      .map(r => ({
        side: r.lado,
        option_type: r.tipo,
        asset: r.ticker,
        strike: r.tipo === 'stock' ? 0 : (getStrike(r, getStrikeAndExpiry) ?? 0),
        price: r.precoEntrada ?? r.ultimo ?? r.ofCompra ?? r.ofVenda ?? 0,
        quantity: r.quantidade,
        expiry_date: r.expiryDate,
      }));
  }, [manualRowsArr]);

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

  // Open name dialog before saving
  const handleSaveClick = () => {
    setPendingSaveName(analysisName || `Estrutura ${new Date().toLocaleDateString('pt-BR')}`);
    setShowNameDialog(true);
  };

  // Save analysis with name
  const saveAnalysis = async (name: string) => {
    if (!user) {
      toast({ title: "Faça login para salvar", variant: "destructive" });
      return;
    }
    if (legs.length === 0) {
      toast({ title: "Selecione ao menos uma perna", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const expiryDates = legs.filter(l => l.expiry_date).map(l => l.expiry_date!).sort();
      const expiryDate = expiryDates[0] || null;

      const { data: analysis, error: aError } = await supabase
        .from('analyses').insert({
          user_id: user.id,
          name: name || `Estrutura ${new Date().toLocaleDateString('pt-BR')}`,
          underlying_asset: legs[0]?.asset || null,
          expiry_date: expiryDate,
        }).select().single();
      if (aError) throw aError;

      const legsToInsert = legs.map(l => ({
        analysis_id: analysis.id,
        side: l.side,
        option_type: l.option_type,
        asset: l.asset,
        strike: l.strike,
        price: l.price,
        quantity: l.quantity,
        expiry_date: l.expiry_date || null,
      }));
      await supabase.from('legs').insert(legsToInsert);

      setShowNameDialog(false);
      setShowSaveDialog(true);
      setAnalysisName("");
    } catch (err: any) {
      toast({ title: "Erro ao salvar", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  // Rename analysis
  const handleRename = async (id: string) => {
    if (!editNameValue.trim()) return;
    const { error } = await supabase
      .from('analyses')
      .update({ name: editNameValue.trim() })
      .eq('id', id);
    if (error) {
      toast({ title: "Erro ao renomear", variant: "destructive" });
    } else {
      toast({ title: "Nome atualizado!" });
      setOpenOpsRaw(prev => prev.map(op => op.id === id ? { ...op, name: editNameValue.trim() } : op));
    }
    setEditingNameId(null);
  };

  const isPro = accessControl.planType === 'pro' || accessControl.isAdmin || (!accessControl.trialExpired && accessControl.status === 'approved');

  if (!isPro) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container py-20 text-center space-y-6">
          <div className="p-4 rounded-2xl bg-primary/10 inline-flex">
            <Radio className="w-12 h-12 text-primary" />
          </div>
          <h1 className="text-3xl font-black tracking-tight">Tempo Real — Recurso PRO</h1>
          <p className="text-muted-foreground max-w-md mx-auto">
            A conexão em tempo real com o Profit via RTD Bridge é exclusiva para assinantes do plano PRO.
          </p>
          <p className="text-xs text-amber-500 font-medium max-w-md mx-auto">
            Necessário Profit Pro (Nelogica) instalado para conexão via RTD Bridge
          </p>
          <Button size="lg" className="font-black shadow-lg shadow-primary/20" onClick={() => navigate('/settings')}>
            Assinar PRO <Zap className="ml-2 h-5 w-5" />
          </Button>
        </main>
      </div>
    );
  }

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
            <p className="text-xs text-muted-foreground">Profit Pro → RTD Bridge → WebSocket → App · <span className="text-amber-500 font-medium">Necessário Profit Pro (Nelogica)</span></p>
          </div>
          <Button size="sm" variant="outline" className="ml-auto gap-1.5 text-xs" asChild>
            <a href="/downloads/Manual_Bridge_OpcoesProX.pdf" download>
              <BookOpen className="w-3.5 h-3.5" />
              Manual PDF
            </a>
          </Button>
          <Badge variant="outline" className={cn("flex items-center gap-1.5", cfg.color)}>
            <StatusIcon className={cn("w-3 h-3", status === "connecting" && "animate-spin", status === "connected" && "animate-pulse")} />
            {cfg.label}
            {status === "connected" && rows.size > 0 && (
              <span className="text-xs opacity-70">· {rows.size} ticker{rows.size > 1 ? "s" : ""}</span>
            )}
          </Badge>
        </div>

        {/* Setup guide — shown when not connected */}
        {status !== "connected" && (
          <>
            <Card className="border-warning/30 bg-warning/5">
              <CardContent className="pt-4 flex items-center gap-3">
                <WifiOff className="w-5 h-5 text-warning shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-warning">Você está offline</p>
                  <p className="text-xs text-muted-foreground">
                    Aperte <span className="font-bold text-primary">Conectar Profit Pro</span> no menu superior para iniciar a conexão.
                  </p>
                </div>
              </CardContent>
            </Card>
            <BridgeSetupGuide
              status={status}
              errorMsg={errorMsg}
              reconnectCount={reconnectCount}
              connect={connect}
            />
          </>
        )}

        {/* Connected: add ticker + Banco de Opções */}
        {status === "connected" && (
          <Card className="border-chart-profit/30 bg-gradient-to-br from-chart-profit/[0.07] to-card shadow-sm">
            <CardContent className="pt-4 space-y-4">
              <div className="flex items-center gap-2 text-chart-profit">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-chart-profit opacity-75" />
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-chart-profit" />
                </span>
                <span className="text-sm font-bold">Bridge conectado — dados chegando em tempo real</span>
                <Activity className="w-3.5 h-3.5 animate-pulse ml-auto sm:ml-1" />
              </div>
              <div className="flex flex-wrap gap-2 items-end">
                <div className="flex flex-col gap-1 flex-1 min-w-[180px]">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Ticker a monitorar</label>
                  <Input
                    className="uppercase font-mono h-11"
                    placeholder="ex: PETRG345"
                    value={newTicker}
                    onChange={(e) => setNewTicker(e.target.value.toUpperCase())}
                    onKeyDown={(e) => e.key === "Enter" && handleAddTicker()}
                  />
                </div>
                <Button onClick={handleAddTicker} className="gap-2 h-11 font-bold">
                  <Plus className="w-4 h-4" /> Monitorar
                </Button>
                <Button variant={showBanco ? "default" : "outline"} onClick={() => setShowBanco(v => !v)} className={cn("gap-2 h-11 font-bold", !showBanco && "border-primary/40 text-primary hover:bg-primary/10")}>
                  <Database className="w-4 h-4" /> {showBanco ? 'Fechar Banco' : 'Banco de Opções'}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                <Search className="w-3.5 h-3.5 shrink-0" />
                Não sabe o código da opção? Abra o <span className="font-semibold text-primary">Banco de Opções</span> aqui mesmo para buscar tickers, strikes e pares Call+Put da B3.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Banco de Opções embutido — abre direto na tela, sem trocar de página */}
        {status === "connected" && showBanco && (
          <Card className="border-primary/30 animate-fade-in">
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2">
                <Database className="w-4 h-4 text-primary" /> Banco de Opções
              </CardTitle>
              <Button variant="ghost" size="sm" onClick={() => setShowBanco(false)} className="h-7 text-xs text-muted-foreground">Fechar</Button>
            </CardHeader>
            <CardContent>
              <TickerOpcoes embedded />
            </CardContent>
          </Card>
        )}

        {/* Live table — only manually searched tickers */}
        {manualRowsArr.length > 0 && (
          <Card>
            <CardHeader className="pb-3 flex flex-row items-center justify-between gap-3 flex-wrap">
              <CardTitle className="text-sm flex items-center gap-2">
                <Activity className="w-4 h-4 text-chart-profit animate-pulse" />
                Cotações em Tempo Real
                <Badge variant="secondary">{manualRowsArr.length}</Badge>
              </CardTitle>
              <div className="flex items-center gap-2">
                <Button
                  onClick={() => {
                    const selected = manualRowsArr.filter(r => r.selecionado);
                    if (selected.length === 0) {
                      toast({ title: "Selecione ao menos uma linha", variant: "destructive" });
                    }
                  }}
                  disabled={!manualRowsArr.some((r) => r.selecionado)}
                  variant="outline"
                  className="gap-2"
                >
                  <TrendingUp className="w-4 h-4" />
                  {legs.length > 0 ? `${legs.length} perna(s) no Payoff` : 'Selecione para Payoff'}
                </Button>
                {legs.length > 0 && (
                  <Button onClick={handleSaveClick} disabled={saving} className="gap-2">
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    Salvar Análise
                  </Button>
                )}
              </div>
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
                      <TableHead className="text-right">Preço Entrada</TableHead>
                      <TableHead className="text-right">Qtd</TableHead>
                      <TableHead className="text-center">Vencimento</TableHead>
                      <TableHead className="w-8"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {manualRowsArr.map((row) => {
                      const isStale = row.lastUpdate ? (Date.now() - row.lastUpdate) > 5000 : false;
                      const expiryDateObj = row.expiryDate ? new Date(row.expiryDate + 'T12:00:00') : undefined;
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
                            <Select value={row.tipo} onValueChange={(v) => updateRow(row.ticker, { tipo: v as any })}>
                              <SelectTrigger className="h-7 w-20 text-xs"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="call">Call</SelectItem>
                                <SelectItem value="put">Put</SelectItem>
                                <SelectItem value="stock">Ação</SelectItem>
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell onClick={(e) => e.stopPropagation()}>
                            <Select value={row.lado} onValueChange={(v) => updateRow(row.ticker, { lado: v as any })}>
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
                          <TableCell className="text-right font-mono">{fmt(getStrike(row, getStrikeAndExpiry))}</TableCell>
                          <TableCell className="text-right font-mono">{fmt(row.negocios, 0)}</TableCell>
                          <TableCell className="text-right font-mono">{fmt(row.ofCompra)}</TableCell>
                          <TableCell className="text-right font-mono">{fmt(row.ofVenda)}</TableCell>
                          <TableCell onClick={(e) => e.stopPropagation()}>
                            <Input
                              type="number"
                              step="0.01"
                              value={row.precoEntrada ?? ""}
                              onChange={(e) => updateRow(row.ticker, { precoEntrada: parseFloat(e.target.value) || null })}
                              placeholder={fmt(row.ultimo)}
                              className="h-7 w-24 text-right text-xs font-bold border-primary/30 bg-primary/5"
                            />
                          </TableCell>
                          <TableCell onClick={(e) => e.stopPropagation()}>
                            <Input
                              type="number"
                              min={1}
                              value={row.quantidade}
                              onChange={(e) => updateRow(row.ticker, { quantidade: parseInt(e.target.value) || 1 })}
                              className="h-7 w-16 text-right text-xs font-semibold"
                            />
                          </TableCell>
                          <TableCell onClick={(e) => e.stopPropagation()}>
                            {row.tipo !== 'stock' ? (
                              <InlineDatePicker
                                date={expiryDateObj}
                                onChange={(d) => {
                                  const expiryDate = d
                                    ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
                                    : undefined;
                                  updateRow(row.ticker, { expiryDate });
                                }}
                              />
                            ) : (
                              <span className="text-xs text-muted-foreground text-center block">—</span>
                            )}
                          </TableCell>
                          <TableCell onClick={(e) => e.stopPropagation()}>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive"
                              onClick={() => {
                                setManualTickers(prev => { const n = new Set(prev); n.delete(row.ticker); return n; });
                                removeTicker(row.ticker);
                              }}>
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
        {manualRowsArr.length === 0 && status === "connected" && openOps.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground space-y-3">
            <Wifi className="w-12 h-12 opacity-20" />
            <p className="text-sm">Bridge conectado! Adicione tickers para monitorar.</p>
          </div>
        )}

        {/* Name dialog — shown before saving */}
        <Dialog open={showNameDialog} onOpenChange={setShowNameDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nome da Estrutura</DialogTitle>
              <DialogDescription>Dê um nome para identificar esta estrutura nas Operações em Aberto.</DialogDescription>
            </DialogHeader>
            <Input
              value={pendingSaveName}
              onChange={(e) => setPendingSaveName(e.target.value)}
              placeholder="Ex: Trava de Alta PETR4"
              className="mt-2"
              onKeyDown={(e) => e.key === 'Enter' && saveAnalysis(pendingSaveName)}
            />
            <DialogFooter className="gap-2 mt-2">
              <Button variant="outline" onClick={() => setShowNameDialog(false)}>Cancelar</Button>
              <Button onClick={() => saveAnalysis(pendingSaveName)} disabled={saving} className="gap-2">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Salvar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Save success dialog */}
        <Dialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-success" />
                Análise Salva!
              </DialogTitle>
              <DialogDescription>
                Sua estrutura foi salva com sucesso em Operações em Aberto.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setShowSaveDialog(false)}>
                Continuar Monitorando
              </Button>
              <Button onClick={() => navigate('/history')}>
                Ver Operações em Aberto
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}
