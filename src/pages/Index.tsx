import { useAuth } from '@/contexts/AuthContext';
import { useNavigate, Navigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { 
  TrendingUp, ArrowRight, Brain, Target, CheckCircle2,
  Lock, Sparkles, XCircle, AlertTriangle,
  Shield, Zap, BarChart3, MousePointer2, Camera,
  Layers, FileSpreadsheet, Cpu, Smartphone
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
            ABANDONE AS <span className="text-primary">PLANILHAS.</span><br />
            OPERE COM IA.
          </h1>
          
          <p className="text-xl sm:text-2xl text-muted-foreground max-w-3xl mx-auto font-medium leading-relaxed">
            A evolução do trader de opções chegou. Analise estruturas complexas em segundos com <span className="text-foreground font-bold">OCR e Inteligência Artificial</span>.
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

      {/* MAIN PREVIEW */}
      <section className="container -mt-8 mb-20">
        <div className="relative rounded-2xl overflow-hidden border-2 border-primary/30 shadow-[0_40px_100px_-20px_hsl(var(--primary)/0.3)] bg-card">
          <img 
            src="/assets/dashboard.png" 
            alt="Dashboard OpçõesX" 
            className="w-full h-auto"
          />
        </div>
      </section>

      {/* COMPARISON SECTION: APP VS SPREADSHEETS */}
      <section className="container py-24">
        <div className="text-center mb-16 space-y-4">
          <Badge variant="outline" className="border-primary/30 text-primary font-bold">O FIM DA ERA MANUAL</Badge>
          <h2 className="text-4xl sm:text-6xl font-black tracking-tighter">OpçõesX vs. Planilhas</h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">Por que os melhores traders estão abandonando o Excel?</p>
        </div>

        <div className="grid md:grid-cols-2 gap-8">
          {/* Planilhas */}
          <Card className="p-8 border-destructive/20 bg-destructive/5 space-y-6 opacity-80">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-destructive/10 flex items-center justify-center text-destructive">
                <FileSpreadsheet className="h-6 w-6" />
              </div>
              <h3 className="text-2xl font-black">Planilhas Comuns</h3>
            </div>
            <ul className="space-y-4">
              <li className="flex items-start gap-3 text-sm font-medium text-muted-foreground">
                <XCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                Entrada manual lenta e sujeita a erros de digitação.
              </li>
              <li className="flex items-start gap-3 text-sm font-medium text-muted-foreground">
                <XCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                Fórmulas complexas que quebram e exigem manutenção.
              </li>
              <li className="flex items-start gap-3 text-sm font-medium text-muted-foreground">
                <XCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                Sem comparativo real com o CDI ou custo de oportunidade.
              </li>
              <li className="flex items-start gap-3 text-sm font-medium text-muted-foreground">
                <XCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                Impossível de usar no celular durante o pregão.
              </li>
            </ul>
          </Card>

          {/* OpçõesX */}
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
              <li className="flex items-start gap-3 text-sm font-bold">
                <CheckCircle2 className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                OCR: Tire um print e a IA lê as pernas instantaneamente.
              </li>
              <li className="flex items-start gap-3 text-sm font-bold">
                <CheckCircle2 className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                Análise Quantitativa: IA interpreta o risco e sugere ajustes.
              </li>
              <li className="flex items-start gap-3 text-sm font-bold">
                <CheckCircle2 className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                Eficiência vs CDI: Saiba se sua operação vale o risco.
              </li>
              <li className="flex items-start gap-3 text-sm font-bold">
                <CheckCircle2 className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                Mobile-First: Analise e acompanhe de qualquer lugar.
              </li>
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
                <p className="font-bold text-sm">Upload de Imagem IA Powered</p>
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

      {/* AI ANALYSIS */}
      <section className="container py-24">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          <div className="order-2 lg:order-1 rounded-2xl overflow-hidden border-2 border-primary/20 shadow-2xl">
            <img src="/assets/ai_report.png" alt="Relatório de IA" className="w-full h-auto" />
          </div>
          <div className="order-1 lg:order-2 space-y-8">
            <div className="space-y-4">
              <Badge variant="outline" className="border-primary/30 text-primary font-bold">INTELIGÊNCIA ARTIFICIAL</Badge>
              <h2 className="text-4xl font-black tracking-tighter">Um Analista Sênior no seu Bolso.</h2>
              <p className="text-lg text-muted-foreground">
                Nossa IA analisa a atratividade, o risco e a probabilidade de sucesso da sua estrutura, fornecendo um resumo executivo técnico.
              </p>
            </div>
            <div className="space-y-4">
              <img src="/assets/strategy_scenarios.png" alt="Cenários de Mercado" className="rounded-xl border border-border/40 shadow-lg" />
              <p className="text-sm font-bold text-center text-muted-foreground italic">Simulação completa de cenários: Alta, Lateral ou Baixa.</p>
            </div>
          </div>
        </div>
      </section>

      {/* PAYOFF & CDI */}
      <section className="container py-20 bg-primary/5 rounded-[3rem] border border-primary/10">
        <div className="text-center mb-12 space-y-4">
          <h2 className="text-4xl font-black tracking-tighter">Métricas que Realmente Importam</h2>
          <p className="text-lg text-muted-foreground">Compare sua estratégia com o benchmark mais importante do Brasil: o CDI.</p>
        </div>
        <div className="grid lg:grid-cols-2 gap-8">
          <div className="rounded-2xl overflow-hidden border-2 border-primary/20 shadow-xl bg-card">
            <img src="/assets/payoff_chart.png" alt="Gráfico de Payoff" className="w-full h-auto" />
          </div>
          <div className="rounded-2xl overflow-hidden border-2 border-primary/20 shadow-xl bg-card">
            <img src="/assets/cdi_comparison.png" alt="Comparativo CDI" className="w-full h-auto" />
          </div>
        </div>
      </section>

      {/* PORTFOLIO */}
      <section className="container py-24">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          <div className="space-y-8">
            <div className="space-y-4">
              <Badge variant="outline" className="border-primary/30 text-primary font-bold">GESTÃO DE RISCO</Badge>
              <h2 className="text-4xl font-black tracking-tighter">Seu Portfólio, Profissionalizado.</h2>
              <p className="text-lg text-muted-foreground">
                Acompanhe seu P&L consolidado, taxa de acerto e ROI total. Saiba exatamente quanto você está ganhando (ou perdendo) em cada estrutura.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Card className="p-4 text-center border-success/20 bg-success/5">
                <p className="text-2xl font-black text-success">100%</p>
                <p className="text-[10px] font-bold uppercase">Taxa de Acerto</p>
              </Card>
              <Card className="p-4 text-center border-primary/20 bg-primary/5">
                <p className="text-2xl font-black text-primary">+24.16%</p>
                <p className="text-[10px] font-bold uppercase">ROI Consolidado</p>
              </Card>
            </div>
          </div>
          <div className="rounded-2xl overflow-hidden border-2 border-primary/20 shadow-2xl">
            <img src="/assets/portfolio.png" alt="Portfólio" className="w-full h-auto" />
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