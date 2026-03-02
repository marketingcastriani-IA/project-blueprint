import { useAuth } from '@/contexts/AuthContext';
import { useNavigate, Navigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { 
  TrendingUp, ArrowRight, Brain, Target, CheckCircle2,
  Lock, Sparkles, Trophy, XCircle, AlertTriangle,
  Rocket, Star, Shield, Zap, Users, BarChart3,
  Clock, Eye, MousePointer2, ChevronRight, LayoutDashboard, Briefcase,
  Camera
} from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';
import { Sun, Moon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

// Mapeamento das imagens reais enviadas
const imgPayoff = "https://daiyrwxcsqvbbntzjdzy.supabase.co/storage/v1/object/public/assets/pasted-image-2026-03-02T00-00-14-760Z.png";
const imgAI = "https://daiyrwxcsqvbbntzjdzy.supabase.co/storage/v1/object/public/assets/pasted-image-2026-03-02T00-01-38-076Z.png";
const imgOCR = "https://daiyrwxcsqvbbntzjdzy.supabase.co/storage/v1/object/public/assets/pasted-image-2026-03-02T00-01-51-790Z.png";
const imgPortfolio = "https://daiyrwxcsqvbbntzjdzy.supabase.co/storage/v1/object/public/assets/pasted-image-2026-03-02T00-02-14-938Z.png";

export default function Index() {
  const { user, loading } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [proPrice, setProPrice] = useState(19.90);

  useEffect(() => {
    const fetchPrice = async () => {
      const { data } = await supabase
        .from('site_settings')
        .select('*')
        .eq('id', 'pro_plan')
        .single();
      
      if (data) {
        setProPrice((data.value as any).price);
      }
    };
    fetchPrice();
  }, []);

  if (loading) return null;
  if (user) return <Navigate to="/dashboard" replace />;

  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      {/* Header */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-background/80 border-b border-border/40">
        <div className="container flex items-center justify-between py-4">
          <div className="flex items-center gap-2.5 font-black text-2xl">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary shadow-[0_0_20px_-4px_hsl(var(--primary)/0.6)]">
              <TrendingUp className="h-6 w-6 text-primary-foreground" />
            </div>
            <span className="tracking-tighter">OpçõesX</span>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={toggleTheme} className="rounded-full">
              {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </Button>
            <Button variant="ghost" onClick={() => navigate('/auth')} className="font-bold hidden sm:inline-flex">Login</Button>
            <Button onClick={() => navigate('/auth')} className="font-bold shadow-lg shadow-primary/20">
              Começar Grátis <ArrowRight className="ml-1 h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* HERO */}
      <section className="relative pt-16 pb-24 overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1200px] h-[800px] bg-primary/10 rounded-full blur-[200px] -z-10" />
        
        <div className="container text-center space-y-8">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-primary/30 bg-primary/5 text-primary text-sm font-bold animate-fade-in">
            <Sparkles className="h-4 w-4" /> ÚNICO NO BRASIL — IA + OCR PARA OPÇÕES B3
          </div>
          
          <h1 className="text-5xl sm:text-7xl lg:text-8xl font-black tracking-tighter leading-[0.85] animate-fade-in">
            PARE DE OPERAR <span className="text-primary">NO ESCURO.</span><br />
            DOMINE O PAYOFF.
          </h1>
          
          <p className="text-xl sm:text-2xl text-muted-foreground max-w-3xl mx-auto font-medium leading-relaxed">
            A primeira plataforma que usa <span className="text-foreground font-bold">Inteligência Artificial</span> para validar se sua estratégia de opções realmente vence o CDI.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
            <Button 
              size="lg" 
              className="h-16 px-12 text-xl font-black shadow-[0_20px_50px_-12px_hsl(var(--primary)/0.5)] hover:scale-105 transition-transform" 
              onClick={() => navigate('/auth')}
            >
              ANALISAR MINHA ESTRUTURA <ArrowRight className="ml-2 h-6 w-6" />
            </Button>
          </div>
        </div>
      </section>

      {/* MAIN PREVIEW - Payoff Chart */}
      <section className="container -mt-8 mb-20">
        <div className="text-center mb-8 space-y-2">
          <Badge className="bg-success/20 text-success border-success/30 font-black px-4 py-1">VISUALIZAÇÃO PROFISSIONAL</Badge>
          <h2 className="text-3xl font-black tracking-tight">Gráfico de Payoff Dinâmico</h2>
        </div>
        <div className="relative rounded-2xl overflow-hidden border-2 border-primary/30 shadow-[0_40px_100px_-20px_hsl(var(--primary)/0.3)] bg-card">
          <img 
            src={imgPayoff} 
            alt="Gráfico de Payoff Real do App" 
            className="w-full h-auto"
            loading="lazy"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-background/20 via-transparent to-transparent" />
        </div>
      </section>

      {/* FEATURES GRID - OCR */}
      <section className="container py-20 bg-muted/30 rounded-[3rem]">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          <div className="space-y-8">
            <div className="space-y-4">
              <Badge variant="outline" className="border-primary/30 text-primary font-bold">TECNOLOGIA OCR</Badge>
              <h2 className="text-4xl font-black tracking-tighter">Do Print para o Payoff em 2 segundos.</h2>
              <p className="text-lg text-muted-foreground">
                Não perca tempo digitando perna por perna. Tire um print da sua corretora (Profit, FlexScan, Home Broker) e nossa IA extrai tudo automaticamente.
              </p>
            </div>
            
            <div className="grid gap-4">
              <Card className="p-4 border-primary/20 bg-card/50 flex items-center gap-4">
                <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                  <Camera className="h-6 w-6" />
                </div>
                <div>
                  <p className="font-bold">Upload Inteligente</p>
                  <p className="text-xs text-muted-foreground">Reconhece ativos, strikes e prêmios instantaneamente.</p>
                </div>
              </Card>
              <Card className="p-4 border-border/40 bg-card/50 flex items-center gap-4">
                <div className="h-12 w-12 rounded-xl bg-muted flex items-center justify-center text-muted-foreground">
                  <MousePointer2 className="h-6 w-6" />
                </div>
                <div>
                  <p className="font-bold">Entrada Manual Precisa</p>
                  <p className="text-xs text-muted-foreground">Controle total para ajustes finos na sua estrutura.</p>
                </div>
              </Card>
            </div>
          </div>
          <div className="rounded-2xl overflow-hidden border-2 border-border/40 shadow-2xl">
            <img src={imgOCR} alt="Interface de Upload OCR" className="w-full h-auto" />
          </div>
        </div>
      </section>

      {/* AI ANALYSIS SECTION */}
      <section className="container py-24">
        <div className="text-center max-w-3xl mx-auto mb-16 space-y-4">
          <Badge className="bg-primary text-primary-foreground font-black">EXCLUSIVO</Badge>
          <h2 className="text-4xl sm:text-6xl font-black tracking-tighter">Relatório de Estratégia com IA</h2>
          <p className="text-xl text-muted-foreground">
            Nossa IA não apenas calcula, ela <span className="text-foreground font-bold">interpreta</span>. Receba um veredito real sobre o risco da sua operação.
          </p>
        </div>

        <div className="relative rounded-3xl overflow-hidden border-2 border-primary/30 shadow-2xl bg-card mb-12">
          <img src={imgAI} alt="Relatório de IA Real" className="w-full h-auto" />
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          <Card className="p-6 border-success/20 bg-success/5 space-y-3">
            <TrendingUp className="h-8 w-8 text-success" />
            <h4 className="font-black">Eficiência vs CDI</h4>
            <p className="text-sm text-muted-foreground">Saiba exatamente quantos % do CDI sua estrutura pode render no melhor cenário.</p>
          </Card>
          <Card className="p-6 border-warning/20 bg-warning/5 space-y-3">
            <Target className="h-8 w-8 text-warning" />
            <h4 className="font-black">Cenários de Mercado</h4>
            <p className="text-sm text-muted-foreground">O que acontece se o ativo subir, cair ou ficar lateral? A IA simula tudo para você.</p>
          </Card>
          <Card className="p-6 border-destructive/20 bg-destructive/5 space-y-3">
            <AlertTriangle className="h-8 w-8 text-destructive" />
            <h4 className="font-black">Alerta de Risco Crítico</h4>
            <p className="text-sm text-muted-foreground">Identifique vendas a descoberto ou riscos ilimitados antes de clicar no botão 'executar'.</p>
          </Card>
        </div>
      </section>

      {/* PORTFOLIO SECTION */}
      <section className="container py-20 bg-primary/5 rounded-[3rem] border border-primary/10">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div className="order-2 lg:order-1 rounded-2xl overflow-hidden border-2 border-primary/20 shadow-2xl">
            <img src={imgPortfolio} alt="Gestão de Portfólio" className="w-full h-auto" />
          </div>
          <div className="order-1 lg:order-2 space-y-6">
            <Badge variant="outline" className="border-primary/30 text-primary font-bold">GESTÃO PROFISSIONAL</Badge>
            <h2 className="text-4xl font-black tracking-tighter">Seu Portfólio Consolidado.</h2>
            <p className="text-lg text-muted-foreground">
              Acompanhe o P&L real de todas as suas operações encerradas. Veja sua taxa de acerto, capital alocado e ROI total em um dashboard limpo e intuitivo.
            </p>
            <ul className="space-y-3">
              <li className="flex items-center gap-3 font-bold text-sm"><CheckCircle2 className="h-5 w-5 text-primary" /> Histórico completo de operações</li>
              <li className="flex items-center gap-3 font-bold text-sm"><CheckCircle2 className="h-5 w-5 text-primary" /> Cálculo automático de lucro e prejuízo</li>
              <li className="flex items-center gap-3 font-bold text-sm"><CheckCircle2 className="h-5 w-5 text-primary" /> Reabertura de estratégias com um clique</li>
            </ul>
          </div>
        </div>
      </section>

      {/* PRICING */}
      <section className="container py-24">
        <div className="text-center mb-16">
          <h2 className="text-5xl font-black tracking-tighter">Invista em Inteligência.</h2>
        </div>

        <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
          <Card className="p-10 border-2 border-border/40 bg-card/50 space-y-8">
            <div className="space-y-2">
              <h3 className="text-2xl font-black tracking-tight">FREE</h3>
              <p className="text-4xl font-black tracking-tighter">R$ 0<span className="text-sm text-muted-foreground font-medium">/mês</span></p>
            </div>
            <ul className="space-y-4">
              <li className="flex items-center gap-3 text-sm font-bold"><CheckCircle2 className="h-5 w-5 text-green-500" /> 3 Simulações por mês</li>
              <li className="flex items-center gap-3 text-sm font-bold"><CheckCircle2 className="h-5 w-5 text-green-500" /> Gráfico de Payoff Completo</li>
              <li className="flex items-center gap-3 text-sm font-bold text-muted-foreground"><Lock className="h-5 w-5" /> OCR de Imagem</li>
              <li className="flex items-center gap-3 text-sm font-bold text-muted-foreground"><Lock className="h-5 w-5" /> Análise com IA</li>
            </ul>
            <Button variant="outline" className="w-full h-12 font-black" onClick={() => navigate('/auth')}>
              COMEÇAR GRÁTIS
            </Button>
          </Card>

          <Card className="p-10 border-2 border-primary bg-gradient-to-br from-primary/10 via-card to-card space-y-8 relative overflow-hidden shadow-2xl">
            <div className="absolute -top-1 -right-1">
              <div className="bg-primary text-primary-foreground font-black text-xs py-2 px-6 rounded-bl-xl">MAIS VENDIDO</div>
            </div>
            <div className="space-y-2">
              <h3 className="text-2xl font-black tracking-tight text-primary">PRO</h3>
              <p className="text-4xl font-black tracking-tighter">R$ {proPrice.toFixed(2)}<span className="text-sm text-muted-foreground font-medium">/mês</span></p>
            </div>
            <ul className="space-y-4">
              <li className="flex items-center gap-3 text-sm font-bold"><CheckCircle2 className="h-5 w-5 text-primary" /> Simulações ILIMITADAS</li>
              <li className="flex items-center gap-3 text-sm font-bold"><CheckCircle2 className="h-5 w-5 text-primary" /> OCR de Imagem ILIMITADO</li>
              <li className="flex items-center gap-3 text-sm font-bold"><CheckCircle2 className="h-5 w-5 text-primary" /> Análise com IA ILIMITADA</li>
              <li className="flex items-center gap-3 text-sm font-bold"><CheckCircle2 className="h-5 w-5 text-primary" /> Portfólio e P&L Consolidado</li>
            </ul>
            <Button className="w-full h-14 text-lg font-black shadow-lg shadow-primary/30" onClick={() => navigate('/auth')}>
              ASSINAR PRO AGORA <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </Card>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/40 bg-muted/20 py-12">
        <div className="container text-center space-y-6">
          <div className="flex items-center justify-center gap-2.5 font-black text-xl">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
              <TrendingUp className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="tracking-tighter">OpçõesX</span>
          </div>
          <p className="text-[10px] text-muted-foreground max-w-3xl mx-auto leading-relaxed">
            AVISO LEGAL: Este aplicativo é uma ferramenta de simulação algorítmica baseada nas regras da B3. Os dados apresentados não constituem recomendação de investimento. Verifique os dados com sua corretora antes de operar.
          </p>
        </div>
      </footer>
    </div>
  );
}