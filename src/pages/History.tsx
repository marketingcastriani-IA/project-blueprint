import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Navigate, useNavigate } from 'react-router-dom';
import Header from '@/components/Header';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Loader2, Clock, PlusCircle, Trash2, Edit2, XCircle, RotateCcw, History as HistoryIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ProfessionalHeader, ProfessionalCard } from '@/components/ProfessionalLayout';

interface AnalysisSummary {
  id: string;
  name: string;
  underlying_asset: string | null;
  status: string;
  created_at: string;
  closed_at: string | null;
  ai_suggestion: string | null;
}

export default function History() {
  const { user, loading: authLoading } = useAuth();
  const [analyses, setAnalyses] = useState<AnalysisSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [closingId, setClosingId] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) return;
    supabase
      .from('analyses')
      .select('id, name, underlying_asset, status, created_at, closed_at, ai_suggestion')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setAnalyses((data as unknown as AnalysisSummary[]) || []);
        setLoading(false);
      });
  }, [user]);

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

  const activeAnalyses = analyses.filter(a => a.status === 'active');
  const closedAnalyses = analyses.filter(a => a.status === 'closed');

  const renderCard = (a: AnalysisSummary) => (
    <ProfessionalCard
      key={a.id}
      className="group cursor-pointer"
      onClick={() => navigate(`/analysis/${a.id}`)}
    >
      <CardContent className="flex items-start justify-between py-5 px-6 gap-4">
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
          </div>
          <div className="flex items-center gap-4 text-[11px] text-muted-foreground font-medium">
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {new Date(a.created_at).toLocaleDateString('pt-BR')}
            </span>
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
      </CardContent>
    </ProfessionalCard>
  );

  return (
    <div className="min-h-screen bg-background pb-16">
      <Header />
      <main className="container py-8 space-y-8 animate-fade-in">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <ProfessionalHeader 
            title="Histórico" 
            subtitle="Gerencie e acompanhe todas as suas análises salvas"
          />
          <Button onClick={() => navigate('/dashboard')} className="h-12 px-6 text-base font-bold shadow-[0_0_30px_-8px_hsl(var(--primary)/0.4)]">
            <PlusCircle className="mr-2 h-5 w-5" /> Nova Análise
          </Button>
        </div>

        {loading ? (
          <div className="flex justify-center py-24"><Loader2 className="h-10 w-10 animate-spin text-primary" /></div>
        ) : analyses.length === 0 ? (
          <ProfessionalCard className="border-dashed border-2 border-muted-foreground/20">
            <CardContent className="py-24 text-center space-y-6">
              <div className="flex justify-center">
                <div className="h-20 w-20 rounded-full bg-muted/50 flex items-center justify-center">
                  <HistoryIcon className="h-10 w-10 text-muted-foreground/40" />
                </div>
              </div>
              <div className="space-y-2">
                <p className="text-xl font-black tracking-tight">Nenhuma análise encontrada</p>
                <p className="text-muted-foreground max-w-xs mx-auto">Comece criando uma nova análise para vê-la listada aqui.</p>
              </div>
              <Button onClick={() => navigate('/dashboard')} size="lg">
                Criar Primeira Análise
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