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
import { Loader2, Lock, Mail, LogOut, Shield, CheckCircle2, Crown, CreditCard, Sparkles, Zap, Camera, Bot, History, Briefcase, MessageSquare, ExternalLink, Radio } from 'lucide-react';
import { useAccessControl } from '@/hooks/useAccessControl';

export default function Settings() {
  const { user, loading: authLoading, signOut } = useAuth();
  const access = useAccessControl();
  const navigate = useNavigate();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [upgrading, setUpgrading] = useState(false);
  const [proPrice, setProPrice] = useState(19.90);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  useEffect(() => {
    const fetchPrice = async () => {
      try {
        const { data } = await (supabase
          .from('site_settings' as any)
          .select('*')
          .eq('id', 'pro_plan')
          .maybeSingle() as any);
        
        if (data && (data as any).value?.price) {
          setProPrice(Number((data as any).value.price));
        }
      } catch (e) {
        console.log("Usando preço padrão");
      }
    };
    fetchPrice();

    const params = new URLSearchParams(window.location.search);
    if (params.get('payment') === 'success') {
      toast.success("Pagamento aprovado!", { description: "Seu plano PRO será liberado em instantes." });
    } else if (params.get('payment') === 'failure') {
      toast.error("Pagamento não concluído", { description: "Houve um problema com a transação." });
    } else if (params.get('upgrade') === 'true') {
      // Auto-trigger checkout when coming from email CTA
      handleUpgrade();
      window.history.replaceState({}, '', '/settings');
    }
  }, []);

  const handleUpgrade = async () => {
    setUpgrading(true);
    try {
      const { data, error } = await supabase.functions.invoke('mercado-pago-checkout');
      
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
    { icon: Zap, title: "Simulações ILIMITADAS", desc: "Analise quantas estruturas quiser sem restrições." },
    { icon: Camera, title: "OCR de Imagem (IA)", desc: "Transforme prints da corretora em payoff instantâneo." },
    { icon: Bot, title: "Análise Profunda com IA", desc: "Relatórios quantitativos e vereditos profissionais." },
    { icon: Briefcase, title: "Portfólio e P&L", desc: "Acompanhe o lucro real de todas as suas operações." },
    { icon: History, title: "Histórico Completo", desc: "Salve e revise suas estratégias a qualquer momento." },
    { icon: Radio, title: "Estrutura em Tempo Real", desc: "Conexão direta ao Profit RTD — acompanhe preços ao vivo." },
    { icon: Shield, title: "Suporte Prioritário", desc: "Atendimento exclusivo para assinantes PRO." },
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
              <div className="p-6 rounded-2xl bg-primary/5 border border-primary/20 space-y-4">
                <div className="flex items-center gap-3">
                  <Sparkles className="h-6 w-6 text-primary" />
                  <h3 className="text-lg font-black">Upgrade para PRO</h3>
                </div>
                <p className="text-sm text-muted-foreground font-medium">
                  Libere o poder total da plataforma e opere como um profissional por apenas <strong>R$ {proPrice.toFixed(2)}/mês</strong>.
                </p>
                <Button onClick={() => setShowUpgradeModal(true)} className="w-full h-12 font-black shadow-lg shadow-primary/30">
                  <Zap className="mr-2 h-5 w-5" /> VER BENEFÍCIOS E ASSINAR
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <Dialog open={showUpgradeModal} onOpenChange={setShowUpgradeModal}>
          <DialogContent className="sm:max-w-[500px] p-0 overflow-hidden border-2 border-[hsl(190,90%,50%)]/30 bg-[hsl(222,47%,11%)] shadow-[0_0_40px_hsl(190,90%,50%,0.15)]">
            <div className="flex flex-col items-center pt-8 pb-4 px-6">
              <Crown className="h-12 w-12 text-[hsl(190,90%,50%)] mb-4" />
              <DialogHeader className="text-center">
                <DialogTitle className="text-2xl font-black tracking-tight text-white">
                  {access.trialExpired ? 'Renovar Plano PRO' : 'TORNE-SE PRO X'}
                </DialogTitle>
                <DialogDescription className="text-[hsl(190,90%,50%)] font-black text-3xl tracking-tighter mt-2">
                  R$ {proPrice.toFixed(2).replace('.', ',')}<span className="text-base font-medium text-[hsl(220,15%,60%)]">/mês</span>
                </DialogDescription>
              </DialogHeader>
            </div>
            <div className="px-6 pb-6 space-y-5">
              <div className="space-y-3">
                {proFeatures.map((f, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <CheckCircle2 className="h-5 w-5 text-[hsl(190,90%,50%)] shrink-0" />
                    <span className="text-sm font-bold text-[hsl(220,15%,85%)]">{f.title}</span>
                  </div>
                ))}
              </div>
              
              <Button 
                onClick={handleUpgrade} 
                disabled={upgrading} 
                className="w-full h-14 text-lg font-black bg-[hsl(190,90%,50%)] hover:bg-[hsl(190,90%,45%)] text-[hsl(222,47%,11%)] shadow-[0_0_20px_hsl(190,90%,50%,0.4)] rounded-xl"
              >
                {upgrading ? <Loader2 className="mr-2 h-6 w-6 animate-spin" /> : <Crown className="mr-2 h-6 w-6" />}
                Assinar Agora
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
                  onClick={() => window.location.href = 'mailto:falecomopcoesprox@gmail.com?subject=Suporte OpçõesX'}
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

        <Button onClick={async () => { await signOut(); navigate('/auth'); }} variant="destructive" className="w-full h-12 font-black">
          <LogOut className="mr-2 h-5 w-5" /> DESCONECTAR
        </Button>
      </main>
    </div>
  );
}