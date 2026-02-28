import { AnalysisMetrics } from '@/lib/types';
import { Card, CardContent } from '@/components/ui/card';
import { TrendingUp, TrendingDown, Target, DollarSign, Percent, Shield } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface MetricsCardsProps {
  metrics: AnalysisMetrics;
  cdiReturn?: number;
  daysToExpiry?: number;
  investedCapital?: number;
}

export default function MetricsCards({ metrics, cdiReturn = 0, investedCapital = 0 }: MetricsCardsProps) {
  const hasStrategy = !!metrics.strategyType;
  const isCoveredCall = metrics.strategyType === 'CoveredCall';
  const isCollar = metrics.strategyType === 'Collar';
  const isBullCallSpread = metrics.strategyType === 'BullCallSpread';
  const isBearPutSpread = metrics.strategyType === 'BearPutSpread';

  const montageValue = hasStrategy
    ? (metrics.montageTotal ?? metrics.netCost)
    : metrics.netCost;

  const breakeven = hasStrategy && metrics.realBreakeven != null
    ? (Array.isArray(metrics.realBreakeven) ? metrics.realBreakeven : [metrics.realBreakeven])
    : null;

  const maxGainValue = metrics.maxGain === 'Ilimitado'
    ? null
    : (typeof metrics.maxGain === 'number' ? metrics.maxGain : null);

  const maxLossValue = metrics.maxLoss === 'Ilimitado'
    ? null
    : (typeof metrics.maxLoss === 'number' ? metrics.maxLoss : null);

  const efficiency = cdiReturn > 0 && maxGainValue !== null && maxGainValue > 0
    ? (maxGainValue / cdiReturn) * 100
    : null;

  const costLabel = isCoveredCall || isCollar || isBullCallSpread || isBearPutSpread
    ? 'Custo de Montagem'
    : 'Custo Líquido';

  const costTip = isCoveredCall
    ? 'Desembolso total: (Preço Ativo - Prêmio Call) × Qtd'
    : isCollar
      ? 'Desembolso total: (Ativo + Put - Call) × Qtd'
      : isBullCallSpread
        ? 'Débito líquido: (Prêmio Call Comprada - Prêmio Call Vendida) × Qtd'
        : isBearPutSpread
          ? 'Débito líquido: (Prêmio Put Comprada - Prêmio Put Vendida) × Qtd'
          : 'Valor líquido recebido (+) ou pago (-) ao montar a estrutura.';

  const maxGainTip = isCoveredCall
    ? '(Strike Call - Breakeven) × Qtd'
    : isCollar
      ? '(Strike Call - Breakeven) × Qtd'
      : isBullCallSpread
        ? '(Strike Call Vendida - Strike Call Comprada - Débito Líquido por ação) × Qtd'
        : isBearPutSpread
          ? '(Strike Put Comprada - Strike Put Vendida - Débito Líquido por ação) × Qtd'
          : 'Maior lucro possível no vencimento.';

  const maxLossTip = metrics.isRiskFree
    ? 'Strike da Put ≥ Breakeven: lucro garantido em qualquer cenário.'
    : isCoveredCall
      ? 'Custo de montagem total (ativo vai a zero)'
      : isCollar
        ? '(Breakeven - Strike Put) × Qtd'
        : isBullCallSpread
          ? 'Débito Líquido Total'
          : isBearPutSpread
            ? 'Débito Líquido Total'
            : 'Maior prejuízo possível no vencimento.';

  const breakevenLabel = hasStrategy ? 'Breakeven Real' : 'Breakeven';
  const breakevenTip = isCoveredCall
    ? 'Preço do ativo onde a operação não dá lucro nem prejuízo'
    : isCollar
      ? 'Custo Total de Montagem ÷ Quantidade'
      : isBullCallSpread
        ? 'Strike da Call Comprada + Débito Líquido por ação'
        : isBearPutSpread
          ? 'Strike da Put Comprada - Débito Líquido por ação'
          : 'Preço do ativo onde a operação não dá lucro nem prejuízo.';

  type CardTheme = 'neutral' | 'green' | 'red' | 'yellow' | 'blue' | 'purple';

  const themeClasses: Record<CardTheme, { card: string; icon: string; value: string; label: string; badge: string }> = {
    neutral: {
      card: 'border-border/60 bg-gradient-to-br from-muted/30 to-card shadow-sm hover:shadow-lg hover:border-border transition-all duration-300',
      icon: 'bg-foreground/10 text-foreground',
      value: 'text-foreground',
      label: 'text-muted-foreground',
      badge: 'bg-muted text-muted-foreground',
    },
    green: {
      card: 'border-success/20 bg-gradient-to-br from-success/[0.06] to-card shadow-sm hover:shadow-[0_0_30px_-8px_hsl(var(--success)/0.25)] hover:border-success/40 transition-all duration-300',
      icon: 'bg-success/15 text-success',
      value: 'text-success',
      label: 'text-muted-foreground',
      badge: 'bg-success text-success-foreground',
    },
    red: {
      card: 'border-destructive/20 bg-gradient-to-br from-destructive/[0.06] to-card shadow-sm hover:shadow-[0_0_30px_-8px_hsl(var(--destructive)/0.25)] hover:border-destructive/40 transition-all duration-300',
      icon: 'bg-destructive/15 text-destructive',
      value: 'text-destructive',
      label: 'text-muted-foreground',
      badge: 'bg-destructive text-destructive-foreground',
    },
    yellow: {
      card: 'border-warning/20 bg-gradient-to-br from-warning/[0.06] to-card shadow-sm hover:shadow-[0_0_30px_-8px_hsl(var(--warning)/0.25)] hover:border-warning/40 transition-all duration-300',
      icon: 'bg-warning/15 text-warning',
      value: 'text-warning',
      label: 'text-muted-foreground',
      badge: 'bg-warning text-warning-foreground',
    },
    blue: {
      card: 'border-info/20 bg-gradient-to-br from-info/[0.06] to-card shadow-sm hover:shadow-[0_0_30px_-8px_hsl(var(--info)/0.25)] hover:border-info/40 transition-all duration-300',
      icon: 'bg-info/15 text-info',
      value: 'text-info',
      label: 'text-muted-foreground',
      badge: 'bg-info/20 text-info border-info/40',
    },
    purple: {
      card: 'border-accent/20 bg-gradient-to-br from-accent/[0.06] to-card shadow-sm hover:shadow-[0_0_30px_-8px_hsl(var(--accent)/0.25)] hover:border-accent/40 transition-all duration-300',
      icon: 'bg-accent/15 text-accent',
      value: 'text-accent',
      label: 'text-muted-foreground',
      badge: 'bg-accent/20 text-accent border-accent/40',
    },
  };

  const items: {
    title: string;
    value: string;
    subtitle?: string;
    icon: typeof DollarSign;
    theme: CardTheme;
    tip: string;
    badge?: string | null;
  }[] = [
    {
      title: costLabel,
      value: `R$ ${Math.abs(montageValue).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
      subtitle: montageValue >= 0 ? 'débito líquido' : 'crédito líquido',
      icon: DollarSign,
      theme: 'neutral',
      tip: costTip,
    },
    {
      title: 'Lucro Máximo',
      value: maxGainValue !== null ? `R$ ${maxGainValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '∞',
      subtitle: maxGainValue !== null && investedCapital > 0
        ? `${((maxGainValue / investedCapital) * 100).toFixed(1)}% do capital`
        : undefined,
      icon: TrendingUp,
      theme: 'green',
      tip: maxGainTip,
    },
    {
      title: 'Risco Máximo',
      value: metrics.isRiskFree
        ? 'R$ 0,00'
        : (maxLossValue !== null ? `R$ ${Math.abs(maxLossValue).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '∞'),
      subtitle: metrics.isRiskFree ? 'proteção total' : (maxLossValue !== null && investedCapital > 0
        ? `${((Math.abs(maxLossValue) / investedCapital) * 100).toFixed(1)}% do capital`
        : undefined),
      icon: metrics.isRiskFree ? Shield : TrendingDown,
      theme: metrics.isRiskFree ? 'green' : 'red',
      tip: maxLossTip,
      badge: metrics.isRiskFree ? 'RISCO ZERO' : null,
    },
    {
      title: breakevenLabel,
      value: breakeven !== null
        ? breakeven.map(b => `R$ ${b.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`).join(' | ')
        : (metrics.breakevens.length > 0
          ? metrics.breakevens.map(b => `R$ ${b.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`).join(' | ')
          : 'N/A'),
      subtitle: 'ponto de equilíbrio',
      icon: Target,
      theme: 'yellow',
      tip: breakevenTip,
    },
    {
      title: 'Eficiência vs CDI',
      value: efficiency !== null ? `${efficiency.toFixed(0)}%` : 'N/A',
      subtitle: efficiency !== null
        ? (efficiency >= 100 ? 'supera o CDI' : 'abaixo do CDI')
        : undefined,
      icon: Percent,
      theme: efficiency !== null && efficiency >= 100 ? 'blue' : 'purple',
      tip: 'Lucro máximo da estrutura como % do rendimento CDI no mesmo período.',
      badge: efficiency !== null && efficiency >= 100 ? 'VENCE O CDI' : null,
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
      {items.map(item => {
        const t = themeClasses[item.theme];
        return (
          <Tooltip key={item.title}>
            <TooltipTrigger asChild>
              <Card className={cn(
                'cursor-help group relative overflow-hidden transition-all duration-200',
                t.card
              )}>
                <CardContent className="p-5">
                  <div className="flex items-center justify-between mb-3">
                    <span className={cn('text-xs font-medium', t.label)}>{item.title}</span>
                    <div className={cn('flex h-7 w-7 items-center justify-center rounded-md', t.icon)}>
                      <item.icon className="h-3.5 w-3.5" />
                    </div>
                  </div>
                  <p className={cn('text-2xl font-bold tracking-tight leading-none', t.value)}>
                    {item.value}
                  </p>
                  {item.subtitle && (
                    <p className={cn('text-xs mt-1.5', 
                      item.theme === 'green' ? 'text-success' : 
                      item.theme === 'red' ? 'text-destructive' : 
                      'text-muted-foreground'
                    )}>
                      {item.subtitle}
                    </p>
                  )}
                  {item.badge && (
                    <Badge className={cn('mt-2.5 text-[10px] font-semibold tracking-wider', t.badge)}>
                      {item.badge}
                    </Badge>
                  )}
                </CardContent>
              </Card>
            </TooltipTrigger>
            <TooltipContent className="max-w-[250px]"><p>{item.tip}</p></TooltipContent>
          </Tooltip>
        );
      })}
    </div>
  );
}
