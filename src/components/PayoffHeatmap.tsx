import { useMemo } from 'react';
import { PayoffPoint, Leg } from '@/lib/types';
import { calculatePayoffAtExpiry, calculateOptionPrice } from '@/lib/payoff';
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
}

const TIME_SLICES = [
  { label: 'Vencimento', fraction: 0, color: 'hsl(142, 76%, 46%)', width: 2.5, dash: '' },
  { label: 'T+75%', fraction: 0.25, color: 'hsl(160, 60%, 45%)', width: 1.5, dash: '8 4' },
  { label: 'T+50%', fraction: 0.5, color: 'hsl(200, 70%, 55%)', width: 1.5, dash: '6 3' },
  { label: 'T+25%', fraction: 0.75, color: 'hsl(260, 60%, 60%)', width: 1.5, dash: '4 4' },
  { label: 'Hoje (T+0)', fraction: 1, color: 'hsl(280, 65%, 55%)', width: 2, dash: '10 5' },
];

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;

  return (
    <div className="rounded-lg border border-border/50 bg-card/95 px-3 py-2.5 shadow-xl backdrop-blur-sm text-xs">
      <div className="mb-2 border-b border-border/50 pb-1.5">
        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Preço do Ativo</p>
        <p className="text-sm font-bold font-mono">R$ {Number(label).toFixed(2)}</p>
      </div>
      <div className="space-y-1">
        {payload.map((p: any, i: number) => (
          <div key={i} className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: p.color }} />
              <span className="text-muted-foreground">{p.name}</span>
            </div>
            <span className={`font-mono font-bold ${p.value >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {p.value >= 0 ? '+' : ''}R$ {p.value.toFixed(2)}
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
}: PayoffHeatmapProps) {
  const chartData = useMemo(() => {
    if (!legs || legs.length === 0 || data.length === 0) return [];

    const prices = data.map((p) => p.price);
    const dte = Math.max(daysToExpiry, 1);

    return prices.map((spot) => {
      const point: Record<string, number> = { price: spot };

      for (const slice of TIME_SLICES) {
        const remainingDays = dte * slice.fraction;
        const T = remainingDays / 365;

        let profit: number;
        if (remainingDays <= 0.5) {
          profit = calculatePayoffAtExpiry(legs, spot);
        } else {
          profit = 0;
          for (const leg of legs) {
            const mult = leg.side === 'buy' ? 1 : -1;
            if (leg.option_type === 'stock') {
              profit += mult * (spot - leg.price) * leg.quantity;
            } else {
              const theo = calculateOptionPrice(leg.option_type, spot, leg.strike, T, 0.12, 0.25);
              profit += mult * (theo - leg.price) * leg.quantity;
            }
          }
        }
        point[slice.label] = profit;
      }

      // Area fill: profit at expiry split into positive/negative
      const expiryProfit = point['Vencimento'];
      point['profitArea'] = expiryProfit >= 0 ? expiryProfit : 0;
      point['lossArea'] = expiryProfit < 0 ? expiryProfit : 0;

      return point;
    });
  }, [data, legs, daysToExpiry]);

  if (!legs || legs.length === 0) {
    return (
      <div className="h-[450px] flex items-center justify-center bg-muted/10 rounded-xl border border-border/50">
        <p className="text-sm text-muted-foreground">Adicione pernas para visualizar o gráfico temporal</p>
      </div>
    );
  }

  const prices = data.map((p) => p.price);
  const minPrice = prices[0];
  const maxPrice = prices[prices.length - 1];

  return (
    <div className="h-[450px] w-full rounded-xl border border-border/30 bg-card/30 p-2">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={chartData} margin={{ top: 20, right: 30, left: 10, bottom: 5 }}>
          <defs>
            <linearGradient id="profitGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="hsl(142, 76%, 46%)" stopOpacity={0.25} />
              <stop offset="100%" stopColor="hsl(142, 76%, 46%)" stopOpacity={0.02} />
            </linearGradient>
            <linearGradient id="lossGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="hsl(0, 84%, 60%)" stopOpacity={0.02} />
              <stop offset="100%" stopColor="hsl(0, 84%, 60%)" stopOpacity={0.25} />
            </linearGradient>
          </defs>

          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.2} />

          <XAxis
            type="number"
            dataKey="price"
            domain={[minPrice, maxPrice]}
            tickFormatter={(v) => v.toFixed(0)}
            stroke="hsl(var(--muted-foreground))"
            fontSize={11}
            tick={{ fill: 'hsl(var(--muted-foreground))' }}
          />
          <YAxis
            tickFormatter={(v) => `R$${v.toFixed(0)}`}
            stroke="hsl(var(--muted-foreground))"
            fontSize={11}
            width={65}
            tick={{ fill: 'hsl(var(--muted-foreground))' }}
          />

          <Tooltip content={<CustomTooltip />} />
          <Legend
            wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
            formatter={(value: string) => (
              <span style={{ color: 'hsl(var(--muted-foreground))' }}>{value}</span>
            )}
          />

          {/* Zero line */}
          <ReferenceLine y={0} stroke="hsl(var(--muted-foreground))" strokeDasharray="4 4" strokeOpacity={0.5} />

          {/* Breakeven lines */}
          {breakevens.map((be, i) => (
            <ReferenceLine
              key={`be-${i}`}
              x={be}
              stroke="hsl(45, 95%, 55%)"
              strokeWidth={1.5}
              strokeDasharray="4 4"
              label={{
                value: `BE ${be.toFixed(2)}`,
                position: 'top',
                fill: 'hsl(45, 95%, 55%)',
                fontSize: 10,
                fontWeight: 700,
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
                fontSize: 11,
                fontWeight: 900,
              }}
            />
          )}

          {/* Shaded profit/loss areas at expiry */}
          <Area
            type="monotone"
            dataKey="profitArea"
            stroke="none"
            fill="url(#profitGrad)"
            isAnimationActive={false}
            legendType="none"
          />
          <Area
            type="monotone"
            dataKey="lossArea"
            stroke="none"
            fill="url(#lossGrad)"
            isAnimationActive={false}
            legendType="none"
          />

          {/* Time slice lines */}
          {TIME_SLICES.map((slice) => (
            <Line
              key={slice.label}
              name={slice.label}
              type="monotone"
              dataKey={slice.label}
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
