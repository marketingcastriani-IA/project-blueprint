import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { AreaChart, Area, XAxis, YAxis, Tooltip as RTooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart3 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

interface PortfolioStats {
  totalPL: number;
  roi: number;
  openCount: number;
  closedCount: number;
  winRate: number;
  evolutionData: { name: string; pl: number }[];
}

async function fetchPortfolioStats(userId: string): Promise<PortfolioStats | null> {
  const { data: allAnalyses } = await supabase
    .from('analyses')
    .select('id, status, created_at, closed_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: true });

  if (!allAnalyses || allAnalyses.length === 0) return null;

  const closedAnalyses = allAnalyses.filter(a => a.status === 'closed');
  const openAnalyses = allAnalyses.filter(a => a.status !== 'closed');

  if (closedAnalyses.length === 0 && openAnalyses.length === 0) return null;

  const closedIds = closedAnalyses.map(a => a.id);
  let totalPL = 0;
  let totalInvested = 0;
  let wins = 0;
  const evolutionData: { name: string; pl: number }[] = [];

  if (closedIds.length > 0) {
    const { data: legs } = await supabase
      .from('legs')
      .select('analysis_id, side, price, current_price, quantity')
      .in('analysis_id', closedIds);

    if (legs) {
      const analysisMap: Record<string, typeof legs> = {};
      legs.forEach(l => {
        if (!analysisMap[l.analysis_id]) analysisMap[l.analysis_id] = [];
        analysisMap[l.analysis_id].push(l);
      });

      let cumulativePL = 0;
      closedAnalyses.forEach((analysis) => {
        const strategyLegs = analysisMap[analysis.id] || [];
        let strategyPL = 0;
        let strategyNetCost = 0;
        strategyLegs.forEach(l => {
          const multiplier = l.side === 'buy' ? 1 : -1;
          if (l.current_price != null) {
            strategyPL += multiplier * (l.current_price - l.price) * l.quantity;
          }
          const costMultiplier = l.side === 'buy' ? -1 : 1;
          strategyNetCost += costMultiplier * l.price * l.quantity;
        });

        totalPL += strategyPL;
        cumulativePL += strategyPL;
        if (strategyPL > 0) wins++;
        if (strategyNetCost < 0) totalInvested += Math.abs(strategyNetCost);

        const date = analysis.closed_at || analysis.created_at;
        evolutionData.push({
          name: new Date(date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
          pl: Math.round(cumulativePL * 100) / 100,
        });
      });
    }
  }

  return {
    totalPL,
    roi: totalInvested > 0 ? (totalPL / totalInvested) * 100 : (totalPL > 0 ? 100 : 0),
    openCount: openAnalyses.length,
    closedCount: closedAnalyses.length,
    winRate: closedAnalyses.length > 0 ? (wins / closedAnalyses.length) * 100 : 0,
    evolutionData,
  };
}

export default function PortfolioSummary({ userId }: { userId: string }) {
  const { data: stats, isLoading } = useQuery({
    queryKey: ['portfolio-summary', userId],
    queryFn: () => fetchPortfolioStats(userId),
    staleTime: 30_000,
  });

  if (isLoading || !stats) return null;
  if (stats.totalPL === 0 && stats.openCount === 0 && stats.closedCount === 0) return null;

  const isNegative = stats.totalPL < 0;
  const lastPL = stats.evolutionData.length > 0 ? stats.evolutionData[stats.evolutionData.length - 1].pl : 0;
  const chartIsNegative = lastPL < 0;

  return (
    <div className="mb-6 space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="border-border/40 bg-card/80">
          <CardContent className="py-3 px-4">
            <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Resultado Total</p>
            <p className={cn("text-xl font-black tracking-tighter", stats.totalPL >= 0 ? "text-success" : "text-destructive")}>
              R$ {stats.totalPL.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </p>
          </CardContent>
        </Card>
        <Card className="border-border/40 bg-card/80">
          <CardContent className="py-3 px-4">
            <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">ROI Consolidado</p>
            <p className={cn("text-xl font-black tracking-tighter", stats.roi >= 0 ? "text-success" : "text-destructive")}>
              {stats.roi >= 0 ? '+' : ''}{stats.roi.toFixed(2)}%
            </p>
          </CardContent>
        </Card>
        <Card className="border-border/40 bg-card/80">
          <CardContent className="py-3 px-4">
            <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Operações</p>
            <div className="flex items-baseline gap-2">
              <p className="text-xl font-black tracking-tighter text-foreground">{stats.openCount + stats.closedCount}</p>
              <span className="text-xs text-muted-foreground font-bold">{stats.openCount} abertas · {stats.closedCount} fechadas</span>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/40 bg-card/80">
          <CardContent className="py-3 px-4">
            <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Taxa de Acerto</p>
            <p className={cn("text-xl font-black tracking-tighter", stats.winRate >= 50 ? "text-success" : "text-warning")}>
              {stats.winRate.toFixed(0)}%
            </p>
          </CardContent>
        </Card>
      </div>

      {stats.evolutionData.length >= 2 && (
        <Card className="border-primary/20 bg-card/80">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-black flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-primary" /> Evolução do P&L Acumulado
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[180px] sm:h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={stats.evolutionData}>
                  <defs>
                    <linearGradient id="plGradientPositive" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--success))" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="hsl(var(--success))" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="plGradientNegative" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--destructive))" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="hsl(var(--destructive))" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" tickLine={false} axisLine={false} tickFormatter={(v: number) => `R$${v}`} />
                  <RTooltip
                    contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }}
                    formatter={(value: number) => [`R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 'P&L Acumulado']}
                  />
                  <ReferenceLine y={0} stroke="hsl(var(--muted-foreground))" strokeDasharray="3 3" strokeOpacity={0.5} />
                  <Area 
                    type="monotone" 
                    dataKey="pl" 
                    stroke={chartIsNegative ? "hsl(var(--destructive))" : "hsl(var(--success))"} 
                    strokeWidth={2} 
                    fill={chartIsNegative ? "url(#plGradientNegative)" : "url(#plGradientPositive)"} 
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
