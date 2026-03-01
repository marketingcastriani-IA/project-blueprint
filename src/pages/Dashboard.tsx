"use client";

import { useState, useCallback, useMemo, useEffect } from 'react';
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
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Save, Sparkles, Loader2, Camera, Keyboard, Wand2, Wallet, TrendingUp, TrendingDown, Lock, Crown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ProfessionalHeader, SectionDivider } from '@/components/ProfessionalLayout';
import AIInsights from '@/components/AIInsights';

type InputMode = null | 'manual' | 'image';

export default function Dashboard() {
  const { user, loading: authLoading } = useAuth();
  const access = useAccessControl();
  const navigate = useNavigate();
  const [legs, setLegs] = useState<Leg[]>([]);
  const [analysisName, setAnalysisName] = useState('');
  const [hasManuallyNamed, setHasManuallyNamed] = useState(false);
  const [cdiRate, setCdiRate] = useState(14.90);
  const [daysToExpiry, setDaysToExpiry] = useState(0);
  const [aiAnalysis, setAiAnalysis] = useState<any>(null);
  const [loadingAI, setLoadingAI] = useState(false);
  const [saving, setSaving] = useState(false);
  const [inputMode, setInputMode] = useState<InputMode>(null);

  const isFreeLimitReached = access.planType === 'free' && access.simulationCount >= 3;

  const metrics = useMemo(() => calculateMetrics(legs), [legs]);
  const payoffData = useMemo(() => generatePayoffCurve(legs, daysToExpiry, cdiRate), [legs, daysToExpiry, cdiRate]);

  useEffect(() => {
    if (!hasManuallyNamed && legs.length > 0) {
      const asset = legs[0].asset || '';
      const strategy = metrics.strategyLabel || 'Nova Estrutura';
      setAnalysisName(`${strategy} ${asset}`.trim());
    }
  }, [legs, metrics.strategyLabel, hasManuallyNamed]);

  const inferredExpiry = useMemo(() => {
    const leg = legs.find(l => l.option_type !== 'stock');
    return leg ? getExpiryFromTicker(leg.asset) : null;
  }, [legs]);

  useEffect(() => {
    if (inferredExpiry) {
      const today = new Date();
      setDaysToExpiry(countBusinessDays(today, inferredExpiry));
    }
  }, [inferredExpiry]);

  const investedCapital = useMemo(() => {
    if (metrics.montageTotal) return Math.abs(metrics.montageTotal);
    return Math.max(Math.abs(metrics.netCost || 0), 1);
  }, [metrics]);

  const cdiReturn = useMemo(() => {
    if (!cdiRate || daysToExpiry <= 0) return 0;
    return calculateCDIOpportunityCost(investedCapital, cdiRate, daysToExpiry);
  }, [investedCapital, cdiRate, daysToExpiry]);

  const addLeg = useCallback((leg: Leg) => { setLegs(prev => [...prev, leg]); }, []);
  const removeLeg = useCallback((index: number) => { setLegs(prev => prev.filter((_, i) => i !== index)); }, []);
  const updateLeg = useCallback((index: number, leg: Leg) => { setLegs(prev => prev.map((item, i) => (i === index ? leg : item))); }, []);
  
  const handleLegsFromImage = useCallback((extractedLegs: any[]) => { 
    if (access.planType === 'free') {
      toast.error('OCR de Imagem é exclusivo para o plano PRO.');
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
  }, [access.planType]);

  if (authLoading || access.status === 'loading') return null;
  if (!user) return <Navigate to="/auth" replace />;

  if (access.status === 'pending' || access.status === 'rejected' || access.status === 'expired') {
    return <AccessBlocked status={access.status} />;
  }

  const getAISuggestion = async () => {
    if (access.planType === 'free') {
      toast.error('Análise de IA é exclusiva para o plano PRO.');
      return;
    }
    if (legs.length === 0) { toast.error('Adicione pelo menos uma perna.'); return; }
    setLoadingAI(true);
    try {
      const { data, error } = await supabase.functions.invoke('analyze-structure', {
        body: {
          legs,
          metrics: { ...metrics, cdiReturn, cdiEfficiency: cdiReturn > 0 && typeof metrics.maxGain === 'number' ? Math.round((metrics.maxGain / cdiReturn) * 100) : null },
          cdiRate, daysToExpiry,
        },
      });
      if (error) throw error;
      setAiAnalysis(data);
      toast.success('Análise de IA concluída!');
    } catch (err: any) {
      toast.error('Erro ao obter sugestão: ' + (err.message || 'Tente novamente'));
    } finally { setLoadingAI(false); }
  };

  const saveAnalysis = async () => {
    if (isFreeLimitReached) {
      toast.error('Limite de 3 simulações atingido no plano Free.');
      return;
    }
    if (legs.length === 0) { toast.error('Adicione pelo menos uma perna.'); return; }
    setSaving(true);
    try {
      const { data: analysis, error: aError } = await supabase
        .from('analyses').insert({
          user_id: user.id, name: analysisName || 'Análise sem nome',
          underlying_asset: legs[0]?.asset || null, cdi_rate: cdiRate || null,
          days_to_expiry: daysToExpiry || null, ai_suggestion: aiAnalysis ? JSON.stringify(aiAnalysis) : null,
        }).select().single();
      if (aError) throw aError;

      const legsToInsert = legs.map(l => ({
        analysis_id: analysis.id, side: l.side, option_type: l.option_type,
        asset: l.asset, strike: l.strike, price: l.price, quantity: l.quantity,
      }));
      const { error: lError } = await supabase.from('legs').insert(legsToInsert);
      if (lError) throw lError;

      toast.success('Análise salva com sucesso!');
      navigate(`/analysis/${analysis.id}`);
    } catch (err: any) {
      toast.error('Erro ao salvar: ' + (err.message || 'Tente novamente'));
    } finally { setSaving(false); }
  };

  return (
    <div className="min-h-screen bg-background pb-16">
      <Header />
      <main className="container py-6 space-y-6 animate-fade-in">
        
        {/* Upgrade Banner for Free Users */}
        {access.planType === 'free' && (
          <Card className="border-primary/40 bg-primary/5 overflow-hidden">
            <CardContent className="py-4 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center text-primary">
                  <Crown className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-bold">Você está no Plano Free ({access.simulationCount}/3 simulações)</p>
                  <p className="text-xs text-muted-foreground">Assine o PRO para simulações ilimitadas, IA e OCR.</p>
                </div>
              </div>
              <Button size="sm" className="font-bold" onClick={() => navigate('/settings')}>FAZER UPGRADE</Button>
            </CardContent>
          </Card>
        )}

        <ProfessionalHeader
          title="Nova Análise"
          subtitle="Monte sua estrutura de opções e analise os riscos em tempo real"
          badge={
            <div className="flex gap-2">
              {access.planType === 'pro' && <Badge className="bg-primary text-primary-foreground font-black">PRO</Badge>}
              {metrics.strategyLabel && (
                <Badge className="bg-primary/20 text-primary border-primary/30 text-xs font-semibold">{metrics.strategyLabel}</Badge>
              )}
            </div>
          }
        />
        
        <div className="flex gap-3 flex-wrap">
          <Button 
            onClick={getAISuggestion} 
            disabled={loadingAI || legs.length === 0 || access.planType === 'free'} 
            className="text-base h-11 px-6 shadow-[0_0_30px_-8px_hsl(var(--primary)/0.4)]"
          >
            {loadingAI ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Sparkles className="mr-2 h-5 w-5" />}
            Sugestão IA {access.planType === 'free' && <Lock className="ml-2 h-3 w-3" />}
          </Button>
          <Button 
            onClick={saveAnalysis} 
            disabled={saving || legs.length === 0 || isFreeLimitReached}
            variant="outline"
            className="text-base h-11 px-6"
          >
            {saving ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Save className="mr-2 h-5 w-5" />}
            Salvar Análise {isFreeLimitReached && <Lock className="ml-2 h-3 w-3" />}
          </Button>
        </div>

        {isFreeLimitReached && (
          <div className="p-6 rounded-2xl border-2 border-dashed border-primary/40 bg-primary/5 text-center space-y-3">
            <Lock className="h-8 w-8 mx-auto text-primary" />
            <h3 className="text-lg font-bold">Limite de Simulações Atingido</h3>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">Você já utilizou suas 3 simulações gratuitas. Assine o plano PRO para continuar analisando estruturas ilimitadas.</p>
            <Button onClick={() => navigate('/settings')}>Ver Planos PRO</Button>
          </div>
        )}

        {!isFreeLimitReached && (
          <>
            <div className="space-y-2">
              <Label className="flex items-center gap-2">Nome da análise</Label>
              <Input 
                value={analysisName} 
                onChange={e => {
                  setAnalysisName(e.target.value);
                  setHasManuallyNamed(true);
                }} 
                placeholder="Ex: Trava de alta PETR4" 
                className="max-w-md font-bold" 
              />
            </div>

            {inputMode === null ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <button 
                  onClick={() => setInputMode('image')} 
                  className="group relative overflow-hidden rounded-2xl border-2 border-primary/40 bg-gradient-to-br from-primary/10 via-card to-card p-8 text-left transition-all duration-500 hover:border-primary hover:shadow-[0_0_60px_-12px_hsl(var(--primary)/0.5)] hover:-translate-y-1.5"
                >
                  <div className="relative space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-[0_0_20px_-5px_hsl(var(--primary))]">
                        <Camera className="h-8 w-8" />
                      </div>
                      <div>
                        <Badge className="bg-primary text-primary-foreground text-[10px] font-black mb-1 px-2">PRO FEATURE</Badge>
                        <h3 className="text-2xl font-black tracking-tight">Upload de Imagem</h3>
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground font-medium leading-relaxed">
                      Tire um print da sua corretora e nossa IA avançada extrairá automaticamente todas as pernas.
                    </p>
                  </div>
                </button>

                <button 
                  onClick={() => setInputMode('manual')} 
                  className="group relative overflow-hidden rounded-2xl border-2 border-dashed border-muted-foreground/30 bg-card p-8 text-left transition-all duration-300 hover:border-muted-foreground/60 hover:bg-muted/30 hover:-translate-y-1"
                >
                  <div className="relative space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
                        <Keyboard className="h-8 w-8" />
                      </div>
                      <div>
                        <Badge variant="outline" className="text-[10px] font-bold mb-1">PRECISO</Badge>
                        <h3 className="text-2xl font-black tracking-tight">Entrada Manual</h3>
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground font-medium leading-relaxed">
                      Insira manualmente cada perna da sua operação para ter controle total.
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
                {inputMode === 'manual' ? <Card className="border-border/40 bg-card/50 backdrop-blur-sm"><CardContent className="pt-6"><LegForm onAdd={addLeg} /></CardContent></Card> : <ImageUpload onLegsExtracted={handleLegsFromImage} onImageChange={() => setLegs([])} />}
              </div>
            )}

            <LegsTable legs={legs} onRemove={removeLeg} onUpdate={updateLeg} />

            {legs.length > 0 && (
              <>
                <SectionDivider title="Análise de IA" />
                <AIInsights analysis={aiAnalysis} loading={loadingAI} />
                
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
                    />
                  </CardContent>
                </Card>
                <CDIComparison metrics={metrics} cdiRate={cdiRate} setCdiRate={setCdiRate} daysToExpiry={daysToExpiry} setDaysToExpiry={setDaysToExpiry} />
              </>
            )}
          </>
        )}
      </main>
    </div>
  );
}