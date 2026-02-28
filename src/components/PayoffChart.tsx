import { PayoffPoint } from '@/lib/types';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { Area, AreaChart, CartesianGrid, ReferenceLine, XAxis, YAxis, Line, ComposedChart } from 'recharts';
import { calculateCDIReturn } from '@/lib/payoff';

interface PayoffChartProps {
  data: PayoffPoint[];
  breakevens: number[];
  cdiRate?: number;
  daysToExpiry?: number;
  netCost?: number;
  montageTotal?: number;
}

const chartConfig = {
  profitAtExpiry: { label: 'No Vencimento', color: 'hsl(var(--chart-profit))' },
  belowZero: { label: 'Prejuízo', color: 'hsl(var(--destructive))' },
  betweenZeroCdi: { label: 'Lucro < CDI', color: 'hsl(38 92% 50%)' },
  aboveCdi: { label: 'Lucro > CDI', color: 'hsl(var(--success))' },
  cdiReturn: { label: 'CDI', color: 'hsl(45 95% 55%)' },
};

export default function PayoffChart({ data, breakevens, cdiRate = 0, daysToExpiry = 0, netCost = 0, montageTotal }: PayoffChartProps) {
  if (data.length === 0) return null;

  const investedCapital = Math.max(Math.abs(montageTotal ?? netCost ?? 0), 1);
  const cdiValue = cdiRate > 0 && daysToExpiry > 0
    ? calculateCDIReturn(investedCapital, cdiRate, daysToExpiry, false)
    : null;

  const sortedData = [...data].sort((a, b) => a.price - b.price);

  // Build chart data with the actual payoff line + colored zones
  const chartData = sortedData.map((p) => {
    const profit = p.profitAtExpiry;
    const cdi = cdiValue ?? 0;

    return {
      price: p.price,
      profitAtExpiry: profit,
      // Zones for area fills
      belowZero: profit < 0 ? profit : 0,
      betweenZeroCdi: profit > 0 && cdi > 0
        ? Math.min(profit, cdi)
        : (profit > 0 ? profit : 0),
      aboveCdi: cdi > 0 && profit > cdi ? profit - cdi : 0,
      cdiLine: cdiValue !== null ? Math.round(cdiValue * 100) / 100 : undefined,
    };
  });

  const prices = sortedData.map((p) => p.price);
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);

  const profits = sortedData.map((p) => p.profitAtExpiry);
  const allValues = [...profits, cdiValue ?? 0];
  const minProfit = Math.min(...allValues);
  const maxProfit = Math.max(...allValues);
  const range = maxProfit - minProfit || 1;
  const padding = range * 0.15;

  return (
    <ChartContainer config={chartConfig} className="h-[380px] w-full">
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
          domain={[minProfit - padding, maxProfit + padding]}
          tickFormatter={(v) => v.toFixed(0)}
          className="text-xs"
          stroke="hsl(var(--muted-foreground))"
          fontSize={11}
          width={50}
        />
        
        {/* Zero line */}
        <ReferenceLine y={0} stroke="hsl(var(--muted-foreground))" strokeDasharray="4 4" strokeOpacity={0.5} />
        
        {/* Breakeven markers */}
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
        
        {/* CDI benchmark line */}
        {cdiValue !== null && (
          <ReferenceLine
            y={cdiValue}
            stroke="hsl(45 95% 55%)"
            strokeWidth={2}
            strokeDasharray="8 4"
            label={{
              value: `CDI R$${cdiValue.toFixed(2)}`,
              position: 'right',
              fill: 'hsl(45 95% 55%)',
              fontSize: 11,
              fontWeight: 600,
            }}
          />
        )}
        
        <ChartTooltip content={<ChartTooltipContent />} />
        
        {/* Loss zone (red) */}
        <Area
          type="monotone"
          dataKey="belowZero"
          stroke="none"
          fill="url(#lossGradient)"
          dot={false}
          activeDot={false}
          isAnimationActive={false}
        />
        {/* Profit below CDI zone (orange) */}
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
        {/* Profit above CDI zone (green) */}
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
        
        {/* Main payoff line */}
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
    </ChartContainer>
  );
}
