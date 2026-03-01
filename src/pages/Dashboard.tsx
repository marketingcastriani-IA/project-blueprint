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
import { Save, Sparkles, Loader2, Camera, Keyboard, Wand2, Wallet, TrendingUp, TrendingDown, Lock, Rocket } from 'lucide-react';
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
  
  // Dados do Plano
  const [userPlan, setUserPlan] = useState<{ plan_type: string; simulations_count: number }>({ plan_type: 'free', simulations_count: 0 });

  useEffect(() => {
    if (!user) return;
    supabase.from('user_access').select('plan_type, simulations_count').eq('user_id', user.id).single()
      .then(({ data }) => data && setUserPlan(data as any));
  }, [user]);

  const isLimitReached = userPlan.plan_type === 'free' && userPlan.simulations_count >= 3;

  const metrics = useMemo(() => calculateMetrics(legs), [legs]);
  const payoffData = useMemo(() => generatePayoffCurve(legs, daysToExpiry, cdiRate), [legs, daysToExpiry, cdiRate]);

  const addLeg = useCallback((leg: Leg) => { setLegs(prev => [...prev, leg]); }, []);
  const removeLeg = useCallback((index: number) => { setLegs(prev => prev.filter((_, i) => i !== index)); }, []);
  const updateLeg = useCallback((index: number, leg: Leg) => { setLegs(prev => prev.map((item, i) => (i === index ? leg : item))); }, []);
  
  const handleLegsFromImage = useCallback((extractedLegs: any[]) => { 
    if (isLimitReached) {
      toast.error("Limite de simulações atingido!", { description: "Assine o plano PRO para usar o OCR ilimitado." });
      return;
    }
    setLegs(extractedLegs.map(l => ({ ...l, asset: String(l.asset || '').toUpperCase(), quantity: Math.max(1, Number(l.quantity) || 1) }))); 
    setInputMode('manual');
  }, [isLimitReached]);

  const getAISuggestion = async () => {
    if (isLimitReached) {
      toast.error("Limite atingido!", { description: "Assine o PRO para análises ilimitadas." });
      return;
    }
    setLoadingAI(true);
    try {
      const { data, error } = await supabase.functions.invoke('analyze-structure', { body: { legs, metrics, cdiRate, daysToExpiry } });
      if (error) throw error;
      setAiAnalysis(data);
    } catch (err: any) { toast.error('Erro na IA'); } finally { setLoadingAI(false); }
  };

  const saveAnalysis = async () => {
    if (isLimitReached) {
      toast.error("Limite atingido!", { description: "Assine o PRO para salvar mais análises." });
      return;
    }
    setSaving(true);
    try {
      const { data: analysis, error: aError } = await supabase.from('analyses').insert({
        user_id: user!.id, name: analysisName || 'Nova Análise', underlying_asset: legs[0]?.asset || null,
        cdi_rate: cdiRate, days_to_expiry: daysToExpiry, ai_suggestion: aiAnalysis ? JSON.stringify(aiAnalysis) : null
      }).select().single();
      if (aError) throw aError;

      await supabase.from('legs').insert(legs.map(l => ({ ...l, analysis_id: analysis.id })));
      
      // Incrementa contador
      await supabase.from('user_access').update({ simulations_count: userPlan.simulations_count + 1 } as any).eq('user_id', user!.id);
      setUserPlan(p => ({ ...p, simulations_count: p.simulations_count + 1 }));

      toast.success('Análise salva!');
      navigate(`/analysis/${analysis.id}`);
    } catch (err: any) { toast.error('Erro ao salvar'); } finally { setSaving(false); }
  };

  if (authLoading || access.status === 'loading') return null;
  if (!user) return <Navigate to="/auth" replace />;

  return (
    <div className="min-h-screen bg-background pb-16">
      <Header />
      <main className="container py-6 space-y-6 animate-fade-in">
        {/* Banner de Plano */}
        <Card className={cn(
          "border-2 transition-all",
          userPlan.plan_type === 'pro' ? "border-primary/30 bg-primary/5" : "border-warning/30 bg-warning/5"
        )}>
          <CardContent className="py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              {userPlan.plan_type === 'pro' ? <Rocket className="text-primary h-5 w-5" /> : <Lock className="text-warning h-5 w-5" />}
              <div>
                <p className="text-xs font-black uppercase tracking-widest">Plano {userPlan.plan_type.toUpperCase()}</p>
                <p className="text-[10px] text-muted-foreground">
                  {userPlan.plan_type === 'free' 
                    ? `Você usou ${userPlan.simulations_count}/3 simulações gratuitas.` 
                    : "Acesso PRO ilimitado ativado."}
                </p>
              </div>
            </div>
            {userPlan.plan_type === 'free' && (
              <Button size="sm" className="h-8 bg-primary font-bold text-[10px]" onClick={() => navigate('/settings')}>UPGRADE PRO</Button>
            )}
          </CardContent>
        </Card>

        <ProfessionalHeader title="Nova Análise" subtitle="Monte sua estratégia e valide com IA" />
        
        <div className="flex gap-3 flex-wrap">
          <Button onClick={getAISuggestion} disabled={loadingAI || legs.length === 0 || isLimitReached} className="h-11 px-6 shadow-lg shadow-primary/20">
            {loadingAI ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Sparkles className="mr-2 h-5 w-5" />} Sugestão IA
          </Button>
          <Button onClick={saveAnalysis} disabled={saving || legs.length === 0 || isLimitReached} variant="outline" className="h-11 px-6">
            {saving ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Save className="mr-2 h-5 w-5" />} Salvar Análise
          </Button>
        </div>

        {isLimitReached && (
          <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-center space-y-2">
            <p className="font-bold">Limite de Simulações Atingido!</p>
            <p className="text-xs">Você já realizou as 3 simulações gratuitas. Assine o plano PRO para continuar.</p>
            <Button variant="destructive" size="sm" onClick={() => navigate('/settings')}>ASSINAR PRO AGORA</Button>
          </div>
        )}

        {/* Resto do Dashboard... */}
        <div className="space-y-2">
          <Label>Nome da análise</Label>
          <Input value={analysisName} onChange={e => setAnalysisName(e.target.value)} placeholder="Ex: Trava de alta PETR4" className="max-w-md font-bold" />
        </div>

        {inputMode === null ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <button onClick={() => setInputMode('image')} className="group rounded-2xl border-2 border-primary/40 bg-primary/5 p-8 text-left hover:border-primary transition-all">
              <Camera className="h-10 w-10 text-primary mb-4" />
              <h3 className="text-xl font-black">Upload de Imagem</h3>
              <p className="text-sm text-muted-foreground">Extração automática via IA.</p>
            </button>
            <button onClick={() => setInputMode('manual')} className="group rounded-2xl border-2 border-dashed border-muted-foreground/30 p-8 text-left hover:border-muted-foreground transition-all">
              <Keyboard className="h-10 w-10 text-muted-foreground mb-4" />
              <h3 className="text-xl font-black">Entrada Manual</h3>
              <p className="text-sm text-muted-foreground">Controle total dos dados.</p>
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {inputMode === 'manual' ? <Card><CardContent className="pt-6"><LegForm onAdd={addLeg} /></CardContent></Card> : <ImageUpload onLegsExtracted={handleLegsFromImage} onImageChange={() => setLegs([])} />}
          </div>
        )}

        <LegsTable legs={legs} onRemove={removeLeg} onUpdate={updateLeg} />
        {legs.length > 0 && (
          <>
            <AIInsights analysis={aiAnalysis} loading={loadingAI} />
            <MetricsCards metrics={metrics} />
            <PayoffChart data={payoffData} breakevens={metrics.breakevens} />
            <CDIComparison metrics={metrics} cdiRate={cdiRate} setCdiRate={setCdiRate} daysToExpiry={daysToExpiry} setDaysToExpiry={setDaysToExpiry} />
          </>
        )}
      </main>
    </div>
  );
}