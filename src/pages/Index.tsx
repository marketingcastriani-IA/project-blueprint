import { useAuth } from '@/contexts/AuthContext';
import { useNavigate, Navigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { TrendingUp, BarChart3, Shield, Zap, ArrowRight, LineChart, Brain, CalendarDays, Target } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';
import { Sun, Moon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export default function Index() {
  const { user, loading } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();

  if (loading) return null;
  if (user) return <Navigate to="/dashboard" replace />;

  const features = [
    {
      icon: Zap,
      title: 'OCR Inteligente',
      desc: 'Tire um print da sua corretora e a IA monta o gráfico de Payoff em segundos.',
      badge: 'IA',
    },
    {
      icon: BarChart3,
      title: 'Payoff Profissional',
      desc: 'Gráfico com 3 zonas: prejuízo (vermelho), lucro abaixo do CDI (laranja) e acima do CDI (verde).',
      badge: null,
    },
    {
      icon: Shield,
      title: 'Detecção de Collar',
      desc: 'Identifica automaticamente Collar, calcula custo real de montagem, breakeven e risco zero.',
      badge: 'AUTO',
    },
    {
      icon: Target,
      title: 'Estrutura vs CDI',
      desc: 'Compare seu retorno com a renda fixa. Se não vencer o CDI, a gente te avisa!',
      badge: null,
    },
    {
      icon: CalendarDays,
      title: 'Calendário B3',
      desc: 'Vencimentos automáticos ajustados por feriados. Nunca mais erre o dia de sair da operação.',
      badge: 'NOVO',
    },
    {
      icon: Brain,
      title: 'Sugestão da IA',
      desc: 'Receba uma análise objetiva da sua estrutura com veredito e comparativo CDI.',
      badge: 'IA',
    },
  ];

  return (
    <div className="min-h-screen bg-background overflow-hidden">
      {/* Header */}
      <header className="container flex items-center justify-between py-5">
        <div className="flex items-center gap-2.5 font-bold text-lg">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary shadow-[0_0_20px_-4px_hsl(var(--primary)/0.5)]">
            <TrendingUp className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="tracking-tight">OpçõesX</span>
          <Badge variant="outline" className="text-[9px] border-primary/30 text-primary ml-1">PRO</Badge>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" size="icon" onClick={toggleTheme}>
            {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
          <Button variant="outline" onClick={() => navigate('/auth')}>Entrar</Button>
        </div>
      </header>

      {/* Hero */}
      <main className="container relative">
        {/* Background glow */}
        <div className="absolute top-20 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-primary/10 rounded-full blur-[120px] pointer-events-none" />

        <section className="relative max-w-3xl mx-auto text-center pt-20 pb-16 space-y-8 animate-fade-in">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 text-sm text-primary">
            <LineChart className="h-3.5 w-3.5" />
            Plataforma profissional de análise de opções B3
          </div>

          <h1 className="text-4xl sm:text-6xl font-bold leading-[1.1] tracking-tight">
            Suas opções rendem mais que o{' '}
            <span className="relative">
              <span className="text-primary">CDI</span>
              <span className="absolute -bottom-1 left-0 right-0 h-1 bg-primary/30 rounded-full" />
            </span>
            ?
          </h1>

          <p className="text-lg sm:text-xl text-muted-foreground max-w-xl mx-auto leading-relaxed">
            Cole um print da sua corretora ou monte manualmente. <strong className="text-foreground">Payoff, breakeven, comparativo CDI</strong> e sugestão da IA em segundos.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button size="lg" className="text-base h-12 px-8 shadow-[0_0_30px_-8px_hsl(var(--primary)/0.4)]" onClick={() => navigate('/auth')}>
              Começar gratuitamente <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
            <Button size="lg" variant="outline" className="text-base h-12 px-8" onClick={() => navigate('/auth')}>
              Já tenho conta
            </Button>
          </div>

          {/* Social proof */}
          <div className="flex items-center justify-center gap-6 pt-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <div className="h-2 w-2 rounded-full bg-success animate-pulse" />
              Calendário B3 atualizado
            </div>
            <span className="text-border">|</span>
            <div>OCR para Bolsa de Valores e Derivativos</div>
            <span className="text-border hidden sm:inline">|</span>
            <div className="hidden sm:block">100% gratuito</div>
          </div>
        </section>

        {/* Features grid */}
        <section className="relative grid sm:grid-cols-2 lg:grid-cols-3 gap-4 max-w-5xl mx-auto pb-20">
          {features.map((f, i) => (
            <div
              key={f.title}
              className="group relative rounded-2xl border border-border/40 bg-card/50 backdrop-blur-sm p-6 space-y-3 transition-all duration-300 hover:border-primary/30 hover:shadow-[0_0_30px_-10px_hsl(var(--primary)/0.15)] hover:-translate-y-0.5"
              style={{ animationDelay: `${i * 80}ms` }}
            >
              {f.badge && (
                <Badge variant="outline" className="absolute top-4 right-4 text-[9px] border-primary/30 text-primary">
                  {f.badge}
                </Badge>
              )}
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary transition-colors group-hover:bg-primary/20">
                <f.icon className="h-5 w-5" />
              </div>
              <h3 className="font-semibold text-lg">{f.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-border/40 bg-muted/20 py-6">
        <div className="container text-center">
          <p className="text-[10px] text-muted-foreground max-w-3xl mx-auto leading-relaxed">
            AVISO LEGAL: Este aplicativo é uma ferramenta de simulação algorítmica baseada nas regras de calendário e letras de vencimento da B3 (A-L para Calls, M-X para Puts). Os dados apresentados não constituem recomendação de investimento, compra ou venda de ativos. O cálculo de CDI é uma projeção. Verifique os dados com sua corretora antes de operar.
          </p>
        </div>
      </footer>
    </div>
  );
}
