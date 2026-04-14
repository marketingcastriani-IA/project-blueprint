import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Clock, XCircle, AlertTriangle, LogOut, Crown, Loader2, CheckCircle2, Zap, Camera, Bot, History, Briefcase, Shield, Radio, Calculator, PieChart, Database, Bell, BarChart3, BookOpen } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useProPrice } from '@/hooks/useProPrice';
import { cn } from '@/lib/utils';

interface AccessBlockedProps {
  status: 'pending' | 'rejected' | 'expired';
}

export default function AccessBlocked({ status }: AccessBlockedProps) {
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const [upgrading, setUpgrading] = useState(false);
  const { proPrice, annualPrice, monthlyEquivalent, annualDiscountPercent } = useProPrice();
  const [planPeriod, setPlanPeriod] = useState<'monthly' | 'yearly'>('monthly');

  const handleUpgrade = async () => {
    setUpgrading(true);
    try {
      const { data, error } = await supabase.functions.invoke('mercado-pago-checkout', {
        body: { plan_period: planPeriod }
      });
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
    { icon: Zap, label: 'Simulações ILIMITADAS' },
    { icon: BarChart3, label: 'Gráfico de Payoff completo' },
    { icon: PieChart, label: 'Comparativo vs CDI' },
    { icon: Bot, label: 'Análise com Inteligência Artificial' },
    { icon: Camera, label: 'OCR de Imagem (IA)' },
    { icon: Briefcase, label: 'Portfólio e P&L consolidado' },
    { icon: History, label: 'Histórico de análises' },
    { icon: Radio, label: 'Tempo Real — Conexão Profit RTD *' },
    { icon: Shield, label: 'Rastreador Box × CDI' },
    { icon: Shield, label: 'Rastreador Collar — Proteção + Renda' },
    { icon: Database, label: 'Ticker Opções B3 — 99k+ opções' },
    { icon: Calculator, label: 'Calculadora CDI × Opções' },
    { icon: Bell, label: 'Alertas na Tela (Box Tracker)' },
    { icon: BookOpen, label: 'Rastreador PRO X — 12 Estratégias' },
    { icon: PieChart, label: 'Diversificador de carteira' },
    { icon: Crown, label: 'Suporte prioritário' },
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
                  <Badge className="absolute -top-2 -right-2 bg-success text-success-foreground text-xs font-black px-1.5 py-0.5">-{annualDiscountPercent}%</Badge>
                </button>
              </div>

              <div className="text-center">
                {planPeriod === 'monthly' ? (
                  <p className="text-3xl font-black text-primary">
                    R$ {proPrice.toFixed(2).replace('.', ',')}
                    <span className="text-sm font-normal text-muted-foreground">/mês</span>
                  </p>
                ) : (
                  <div className="space-y-1">
                    <p className="text-muted-foreground text-sm line-through">R$ {(proPrice * 12).toFixed(2).replace('.', ',')}/ano</p>
                    <p className="text-3xl font-black text-primary">
                      R$ {annualPrice.toFixed(2).replace('.', ',')}
                      <span className="text-sm font-normal text-muted-foreground">/ano</span>
                    </p>
                    <p className="text-xs text-success font-bold">≈ R$ {monthlyEquivalent.toFixed(2).replace('.', ',')}/mês</p>
                  </div>
                )}
              </div>

              <ul className="space-y-2">
                {proFeatures.map((f, i) => (
                  <li key={i} className="flex items-center gap-3 text-sm">
                    <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                    <span>{f.label}</span>
                  </li>
                ))}
              </ul>
              <p className="text-xs text-muted-foreground">
                * Tempo Real, Rastreador de Box e alertas necessitam do <strong className="text-foreground">Profit Pro (Nelogica)</strong> para conexão via RTD.
              </p>

              <Button
                onClick={handleUpgrade}
                disabled={upgrading}
                className="w-full py-6 text-base font-bold bg-primary hover:bg-primary/90 shadow-[0_0_30px_-8px_hsl(var(--primary)/0.5)]"
              >
                {upgrading ? (
                  <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Processando...</>
                ) : (
                  <><Crown className="mr-2 h-5 w-5" /> {planPeriod === 'yearly' ? 'Assinar Plano Anual' : 'Assinar Agora'}</>
                )}
              </Button>
            </CardContent>
          </Card>
        )}

        <div className="text-center">
          <Button variant="ghost" onClick={async () => { await signOut(); navigate('/auth'); }} className="text-sm">
            <LogOut className="mr-2 h-4 w-4" />
            Sair da conta
          </Button>
        </div>
      </div>
    </div>
  );
}
