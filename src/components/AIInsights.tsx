import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Brain, TrendingUp, AlertTriangle, CheckCircle2, 
  Zap, ShieldCheck, Target, BarChart3,
  ArrowUpRight, ArrowDownRight, Info, MoveRight,
  TrendingDown, Minus, Lightbulb
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Progress } from '@/components/ui/progress';

interface AIAnalysis {
  verdict: string;
  score: number;
  risk_level: string;
  cdi_comparison: string;
  strategy_explanation: string;
  scenarios: {
    up: string;
    flat: string;
    down: string;
  };
  pros: string[];
  cons: string[];
  summary: string;
  probability_success: string;
}

interface AIInsightsProps {
  analysis: AIAnalysis | null;
  loading?: boolean;
}

export default function AIInsights({ analysis, loading = false }: AIInsightsProps) {
  if (loading) {
    return (
      <Card className="relative overflow-hidden border-2 border-primary/20 bg-card/50 backdrop-blur-sm">
        <CardContent className="flex flex-col items-center justify-center py-16 gap-6">
          <div className="relative">
            <div className="absolute inset-0 rounded-full bg-primary/20 blur-2xl animate-pulse" />
            <div className="relative flex h-20 w-20 items-center justify-center rounded-full bg-primary/10 border border-primary/20">
              <Brain className="h-10 w-10 text-primary animate-bounce" />
            </div>
          </div>
          <div className="text-center space-y-2">
            <h3 className="text-xl font-black tracking-tight animate-pulse">PROCESSANDO INTELIGÊNCIA...</h3>
            <p className="text-sm text-muted-foreground max-w-xs mx-auto">
              Nossa IA está simulando milhares de cenários de mercado para validar sua estrutura.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!analysis) return null;

  const verdictColors: Record<string, string> = {
    'Compra Forte': 'bg-success text-success-foreground shadow-[0_0_20px_-5px_hsl(var(--success))]',
    'Atrativo': 'bg-primary text-primary-foreground shadow-[0_0_20px_-5px_hsl(var(--primary))]',
    'Neutro': 'bg-warning text-warning-foreground shadow-[0_0_20px_-5px_hsl(var(--warning))]',
    'Evitar': 'bg-destructive text-destructive-foreground shadow-[0_0_20px_-5px_hsl(var(--destructive))]',
    'Perigoso': 'bg-destructive text-destructive-foreground animate-pulse shadow-[0_0_25px_-5px_hsl(var(--destructive))]',
  };

  const riskColors: Record<string, string> = {
    'Baixo': 'text-success',
    'Moderado': 'text-warning',
    'Alto': 'text-destructive',
    'Crítico': 'text-destructive font-black',
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Main Verdict Card */}
      <Card className="relative overflow-hidden border-2 border-primary/30 bg-gradient-to-br from-primary/[0.03] via-card to-card shadow-2xl">
        <div className="absolute top-0 right-0 p-6">
          <Badge className={cn("text-sm px-6 py-1.5 font-black uppercase tracking-tighter rounded-full", verdictColors[analysis.verdict] || 'bg-muted')}>
            {analysis.verdict}
          </Badge>
        </div>

        <CardHeader className="pb-4">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary border border-primary/20 shadow-inner">
              <Brain className="h-8 w-8" />
            </div>
            <div>
              <CardTitle className="text-3xl font-black tracking-tighter">RELATÓRIO DE ESTRATÉGIA</CardTitle>
              <p className="text-xs text-muted-foreground font-bold uppercase tracking-widest">Análise Quantitativa Avançada</p>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-8">
          {/* Score & Summary Section */}
          <div className="grid gap-8 md:grid-cols-12">
            <div className="md:col-span-4 space-y-4">
              <div className="flex items-end justify-between">
                <span className="text-xs font-black text-muted-foreground uppercase tracking-widest">Atratividade</span>
                <span className="text-5xl font-black text-primary tracking-tighter">
                  {analysis.score}<span className="text-xl text-muted-foreground">/10</span>
                </span>
              </div>
              <Progress value={(analysis.score || 0) * 10} className="h-4 bg-primary/10" />
              <div className="grid grid-cols-2 gap-3 pt-2">
                <div className="rounded-xl bg-muted/30 p-3 border border-border/50">
                  <p className="text-[9px] font-black uppercase text-muted-foreground mb-1">Risco</p>
                  <p className={cn("text-sm font-black", riskColors[analysis.risk_level])}>{analysis.risk_level || 'N/A'}</p>
                </div>
                <div className="rounded-xl bg-muted/30 p-3 border border-border/50">
                  <p className="text-[9px] font-black uppercase text-muted-foreground mb-1">Sucesso</p>
                  <p className="text-sm font-black">{analysis.probability_success || 'N/A'}</p>
                </div>
              </div>
            </div>

            <div className="md:col-span-8 space-y-4">
              <div className="relative p-5 rounded-2xl bg-primary/[0.03] border border-primary/10">
                <Lightbulb className="absolute -top-3 -left-3 h-8 w-8 text-primary bg-card rounded-full p-1.5 border border-primary/20 shadow-sm" />
                <h4 className="text-xs font-black uppercase tracking-widest text-primary mb-2">Resumo Executivo</h4>
                <p className="text-base font-medium leading-relaxed text-foreground/90 italic">
                  "{analysis.summary || 'Sem resumo disponível.'}"
                </p>
              </div>
              {analysis.cdi_comparison && (
                <div className="flex items-center gap-3 p-3 rounded-xl bg-info/5 border border-info/20">
                  <BarChart3 className="h-5 w-5 text-info shrink-0" />
                  <p className="text-xs font-bold text-info uppercase tracking-tight">{analysis.cdi_comparison}</p>
                </div>
              )}
            </div>
          </div>

          {/* Strategy Explanation */}
          {analysis.strategy_explanation && (
            <div className="space-y-3 pt-6 border-t border-border/50">
              <h4 className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
                <Zap className="h-4 w-4 text-primary" /> Como funciona a estratégia
              </h4>
              <p className="text-sm leading-relaxed text-muted-foreground font-medium bg-muted/20 p-4 rounded-xl border border-border/40">
                {analysis.strategy_explanation}
              </p>
            </div>
          )}

          {/* Market Scenarios */}
          {analysis.scenarios && (
            <div className="space-y-4">
              <h4 className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
                <Target className="h-4 w-4 text-primary" /> Cenários de Mercado no Vencimento
              </h4>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="group p-5 rounded-2xl border border-success/20 bg-gradient-to-br from-success/[0.05] to-transparent transition-all hover:shadow-lg hover:border-success/40">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="p-2 rounded-lg bg-success/10 text-success">
                      <TrendingUp className="h-5 w-5" />
                    </div>
                    <span className="text-xs font-black uppercase text-success">Se o Ativo Subir</span>
                  </div>
                  <p className="text-xs font-medium leading-relaxed text-muted-foreground group-hover:text-foreground transition-colors">
                    {analysis.scenarios.up || 'N/A'}
                  </p>
                </div>

                <div className="group p-5 rounded-2xl border border-warning/20 bg-gradient-to-br from-warning/[0.05] to-transparent transition-all hover:shadow-lg hover:border-warning/40">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="p-2 rounded-lg bg-warning/10 text-warning">
                      <Minus className="h-5 w-5" />
                    </div>
                    <span className="text-xs font-black uppercase text-warning">Se ficar Lateral</span>
                  </div>
                  <p className="text-xs font-medium leading-relaxed text-muted-foreground group-hover:text-foreground transition-colors">
                    {analysis.scenarios.flat || 'N/A'}
                  </p>
                </div>

                <div className="group p-5 rounded-2xl border border-destructive/20 bg-gradient-to-br from-destructive/[0.05] to-transparent transition-all hover:shadow-lg hover:border-destructive/40">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="p-2 rounded-lg bg-destructive/10 text-destructive">
                      <TrendingDown className="h-5 w-5" />
                    </div>
                    <span className="text-xs font-black uppercase text-destructive">Se o Ativo Cair</span>
                  </div>
                  <p className="text-xs font-medium leading-relaxed text-muted-foreground group-hover:text-foreground transition-colors">
                    {analysis.scenarios.down || 'N/A'}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Pros & Cons */}
          <div className="grid gap-6 md:grid-cols-2 pt-6 border-t border-border/50">
            <div className="space-y-4">
              <h4 className="text-xs font-black uppercase tracking-widest text-success flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4" /> Pontos Fortes
              </h4>
              <div className="space-y-2">
                {analysis.pros?.map((pro, i) => (
                  <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-success/5 border border-success/10 text-sm font-bold">
                    <ArrowUpRight className="h-4 w-4 text-success shrink-0" />
                    {pro}
                  </div>
                )) || <p className="text-xs text-muted-foreground">Nenhum ponto forte listado.</p>}
              </div>
            </div>
            <div className="space-y-4">
              <h4 className="text-xs font-black uppercase tracking-widest text-destructive flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" /> Riscos & Atenção
              </h4>
              <div className="space-y-2">
                {analysis.cons?.map((con, i) => (
                  <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-destructive/5 border border-destructive/10 text-sm font-bold">
                    <ArrowDownRight className="h-4 w-4 text-destructive shrink-0" />
                    {con}
                  </div>
                )) || <p className="text-xs text-muted-foreground">Nenhum risco listado.</p>}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}