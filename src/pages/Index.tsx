import { useAuth } from '@/contexts/AuthContext';
import { useNavigate, Navigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { 
  TrendingUp, ArrowRight, Brain, CheckCircle2,
  Lock, Sparkles, XCircle,
  Zap, Camera, FileSpreadsheet, Cpu, Star,
  BarChart3, PieChart, Bot, Radio
} from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';
import { Sun, Moon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export default function Index() {
  const { user, loading } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
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
      } catch (e) {
        console.error("Erro ao buscar preço do plano PRO:", e);
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
            <img src="/assets/logo.png" alt="Opções PRO X" className="h-10 w-10 object-contain" />
            <span className="tracking-tighter">Opções PRO X</span>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={toggleTheme} className="rounded-full">
              {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </Button>
            <Button variant="ghost" onClick={() => navigate('/auth')} className="font-bold hidden sm:inline-flex">Login</Button>
            <Button onClick={() => navigate('/auth')} className="font-bold shadow-lg shadow-primary/20">
              7 Dias Grátis <ArrowRight className="ml-1 h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* HERO */}
      <section className="relative pt-16 pb-24 overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1200px] h-[800px] bg-primary/10 rounded-full blur-[200px] -z-10" />
        
        <div className="container text-center space-y-8">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-primary/30 bg-primary/5 text-primary text-sm font-bold animate-fade-in">
            <Sparkles className="h-4 w-4" /> ANÁLISE DE OPÇÕES COM IA — ÚNICO NO BRASIL
          </div>
          
          <h1 className="text-5xl sm:text-7xl lg:text-8xl font-black tracking-tighter leading-[0.85] animate-fade-in">
            ANALISE SUAS <span className="text-primary">OPÇÕES</span><br />
            COM UM <span className="text-primary">PRINT.</span>
          </h1>
          
          <p className="text-xl sm:text-2xl text-muted-foreground max-w-3xl mx-auto font-medium leading-relaxed">
            Tire um print da sua estrutura na corretora e receba <span className="text-foreground font-bold">payoff, métricas e análise de IA</span> em segundos. Sem planilhas, sem fórmulas.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
            <Button 
              size="lg" 
              className="h-16 px-12 text-xl font-black shadow-[0_20px_50px_-12px_hsl(var(--primary)/0.5)] hover:scale-105 transition-transform" 
              onClick={() => navigate('/auth')}
            >
              TESTAR 7 DIAS GRÁTIS <ArrowRight className="ml-2 h-6 w-6" />
            </Button>
          </div>
        </div>
      </section>

      {/* MAIN PREVIEW */}
      <section className="container -mt-8 mb-20">
        <div className="relative rounded-2xl overflow-hidden border-2 border-primary/30 shadow-[0_40px_100px_-20px_hsl(var(--primary)/0.3)] bg-card">
          <img src="/assets/screenshot-dashboard.png" alt="Dashboard OpçõesX" className="w-full h-auto" loading="lazy" />
        </div>
      </section>

      {/* FEATURES SHOWCASE */}
      <section className="container py-24">
        <div className="text-center mb-16 space-y-4">
          <Badge variant="outline" className="border-primary/30 text-primary font-bold">FUNCIONALIDADES</Badge>
          <h2 className="text-4xl sm:text-6xl font-black tracking-tighter">Tudo que Você Precisa</h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">Do upload de imagem ao relatório de IA, tudo em uma plataforma.</p>
        </div>

        <div className="grid md:grid-cols-2 gap-10">
          {/* OCR */}
          <div className="space-y-6">
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-primary/20 flex items-center justify-center"><Camera className="h-5 w-5 text-primary" /></div>
                <h3 className="text-2xl font-black tracking-tight">OCR Inteligente</h3>
                <Badge className="bg-primary/20 text-primary border-0 text-[10px] font-black">PRO</Badge>
              </div>
              <p className="text-muted-foreground">Tire um print da corretora e a IA lê strikes, prêmios e quantidades em 2 segundos.</p>
            </div>
            <div className="rounded-2xl overflow-hidden border border-primary/20 shadow-xl">
              <img src="/assets/screenshot-ocr.png" alt="OCR Upload" className="w-full h-auto" loading="lazy" />
            </div>
          </div>

          {/* Análise IA */}
          <div className="space-y-6">
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-primary/20 flex items-center justify-center"><Bot className="h-5 w-5 text-primary" /></div>
                <h3 className="text-2xl font-black tracking-tight">Análise com IA</h3>
                <Badge className="bg-primary/20 text-primary border-0 text-[10px] font-black">PRO</Badge>
              </div>
              <p className="text-muted-foreground">Relatório quantitativo com nota de atratividade, risco, cenários e sugestões da IA.</p>
            </div>
            <div className="rounded-2xl overflow-hidden border border-primary/20 shadow-xl">
              <img src="/assets/screenshot-ai-report.png" alt="Relatório de IA" className="w-full h-auto" loading="lazy" />
            </div>
          </div>

          {/* Payoff */}
          <div className="space-y-6">
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-primary/20 flex items-center justify-center"><BarChart3 className="h-5 w-5 text-primary" /></div>
                <h3 className="text-2xl font-black tracking-tight">Gráfico de Payoff</h3>
                <Badge className="bg-muted text-muted-foreground border-0 text-[10px] font-black">FREE</Badge>
              </div>
              <p className="text-muted-foreground">Visualize lucro máximo, risco máximo, breakeven e métricas em tempo real.</p>
            </div>
            <div className="rounded-2xl overflow-hidden border border-primary/20 shadow-xl">
              <img src="/assets/screenshot-payoff.png" alt="Gráfico de Payoff" className="w-full h-auto" loading="lazy" />
            </div>
          </div>

          {/* CDI */}
          <div className="space-y-6">
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-primary/20 flex items-center justify-center"><PieChart className="h-5 w-5 text-primary" /></div>
                <h3 className="text-2xl font-black tracking-tight">Comparativo CDI</h3>
                <Badge className="bg-muted text-muted-foreground border-0 text-[10px] font-black">FREE</Badge>
              </div>
              <p className="text-muted-foreground">Compare sua estratégia contra o CDI e saiba se o risco vale a pena.</p>
            </div>
            <div className="rounded-2xl overflow-hidden border border-primary/20 shadow-xl">
              <img src="/assets/screenshot-cdi.png" alt="Comparativo CDI" className="w-full h-auto" loading="lazy" />
            </div>
          </div>
        </div>

        {/* Portfólio, Diversificador, Manual row */}
        <div className="grid md:grid-cols-2 gap-10 mt-10">

          <div className="space-y-6">
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-primary/20 flex items-center justify-center"><TrendingUp className="h-5 w-5 text-primary" /></div>
                <h3 className="text-2xl font-black tracking-tight">Portfólio P&L</h3>
                <Badge className="bg-primary/20 text-primary border-0 text-[10px] font-black">PRO</Badge>
              </div>
              <p className="text-muted-foreground">Acompanhe P&L consolidado, ROI total e taxa de acerto das suas operações.</p>
            </div>
            <div className="rounded-2xl overflow-hidden border border-primary/20 shadow-xl">
              <img src="/assets/screenshot-portfolio.png" alt="Portfólio" className="w-full h-auto" loading="lazy" />
            </div>
          </div>

          {/* Diversificador */}
          <div className="space-y-6">
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-primary/20 flex items-center justify-center"><PieChart className="h-5 w-5 text-primary" /></div>
                <h3 className="text-2xl font-black tracking-tight">Diversificador</h3>
                <Badge className="bg-primary/20 text-primary border-0 text-[10px] font-black">PRO</Badge>
              </div>
              <p className="text-muted-foreground">Gerencie a alocação do seu patrimônio entre estratégias com balanceamento automático e controle de risco.</p>
            </div>
            <div className="rounded-2xl overflow-hidden border border-primary/20 shadow-xl">
              <img src="/assets/screenshot-diversificador.png" alt="Diversificador de Portfólio" className="w-full h-auto" loading="lazy" />
            </div>
          </div>
        </div>

        {/* Manual row */}
        <div className="grid md:grid-cols-2 gap-10 mt-10">
          <div className="space-y-6">
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-primary/20 flex items-center justify-center"><Brain className="h-5 w-5 text-primary" /></div>
                <h3 className="text-2xl font-black tracking-tight">Manual de Estratégias</h3>
                <Badge className="bg-muted text-muted-foreground border-0 text-[10px] font-black">FREE</Badge>
              </div>
              <p className="text-muted-foreground">Aprenda 9+ estratégias de opções com exemplos reais, gráficos de payoff, gregas e tabela comparativa completa.</p>
            </div>
            <div className="rounded-2xl overflow-hidden border border-primary/20 shadow-xl bg-card p-6 space-y-3">
              <div className="grid grid-cols-3 gap-2">
                {['Covered Call', 'Iron Condor', 'Box Spread', 'Straddle', 'Bull Call', 'Collar'].map(s => (
                  <div key={s} className="rounded-lg bg-primary/10 border border-primary/20 p-3 text-center">
                    <p className="text-xs font-black text-primary">{s}</p>
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground text-center font-bold">+ Ratio Spread, Calendar Spread, Backspread e mais</p>
            </div>
          </div>
        </div>
      </section>

      {/* COMPARISON: PLANILHAS VS APP */}
      <section className="container py-24">
        <div className="text-center mb-16 space-y-4">
          <Badge variant="outline" className="border-primary/30 text-primary font-bold">O FIM DA ERA MANUAL</Badge>
          <h2 className="text-4xl sm:text-6xl font-black tracking-tighter">OpçõesX vs. Planilhas</h2>
        </div>

        <div className="grid md:grid-cols-2 gap-8">
          <Card className="p-8 border-destructive/20 bg-destructive/5 space-y-6 opacity-80">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-destructive/10 flex items-center justify-center text-destructive">
                <FileSpreadsheet className="h-6 w-6" />
              </div>
              <h3 className="text-2xl font-black">Planilhas</h3>
            </div>
            <ul className="space-y-4">
              {[
                'Entrada manual lenta e sujeita a erros.',
                'Fórmulas que quebram e exigem manutenção.',
                'Sem comparativo real com o CDI.',
                'Impossível de usar no celular durante o pregão.',
              ].map((t, i) => (
                <li key={i} className="flex items-start gap-3 text-sm font-medium text-muted-foreground">
                  <XCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />{t}
                </li>
              ))}
            </ul>
          </Card>

          <Card className="p-8 border-primary/30 bg-primary/5 space-y-6 shadow-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4">
              <Badge className="bg-primary text-primary-foreground font-black">VENCEDOR</Badge>
            </div>
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-primary/20 flex items-center justify-center text-primary">
                <Cpu className="h-6 w-6" />
              </div>
              <h3 className="text-2xl font-black">OpçõesX (IA)</h3>
            </div>
            <ul className="space-y-4">
              {[
                'OCR: Print → pernas instantaneamente.',
                'IA interpreta risco e sugere ajustes.',
                'Eficiência vs CDI: saiba se o risco vale.',
                'Mobile-First: analise de qualquer lugar.',
              ].map((t, i) => (
                <li key={i} className="flex items-start gap-3 text-sm font-bold">
                  <CheckCircle2 className="h-5 w-5 text-primary shrink-0 mt-0.5" />{t}
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </section>

      {/* OCR FEATURE */}
      <section className="container py-20 bg-muted/30 rounded-[3rem]">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          <div className="space-y-8">
            <div className="space-y-4">
              <Badge variant="outline" className="border-primary/30 text-primary font-bold">TECNOLOGIA OCR</Badge>
              <h2 className="text-4xl font-black tracking-tighter">Do Print para o Payoff em 2 segundos.</h2>
              <p className="text-lg text-muted-foreground">
                Chega de digitar strikes e prêmios. Nossa IA lê capturas de tela do Profit, FlexScan ou Home Broker e monta a estrutura para você.
              </p>
            </div>
            <div className="grid gap-4">
              <div className="flex items-center gap-4 p-4 rounded-xl bg-card border border-border/40">
                <Camera className="h-6 w-6 text-primary" />
                <p className="font-bold text-sm">Upload de Imagem IA POWERED</p>
              </div>
              <div className="flex items-center gap-4 p-4 rounded-xl bg-card border border-border/40">
                <Zap className="h-6 w-6 text-primary" />
                <p className="font-bold text-sm">Extração Instantânea de Dados B3</p>
              </div>
            </div>
          </div>
          <div className="rounded-2xl overflow-hidden border-2 border-primary/20 shadow-2xl">
            <img src="/assets/ocr_upload.png" alt="OCR Upload" className="w-full h-auto" />
          </div>
        </div>
      </section>

      {/* PRICING — FREE vs PRO */}
      <section className="container py-24">
        <div className="text-center mb-16 space-y-4">
          <Badge variant="outline" className="border-primary/30 text-primary font-bold">PLANOS</Badge>
          <h2 className="text-5xl font-black tracking-tighter">FREE vs. PRO</h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">Comece com <span className="text-foreground font-bold">7 dias grátis</span> e evolua quando quiser. Sem surpresas.</p>
        </div>

        <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
          {/* FREE */}
          <Card className="p-10 border-2 border-primary/30 bg-card/50 space-y-8 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary/60 to-primary/20" />
            <div className="space-y-2">
              <h3 className="text-2xl font-black tracking-tight">FREE</h3>
              <p className="text-4xl font-black tracking-tighter">R$ 0<span className="text-sm text-muted-foreground font-medium">/mês</span></p>
              <p className="text-sm text-primary font-bold">✨ 7 dias com acesso TOTAL</p>
            </div>
            <ul className="space-y-3">
              <PricingItem included label="7 dias grátis — acesso completo" highlight />
              <PricingItem included label="Gráfico de Payoff completo" />
              <PricingItem included label="Comparativo vs CDI" />
              <PricingItem included label="Entrada manual de pernas" />
              <PricingItem included label="Métricas (lucro, risco, breakeven)" />
              <PricingItem included label="OCR de Imagem (IA)" />
              <PricingItem included label="Análise com Inteligência Artificial" />
              <PricingItem included label="Portfólio e P&L consolidado" />
            </ul>
            <Button className="w-full h-14 text-lg font-black bg-primary hover:bg-primary/90 shadow-[0_0_30px_-8px_hsl(var(--primary)/0.5)] hover:scale-[1.02] transition-transform" onClick={() => navigate('/auth')}>
              TESTAR 7 DIAS GRÁTIS <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </Card>

          {/* PRO */}
          <Card className="p-10 border-2 border-primary bg-gradient-to-br from-primary/10 via-card to-card space-y-8 relative overflow-hidden shadow-2xl">
            <div className="absolute -top-1 -right-1">
              <div className="bg-primary text-primary-foreground font-black text-xs py-2 px-6 rounded-bl-xl flex items-center gap-1">
                <Star className="h-3 w-3" /> MAIS VENDIDO
              </div>
            </div>
            <div className="space-y-2">
              <h3 className="text-2xl font-black tracking-tight text-primary">PRO</h3>
              <p className="text-4xl font-black tracking-tighter">R$ {proPrice.toFixed(2)}<span className="text-sm text-muted-foreground font-medium">/mês</span></p>
              <p className="text-sm text-muted-foreground">Para quem opera de verdade</p>
            </div>
            <ul className="space-y-3">
              <PricingItem included pro label="Simulações ILIMITADAS" />
              <PricingItem included pro label="Gráfico de Payoff completo" />
              <PricingItem included pro label="Comparativo vs CDI" />
              <PricingItem included pro label="Entrada manual de pernas" />
              <PricingItem included pro label="Métricas (lucro, risco, breakeven)" />
              <PricingItem included pro label="OCR de Imagem (IA)" highlight />
              <PricingItem included pro label="Análise com Inteligência Artificial" highlight />
              <PricingItem included pro label="Portfólio e P&L consolidado" highlight />
              <PricingItem included pro label="Histórico de análises" highlight />
              <PricingItem included pro label="Tempo Real — Conexão Profit RTD" highlight />
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
            <img src="/assets/logo.png" alt="Opções PRO X" className="h-8 w-8 object-contain" />
            <span className="tracking-tighter">Opções PRO X</span>
          </div>
          <p className="text-[10px] text-muted-foreground max-w-3xl mx-auto leading-relaxed">
            AVISO LEGAL: Este aplicativo é uma ferramenta de simulação algorítmica baseada nas regras da B3. Os dados apresentados não constituem recomendação de investimento. Verifique os dados com sua corretora antes de operar.
          </p>
        </div>
      </footer>
    </div>
  );
}

function PricingItem({ included, locked, label, pro, highlight }: { included?: boolean; locked?: boolean; label: string; pro?: boolean; highlight?: boolean }) {
  if (locked) {
    return (
      <li className="flex items-center gap-3 text-sm font-bold text-muted-foreground/50">
        <Lock className="h-4 w-4 shrink-0" /> {label}
      </li>
    );
  }
  return (
    <li className={`flex items-center gap-3 text-sm font-bold ${highlight ? 'text-primary' : ''}`}>
      <CheckCircle2 className={`h-4 w-4 shrink-0 ${pro ? 'text-primary' : 'text-green-500'}`} /> {label}
    </li>
  );
}