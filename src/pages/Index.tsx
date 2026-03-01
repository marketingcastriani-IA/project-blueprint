import { useAuth } from '@/contexts/AuthContext';
import { useNavigate, Navigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { 
  TrendingUp, BarChart3, Shield, Zap, ArrowRight, 
  LineChart, Brain, CalendarDays, Target, CheckCircle2, 
  Lock, Sparkles, MousePointer2, Smartphone
} from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';
import { Sun, Moon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import useEmblaCarousel from 'embla-carousel-react';
import { useEffect, useState } from 'react';

export default function Index() {
  const { user, loading } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [emblaRef] = useEmblaCarousel({ loop: true, duration: 30 });

  if (loading) return null;
  if (user) return <Navigate to="/dashboard" replace />;

  const features = [
    {
      title: 'OCR Inteligente',
      desc: 'Chega de digitar perna por perna. Cole o print da sua corretora e a IA identifica tudo em 2 segundos.',
      icon: Zap,
      image: 'https://images.unsplash.com/photo-1611974717484-788cff8fca47?auto=format&fit=crop&q=80&w=800',
    },
    {
      title: 'Payoff vs CDI',
      desc: 'A única ferramenta que mostra se sua estrutura realmente vale o risco ou se o CDI ganha de você.',
      icon: BarChart3,
      image: 'https://images.unsplash.com/photo-1642790103517-1812df38511e?auto=format&fit=crop&q=80&w=800',
    },
    {
      title: 'Detecção de Collar',
      desc: 'Identificamos automaticamente estratégias complexas e calculamos o custo real de montagem.',
      icon: Shield,
      image: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&q=80&w=800',
    },
  ];

  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border/40 bg-background/80 backdrop-blur-md">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-2.5 font-bold text-xl">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary shadow-[0_0_20px_-4px_hsl(var(--primary)/0.5)]">
              <TrendingUp className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="tracking-tighter">OpçõesX</span>
          </div>
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={toggleTheme}>
              {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
            <Button variant="outline" onClick={() => navigate('/auth')} className="hidden sm:flex">Entrar</Button>
            <Button onClick={() => navigate('/auth')} className="font-bold">Começar Agora</Button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative pt-20 pb-32 overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[600px] bg-primary/10 rounded-full blur-[120px] -z-10" />
        
        <div className="container text-center space-y-8 animate-fade-in">
          <Badge variant="outline" className="py-1.5 px-4 border-primary/30 text-primary bg-primary/5 animate-pulse">
            <Sparkles className="h-3.5 w-3.5 mr-2" /> A ferramenta definitiva para o investidor de opções
          </Badge>
          
          <h1 className="text-5xl sm:text-7xl font-black leading-[1.05] tracking-tighter max-w-4xl mx-auto">
            PARE DE PERDER DINHEIRO PARA O <span className="text-primary">CDI</span> COM OPÇÕES
          </h1>
          
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            Analise o payoff real, custo de montagem e receba sugestões da nossa IA em segundos. 
            <span className="text-foreground font-bold"> A única plataforma que compara sua estratégia com a renda fixa.</span>
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
            <Button size="lg" onClick={() => navigate('/auth')} className="h-14 px-10 text-lg font-black shadow-[0_0_40px_-10px_hsl(var(--primary)/0.6)]">
              TESTAR 3 SIMULAÇÕES GRÁTIS <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </div>

          {/* App Preview Mockup */}
          <div className="relative mt-20 max-w-5xl mx-auto rounded-2xl border-4 border-border/50 bg-card shadow-2xl overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent z-10" />
            <img 
              src="https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/fe122440-c6c3-46e2-ab08-de3a8b930cdb/id-preview-d2586b4c--383067a4-14a6-40ed-b7ee-51b2588dad7d.lovable.app-1772132175391.png" 
              alt="App Preview" 
              className="w-full h-auto opacity-90 group-hover:scale-[1.02] transition-transform duration-700"
            />
            <div className="absolute bottom-10 left-1/2 -translate-x-1/2 z-20 w-full px-6">
              <div className="flex flex-wrap justify-center gap-8 text-sm font-bold text-muted-foreground">
                <div className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-success" /> Payoff em Tempo Real</div>
                <div className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-success" /> OCR de Corretoras</div>
                <div className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-success" /> Inteligência Artificial</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Carousel */}
      <section className="py-24 bg-muted/30">
        <div className="container">
          <div className="text-center mb-16 space-y-4">
            <h2 className="text-3xl sm:text-5xl font-black tracking-tighter">POR QUE O OPÇÕESX É EXCLUSIVO?</h2>
            <p className="text-muted-foreground">Funcionalidades que você não encontra em nenhuma outra plataforma.</p>
          </div>

          <div className="overflow-hidden" ref={emblaRef}>
            <div className="flex">
              {features.map((f, i) => (
                <div key={i} className="flex-[0_0_100%] min-w-0 px-4 sm:flex-[0_0_50%] lg:flex-[0_0_33.33%]">
                  <div className="h-full p-8 rounded-3xl border bg-card space-y-6 hover:border-primary/50 transition-colors">
                    <div className="h-14 w-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
                      <f.icon className="h-7 w-7" />
                    </div>
                    <h3 className="text-2xl font-bold tracking-tight">{f.title}</h3>
                    <p className="text-muted-foreground leading-relaxed">{f.desc}</p>
                    <img src={f.image} className="rounded-xl w-full h-40 object-cover border" alt={f.title} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section className="py-24 container">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-black tracking-tighter">ESCOLHA SEU PLANO</h2>
          <p className="text-muted-foreground mt-2">Comece grátis e evolua quando estiver pronto para lucrar mais.</p>
        </div>

        <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
          {/* Free Plan */}
          <div className="p-8 rounded-3xl border bg-card space-y-6 relative overflow-hidden">
            <div className="space-y-2">
              <h3 className="text-2xl font-bold">Plano Free</h3>
              <p className="text-4xl font-black">R$ 0<span className="text-sm font-normal text-muted-foreground">/mês</span></p>
            </div>
            <ul className="space-y-4">
              <li className="flex items-center gap-3 text-sm"><CheckCircle2 className="h-4 w-4 text-success" /> 3 Simulações de Estruturas</li>
              <li className="flex items-center gap-3 text-sm"><CheckCircle2 className="h-4 w-4 text-success" /> Gráfico de Payoff Básico</li>
              <li className="flex items-center gap-3 text-sm text-muted-foreground"><Lock className="h-4 w-4" /> Sugestões da IA</li>
              <li className="flex items-center gap-3 text-sm text-muted-foreground"><Lock className="h-4 w-4" /> OCR de Imagens</li>
            </ul>
            <Button variant="outline" className="w-full h-12 font-bold" onClick={() => navigate('/auth')}>Começar Grátis</Button>
          </div>

          {/* Pro Plan */}
          <div className="p-8 rounded-3xl border-2 border-primary bg-primary/5 space-y-6 relative overflow-hidden">
            <div className="absolute top-4 right-4">
              <Badge className="bg-primary text-primary-foreground font-black">MAIS POPULAR</Badge>
            </div>
            <div className="space-y-2">
              <h3 className="text-2xl font-bold">Plano PRO</h3>
              <p className="text-4xl font-black">R$ 49,90<span className="text-sm font-normal text-muted-foreground">/mês</span></p>
            </div>
            <ul className="space-y-4">
              <li className="flex items-center gap-3 text-sm font-bold"><CheckCircle2 className="h-4 w-4 text-success" /> Simulações ILIMITADAS</li>
              <li className="flex items-center gap-3 text-sm font-bold"><CheckCircle2 className="h-4 w-4 text-success" /> IA de Análise Profissional</li>
              <li className="flex items-center gap-3 text-sm font-bold"><CheckCircle2 className="h-4 w-4 text-success" /> OCR de Corretoras Ilimitado</li>
              <li className="flex items-center gap-3 text-sm font-bold"><CheckCircle2 className="h-4 w-4 text-success" /> Comparativo CDI Avançado</li>
              <li className="flex items-center gap-3 text-sm font-bold"><CheckCircle2 className="h-4 w-4 text-success" /> Suporte Prioritário</li>
            </ul>
            <Button className="w-full h-12 font-black shadow-lg" onClick={() => navigate('/auth')}>ASSINAR AGORA</Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-12 bg-muted/20">
        <div className="container text-center space-y-4">
          <div className="flex items-center justify-center gap-2 font-bold">
            <TrendingUp className="h-5 w-5 text-primary" />
            <span>OpçõesX</span>
          </div>
          <p className="text-xs text-muted-foreground max-w-2xl mx-auto">
            AVISO: Operar opções envolve riscos elevados. O OpçõesX é uma ferramenta de simulação e não constitui recomendação de investimento.
          </p>
          <p className="text-[10px] text-muted-foreground">© 2024 OpçõesX - Todos os direitos reservados.</p>
        </div>
      </footer>
    </div>
  );
}