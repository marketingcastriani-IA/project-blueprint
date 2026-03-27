"use client";

import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip as RTooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { useAuth } from '@/contexts/AuthContext';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAccessControl } from '@/hooks/useAccessControl';
import AccessBlocked from '@/pages/AccessBlocked';
import Header from '@/components/Header';
import LegForm from '@/components/LegForm';
import LegsTable from '@/components/LegsTable';
import PayoffChart from '@/components/PayoffChart';
import MetricsCards from '@/components/MetricsCards';
import CDIComparison from '@/components/CDIComparison';
import ImageUpload from '@/components/ImageUpload';
import { Leg } from '@/lib/types';
import { generatePayoffCurve, calculateMetrics, calculateCDIOpportunityCost } from '@/lib/payoff';
import { getExpiryFromTicker, countBusinessDays } from '@/lib/b3-calendar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Save, Sparkles, Loader2, Camera, Keyboard, Wand2, Wallet, TrendingUp, TrendingDown, Lock, Crown, CreditCard, BarChart3, MousePointer2, Info, AlertTriangle, Calendar, Percent, Trash2, CheckCircle2, Download } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { ProfessionalHeader, SectionDivider } from '@/components/ProfessionalLayout';
import AIInsights from '@/components/AIInsights';
import { generateAnalysisPdf } from '@/lib/pdf-generator';

type InputMode = null | 'manual' | 'image';

