import { useState, useMemo } from 'react';
import { PayoffPoint } from '@/lib/types';
import { Leg } from '@/lib/types';
import { ChartContainer, ChartTooltip } from '@/components/ui/chart';
import { Area, CartesianGrid, ReferenceLine, XAxis, YAxis, Line, ComposedChart, ResponsiveContainer, ReferenceDot } from 'recharts';
import { calculateCDIReturn, calculatePortfolioGreeks } from '@/lib/payoff';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { TrendingUp, TrendingDown, Target, Percent, DollarSign, Layers } from 'lucide-react';

interface PayoffChartProps {
  data: PayoffPoint[];
  breakevens: number[];
  cdiRate?: number;
  daysToExpiry?: number;
  netCost?: number;
  montageTotal?: number;
  maxGain?: number | 'Ilimitado';
  maxLoss?: number | 'Ilimitado';
  currentSpotPrice?: number | null;
  entrySpotPrice?: number | null;
  currentPnL?: number | null;
  simulationData?: PayoffPoint[] | null;
  simulationCdiReturn?: number | null;
  legs?: Leg[];
}

const chartConfig = {
  profitAtExpiry: { label: 'No Vencimento', color: 'hsl(var(--chart-profit))' },
  profitToday: { label: 'Hoje (T+0)', color: 'hsl(var(--info))' },
  cdiReturn: { label: 'CDI', color: 'hsl(45 95% 55%)' },
  simulated: { label: 'Simulação', color: 'hsl(var(--primary))' },
};

