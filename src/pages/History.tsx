import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Navigate, useNavigate } from 'react-router-dom';
import Header from '@/components/Header';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Loader2, Clock, PlusCircle, Trash2, Eye, Edit2, XCircle, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';

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
    <Card
      key={a.id}
      className="group relative overflow-hidden border transition-all hover:shadow-md cursor-pointer"
      onClick={() => navigate(`/analysis/${a.id}`)}
    >
      <CardContent className="flex items-start justify-between py-4 px-5 gap-4">
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-base font-bold">{a.name}</p>
            {a.underlying_asset && (
              <Badge variant="outline" className="text-xs">{a.underlying_asset}</Badge>
            )}
            <Badge
              className={cn(
                'text-[10px] font-semibold',
                a.status === 'active'
                  ? 'bg-success/15 text-success border-success/30'
                  : 'bg-muted text-muted-foreground'
              )}
            >
              {a.status === 'active' ? '🟢 Ativa' : '⏹️ Encerrada'}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            Criada: {new Date(a.created_at).toLocaleDateString('pt-BR', { day: 'numeric', month: 'short', year: 'numeric' })}
            {a.closed_at && ` · Encerrada: ${new Date(a.closed_at).toLocaleDateString('pt-BR', { day: 'numeric', month: 'short', year: 'numeric' })}`}
          </p>
          {a.ai_suggestion && (
            <p className="text-xs text-muted-foreground line-clamp-1 pt-1">
              <span className="font-semibold">IA:</span> {a.ai_suggestion}
            </p>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <Button
            variant="outline"
            size="sm"
            className="h-8 opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={(e) => { e.stopPropagation(); navigate(`/analysis/${a.id}`); }}
          >
            <Edit2 className="h-3.5 w-3.5 mr-1" /> Editar
          </Button>
          {a.status === 'active' ? (
            <Button
              variant="outline"
              size="sm"
              className="h-8 opacity-0 group-hover:opacity-100 transition-opacity text-warning border-warning/30 hover:bg-warning/10"
              disabled={closingId === a.id}
              onClick={(e) => handleClose(e, a.id)}
            >
              {closingId === a.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <XCircle className="h-3.5 w-3.5 mr-1" />}
              Encerrar
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              className="h-8 opacity-0 group-hover:opacity-100 transition-opacity text-info border-info/30 hover:bg-info/10"
              onClick={(e) => handleReopen(e, a.id)}
            >
              <RotateCcw className="h-3.5 w-3.5 mr-1" /> Reabrir
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="h-8 opacity-0 group-hover:opacity-100 transition-opacity"
            disabled={deleting === a.id}
            onClick={(e) => handleDelete(e, a.id)}
          >
            {deleting === a.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5 text-destructive" />}
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="min-h-screen bg-background pb-16">
      <Header />
      <main className="container py-6 space-y-6 animate-fade-in">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-4xl sm:text-5xl font-black tracking-tight">Histórico</h1>
            <p className="text-lg text-muted-foreground">Gerencie, edite e encerre suas operações</p>
          </div>
          <Button onClick={() => navigate('/dashboard')} className="text-base h-11 px-6">
            <PlusCircle className="mr-2 h-5 w-5" /> Nova Análise
          </Button>
        </div>

        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
        ) : analyses.length === 0 ? (
          <Card className="border-dashed border-2 border-muted-foreground/30">
            <CardContent className="py-16 text-center space-y-4">
              <Clock className="mx-auto h-12 w-12 text-muted-foreground/50" />
              <div>
                <p className="text-lg font-bold">Nenhuma análise salva</p>
                <p className="text-sm text-muted-foreground">Crie sua primeira análise para começar</p>
              </div>
              <Button onClick={() => navigate('/dashboard')}>
                <PlusCircle className="mr-2 h-4 w-4" /> Criar Análise
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {activeAnalyses.length > 0 && (
              <div className="space-y-3">
                <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-success" /> Ativas ({activeAnalyses.length})
                </h2>
                <div className="grid gap-2">{activeAnalyses.map(renderCard)}</div>
              </div>
            )}
            {closedAnalyses.length > 0 && (
              <div className="space-y-3">
                <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-muted-foreground" /> Encerradas ({closedAnalyses.length})
                </h2>
                <div className="grid gap-2">{closedAnalyses.map(renderCard)}</div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
