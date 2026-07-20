import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
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
import type { AIAnalysisResult } from '@/lib/types';
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
import { Save, Sparkles, Loader2, Camera, Keyboard, Wand2, Wallet, TrendingUp, TrendingDown, Lock, Crown, CreditCard, BarChart3, MousePointer2, Info, AlertTriangle, Calendar, Percent, Trash2, CheckCircle2, Download, Calculator, ArrowRight, Zap, Image as ImageIcon, X } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { ProfessionalHeader, SectionDivider, ProfessionalLayout } from '@/components/ProfessionalLayout';
import DashboardSkeleton from '@/components/skeletons/DashboardSkeleton';
import AIInsights from '@/components/AIInsights';
import OnboardingTour from '@/components/OnboardingTour';
import PortfolioSummary from '@/components/dashboard/PortfolioSummary';
import FloatingAnalysisBar from '@/components/dashboard/FloatingAnalysisBar';

type InputMode = null | 'manual' | 'image';
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
  const [aiAnalysis, setAiAnalysis] = useState<AIAnalysisResult | null>(null);
  const [loadingAI, setLoadingAI] = useState(false);
  const [aiProgress, setAiProgress] = useState(0);
  const [saving, setSaving] = useState(false);
  const [inputMode, setInputMode] = useState<InputMode>(null);
  const [ocrPreview, setOcrPreview] = useState<string | null>(null);
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
      setExpiryDate(inferredExpiry);
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


  const addLeg = useCallback(async (leg: Leg) => { 
    if (isLimitReached) {
      toast.error('Período de teste expirado! Assine o PRO para continuar.');
      return;
    }
    setLegs(prev => [...prev, leg]);
  }, [isLimitReached, user]);

  const removeLeg = useCallback((index: number) => { setLegs(prev => prev.filter((_, i) => i !== index)); }, []);
  const updateLeg = useCallback((index: number, leg: Leg) => { setLegs(prev => prev.map((item, i) => (i === index ? leg : item))); }, []);
  
  const handleLegsFromImage = useCallback(async (extractedLegs: any[], imageDataUrl?: string) => {
    if (isLimitReached) {
      toast.error('Período de teste expirado! Assine o PRO para continuar.');
      return;
    }
    // Guarda a imagem lida para conferência lado a lado com a estrutura extraída
    if (imageDataUrl) setOcrPreview(imageDataUrl);

    // Converte números que possam vir como texto ("1,47", "R$ 41,08") com segurança
    const num = (v: any) => {
      if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
      const n = parseFloat(String(v ?? '').replace(',', '.').replace(/[^\d.\-]/g, ''));
      return Number.isFinite(n) ? n : 0;
    };

    const sanitizedLegs: Leg[] = extractedLegs.map(l => ({
      side: (l.side === 'buy' || l.side === 'sell') ? l.side : 'buy',
      option_type: (l.option_type === 'call' || l.option_type === 'put' || l.option_type === 'stock') ? l.option_type : 'call',
      asset: String(l.asset || '').toUpperCase(),
      strike: num(l.strike),
      price: Math.abs(num(l.price)),
      quantity: Math.max(1, Math.round(num(l.quantity)) || 1),
    }));

    // Substitui a estrutura pela lida da imagem (não acumula com pernas anteriores).
    // Isso dispara o recálculo de métricas e do gráfico automaticamente (useMemo em [legs]).
    setLegs(sanitizedLegs);
    setInputMode('manual');
  }, [isLimitReached, user]);

  if (authLoading || access.status === 'loading') return (
    <ProfessionalLayout>
      <Header />
      <main className="container py-6">
        <DashboardSkeleton />
      </main>
    </ProfessionalLayout>
  );
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
    setAiProgress(10);
    setTimeout(() => {
      aiSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 200);
    
    // Progress simulation
    const progressInterval = setInterval(() => {
      setAiProgress(prev => Math.min(prev + 15, 85));
    }, 800);
    
    try {
      setAiProgress(30);
      const { data, error } = await supabase.functions.invoke('analyze-structure', {
        body: {
          legs,
          metrics: { ...metrics, cdiReturn, cdiEfficiency: cdiReturn > 0 && typeof metrics.maxGain === 'number' ? Math.round((metrics.maxGain / cdiReturn) * 100) : null },
          cdiRate, daysToExpiry,
        },
      });
      if (error) throw error;
      
      setAiProgress(90);
      
      // Frontend validation: force AI coherence with calculated metrics
      const validated = { ...data } as AIAnalysisResult;
      if (metrics.isRiskFree && validated.risk_level !== 'Baixo') {
        validated.risk_level = 'Baixo';
        console.warn('[AI Validation] Forçado risk_level para Baixo (isRiskFree=true)');
      }
      if (metrics.isRiskFree && validated.cons) {
        validated.cons = validated.cons.filter((c: string) => 
          !c.toLowerCase().includes('prejuízo') && !c.toLowerCase().includes('perda') && !c.toLowerCase().includes('risco')
        );
      }
      if (metrics.montageTotal && metrics.montageTotal > 0 && validated.summary) {
        validated.summary = validated.summary.replace(/crédito líquido/gi, 'custo da montagem');
      }
      
      setAiAnalysis(validated);
      setAiProgress(100);
      
      toast.success('Análise de IA concluída!');
      setTimeout(() => {
        aiSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    } catch (err: unknown) {
      toast.error('Erro na IA');
    } finally { 
      clearInterval(progressInterval);
      setLoadingAI(false); 
      setTimeout(() => setAiProgress(0), 500);
    }
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

      // Incrementar contador de simulações via função segura
      await supabase.rpc('increment_simulation_count', { _user_id: user.id });

      setShowSaveDialog(true);
    } catch (err: any) {
      toast.error('Erro ao salvar');
    } finally { setSaving(false); }
  };

  return (
    <div className="min-h-screen bg-background pb-16">
      <Header />
      <OnboardingTour />
      
      {/* Banner fixo para usuários free */}
      {access.planType === 'free' && access.daysRemaining !== null && (
        <div className={cn(
          "sticky top-14 z-40 border-b",
          isLimitReached 
            ? "bg-destructive text-destructive-foreground" 
            : access.daysRemaining <= 2
              ? "bg-gradient-to-r from-destructive to-destructive/80 text-destructive-foreground"
              : "bg-gradient-to-r from-yellow-500 via-yellow-400 to-yellow-500 text-black"
        )}>
          <div className="container flex items-center justify-between gap-3 px-4 py-2.5">
            <div className="flex items-center gap-2 min-w-0">
              {isLimitReached ? (
                <Lock className="h-4 w-4 shrink-0" />
              ) : (
                <AlertTriangle className="h-4 w-4 shrink-0 animate-pulse" />
              )}
              <p className="text-xs sm:text-sm font-black uppercase tracking-wide truncate">
                {isLimitReached 
                  ? "Seu trial expirou — assine PRO para continuar"
                  : access.daysRemaining <= 2
                    ? `⚠️ Último${access.daysRemaining !== 1 ? 's' : ''} ${access.daysRemaining} dia${access.daysRemaining !== 1 ? 's' : ''} de trial! Não perca seu acesso`
                    : `🕐 ${access.daysRemaining} dias restantes no seu trial gratuito`}
              </p>
            </div>
            <Button 
              onClick={() => navigate('/settings')} 
              size="sm"
              className={cn(
                "shrink-0 font-black uppercase tracking-widest text-xs sm:text-xs",
                isLimitReached || access.daysRemaining <= 2
                  ? "bg-white text-destructive hover:bg-white/90 shadow-lg animate-pulse"
                  : "bg-black text-yellow-400 hover:bg-black/80 shadow-lg"
              )}
            >
              <Zap className="h-3 w-3 mr-1 fill-current" />
              ASSINAR PRO — R$ 14,90
            </Button>
          </div>
        </div>
      )}

      <main className="container px-3 sm:px-6 py-4 sm:py-6 space-y-4 sm:space-y-6 animate-fade-in">
        <PortfolioSummary userId={user.id} />

        {/* CTA Calculadora CDI x Opções */}
        <Card 
          className="border-2 border-yellow-400/50 bg-gradient-to-r from-yellow-400/10 via-yellow-400/5 to-transparent cursor-pointer hover:border-yellow-400 hover:shadow-[0_0_30px_rgba(250,204,21,0.2)] transition-all group"
          onClick={() => navigate('/calculadora-renda-fixa')}
        >
          <CardContent className="py-4 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-yellow-400/20 border border-yellow-400/30 group-hover:bg-yellow-400/30 transition-all">
                <Calculator className="h-6 w-6 text-yellow-400" />
              </div>
              <div>
                <p className="text-base sm:text-lg font-black uppercase tracking-tight text-foreground flex items-center gap-2">
                  Calculadora CDI × Opções
                  <Badge className="bg-yellow-400 text-black font-black text-xs border-0 animate-pulse">NOVO</Badge>
                </p>
                <p className="text-xs sm:text-sm text-muted-foreground font-medium">
                  Compare o rendimento da renda fixa com sua estrutura — com ou sem IR
                </p>
              </div>
            </div>
            <Button className="bg-yellow-400 hover:bg-yellow-300 text-black font-black uppercase tracking-widest text-xs shadow-[0_0_20px_rgba(250,204,21,0.4)] group-hover:shadow-[0_0_30px_rgba(250,204,21,0.6)] transition-all whitespace-nowrap">
              <Calculator className="mr-2 h-4 w-4" />
              Clique Aqui Para Calcular
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </CardContent>
        </Card>


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
                    data-tour="ai-button"
                    onClick={getAISuggestion} 
                    disabled={loadingAI || legs.length === 0} 
                    className={cn(
                      "transition-all duration-500",
                      legs.length > 0 && !loadingAI
                        ? "bg-success hover:bg-success/90 text-success-foreground scale-110 h-14 px-8 text-lg font-black shadow-[0_0_40px_-8px_hsl(var(--success)/0.6)]"
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
                    <p className="text-xs font-black text-success uppercase tracking-widest">
                      Aperte aqui e descubra os segredos da sua estrutura!
                    </p>
                  </div>
                </TooltipContent>
              </Tooltip>

              <Button 
                data-tour="save-button"
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
                    setOcrPreview(null);
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

            {/* AI Progress Bar */}
            {loadingAI && (
              <div className="space-y-2 animate-fade-in">
                <div className="flex items-center justify-between text-xs font-black uppercase tracking-widest text-muted-foreground">
                  <span>{aiProgress < 30 ? 'Enviando estrutura...' : aiProgress < 70 ? 'Processando análise...' : aiProgress < 95 ? 'Gerando relatório...' : 'Finalizando!'}</span>
                  <span>{aiProgress}%</span>
                </div>
                <Progress value={aiProgress} className="h-2" />
              </div>
            )}

            <div className="grid gap-4 grid-cols-1 lg:grid-cols-3" data-tour="analysis-config">
              <div className="space-y-2">
                <Label className="flex items-center gap-2 text-sm font-bold">
                  Nome da análise
                  {legs.length > 0 && !hasManuallyNamed && (
                    <Badge variant="outline" className="text-xs border-primary/30 text-primary animate-pulse">
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
                <p className="text-xs sm:text-xs text-primary/70 leading-relaxed">
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
              <div className="grid grid-cols-1 gap-4 sm:gap-6" data-tour="input-mode">
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
                        <Badge className="bg-primary text-primary-foreground text-xs font-black px-2">IA POWERED</Badge>
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
                        <Badge variant="outline" className="text-xs font-bold px-2">PRECISO</Badge>
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
                {inputMode === 'manual' ? <Card className="border-border/40 bg-card/50 backdrop-blur-sm"><CardContent className="pt-6"><LegForm onAdd={addLeg} /></CardContent></Card> : <ImageUpload onLegsExtracted={handleLegsFromImage} onImageChange={(hasImage) => { if (!hasImage) { setLegs([]); setOcrPreview(null); } }} />}
              </div>
            )}

            {ocrPreview && (
              <Card className="border-primary/30 bg-primary/[0.03]">
                <CardContent className="p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-bold text-muted-foreground flex items-center gap-1.5">
                      <ImageIcon className="h-3.5 w-3.5 text-primary" /> Imagem lida — confira se a estrutura abaixo confere (lado, tipo, strike e preço)
                    </p>
                    <button onClick={() => setOcrPreview(null)} aria-label="Fechar imagem de conferência" className="text-muted-foreground hover:text-foreground shrink-0">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  <a href={ocrPreview} target="_blank" rel="noreferrer" title="Abrir imagem em tamanho real">
                    <img src={ocrPreview} alt="Boleta lida pelo OCR" className="max-h-72 w-auto max-w-full rounded-lg border border-border/40 mx-auto" />
                  </a>
                </CardContent>
              </Card>
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

      {/* Smart Floating Bar - only shows when scrolled */}
      {legs.length > 0 && !isLimitReached && (
        <FloatingAnalysisBar
          onAnalyze={getAISuggestion}
          onSave={saveAnalysis}
          onDownloadPdf={async () => {
            const { generateAnalysisPdf } = await import('@/lib/pdf-generator');
            generateAnalysisPdf(
              analysisName || 'Análise',
              legs,
              metrics,
              { cdiRate, daysToExpiry, aiSuggestion: aiAnalysis ? JSON.stringify(aiAnalysis) : undefined }
            );
          }}
          loadingAI={loadingAI}
          saving={saving}
        />
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