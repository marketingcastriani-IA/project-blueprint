"use client";

import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { useParams, useNavigate, Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import Header from '@/components/Header';
import PayoffChart from '@/components/PayoffChart';
import MetricsCards from '@/components/MetricsCards';
import CDIComparison from '@/components/CDIComparison';
import LegForm from '@/components/LegForm';
import { supabase } from '@/integrations/supabase/client';
import { Leg } from '@/lib/types';
import { generatePayoffCurve, calculateMetrics, calculateCDIOpportunityCost, calculateCDIReturn } from '@/lib/payoff';
import { countBusinessDays } from '@/lib/b3-calendar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import {
  Loader2, ArrowLeft, Save, XCircle, Layers, Brain, TrendingUp, Clock, Target, Zap, AlertTriangle, Percent, PlusCircle, Wifi, WifiOff, Activity
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { SectionDivider } from '@/components/ProfessionalLayout';

const WS_URL = "ws://localhost:8765";

interface DbLeg {
  id: string;
  side: string;
  option_type: string;
  asset: string;
  strike: number;
  price: number;
  quantity: number;
  current_price?: number | null;
  expiry_date?: string | null;
}

// Lightweight RTD hook for live prices
function useLivePrices(tickers: string[]) {
  const [prices, setPrices] = useState<Record<string, number>>({});
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const tickersRef = useRef(tickers);
  tickersRef.current = tickers;

  useEffect(() => {
    if (tickers.length === 0) return;

    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
      tickers.forEach(t => ws.send(JSON.stringify({ type: "add_ticker", ticker: t })));
    };

    ws.onclose = () => setConnected(false);
    ws.onerror = () => setConnected(false);

    ws.onmessage = (evt) => {
      try {
        const msg = JSON.parse(evt.data);
        if (msg.type === "rtd_data") {
          setPrices(prev => {
            const next = { ...prev };
            for (const item of msg.data) {
              if (item.ultimo != null && tickersRef.current.includes(item.ticker)) {
                next[item.ticker] = item.ultimo;
              }
            }
            return next;
          });
        }
      } catch { /* ignore */ }
    };

    return () => { ws.close(); };
  }, [tickers.join(',')]);

  return { prices, connected };
}

interface DbAnalysis {
  id: string;
  name: string;
  underlying_asset: string | null;
  status: string;
  cdi_rate: number | null;
  days_to_expiry: number | null;
  expiry_date: string | null;
  ai_suggestion: string | null;
  created_at: string;
}

