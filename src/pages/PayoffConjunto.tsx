import { useEffect, useState, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useAccessControl } from '@/hooks/useAccessControl';
import { supabase } from '@/integrations/supabase/client';
import { generatePayoffCurve } from '@/lib/payoff';
import { Leg } from '@/lib/types';
import Header from '@/components/Header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Zap, Layers, TrendingUp, TrendingDown, Target, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import {
  ComposedChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer, Legend,
} from 'recharts';

const COLORS = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316'];

interface AnalysisWithLegs {
  id: string;
  name: string;
  legs: Leg[];
}

export default function PayoffConjunto() {
  const { user } = useAuth();
  const access = useAccessControl();
  const navigate = useNavigate();
  const [analyses, setAnalyses] = useState<AnalysisWithLegs[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      const { data: analysesData } = await supabase
        .from('analyses')
        .select('id, name')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .order('created_at', { ascending: false });

      if (!analysesData?.length) { setLoading(false); return; }

      const { data: legsData } = await supabase
        .from('legs')
        .select('*')
        .in('analysis_id', analysesData.map(a => a.id));

      const result: AnalysisWithLegs[] = analysesData.map(a => ({
        id: a.id,
        name: a.name,
        legs: (legsData ?? [])
          .filter(l => l.analysis_id === a.id)
          .map(l => ({
            side: l.side as 'buy' | 'sell',
            option_type: l.option_type as 'call' | 'put' | 'stock',
            asset: l.asset,
            strike: Number(l.strike),
            price: Number(l.price),
            quantity: l.quantity,
            expiry_date: l.expiry_date ?? undefined,
          })),
      })).filter(a => a.legs.length > 0);

      setAnalyses(result);
      setLoading(false);
    })();
  }, [user]);

  const toggle = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const selectedAnalyses = useMemo(() => analyses.filter(a => selected.has(a.id)), [analyses, selected]);

  const { chartData, consolidatedMetrics } = useMemo(() => {
    if (selectedAnalyses.length === 0) return { chartData: [], consolidatedMetrics: null };

    // Generate curves for each
    const curves = selectedAnalyses.map(a => generatePayoffCurve(a.legs, 0, 14.90, 200));

    // Unified X range
    const allPrices = curves.flat().map(p => p.price);
    const minX = Math.min(...allPrices);
    const maxX = Math.max(...allPrices);
    const step = (maxX - minX) / 200;

    // Build unified data points
    const data: Record<string, number>[] = [];
    for (let i = 0; i <= 200; i++) {
      const x = Math.round((minX + step * i) * 100) / 100;
      const point: Record<string, number> = { price: x };
      let total = 0;

      selectedAnalyses.forEach((a, idx) => {
        const curve = curves[idx];
        // Find closest point
        let closest = curve[0];
        let minDist = Math.abs(curve[0].price - x);
        for (const p of curve) {
          const d = Math.abs(p.price - x);
          if (d < minDist) { minDist = d; closest = p; }
        }
        const val = closest.profitAtExpiry;
        point[`s${idx}`] = Math.round(val * 100) / 100;
        total += val;
      });

      point.total = Math.round(total * 100) / 100;
      data.push(point);
    }

    // Metrics
    const totals = data.map(d => d.total);
    const maxGain = Math.max(...totals);
    const maxLoss = Math.min(...totals);
    const breakevens: number[] = [];
    for (let i = 1; i < data.length; i++) {
      const prev = data[i - 1].total;
      const curr = data[i].total;
      if ((prev < 0 && curr >= 0) || (prev >= 0 && curr < 0)) {
        const ratio = Math.abs(prev) / (Math.abs(prev) + Math.abs(curr));
        breakevens.push(Math.round((data[i - 1].price + ratio * (data[i].price - data[i - 1].price)) * 100) / 100);
      }
    }

    return {
      chartData: data,
      consolidatedMetrics: { maxGain, maxLoss, breakevens },
    };
  }, [selectedAnalyses]);

  const isFree = access.planType === 'free';

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="container py-6 space-y-6 relative">
        <div className="flex items-center gap-3">
          <Layers className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-black tracking-tight">Payoff Conjunto</h1>
          <Badge className="bg-primary/10 text-primary border-primary/30 text-[10px] font-bold">PRO</Badge>
        </div>

        {/* PRO gate overlay */}
        {isFree && (
          <div className="absolute inset-0 z-40 bg-background/80 backdrop-blur-sm flex flex-col items-center justify-center gap-4 rounded-lg">
            <Zap className="h-12 w-12 text-yellow-400 fill-yellow-400 animate-pulse" />
            <p className="text-lg font-black text-center">Recurso exclusivo do plano PRO</p>
            <p className="text-sm text-muted-foreground text-center max-w-md">
              Sobreponha múltiplas estratégias num único gráfico e veja o payoff consolidado.
            </p>
            <Button onClick={() => navigate('/settings')} className="bg-yellow-400 hover:bg-yellow-300 text-black font-black">
              <Zap className="h-4 w-4 mr-2 fill-current" /> Assinar PRO
            </Button>
          </div>
        )}

        <div className="grid md:grid-cols-[320px_1fr] gap-6">
          {/* Sidebar — analysis selection */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-bold uppercase tracking-widest">Selecione as Estratégias</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 max-h-[60vh] overflow-y-auto">
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : analyses.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4">Nenhuma análise ativa encontrada.</p>
              ) : (
                analyses.map((a, idx) => (
                  <label
                    key={a.id}
                    className="flex items-center gap-3 p-2.5 rounded-lg border border-border/50 hover:bg-accent/50 cursor-pointer transition-colors"
                  >
                    <Checkbox
                      checked={selected.has(a.id)}
                      onCheckedChange={() => toggle(a.id)}
                    />
                    <div
                      className="w-3 h-3 rounded-full shrink-0"
                      style={{ backgroundColor: COLORS[idx % COLORS.length] }}
                    />
                    <span className="text-sm font-medium truncate">{a.name}</span>
                    <Badge variant="outline" className="ml-auto text-[9px] shrink-0">
                      {a.legs.length} perna{a.legs.length > 1 ? 's' : ''}
                    </Badge>
                  </label>
                ))
              )}
            </CardContent>
          </Card>

          {/* Chart + metrics */}
          <div className="space-y-4">
            {/* Metrics cards */}
            {consolidatedMetrics && (
              <div className="grid grid-cols-3 gap-3">
                <Card className="p-3">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                    <TrendingUp className="h-3.5 w-3.5 text-green-500" /> Lucro Máx Consolidado
                  </div>
                  <p className="text-lg font-black text-green-500">
                    R$ {consolidatedMetrics.maxGain.toFixed(2)}
                  </p>
                </Card>
                <Card className="p-3">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                    <TrendingDown className="h-3.5 w-3.5 text-red-500" /> Risco Máx Consolidado
                  </div>
                  <p className="text-lg font-black text-red-500">
                    R$ {consolidatedMetrics.maxLoss.toFixed(2)}
                  </p>
                </Card>
                <Card className="p-3">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                    <Target className="h-3.5 w-3.5 text-primary" /> Breakeven(s)
                  </div>
                  <p className="text-sm font-bold">
                    {consolidatedMetrics.breakevens.length > 0
                      ? consolidatedMetrics.breakevens.map(b => `R$ ${b.toFixed(2)}`).join(' | ')
                      : '—'}
                  </p>
                </Card>
              </div>
            )}

            {/* Chart */}
            <Card className="p-4">
              {selectedAnalyses.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                  <Layers className="h-10 w-10 mb-3 opacity-40" />
                  <p className="text-sm font-medium">Selecione ao menos uma estratégia para visualizar</p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={420}>
                  <ComposedChart data={chartData} margin={{ top: 10, right: 20, left: 10, bottom: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                    <XAxis
                      dataKey="price"
                      tickFormatter={v => `${Number(v).toFixed(0)}`}
                      tick={{ fontSize: 10 }}
                      label={{ value: 'Preço do Ativo (R$)', position: 'insideBottom', offset: -5, fontSize: 11 }}
                    />
                    <YAxis
                      tickFormatter={v => `${Number(v).toFixed(0)}`}
                      tick={{ fontSize: 10 }}
                      label={{ value: 'Resultado (R$)', angle: -90, position: 'insideLeft', fontSize: 11 }}
                    />
                    <Tooltip
                      formatter={(value: number, name: string) => {
                        if (name === 'total') return [`R$ ${value.toFixed(2)}`, 'Consolidado'];
                        const idx = parseInt(name.replace('s', ''));
                        return [`R$ ${value.toFixed(2)}`, selectedAnalyses[idx]?.name ?? name];
                      }}
                      labelFormatter={v => `Preço: R$ ${Number(v).toFixed(2)}`}
                      contentStyle={{ fontSize: 11 }}
                    />
                    <ReferenceLine y={0} stroke="hsl(var(--muted-foreground))" strokeWidth={1} strokeDasharray="4 4" />
                    {selectedAnalyses.map((a, idx) => (
                      <Line
                        key={a.id}
                        type="monotone"
                        dataKey={`s${idx}`}
                        stroke={COLORS[idx % COLORS.length]}
                        strokeWidth={1.5}
                        dot={false}
                        name={`s${idx}`}
                      />
                    ))}
                    {selectedAnalyses.length > 1 && (
                      <Line
                        type="monotone"
                        dataKey="total"
                        stroke="hsl(var(--foreground))"
                        strokeWidth={3}
                        strokeDasharray="8 4"
                        dot={false}
                        name="total"
                      />
                    )}
                    <Legend
                      formatter={(value: string) => {
                        if (value === 'total') return 'Consolidado';
                        const idx = parseInt(value.replace('s', ''));
                        return selectedAnalyses[idx]?.name ?? value;
                      }}
                      wrapperStyle={{ fontSize: 11 }}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              )}
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