const CustomTooltip = ({ active, payload, label, displayMode, legs, daysToExpiry, cdiRate }: any) => {
  if (active && payload && payload.length) {
    const format = (val: number) => {
      if (displayMode === 'percent') return `${val.toFixed(2)}%`;
      return `R$ ${val.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
    };

    // Calculate greeks at this spot price
    const greeks = legs && legs.length > 0 && daysToExpiry > 0
      ? calculatePortfolioGreeks(legs, label, daysToExpiry, cdiRate)
      : null;

    return (
      <div className="rounded-lg border border-border bg-card/95 p-3 shadow-xl backdrop-blur-sm">
        <div className="mb-2 border-b border-border/50 pb-1">
          <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Preço do Ativo</p>
          <p className="text-sm font-bold font-mono">R$ {label.toFixed(2)}</p>
        </div>
        <div className="space-y-1.5">
          {payload.map((p: any, i: number) => {
            if (p.dataKey === 'belowZero' || p.dataKey === 'betweenZeroCdi' || p.dataKey === 'aboveCdi') return null;
            return (
              <div key={i} className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full" style={{ backgroundColor: p.color }} />
                  <span className="text-[11px] font-bold text-foreground/80">{p.name}</span>
                </div>
                <span className={cn("text-xs font-black font-mono", p.value >= 0 ? "text-success" : "text-destructive")}>
                  {format(p.value)}
                </span>
              </div>
            );
          })}
        </div>
        {greeks && (
          <div className="mt-2 pt-2 border-t border-border/50 grid grid-cols-2 gap-x-4 gap-y-1">
            <div className="flex justify-between"><span className="text-[10px] text-muted-foreground">Δ Delta</span><span className="text-[10px] font-mono font-bold">{greeks.delta}</span></div>
            <div className="flex justify-between"><span className="text-[10px] text-muted-foreground">Γ Gamma</span><span className="text-[10px] font-mono font-bold">{greeks.gamma}</span></div>
            <div className="flex justify-between"><span className="text-[10px] text-muted-foreground">Θ Theta</span><span className="text-[10px] font-mono font-bold">{greeks.theta}</span></div>
            <div className="flex justify-between"><span className="text-[10px] text-muted-foreground">ν Vega</span><span className="text-[10px] font-mono font-bold">{greeks.vega}</span></div>
          </div>
        )}
      </div>
    );
  }
  return null;
};

export default function PayoffChart({ 
  data, 
  breakevens, 
  cdiRate = 0, 
  daysToExpiry = 0, 
  netCost = 0, 
  montageTotal,
  maxGain,
  maxLoss,
  currentSpotPrice,
  entrySpotPrice,
  currentPnL,
  simulationData,
  simulationCdiReturn
}: PayoffChartProps) {
  const [displayMode, setDisplayMode] = useState<'value' | 'percent'>('value');

  const investedCapital = useMemo(() => Math.max(Math.abs(montageTotal ?? netCost ?? 0), 1), [montageTotal, netCost]);
  const factor = displayMode === 'percent' ? (100 / investedCapital) : 1;

  const cdiValue = useMemo(() => 
    cdiRate > 0 && daysToExpiry > 0
      ? calculateCDIReturn(investedCapital, cdiRate, daysToExpiry, false)
      : null
  , [investedCapital, cdiRate, daysToExpiry]);

  const chartData = useMemo(() => {
    return data.map((p, i) => {
      const simPoint = simulationData?.[i];
      const profit = p.profitAtExpiry;
      const cdi = cdiValue ?? 0;
      const simCdi = simulationCdiReturn ?? 0;

      return {
        price: p.price,
        profitAtExpiry: profit * factor,
        profitToday: p.profitToday * factor,
        simulatedAtExpiry: simPoint ? simPoint.profitAtExpiry * factor : undefined,
        // Lógica das 3 cores
        belowZero: (profit < 0 ? profit : 0) * factor,
        betweenZeroCdi: (profit > 0 ? Math.min(profit, cdi) : 0) * factor,
        aboveCdi: (profit > cdi ? profit - cdi : 0) * factor,
        cdiLine: cdi * factor,
        // Linha do CDI do período para simulação
        periodCdiLine: simCdi * factor,
      };
    });
  }, [data, simulationData, factor, cdiValue, simulationCdiReturn]);

  const formatVal = (val: number | 'Ilimitado' | undefined) => {
    if (val === 'Ilimitado') return 'Ilimitado';
    if (val === undefined) return 'N/A';
    return displayMode === 'percent' ? `${((val / investedCapital) * 100).toFixed(1)}%` : `R$ ${val.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
  };

  const prices = data.map(p => p.price);
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);

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
          <Button variant={displayMode === 'value' ? 'default' : 'outline'} size="sm" className="h-8 px-3 text-[10px] font-bold" onClick={() => setDisplayMode('value')}><DollarSign className="h-3 w-3 mr-1" /> VALOR</Button>
          <Button variant={displayMode === 'percent' ? 'default' : 'outline'} size="sm" className="h-8 px-3 text-[10px] font-bold" onClick={() => setDisplayMode('percent')}><Percent className="h-3 w-3 mr-1" /> % ROI</Button>
        </div>
      </div>

      <ChartContainer config={chartConfig} className="h-[450px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} margin={{ top: 25, right: 30, left: 10, bottom: 0 }}>
            <defs>
              <linearGradient id="lossGradient" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="hsl(var(--destructive))" stopOpacity={0.4} /><stop offset="100%" stopColor="hsl(var(--destructive))" stopOpacity={0.05} /></linearGradient>
              <linearGradient id="orangeGradient" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="hsl(38 92% 50%)" stopOpacity={0.4} /><stop offset="100%" stopColor="hsl(38 92% 50%)" stopOpacity={0.05} /></linearGradient>
              <linearGradient id="greenGradient" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="hsl(var(--success))" stopOpacity={0.4} /><stop offset="100%" stopColor="hsl(var(--success))" stopOpacity={0.05} /></linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" opacity={0.3} />
            <XAxis type="number" dataKey="price" domain={[minPrice, maxPrice]} tickFormatter={(v) => v.toFixed(2)} className="text-xs" stroke="hsl(var(--muted-foreground))" fontSize={11} />
            <YAxis tickFormatter={(v) => displayMode === 'percent' ? `${v.toFixed(1)}%` : v.toFixed(0)} className="text-xs" stroke="hsl(var(--muted-foreground))" fontSize={11} width={60} />
            
            <ReferenceLine y={0} stroke="hsl(var(--muted-foreground))" strokeDasharray="4 4" strokeOpacity={0.5} />
            
            {entrySpotPrice && (
              <ReferenceLine 
                x={entrySpotPrice} 
                stroke="hsl(var(--muted-foreground))" 
                strokeWidth={2} 
                strokeDasharray="3 3"
                label={{ value: `ENTRADA: ${entrySpotPrice.toFixed(2)}`, position: 'top', fill: 'hsl(var(--muted-foreground))', fontSize: 10, fontWeight: 700 }} 
              />
            )}

            {currentPnL !== null && currentPnL !== undefined && (
              <ReferenceLine 
                y={currentPnL * factor} 
                stroke="hsl(var(--primary))" 
                strokeWidth={2} 
                strokeDasharray="3 3"
                label={{ value: `SAÍDA ATUAL: ${formatVal(currentPnL)}`, position: 'insideBottomRight', fill: 'hsl(var(--primary))', fontSize: 10, fontWeight: 900 }}
              />
            )}

            {currentSpotPrice && (
              <ReferenceLine x={currentSpotPrice} stroke="hsl(var(--primary))" strokeWidth={3} label={{ value: `PREÇO ATUAL ${currentSpotPrice.toFixed(2)}`, position: 'top', fill: 'hsl(var(--primary))', fontSize: 12, fontWeight: 900 }} />
            )}

            {currentSpotPrice && currentPnL !== null && (
              <ReferenceDot x={currentSpotPrice} y={currentPnL * factor} r={6} fill="hsl(var(--primary))" stroke="white" strokeWidth={2} className="animate-pulse" />
            )}
            
            <ChartTooltip content={<CustomTooltip displayMode={displayMode} />} />
            
            {/* Áreas de Payoff (3 Cores) */}
            <Area type="monotone" dataKey="belowZero" stroke="none" fill="url(#lossGradient)" isAnimationActive={false} />
            <Area type="monotone" dataKey="betweenZeroCdi" stackId="positive" stroke="none" fill="url(#orangeGradient)" isAnimationActive={false} />
            <Area type="monotone" dataKey="aboveCdi" stackId="positive" stroke="none" fill="url(#greenGradient)" isAnimationActive={false} />
            
            {/* Linhas de Referência */}
            <Line name="CDI" type="monotone" dataKey="cdiLine" stroke="hsl(45 95% 55%)" strokeWidth={2} strokeDasharray="3 3" dot={false} isAnimationActive={false} />
            <Line name="Hoje (T+0)" type="monotone" dataKey="profitToday" stroke="hsl(var(--info))" strokeWidth={2} strokeDasharray="5 5" dot={false} isAnimationActive={false} />
            <Line name="No Vencimento" type="monotone" dataKey="profitAtExpiry" stroke="hsl(var(--chart-profit))" strokeWidth={2.5} dot={false} isAnimationActive={false} />
            
            {simulationData && (
              <>
                <Line name="Simulação (Venc.)" type="monotone" dataKey="simulatedAtExpiry" stroke="hsl(var(--primary))" strokeWidth={3} strokeDasharray="10 5" dot={false} isAnimationActive={false} />
                <Line name="CDI do Período" type="monotone" dataKey="periodCdiLine" stroke="hsl(38 92% 50%)" strokeWidth={2} strokeDasharray="2 2" dot={false} isAnimationActive={false} />
              </>
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </ChartContainer>
    </div>
  );
}