export default function AnalysisDetail() {
  const { id } = useParams<{ id: string }>();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [analysis, setAnalysis] = useState<DbAnalysis | null>(null);
  const [dbLegs, setDbLegs] = useState<DbLeg[]>([]);
  const [currentPrices, setCurrentPrices] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [closing, setClosing] = useState(false);
  const [cdiRate, setCdiRate] = useState(14.65);
  const [daysToExpiry, setDaysToExpiry] = useState(0);
  const [expiryDate, setExpiryDate] = useState<Date | undefined>(undefined);
  const [showAddLeg, setShowAddLeg] = useState(false);
  const [addingLeg, setAddingLeg] = useState(false);
  
  const [isSimulating, setIsSimulating] = useState(false);
  const [simLegs, setSimLegs] = useState<Leg[]>([]);
  
  const [exitAnalysis, setExitAnalysis] = useState<any>(null);
  const [loadingExitAI, setLoadingExitAI] = useState(false);

  // Debounced auto-save for individual leg fields
  const saveTimerRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const autoSaveLegField = useCallback((legId: string, field: string, value: any) => {
    // Clear previous timer for this leg+field
    const key = `${legId}_${field}`;
    if (saveTimerRef.current[key]) clearTimeout(saveTimerRef.current[key]);
    
    saveTimerRef.current[key] = setTimeout(async () => {
      try {
        await supabase.from('legs').update({ [field]: value } as any).eq('id', legId);
      } catch (err) {
        console.error('Auto-save error:', err);
      }
    }, 800);
  }, []);

  // Update exit price with auto-save
  const updateExitPrice = useCallback((legId: string, value: string) => {
    setCurrentPrices(p => ({ ...p, [legId]: value }));
    const numVal = parseFloat(value);
    if (!isNaN(numVal)) {
      autoSaveLegField(legId, 'current_price', numVal);
    }
  }, [autoSaveLegField]);

  // Update asset ticker with auto-save
  const updateLegAsset = useCallback((legId: string, value: string) => {
    setDbLegs(prev => prev.map(l => l.id === legId ? { ...l, asset: value } : l));
    if (value.trim()) {
      autoSaveLegField(legId, 'asset', value.trim().toUpperCase());
    }
  }, [autoSaveLegField]);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      Object.values(saveTimerRef.current).forEach(t => clearTimeout(t));
    };
  }, []);

  useEffect(() => {
    if (!user || !id) return;
    const fetchData = async () => {
      const [aRes, lRes] = await Promise.all([
        supabase.from('analyses').select('*').eq('id', id).single(),
        supabase.from('legs').select('*').eq('analysis_id', id),
      ]);

      if (aRes.data) {
        const a = aRes.data as unknown as DbAnalysis;
        setAnalysis(a);
        setCdiRate(a.cdi_rate ?? 14.65);
        setDaysToExpiry(a.days_to_expiry ?? 0);
        if (a.expiry_date) {
          const [y, m, d] = a.expiry_date.split('-').map(Number);
          setExpiryDate(new Date(y, m - 1, d));
        }
      }
      if (lRes.data) {
        const legs = lRes.data as unknown as DbLeg[];
        setDbLegs(legs);
        const prices: Record<string, string> = {};
        legs.forEach(l => { 
          prices[l.id] = l.current_price != null ? String(l.current_price) : ''; 
        });
        setCurrentPrices(prices);
      }
      setLoading(false);
    };
    fetchData();
  }, [user, id]);

  // Live RTD prices
  const legTickers = useMemo(() => [...new Set(dbLegs.map(l => l.asset))], [dbLegs]);
  const { prices: livePrices, connected: rtdConnected } = useLivePrices(legTickers);

  const legs: Leg[] = useMemo(() => dbLegs.map(l => ({
    id: l.id, side: l.side as 'buy' | 'sell', option_type: l.option_type as 'call' | 'put' | 'stock',
    asset: l.asset, strike: l.strike, price: l.price, quantity: l.quantity,
    expiry_date: l.expiry_date ?? undefined,
  })), [dbLegs]);

  const metrics = useMemo(() => calculateMetrics(legs), [legs]);
  const payoffData = useMemo(() => generatePayoffCurve(legs, daysToExpiry, cdiRate), [legs, daysToExpiry, cdiRate]);
  const simPayoffData = useMemo(() => isSimulating ? generatePayoffCurve(simLegs, daysToExpiry, cdiRate) : null, [isSimulating, simLegs, daysToExpiry, cdiRate]);

  const entrySpotPrice = useMemo(() => {
    const stockLeg = dbLegs.find(l => l.option_type === 'stock');
    return stockLeg ? stockLeg.price : null;
  }, [dbLegs]);

  const currentPnL = useMemo(() => {
    let total = 0;
    for (const leg of dbLegs) {
      const cp = parseFloat(currentPrices[leg.id] || '');
      if (isNaN(cp)) continue;
      const multiplier = leg.side === 'buy' ? 1 : -1;
      total += multiplier * (cp - leg.price) * leg.quantity;
    }
    return total;
  }, [dbLegs, currentPrices]);

  // Cálculo do CDI do período (Entrada até Hoje)
  const periodMetrics = useMemo(() => {
    if (!analysis?.created_at) return null;
    const entryDate = new Date(analysis.created_at);
    const today = new Date();
    const daysSinceEntry = countBusinessDays(entryDate, today);
    
    const investedCapital = Math.abs(metrics.montageTotal || metrics.netCost || 1);
    const cdiReturnSinceEntry = calculateCDIReturn(investedCapital, cdiRate, daysSinceEntry, false);
    
    const efficiency = cdiReturnSinceEntry > 0 ? (currentPnL / cdiReturnSinceEntry) * 100 : 0;
    const pnlRoi = (currentPnL / investedCapital) * 100;
    const cdiRoi = (cdiReturnSinceEntry / investedCapital) * 100;
    
    return { daysSinceEntry, cdiReturnSinceEntry, efficiency, entryDate, pnlRoi, cdiRoi };
  }, [analysis, metrics, cdiRate, currentPnL]);

  const getExitAIAnalysis = async () => {
    if (!periodMetrics) return;
    setLoadingExitAI(true);
    try {
      const { data, error } = await supabase.functions.invoke('analyze-exit', {
        body: {
          legs,
          currentPnL,
          cdiReturnSinceEntry: periodMetrics.cdiReturnSinceEntry,
          daysSinceEntry: periodMetrics.daysSinceEntry,
          cdiRate
        }
      });
      if (error) throw error;
      setExitAnalysis(data);
      toast.success("Análise de saída concluída!");
    } catch (err: any) {
      toast.error("Erro na análise de IA");
    } finally {
      setLoadingExitAI(false);
    }
  };

  const handleAddLeg = async (newLeg: Leg) => {
    if (!id) return;
    setAddingLeg(true);
    try {
      const { data, error } = await supabase.from('legs').insert({
        analysis_id: id,
        side: newLeg.side,
        option_type: newLeg.option_type,
        asset: newLeg.asset,
        strike: newLeg.strike,
        price: newLeg.price,
        quantity: newLeg.quantity,
        expiry_date: newLeg.expiry_date || null,
      } as any).select().single();

      if (error) throw error;
      
      const insertedLeg = data as unknown as DbLeg;
      setDbLegs(prev => [...prev, insertedLeg]);
      setCurrentPrices(prev => ({ ...prev, [insertedLeg.id]: '' }));
      setShowAddLeg(false);
      toast.success('Perna adicionada! Gráfico recalculado com CDI atualizado.');
    } catch (err: any) {
      toast.error('Erro ao adicionar perna: ' + err.message);
    } finally {
      setAddingLeg(false);
    }
  };

  const saveAnalysisSettings = async () => {
    setSaving(true);
    try {
      for (const leg of dbLegs) {
        const cp = parseFloat(currentPrices[leg.id] || '');
        await supabase.from('legs').update({ current_price: isNaN(cp) ? null : cp } as any).eq('id', leg.id);
      }
      
      await supabase.from('analyses').update({ 
        cdi_rate: cdiRate,
        days_to_expiry: daysToExpiry,
        expiry_date: expiryDate ? `${expiryDate.getFullYear()}-${String(expiryDate.getMonth() + 1).padStart(2, '0')}-${String(expiryDate.getDate()).padStart(2, '0')}` : null,
      } as any).eq('id', id!);

      toast.success('Configurações e preços salvos!');
    } catch (err: any) { 
      toast.error('Erro ao salvar: ' + err.message); 
    } finally { 
      setSaving(false); 
    }
  };

  const closeOperation = async () => {
    const hasMissingPrices = dbLegs.some(l => !currentPrices[l.id] || isNaN(parseFloat(currentPrices[l.id])));
    
    if (hasMissingPrices) {
      if (!confirm('Alguns preços atuais estão vazios. Deseja usar os preços de entrada como preços de saída para encerrar com lucro/prejuízo zero?')) return;
      
      const updatedPrices = { ...currentPrices };
      dbLegs.forEach(l => {
        if (!updatedPrices[l.id] || isNaN(parseFloat(updatedPrices[l.id]))) {
          updatedPrices[l.id] = String(l.price);
        }
      });
      setCurrentPrices(updatedPrices);
    } else {
      if (!confirm('Encerrar esta operação? Os preços atuais serão salvos como preços de saída.')) return;
    }

    setClosing(true);
    try {
      for (const leg of dbLegs) {
        const cp = parseFloat(currentPrices[leg.id] || String(leg.price));
        await supabase.from('legs').update({ current_price: cp } as any).eq('id', leg.id);
      }
      
      await supabase.from('analyses').update({ status: 'closed', closed_at: new Date().toISOString() } as any).eq('id', id!);
      setAnalysis(prev => prev ? { ...prev, status: 'closed' } : prev);
      toast.success('Operação encerrada e enviada para o Portfólio!');
      navigate('/portfolio');
    } catch (err: any) { toast.error('Erro: ' + err.message); } finally { setClosing(false); }
  };

  const startSimulation = () => {
    setSimLegs(JSON.parse(JSON.stringify(legs)));
    setIsSimulating(true);
    toast.info("Modo Simulação Ativado", { description: "Altere os valores na tabela para ver o novo payoff tracejado." });
  };

  const updateSimLeg = (index: number, field: keyof Leg, value: any) => {
    setSimLegs(prev => prev.map((l, i) => i === index ? { ...l, [field]: value } : l));
  };

  if (authLoading) return null;
  if (!user) return <Navigate to="/auth" replace />;
  if (loading) return <div className="min-h-screen bg-background"><Header /><div className="flex justify-center py-24"><Loader2 className="h-8 w-8 animate-spin" /></div></div>;

  return (
    <div className="min-h-screen bg-background pb-20">
      <Header />
      <main className="container py-6 space-y-6 animate-fade-in">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Button variant="ghost" onClick={() => navigate('/history')} className="gap-2"><ArrowLeft className="h-4 w-4" /> Voltar</Button>
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">{analysis?.name} <Badge variant={analysis?.status === 'active' ? 'default' : 'secondary'}>{analysis?.status === 'active' ? 'Ativa' : 'Encerrada'}</Badge></h1>
              <p className="text-xs text-muted-foreground flex items-center gap-2">
                <Clock className="h-3 w-3" /> Entrada: {new Date(analysis?.created_at || '').toLocaleDateString('pt-BR')}
                {periodMetrics && <span className="text-primary font-bold">({periodMetrics.daysSinceEntry} dias úteis decorridos)</span>}
              </p>
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            {analysis?.status === 'active' && (
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setShowAddLeg(!showAddLeg)}
                className={cn("gap-2 border-success/50 text-success hover:bg-success/10", showAddLeg && "bg-success/10 ring-2 ring-success/30")}
              >
                <PlusCircle className="h-4 w-4" /> {showAddLeg ? 'Fechar' : 'Adicionar Perna'}
              </Button>
            )}
            <Button variant={isSimulating ? "secondary" : "outline"} size="sm" onClick={() => isSimulating ? setIsSimulating(false) : startSimulation()}>
              <Layers className="mr-2 h-4 w-4" /> {isSimulating ? "Sair da Simulação" : "Simular Remontagem"}
            </Button>
            {analysis?.status === 'active' && (
              <Button variant="destructive" size="sm" onClick={closeOperation} disabled={closing}>
                {closing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <XCircle className="mr-2 h-4 w-4" />} Encerrar Operação
              </Button>
            )}
          </div>
        </div>

        {/* Formulário para adicionar nova perna */}
        {showAddLeg && analysis?.status === 'active' && (
          <Card className="border-2 border-success/30 bg-success/[0.03] shadow-[0_0_30px_-10px_hsl(var(--success)/0.3)] animate-fade-in">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <PlusCircle className="h-5 w-5 text-success" /> 
                Adicionar Nova Perna à Estrutura
                {addingLeg && <Loader2 className="h-4 w-4 animate-spin" />}
              </CardTitle>
              <p className="text-xs text-muted-foreground">A nova perna será incluída em todos os cálculos de payoff, CDI e métricas automaticamente.</p>
            </CardHeader>
            <CardContent>
              <LegForm onAdd={handleAddLeg} />
            </CardContent>
          </Card>
        )}

        {/* Painel de Performance vs CDI do Período */}
        {periodMetrics && analysis?.status === 'active' && (
          <div className="grid gap-4 md:grid-cols-3">
            <Card className="border-primary/20 bg-gradient-to-br from-primary/[0.03] to-card shadow-sm">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Lucro Atual (PnL)</span>
                  <div className={cn("p-1.5 rounded-lg", currentPnL >= 0 ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive")}>
                    <TrendingUp className="h-4 w-4" />
                  </div>
                </div>
                <div className="flex items-baseline gap-2">
                  <p className={cn("text-3xl font-black tracking-tighter", currentPnL >= 0 ? "text-success" : "text-destructive")}>
                    R$ {currentPnL.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </p>
                   <Badge className={cn("font-black text-sm px-3 py-1 rounded-full shadow-lg", currentPnL >= 0 ? "bg-success/20 border-success/50 text-success shadow-success/20" : "bg-destructive/20 border-destructive/50 text-destructive shadow-destructive/20")}>
                     {currentPnL >= 0 ? '+' : ''}{periodMetrics.pnlRoi.toFixed(2)}% ROI
                   </Badge>
                </div>
              </CardContent>
            </Card>

            <Card className="border-warning/20 bg-gradient-to-br from-warning/[0.03] to-card shadow-sm">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Custo Oportunidade (CDI)</span>
                  <div className="p-1.5 rounded-lg bg-warning/10 text-warning">
                    <Clock className="h-4 w-4" />
                  </div>
                </div>
                <div className="flex items-baseline gap-2">
                  <p className="text-3xl font-black tracking-tighter text-warning">
                    R$ {periodMetrics.cdiReturnSinceEntry.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </p>
                   <Badge className="bg-warning/20 border-warning/50 text-warning font-black text-sm px-3 py-1 rounded-full shadow-lg shadow-warning/20">
                     {periodMetrics.cdiRoi.toFixed(2)}% ROI
                   </Badge>
                </div>
                <p className="text-[9px] font-bold text-muted-foreground uppercase mt-1">Rendimento no período da operação</p>
              </CardContent>
            </Card>

            <Card className={cn("border-2 shadow-md transition-all", periodMetrics.efficiency >= 100 ? "border-success/30 bg-success/5" : "border-destructive/30 bg-destructive/5")}>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Eficiência vs CDI</span>
                  <div className={cn("p-1.5 rounded-lg", periodMetrics.efficiency >= 100 ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive")}>
                    <Target className="h-4 w-4" />
                  </div>
                </div>
                 <p className={cn("text-4xl font-black tracking-tighter", periodMetrics.efficiency >= 100 ? "text-success" : "text-destructive")}>
                   {periodMetrics.efficiency.toFixed(0)}% <span className="text-base font-bold">do CDI</span>
                 </p>
                <p className="text-[9px] font-black text-muted-foreground uppercase mt-1 flex items-center gap-1">
                  {periodMetrics.efficiency >= 100 ? <><Zap className="h-3 w-3 text-success" /> ✓ Superando o CDI</> : <><AlertTriangle className="h-3 w-3 text-destructive" /> ✗ Abaixo do CDI</>}
                </p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Análise de IA para Saída */}
        {analysis?.status === 'active' && (
          <Card className={cn(
            "border-2 transition-all duration-500 overflow-hidden",
            exitAnalysis?.verdict === 'ENCERRAR' 
              ? "border-success bg-success/10 shadow-[0_0_40px_-12px_hsl(var(--success)/0.4)] animate-pulse" 
              : "border-primary/30 bg-gradient-to-br from-primary/[0.05] to-card"
          )}>
            <CardContent className="p-6">
              <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                <div className="space-y-2 text-center md:text-left">
                  <h3 className="text-xl font-black tracking-tight flex items-center gap-2 justify-center md:justify-start">
                    <Brain className="h-6 w-6 text-primary" /> IA: VEREDITO DE SAÍDA
                  </h3>
                  <p className="text-sm text-muted-foreground font-medium max-w-md">
                    Nossa IA analisa seu lucro atual contra o CDI do período e o risco residual para dizer se é hora de colocar o dinheiro no bolso.
                  </p>
                </div>
                <Button 
                  onClick={getExitAIAnalysis} 
                  disabled={loadingExitAI} 
                  size="lg"
                  className={cn(
                    "font-black h-14 px-8 shadow-lg transition-all",
                    !exitAnalysis ? "shadow-primary/30 animate-bounce" : "shadow-success/30"
                  )}
                >
                  {loadingExitAI ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Zap className="mr-2 h-5 w-5" />}
                  {exitAnalysis ? "REANALISAR SAÍDA" : "ANALISAR MOMENTO DE SAÍDA"}
                </Button>
              </div>

              {exitAnalysis && (
                <div className={cn(
                  "mt-6 p-6 rounded-2xl border-2 animate-fade-in space-y-4",
                  exitAnalysis.verdict === 'ENCERRAR' ? "bg-card border-success shadow-xl" : "bg-card border-primary/20"
                )}>
                  <div className="flex flex-col sm:flex-row items-center justify-between border-b border-border/50 pb-4 gap-4">
                    <div className="flex items-center gap-3">
                      <Badge className={cn(
                        "text-base px-6 py-2 font-black uppercase tracking-tighter rounded-full shadow-lg",
                        exitAnalysis.verdict === 'ENCERRAR' ? "bg-success text-success-foreground animate-pulse" : 
                        exitAnalysis.verdict === 'MANTER' ? "bg-primary text-primary-foreground" : "bg-warning text-warning-foreground"
                      )}>
                        {exitAnalysis.verdict}
                      </Badge>
                      <div className="flex flex-col">
                        <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Score de Eficiência</span>
                        <span className="text-lg font-black text-primary">{exitAnalysis.efficiency_score}/100</span>
                      </div>
                    </div>
                    {exitAnalysis.verdict === 'ENCERRAR' && (
                      <Button onClick={closeOperation} className="bg-success hover:bg-success/90 font-black h-11 px-6">
                        ENCERRAR AGORA <ArrowLeft className="ml-2 h-4 w-4 rotate-180" />
                      </Button>
                    )}
                  </div>
                  <div className="grid gap-6 md:grid-cols-2">
                    <div className="space-y-2">
                      <p className="text-[10px] font-black uppercase text-primary flex items-center gap-1">
                        <Target className="h-3 w-3" /> Justificativa Técnica
                      </p>
                      <p className="text-sm font-bold leading-relaxed text-foreground/90 italic">
                        "{exitAnalysis.reasoning}"
                      </p>
                    </div>
                    <div className="space-y-2">
                      <p className="text-[10px] font-black uppercase text-destructive flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3" /> Risco Residual
                      </p>
                      <p className="text-sm font-medium leading-relaxed text-muted-foreground">
                        {exitAnalysis.risk_comment}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        <Card className={cn(isSimulating && "border-primary ring-2 ring-primary/20")}>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              {isSimulating ? "SIMULANDO NOVA ESTRUTURA" : "Pernas da Estratégia — Saída"}
              {rtdConnected && (
                <Badge className="bg-success/15 text-success border-success/30 gap-1">
                  <Activity className="w-3 h-3 animate-pulse" /> RTD Ao Vivo
                </Badge>
              )}
              {!rtdConnected && (
                <Badge variant="outline" className="text-muted-foreground gap-1">
                  <WifiOff className="w-3 h-3" /> RTD Offline
                </Badge>
              )}
            </CardTitle>
            <div className="flex items-center gap-2">
              {isSimulating && <Badge className="bg-primary animate-pulse">MODO SIMULAÇÃO</Badge>}
              <Badge variant="outline" className="text-[10px]">{legs.length} perna{legs.length !== 1 ? 's' : ''}</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/50 text-muted-foreground text-xs">
                    <th className="text-left py-2">Ativo</th>
                    <th className="text-left py-2">Tipo</th>
                    <th className="text-left py-2">Ação de Saída</th>
                    <th className="text-right py-2">Strike</th>
                    <th className="text-right py-2">Preço Entrada</th>
                    <th className="text-right py-2">Qtd</th>
                    <th className="text-center py-2">
                      <div className="flex flex-col items-center gap-0.5">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-success flex items-center gap-1">
                          <Wifi className="w-3 h-3" /> Tempo Real
                        </span>
                      </div>
                    </th>
                    <th className="text-center py-2">
                      <div className="flex flex-col items-center gap-0.5">
                        <span className="text-[11px] font-black uppercase tracking-widest text-destructive animate-pulse">
                          ⚡ VALOR DE SAÍDA ⚡
                        </span>
                      </div>
                    </th>
                    <th className="text-right py-2">P&L</th>
                  </tr>
                </thead>
                <tbody>
                  {(isSimulating ? simLegs : legs).map((leg, i) => {
                    const cp = isSimulating ? leg.price : parseFloat(currentPrices[leg.id!] || '');
                    const pnl = !isNaN(cp) ? (leg.side === 'buy' ? 1 : -1) * (cp - (isSimulating ? legs[i].price : leg.price)) * leg.quantity : null;
                    
                    const exitAction = leg.side === 'buy' ? 'Venda' : 'Recompra';
                    const exitColor = leg.side === 'buy' ? 'bg-success/10 text-success border-success/20' : 'bg-info/10 text-info border-info/20';
                    const livePrice = livePrices[leg.asset];

                    return (
                      <tr key={i} className="border-b border-border/30 hover:bg-muted/20 transition-colors">
                        <td className="py-3 font-bold">{leg.asset}</td>
                        <td className="py-3">
                          <Badge variant="outline" className="text-[10px] font-bold uppercase tracking-wider">
                            {leg.option_type === 'stock' ? '🏢 ATIVO' : leg.option_type.toUpperCase()}
                          </Badge>
                        </td>
                        <td className="py-3">
                          <Badge className={cn("text-[10px] font-black uppercase tracking-widest border", exitColor)}>
                            {exitAction}
                          </Badge>
                        </td>
                        <td className="py-3 text-right font-mono">{leg.strike > 0 ? leg.strike.toFixed(2) : '-'}</td>
                        <td className="py-3 text-right font-mono">{isSimulating ? legs[i].price.toFixed(2) : leg.price.toFixed(2)}</td>
                        <td className="py-3 text-right font-bold">{leg.quantity}</td>
                        {/* Live RTD Price — read-only */}
                        <td className="py-3 text-center">
                          {livePrice != null ? (
                            <div className="flex items-center justify-center gap-1">
                              <span className="font-mono font-bold text-base text-success">
                                {livePrice.toFixed(2)}
                              </span>
                              <Activity className="w-3 h-3 text-success animate-pulse" />
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-xs">—</span>
                          )}
                        </td>
                        {/* Exit Price — editable */}
                        <td className="py-3">
                          <div className="relative flex justify-center">
                            <Input 
                              type="number" step="0.01" 
                              value={isSimulating ? leg.price : (currentPrices[leg.id!] || '')} 
                              onChange={e => isSimulating ? updateSimLeg(i, 'price', parseFloat(e.target.value) || 0) : setCurrentPrices(p => ({...p, [leg.id!]: e.target.value}))}
                              className={cn(
                                "w-32 h-10 text-center text-base font-black tabular-nums", 
                                isSimulating 
                                  ? "border-primary bg-primary/5" 
                                  : "border-2 border-destructive bg-destructive/5 text-foreground shadow-[0_0_16px_-2px_hsl(var(--destructive)/0.4)] focus:shadow-[0_0_24px_-2px_hsl(var(--destructive)/0.6)] transition-all placeholder:text-destructive/40"
                              )}
                              placeholder={livePrice != null ? livePrice.toFixed(2) : "0.00"}
                            />
                          </div>
                        </td>
                        <td className="py-3 text-right">
                          {pnl !== null ? (
                            <div className={cn(
                              "font-black text-base font-mono",
                              pnl >= 0 ? 'text-success' : 'text-destructive'
                            )}>
                              {pnl >= 0 ? '+' : ''}{pnl.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-xs">Aguardando</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {analysis?.status === 'active' && (
              <div className="flex justify-end mt-6">
                <Button 
                  size="lg" 
                  onClick={saveAnalysisSettings} 
                  disabled={saving}
                  className="font-black shadow-lg shadow-primary/20"
                >
                  {saving ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Save className="mr-2 h-5 w-5" />} 
                  Salvar Configurações e Preços
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <SectionDivider title="Análise de Payoff & Comparação" />
        <Card>
          <CardContent className="pt-6">
            <PayoffChart
              data={payoffData}
              breakevens={metrics.realBreakeven ? (Array.isArray(metrics.realBreakeven) ? metrics.realBreakeven : [metrics.realBreakeven]) : metrics.breakevens}
              cdiRate={cdiRate} daysToExpiry={daysToExpiry} netCost={metrics.netCost} montageTotal={metrics.montageTotal}
              maxGain={metrics.maxGain} maxLoss={metrics.maxLoss}
              currentSpotPrice={parseFloat(currentPrices[dbLegs.find(l => l.option_type === 'stock')?.id || ''] || '0') || null}
              entrySpotPrice={entrySpotPrice}
              currentPnL={currentPnL}
              simulationData={simPayoffData}
              simulationCdiReturn={periodMetrics?.cdiReturnSinceEntry}
            />
          </CardContent>
        </Card>

        <MetricsCards metrics={metrics} cdiReturn={calculateCDIOpportunityCost(Math.abs(metrics.montageTotal || metrics.netCost), cdiRate, daysToExpiry)} daysToExpiry={daysToExpiry} />
        <CDIComparison metrics={metrics} cdiRate={cdiRate} setCdiRate={setCdiRate} daysToExpiry={daysToExpiry} setDaysToExpiry={setDaysToExpiry} expiryDate={expiryDate} onExpiryDateChange={setExpiryDate} />
      </main>
    </div>
  );
}