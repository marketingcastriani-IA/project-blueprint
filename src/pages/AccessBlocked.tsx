import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Clock, XCircle, AlertTriangle, LogOut, Crown, Loader2, CheckCircle2, Zap, Camera, Bot, History, Briefcase } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface AccessBlockedProps {
  status: 'pending' | 'rejected' | 'expired';
}

export default function AccessBlocked({ status }: AccessBlockedProps) {
  const { signOut } = useAuth();
  const [upgrading, setUpgrading] = useState(false);
  const [proPrice, setProPrice] = useState(19.90);

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
      } catch (e) {}
    };
    fetchPrice();
  }, []);

  const handleUpgrade = async () => {
    setUpgrading(true);
    try {
      const { data, error } = await supabase.functions.invoke('mercado-pago-checkout');
      if (error) {
        toast.error("Falha no Checkout", { description: error.message || "Erro ao processar pagamento" });
        return;
      }
      if (data?.url) {
        window.location.href = data.url;
      } else {
        toast.error("Erro ao gerar link de pagamento");
      }
    } catch (err: any) {
      toast.error("Erro de Conexão", { description: "Não foi possível iniciar o checkout." });
    } finally {
      setUpgrading(false);
    }
  };

  const content = {
    pending: {
      icon: <Clock className="h-16 w-16 text-warning" />,
      title: 'Acesso Pendente',
      description: 'Sua conta foi criada com sucesso! Aguarde a aprovação do administrador para acessar a plataforma.',
      color: 'border-warning/30',
    },
    rejected: {
      icon: <XCircle className="h-16 w-16 text-destructive" />,
      title: 'Acesso Negado',
      description: 'Seu acesso foi negado pelo administrador. Entre em contato para mais informações.',
      color: 'border-destructive/30',
    },
    expired: {
      icon: <AlertTriangle className="h-16 w-16 text-warning" />,
      title: 'Período Expirado',
      description: 'Seu período de acesso expirou. Renove agora para continuar usando a plataforma!',
      color: 'border-warning/30',
    },
  };

  const c = content[status];

  const proFeatures = [
    { icon: Bot, label: 'Análise por IA ilimitada' },
    { icon: Camera, label: 'OCR — Leitura de imagens' },
    { icon: History, label: 'Histórico completo' },
    { icon: Briefcase, label: 'Portfólio de operações' },
    { icon: Zap, label: 'Simulações ilimitadas' },
  ];

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <div className="flex justify-center mb-4">
            <img src="/assets/logo.png" alt="Opções PRO X" className="h-12 w-12 object-contain" />
          </div>
          <h1 className="text-xl font-bold">Opções PRO X</h1>
        </div>

        <Card className={`${c.color} bg-card/50 backdrop-blur-sm`}>
          <CardContent className="py-12 text-center space-y-4">
            <div className="flex justify-center">{c.icon}</div>
            <h2 className="text-xl font-bold">{c.title}</h2>
            <p className="text-sm text-muted-foreground leading-relaxed max-w-xs mx-auto">
              {c.description}
            </p>
          </CardContent>
        </Card>

        {status === 'expired' && (
          <Card className="border-primary/40 bg-gradient-to-br from-primary/10 to-card/80 backdrop-blur-sm">
            <CardContent className="py-8 space-y-6">
              <div className="text-center space-y-2">
                <Crown className="h-10 w-10 text-primary mx-auto" />
                <h3 className="text-lg font-bold">Renovar Plano PRO</h3>
                <p className="text-3xl font-black text-primary">
                  R$ {proPrice.toFixed(2).replace('.', ',')}
                  <span className="text-sm font-normal text-muted-foreground">/mês</span>
                </p>
              </div>

              <ul className="space-y-2">
                {proFeatures.map((f, i) => (
                  <li key={i} className="flex items-center gap-3 text-sm">
                    <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                    <span>{f.label}</span>
                  </li>
                ))}
              </ul>

              <Button
                onClick={handleUpgrade}
                disabled={upgrading}
                className="w-full py-6 text-base font-bold bg-primary hover:bg-primary/90 shadow-[0_0_30px_-8px_hsl(var(--primary)/0.5)]"
              >
                {upgrading ? (
                  <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Processando...</>
                ) : (
                  <><Crown className="mr-2 h-5 w-5" /> Assinar Agora</>
                )}
              </Button>
            </CardContent>
          </Card>
        )}

        <div className="text-center">
          <Button variant="ghost" onClick={signOut} className="text-sm">
            <LogOut className="mr-2 h-4 w-4" />
            Sair da conta
          </Button>
        </div>
      </div>
    </div>
  );
}
