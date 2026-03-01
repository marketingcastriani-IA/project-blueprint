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
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, Lock, Mail, LogOut, Shield, Database, CheckCircle2, XCircle, Crown, CreditCard, Sparkles } from 'lucide-react';
import { useAccessControl } from '@/hooks/useAccessControl';
import { cn } from '@/lib/utils';

export default function Settings() {
  const { user, loading: authLoading, signOut } = useAuth();
  const access = useAccessControl();
  const navigate = useNavigate();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [upgrading, setUpgrading] = useState(false);
  const [proPrice, setProPrice] = useState(19.90);

  useEffect(() => {
    const fetchPrice = async () => {
      try {
        const { data } = await supabase
          .from('site_settings')
          .select('*')
          .eq('id', 'pro_plan')
          .maybeSingle();
        
        if (data) {
          setProPrice((data.value as any).price);
        }
      } catch (e) {
        console.log("Preço padrão mantido");
      }
    };
    fetchPrice();

    const params = new URLSearchParams(window.location.search);
    if (params.get('payment') === 'success') {
      toast.success("Pagamento aprovado!", { description: "Seu plano PRO será liberado em instantes." });
    } else if (params.get('payment') === 'failure') {
      toast.error("Pagamento não concluído", { description: "Houve um problema com a transação." });
    }
  }, []);

  const handleUpgrade = async () => {
    setUpgrading(true);
    try {
      const { data, error } = await supabase.functions.invoke('mercado-pago-checkout');
      
      if (error) {
        // Tenta extrair a mensagem de erro do corpo da resposta se disponível
        const errorMsg = error instanceof Error ? error.message : "Erro na comunicação com o servidor";
        throw new Error(errorMsg);
      }
      
      if (data?.url) {
        window.location.href = data.url;
      } else if (data?.error) {
        toast.error("Erro no Checkout", { description: data.error });
      } else {
        toast.error("Erro inesperado", { description: "Não foi possível gerar o link de pagamento." });
      }
    } catch (err: any) {
      console.error("[Settings] Erro no upgrade:", err);
      toast.error("Falha ao iniciar checkout", { 
        description: "Verifique se o Token do Mercado Pago foi configurado corretamente nos Secrets do Supabase." 
      });
    } finally {
      setUpgrading(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword || !confirmPassword) {
      toast.error('Preencha todos os campos');
      return;
    }
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
      toast.error('Erro ao alterar senha', { description: err.message });
    } finally {
      setLoading(false);
    }
  };

  if (authLoading) return null;
  if (!user) return <Navigate to="/auth" replace />;

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
          access.planType === 'pro' ? "border-primary bg-gradient-to-br from-primary/10 to-card" : "border-border/40 bg-card"
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
                <p className="text-2xl font-black">{access.simulationsCount}{access.planType === 'free' && '/3'}</p>
              </div>
              <div className="p-4 rounded-xl bg-muted/30 border border-border/50">
                <p className="text-[10px] font-black uppercase text-muted-foreground mb-1">Status da Assinatura</p>
                <p className="text-2xl font-black">{access.planType === 'pro' ? 'Ilimitado' : 'Limitado'}</p>
              </div>
            </div>

            {access.planType === 'free' && (
              <div className="p-6 rounded-2xl bg-primary/5 border border-primary/20 space-y-4">
                <div className="flex items-center gap-3">
                  <Sparkles className="h-6 w-6 text-primary" />
                  <h3 className="text-lg font-black">Upgrade para PRO</h3>
                </div>
                <p className="text-sm text-muted-foreground font-medium">
                  Libere simulações ilimitadas, OCR de imagem, sugestões de IA e suporte prioritário por apenas <strong>R$ {proPrice.toFixed(2)}/mês</strong>.
                </p>
                <Button onClick={handleUpgrade} disabled={upgrading} className="w-full h-12 font-black shadow-lg shadow-primary/30">
                  {upgrading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <CreditCard className="mr-2 h-5 w-5" />}
                  ASSINAR VIA MERCADO PAGO
                </Button>
              </div>
            )}
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
                <p className="text-sm font-medium flex-1">{user.email}</p>
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

        <Button onClick={signOut} variant="destructive" className="w-full h-12 font-black">
          <LogOut className="mr-2 h-5 w-5" /> DESCONECTAR
        </Button>
      </main>
    </div>
  );
}