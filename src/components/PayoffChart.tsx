import { useState, useMemo } from 'react';
import { PayoffPoint } from '@/lib/types';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { Area, CartesianGrid, ReferenceLine, XAxis, YAxis, Line, ComposedChart, ResponsiveContainer } from 'recharts';
import { calculateCDIReturn } from '@/lib/payoff';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { TrendingUp, TrendingDown, Target, Percent, DollarSign } from 'lucide-react';

interface PayoffChartProps {
  data: PayoffPoint[];
  breakevens: number[];
  cdiRate?: number;
  daysToExpiry?: number;
  netCost?: number;
  montageTotal?: number;
  maxGain?: number | 'Ilimitado';
  maxLoss?: number | 'Ilimitado';
}

const chartConfig = {
  profitAtExpiry: { label: 'No Vencimento', color: 'hsl(var(--chart-profit))' },
  profitToday: { label: 'Hoje (T+0)', color: 'hsl(var(--info))' },
  belowZero: { label: 'Prejuízo', color: 'hsl(var(--destructive))' },
  betweenZeroCdi: { label: 'Lucro < CDI', color: 'hsl(38 92% 50%)' },
  aboveCdi: { label: 'Lucro > CDI', color: 'hsl(var(--success))' },
  cdiReturn: { label: 'CDI', color: 'hsl(45 95% 55%)' },
};

