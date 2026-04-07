import { useState, useMemo, lazy, Suspense } from 'react';
import { PayoffPoint } from '@/lib/types';
import { Leg } from '@/lib/types';
import { ChartContainer, ChartTooltip } from '@/components/ui/chart';
import { Area, CartesianGrid, ReferenceLine, XAxis, YAxis, Line, ComposedChart, ResponsiveContainer, ReferenceDot } from 'recharts';
import { calculateCDIReturn, calculatePortfolioGreeks } from '@/lib/payoff';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { TrendingUp, TrendingDown, Target, Percent, DollarSign, Layers, Clock, Activity } from 'lucide-react';

const PayoffHeatmap = lazy(() => import('./PayoffHeatmap'));

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
  if (!active || !payload?.length) return null;

  const format = (val: number) => {
    if (displayMode === 'percent') return `${val.toFixed(2)}%`;
    return `R$ ${val.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
  };

  const greeks = legs && legs.length > 0 && daysToExpiry > 0
    ? calculatePortfolioGreeks(legs, label, daysToExpiry, cdiRate)
    : null;

  const filteredPayload = payload.filter((p: any) =>
    !['gainZone', 'lossZone'].includes(p.dataKey)
  );

  return (
    <div className="rounded-xl border border-border/60 bg-card/95 p-3.5 shadow-2xl backdrop-blur-md min-w-[220px]">
      <div className="mb-2.5 border-b border-border/40 pb-2">
        <p className="text-[10px] font-black uppercase tracking-[0.15em] text-muted-foreground mb-0.5">Preço do Ativo</p>
        <p className="text-base font-bold font-mono text-foreground">R$ {Number(label).toFixed(2)}</p>
      </div>
      <div className="space-y-2">
        {filteredPayload.map((p: any, i: number) => (
          <div key={i} className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="h-2.5 w-2.5 rounded-full shrink-0 ring-1 ring-white/10" style={{ backgroundColor: p.color }} />
              <span className="text-[11px] font-medium text-foreground/70">{p.name}</span>
            </div>
            <span className={cn(
              "text-[11px] font-black font-mono",
              p.value >= 0 ? "text-emerald-400" : "text-red-400"
            )}>
              {format(p.value)}
            </span>
          </div>
        ))}
      </div>
      {greeks && (
        <div className="mt-2.5 pt-2.5 border-t border-border/40">
          <p className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground mb-1.5">Greeks</p>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1">
            <div className="flex justify-between">
              <span className="text-[10px] text-muted-foreground">Δ Delta</span>
              <span className="text-[10px] font-mono font-bold text-foreground/80">{greeks.delta}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[10px] text-muted-foreground">Γ Gamma</span>
              <span className="text-[10px] font-mono font-bold text-foreground/80">{greeks.gamma}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[10px] text-muted-foreground">Θ Theta</span>
              <span className="text-[10px] font-mono font-bold text-foreground/80">{greeks.theta}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[10px] text-muted-foreground">ν Vega</span>
              <span className="text-[10px] font-mono font-bold text-foreground/80">{greeks.vega}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
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
  simulationCdiReturn,
  legs
}: PayoffChartProps) {
  const [displayMode, setDisplayMode] = useState<'value' | 'percent'>('value');
  const [viewMode, setViewMode] = useState<'2d' | 'temporal'>('2d');

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
        // Green zone: profit above zero
        gainZone: (profit > 0 ? profit : 0) * factor,
        // Red zone: loss below zero
        lossZone: (profit < 0 ? profit : 0) * factor,
        cdiLine: cdi * factor,
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

  // Compute risk/reward ratio
  const riskRewardRatio = useMemo(() => {
    if (!maxGain || !maxLoss || maxGain === 'Ilimitado' || maxLoss === 'Ilimitado') return null;
    const ratio = Math.abs(maxGain) / Math.abs(maxLoss);
    return ratio.toFixed(2);
  }, [maxGain, maxLoss]);

  return (
    <div className="space-y-4">
      {/* Metrics row */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        <div className="p-3 rounded-xl bg-muted/20 border border-border/40 hover:border-success/30 transition-colors">
          <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground mb-1 flex items-center gap-1">
            <TrendingUp className="h-3 w-3 text-success" /> Lucro Máx.
          </p>
          <p className="text-sm font-bold text-success font-mono">{formatVal(maxGain)}</p>
        </div>
        <div className="p-3 rounded-xl bg-muted/20 border border-border/40 hover:border-destructive/30 transition-colors">
          <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground mb-1 flex items-center gap-1">
            <TrendingDown className="h-3 w-3 text-destructive" /> Risco Máx.
          </p>
          <p className="text-sm font-bold text-destructive font-mono">{formatVal(maxLoss)}</p>
        </div>
        <div className="p-3 rounded-xl bg-muted/20 border border-border/40 hover:border-warning/30 transition-colors">
          <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground mb-1 flex items-center gap-1">
            <Target className="h-3 w-3 text-warning" /> Breakeven
          </p>
          <p className="text-sm font-bold font-mono">
            {breakevens.length > 0
              ? breakevens.map((b) => `R$${b.toFixed(2)}`).join(' | ')
              : 'N/A'}
          </p>
        </div>
        {riskRewardRatio && (
          <div className="p-3 rounded-xl bg-muted/20 border border-border/40 hover:border-primary/30 transition-colors">
            <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground mb-1 flex items-center gap-1">
              <Activity className="h-3 w-3 text-primary" /> Risco/Retorno
            </p>
            <p className="text-sm font-bold text-primary font-mono">1:{riskRewardRatio}</p>
          </div>
        )}
        <div className="flex items-center justify-end gap-1 flex-wrap">
          <div className="flex rounded-lg border border-border/40 overflow-hidden">
            <Button
              variant="ghost"
              size="sm"
              className={cn(
                "h-8 px-3 text-[10px] font-bold rounded-none border-r border-border/40",
                viewMode === '2d' && "bg-primary/15 text-primary"
              )}
              onClick={() => setViewMode('2d')}
            >
              <Layers className="h-3 w-3 mr-1" /> Payoff
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className={cn(
                "h-8 px-3 text-[10px] font-bold rounded-none",
                viewMode === 'temporal' && "bg-primary/15 text-primary"
              )}
              onClick={() => setViewMode('temporal')}
            >
              <Clock className="h-3 w-3 mr-1" /> Temporal
            </Button>
          </div>
          <div className="w-px h-6 bg-border/40" />
          <div className="flex rounded-lg border border-border/40 overflow-hidden">
            <Button
              variant="ghost"
              size="sm"
              className={cn(
                "h-8 px-3 text-[10px] font-bold rounded-none border-r border-border/40",
                displayMode === 'value' && "bg-primary/15 text-primary"
              )}
              onClick={() => setDisplayMode('value')}
            >
              <DollarSign className="h-3 w-3 mr-1" /> R$
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className={cn(
                "h-8 px-3 text-[10px] font-bold rounded-none",
                displayMode === 'percent' && "bg-primary/15 text-primary"
              )}
              onClick={() => setDisplayMode('percent')}
            >
              <Percent className="h-3 w-3 mr-1" /> %
            </Button>
          </div>
        </div>
      </div>

      {viewMode === 'temporal' ? (
        <Suspense fallback={
          <div className="h-[450px] flex items-center justify-center bg-muted/10 rounded-xl border border-border/40">
            <div className="flex flex-col items-center gap-3">
              <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
              <span className="text-sm text-muted-foreground">Carregando gráfico temporal...</span>
            </div>
          </div>
        }>
          <PayoffHeatmap
            data={data}
            breakevens={breakevens}
            currentSpotPrice={currentSpotPrice}
            legs={legs}
            daysToExpiry={daysToExpiry}
          />
        </Suspense>
      ) : (
        <div className="rounded-xl border border-border/30 bg-card/20 p-1">
          <ChartContainer config={chartConfig} className="h-[450px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData} margin={{ top: 25, right: 25, left: 5, bottom: 20 }}>
                <defs>
                  <linearGradient id="gainZoneGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(142, 76%, 40%)" stopOpacity={0.45} />
                    <stop offset="100%" stopColor="hsl(142, 76%, 40%)" stopOpacity={0.05} />
                  </linearGradient>
                  <linearGradient id="lossZoneGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(0, 80%, 55%)" stopOpacity={0.05} />
                    <stop offset="100%" stopColor="hsl(0, 80%, 55%)" stopOpacity={0.45} />
                  </linearGradient>
                </defs>

                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.15} />

                <XAxis
                  type="number"
                  dataKey="price"
                  domain={[minPrice, maxPrice]}
                  tickFormatter={(v) => v.toFixed(0)}
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={10}
                  tick={{ fill: 'hsl(var(--muted-foreground))' }}
                  label={{
                    value: 'Preço do Ativo (R$)',
                    position: 'insideBottom',
                    offset: -8,
                    fill: 'hsl(var(--muted-foreground))',
                    fontSize: 10,
                    fontWeight: 600,
                  }}
                />
                <YAxis
                  tickFormatter={(v) => displayMode === 'percent' ? `${v.toFixed(1)}%` : `${v.toFixed(0)}`}
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={10}
                  width={60}
                  tick={{ fill: 'hsl(var(--muted-foreground))' }}
                  label={{
                    value: displayMode === 'percent' ? 'ROI (%)' : 'Resultado (R$)',
                    angle: -90,
                    position: 'insideLeft',
                    offset: 15,
                    fill: 'hsl(var(--muted-foreground))',
                    fontSize: 10,
                    fontWeight: 600,
                  }}
                />

                {/* Zero line — bold dark separator */}
                <ReferenceLine y={0} stroke="hsl(var(--foreground))" strokeOpacity={0.7} strokeWidth={2.5} label={{ value: 'ZERO', position: 'insideRight', fill: 'hsl(var(--foreground))', fontSize: 9, fontWeight: 900, opacity: 0.5 }} />

                {/* Green gain zone */}
                <Area type="monotone" dataKey="gainZone" stroke="none" fill="url(#gainZoneGrad)" isAnimationActive={false} legendType="none" />
                {/* Red loss zone */}
                <Area type="monotone" dataKey="lossZone" stroke="none" fill="url(#lossZoneGrad)" isAnimationActive={false} legendType="none" />

                {/* Entry spot price */}
                {entrySpotPrice && (
                  <ReferenceLine 
                    x={entrySpotPrice} 
                    stroke="hsl(var(--muted-foreground))" 
                    strokeWidth={1.5} 
                    strokeDasharray="4 4"
                    label={{ value: `ENTRADA ${entrySpotPrice.toFixed(2)}`, position: 'top', fill: 'hsl(var(--muted-foreground))', fontSize: 9, fontWeight: 700 }} 
                  />
                )}

                {/* Current PnL line */}
                {currentPnL !== null && currentPnL !== undefined && (
                  <ReferenceLine 
                    y={currentPnL * factor} 
                    stroke="hsl(var(--primary))" 
                    strokeWidth={1.5} 
                    strokeDasharray="4 3"
                    label={{ value: `P/L ATUAL: ${formatVal(currentPnL)}`, position: 'insideBottomRight', fill: 'hsl(var(--primary))', fontSize: 9, fontWeight: 900 }}
                  />
                )}

                {/* Current spot */}
                {currentSpotPrice && (
                  <ReferenceLine
                    x={currentSpotPrice}
                    stroke="hsl(var(--primary))"
                    strokeWidth={2.5}
                    label={{ value: `SPOT ${currentSpotPrice.toFixed(2)}`, position: 'top', fill: 'hsl(var(--primary))', fontSize: 11, fontWeight: 900 }}
                  />
                )}

                {/* Breakeven markers */}
                {breakevens.map((be, i) => (
                  <ReferenceLine
                    key={`be-${i}`}
                    x={be}
                    stroke="hsl(45, 93%, 55%)"
                    strokeWidth={1.5}
                    strokeDasharray="5 3"
                    label={{ value: `BE ${be.toFixed(2)}`, position: 'insideTopRight', fill: 'hsl(45, 93%, 55%)', fontSize: 9, fontWeight: 800 }}
                  />
                ))}

                {/* Current position dot */}
                {currentSpotPrice && currentPnL !== null && (
                  <ReferenceDot x={currentSpotPrice} y={currentPnL * factor} r={7} fill="hsl(var(--primary))" stroke="hsl(var(--background))" strokeWidth={2.5} />
                )}

                <ChartTooltip content={<CustomTooltip displayMode={displayMode} legs={legs} daysToExpiry={daysToExpiry} cdiRate={cdiRate} />} />

                {/* CDI line — bold and prominent */}
                <Line name="── CDI ──" type="monotone" dataKey="cdiLine" stroke="hsl(45, 95%, 55%)" strokeWidth={2.5} dot={false} isAnimationActive={false} />

                {/* Payoff lines */}
                <Line name="Hoje (T+0)" type="monotone" dataKey="profitToday" stroke="hsl(var(--info))" strokeWidth={2} strokeDasharray="6 4" dot={false} isAnimationActive={false} />
                <Line name="No Vencimento" type="monotone" dataKey="profitAtExpiry" stroke="hsl(var(--chart-profit))" strokeWidth={2.5} dot={false} isAnimationActive={false} />

                {simulationData && (
                  <>
                    <Line name="Simulação (Venc.)" type="monotone" dataKey="simulatedAtExpiry" stroke="hsl(var(--primary))" strokeWidth={3} strokeDasharray="10 5" dot={false} isAnimationActive={false} />
                    <Line name="CDI do Período" type="monotone" dataKey="periodCdiLine" stroke="hsl(38 92% 50%)" strokeWidth={1.5} strokeDasharray="3 3" dot={false} isAnimationActive={false} />
                  </>
                )}
              </ComposedChart>
            </ResponsiveContainer>
          </ChartContainer>
        </div>
      )}
    </div>
  );
}
