import { useMemo } from 'react';
import { AnalysisMetrics } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Brain, TrendingUp, AlertCircle, CheckCircle2, Zap, Lightbulb } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AIInsightsProps {
  metrics: AnalysisMetrics;
  suggestion: string;
  cdiReturn?: number;
  daysToExpiry?: number;
  loading?: boolean;
}

export default function AIInsights({ 
  metrics, 
  suggestion, 
  cdiReturn = 0, 
  daysToExpiry = 0,
  loading = false,
}: AIInsightsProps) {
  
  const insights = useMemo(() => {
    const result = [];

    // Análise de Risco
    if (metrics.isRiskFree) {
      result.push({
        type: 'success',
        icon: CheckCircle2,
        title: 'Operação com Risco Zero',
        description: 'Esta estrutura garante lucro em qualquer cenário de preço. Excelente para carteira conservadora.',
        badge: 'SEGURA',
      });
    } else if (typeof metrics.maxLoss === 'number' && metrics.maxLoss < 0) {
      const riskPercent = cdiReturn > 0 ? Math.abs((metrics.maxLoss / cdiReturn) * 100) : 0;
      result.push({
        type: 'warning',
        icon: AlertCircle,
        title: 'Risco Limitado',
        description: `Perda máxima é R$ ${Math.abs(metrics.maxLoss).toFixed(2)}, equivalente a ${riskPercent.toFixed(0)}% do retorno CDI.`,
        badge: 'CONTROLADO',
      });
    } else if (metrics.maxLoss === 'Ilimitado') {
      result.push({
        type: 'destructive',
        icon: AlertCircle,
        title: 'Risco Ilimitado',
        description: 'Esta estrutura possui risco potencial ilimitado. Use com cautela e sempre com stop-loss.',
        badge: 'ALTO RISCO',
      });
    }

    // Análise de Ganho
    if (typeof metrics.maxGain === 'number' && cdiReturn > 0) {
      const efficiency = (metrics.maxGain / cdiReturn) * 100;
      if (efficiency >= 150) {
        result.push({
          type: 'success',
          icon: TrendingUp,
          title: 'Ganho Excepcional',
          description: `Retorno máximo é ${efficiency.toFixed(0)}% do CDI. Estrutura muito atrativa.`,
          badge: 'EXCELENTE',
        });
      } else if (efficiency >= 100) {
        result.push({
          type: 'success',
          icon: TrendingUp,
          title: 'Supera o CDI',
          description: `Retorno máximo é ${efficiency.toFixed(0)}% do CDI. Melhor que renda fixa.`,
          badge: 'VANTAJOSA',
        });
      } else {
        result.push({
          type: 'warning',
          icon: AlertCircle,
          title: 'Abaixo do CDI',
          description: `Retorno máximo é apenas ${efficiency.toFixed(0)}% do CDI. Considere renda fixa.`,
          badge: 'REVISAR',
        });
      }
    }

    // Análise de Estratégia
    if (metrics.strategyType) {
      const strategyInsights: Record<string, string> = {
        CoveredCall: 'Estratégia defensiva: ganho limitado, mas protegido por prêmio. Ideal para mercado lateral.',
        Collar: 'Estratégia de proteção: ganho limitado, risco controlado. Excelente para proteger posição.',
        BullCallSpread: 'Estratégia otimista: ganho limitado, risco controlado. Use quando espera alta moderada.',
        BearPutSpread: 'Estratégia defensiva: ganho limitado, risco controlado. Use quando espera estabilidade.',
      };

      if (strategyInsights[metrics.strategyType]) {
        result.push({
          type: 'primary',
          icon: Lightbulb,
          title: `${metrics.strategyLabel || metrics.strategyType}`,
          description: strategyInsights[metrics.strategyType],
          badge: 'ESTRATÉGIA',
        });
      }
    }

    return result;
  }, [metrics, cdiReturn]);

  const typeColors = {
    success: 'from-success/15 to-success/5 border-success/30',
    warning: 'from-warning/15 to-warning/5 border-warning/30',
    destructive: 'from-destructive/15 to-destructive/5 border-destructive/30',
    primary: 'from-primary/15 to-primary/5 border-primary/30',
  };

  const badgeColors = {
    success: 'bg-success/25 text-success hover:bg-success/35 border-success/40',
    warning: 'bg-warning/25 text-warning hover:bg-warning/35 border-warning/40',
    destructive: 'bg-destructive/25 text-destructive hover:bg-destructive/35 border-destructive/40',
    primary: 'bg-primary/25 text-primary hover:bg-primary/35 border-primary/40',
  };

  return (
    <div className="space-y-6">
      {/* IA Suggestion Card - Premium */}
      <Card className="relative overflow-hidden border-2 border-primary/40 bg-gradient-to-br from-primary/[0.08] via-card to-card shadow-[0_0_60px_-12px_hsl(var(--primary)/0.3)]">
        <div className="absolute top-0 right-0 w-40 h-40 bg-primary/15 rounded-full blur-3xl -mr-20 -mt-20 animate-pulse" />
        <div className="absolute bottom-0 left-1/4 w-32 h-32 bg-primary/10 rounded-full blur-2xl -mb-16 animate-pulse" style={{ animationDelay: '1s' }} />
        
        <CardHeader className="relative pb-3">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-primary/30 to-primary/15 shadow-lg">
              <Brain className="h-6 w-6 text-primary" />
            </div>
            <div>
              <CardTitle className="text-2xl font-black tracking-tight">Análise de IA</CardTitle>
              <p className="text-xs text-muted-foreground font-medium mt-1">Recomendação inteligente da estrutura</p>
            </div>
          </div>
        </CardHeader>

        <CardContent className="relative space-y-4">
          {loading ? (
            <div className="flex items-center gap-3 py-6">
              <div className="flex gap-1">
                <div className="h-2 w-2 rounded-full bg-primary animate-bounce" />
                <div className="h-2 w-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '0.2s' }} />
                <div className="h-2 w-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '0.4s' }} />
              </div>
              <p className="text-sm font-medium text-muted-foreground">Analisando estrutura...</p>
            </div>
          ) : suggestion ? (
            <div className="space-y-4">
              <p className="text-base leading-relaxed text-foreground font-medium">{suggestion}</p>
              <div className="pt-3 border-t border-primary/15">
                <p className="text-xs text-muted-foreground font-semibold uppercase tracking-widest">
                  📅 Período: {daysToExpiry} dias úteis
                </p>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground italic py-4">Clique em "Sugestão IA" para obter uma análise profunda.</p>
          )}
        </CardContent>
      </Card>

      {/* Insights Grid - Ultra Modern */}
      {insights.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2">
          {insights.map((insight, idx) => {
            const Icon = insight.icon;
            const bgClass = typeColors[insight.type as keyof typeof typeColors];
            const badgeClass = badgeColors[insight.type as keyof typeof badgeColors];

            return (
              <Card
                key={idx}
                className={cn(
                  'relative overflow-hidden border-2 transition-all duration-500 group',
                  'hover:shadow-[0_20px_50px_-12px_hsl(var(--primary)/0.25)]',
                  'hover:-translate-y-1 cursor-default',
                  `bg-gradient-to-br ${bgClass}`
                )}
              >
                {/* Animated gradient overlay */}
                <div className="absolute inset-0 bg-gradient-to-br from-transparent via-transparent to-primary/[0.03] opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                
                {/* Glow effect */}
                <div className={cn(
                  'absolute -top-20 -right-20 w-40 h-40 rounded-full blur-3xl opacity-0 group-hover:opacity-20 transition-opacity duration-500',
                  insight.type === 'success' && 'bg-success',
                  insight.type === 'warning' && 'bg-warning',
                  insight.type === 'destructive' && 'bg-destructive',
                  insight.type === 'primary' && 'bg-primary',
                )} />

                <CardContent className="p-5 space-y-4 relative">
                  <div className="flex items-start justify-between gap-3">
                    <div className={cn(
                      'flex h-10 w-10 items-center justify-center rounded-lg transition-all duration-300 group-hover:scale-110',
                      insight.type === 'success' && 'bg-success/20 text-success',
                      insight.type === 'warning' && 'bg-warning/20 text-warning',
                      insight.type === 'destructive' && 'bg-destructive/20 text-destructive',
                      insight.type === 'primary' && 'bg-primary/20 text-primary',
                    )}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <Badge 
                      className={cn('text-xs font-bold tracking-wider border', badgeClass)}
                      variant="outline"
                    >
                      {insight.badge}
                    </Badge>
                  </div>

                  <div className="space-y-2">
                    <h3 className="font-bold text-base leading-tight group-hover:text-primary transition-colors duration-300">{insight.title}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">{insight.description}</p>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
