import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Brain, TrendingUp, AlertTriangle, CheckCircle2, 
  Zap, ShieldCheck, XCircle, Target, BarChart3,
  ArrowUpRight, ArrowDownRight, Info
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Progress } from '@/components/ui/progress';

interface AIAnalysis {
  verdict: string;
  score: number;
  risk_level: string;
  cdi_comparison: string;
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
        <CardContent className="flex flex-col items-center justify-center py-12 gap-4">
          <div className="relative">
            <div className="absolute inset-0 rounded-full bg-primary/20 blur-xl animate-pulse" />
            <Brain className="h-12 w-12 text-primary animate-bounce relative" />
          </div>
          <div className="text-center space-y-2">
            <p className="text-lg font-bold animate-pulse">IA Analisando Estrutura...</p>
            <p className="text-sm text-muted-foreground">Calculando probabilidades e eficiência vs CDI</p>
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
      <Card className="relative overflow-hidden border-2 border-primary/30 bg-gradient-to-br from-primary/[0.05] via-card to-card shadow-xl">
        <div className="absolute top-0 right-0 p-6">
          <Badge className={cn("text-sm px-4 py-1 font-black uppercase tracking-tighter", verdictColors[analysis.verdict] || 'bg-muted')}>
            {analysis.verdict}
          </Badge>
        </div>

        <CardHeader className="pb-2">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Brain className="h-7 w-7" />
            </div>
            <div>
              <CardTitle className="text-2xl font-black">Veredito da IA</CardTitle>
              <p className="text-xs text-muted-foreground font-medium">Análise quantitativa e estratégica</p>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Score & Summary */}
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-4">
              <div className="flex items-end justify-between">
                <span className="text-sm font-bold text-muted-foreground uppercase tracking-widest">Nota de Atratividade</span>
                <span className="text-4xl font-black text-primary">{analysis.score}<span className="text-lg text-muted-foreground">/10</span></span>
              </div>
              <Progress value={analysis.score * 10} className="h-3 bg-primary/10" />
              <p className="text-base font-medium leading-relaxed italic">"{analysis.summary}"</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-xl bg-muted/30 p-4 border border-border/50">
                <div className="flex items-center gap-2 mb-1">
                  <ShieldCheck className="h-4 w-4 text-primary" />
                  <span className="text-[10px] font-bold uppercase text-muted-foreground">Risco</span>
                </div>
                <p className={cn("text-lg font-black", riskColors[analysis.risk_level])}>{analysis.risk_level}</p>
              </div>
              <div className="rounded-xl bg-muted/30 p-4 border border-border/50">
                <div className="flex items-center gap-2 mb-1">
                  <Target className="h-4 w-4 text-primary" />
                  <span className="text-[10px] font-bold uppercase text-muted-foreground">Probabilidade</span>
                </div>
                <p className="text-lg font-black">{analysis.probability_success}</p>
              </div>
            </div>
          </div>

          {/* Pros & Cons */}
          <div className="grid gap-4 md:grid-cols-2 pt-4 border-t border-border/50">
            <div className="space-y-3">
              <h4 className="text-xs font-black uppercase tracking-widest text-success flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4" /> Pontos Positivos
              </h4>
              <ul className="space-y-2">
                {analysis.pros.map((pro, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm font-medium">
                    <ArrowUpRight className="h-4 w-4 text-success shrink-0 mt-0.5" />
                    {pro}
                  </li>
                ))}
              </ul>
            </div>
            <div className="space-y-3">
              <h4 className="text-xs font-black uppercase tracking-widest text-destructive flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" /> Pontos de Atenção
              </h4>
              <ul className="space-y-2">
                {analysis.cons.map((con, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm font-medium">
                    <ArrowDownRight className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                    {con}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* CDI Comparison Banner */}
          <div className="rounded-xl bg-info/10 border border-info/30 p-4 flex items-center gap-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-info/20 text-info shrink-0">
              <BarChart3 className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase text-info tracking-widest">Comparativo CDI</p>
              <p className="text-sm font-bold text-foreground">{analysis.cdi_comparison}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}