export default function PayoffChart({ 
  data, 
  breakevens, 
  cdiRate = 0, 
  daysToExpiry = 0, 
  netCost = 0, 
  montageTotal,
  maxGain,
  maxLoss
}: PayoffChartProps) {
  const [displayMode, setDisplayMode] = useState<'value' | 'percent'>('value');

  const investedCapital = useMemo(() => Math.max(Math.abs(montageTotal ?? netCost ?? 0), 1), [montageTotal, netCost]);
  
  const cdiValue = useMemo(() => 
    cdiRate > 0 && daysToExpiry > 0
      ? calculateCDIReturn(investedCapital, cdiRate, daysToExpiry, false)
      : null
  , [investedCapital, cdiRate, daysToExpiry]);

  const sortedData = useMemo(() => [...data].sort((a, b) => a.price - b.price), [data]);

  const chartData = useMemo(() => sortedData.map((p) => {
    const profit = p.profitAtExpiry;
    const profitToday = p.profitToday;
    const cdi = cdiValue ?? 0;
    
    const factor = displayMode === 'percent' ? (100 / investedCapital) : 1;

    return {
      price: p.price,
      profitAtExpiry: profit * factor,
      profitToday: profitToday * factor,
      roi: ((profit / investedCapital) * 100).toFixed(1) + '%',
      belowZero: (profit < 0 ? profit : 0) * factor,
      betweenZeroCdi: (profit > 0 && cdi > 0
        ? Math.min(profit, cdi)
        : (profit > 0 ? profit : 0)) * factor,
      aboveCdi: (cdi > 0 && profit > cdi ? profit - cdi : 0) * factor,
      cdiLine: cdiValue !== null ? (cdiValue * factor) : undefined,
    };
  }), [sortedData, displayMode, investedCapital, cdiValue]);

  const formatVal = (val: number | 'Ilimitado' | undefined) => {
    if (val === 'Ilimitado') return 'Ilimitado';
    if (val === undefined) return 'N/A';
    if (displayMode === 'percent') return `${((val / investedCapital) * 100).toFixed(1)}%`;
    return `R$ ${val.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
  };

  if (data.length === 0) return null;

  const prices = sortedData.map((p) => p.price);
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);

  const allYValues = chartData.flatMap(d => [d.profitAtExpiry, d.profitToday, d.cdiLine ?? 0]);
  const minY = Math.min(...allYValues);
  const maxY = Math.max(...allYValues);
  const rangeY = maxY - minY || 1;
  const paddingY = rangeY * 0.15;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3 rounded-xl bg-muted/30 border border-border/50">
          <p className="text-[10px] font-black uppercase text-muted-foreground mb-1 flex items-center gap-1">
            <TrendingUp className="h-3 w-3 text-success" /> Lucro Máx.
          </p>
          <p className="text-sm font-bold text-success">{formatVal(maxGain)}</p>
        </div>
        <div className="p-3 rounded-xl bg-muted/30 border border-border/50">
          <p className="text-[10px] font-black uppercase text-muted-foreground mb-1 flex items-center gap-1">
            <TrendingDown className="h-3 w-3 text-destructive" /> Risco Máx.
          </p>
          <p className="text-sm font-bold text-destructive">{formatVal(maxLoss)}</p>
        </div>
        <div className="p-3 rounded-xl bg-muted/30 border border-border/50">
          <p className="text-[10px] font-black uppercase text-muted-foreground mb-1 flex items-center gap-1">
            <Target className="h-3 w-3 text-warning" /> Breakeven
          </p>
          <p className="text-sm font-bold">{breakevens.length > 0 ? `R$ ${breakevens[0].toFixed(2)}` : 'N/A'}</p>
        </div>
        <div className="flex items-center justify-end gap-1">
          <Button 
            variant={displayMode === 'value' ? 'default' : 'outline'} 
            size="sm" 
            className="h-8 px-3 text-[10px] font-bold"
            onClick={() => setDisplayMode('value')}
          >
            <DollarSign className="h-3 w-3 mr-1" /> VALOR
          </Button>
          <Button 
            variant={displayMode === 'percent' ? 'default' : 'outline'} 
            size="sm" 
            className="h-8 px-3 text-[10px] font-bold"
            onClick={() => setDisplayMode('percent')}
          >
            <Percent className="h-3 w-3 mr-1" /> % ROI
          </Button>
        </div>
      </div>

      <ChartContainer config={chartConfig} className="h-[380px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} margin={{ top: 10, right: 30, left: 10, bottom: 0 }}>
            <defs>
              <linearGradient id="lossGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(var(--destructive))" stopOpacity={0.4} />
                <stop offset="100%" stopColor="hsl(var(--destructive))" stopOpacity={0.05} />
              </linearGradient>
              <linearGradient id="orangeGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(38 92% 50%)" stopOpacity={0.4} />
                <stop offset="100%" stopColor="hsl(38 92% 50%)" stopOpacity={0.05} />
              </linearGradient>
              <linearGradient id="greenGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(var(--success))" stopOpacity={0.4} />
                <stop offset="100%" stopColor="hsl(var(--success))" stopOpacity={0.05} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" opacity={0.3} />
            <XAxis
              type="number"
              dataKey="price"
              domain={[minPrice, maxPrice]}
              tickFormatter={(v) => v.toFixed(2)}
              tickCount={10}
              interval="preserveStartEnd"
              className="text-xs"
              stroke="hsl(var(--muted-foreground))"
              fontSize={11}
            />
            <YAxis
              domain={[minY - paddingY, maxY + paddingY]}
              tickFormatter={(v) => displayMode === 'percent' ? `${v.toFixed(1)}%` : v.toFixed(0)}
              className="text-xs"
              stroke="hsl(var(--muted-foreground))"
              fontSize={11}
              width={60}
            />
            
            <ReferenceLine y={0} stroke="hsl(var(--muted-foreground))" strokeDasharray="4 4" strokeOpacity={0.5} />
            
            {breakevens.map((be, i) => (
              <ReferenceLine
                key={i}
                x={be}
                stroke="hsl(var(--warning))"
                strokeDasharray="6 4"
                strokeWidth={1.5}
                label={{
                  value: `BE ${be.toFixed(2)}`,
                  position: 'top',
                  fill: 'hsl(var(--warning))',
                  fontSize: 10,
                  fontWeight: 600,
                }}
              />
            ))}
            
            {cdiValue !== null && (
              <ReferenceLine
                y={displayMode === 'percent' ? (cdiValue * 100 / investedCapital) : cdiValue}
                stroke="hsl(45 95% 55%)"
                strokeWidth={2}
                strokeDasharray="8 4"
                label={{
                  value: `CDI ${displayMode === 'percent' ? ((cdiValue/investedCapital)*100).toFixed(1)+'%' : 'R$'+cdiValue.toFixed(2)}`,
                  position: 'right',
                  fill: 'hsl(45 95% 55%)',
                  fontSize: 11,
                  fontWeight: 600,
                }}
              />
            )}
            
            <ChartTooltip 
              content={
                <ChartTooltipContent 
                  formatter={(value, name, props) => {
                    const val = Number(value);
                    if (name === 'profitAtExpiry') {
                      return [
                        displayMode === 'percent' ? `${val.toFixed(2)}%` : `R$ ${val.toFixed(2)} (${props.payload.roi})`,
                        'Lucro Venc.'
                      ];
                    }
                    if (name === 'profitToday') {
                      return [
                        displayMode === 'percent' ? `${val.toFixed(2)}%` : `R$ ${val.toFixed(2)}`,
                        'Lucro Hoje'
                      ];
                    }
                    return [value, name];
                  }}
                />
              } 
            />
            
            <Area
              type="monotone"
              dataKey="belowZero"
              stroke="none"
              fill="url(#lossGradient)"
              dot={false}
              activeDot={false}
              isAnimationActive={false}
            />
            <Area
              type="monotone"
              dataKey="betweenZeroCdi"
              stackId="positive"
              stroke="none"
              fill="url(#orangeGradient)"
              dot={false}
              activeDot={false}
              isAnimationActive={false}
            />
            <Area
              type="monotone"
              dataKey="aboveCdi"
              stackId="positive"
              stroke="none"
              fill="url(#greenGradient)"
              dot={false}
              activeDot={false}
              isAnimationActive={false}
            />
            
            <Line
              type="monotone"
              dataKey="profitToday"
              stroke="hsl(var(--info))"
              strokeWidth={2}
              strokeDasharray="5 5"
              dot={false}
              activeDot={{ r: 4, fill: 'hsl(var(--info))' }}
              isAnimationActive={false}
            />

            <Line
              type="monotone"
              dataKey="profitAtExpiry"
              stroke="hsl(var(--chart-profit))"
              strokeWidth={2.5}
              dot={false}
              activeDot={{ r: 4, fill: 'hsl(var(--chart-profit))' }}
              isAnimationActive={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </ChartContainer>
    </div>
  );
}