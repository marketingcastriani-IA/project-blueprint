import { useEffect, useState, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Navigate, useNavigate } from 'react-router-dom';
import Header from '@/components/Header';
import { supabase } from '@/integrations/supabase/client';
import { CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { 
  Loader2, TrendingUp, TrendingDown, Calendar, Edit2, 
  RotateCcw, Trash2, Briefcase, Wallet, Target, CalendarDays, Percent, BarChart3 
} from 'lucide-react';
import { countBusinessDays } from '@/lib/b3-calendar';
import { calculateCDIReturn } from '@/lib/payoff';
import { cn } from '@/lib/utils';
import { ProfessionalHeader, ProfessionalCard } from '@/components/ProfessionalLayout';

interface ClosedAnalysis {
  id: string;
  name: string;
  underlying_asset: string | null;
  created_at: string;
  closed_at: string | null;
  cdi_rate: number | null;
  days_to_expiry: number | null;
}

const getCDIForPeriod = (createdAt: string, closedAt: string | null, cdiRate: number | null, invested: number): number => {
  if (!closedAt || !cdiRate || invested <= 0) return 0;
  const days = countBusinessDays(new Date(createdAt), new Date(closedAt));
  return calculateCDIReturn(invested, cdiRate, days, false);
};

interface LegWithPnL {
  id: string;
  analysis_id: string;
  side: string;
  price: number;
  current_price: number | null;
  quantity: number;
  option_type: string;
}

const MONTHS = [
  { val: 'all', label: 'Todos os Meses' },
  { val: '0', label: 'Janeiro' }, { val: '1', label: 'Fevereiro' }, { val: '2', label: 'Março' },
  { val: '3', label: 'Abril' }, { val: '4', label: 'Maio' }, { val: '5', label: 'Junho' },
  { val: '6', label: 'Julho' }, { val: '7', label: 'Agosto' }, { val: '8', label: 'Setembro' },
  { val: '9', label: 'Outubro' }, { val: '10', label: 'Novembro' }, { val: '11', label: 'Dezembro' }
];

export default function Portfolio() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [analyses, setAnalyses] = useState<ClosedAnalysis[]>([]);
  const [legsMap, setLegsMap] = useState<Record<string, LegWithPnL[]>>({});
  const [loading, setLoading] = useState(true);
  const [reopeningId, setReopeningId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Filtros
  const [filterMonth, setFilterMonth] = useState('all');
  const [filterYear, setFilterYear] = useState('all');

  useEffect(() => {
    if (!user) return;
    const fetchData = async () => {
      setLoading(true);
      try {
        const { data: closedAnalyses, error: aError } = await supabase
          .from('analyses')
          .select('id, name, underlying_asset, created_at, closed_at, cdi_rate, days_to_expiry')
          .eq('user_id', user.id)
          .eq('status', 'closed')
          .order('closed_at', { ascending: false });

        if (aError) throw aError;
        const items = (closedAnalyses as unknown as ClosedAnalysis[]) || [];
        setAnalyses(items);

        if (items.length > 0) {
          const ids = items.map(a => a.id);
          const { data: allLegs, error: lError } = await supabase
            .from('legs')
            .select('id, analysis_id, side, price, current_price, quantity, option_type')
            .in('analysis_id', ids);

          if (lError) throw lError;
          
          const map: Record<string, LegWithPnL[]> = {};
          (allLegs || []).forEach((l: any) => {
            if (!map[l.analysis_id]) map[l.analysis_id] = [];
            map[l.analysis_id].push(l as LegWithPnL);
          });
          setLegsMap(map);
        }
      } catch (err: any) {
        console.error("[Portfolio] Erro ao buscar dados:", err);
        toast.error("Erro ao carregar portfólio");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [user]);

  const years = useMemo(() => {
    const y = new Set<string>();
    analyses.forEach(a => {
      if (a.closed_at) y.add(new Date(a.closed_at).getFullYear().toString());
    });
    return ['all', ...Array.from(y).sort((a, b) => b.localeCompare(a))];
  }, [analyses]);

  const getPnL = (analysisId: string): number => {
    const legs = legsMap[analysisId] || [];
    return legs.reduce((total, leg) => {
      const exitPrice = leg.current_price != null ? leg.current_price : leg.price;
      const mult = leg.side === 'buy' ? 1 : -1;
      return total + mult * (exitPrice - leg.price) * leg.quantity;
    }, 0);
  };

  const getMontageCost = (analysisId: string): number => {
    const legs = legsMap[analysisId] || [];
    return legs.reduce((acc, leg) => {
      const multiplier = leg.side === 'buy' ? -1 : 1;
      return acc + multiplier * leg.price * leg.quantity;
    }, 0);
  };

  const getExitValue = (analysisId: string): number => {
    const legs = legsMap[analysisId] || [];
    return legs.reduce((acc, leg) => {
      const exitPrice = leg.current_price != null ? leg.current_price : leg.price;
      const multiplier = leg.side === 'buy' ? 1 : -1;
      return acc + multiplier * exitPrice * leg.quantity;
    }, 0);
  };

  const filteredAnalyses = useMemo(() => {
    return analyses.filter(a => {
      if (!a.closed_at) return false;
      const date = new Date(a.closed_at);
      const monthMatch = filterMonth === 'all' || date.getMonth().toString() === filterMonth;
      const yearMatch = filterYear === 'all' || date.getFullYear().toString() === filterYear;
      return monthMatch && yearMatch;
    });
  }, [analyses, filterMonth, filterYear]);

  const stats = useMemo(() => {
    const pnls = filteredAnalyses.map(a => getPnL(a.id));
    const montageCosts = filteredAnalyses.map(a => getMontageCost(a.id));
    
    const totalPL = pnls.reduce((s, p) => s + p, 0);
    const totalInvested = montageCosts.reduce((s, c) => s + (c < 0 ? Math.abs(c) : 0), 0);
    
    const wins = pnls.filter(p => p > 0).length;
    const losses = pnls.filter(p => p < 0).length;
    const winRate = pnls.length > 0 ? ((wins / pnls.length) * 100).toFixed(1) : '0';
    
    const totalReturnPct = totalInvested > 0 ? (totalPL / totalInvested) * 100 : 0;
    const avgProfit = pnls.length > 0 ? totalPL / pnls.length : 0;

    // CDI total for all operations
    const totalCDI = filteredAnalyses.reduce((sum, a) => {
      const montage = getMontageCost(a.id);
      const invested = montage < 0 ? Math.abs(montage) : 0;
      return sum + getCDIForPeriod(a.created_at, a.closed_at, a.cdi_rate, invested);
    }, 0);

    return { totalPL, totalInvested, totalReturnPct, wins, losses, winRate, total: filteredAnalyses.length, avgProfit, totalCDI };
  }, [filteredAnalyses, legsMap]);

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
      <main className="container py-8 space-y-8 animate-fade-in">
        <ProfessionalHeader 
          title="Portfólio" 
          subtitle="Acompanhe o desempenho histórico das suas operações encerradas"
        />

        {/* Filtros */}
        <div className="flex flex-wrap items-center gap-3 p-4 rounded-2xl bg-muted/30 border border-border/50">
          <div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-muted-foreground mr-2">
            <CalendarDays className="h-4 w-4 text-primary" /> Filtrar Encerramento:
          </div>
          <Select value={filterMonth} onValueChange={setFilterMonth}>
            <SelectTrigger className="w-[160px] h-10 font-bold">
              <SelectValue placeholder="Mês" />
            </SelectTrigger>
            <SelectContent>
              {MONTHS.map(m => <SelectItem key={m.val} value={m.val}>{m.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterYear} onValueChange={setFilterYear}>
            <SelectTrigger className="w-[120px] h-10 font-bold">
              <SelectValue placeholder="Ano" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os Anos</SelectItem>
              {years.filter(y => y !== 'all').map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}
            </SelectContent>
          </Select>
          {(filterMonth !== 'all' || filterYear !== 'all') && (
            <Button variant="ghost" size="sm" onClick={() => { setFilterMonth('all'); setFilterYear('all'); }} className="text-[10px] font-black uppercase">
              Limpar Filtros
            </Button>
          )}
        </div>

        {/* Stats Grid */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <ProfessionalCard highlight={stats.totalPL >= 0}>
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Resultado Total</span>
                <div className={cn('p-2 rounded-lg', stats.totalPL >= 0 ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive')}>
                  {stats.totalPL >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                </div>
              </div>
              <p className={cn('text-2xl font-black tracking-tighter', stats.totalPL >= 0 ? 'text-success' : 'text-destructive')}>
                R$ {stats.totalPL.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
              <Badge variant="outline" className={cn('mt-2 text-sm font-black px-3 py-1 rounded-full', stats.totalReturnPct >= 0 ? 'border-success/50 text-success bg-success/10' : 'border-destructive/50 text-destructive bg-destructive/10')}>
                {stats.totalReturnPct >= 0 ? '+' : ''}{stats.totalReturnPct.toFixed(2)}% ROI
              </Badge>
            </CardContent>
          </ProfessionalCard>

          <ProfessionalCard>
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Capital Alocado</span>
                <div className="p-2 rounded-lg bg-primary/10 text-primary"><Wallet className="h-4 w-4" /></div>
              </div>
              <p className="text-2xl font-black tracking-tighter text-foreground">
                R$ {stats.totalInvested.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
              <p className="text-[9px] font-bold text-muted-foreground mt-2 uppercase">Total desembolsado</p>
            </CardContent>
          </ProfessionalCard>

          <ProfessionalCard>
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Média por Op.</span>
                <div className={cn('p-2 rounded-lg', stats.avgProfit >= 0 ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive')}>
                  <BarChart3 className="h-4 w-4" />
                </div>
              </div>
              <p className={cn('text-2xl font-black tracking-tighter', stats.avgProfit >= 0 ? 'text-success' : 'text-destructive')}>
                R$ {stats.avgProfit.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
              <p className="text-[9px] font-bold text-muted-foreground mt-2 uppercase">Lucro médio por operação</p>
            </CardContent>
          </ProfessionalCard>

          <ProfessionalCard>
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">vs CDI</span>
                <div className={cn('p-2 rounded-lg', stats.totalPL >= stats.totalCDI ? 'bg-success/10 text-success' : 'bg-warning/10 text-warning')}>
                  <Percent className="h-4 w-4" />
                </div>
              </div>
              <p className={cn('text-2xl font-black tracking-tighter', stats.totalPL >= stats.totalCDI ? 'text-success' : 'text-warning')}>
                {stats.totalCDI > 0 ? `${((stats.totalPL / stats.totalCDI) * 100).toFixed(0)}%` : 'N/A'}
              </p>
              <Badge variant="outline" className={cn('mt-2 text-[10px] font-black', stats.totalPL >= stats.totalCDI ? 'border-success/40 text-success' : 'border-warning/40 text-warning')}>
                CDI: R$ {stats.totalCDI.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </Badge>
            </CardContent>
          </ProfessionalCard>

          <ProfessionalCard>
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Taxa de Acerto</span>
                <div className="p-2 rounded-lg bg-primary/10 text-primary"><Target className="h-4 w-4" /></div>
              </div>
              <Badge className={cn('text-xl font-black px-4 py-2 rounded-full', parseFloat(stats.winRate) >= 50 ? 'bg-success text-success-foreground' : 'bg-destructive text-destructive-foreground')}>
                {stats.winRate}%
              </Badge>
              <div className="flex items-center gap-2 mt-2">
                <span className="text-[9px] font-bold text-success uppercase">{stats.wins}W</span>
                <span className="text-muted-foreground">/</span>
                <span className="text-[9px] font-bold text-destructive uppercase">{stats.losses}L</span>
              </div>
            </CardContent>
          </ProfessionalCard>

          <ProfessionalCard>
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Operações</span>
                <div className="p-2 rounded-lg bg-muted text-muted-foreground"><Briefcase className="h-4 w-4" /></div>
              </div>
              <p className="text-2xl font-black tracking-tighter text-foreground">{stats.total}</p>
              <p className="text-[9px] font-bold text-muted-foreground mt-2 uppercase">Estratégias encerradas</p>
            </CardContent>
          </ProfessionalCard>
        </div>

        {/* Operations List */}
        {loading ? (
          <div className="flex justify-center py-24"><Loader2 className="h-10 w-10 animate-spin text-primary" /></div>
        ) : filteredAnalyses.length === 0 ? (
          <ProfessionalCard className="border-dashed border-2 border-muted-foreground/20">
            <CardContent className="py-24 text-center space-y-6">
              <div className="flex justify-center">
                <div className="h-20 w-20 rounded-full bg-muted/50 flex items-center justify-center">
                  <Briefcase className="h-10 w-10 text-muted-foreground/40" />
                </div>
              </div>
              <div className="space-y-2">
                <p className="text-xl font-black tracking-tight">Nenhuma operação encontrada</p>
                <p className="text-muted-foreground max-w-xs mx-auto">Tente ajustar os filtros de período.</p>
              </div>
              <Button onClick={() => { setFilterMonth('all'); setFilterYear('all'); }} variant="outline">
                Limpar Filtros
              </Button>
            </CardContent>
          </ProfessionalCard>
        ) : (
          <div className="grid gap-3">
            {filteredAnalyses.map(a => {
              const pnl = getPnL(a.id);
              const montage = getMontageCost(a.id);
              const exitValue = getExitValue(a.id);
              const invested = montage < 0 ? Math.abs(montage) : 0;
              const roi = invested > 0 ? (pnl / invested) * 100 : (pnl > 0 ? 100 : 0);
              
              return (
                <ProfessionalCard
                  key={a.id}
                  className="group cursor-pointer"
                  onClick={() => navigate(`/analysis/${a.id}`)}
                >
                  <CardContent className="flex flex-col lg:flex-row lg:items-center justify-between py-5 px-6 gap-6">
                    <div className="flex items-center gap-5 flex-1 min-w-0">
                      <div className={cn(
                        'flex h-12 w-12 items-center justify-center rounded-xl shrink-0 shadow-inner',
                        pnl >= 0 ? 'bg-success/10 text-success border border-success/20' : 'bg-destructive/10 text-destructive border border-destructive/20'
                      )}>
                        {pnl >= 0 ? <TrendingUp className="h-6 w-6" /> : <TrendingDown className="h-6 w-6" />}
                      </div>
                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex items-center gap-3 flex-wrap">
                          <p className="text-lg font-black tracking-tight truncate">{a.name}</p>
                          {a.underlying_asset && (
                            <Badge variant="outline" className="text-[10px] border-primary/30 text-primary font-bold">
                              {a.underlying_asset}
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-4 text-[11px] text-muted-foreground font-medium">
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {new Date(a.created_at).toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' })}
                            {a.closed_at && ` → ${new Date(a.closed_at).toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' })}`}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Metrics Section */}
                    <div className="grid grid-cols-5 gap-4 lg:gap-6 px-4 py-3 lg:py-0 rounded-xl bg-muted/30 lg:bg-transparent border border-border/50 lg:border-none">
                      <div className="text-center lg:text-right">
                        <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground mb-1">Investido</p>
                        <p className={cn("text-sm font-bold font-mono", montage >= 0 ? "text-info" : "text-foreground")}>
                          R$ {Math.abs(montage).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </p>
                      </div>
                      <div className="text-center lg:text-right">
                        <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground mb-1">Saída</p>
                        <p className="text-sm font-bold font-mono text-foreground">
                          R$ {Math.abs(exitValue).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </p>
                      </div>
                      <div className="text-center lg:text-right">
                        <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground mb-1">Resultado</p>
                        <p className={cn('text-sm font-bold font-mono', pnl >= 0 ? 'text-success' : 'text-destructive')}>
                          {pnl >= 0 ? '+' : ''}R$ {pnl.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </p>
                      </div>
                      <div className="text-center lg:text-right">
                        <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground mb-1">ROI</p>
                        <Badge className={cn('font-black text-sm px-3 py-1 rounded-full shadow-lg', pnl >= 0 ? 'bg-success text-success-foreground shadow-success/30' : 'bg-destructive text-destructive-foreground shadow-destructive/30')}>
                          {roi >= 0 ? '+' : ''}{roi.toFixed(2)}%
                        </Badge>
                      </div>
                      <div className="text-center lg:text-right">
                        <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground mb-1">vs CDI</p>
                        {(() => {
                          const cdiReturn = getCDIForPeriod(a.created_at, a.closed_at, a.cdi_rate, invested);
                          const cdiPct = cdiReturn > 0 ? ((pnl / cdiReturn) * 100).toFixed(0) : 'N/A';
                          const beats = typeof cdiPct === 'string' ? false : pnl >= cdiReturn;
                          return (
                            <Badge variant="outline" className={cn('font-black text-[11px] px-2 py-0.5', beats ? 'border-success/50 text-success bg-success/10' : 'border-warning/50 text-warning bg-warning/10')}>
                              {cdiPct === 'N/A' ? 'N/A' : `${cdiPct}% CDI`}
                            </Badge>
                          );
                        })()}
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-9 px-3 hover:bg-primary/10 hover:text-primary transition-all"
                        onClick={(e) => { e.stopPropagation(); navigate(`/analysis/${a.id}`); }}
                      >
                        <Edit2 className="h-4 w-4 mr-2" /> Detalhes
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-9 px-3 text-info hover:bg-info/10 transition-all"
                        disabled={reopeningId === a.id}
                        onClick={(e) => handleReopen(e, a.id)}
                      >
                        {reopeningId === a.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4 mr-2" />}
                        Reabrir
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 text-destructive hover:bg-destructive/10 transition-all"
                        disabled={deletingId === a.id}
                        onClick={(e) => handleDelete(e, a.id)}
                      >
                        {deletingId === a.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                      </Button>
                    </div>
                  </CardContent>
                </ProfessionalCard>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}