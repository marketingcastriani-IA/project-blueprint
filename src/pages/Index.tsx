import { useAuth } from '@/contexts/AuthContext';
import { useNavigate, Navigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { 
  TrendingUp, BarChart3, Shield, Zap, ArrowRight, 
  LineChart, Brain, CalendarDays, Target, CheckCircle2,
  Lock, Smartphone, Sparkles, Trophy, XCircle, AlertTriangle,
  MousePointer2, Rocket, Star
} from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';
import { Sun, Moon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

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

  const features = [
    {
      icon: Zap,
      title: 'OCR de Próxima Geração',
      desc: 'A única ferramenta que lê o print da sua corretora e monta o payoff instantaneamente. Chega de digitar perna por perna.',
      image: 'https://images.unsplash.com/photo-1611974717484-7da00ff12990?auto=format&fit=crop&q=80&w=800',
    },
    {
      icon: Brain,
      title: 'Inteligência Artificial B3',
      desc: 'Nossa IA analisa sua estrutura e dá um veredito real: "Vence o CDI?" ou "Risco Desnecessário?".',
      image: 'https://images.unsplash.com/photo-1677442136019-21780ecad995?auto=format&fit=crop&q=80&w=800',
    },
    {
      icon: Target,
      title: 'Benchmark CDI Real-Time',
      desc: 'Visualize se sua operação de opções é melhor que deixar o dinheiro no Tesouro Selic. Gráficos de 3 cores exclusivos.',
      image: 'https://images.unsplash.com/photo-1551288049-bbdac8626ad1?auto=format&fit=crop&q=80&w=800',
    },
  ];

  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      {/* Header */}
      <header className="container flex items-center justify-between py-6 border-b border-border/40">
        <div className="flex items-center gap-2.5 font-black text-2xl">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary shadow-[0_0_20px_-4px_hsl(var(--primary)/0.6)]">
            <TrendingUp className="h-6 w-6 text-primary-foreground" />
          </div>
          <span className="tracking-tighter">OpçõesX</span>
        </div>
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={toggleTheme} className="rounded-full">
            {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </Button>
          <Button variant="outline" onClick={() => navigate('/auth')} className="font-bold">Login</Button>
          <Button onClick={() => navigate('/auth')} className="font-bold shadow-lg shadow-primary/20">Começar Agora</Button>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative pt-20 pb-32 overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[600px] bg-primary/10 rounded-full blur-[160px] -z-10" />
        
        <div className="container text-center space-y-8">
          <Badge variant="outline" className="py-1.5 px-4 border-primary/30 text-primary bg-primary/5 animate-fade-in">
            <Sparkles className="h-3.5 w-3.5 mr-2" /> A FERRAMENTA DEFINITIVA PARA DERIVATIVOS
          </Badge>
          
          <h1 className="text-5xl sm:text-8xl font-black tracking-tighter leading-[0.9] animate-fade-in">
            PARE DE OPERAR <br />
            <span className="text-primary">NO ESCURO.</span>
          </h1>
          
          <p className="text-xl sm:text-2xl text-muted-foreground max-w-2xl mx-auto font-medium leading-relaxed">
            A única plataforma que utiliza <span className="text-foreground font-bold">IA e OCR</span> para validar se sua estratégia de opções realmente vence o CDI.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
            <Button size="lg" className="h-16 px-10 text-xl font-black shadow-[0_20px_50px_-12px_hsl(var(--primary)/0.5)] hover:scale-105 transition-transform" onClick={() => navigate('/auth')}>
              LIBERAR ACESSO GRÁTIS <ArrowRight className="ml-2 h-6 w-6" />
            </Button>
          </div>

          <div className="flex items-center justify-center gap-8 pt-12 opacity-60 grayscale hover:grayscale-0 transition-all">
            <div className="flex items-center gap-2 font-bold"><Trophy className="h-5 w-5 text-warning" /> #1 EM OCR B3</div>
            <div className="flex items-center gap-2 font-bold"><Shield className="h-5 w-5 text-success" /> 100% SEGURO</div>
            <div className="flex items-center gap-2 font-bold"><Brain className="h-5 w-5 text-info" /> IA EXCLUSIVA</div>
          </div>
        </div>
      </section>

      {/* Comparison Section - AGGRESSIVE */}
      <section className="container py-24">
        <div className="rounded-3xl border-2 border-primary/20 bg-gradient-to-b from-primary/[0.03] to-transparent p-8 sm:p-16 space-y-12">
          <div className="text-center space-y-4">
            <h2 className="text-3xl sm:text-5xl font-black tracking-tighter">POR QUE O <span className="text-primary">OPÇÕESX?</span></h2>
            <p className="text-muted-foreground font-medium">Compare e veja por que as planilhas ficaram no passado.</p>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            <Card className="p-8 border-destructive/20 bg-destructive/[0.02] space-y-6">
              <h3 className="text-xl font-black text-destructive flex items-center gap-2">
                <XCircle className="h-5 w-5" /> O JEITO ANTIGO
              </h3>
              <ul className="space-y-4">
                <li className="flex items-start gap-3 text-sm font-medium text-muted-foreground">
                  <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" /> Digitação manual de cada perna (lento e sujeito a erro)
                </li>
                <li className="flex items-start gap-3 text-sm font-medium text-muted-foreground">
                  <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" /> Cálculos complexos de Black-Scholes no Excel
                </li>
                <li className="flex items-start gap-3 text-sm font-medium text-muted-foreground">
                  <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" /> Sem comparação real com o custo de oportunidade (CDI)
                </li>
                <li className="flex items-start gap-3 text-sm font-medium text-muted-foreground">
                  <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" /> Decisões baseadas em "feeling", não em dados
                </li>
              </ul>
            </Card>

            <Card className="p-8 border-primary/40 bg-primary/[0.05] space-y-6 shadow-[0_0_40px_-12px_hsl(var(--primary)/0.3)]">
              <h3 className="text-xl font-black text-primary flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5" /> COM OPÇÕESX
              </h3>
              <ul className="space-y-4">
                <li className="flex items-start gap-3 text-sm font-bold">
                  <Rocket className="h-4 w-4 mt-0.5 text-primary shrink-0" /> OCR Inteligente: Print da corretora vira Payoff em 2s
                </li>
                <li className="flex items-start gap-3 text-sm font-bold">
                  <Brain className="h-4 w-4 mt-0.5 text-primary shrink-0" /> IA Analista: Veredito profissional sobre sua estrutura
                </li>
                <li className="flex items-start gap-3 text-sm font-bold">
                  <Target className="h-4 w-4 mt-0.5 text-primary shrink-0" /> Benchmark CDI: Saiba se vale a pena o risco
                </li>
                <li className="flex items-start gap-3 text-sm font-bold">
                  <Star className="h-4 w-4 mt-0.5 text-primary shrink-0" /> Portfólio: Histórico real de P&L consolidado
                </li>
              </ul>
            </Card>
          </div>
        </div>
      </section>

      {/* Features Carousel Section */}
      <section className="container py-24 space-y-16">
        <div className="text-center space-y-4">
          <h2 className="text-4xl sm:text-6xl font-black tracking-tighter">TECNOLOGIA <span className="text-primary">EXCLUSIVA.</span></h2>
          <p className="text-lg text-muted-foreground max-w-xl mx-auto">O que você só encontra no OpçõesX.</p>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {features.map((f, i) => (
            <Card key={f.title} className="group relative overflow-hidden border-2 border-border/40 bg-card/50 backdrop-blur-sm p-8 space-y-6 transition-all duration-500 hover:border-primary/40 hover:shadow-[0_0_60px_-12px_hsl(var(--primary)/0.2)] hover:-translate-y-2">
              <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="relative space-y-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-[0_0_20px_-5px_hsl(var(--primary))] group-hover:scale-110 transition-transform duration-500">
                  <f.icon className="h-7 w-7" />
                </div>
                <h3 className="text-2xl font-black tracking-tight">{f.title}</h3>
                <p className="text-sm text-muted-foreground font-medium leading-relaxed">{f.desc}</p>
                <div className="pt-4 overflow-hidden rounded-xl border border-border/40 shadow-2xl">
                  <img src={f.image} alt={f.title} className="w-full h-48 object-cover group-hover:scale-110 transition-transform duration-700" />
                </div>
              </div>
            </Card>
          ))}
        </div>
      </section>

      {/* Pricing Section */}
      <section className="container py-24 space-y-16">
        <div className="text-center space-y-4">
          <h2 className="text-4xl sm:text-6xl font-black tracking-tighter">ESCOLHA SEU <span className="text-primary">PLANO.</span></h2>
          <p className="text-lg text-muted-foreground max-w-xl mx-auto">Comece grátis e evolua para o PRO quando estiver pronto.</p>
        </div>

        <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
          {/* Free Plan */}
          <Card className="p-10 border-2 border-border/40 bg-card/50 backdrop-blur-sm space-y-8">
            <div className="space-y-2">
              <h3 className="text-2xl font-black tracking-tight">FREE</h3>
              <p className="text-4xl font-black tracking-tighter">R$ 0<span className="text-sm text-muted-foreground">/mês</span></p>
            </div>
            <ul className="space-y-4">
              <li className="flex items-center gap-3 text-sm font-bold"><CheckCircle2 className="h-5 w-5 text-success" /> 3 Simulações por mês</li>
              <li className="flex items-center gap-3 text-sm font-bold"><CheckCircle2 className="h-5 w-5 text-success" /> Gráfico de Payoff Básico</li>
              <li className="flex items-center gap-3 text-sm font-bold text-muted-foreground"><Lock className="h-5 w-5" /> OCR de Imagem</li>
              <li className="flex items-center gap-3 text-sm font-bold text-muted-foreground"><Lock className="h-5 w-5" /> Sugestão de IA</li>
            </ul>
            <Button variant="outline" className="w-full h-12 font-black" onClick={() => navigate('/auth')}>COMEÇAR GRÁTIS</Button>
          </Card>

          {/* PRO Plan */}
          <Card className="p-10 border-2 border-primary bg-gradient-to-br from-primary/10 via-card to-card space-y-8 relative overflow-hidden">
            <div className="absolute top-4 right-4">
              <Badge className="bg-primary text-primary-foreground font-black">MAIS POPULAR</Badge>
            </div>
            <div className="space-y-2">
              <h3 className="text-2xl font-black tracking-tight text-primary">PRO</h3>
              <p className="text-4xl font-black tracking-tighter">R$ {proPrice.toFixed(2)}<span className="text-sm text-muted-foreground">/mês</span></p>
            </div>
            <ul className="space-y-4">
              <li className="flex items-center gap-3 text-sm font-bold"><CheckCircle2 className="h-5 w-5 text-primary" /> Simulações ILIMITADAS</li>
              <li className="flex items-center gap-3 text-sm font-bold"><CheckCircle2 className="h-5 w-5 text-primary" /> OCR de Imagem Ilimitado</li>
              <li className="flex items-center gap-3 text-sm font-bold"><CheckCircle2 className="h-5 w-5 text-primary" /> Sugestão de IA Ilimitada</li>
              <li className="flex items-center gap-3 text-sm font-bold"><CheckCircle2 className="h-5 w-5 text-primary" /> Portfólio de Operações</li>
              <li className="flex items-center gap-3 text-sm font-bold"><CheckCircle2 className="h-5 w-5 text-primary" /> Suporte Prioritário</li>
            </ul>
            <Button className="w-full h-12 font-black shadow-lg shadow-primary/30" onClick={() => navigate('/auth')}>ASSINAR AGORA</Button>
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
            AVISO LEGAL: Este aplicativo é uma ferramenta de simulação algorítmica baseada nas regras de calendário e letras de vencimento da B3. Os dados apresentados não constituem recomendação de investimento, compra ou venda de ativos. O cálculo de CDI é uma projeção. Verifique os dados com sua corretora antes de operar.
          </p>
          <div className="flex justify-center gap-6 text-xs font-bold text-muted-foreground">
            <a href="#" className="hover:text-primary">Termos de Uso</a>
            <a href="#" className="hover:text-primary">Privacidade</a>
            <a href="#" className="hover:text-primary">Contato</a>
          </div>
        </div>
      </footer>
    </div>
  );
}