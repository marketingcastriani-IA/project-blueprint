"use client";

import { useEffect, useState, useMemo, useCallback } from 'react';
import { useParams, useNavigate, Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import Header from '@/components/Header';
import PayoffChart from '@/components/PayoffChart';
import MetricsCards from '@/components/MetricsCards';
import CDIComparison from '@/components/CDIComparison';
import AIInsights from '@/components/AIInsights';
import { supabase } from '@/integrations/supabase/client';
import { Leg, AnalysisMetrics } from '@/lib/types';
import { generatePayoffCurve, calculateMetrics, calculateCDIOpportunityCost } from '@/lib/payoff';
import { getExpiryFromTicker, countBusinessDays } from '@/lib/b3-calendar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import {
  Loader2, ArrowLeft, Save, XCircle, Sparkles, Plus, Trash2,
  TrendingUp, TrendingDown, AlertTriangle, Clock, CheckCircle2, ShieldAlert, Edit2, RotateCcw, Layers
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
  const [loadingAI, setLoadingAI] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState<any>(null);
  const [cdiRate, setCdiRate] = useState(14.90);
  const [daysToExpiry, setDaysToExpiry] = useState(0);
  const [editingLegId, setEditingLegId] = useState<string | null>(null);
  
  // Estados para Simulação/Remontagem
  const [isSimulating, setIsSimulating] = useState(false);
  const [simLegs, setSimLegs] = useState<Leg[]>([]);

  useEffect(() => {
    if (!user || !id) return;
    Promise.all([
      supabase.from('analyses').select('*').eq('id', id).single(),
      supabase.from('legs').select('*').eq('analysis_id', id),
    ]).then(([aRes, lRes]) => {
      if (aRes.data) {
        const a = aRes.data as unknown as DbAnalysis;
        setAnalysis(a);
        setCdiRate(a.cdi_rate ?? 14.90);
        setDaysToExpiry(a.days_to_expiry ?? 0);
        if (a.ai_suggestion) setAiAnalysis(JSON.parse(a.ai_suggestion));
      }
      if (lRes.data) {
        const legs = lRes.data as unknown as DbLeg[];
        setDbLegs(legs);
        const prices: Record<string, string> = {};
        legs.forEach(l => { 
          // @ts-ignore
          prices[l.id] = l.current_price != null ? String(l.current_price) : ''; 
        });
        setCurrentPrices(prices);
      }
      setLoading(false);
    });
  }, [user, id]);

  const legs: Leg[] = useMemo(() => dbLegs.map(l => ({
    id: l.id, side: l.side as 'buy' | 'sell', option_type: l.option_type as 'call' | 'put' | 'stock',
    asset: l.asset, strike: l.strike, price: l.price, quantity: l.quantity,
  })), [dbLegs]);

  const metrics = useMemo(() => calculateMetrics(legs), [legs]);
  const payoffData = useMemo(() => generatePayoffCurve(legs), [legs]);
  
  const simPayoffData = useMemo(() => isSimulating ? generatePayoffCurve(simLegs) : null, [isSimulating, simLegs]);

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

  const startSimulation = () => {
    setSimLegs(JSON.parse(JSON.stringify(legs)));
    setIsSimulating(true);
    toast.info("Modo Simulação Ativado", { description: "Altere os valores na tabela para ver o novo payoff tracejado." });
  };

  const updateSimLeg = (index: number, field: keyof Leg, value: any) => {
    setSimLegs(prev => prev.map((l, i) => i === index ? { ...l, [field]: value } : l));
  };

  const saveCurrentPrices = async () => {
    setSaving(true);
    try {
      for (const leg of dbLegs) {
        const cp = parseFloat(currentPrices[leg.id] || '');
        await supabase.from('legs').update({ current_price: isNaN(cp) ? null : cp } as any).eq('id', leg.id);
      }
      toast.success('Preços atualizados!');
    } catch (err: any) { toast.error('Erro: ' + err.message); } finally { setSaving(false); }
  };

  const closeOperation = async () => {
    if (!confirm('Encerrar esta operação? Os preços atuais serão salvos como preços de saída.')) return;
    setClosing(true);
    try {
      await saveCurrentPrices();
      await supabase.from('analyses').update({ status: 'closed', closed_at: new Date().toISOString() } as any).eq('id', id!);
      setAnalysis(prev => prev ? { ...prev, status: 'closed' } : prev);
      toast.success('Operação encerrada!');
    } catch (err: any) { toast.error('Erro: ' + err.message); } finally { setClosing(false); }
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
              <p className="text-xs text-muted-foreground">{analysis?.underlying_asset} · {new Date(analysis?.created_at || '').toLocaleDateString('pt-BR')}</p>
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

        <Card className={cn(isSimulating && "border-primary ring-2 ring-primary/20")}>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">{isSimulating ? "SIMULANDO NOVA ESTRUTURA" : "Pernas da Estratégia — Preços Atuais"}</CardTitle>
            {isSimulating && <Badge className="bg-primary animate-pulse">MODO SIMULAÇÃO</Badge>}
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/50 text-muted-foreground text-xs">
                    <th className="text-left py-2">Ativo</th>
                    <th className="text-left py-2">Tipo</th>
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
                    return (
                      <tr key={i} className="border-b border-border/30">
                        <td className="py-2 font-medium">{leg.asset}</td>
                        <td className="py-2"><Badge variant="outline" className="text-[10px]">{leg.option_type.toUpperCase()}</Badge></td>
                        <td className="py-2 text-right">{leg.strike.toFixed(2)}</td>
                        <td className="py-2 text-right">{isSimulating ? legs[i].price.toFixed(2) : leg.price.toFixed(2)}</td>
                        <td className="py-2 text-right">{leg.quantity}</td>
                        <td className="py-2 text-right">
                          <Input 
                            type="number" step="0.01" 
                            value={isSimulating ? leg.price : (currentPrices[leg.id!] || '')} 
                            onChange={e => isSimulating ? updateSimLeg(i, 'price', parseFloat(e.target.value) || 0) : setCurrentPrices(p => ({...p, [leg.id!]: e.target.value}))}
                            className={cn("w-24 h-8 text-right text-sm ml-auto", isSimulating && "border-primary bg-primary/5")}
                          />
                        </td>
                        <td className="py-2 text-right font-medium">
                          {pnl !== null && <span className={pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}>{pnl >= 0 ? '+' : ''}{pnl.toFixed(2)}</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {!isSimulating && (
              <div className="flex justify-end mt-4">
                <Button size="sm" onClick={saveCurrentPrices} disabled={saving}>{saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />} Salvar Preços Atuais</Button>
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
              currentPnL={currentPnL}
              simulationData={simPayoffData}
            />
          </CardContent>
        </Card>

        <MetricsCards metrics={metrics} cdiReturn={calculateCDIOpportunityCost(Math.abs(metrics.montageTotal || metrics.netCost), cdiRate, daysToExpiry)} daysToExpiry={daysToExpiry} />
        <CDIComparison metrics={metrics} cdiRate={cdiRate} setCdiRate={setCdiRate} daysToExpiry={daysToExpiry} setDaysToExpiry={setDaysToExpiry} />
      </main>
    </div>
  );
}