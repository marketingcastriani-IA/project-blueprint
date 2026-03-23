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
import { Loader2, Clock, PlusCircle, Trash2, Edit2, XCircle, RotateCcw, History as HistoryIcon, CalendarDays, Download, TrendingUp, TrendingDown, Target, ShieldCheck, AlertTriangle, BarChart3 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ProfessionalHeader, ProfessionalCard } from '@/components/ProfessionalLayout';
import { generateHistoryPdf } from '@/lib/pdf-generator';
import { calculateMetrics, calculateCDIOpportunityCost } from '@/lib/payoff';
import { Leg } from '@/lib/types';
import type { AnalysisMetrics } from '@/lib/types';

interface AnalysisSummary {
  id: string;
  name: string;
  underlying_asset: string | null;
  status: string;
  created_at: string;
  closed_at: string | null;
  ai_suggestion: string | null;
  days_to_expiry: number | null;
  expiry_date: string | null;
  cdi_rate: number | null;
}

const MONTHS = [
  { val: 'all', label: 'Todos os Meses' },
  { val: '0', label: 'Janeiro' }, { val: '1', label: 'Fevereiro' }, { val: '2', label: 'Março' },
  { val: '3', label: 'Abril' }, { val: '4', label: 'Maio' }, { val: '5', label: 'Junho' },
  { val: '6', label: 'Julho' }, { val: '7', label: 'Agosto' }, { val: '8', label: 'Setembro' },
  { val: '9', label: 'Outubro' }, { val: '10', label: 'Novembro' }, { val: '11', label: 'Dezembro' }
];

