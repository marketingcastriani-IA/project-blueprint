import { useMemo } from 'react';
import { PayoffPoint, Leg } from '@/lib/types';
import { calculatePayoffAtExpiry, calculateOptionPrice, calculateCDIReturn } from '@/lib/payoff';
import {
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  Legend,
  Area,
} from 'recharts';

interface PayoffHeatmapProps {
  data: PayoffPoint[];
  breakevens: number[];
  currentSpotPrice?: number | null;
  legs?: Leg[];
  daysToExpiry?: number;
  cdiRate?: number;
  netCost?: number;
  montageTotal?: number;
}

const TIME_SLICES = [
  { key: 'expiry', label: 'Vencimento (D-0)', fraction: 0, color: 'hsl(142, 71%, 45%)', width: 3, dash: '' },
  { key: 't75', label: 'D-25%', fraction: 0.25, color: 'hsl(162, 63%, 44%)', width: 1.8, dash: '8 4' },
  { key: 't50', label: 'D-50%', fraction: 0.5, color: 'hsl(199, 70%, 50%)', width: 1.8, dash: '6 3' },
  { key: 't25', label: 'D-75%', fraction: 0.75, color: 'hsl(262, 55%, 55%)', width: 1.8, dash: '5 4' },
  { key: 'today', label: 'Hoje (T+0)', fraction: 1, color: 'hsl(290, 60%, 52%)', width: 2.5, dash: '10 5' },
];

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;

  // Filter out area keys
  const lines = payload.filter((p: any) => !['profitArea', 'lossArea'].includes(p.dataKey));
  if (lines.length === 0) return null;

  return (
    <div className="rounded-lg border border-border/60 bg-card/95 px-3.5 py-3 shadow-2xl backdrop-blur-md text-xs min-w-[200px]">
      <div className="mb-2 border-b border-border/40 pb-2">
        <p className="text-[10px] font-black uppercase tracking-[0.15em] text-muted-foreground">Preço do Ativo</p>
        <p className="text-base font-bold font-mono text-foreground">R$ {Number(label).toFixed(2)}</p>
      </div>
      <div className="space-y-1.5">
        {lines.map((p: any, i: number) => (
          <div key={i} className="flex items-center justify-between gap-6">
            <div className="flex items-center gap-2">
              <div
                className="h-2.5 w-2.5 rounded-sm shrink-0"
                style={{ backgroundColor: p.color }}
              />
              <span className="text-muted-foreground text-[11px]">{p.name}</span>
            </div>
            <span
              className={`font-mono font-bold text-[11px] ${
                p.value >= 0 ? 'text-emerald-400' : 'text-red-400'
              }`}
            >
              {p.value >= 0 ? '+' : ''}R$ {Number(p.value).toFixed(2)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default function PayoffHeatmap({
  data,
  breakevens,
  currentSpotPrice,
  legs,
  daysToExpiry = 30,
  cdiRate = 0,
  netCost = 0,
  montageTotal,
}: PayoffHeatmapProps) {
  const hasLegs = legs && legs.length > 0;
  const investedCapital = Math.max(Math.abs(montageTotal ?? netCost ?? 0), 1);

  const chartData = useMemo(() => {
    if (data.length === 0) return [];

    return data.map((p) => {
      const point: Record<string, number> = { price: p.price };

      for (const slice of TIME_SLICES) {
        if (hasLegs) {
          // Use Black-Scholes calculation when legs available
          const dte = Math.max(daysToExpiry, 1);
          const remainingDays = dte * slice.fraction;
          const T = remainingDays / 365;

          let profit: number;
          if (remainingDays <= 0.5) {
            profit = calculatePayoffAtExpiry(legs, p.price);
          } else {
            profit = 0;
            for (const leg of legs) {
              const mult = leg.side === 'buy' ? 1 : -1;
              if (leg.option_type === 'stock') {
                profit += mult * (p.price - leg.price) * leg.quantity;
              } else {
                const theo = calculateOptionPrice(
                  leg.option_type,
                  p.price,
                  leg.strike,
                  T,
                  0.12,
                  0.25
                );
                profit += mult * (theo - leg.price) * leg.quantity;
              }
            }
          }
          point[slice.key] = profit;
        } else {
          // Fallback: interpolate between profitToday and profitAtExpiry
          point[slice.key] = lerp(p.profitAtExpiry, p.profitToday, slice.fraction);
        }
      }

      // Area fill based on expiry profit
      const expiryProfit = point['expiry'];
      point['profitArea'] = expiryProfit >= 0 ? expiryProfit : 0;
      point['lossArea'] = expiryProfit < 0 ? expiryProfit : 0;

      // CDI line
      if (cdiRate > 0 && daysToExpiry > 0) {
        point['cdiLine'] = calculateCDIReturn(investedCapital, cdiRate, daysToExpiry, false);
      }

      return point;
    });
  }, [data, legs, daysToExpiry, hasLegs, cdiRate, investedCapital]);

  if (data.length === 0) {
    return (
      <div className="h-[450px] flex items-center justify-center bg-muted/10 rounded-xl border border-border/50">
        <p className="text-sm text-muted-foreground">Sem dados de payoff disponíveis</p>
      </div>
    );
  }

  const prices = data.map((p) => p.price);
  const minPrice = prices[0];
  const maxPrice = prices[prices.length - 1];

  return (
    <div className="h-[450px] w-full rounded-xl border border-border/30 bg-card/20 p-1">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={chartData} margin={{ top: 20, right: 25, left: 5, bottom: 5 }}>
          <defs>
            <linearGradient id="hmProfitGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="hsl(142, 76%, 46%)" stopOpacity={0.2} />
              <stop offset="100%" stopColor="hsl(142, 76%, 46%)" stopOpacity={0.01} />
            </linearGradient>
            <linearGradient id="hmLossGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="hsl(0, 84%, 60%)" stopOpacity={0.01} />
              <stop offset="100%" stopColor="hsl(0, 84%, 60%)" stopOpacity={0.2} />
            </linearGradient>
          </defs>

          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.15} />

          <XAxis
            type="number"
            dataKey="price"
            domain={[minPrice, maxPrice]}
            tickFormatter={(v) => `${v.toFixed(0)}`}
            stroke="hsl(var(--muted-foreground))"
            fontSize={10}
            tick={{ fill: 'hsl(var(--muted-foreground))' }}
            label={{
              value: 'Preço do Ativo (R$)',
              position: 'insideBottom',
              offset: -2,
              fill: 'hsl(var(--muted-foreground))',
              fontSize: 10,
              fontWeight: 600,
            }}
          />
          <YAxis
            tickFormatter={(v) => `${v.toFixed(0)}`}
            stroke="hsl(var(--muted-foreground))"
            fontSize={10}
            width={55}
            tick={{ fill: 'hsl(var(--muted-foreground))' }}
            label={{
              value: 'Resultado (R$)',
              angle: -90,
              position: 'insideLeft',
              offset: 10,
              fill: 'hsl(var(--muted-foreground))',
              fontSize: 10,
              fontWeight: 600,
            }}
          />

          <Tooltip content={<CustomTooltip />} />
          <Legend
            wrapperStyle={{ fontSize: 10, paddingTop: 4 }}
            iconType="plainline"
            formatter={(value: string) => (
              <span className="text-muted-foreground text-[10px]">{value}</span>
            )}
          />

          {/* Zero line */}
          <ReferenceLine
            y={0}
            stroke="hsl(var(--muted-foreground))"
            strokeDasharray="6 3"
            strokeOpacity={0.4}
            strokeWidth={1.5}
          />

          {/* Breakeven lines */}
          {breakevens.map((be, i) => (
            <ReferenceLine
              key={`be-${i}`}
              x={be}
              stroke="hsl(45, 93%, 55%)"
              strokeWidth={1.5}
              strokeDasharray="5 3"
              label={{
                value: `BE ${be.toFixed(2)}`,
                position: 'top',
                fill: 'hsl(45, 93%, 55%)',
                fontSize: 9,
                fontWeight: 800,
              }}
            />
          ))}

          {/* Current spot */}
          {currentSpotPrice && (
            <ReferenceLine
              x={currentSpotPrice}
              stroke="hsl(var(--primary))"
              strokeWidth={2}
              label={{
                value: `SPOT ${currentSpotPrice.toFixed(2)}`,
                position: 'top',
                fill: 'hsl(var(--primary))',
                fontSize: 10,
                fontWeight: 900,
              }}
            />
          )}

          {/* Shaded profit/loss areas */}
          <Area
            type="monotone"
            dataKey="profitArea"
            stroke="none"
            fill="url(#hmProfitGrad)"
            isAnimationActive={false}
            legendType="none"
          />
          <Area
            type="monotone"
            dataKey="lossArea"
            stroke="none"
            fill="url(#hmLossGrad)"
            isAnimationActive={false}
            legendType="none"
          />

          {/* Time slice lines — render in reverse so Vencimento is on top */}
          {[...TIME_SLICES].reverse().map((slice) => (
            <Line
              key={slice.key}
              name={slice.label}
              type="monotone"
              dataKey={slice.key}
              stroke={slice.color}
              strokeWidth={slice.width}
              strokeDasharray={slice.dash || undefined}
              dot={false}
              isAnimationActive={false}
            />
          ))}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
