"use client";

import { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate, Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import Header from '@/components/Header';
import PayoffChart from '@/components/PayoffChart';
import MetricsCards from '@/components/MetricsCards';
import CDIComparison from '@/components/CDIComparison';
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
  Loader2, ArrowLeft, Save, XCircle, Layers, Brain, TrendingUp, Clock, Target, Zap, AlertTriangle
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { SectionDivider } from '@/components/ProfessionalLayout';

interface DbLeg {
  id: string;
  side: string;
  option_type: string;
  asset: string;
  strike: number;
  price: number;
  quantity: number;
  current_price?: number | null;
}

interface DbAnalysis {
  id: string;
  name: string;
  underlying_asset: string | null;
  status: string;
  cdi_rate: number | null;
  days_to_expiry: number | null;
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
  const [cdiRate, setCdiRate] = useState(14.90);
  const [daysToExpiry, setDaysToExpiry] = useState(0);
  
  const [isSimulating, setIsSimulating] = useState(false);
  const [simLegs, setSimLegs] = useState<Leg[]>([]);
  
  const [exitAnalysis, setExitAnalysis] = useState<any>(null);
  const [loadingExitAI, setLoadingExitAI] = useState(false);

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
        setCdiRate(a.cdi_rate ?? 14.90);
        setDaysToExpiry(a.days_to_expiry ?? 0);
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

  const legs: Leg[] = useMemo(() => dbLegs.map(l => ({
    id: l.id, side: l.side as 'buy' | 'sell', option_type: l.option_type as 'call' | 'put' | 'stock',
    asset: l.asset, strike: l.strike, price: l.price, quantity: l.quantity,
  })), [dbLegs]);

  const metrics = useMemo(() => calculateMetrics(legs), [legs]);
  const payoffData = useMemo(() => generatePayoffCurve(legs), [legs]);
  const simPayoffData = useMemo(() => isSimulating ? generatePayoffCurve(simLegs) : null, [isSimulating, simLegs]);

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
    
    return { daysSinceEntry, cdiReturnSinceEntry, efficiency, entryDate };
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

  const saveAnalysisSettings = async () => {
    setSaving(true);
    try {
      // Salvar preços atuais das pernas
      for (const leg of dbLegs) {
        const cp = parseFloat(currentPrices[leg.id] || '');
        await supabase.from('legs').update({ current_price: isNaN(cp) ? null : cp } as any).eq('id', leg.id);
      }
      
      // Salvar taxa CDI e dias para vencimento na análise
      await supabase.from('analyses').update({ 
        cdi_rate: cdiRate,
        days_to_expiry: daysToExpiry
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
      toast.success('Operação encerrada e enviada para o portfólio!');
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
            <Button variant="ghost" size="icon" onClick={() => navigate('/history')}><ArrowLeft className="h-5 w-5" /></Button>
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">{analysis?.name} <Badge variant={analysis?.status === 'active' ? 'default' : 'secondary'}>{analysis?.status === 'active' ? 'Ativa' : 'Encerrada'}</Badge></h1>
              <p className="text-xs text-muted-foreground flex items-center gap-2">
                <Clock className="h-3 w-3" /> Entrada: {new Date(analysis?.created_at || '').toLocaleDateString('pt-BR')}
                {periodMetrics && <span className="text-primary font-bold">({periodMetrics.daysSinceEntry} dias úteis decorridos)</span>}
              </p>
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
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

        {/* Painel de Performance vs CDI do Período */}
        {periodMetrics && analysis?.status === 'active' && (
          <div className="grid gap-4 md:grid-cols-3">
            <Card className="border-primary/20 bg-gradient-to-br from-primary/[0.03] to-card">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Lucro Atual (PnL)</span>
                  <TrendingUp className={cn("h-4 w-4", currentPnL >= 0 ? "text-success" : "text-destructive")} />
                </div>
                <p className={cn("text-2xl font-black tracking-tighter", currentPnL >= 0 ? "text-success" : "text-destructive")}>
                  R$ {currentPnL.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
              </CardContent>
            </Card>

            <Card className="border-warning/20 bg-gradient-to-br from-warning/[0.03] to-card">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Custo Oportunidade (CDI)</span>
                  <Clock className="h-4 w-4 text-warning" />
                </div>
                <p className="text-2xl font-black tracking-tighter text-warning">
                  R$ {periodMetrics.cdiReturnSinceEntry.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
                <p className="text-[10px] font-bold text-muted-foreground uppercase mt-1">Rendimento no período da operação</p>
              </CardContent>
            </Card>

            <Card className={cn("border-2", periodMetrics.efficiency >= 100 ? "border-success/30 bg-success/5" : "border-destructive/30 bg-destructive/5")}>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Eficiência vs CDI</span>
                  <Target className={cn("h-4 w-4", periodMetrics.efficiency >= 100 ? "text-success" : "text-destructive")} />
                </div>
                <p className={cn("text-2xl font-black tracking-tighter", periodMetrics.efficiency >= 100 ? "text-success" : "text-destructive")}>
                  {periodMetrics.efficiency.toFixed(0)}% do CDI
                </p>
                <p className="text-[10px] font-bold text-muted-foreground uppercase mt-1">
                  {periodMetrics.efficiency >= 100 ? "✓ Superando o CDI" : "✗ Abaixo do CDI"}
                </p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Análise de IA para Saída */}
        {analysis?.status === 'active' && (
          <Card className="border-2 border-primary/30 bg-gradient-to-br from-primary/[0.05] to-card overflow-hidden">
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
                  className="font-black h-14 px-8 shadow-lg shadow-primary/30 animate-pulse"
                >
                  {loadingExitAI ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Zap className="mr-2 h-5 w-5" />}
                  ANALISAR MOMENTO DE SAÍDA
                </Button>
              </div>

              {exitAnalysis && (
                <div className="mt-6 p-5 rounded-2xl bg-card border-2 border-primary/20 animate-fade-in space-y-4">
                  <div className="flex items-center justify-between border-b border-border/50 pb-4">
                    <div className="flex items-center gap-3">
                      <Badge className={cn(
                        "text-sm px-4 py-1 font-black uppercase",
                        exitAnalysis.verdict === 'ENCERRAR' ? "bg-success text-success-foreground" : 
                        exitAnalysis.verdict === 'MANTER' ? "bg-primary text-primary-foreground" : "bg-warning text-warning-foreground"
                      )}>
                        {exitAnalysis.verdict}
                      </Badge>
                      <span className="text-xs font-black text-muted-foreground uppercase tracking-widest">Score de Eficiência: {exitAnalysis.efficiency_score}/100</span>
                    </div>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-1">
                      <p className="text-[10px] font-black uppercase text-primary">Justificativa Técnica</p>
                      <p className="text-sm font-medium leading-relaxed">{exitAnalysis.reasoning}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[10px] font-black uppercase text-destructive flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3" /> Risco Residual
                      </p>
                      <p className="text-sm font-medium leading-relaxed">{exitAnalysis.risk_comment}</p>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        <Card className={cn(isSimulating && "border-primary ring-2 ring-primary/20")}>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">{isSimulating ? "SIMULANDO NOVA ESTRUTURA" : "Pernas da Estratégia — Simulação de Saída"}</CardTitle>
            {isSimulating && <Badge className="bg-primary animate-pulse">MODO SIMULAÇÃO</Badge>}
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
                    <th className="text-right py-2">{isSimulating ? "Novo Preço (Sim)" : "Preço Atual"}</th>
                    <th className="text-right py-2">P&L</th>
                  </tr>
                </thead>
                <tbody>
                  {(isSimulating ? simLegs : legs).map((leg, i) => {
                    const cp = isSimulating ? leg.price : parseFloat(currentPrices[leg.id!] || '');
                    const pnl = !isNaN(cp) ? (leg.side === 'buy' ? 1 : -1) * (cp - (isSimulating ? legs[i].price : leg.price)) * leg.quantity : null;
                    
                    const exitAction = leg.side === 'buy' ? 'Venda' : 'Recompra';
                    const exitColor = leg.side === 'buy' ? 'bg-success/10 text-success border-success/20' : 'bg-info/10 text-info border-info/20';

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
                        <td className="py-3 text-right">
                          <div className="relative flex justify-end">
                            <Input 
                              type="number" step="0.01" 
                              value={isSimulating ? leg.price : (currentPrices[leg.id!] || '')} 
                              onChange={e => isSimulating ? updateSimLeg(i, 'price', parseFloat(e.target.value) || 0) : setCurrentPrices(p => ({...p, [leg.id!]: e.target.value}))}
                              className={cn(
                                "w-28 h-9 text-right text-sm font-bold", 
                                isSimulating ? "border-primary bg-primary/5" : "border-primary/30 focus:border-primary"
                              )}
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
                            <span className="text-muted-foreground text-xs">Aguardando preço</span>
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
              // Passando o CDI do período para o gráfico
              simulationCdiReturn={periodMetrics?.cdiReturnSinceEntry}
            />
          </CardContent>
        </Card>

        <MetricsCards metrics={metrics} cdiReturn={calculateCDIOpportunityCost(Math.abs(metrics.montageTotal || metrics.netCost), cdiRate, daysToExpiry)} daysToExpiry={daysToExpiry} />
        <CDIComparison metrics={metrics} cdiRate={cdiRate} setCdiRate={setCdiRate} daysToExpiry={daysToExpiry} setDaysToExpiry={setDaysToExpiry} />
      </main>
    </div>
  );
}