export default function History() {
  const { user, loading: authLoading } = useAuth();
  const [analyses, setAnalyses] = useState<AnalysisSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [closingId, setClosingId] = useState<string | null>(null);
  const [legsMap, setLegsMap] = useState<Record<string, Leg[]>>({});
  const [metricsMap, setMetricsMap] = useState<Record<string, AnalysisMetrics>>({});
  const navigate = useNavigate();

  const [filterMonth, setFilterMonth] = useState('all');
  const [filterYear, setFilterYear] = useState('all');

  useEffect(() => {
    if (!user) return;
    const fetchData = async () => {
      const { data: analysesData } = await supabase
        .from('analyses')
        .select('id, name, underlying_asset, status, created_at, closed_at, ai_suggestion, days_to_expiry, expiry_date, cdi_rate')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      const list = (analysesData as unknown as AnalysisSummary[]) || [];
      setAnalyses(list);

      if (list.length > 0) {
        const ids = list.map(a => a.id);
        const { data: allLegs } = await supabase
          .from('legs')
          .select('analysis_id, side, option_type, asset, strike, price, quantity, expiry_date')
          .in('analysis_id', ids);

        if (allLegs) {
          const lMap: Record<string, Leg[]> = {};
          const mMap: Record<string, AnalysisMetrics> = {};

          allLegs.forEach((l: any) => {
            if (!lMap[l.analysis_id]) lMap[l.analysis_id] = [];
            lMap[l.analysis_id].push({
              side: l.side,
              option_type: l.option_type,
              asset: l.asset,
              strike: l.strike,
              price: l.price,
              quantity: l.quantity,
              expiry_date: l.expiry_date,
            });
          });

          // Calculate metrics for each analysis
          Object.entries(lMap).forEach(([analysisId, legs]) => {
            mMap[analysisId] = calculateMetrics(legs);
          });

          setLegsMap(lMap);
          setMetricsMap(mMap);
        }
      }

      setLoading(false);
    };
    fetchData();
  }, [user]);

  const years = useMemo(() => {
    const y = new Set<string>();
    analyses.forEach(a => y.add(new Date(a.created_at).getFullYear().toString()));
    return ['all', ...Array.from(y).sort((a, b) => b.localeCompare(a))];
  }, [analyses]);

  const filteredAnalyses = useMemo(() => {
    return analyses.filter(a => {
      const date = new Date(a.created_at);
      const monthMatch = filterMonth === 'all' || date.getMonth().toString() === filterMonth;
      const yearMatch = filterYear === 'all' || date.getFullYear().toString() === filterYear;
      return monthMatch && yearMatch;
    });
  }, [analyses, filterMonth, filterYear]);

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!confirm('Tem certeza que deseja deletar esta análise?')) return;
    setDeleting(id);
    try {
      await supabase.from('legs').delete().eq('analysis_id', id);
      const { error } = await supabase.from('analyses').delete().eq('id', id);
      if (error) throw error;
      setAnalyses(analyses.filter(a => a.id !== id));
      toast.success('Análise deletada com sucesso');
    } catch (err: any) {
      toast.error('Erro ao deletar', { description: err.message });
    } finally {
      setDeleting(null);
    }
  };

  const handleClose = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!confirm('Encerrar esta operação e enviar para o portfólio?')) return;
    setClosingId(id);
    try {
      const { error } = await supabase
        .from('analyses')
        .update({ status: 'closed', closed_at: new Date().toISOString() } as any)
        .eq('id', id);
      if (error) throw error;
      setAnalyses(prev => prev.map(a => a.id === id ? { ...a, status: 'closed', closed_at: new Date().toISOString() } : a));
      toast.success('Operação encerrada e enviada para o portfólio!');
    } catch (err: any) {
      toast.error('Erro ao encerrar: ' + err.message);
    } finally {
      setClosingId(null);
    }
  };

  const handleReopen = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    try {
      const { error } = await supabase
        .from('analyses')
        .update({ status: 'active', closed_at: null } as any)
        .eq('id', id);
      if (error) throw error;
      setAnalyses(prev => prev.map(a => a.id === id ? { ...a, status: 'active', closed_at: null } : a));
      toast.success('Operação reaberta!');
    } catch (err: any) {
      toast.error('Erro ao reabrir: ' + err.message);
    }
  };

  if (authLoading) return null;
  if (!user) return <Navigate to="/auth" replace />;

  const activeAnalyses = filteredAnalyses.filter(a => a.status === 'active');
  const closedAnalyses = filteredAnalyses.filter(a => a.status === 'closed');

  const formatValue = (val: number | string | 'Ilimitado') => {
    if (val === 'Ilimitado') return 'Ilimitado';
    const n = typeof val === 'string' ? parseFloat(val) : val;
    return `R$ ${n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const renderCard = (a: AnalysisSummary) => {
    const m = metricsMap[a.id];
    const legs = legsMap[a.id] || [];
    
    // Calculate CDI comparison
    const cdiRate = a.cdi_rate || 15;
    const daysToExpiry = a.days_to_expiry || 0;
    const investedCapital = m ? Math.max(Math.abs(m.montageTotal || m.netCost || 0), 1) : 0;
    const cdiReturn = investedCapital > 0 && daysToExpiry > 0 
      ? calculateCDIOpportunityCost(investedCapital, cdiRate, daysToExpiry) 
      : 0;
    const cdiEfficiency = cdiReturn > 0 && m && typeof m.maxGain === 'number' 
      ? Math.round((m.maxGain / cdiReturn) * 100) 
      : null;

    return (
      <ProfessionalCard
        key={a.id}
        className="group cursor-pointer"
        onClick={() => navigate(`/analysis/${a.id}`)}
      >
        <CardContent className="py-5 px-6 space-y-3">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1 space-y-2">
              <div className="flex items-center gap-3 flex-wrap">
                <p className="text-lg font-black tracking-tight">{a.name}</p>
                {a.underlying_asset && (
                  <Badge variant="outline" className="text-[10px] border-primary/30 text-primary font-bold">
                    {a.underlying_asset}
                  </Badge>
                )}
                <Badge
                  className={cn(
                    'text-[10px] font-black uppercase tracking-widest',
                    a.status === 'active'
                      ? 'bg-success/20 text-success border-success/30'
                      : 'bg-muted text-muted-foreground'
                  )}
                >
                  {a.status === 'active' ? 'Ativa' : 'Encerrada'}
                </Badge>
                {m?.strategyLabel && (
                  <Badge variant="outline" className="text-[10px] border-accent/30 text-accent-foreground font-bold bg-accent/10">
                    {m.strategyLabel}
                  </Badge>
                )}
                {m?.isRiskFree && (
                  <Badge className="text-[10px] font-black bg-success/20 text-success border-success/40 gap-1">
                    <ShieldCheck className="h-3 w-3" /> Risco Zero
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-4 text-[11px] text-muted-foreground font-medium">
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {new Date(a.created_at).toLocaleDateString('pt-BR')}
                </span>
                {a.expiry_date && (
                  <span className="flex items-center gap-1">
                    <CalendarDays className="h-3 w-3" />
                    Venc: {(() => {
                      const [y, mo, d] = a.expiry_date.split('-').map(Number);
                      return new Date(y, mo - 1, d).toLocaleDateString('pt-BR');
                    })()}
                    {a.days_to_expiry != null && (
                      <span className="text-muted-foreground/60">({a.days_to_expiry}du)</span>
                    )}
                  </span>
                )}
                {a.closed_at && (
                  <span className="flex items-center gap-1">
                    <XCircle className="h-3 w-3" />
                    Encerrada: {new Date(a.closed_at).toLocaleDateString('pt-BR')}
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <Button
                variant="ghost"
                size="sm"
                className="h-9 px-3 hover:bg-primary/10 hover:text-primary transition-all"
                onClick={(e) => { e.stopPropagation(); navigate(`/analysis/${a.id}`); }}
              >
                <Edit2 className="h-4 w-4 mr-2" /> Editar
              </Button>
              {a.status === 'active' ? (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-9 px-3 text-warning hover:bg-warning/10 transition-all"
                  disabled={closingId === a.id}
                  onClick={(e) => handleClose(e, a.id)}
                >
                  {closingId === a.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4 mr-2" />}
                  Encerrar
                </Button>
              ) : (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-9 px-3 text-info hover:bg-info/10 transition-all"
                  onClick={(e) => handleReopen(e, a.id)}
                >
                  <RotateCcw className="h-4 w-4 mr-2" /> Reabrir
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 text-destructive hover:bg-destructive/10 transition-all"
                disabled={deleting === a.id}
                onClick={(e) => handleDelete(e, a.id)}
              >
                {deleting === a.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          {/* Metrics row */}
          {m && legs.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 pt-2 border-t border-border/30">
              <div className="space-y-0.5">
                <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Custo / PM</p>
                <p className="text-sm font-bold text-foreground">
                  {formatValue(Math.abs(m.montageTotal || m.netCost))}
                </p>
              </div>
              <div className="space-y-0.5">
                <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-1">
                  <TrendingUp className="h-3 w-3 text-success" /> Lucro Máx
                </p>
                <p className={cn("text-sm font-bold", m.maxGain === 'Ilimitado' || (typeof m.maxGain === 'number' && m.maxGain > 0) ? "text-success" : "text-foreground")}>
                  {formatValue(m.maxGain)}
                </p>
              </div>
              <div className="space-y-0.5">
                <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3 text-destructive" /> Risco Máx
                </p>
                <p className={cn("text-sm font-bold", m.isRiskFree ? "text-success" : "text-destructive")}>
                  {m.isRiskFree ? 'R$ 0,00' : formatValue(m.maxLoss)}
                </p>
              </div>
              <div className="space-y-0.5">
                <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-1">
                  <Target className="h-3 w-3 text-primary" /> Breakeven
                </p>
                <p className="text-sm font-bold text-foreground">
                  {m.breakevens.length > 0 ? m.breakevens.map(b => `R$ ${b.toFixed(2)}`).join(' / ') : '—'}
                </p>
              </div>
              <div className="space-y-0.5">
                <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-1">
                  <BarChart3 className="h-3 w-3 text-primary" /> CDI ({daysToExpiry}du)
                </p>
                <p className="text-sm font-bold text-foreground">
                  {cdiReturn > 0 ? `R$ ${cdiReturn.toFixed(2)}` : '—'}
                </p>
              </div>
              <div className="space-y-0.5">
                <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Eficiência CDI</p>
                <p className={cn("text-sm font-bold", cdiEfficiency && cdiEfficiency > 100 ? "text-success" : "text-foreground")}>
                  {cdiEfficiency != null ? `${cdiEfficiency}%` : '—'}
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </ProfessionalCard>
    );
  };

  return (
    <div className="min-h-screen bg-background pb-16">
      <Header />
      <main className="container py-8 space-y-8 animate-fade-in">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <ProfessionalHeader 
            title="Operações em Aberto" 
            subtitle="Gerencie e acompanhe todas as suas operações ativas e salvas"
          />
          <div className="flex items-center gap-3">
            <Button 
              variant="outline" 
              onClick={async () => {
                const fetchLegs = async (analysisId: string) => {
                  const { data } = await supabase
                    .from('legs')
                    .select('asset, option_type, side, strike, price, quantity, expiry_date')
                    .eq('analysis_id', analysisId);
                  return (data || []) as any[];
                };
                await generateHistoryPdf(filteredAnalyses, fetchLegs);
                toast.success('PDF gerado com sucesso!');
              }} 
              className="h-12 px-5 font-bold border-primary/30 text-primary hover:bg-primary/10"
            >
              <Download className="mr-2 h-5 w-5" /> Baixar PDF
            </Button>
            <Button onClick={() => navigate('/dashboard')} className="h-12 px-6 text-base font-bold shadow-[0_0_30px_-8px_hsl(var(--primary)/0.4)]">
              <PlusCircle className="mr-2 h-5 w-5" /> Nova Análise
            </Button>
          </div>
        </div>

        {/* Filtros */}
        <div className="flex flex-wrap items-center gap-3 p-4 rounded-2xl bg-muted/30 border border-border/50">
          <div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-muted-foreground mr-2">
            <CalendarDays className="h-4 w-4 text-primary" /> Filtrar Período:
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

        {loading ? (
          <div className="flex justify-center py-24"><Loader2 className="h-10 w-10 animate-spin text-primary" /></div>
        ) : filteredAnalyses.length === 0 ? (
          <ProfessionalCard className="border-dashed border-2 border-muted-foreground/20">
            <CardContent className="py-24 text-center space-y-6">
              <div className="flex justify-center">
                <div className="h-20 w-20 rounded-full bg-muted/50 flex items-center justify-center">
                  <HistoryIcon className="h-10 w-10 text-muted-foreground/40" />
                </div>
              </div>
              <div className="space-y-2">
                <p className="text-xl font-black tracking-tight">Nenhuma análise encontrada</p>
                <p className="text-muted-foreground max-w-xs mx-auto">Tente ajustar os filtros ou comece criando uma nova análise.</p>
              </div>
              <Button onClick={() => navigate('/dashboard')} size="lg">
                Criar Nova Análise
              </Button>
            </CardContent>
          </ProfessionalCard>
        ) : (
          <div className="space-y-10">
            {activeAnalyses.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="h-2 w-2 rounded-full bg-success animate-pulse" />
                  <h2 className="text-xs font-black uppercase tracking-widest text-muted-foreground">Operações Ativas ({activeAnalyses.length})</h2>
                </div>
                <div className="grid gap-3">{activeAnalyses.map(renderCard)}</div>
              </div>
            )}
            {closedAnalyses.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="h-2 w-2 rounded-full bg-muted-foreground" />
                  <h2 className="text-xs font-black uppercase tracking-widest text-muted-foreground">Operações Encerradas ({closedAnalyses.length})</h2>
                </div>
                <div className="grid gap-3">{closedAnalyses.map(renderCard)}</div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