function PortfolioSummary({ userId }: { userId: string }) {
  const [stats, setStats] = useState<{ totalPL: number; roi: number; openCount: number; closedCount: number; winRate: number; evolutionData: { name: string; pl: number }[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchStats = async () => {
      // Fetch all analyses (open + closed)
      const { data: allAnalyses } = await supabase
        .from('analyses')
        .select('id, status, created_at, closed_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: true });

      if (!allAnalyses || allAnalyses.length === 0) {
        setLoading(false);
        return;
      }

      const closedAnalyses = allAnalyses.filter(a => a.status === 'closed');
      const openAnalyses = allAnalyses.filter(a => a.status !== 'closed');

      if (closedAnalyses.length === 0 && openAnalyses.length === 0) {
        setLoading(false);
        return;
      }

      const closedIds = closedAnalyses.map(a => a.id);
      let totalPL = 0;
      let totalInvested = 0;
      let wins = 0;
      const evolutionData: { name: string; pl: number }[] = [];

      if (closedIds.length > 0) {
        const { data: legs } = await supabase
          .from('legs')
          .select('analysis_id, side, price, current_price, quantity')
          .in('analysis_id', closedIds);

        if (legs) {
          const analysisMap: Record<string, any[]> = {};
          legs.forEach(l => {
            if (!analysisMap[l.analysis_id]) analysisMap[l.analysis_id] = [];
            analysisMap[l.analysis_id].push(l);
          });

          // Build evolution data per closed analysis
          let cumulativePL = 0;
          closedAnalyses.forEach((analysis, idx) => {
            const strategyLegs = analysisMap[analysis.id] || [];
            let strategyPL = 0;
            let strategyNetCost = 0;
            strategyLegs.forEach(l => {
              const multiplier = l.side === 'buy' ? 1 : -1;
              if (l.current_price != null) {
                strategyPL += multiplier * (l.current_price - l.price) * l.quantity;
              }
              const costMultiplier = l.side === 'buy' ? -1 : 1;
              strategyNetCost += costMultiplier * l.price * l.quantity;
            });

            totalPL += strategyPL;
            cumulativePL += strategyPL;
            if (strategyPL > 0) wins++;
            if (strategyNetCost < 0) totalInvested += Math.abs(strategyNetCost);

            const date = analysis.closed_at || analysis.created_at;
            evolutionData.push({
              name: new Date(date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
              pl: Math.round(cumulativePL * 100) / 100,
            });
          });
        }
      }

      setStats({
        totalPL,
        roi: totalInvested > 0 ? (totalPL / totalInvested) * 100 : (totalPL > 0 ? 100 : 0),
        openCount: openAnalyses.length,
        closedCount: closedAnalyses.length,
        winRate: closedAnalyses.length > 0 ? (wins / closedAnalyses.length) * 100 : 0,
        evolutionData,
      });
      setLoading(false);
    };

    fetchStats();
  }, [userId]);

  if (loading || !stats) return null;
  if (stats.totalPL === 0 && stats.openCount === 0 && stats.closedCount === 0) return null;

  

  return (
    <div className="mb-6 space-y-4">
      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="border-border/40 bg-card/80">
          <CardContent className="py-3 px-4">
            <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Resultado Total</p>
            <p className={cn("text-xl font-black tracking-tighter", stats.totalPL >= 0 ? "text-success" : "text-destructive")}>
              R$ {stats.totalPL.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </p>
          </CardContent>
        </Card>
        <Card className="border-border/40 bg-card/80">
          <CardContent className="py-3 px-4">
            <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">ROI Consolidado</p>
            <p className={cn("text-xl font-black tracking-tighter", stats.roi >= 0 ? "text-success" : "text-destructive")}>
              {stats.roi >= 0 ? '+' : ''}{stats.roi.toFixed(2)}%
            </p>
          </CardContent>
        </Card>
        <Card className="border-border/40 bg-card/80">
          <CardContent className="py-3 px-4">
            <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Operações</p>
            <div className="flex items-baseline gap-2">
              <p className="text-xl font-black tracking-tighter text-foreground">{stats.openCount + stats.closedCount}</p>
              <span className="text-[10px] text-muted-foreground font-bold">{stats.openCount} abertas · {stats.closedCount} fechadas</span>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/40 bg-card/80">
          <CardContent className="py-3 px-4">
            <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Taxa de Acerto</p>
            <p className={cn("text-xl font-black tracking-tighter", stats.winRate >= 50 ? "text-success" : "text-warning")}>
              {stats.winRate.toFixed(0)}%
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Evolution chart */}
      {stats.evolutionData.length >= 2 && (
        <Card className="border-primary/20 bg-card/80">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-black flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-primary" /> Evolução do P&L Acumulado
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[180px] sm:h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={stats.evolutionData}>
                  <defs>
                    <linearGradient id="plGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--success))" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="hsl(var(--success))" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" tickLine={false} axisLine={false} tickFormatter={(v: number) => `R$${v}`} />
                  <RTooltip
                    contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }}
                    formatter={(value: number) => [`R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 'P&L Acumulado']}
                  />
                  <ReferenceLine y={0} stroke="hsl(var(--muted-foreground))" strokeDasharray="3 3" strokeOpacity={0.5} />
                  <Area type="monotone" dataKey="pl" stroke="hsl(var(--success))" strokeWidth={2} fill="url(#plGradient)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default function Dashboard() {
  const { user, loading: authLoading } = useAuth();
  const access = useAccessControl();
  const navigate = useNavigate();
  const [legs, setLegs] = useState<Leg[]>([]);
  const [analysisName, setAnalysisName] = useState('');
  const [entryDate, setEntryDate] = useState(new Date().toISOString().split('T')[0]);
  const [hasManuallyNamed, setHasManuallyNamed] = useState(false);
  const [cdiRate, setCdiRate] = useState(14.65);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [daysToExpiry, setDaysToExpiry] = useState(0);
  const [expiryDate, setExpiryDate] = useState<Date | undefined>(undefined);
  const [aiAnalysis, setAiAnalysis] = useState<any>(null);
  const [loadingAI, setLoadingAI] = useState(false);
  const [saving, setSaving] = useState(false);
  const [inputMode, setInputMode] = useState<InputMode>(null);
  const aiSectionRef = useRef<HTMLDivElement>(null);

  const metrics = useMemo(() => calculateMetrics(legs), [legs]);
  const payoffData = useMemo(() => generatePayoffCurve(legs, daysToExpiry, cdiRate), [legs, daysToExpiry, cdiRate]);

  const entrySpotPrice = useMemo(() => {
    const stockLeg = legs.find(l => l.option_type === 'stock');
    return stockLeg ? stockLeg.price : null;
  }, [legs]);

  useEffect(() => {
    if (!hasManuallyNamed && legs.length > 0) {
      const asset = legs[0].asset || '';
      const strategy = metrics.strategyLabel || 'Nova Estrutura';
      setAnalysisName(`${strategy} ${asset}`.trim());
    }
  }, [legs, metrics.strategyLabel, hasManuallyNamed]);

  const [hasManualExpiry, setHasManualExpiry] = useState(false);

  const inferredExpiry = useMemo(() => {
    const leg = legs.find(l => l.option_type !== 'stock');
    return leg ? getExpiryFromTicker(leg.asset) : null;
  }, [legs]);

  useEffect(() => {
    if (inferredExpiry && !hasManualExpiry) {
      const entry = new Date(entryDate + 'T00:00:00');
      setDaysToExpiry(countBusinessDays(entry, inferredExpiry));
    }
  }, [inferredExpiry, entryDate, hasManualExpiry]);

  const handleExpiryDateChange = (date: Date | undefined) => {
    setExpiryDate(date);
    setHasManualExpiry(!!date);
  };

  const investedCapital = useMemo(() => {
    if (metrics.montageTotal) return Math.abs(metrics.montageTotal);
    return Math.max(Math.abs(metrics.netCost || 0), 1);
  }, [metrics]);

  const cdiReturn = useMemo(() => {
    if (!cdiRate || daysToExpiry <= 0) return 0;
    return calculateCDIOpportunityCost(investedCapital, cdiRate, daysToExpiry);
  }, [investedCapital, cdiRate, daysToExpiry]);

  const isLimitReached = access.trialExpired || (access.planType === 'free' && access.daysRemaining !== null && access.daysRemaining <= 0);

  const incrementSimulations = async () => {
    // No longer counting simulations - trial is time-based
  };

  const addLeg = useCallback(async (leg: Leg) => { 
    if (isLimitReached) {
      toast.error('Período de teste expirado! Assine o PRO para continuar.');
      return;
    }
    setLegs(prev => [...prev, leg]);
  }, [isLimitReached, user]);

  const removeLeg = useCallback((index: number) => { setLegs(prev => prev.filter((_, i) => i !== index)); }, []);
  const updateLeg = useCallback((index: number, leg: Leg) => { setLegs(prev => prev.map((item, i) => (i === index ? leg : item))); }, []);
  
  const handleLegsFromImage = useCallback(async (extractedLegs: any[]) => { 
    if (isLimitReached) {
      toast.error('Período de teste expirado! Assine o PRO para continuar.');
      return;
    }

    const sanitizedLegs: Leg[] = extractedLegs.map(l => ({
      side: (l.side === 'buy' || l.side === 'sell') ? l.side : 'buy',
      option_type: (l.option_type === 'call' || l.option_type === 'put' || l.option_type === 'stock') ? l.option_type : 'call',
      asset: String(l.asset || '').toUpperCase(),
      strike: Number(l.strike) || 0,
      price: Number(l.price) || 0,
      quantity: Math.max(1, Number(l.quantity) || 1),
    }));

    setLegs(prev => [...prev, ...sanitizedLegs]); 
    setInputMode('manual');
  }, [isLimitReached, user]);

  if (authLoading || access.status === 'loading') return null;
  if (!user) return <Navigate to="/auth" replace />;

  if (access.status === 'pending' || access.status === 'rejected' || access.status === 'expired') {
    return <AccessBlocked status={access.status} />;
  }

  const getAISuggestion = async () => {
    if (isLimitReached) {
      toast.error('Período de teste expirado! Assine o PRO para continuar.');
      return;
    }
    if (legs.length === 0) { toast.error('Adicione pernas primeiro.'); return; }
    setLoadingAI(true);
    setTimeout(() => {
      aiSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 200);
    try {
      const { data, error } = await supabase.functions.invoke('analyze-structure', {
        body: {
          legs,
          metrics: { ...metrics, cdiReturn, cdiEfficiency: cdiReturn > 0 && typeof metrics.maxGain === 'number' ? Math.round((metrics.maxGain / cdiReturn) * 100) : null },
          cdiRate, daysToExpiry,
        },
      });
      if (error) throw error;
      
      // Frontend validation: force AI coherence with calculated metrics
      const validated = { ...data };
      if (metrics.isRiskFree && validated.risk_level !== 'Baixo') {
        validated.risk_level = 'Baixo';
        console.warn('[AI Validation] Forçado risk_level para Baixo (isRiskFree=true)');
      }
      if (metrics.isRiskFree && validated.cons) {
        validated.cons = validated.cons.filter((c: string) => 
          !c.toLowerCase().includes('prejuízo') && !c.toLowerCase().includes('perda') && !c.toLowerCase().includes('risco')
        );
      }
      // Check if AI mentions "crédito" when it's actually a debit
      if (metrics.montageTotal > 0 && validated.summary) {
        validated.summary = validated.summary.replace(/crédito líquido/gi, 'custo da montagem');
      }
      
      setAiAnalysis(validated);
      
      toast.success('Análise de IA concluída!');
      setTimeout(() => {
        aiSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    } catch (err: any) {
      toast.error('Erro na IA');
    } finally { setLoadingAI(false); }
  };

  const saveAnalysis = async () => {
    if (legs.length === 0) return;
    setSaving(true);
    try {
      const { data: analysis, error: aError } = await supabase
        .from('analyses').insert({
          user_id: user.id, 
          name: analysisName || 'Análise sem nome',
          underlying_asset: legs[0]?.asset || null, 
          cdi_rate: cdiRate || null,
          days_to_expiry: daysToExpiry || null,
          expiry_date: expiryDate ? `${expiryDate.getFullYear()}-${String(expiryDate.getMonth() + 1).padStart(2, '0')}-${String(expiryDate.getDate()).padStart(2, '0')}` : null,
          ai_suggestion: aiAnalysis ? JSON.stringify(aiAnalysis) : null,
          created_at: new Date(entryDate + 'T12:00:00').toISOString(),
        }).select().single();
      if (aError) throw aError;

      const legsToInsert = legs.map(l => ({
        analysis_id: analysis.id, side: l.side, option_type: l.option_type,
        asset: l.asset, strike: l.strike, price: l.price, quantity: l.quantity,
        expiry_date: l.expiry_date || null,
      }));
      await supabase.from('legs').insert(legsToInsert);

      // Incrementar contador de simulações
      const { data: currentAccess } = await supabase
        .from('user_access')
        .select('simulations_count')
        .eq('user_id', user.id)
        .single();
      
      await supabase
        .from('user_access')
        .update({ simulations_count: (currentAccess?.simulations_count || 0) + 1 })
        .eq('user_id', user.id);

      setShowSaveDialog(true);
    } catch (err: any) {
      toast.error('Erro ao salvar');
    } finally { setSaving(false); }
  };

  return (
    <div className="min-h-screen bg-background pb-16">
      <Header />
      <main className="container px-3 sm:px-6 py-4 sm:py-6 space-y-4 sm:space-y-6 animate-fade-in">
        <PortfolioSummary userId={user.id} />

        {access.planType === 'free' && access.daysRemaining !== null && (
          <Card className={cn("border-2 transition-all", isLimitReached ? "border-destructive bg-destructive/5" : "border-primary/30 bg-primary/5")}>
            <CardContent className="py-4 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className={cn("p-2 rounded-lg", isLimitReached ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary")}>
                  {isLimitReached ? <Lock className="h-5 w-5" /> : <Calendar className="h-5 w-5" />}
                </div>
                <div>
                  <p className="text-sm font-black uppercase tracking-tight">
                    {isLimitReached ? "Período de Teste Expirado" : "Período de Teste Gratuito"}
                  </p>
                  <p className="text-xs text-muted-foreground font-medium">
                    {isLimitReached 
                      ? "Seus 7 dias gratuitos acabaram. Assine o PRO para continuar!" 
                      : `Restam ${access.daysRemaining} dia${access.daysRemaining !== 1 ? 's' : ''} do seu teste gratuito de 7 dias.`}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {!isLimitReached && (
                  <Badge variant="outline" className="border-primary/30 text-primary font-black text-lg px-4 py-1">
                    {access.daysRemaining} dia{access.daysRemaining !== 1 ? 's' : ''}
                  </Badge>
                )}
                <Button onClick={() => navigate('/settings')} variant={isLimitReached ? "default" : "outline"} className={cn("font-bold", isLimitReached && "animate-pulse shadow-lg shadow-primary/30")}>
                  <Crown className="mr-2 h-4 w-4" /> {isLimitReached ? "ASSINAR PRO" : "Ver PRO"}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <ProfessionalHeader
            title="Nova Análise"
            subtitle="Monte sua estrutura de opções e analise os riscos em tempo real"
            badge={
              <div className="flex gap-2">
                {access.planType === 'pro' ? (
                  <Badge className="bg-primary text-primary-foreground font-black gap-1">
                    <Crown className="h-3 w-3" /> PRO
                  </Badge>
                ) : (
                  <Badge variant="outline" className={cn("font-bold", isLimitReached ? "border-destructive text-destructive" : "border-primary/30 text-primary")}>
                    FREE • {isLimitReached ? 'Expirado' : `${access.daysRemaining}d restantes`}
                  </Badge>
                )}
              </div>
            }
          />
          {isLimitReached && (
            <Button onClick={() => navigate('/settings')} className="bg-primary animate-pulse font-black shadow-lg shadow-primary/30 h-12 px-6">
              <CreditCard className="mr-2 h-5 w-5" /> UPGRADE PARA PRO AGORA
            </Button>
          )}
        </div>
        
        {isLimitReached ? (
          <Card className="border-2 border-destructive/30 bg-destructive/5 p-8 text-center space-y-6">
            <div className="flex justify-center">
              <div className="h-16 w-16 rounded-full bg-destructive/10 flex items-center justify-center">
                <AlertTriangle className="h-8 w-8 text-destructive" />
              </div>
            </div>
            <div className="space-y-2">
              <h3 className="text-2xl font-black tracking-tight">Período de Teste Expirado</h3>
              <p className="text-muted-foreground max-w-md mx-auto font-medium">
                Seus 7 dias de teste gratuito acabaram. Para continuar analisando estruturas com IA e OCR, faça o upgrade para o plano PRO.
              </p>
            </div>
            <Button onClick={() => navigate('/settings')} size="lg" className="font-black px-10">
              Ver Planos e Preços
            </Button>
          </Card>
        ) : (
          <>
            <div className="flex gap-2 sm:gap-3 flex-wrap items-center">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    onClick={getAISuggestion} 
                    disabled={loadingAI || legs.length === 0} 
                    className={cn(
                      "transition-all duration-500",
                      legs.length > 0 && !loadingAI
                        ? "bg-success hover:bg-success/90 text-success-foreground scale-110 animate-pulse h-14 px-8 text-lg font-black shadow-[0_0_40px_-8px_hsl(var(--success)/0.6)]"
                        : "text-base h-11 px-6 shadow-[0_0_30px_-8px_hsl(var(--primary)/0.4)]"
                    )}
                  >
                    {loadingAI ? (
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    ) : legs.length > 0 ? (
                      <MousePointer2 className="mr-2 h-6 w-6" />
                    ) : (
                      <Sparkles className="mr-2 h-5 w-5" />
                    )}
                    Analisar a Estrutura por IA
                  </Button>
                </TooltipTrigger>
                <TooltipContent className="max-w-xs p-4 bg-card border-2 border-primary/30 shadow-xl">
                  <div className="space-y-2">
                    <p className="text-sm font-black text-primary flex items-center gap-2">
                      <Sparkles className="h-4 w-4" /> O QUE ESTE BOTÃO FAZ?
                    </p>
                    <p className="text-xs font-medium leading-relaxed">
                      Nossa IA analisa sua estrutura, calcula a eficiência vs CDI e fornece um relatório detalhado de riscos, cenários de mercado e um veredito profissional.
                    </p>
                    <p className="text-[10px] font-black text-success uppercase tracking-widest">
                      Aperte aqui e descubra os segredos da sua estrutura!
                    </p>
                  </div>
                </TooltipContent>
              </Tooltip>

              <Button 
                onClick={saveAnalysis} 
                disabled={saving || legs.length === 0}
                variant="outline"
                className="text-base h-11 px-6"
              >
                {saving ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Save className="mr-2 h-5 w-5" />}
                Salvar Análise
              </Button>

              {legs.length > 0 && (
                <Button 
                  variant="destructive"
                  onClick={() => {
                    setLegs([]);
                    setAiAnalysis(null);
                    setAnalysisName('');
                    setHasManuallyNamed(false);
                    setInputMode(null);
                    setDaysToExpiry(0);
                    setExpiryDate(undefined);
                    setHasManualExpiry(false);
                    setEntryDate(new Date().toISOString().split('T')[0]);
                    toast.success('Análise limpa! Pronto para uma nova simulação.');
                  }}
                  className="text-base h-11 px-6"
                >
                  <Trash2 className="mr-2 h-5 w-5" />
                  Nova Análise
                </Button>
              )}
            </div>

            <div className="grid gap-4 grid-cols-1 lg:grid-cols-3">
              <div className="space-y-2">
                <Label className="flex items-center gap-2 text-sm font-bold">
                  Nome da análise
                  {legs.length > 0 && !hasManuallyNamed && (
                    <Badge variant="outline" className="text-[9px] border-primary/30 text-primary animate-pulse">
                      <Wand2 className="h-2 w-2 mr-1" /> Auto
                    </Badge>
                  )}
                </Label>
                <Input 
                  value={analysisName} 
                  onChange={e => {
                    setAnalysisName(e.target.value);
                    setHasManuallyNamed(true);
                  }} 
                  placeholder="Ex: Trava de alta PETR4" 
                  className="font-bold text-base h-14" 
                />
              </div>
              <div className="space-y-2 rounded-xl border-2 border-primary shadow-[0_0_20px_-6px_hsl(var(--primary)/0.35)] bg-gradient-to-br from-primary/15 to-primary/5 p-3">
                <Label className="flex items-center gap-2 font-black uppercase tracking-widest text-xs text-primary">
                  <Calendar className="h-4 w-4 text-primary" /> 📅 Data de Entrada
                </Label>
                <Input 
                  type="date"
                  value={entryDate}
                  onChange={e => setEntryDate(e.target.value)}
                  className="font-black text-base h-14 border-2 border-primary/50 bg-background/80 hover:border-primary transition-all cursor-pointer"
                />
                <p className="text-[10px] sm:text-xs text-primary/70 leading-relaxed">
                  Informe a <span className="font-black text-primary">data de entrada correta</span> para que o cálculo do CDI reflita o período exato da operação.
                </p>
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-2 font-black uppercase tracking-widest text-xs text-muted-foreground">
                  <Percent className="h-4 w-4 text-primary" /> Taxa CDI (% a.a.)
                </Label>
                <Input 
                  type="number"
                  step="0.01"
                  value={cdiRate}
                  onChange={e => setCdiRate(parseFloat(e.target.value) || 0)}
                  className="font-bold text-base h-14 border-primary/40 bg-primary/5 hover:border-primary transition-all"
                />
              </div>
            </div>

            {inputMode === null ? (
              <div className="grid grid-cols-1 gap-4 sm:gap-6">
                <button 
                  onClick={() => setInputMode('image')} 
                  className="group relative overflow-hidden rounded-2xl border-2 border-primary/40 bg-gradient-to-br from-primary/10 via-card to-card p-8 text-left transition-all duration-500 hover:border-primary hover:shadow-[0_0_60px_-12px_hsl(var(--primary)/0.5)] hover:-translate-y-1.5"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                  <div className="relative space-y-4">
                    <div className="flex items-center gap-4">
                      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-[0_0_25px_-5px_hsl(var(--primary))] group-hover:scale-110 transition-transform duration-500">
                        <Camera className="h-8 w-8" />
                      </div>
                      <div className="space-y-1">
                        <Badge className="bg-primary text-primary-foreground text-[10px] font-black px-2">IA POWERED</Badge>
                        <h3 className="text-2xl font-black tracking-tight flex items-center gap-2">
                          Upload de Imagem
                        </h3>
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground font-medium leading-relaxed">
                      Tire um print da sua corretora e nossa IA avançada extrairá automaticamente todas as pernas da operação em segundos.
                    </p>
                  </div>
                </button>

                <button 
                  onClick={() => setInputMode('manual')} 
                  className="group relative overflow-hidden rounded-2xl border-2 border-dashed border-muted-foreground/30 bg-card p-8 text-left transition-all duration-300 hover:border-muted-foreground/60 hover:bg-muted/30 hover:-translate-y-1"
                >
                  <div className="relative space-y-4">
                    <div className="flex items-center gap-4">
                      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted text-muted-foreground group-hover:bg-muted-foreground group-hover:text-background transition-colors">
                        <Keyboard className="h-8 w-8" />
                      </div>
                      <div className="space-y-1">
                        <Badge variant="outline" className="text-[10px] font-bold px-2">PRECISO</Badge>
                        <h3 className="text-2xl font-black tracking-tight">Entrada Manual</h3>
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground font-medium leading-relaxed">
                      Insira manualmente cada perna da sua operação para ter controle total sobre os strikes e prêmios.
                    </p>
                  </div>
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <button onClick={() => setInputMode('manual')} className={cn('flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all', inputMode === 'manual' ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:text-foreground hover:bg-muted/50')}><Keyboard className="h-4 w-4" /> Manual</button>
                  <button onClick={() => setInputMode('image')} className={cn('flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all', inputMode === 'image' ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:text-foreground hover:bg-muted/50')}><Camera className="h-4 w-4" /> Upload OCR</button>
                </div>
                {inputMode === 'manual' ? <Card className="border-border/40 bg-card/50 backdrop-blur-sm"><CardContent className="pt-6"><LegForm onAdd={addLeg} /></CardContent></Card> : <ImageUpload onLegsExtracted={handleLegsFromImage} onImageChange={(hasImage) => !hasImage && setLegs([])} />}
              </div>
            )}

            <LegsTable legs={legs} onRemove={removeLeg} onUpdate={updateLeg} />

            {legs.length > 0 && (
              <>
                <div ref={aiSectionRef}>
                  <SectionDivider title="Análise de IA" />
                  <AIInsights analysis={aiAnalysis} loading={loadingAI} isRiskFree={!!metrics.isRiskFree} />
                </div>
                
                <SectionDivider title="Métricas e Payoff" />
                <MetricsCards metrics={metrics} cdiReturn={cdiReturn} daysToExpiry={daysToExpiry} investedCapital={investedCapital} />
                <Card className="border-border/40 bg-card/50 backdrop-blur-sm">
                  <CardHeader><CardTitle className="text-base">Gráfico de Payoff</CardTitle></CardHeader>
                  <CardContent>
                    <PayoffChart 
                      data={payoffData} 
                      breakevens={metrics.realBreakeven ? (Array.isArray(metrics.realBreakeven) ? metrics.realBreakeven : [metrics.realBreakeven]) : metrics.breakevens} 
                      cdiRate={cdiRate} 
                      daysToExpiry={daysToExpiry} 
                      netCost={metrics.netCost} 
                      montageTotal={metrics.montageTotal}
                      maxGain={metrics.maxGain}
                      maxLoss={metrics.maxLoss}
                      entrySpotPrice={entrySpotPrice}
                    />
                  </CardContent>
                </Card>
                <CDIComparison metrics={metrics} cdiRate={cdiRate} setCdiRate={setCdiRate} daysToExpiry={daysToExpiry} setDaysToExpiry={setDaysToExpiry} entryDate={entryDate} expiryDate={expiryDate} onExpiryDateChange={handleExpiryDateChange} />
                
                {/* Botão Salvar no fundo da página */}
                <div className="flex gap-3 justify-center pt-4 pb-8">
                  <Button 
                    onClick={saveAnalysis} 
                    disabled={saving || legs.length === 0}
                    className="text-base h-12 px-8 font-black shadow-lg shadow-primary/30"
                  >
                    {saving ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Save className="mr-2 h-5 w-5" />}
                    Salvar Análise
                  </Button>
                  <Button 
                    onClick={getAISuggestion} 
                    disabled={loadingAI || legs.length === 0} 
                    variant="outline"
                    className="text-base h-12 px-8 font-black"
                  >
                    {loadingAI ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Sparkles className="mr-2 h-5 w-5" />}
                    Analisar a Estrutura por IA
                  </Button>
                </div>
              </>
            )}
          </>
        )}
      </main>

      {/* Floating sticky bar - Analisar a Estrutura por IA */}
      {legs.length > 0 && !isLimitReached && (
        <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-primary/30 bg-card/95 backdrop-blur-md shadow-[0_-4px_30px_-8px_hsl(var(--primary)/0.3)]">
          <div className="container flex items-center justify-center py-3 gap-3">
            <Button
              onClick={getAISuggestion}
              disabled={loadingAI}
              className="animate-pulse bg-primary hover:bg-primary/90 text-primary-foreground font-black text-base h-12 px-8 shadow-[0_0_30px_-5px_hsl(var(--primary)/0.6)]"
            >
              {loadingAI ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Sparkles className="mr-2 h-5 w-5" />}
              Analisar a Estrutura por IA
            </Button>
            <Button
              onClick={saveAnalysis}
              disabled={saving}
              variant="outline"
              className="font-black text-base h-12 px-6"
            >
              {saving ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Save className="mr-2 h-5 w-5" />}
              Salvar
            </Button>
          </div>
        </div>
      )}

      {/* Dialog de sucesso ao salvar */}
      <Dialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader className="items-center text-center">
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-success/10">
              <CheckCircle2 className="h-8 w-8 text-success" />
            </div>
            <DialogTitle className="text-xl">Estrutura Salva com Sucesso!</DialogTitle>
            <DialogDescription className="text-base pt-2">
              Sua estratégia foi salva. Acompanhe o resultado na aba <strong>Histórico</strong>.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col gap-2 sm:flex-col">
            <Button onClick={() => { setShowSaveDialog(false); navigate('/history'); }} className="w-full font-bold">
              Ir para o Histórico
            </Button>
            <Button variant="outline" onClick={() => setShowSaveDialog(false)} className="w-full">
              Continuar Analisando
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}