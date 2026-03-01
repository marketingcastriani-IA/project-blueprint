import { useAuth } from '@/contexts/AuthContext';
import { useNavigate, Navigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { 
  TrendingUp, BarChart3, Shield, Zap, ArrowRight, 
  LineChart, Brain, CalendarDays, Target, CheckCircle2,
  Lock, Rocket, Star, Users, ShieldCheck, Sparkles
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
  const [emblaRef] = useEmblaCarousel({ loop: true, autoplay: true } as any);

  if (loading) return null;
  if (user) return <Navigate to="/dashboard" replace />;

  const screenshots = [
    { title: "OCR de Notas", desc: "Nossa IA lê sua nota de corretagem instantaneamente.", img: "https://images.unsplash.com/photo-1611974714024-462cd297c8aa?auto=format&fit=crop&q=80&w=1000" },
    { title: "Payoff em Tempo Real", desc: "Visualize lucro e prejuízo com precisão matemática.", img: "https://images.unsplash.com/photo-1551288049-bbbda536339a?auto=format&fit=crop&q=80&w=1000" },
    { title: "Comparativo CDI", desc: "Saiba na hora se sua estratégia vence a renda fixa.", img: "https://images.unsplash.com/photo-1642790106117-e829e14a795f?auto=format&fit=crop&q=80&w=1000" },
  ];

  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      {/* Header Premium */}
      <header className="sticky top-0 z-50 border-b border-primary/10 bg-background/80 backdrop-blur-md">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-2.5 font-bold text-xl">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary shadow-[0_0_20px_-4px_hsl(var(--primary)/0.6)]">
              <TrendingUp className="h-6 w-6 text-primary-foreground" />
            </div>
            <span className="tracking-tighter">OpçõesX</span>
          </div>
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={toggleTheme} className="rounded-full">
              {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </Button>
            <Button variant="outline" onClick={() => navigate('/auth')} className="hidden sm:flex">Entrar</Button>
            <Button onClick={() => navigate('/auth')} className="bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20">Começar Agora</Button>
          </div>
        </div>
      </header>

      {/* Hero Section Agressiva */}
      <section className="relative pt-20 pb-32 overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full bg-[radial-gradient(circle_at_center,hsl(var(--primary)/0.15)_0%,transparent_70%)] pointer-events-none" />
        
        <div className="container relative text-center space-y-8 animate-fade-in">
          <Badge variant="outline" className="py-1.5 px-4 border-primary/30 text-primary bg-primary/5 animate-pulse">
            <Sparkles className="h-3.5 w-3.5 mr-2" /> A ÚNICA FERRAMENTA COM IA PARA OPÇÕES B3
          </Badge>
          
          <h1 className="text-5xl sm:text-8xl font-black leading-[0.9] tracking-tighter text-foreground">
            PARE DE OPERAR <br />
            <span className="text-primary">NO ESCURO.</span>
          </h1>
          
          <p className="text-xl sm:text-2xl text-muted-foreground max-w-2xl mx-auto font-medium leading-tight">
            Domine o mercado de derivativos com a tecnologia que as grandes tesourarias usam. 
            <span className="text-foreground font-bold"> Payoff instantâneo via OCR e análise de IA.</span>
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
            <Button size="lg" className="h-16 px-10 text-lg font-black rounded-2xl shadow-[0_20px_40px_-12px_hsl(var(--primary)/0.5)] hover:scale-105 transition-transform" onClick={() => navigate('/auth')}>
              QUERO ACESSO EXCLUSIVO <ArrowRight className="ml-2 h-6 w-6" />
            </Button>
          </div>

          <div className="flex items-center justify-center gap-8 pt-12 opacity-60 grayscale hover:grayscale-0 transition-all">
            <div className="flex items-center gap-2 font-bold"><ShieldCheck className="h-5 w-5 text-primary" /> 100% SEGURO</div>
            <div className="flex items-center gap-2 font-bold"><Users className="h-5 w-5 text-primary" /> +5.000 TRADERS</div>
            <div className="flex items-center gap-2 font-bold"><Star className="h-5 w-5 text-primary" /> 4.9/5 AVALIAÇÃO</div>
          </div>
        </div>
      </section>

      {/* Carrossel de Funcionalidades Reais */}
      <section className="py-24 bg-muted/30 border-y border-primary/10">
        <div className="container">
          <div className="text-center mb-16 space-y-4">
            <h2 className="text-4xl font-black tracking-tighter">TECNOLOGIA DE PONTA</h2>
            <p className="text-muted-foreground">Veja como o OpçõesX transforma sua forma de investir</p>
          </div>

          <div className="overflow-hidden" ref={emblaRef}>
            <div className="flex gap-6">
              {screenshots.map((s, i) => (
                <div key={i} className="flex-[0_0_100%] sm:flex-[0_0_80%] lg:flex-[0_0_60%] min-w-0">
                  <div className="relative group rounded-3xl border-4 border-primary/20 overflow-hidden bg-card shadow-2xl">
                    <img src={s.img} alt={s.title} className="w-full aspect-video object-cover opacity-80 group-hover:opacity-100 transition-opacity" />
                    <div className="absolute bottom-0 left-0 right-0 p-8 bg-gradient-to-t from-black/90 to-transparent text-white">
                      <h3 className="text-2xl font-black mb-2">{s.title}</h3>
                      <p className="text-sm text-white/70">{s.desc}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Planos de Preço */}
      <section className="py-32 container">
        <div className="text-center mb-20">
          <h2 className="text-5xl font-black tracking-tighter mb-4">ESCOLHA SEU PODER</h2>
          <p className="text-muted-foreground">Comece grátis e evolua para o profissional quando estiver pronto.</p>
        </div>

        <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
          {/* Plano FREE */}
          <div className="relative p-8 rounded-3xl border-2 border-border bg-card/50 space-y-6">
            <div className="space-y-2">
              <h3 className="text-2xl font-bold">Plano Free</h3>
              <p className="text-muted-foreground text-sm">Para quem está começando.</p>
            </div>
            <div className="text-4xl font-black">R$ 0<span className="text-sm text-muted-foreground font-normal">/mês</span></div>
            <ul className="space-y-4">
              <li className="flex items-center gap-3 text-sm font-medium"><CheckCircle2 className="h-5 w-5 text-success" /> 3 Simulações de Estratégia</li>
              <li className="flex items-center gap-3 text-sm font-medium"><CheckCircle2 className="h-5 w-5 text-success" /> Gráfico de Payoff Básico</li>
              <li className="flex items-center gap-3 text-sm font-medium text-muted-foreground/50"><Lock className="h-4 w-4" /> Análise de IA Ilimitada</li>
              <li className="flex items-center gap-3 text-sm font-medium text-muted-foreground/50"><Lock className="h-4 w-4" /> OCR de Notas de Corretagem</li>
            </ul>
            <Button variant="outline" className="w-full h-12 rounded-xl" onClick={() => navigate('/auth')}>Começar Grátis</Button>
          </div>

          {/* Plano PRO */}
          <div className="relative p-8 rounded-3xl border-4 border-primary bg-primary/5 space-y-6 shadow-[0_0_60px_-12px_hsl(var(--primary)/0.4)]">
            <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground px-4 py-1 rounded-full text-xs font-black tracking-widest">MAIS VENDIDO</div>
            <div className="space-y-2">
              <h3 className="text-2xl font-bold">Plano PRO</h3>
              <p className="text-muted-foreground text-sm">Para traders profissionais.</p>
            </div>
            <div className="text-4xl font-black">R$ 97<span className="text-sm text-muted-foreground font-normal">/mês</span></div>
            <ul className="space-y-4">
              <li className="flex items-center gap-3 text-sm font-bold"><Rocket className="h-5 w-5 text-primary" /> Simulações ILIMITADAS</li>
              <li className="flex items-center gap-3 text-sm font-bold"><Rocket className="h-5 w-5 text-primary" /> OCR de Notas Ilimitado</li>
              <li className="flex items-center gap-3 text-sm font-bold"><Rocket className="h-5 w-5 text-primary" /> Análise Profissional de IA</li>
              <li className="flex items-center gap-3 text-sm font-bold"><Rocket className="h-5 w-5 text-primary" /> Suporte Prioritário</li>
            </ul>
            <Button className="w-full h-12 rounded-xl bg-primary hover:bg-primary/90 font-black" onClick={() => navigate('/auth')}>ASSINAR AGORA</Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-primary/10 py-12 bg-muted/20">
        <div className="container text-center space-y-4">
          <div className="flex justify-center gap-6 text-muted-foreground">
            <a href="#" className="hover:text-primary transition-colors">Termos</a>
            <a href="#" className="hover:text-primary transition-colors">Privacidade</a>
            <a href="#" className="hover:text-primary transition-colors">Contato</a>
          </div>
          <p className="text-[10px] text-muted-foreground max-w-2xl mx-auto">
            OpçõesX é uma ferramenta de simulação. Investimentos em derivativos envolvem alto risco. 
            Não somos uma corretora ou casa de análise.
          </p>
        </div>
      </footer>
    </div>
  );
}