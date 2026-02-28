import { useEffect, useState, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Navigate, useNavigate } from 'react-router-dom';
import Header from '@/components/Header';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Loader2, TrendingUp, TrendingDown, Calendar, Edit2, RotateCcw, Trash2, Briefcase } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ClosedAnalysis {
  id: string;
  name: string;
  underlying_asset: string | null;
  created_at: string;
  closed_at: string | null;
  cdi_rate: number | null;
  days_to_expiry: number | null;
}

interface LegWithPnL {
  id: string;
  side: string;
  price: number;
  current_price: number | null;
  quantity: number;
  option_type: string;
}

export default function Portfolio() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [analyses, setAnalyses] = useState<ClosedAnalysis[]>([]);
  const [legsMap, setLegsMap] = useState<Record<string, LegWithPnL[]>>({});
  const [loading, setLoading] = useState(true);
  const [reopeningId, setReopeningId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    const fetchData = async () => {
      const { data: closedAnalyses } = await supabase
        .from('analyses')
        .select('id, name, underlying_asset, created_at, closed_at, cdi_rate, days_to_expiry')
        .eq('user_id', user.id)
        .eq('status', 'closed')
        .order('closed_at', { ascending: false });

      const items = (closedAnalyses as unknown as ClosedAnalysis[]) || [];
      setAnalyses(items);

      if (items.length > 0) {
        const ids = items.map(a => a.id);
        const { data: allLegs } = await supabase
          .from('legs')
          .select('id, analysis_id, side, price, current_price, quantity, option_type')
          .in('analysis_id', ids);

        const map: Record<string, LegWithPnL[]> = {};
        (allLegs || []).forEach((l: any) => {
          if (!map[l.analysis_id]) map[l.analysis_id] = [];
          map[l.analysis_id].push(l);
        });
        setLegsMap(map);
      }
      setLoading(false);
    };
    fetchData();
  }, [user]);

  const getPnL = (analysisId: string): number => {
    const legs = legsMap[analysisId] || [];
    return legs.reduce((total, leg) => {
      if (leg.current_price == null) return total;
      const mult = leg.side === 'buy' ? 1 : -1;
      return total + mult * (leg.current_price - leg.price) * leg.quantity;
    }, 0);
  };

  const hasPnLData = (analysisId: string): boolean => {
    return (legsMap[analysisId] || []).some(l => l.current_price != null);
  };

  const stats = useMemo(() => {
    const withPnL = analyses.filter(a => hasPnLData(a.id));
    const pnls = withPnL.map(a => getPnL(a.id));
    const totalPL = pnls.reduce((s, p) => s + p, 0);
    const wins = pnls.filter(p => p > 0).length;
    const losses = pnls.filter(p => p < 0).length;
    const winRate = pnls.length > 0 ? ((wins / pnls.length) * 100).toFixed(1) : '0';
    return { totalPL, wins, losses, winRate, total: analyses.length };
  }, [analyses, legsMap]);

  const handleReopen = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setReopeningId(id);
    try {
      await supabase.from('analyses').update({ status: 'active', closed_at: null } as any).eq('id', id);
      setAnalyses(prev => prev.filter(a => a.id !== id));
      toast.success('Operação reaberta! Acesse no Histórico.');
    } catch (err: any) {
      toast.error('Erro: ' + err.message);
    } finally {
      setReopeningId(null);
    }
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!confirm('Deletar permanentemente esta operação?')) return;
    setDeletingId(id);
    try {
      await supabase.from('legs').delete().eq('analysis_id', id);
      await supabase.from('analyses').delete().eq('id', id);
      setAnalyses(prev => prev.filter(a => a.id !== id));
      toast.success('Operação deletada');
    } catch (err: any) {
      toast.error('Erro: ' + err.message);
    } finally {
      setDeletingId(null);
    }
  };

  if (authLoading) return null;
  if (!user) return <Navigate to="/auth" replace />;

  return (
    <div className="min-h-screen bg-background pb-16">
      <Header />
      <main className="container py-6 space-y-6 animate-fade-in">
        <div>
          <h1 className="text-4xl sm:text-5xl font-black tracking-tight">Portfólio</h1>
          <p className="text-lg text-muted-foreground">Operações encerradas e resultados</p>
        </div>

        {/* Stats */}
        <div className="grid gap-4 sm:grid-cols-4">
          <Card className="border shadow-sm">
            <CardContent className="p-5">
              <p className="text-xs font-medium text-muted-foreground">Total P&L</p>
              <p className={cn('text-2xl font-bold mt-1', stats.totalPL >= 0 ? 'text-success' : 'text-destructive')}>
                R$ {stats.totalPL >= 0 ? '+' : ''}{stats.totalPL.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
              <p className="text-xs text-muted-foreground mt-1">{stats.total} operações</p>
            </CardContent>
          </Card>
          <Card className="border shadow-sm">
            <CardContent className="p-5">
              <p className="text-xs font-medium text-muted-foreground">Ganhos</p>
              <p className="text-2xl font-bold text-success mt-1">{stats.wins}</p>
              <p className="text-xs text-muted-foreground mt-1">operações lucrativas</p>
            </CardContent>
          </Card>
          <Card className="border shadow-sm">
            <CardContent className="p-5">
              <p className="text-xs font-medium text-muted-foreground">Perdas</p>
              <p className="text-2xl font-bold text-destructive mt-1">{stats.losses}</p>
              <p className="text-xs text-muted-foreground mt-1">operações com prejuízo</p>
            </CardContent>
          </Card>
          <Card className="border shadow-sm">
            <CardContent className="p-5">
              <p className="text-xs font-medium text-muted-foreground">Taxa de Acerto</p>
              <p className="text-2xl font-bold text-foreground mt-1">{stats.winRate}%</p>
              <p className="text-xs text-muted-foreground mt-1">taxa de sucesso</p>
            </CardContent>
          </Card>
        </div>

        {/* Operations */}
        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
        ) : analyses.length === 0 ? (
          <Card className="border-dashed border-2 border-muted-foreground/30">
            <CardContent className="p-12 text-center space-y-3">
              <Briefcase className="mx-auto h-12 w-12 text-muted-foreground/50" />
              <p className="text-muted-foreground font-medium">Nenhuma operação encerrada</p>
              <p className="text-sm text-muted-foreground">
                Encerre operações no <button className="text-primary underline" onClick={() => navigate('/history')}>Histórico</button> para vê-las aqui
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3">
            {analyses.map(a => {
              const pnl = getPnL(a.id);
              const hasPnl = hasPnLData(a.id);
              return (
                <Card
                  key={a.id}
                  className="group relative overflow-hidden border transition-all hover:shadow-md cursor-pointer"
                  onClick={() => navigate(`/analysis/${a.id}`)}
                >
                  <CardContent className="flex items-center justify-between py-4 px-5 gap-4">
                    <div className="flex items-center gap-4 flex-1">
                      <div className={cn(
                        'flex h-10 w-10 items-center justify-center rounded-lg shrink-0',
                        hasPnl
                          ? (pnl >= 0 ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive')
                          : 'bg-muted text-muted-foreground'
                      )}>
                        {hasPnl ? (pnl >= 0 ? <TrendingUp className="h-5 w-5" /> : <TrendingDown className="h-5 w-5" />) : <Briefcase className="h-5 w-5" />}
                      </div>
                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-bold">{a.name}</p>
                          {a.underlying_asset && <Badge variant="outline" className="text-xs">{a.underlying_asset}</Badge>}
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {new Date(a.created_at).toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' })}
                            {a.closed_at && ` → ${new Date(a.closed_at).toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' })}`}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      {hasPnl && (
                        <div className="text-right">
                          <p className={cn('text-lg font-bold', pnl >= 0 ? 'text-success' : 'text-destructive')}>
                            {pnl >= 0 ? '+' : ''}R$ {pnl.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </p>
                        </div>
                      )}
                      <div className="flex gap-1">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={(e) => { e.stopPropagation(); navigate(`/analysis/${a.id}`); }}
                        >
                          <Edit2 className="h-3.5 w-3.5 mr-1" /> Editar
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 opacity-0 group-hover:opacity-100 transition-opacity text-info border-info/30 hover:bg-info/10"
                          disabled={reopeningId === a.id}
                          onClick={(e) => handleReopen(e, a.id)}
                        >
                          {reopeningId === a.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5 mr-1" />}
                          Reabrir
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 opacity-0 group-hover:opacity-100 transition-opacity"
                          disabled={deletingId === a.id}
                          onClick={(e) => handleDelete(e, a.id)}
                        >
                          {deletingId === a.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5 text-destructive" />}
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
