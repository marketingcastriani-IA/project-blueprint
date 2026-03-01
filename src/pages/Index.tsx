import { useAuth } from '@/contexts/AuthContext';
import { useNavigate, Navigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { 
  TrendingUp, ArrowRight, Brain, Target, CheckCircle2,
  Lock, Sparkles, Trophy, XCircle, AlertTriangle,
  Rocket, Star, Shield, Zap, Users, BarChart3,
  Clock, Eye, MousePointer2, ChevronRight
} from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';
import { Sun, Moon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

import screenshotPayoff from '@/assets/screenshot-payoff.jpg';
import screenshotAI from '@/assets/screenshot-ai-analysis.jpg';
import screenshotOCR from '@/assets/screenshot-ocr.jpg';

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

      {/* HERO - Ultra Aggressive */}
      <section className="relative pt-16 pb-24 overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1200px] h-[800px] bg-primary/10 rounded-full blur-[200px] -z-10" />
        <div className="absolute top-20 right-0 w-[400px] h-[400px] bg-primary/5 rounded-full blur-[120px] -z-10" />
        
        <div className="container text-center space-y-8">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-primary/30 bg-primary/5 text-primary text-sm font-bold animate-fade-in">
            <Sparkles className="h-4 w-4" /> ÚNICO NO BRASIL — IA + OCR PARA OPÇÕES B3
          </div>
          
          <h1 className="text-5xl sm:text-7xl lg:text-8xl font-black tracking-tighter leading-[0.85] animate-fade-in">
            VOCÊ ESTÁ <span className="text-primary">PERDENDO<br />DINHEIRO</span> SEM SABER.
          </h1>
          
          <p className="text-xl sm:text-2xl text-muted-foreground max-w-3xl mx-auto font-medium leading-relaxed">
            <span className="text-foreground font-bold">97% dos traders de opções</span> não sabem se suas estruturas vencem o CDI.
            O OpçõesX resolve isso em <span className="text-primary font-bold">2 segundos</span>.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
            <Button 
              size="lg" 
              className="h-16 px-12 text-xl font-black shadow-[0_20px_50px_-12px_hsl(var(--primary)/0.5)] hover:scale-105 transition-transform" 
              onClick={() => navigate('/auth')}
            >
              QUERO PARAR DE PERDER <ArrowRight className="ml-2 h-6 w-6" />
            </Button>
            <p className="text-xs text-muted-foreground self-center">Grátis • Sem cartão • 3 simulações/mês</p>
          </div>

          {/* Social proof bar */}
          <div className="flex flex-wrap items-center justify-center gap-6 sm:gap-10 pt-8 text-sm font-bold text-muted-foreground">
            <div className="flex items-center gap-2"><Trophy className="h-5 w-5 text-yellow-500" /> #1 EM OCR B3</div>
            <div className="flex items-center gap-2"><Shield className="h-5 w-5 text-green-500" /> DADOS 100% SEGUROS</div>
            <div className="flex items-center gap-2"><Brain className="h-5 w-5 text-primary" /> IA EXCLUSIVA</div>
            <div className="flex items-center gap-2"><Users className="h-5 w-5 text-primary" /> +500 TRADERS</div>
          </div>
        </div>
      </section>

      {/* HERO IMAGE - App Screenshot */}
      <section className="container -mt-8 mb-20">
        <div className="relative rounded-2xl overflow-hidden border-2 border-primary/30 shadow-[0_40px_100px_-20px_hsl(var(--primary)/0.3)]">
          <img 
            src={screenshotPayoff} 
            alt="Dashboard OpçõesX - Gráfico de Payoff com análise de opções B3" 
            className="w-full h-auto"
            loading="lazy"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-background/60 via-transparent to-transparent" />
          <div className="absolute bottom-6 left-6 right-6 flex items-center justify-between">
            <Badge className="bg-primary/90 text-primary-foreground font-black text-sm py-1.5 px-4">
              <Eye className="h-4 w-4 mr-2" /> PAYOFF EM TEMPO REAL
            </Badge>
            <Badge variant="outline" className="border-primary/40 text-primary bg-background/80 font-bold">
              Versão PRO
            </Badge>
          </div>
        </div>
      </section>

      {/* PAIN POINTS - O que você está fazendo errado */}
      <section className="container py-20">
        <div className="text-center space-y-4 mb-16">
          <h2 className="text-4xl sm:text-6xl font-black tracking-tighter">
            ENQUANTO VOCÊ USA <span className="text-destructive">PLANILHA,</span><br />
            SEU DINHEIRO <span className="text-destructive">EVAPORA.</span>
          </h2>
        </div>

        <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
          {/* OLD WAY */}
          <Card className="p-8 border-2 border-destructive/30 bg-destructive/[0.03] space-y-6 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-40 h-40 bg-destructive/10 rounded-full blur-[80px]" />
            <div className="relative">
              <h3 className="text-xl font-black text-destructive flex items-center gap-2 mb-6">
                <XCircle className="h-6 w-6" /> SEM OPÇÕESX
              </h3>
              <ul className="space-y-5">
                {[
                  'Digita perna por perna na planilha — lento e cheio de erros',
                  'Faz Black-Scholes no Excel sem saber se o cálculo está certo',
                  'Nunca compara com CDI — opera sem benchmark',
                  'Toma decisão por "feeling" — perde dinheiro e nem percebe',
                ].map((text, i) => (
                  <li key={i} className="flex items-start gap-3 text-sm font-medium text-muted-foreground">
                    <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0 text-destructive" /> {text}
                  </li>
                ))}
              </ul>
            </div>
          </Card>

          {/* NEW WAY */}
          <Card className="p-8 border-2 border-primary/40 bg-primary/[0.05] space-y-6 relative overflow-hidden shadow-[0_0_60px_-12px_hsl(var(--primary)/0.3)]">
            <div className="absolute top-0 right-0 w-40 h-40 bg-primary/10 rounded-full blur-[80px]" />
            <div className="relative">
              <h3 className="text-xl font-black text-primary flex items-center gap-2 mb-6">
                <CheckCircle2 className="h-6 w-6" /> COM OPÇÕESX
              </h3>
              <ul className="space-y-5">
                {[
                  { icon: Rocket, text: 'Print da corretora → Payoff montado em 2 segundos (OCR)' },
                  { icon: Brain, text: 'IA analisa e diz: "Vence o CDI?" ou "Risco Desnecessário?"' },
                  { icon: Target, text: 'Gráfico exclusivo de 3 cores mostra onde você ganha ou perde vs CDI' },
                  { icon: Star, text: 'Portfólio consolida P&L real de todas as suas operações' },
                ].map((item, i) => (
                  <li key={i} className="flex items-start gap-3 text-sm font-bold">
                    <item.icon className="h-4 w-4 mt-0.5 text-primary shrink-0" /> {item.text}
                  </li>
                ))}
              </ul>
            </div>
          </Card>
        </div>
      </section>

      {/* FEATURE 1 - OCR */}
      <section className="container py-20">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div className="space-y-6">
            <Badge variant="outline" className="border-primary/30 text-primary bg-primary/5 font-bold">
              <Zap className="h-3.5 w-3.5 mr-2" /> FUNCIONALIDADE #1
            </Badge>
            <h2 className="text-4xl sm:text-5xl font-black tracking-tighter leading-tight">
              TIRE UM PRINT.<br />
              <span className="text-primary">O APP FAZ O RESTO.</span>
            </h2>
            <p className="text-lg text-muted-foreground leading-relaxed">
              Nosso <span className="text-foreground font-bold">OCR com IA</span> lê o screenshot da sua corretora e 
              monta automaticamente todas as pernas da sua estrutura de opções. 
              <span className="text-primary font-bold"> Chega de digitação manual.</span>
            </p>
            <div className="flex flex-col gap-3">
              {['Reconhece PETR4, VALE3, BOVA11 e mais', 'Identifica calls, puts, strikes e quantidades', 'Funciona com qualquer corretora brasileira'].map((t, i) => (
                <div key={i} className="flex items-center gap-3 text-sm font-bold">
                  <CheckCircle2 className="h-5 w-5 text-primary shrink-0" /> {t}
                </div>
              ))}
            </div>
            <Button size="lg" className="font-black mt-4 shadow-lg shadow-primary/20" onClick={() => navigate('/auth')}>
              TESTAR OCR AGORA <ChevronRight className="ml-1 h-5 w-5" />
            </Button>
          </div>
          <div className="relative rounded-2xl overflow-hidden border-2 border-primary/20 shadow-2xl">
            <img src={screenshotOCR} alt="OCR OpçõesX - Upload de imagem da corretora" className="w-full h-auto" loading="lazy" />
            <div className="absolute inset-0 bg-gradient-to-t from-background/40 to-transparent" />
          </div>
        </div>
      </section>

      {/* FEATURE 2 - AI Analysis */}
      <section className="container py-20">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div className="order-2 lg:order-1 relative rounded-2xl overflow-hidden border-2 border-primary/20 shadow-2xl">
            <img src={screenshotAI} alt="Análise IA OpçõesX - Veredito e Benchmark CDI" className="w-full h-auto" loading="lazy" />
            <div className="absolute inset-0 bg-gradient-to-t from-background/40 to-transparent" />
          </div>
          <div className="order-1 lg:order-2 space-y-6">
            <Badge variant="outline" className="border-primary/30 text-primary bg-primary/5 font-bold">
              <Brain className="h-3.5 w-3.5 mr-2" /> FUNCIONALIDADE #2
            </Badge>
            <h2 className="text-4xl sm:text-5xl font-black tracking-tighter leading-tight">
              IA QUE DÁ <span className="text-primary">VEREDITO REAL.</span><br />
              NÃO "DEPENDE".
            </h2>
            <p className="text-lg text-muted-foreground leading-relaxed">
              Nossa Inteligência Artificial analisa sua estrutura e responde a pergunta que nenhuma planilha responde:
              <span className="text-primary font-bold"> "Essa operação VENCE o CDI ou não?"</span>
            </p>
            <div className="flex flex-col gap-3">
              {['Análise de risco/retorno com nota de 0 a 10', 'Comparativo automático com Tesouro Selic', 'Sugestão de ajuste quando o risco não compensa'].map((t, i) => (
                <div key={i} className="flex items-center gap-3 text-sm font-bold">
                  <CheckCircle2 className="h-5 w-5 text-primary shrink-0" /> {t}
                </div>
              ))}
            </div>
            <Button size="lg" className="font-black mt-4 shadow-lg shadow-primary/20" onClick={() => navigate('/auth')}>
              VER IA EM AÇÃO <ChevronRight className="ml-1 h-5 w-5" />
            </Button>
          </div>
        </div>
      </section>

      {/* STATS BAR */}
      <section className="container py-16">
        <div className="rounded-3xl border-2 border-primary/20 bg-gradient-to-r from-primary/[0.05] via-primary/[0.02] to-primary/[0.05] p-10">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            {[
              { value: '2s', label: 'Para montar payoff via OCR', icon: Clock },
              { value: '100%', label: 'Precisão no cálculo de P&L', icon: Target },
              { value: '3 cores', label: 'No gráfico exclusivo vs CDI', icon: BarChart3 },
              { value: '∞', label: 'Simulações no plano PRO', icon: Sparkles },
            ].map((s, i) => (
              <div key={i} className="space-y-2">
                <s.icon className="h-6 w-6 mx-auto text-primary" />
                <p className="text-3xl sm:text-4xl font-black text-primary">{s.value}</p>
                <p className="text-xs sm:text-sm text-muted-foreground font-medium">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PRICING - Aggressive */}
      <section className="container py-20 space-y-16">
        <div className="text-center space-y-4">
          <h2 className="text-4xl sm:text-6xl font-black tracking-tighter">
            QUANTO CUSTA <span className="text-primary">PARAR<br />DE PERDER DINHEIRO?</span>
          </h2>
          <p className="text-lg text-muted-foreground max-w-xl mx-auto">
            Menos que um almoço por mês. Comece grátis agora.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
          {/* Free */}
          <Card className="p-10 border-2 border-border/40 bg-card/50 space-y-8">
            <div className="space-y-2">
              <h3 className="text-2xl font-black tracking-tight">FREE</h3>
              <p className="text-4xl font-black tracking-tighter">R$ 0<span className="text-sm text-muted-foreground font-medium">/mês</span></p>
              <p className="text-sm text-muted-foreground">Para testar e ver o poder do app</p>
            </div>
            <ul className="space-y-4">
              <li className="flex items-center gap-3 text-sm font-bold"><CheckCircle2 className="h-5 w-5 text-green-500" /> 3 Simulações por mês</li>
              <li className="flex items-center gap-3 text-sm font-bold"><CheckCircle2 className="h-5 w-5 text-green-500" /> Gráfico de Payoff Completo</li>
              <li className="flex items-center gap-3 text-sm font-bold"><CheckCircle2 className="h-5 w-5 text-green-500" /> Benchmark CDI Básico</li>
              <li className="flex items-center gap-3 text-sm font-bold text-muted-foreground"><Lock className="h-5 w-5" /> OCR de Imagem</li>
              <li className="flex items-center gap-3 text-sm font-bold text-muted-foreground"><Lock className="h-5 w-5" /> Análise com IA</li>
              <li className="flex items-center gap-3 text-sm font-bold text-muted-foreground"><Lock className="h-5 w-5" /> Portfólio de Operações</li>
            </ul>
            <Button variant="outline" className="w-full h-12 font-black" onClick={() => navigate('/auth')}>
              COMEÇAR GRÁTIS
            </Button>
          </Card>

          {/* PRO */}
          <Card className="p-10 border-2 border-primary bg-gradient-to-br from-primary/10 via-card to-card space-y-8 relative overflow-hidden">
            <div className="absolute -top-1 -right-1">
              <div className="bg-primary text-primary-foreground font-black text-xs py-2 px-6 rounded-bl-xl">
                🔥 MAIS VENDIDO
              </div>
            </div>
            <div className="space-y-2">
              <h3 className="text-2xl font-black tracking-tight text-primary">PRO</h3>
              <div className="flex items-baseline gap-2">
                <p className="text-4xl font-black tracking-tighter">R$ {proPrice.toFixed(2)}</p>
                <span className="text-sm text-muted-foreground font-medium">/mês</span>
              </div>
              <p className="text-sm text-primary font-bold">= R$ {(proPrice / 30).toFixed(2)}/dia para nunca mais operar no escuro</p>
            </div>
            <ul className="space-y-4">
              <li className="flex items-center gap-3 text-sm font-bold"><CheckCircle2 className="h-5 w-5 text-primary" /> Simulações ILIMITADAS</li>
              <li className="flex items-center gap-3 text-sm font-bold"><CheckCircle2 className="h-5 w-5 text-primary" /> OCR de Imagem ILIMITADO</li>
              <li className="flex items-center gap-3 text-sm font-bold"><CheckCircle2 className="h-5 w-5 text-primary" /> Análise com IA ILIMITADA</li>
              <li className="flex items-center gap-3 text-sm font-bold"><CheckCircle2 className="h-5 w-5 text-primary" /> Portfólio com P&L Consolidado</li>
              <li className="flex items-center gap-3 text-sm font-bold"><CheckCircle2 className="h-5 w-5 text-primary" /> Benchmark CDI Avançado</li>
              <li className="flex items-center gap-3 text-sm font-bold"><CheckCircle2 className="h-5 w-5 text-primary" /> Suporte Prioritário</li>
            </ul>
            <Button className="w-full h-14 text-lg font-black shadow-[0_20px_50px_-12px_hsl(var(--primary)/0.5)]" onClick={() => navigate('/auth')}>
              ASSINAR PRO AGORA <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
            <p className="text-center text-xs text-muted-foreground">Cancele quando quiser • Sem fidelidade</p>
          </Card>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="container py-20">
        <div className="rounded-3xl border-2 border-primary/30 bg-gradient-to-br from-primary/10 via-background to-background p-12 sm:p-16 text-center space-y-8 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary/10 rounded-full blur-[200px] -z-10" />
          <h2 className="text-4xl sm:text-6xl font-black tracking-tighter leading-tight relative">
            CADA DIA SEM O OPÇÕESX<br />
            É DINHEIRO QUE VOCÊ <span className="text-primary">DEIXA NA MESA.</span>
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Traders profissionais já estão usando IA e OCR para tomar decisões melhores. 
            E você, vai continuar no Excel?
          </p>
          <Button 
            size="lg" 
            className="h-16 px-12 text-xl font-black shadow-[0_20px_50px_-12px_hsl(var(--primary)/0.5)] hover:scale-105 transition-transform" 
            onClick={() => navigate('/auth')}
          >
            COMEÇAR AGORA — É GRÁTIS <ArrowRight className="ml-2 h-6 w-6" />
          </Button>
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
            <a href="#" className="hover:text-primary transition-colors">Termos de Uso</a>
            <a href="#" className="hover:text-primary transition-colors">Privacidade</a>
            <a href="#" className="hover:text-primary transition-colors">Contato</a>
          </div>
        </div>
      </footer>
    </div>
  );
}