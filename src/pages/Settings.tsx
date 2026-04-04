import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { Navigate, useNavigate } from 'react-router-dom';
import Header from '@/components/Header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, Lock, Mail, LogOut, Shield, CheckCircle2, Crown, CreditCard, Sparkles, Zap, Camera, Bot, History, Briefcase, MessageSquare, ExternalLink, Radio, ArrowRight, AlertTriangle, RotateCcw } from 'lucide-react';
import { useAccessControl } from '@/hooks/useAccessControl';
import { useProPrice } from '@/hooks/useProPrice';
import { resetOnboardingTour } from '@/components/OnboardingTour';

export default function Settings() {
  const { user, loading: authLoading, signOut } = useAuth();
  const access = useAccessControl();
  const navigate = useNavigate();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [upgrading, setUpgrading] = useState(false);
  const { proPrice, annualPrice, monthlyEquivalent } = useProPrice();
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [planPeriod, setPlanPeriod] = useState<'monthly' | 'yearly'>('monthly');

  const [showPaymentSuccess, setShowPaymentSuccess] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('payment') === 'success') {
      setShowPaymentSuccess(true);
      window.history.replaceState({}, '', '/settings');
    } else if (params.get('payment') === 'failure') {
      toast.error("Pagamento não concluído", { description: "Houve um problema com a transação." });
      window.history.replaceState({}, '', '/settings');
    } else if (params.get('upgrade') === 'true') {
      handleUpgrade();
      window.history.replaceState({}, '', '/settings');
    }
  }, []);

  const handleUpgrade = async () => {
    setUpgrading(true);
    try {
      const { data, error } = await supabase.functions.invoke('mercado-pago-checkout', {
        body: { plan_period: planPeriod }
      });
      
      if (error) {
        // Tenta extrair a mensagem de erro do corpo da resposta se disponível
        let errorMsg = "Erro ao processar pagamento";
        try {
          const errorData = await error.context?.json();
          errorMsg = errorData?.error || error.message || errorMsg;
        } catch (e) {
          errorMsg = error.message || errorMsg;
        }
        toast.error("Falha no Checkout", { description: errorMsg });
        return;
      }

      if (data?.url) {
        window.location.href = data.url;
      } else {
        toast.error("Erro ao gerar link de pagamento", { description: "A resposta do servidor foi inválida." });
      }
    } catch (err: any) {
      console.error("[Settings] Erro no upgrade:", err);
      toast.error("Erro de Conexão", { description: "Não foi possível iniciar o checkout. Verifique sua internet." });
    } finally {
      setUpgrading(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast.error('As senhas não conferem');
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      toast.success('Senha alterada com sucesso!');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      toast.error('Erro ao alterar senha');
    } finally {
      setLoading(false);
    }
  };

  if (authLoading) return null;
  if (!user) return <Navigate to="/auth" replace />;

  const proFeatures = [
    { icon: Zap, title: "Simulações ILIMITADAS" },
    { icon: Camera, title: "OCR de Imagem (IA)" },
    { icon: Bot, title: "Análise Profunda com IA" },
    { icon: Briefcase, title: "Portfólio e P&L" },
    { icon: History, title: "Histórico Completo" },
    { icon: Radio, title: "Tempo Real com Profit RTD" },
    { icon: Crown, title: "Rastreadores Box & Collar" },
    { icon: Crown, title: "Calculadora CDI x Opções" },
    { icon: Crown, title: "Diversificador de Carteira" },
    { icon: Shield, title: "Suporte Prioritário" },
  ];

  return (
    <div className="min-h-screen bg-background pb-16">
      <Header />
      <main className="container py-6 space-y-6 animate-fade-in">
        <div className="space-y-2">
          <h1 className="text-4xl sm:text-5xl font-black tracking-tight">Configurações</h1>
          <p className="text-lg text-muted-foreground">Gerencie sua conta e plano</p>
        </div>

        <Card className={cn(
          "border-2 overflow-hidden",
          access.planType === 'pro' ? "border-primary bg-primary/5" : "border-border/40 bg-card"
        )}>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Crown className={cn("h-5 w-5", access.planType === 'pro' ? "text-primary" : "text-muted-foreground")} />
              Seu Plano: {access.planType.toUpperCase()}
            </CardTitle>
            {access.planType === 'pro' && <Badge className="bg-primary font-black">ATIVO</Badge>}
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="p-4 rounded-xl bg-muted/30 border border-border/50">
                <p className="text-[10px] font-black uppercase text-muted-foreground mb-1">Simulações Realizadas</p>
                <p className="text-2xl font-black">{access.simulationsCount}</p>
              </div>
              <div className="p-4 rounded-xl bg-muted/30 border border-border/50">
                <p className="text-[10px] font-black uppercase text-muted-foreground mb-1">Status da Assinatura</p>
                <p className="text-2xl font-black">{access.planType === 'pro' ? 'PRO' : 'FREE'}</p>
                {access.planType === 'free' && access.daysRemaining !== null && (
                  <p className={cn("text-sm font-bold mt-1", access.daysRemaining <= 2 ? "text-destructive" : "text-warning")}>
                    {access.daysRemaining > 0 ? `${access.daysRemaining} dias restantes` : 'Período gratuito expirado'}
                  </p>
                )}
              </div>
            </div>

            {access.planType === 'free' && (
              <div className="p-6 rounded-2xl border-2 border-primary/40 bg-gradient-to-br from-primary/10 to-primary/5 space-y-5 shadow-[0_0_40px_-10px_hsl(var(--primary)/0.3)]">
                <div className="flex items-center gap-3">
                  <Crown className="h-8 w-8 text-primary animate-pulse" />
                  <div>
                    <h3 className="text-xl font-black text-foreground">Assine a versão PRO</h3>
                  </div>
                </div>

                {/* Monthly/Yearly toggle */}
                <div className="flex items-center justify-center gap-1 p-1 rounded-xl bg-muted/50 border border-border/50">
                  <button
                    onClick={() => setPlanPeriod('monthly')}
                    className={cn(
                      "flex-1 py-2 px-4 rounded-lg text-sm font-black transition-all",
                      planPeriod === 'monthly' ? "bg-primary text-primary-foreground shadow-lg" : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    Mensal
                  </button>
                  <button
                    onClick={() => setPlanPeriod('yearly')}
                    className={cn(
                      "flex-1 py-2 px-4 rounded-lg text-sm font-black transition-all relative",
                      planPeriod === 'yearly' ? "bg-primary text-primary-foreground shadow-lg" : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    Anual
                    <Badge className="absolute -top-2 -right-2 bg-success text-success-foreground text-[9px] font-black px-1.5 py-0.5">-20%</Badge>
                  </button>
                </div>

                <div className="text-center">
                  {planPeriod === 'monthly' ? (
                    <p className="text-primary font-black text-2xl">
                      R$ {proPrice.toFixed(2).replace('.', ',')}<span className="text-sm font-medium text-muted-foreground">/mês</span>
                    </p>
                  ) : (
                    <div className="space-y-1">
                      <p className="text-muted-foreground text-sm line-through">R$ {(proPrice * 12).toFixed(2).replace('.', ',')}/ano</p>
                      <p className="text-primary font-black text-2xl">
                        R$ {annualPrice.toFixed(2).replace('.', ',')}<span className="text-sm font-medium text-muted-foreground">/ano</span>
                      </p>
                      <p className="text-xs text-success font-bold">≈ R$ {monthlyEquivalent.toFixed(2).replace('.', ',')}/mês — economize 20%</p>
                    </div>
                  )}
                </div>

                {access.daysRemaining !== null && access.daysRemaining > 0 && (
                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-warning/10 border border-warning/30">
                    <AlertTriangle className="h-4 w-4 text-warning shrink-0" />
                    <span className="text-sm font-bold text-warning">
                      Seu trial expira em {access.daysRemaining} dia{access.daysRemaining !== 1 ? 's' : ''}! Assine para não perder acesso.
                    </span>
                  </div>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {proFeatures.map((f, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                      <span className="text-sm font-bold text-foreground">{f.title}</span>
                    </div>
                  ))}
                </div>
                <Button 
                  onClick={handleUpgrade} 
                  disabled={upgrading}
                  className="w-full h-14 text-lg font-black shadow-lg shadow-primary/30 rounded-xl animate-pulse hover:animate-none"
                >
                  {upgrading ? <Loader2 className="mr-2 h-6 w-6 animate-spin" /> : <Crown className="mr-2 h-6 w-6" />}
                  {planPeriod === 'yearly' ? 'ASSINAR PRO ANUAL' : 'ASSINAR PRO AGORA'}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <Dialog open={showUpgradeModal} onOpenChange={setShowUpgradeModal}>
          <DialogContent className="sm:max-w-[500px] p-0 overflow-hidden border-2 border-primary/30 bg-card shadow-[0_0_40px_hsl(var(--primary)/0.15)]">
            <div className="flex flex-col items-center pt-8 pb-4 px-6">
              <Crown className="h-12 w-12 text-primary mb-4" />
              <DialogHeader className="text-center">
                <DialogTitle className="text-2xl font-black tracking-tight text-foreground">
                  {access.trialExpired ? 'Renovar Plano PRO' : 'TORNE-SE PRO X'}
                </DialogTitle>
                <DialogDescription className="text-primary font-black text-3xl tracking-tighter mt-2">
                  R$ {proPrice.toFixed(2).replace('.', ',')}<span className="text-base font-medium text-muted-foreground">/mês</span>
                </DialogDescription>
              </DialogHeader>
            </div>
            <div className="px-6 pb-6 space-y-5">
              <div className="space-y-3">
                {proFeatures.map((f, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <CheckCircle2 className="h-5 w-5 text-primary shrink-0" />
                    <span className="text-sm font-bold text-foreground">{f.title}</span>
                  </div>
                ))}
              </div>
              
              <Button 
                onClick={handleUpgrade} 
                disabled={upgrading} 
                className="w-full h-14 text-lg font-black shadow-lg shadow-primary/30 rounded-xl"
              >
                {upgrading ? <Loader2 className="mr-2 h-6 w-6 animate-spin" /> : <Crown className="mr-2 h-6 w-6" />}
                Assinar Agora
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Payment Success Celebration */}
        <Dialog open={showPaymentSuccess} onOpenChange={setShowPaymentSuccess}>
          <DialogContent className="sm:max-w-[450px] text-center border-2 border-primary/30">
            <div className="flex flex-col items-center py-6 space-y-5">
              <div className="h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center">
                <Crown className="h-10 w-10 text-primary" />
              </div>
              <DialogHeader className="text-center">
                <DialogTitle className="text-2xl font-black tracking-tight">🎉 Pagamento Aprovado!</DialogTitle>
                <DialogDescription className="text-base mt-2">
                  Seu plano <strong className="text-primary">PRO</strong> será ativado em instantes. Aproveite todas as funcionalidades!
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3 w-full px-4">
                <div className="flex items-center gap-3 text-sm">
                  <CheckCircle2 className="h-5 w-5 text-primary shrink-0" />
                  <span className="font-bold text-foreground">Simulações ilimitadas com IA</span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <CheckCircle2 className="h-5 w-5 text-primary shrink-0" />
                  <span className="font-bold text-foreground">Rastreadores ao vivo (Box & Collar)</span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <CheckCircle2 className="h-5 w-5 text-primary shrink-0" />
                  <span className="font-bold text-foreground">Tempo Real com Profit RTD</span>
                </div>
              </div>
              <Button 
                className="w-full h-12 font-black shadow-lg shadow-primary/30"
                onClick={() => { setShowPaymentSuccess(false); navigate('/dashboard'); }}
              >
                IR PARA O DASHBOARD <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Seção de Suporte e Contato */}
        <Card className="border-2 border-info/30 bg-info/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-info">
              <MessageSquare className="h-5 w-5" />
              Suporte e Ajuda
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <p className="text-sm font-medium">
                Dúvidas sobre o sistema, problemas com pagamento ou sugestões? Nossa equipe está pronta para ajudar.
              </p>
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 pt-2">
                <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-card border border-info/20 flex-1 w-full">
                  <Mail className="h-4 w-4 text-info" />
                  <span className="text-sm font-bold font-mono">falecomopcoesprox@gmail.com</span>
                </div>
                <Button 
                  variant="outline" 
                  className="border-info/40 text-info hover:bg-info/10 font-bold w-full sm:w-auto"
                  onClick={() => window.location.href = 'mailto:falecomopcoesprox@gmail.com?subject=Suporte Opções PRO X'}
                >
                  ABRIR CHAMADO <ExternalLink className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </div>
            <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">
              Tempo médio de resposta: 24 horas úteis.
            </p>
          </CardContent>
        </Card>

        <Card className="border-2 border-border/40 bg-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5 text-primary" />
              Informações da Conta
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Email</Label>
              <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-muted/50 border border-muted-foreground/20">
                <p className="text-sm font-medium flex-1">{user?.email}</p>
                <Badge className="bg-success/20 text-success border-success/30 text-xs">Verificado</Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-2 border-border/40 bg-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5 text-warning" />
              Alterar Senha
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleChangePassword} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="new-password">Nova Senha</Label>
                <Input
                  id="new-password"
                  type="password"
                  placeholder="Mínimo 6 caracteres"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  disabled={loading}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-password">Confirmar Senha</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  placeholder="Confirme a nova senha"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  disabled={loading}
                />
              </div>
              <Button type="submit" disabled={loading} className="w-full">
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Shield className="mr-2 h-4 w-4" />}
                Alterar Senha
              </Button>
            </form>
          </CardContent>
        </Card>

        <div className="flex flex-col sm:flex-row gap-3">
          <Button 
            variant="outline" 
            onClick={() => { resetOnboardingTour(); toast.success('Tour reiniciado! Volte ao Dashboard para revê-lo.'); }}
            className="flex-1 h-12 font-bold"
          >
            <RotateCcw className="mr-2 h-4 w-4" /> Reiniciar Tour Guiado
          </Button>
          <Button onClick={async () => { await signOut(); navigate('/auth'); }} variant="destructive" className="flex-1 h-12 font-black">
            <LogOut className="mr-2 h-5 w-5" /> DESCONECTAR
          </Button>
        </div>
      </main>
    </div>
  );
}