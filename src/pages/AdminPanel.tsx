import { useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useAccessControl } from '@/hooks/useAccessControl';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import {
  TrendingUp, Users, CheckCircle2, XCircle, Clock, Shield,
  Loader2, LogOut, Sun, Moon, RefreshCw, Search
} from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';

interface UserRow {
  user_id: string;
  status: string;
  trial_days: number;
  approved_at: string | null;
  expires_at: string | null;
  notes: string | null;
  created_at: string;
  email?: string;
  display_name?: string;
}

export default function AdminPanel() {
  const { user, loading: authLoading, signOut } = useAuth();
  const access = useAccessControl();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();

  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      // Get access records
      const { data: accessData } = await supabase
        .from('user_access')
        .select('*')
        .order('created_at', { ascending: false });

      // Get profiles for display names
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, display_name');

      const profileMap: Record<string, string> = {};
      profiles?.forEach((p: any) => { profileMap[p.user_id] = p.display_name || ''; });

      const rows: UserRow[] = (accessData || []).map((a: any) => ({
        ...a,
        display_name: profileMap[a.user_id] || a.user_id,
        email: profileMap[a.user_id] || '',
      }));

      setUsers(rows);
    } catch (err: any) {
      toast.error('Erro ao carregar usuários');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (access.isAdmin) fetchUsers();
  }, [access.isAdmin]);

  if (authLoading || access.status === 'loading') return null;
  if (!user || !access.isAdmin) return <Navigate to="/admin-login" replace />;

  const approveUser = async (userId: string, trialDays: number) => {
    setActionLoading(userId);
    try {
      const expiresAt = trialDays > 0
        ? new Date(Date.now() + trialDays * 24 * 60 * 60 * 1000).toISOString()
        : null;

      await supabase
        .from('user_access')
        .update({
          status: 'approved',
          trial_days: trialDays,
          approved_at: new Date().toISOString(),
          expires_at: expiresAt,
        } as any)
        .eq('user_id', userId);

      toast.success('Usuário aprovado!');
      fetchUsers();
    } catch (err: any) {
      toast.error('Erro: ' + err.message);
    } finally {
      setActionLoading(null);
    }
  };

  const rejectUser = async (userId: string) => {
    setActionLoading(userId);
    try {
      await supabase
        .from('user_access')
        .update({ status: 'rejected' } as any)
        .eq('user_id', userId);

      toast.success('Usuário rejeitado.');
      fetchUsers();
    } catch (err: any) {
      toast.error('Erro: ' + err.message);
    } finally {
      setActionLoading(null);
    }
  };

  const stats = {
    total: users.length,
    pending: users.filter(u => u.status === 'pending').length,
    approved: users.filter(u => u.status === 'approved').length,
    rejected: users.filter(u => u.status === 'rejected').length,
    expired: users.filter(u => u.status === 'expired').length,
  };

  const filtered = users.filter(u => {
    if (!searchTerm) return true;
    const s = searchTerm.toLowerCase();
    return (u.display_name?.toLowerCase().includes(s)) || u.user_id.includes(s);
  });

  const statusConfig: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
    pending: { label: 'Pendente', color: 'bg-warning/15 text-warning', icon: <Clock className="h-3.5 w-3.5" /> },
    approved: { label: 'Aprovado', color: 'bg-success/15 text-success', icon: <CheckCircle2 className="h-3.5 w-3.5" /> },
    rejected: { label: 'Rejeitado', color: 'bg-destructive/15 text-destructive', icon: <XCircle className="h-3.5 w-3.5" /> },
    expired: { label: 'Expirado', color: 'bg-muted text-muted-foreground', icon: <Clock className="h-3.5 w-3.5" /> },
  };

  return (
    <div className="min-h-screen bg-background pb-16">
      {/* Admin Header */}
      <header className="sticky top-0 z-50 border-b border-border/60 bg-card/80 backdrop-blur-md">
        <div className="container flex h-14 items-center justify-between">
          <div className="flex items-center gap-2 font-bold text-lg">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary shadow-[0_0_16px_-4px_hsl(var(--primary)/0.5)]">
              <TrendingUp className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="hidden sm:inline tracking-tight">OpçõesX</span>
            <Badge className="bg-destructive/80 text-destructive-foreground text-[9px]">ADMIN</Badge>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" onClick={toggleTheme} className="h-9 w-9">
              {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
            <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard')} className="h-9 w-9" title="Ir para o app">
              <TrendingUp className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={signOut} className="h-9 w-9">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="container py-6 space-y-6 animate-fade-in">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Shield className="h-6 w-6 text-primary" />
            Painel Administrativo
          </h1>
          <p className="text-sm text-muted-foreground">Gerencie o acesso dos clientes ao OpçõesX</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Card className="bg-card/50 backdrop-blur-sm">
            <CardContent className="p-4 text-center">
              <Users className="h-5 w-5 mx-auto text-muted-foreground mb-1" />
              <p className="text-2xl font-bold font-mono">{stats.total}</p>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Total</p>
            </CardContent>
          </Card>
          <Card className="bg-card/50 backdrop-blur-sm border-warning/30">
            <CardContent className="p-4 text-center">
              <Clock className="h-5 w-5 mx-auto text-warning mb-1" />
              <p className="text-2xl font-bold font-mono text-warning">{stats.pending}</p>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Pendentes</p>
            </CardContent>
          </Card>
          <Card className="bg-card/50 backdrop-blur-sm border-success/30">
            <CardContent className="p-4 text-center">
              <CheckCircle2 className="h-5 w-5 mx-auto text-success mb-1" />
              <p className="text-2xl font-bold font-mono text-success">{stats.approved}</p>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Aprovados</p>
            </CardContent>
          </Card>
          <Card className="bg-card/50 backdrop-blur-sm">
            <CardContent className="p-4 text-center">
              <XCircle className="h-5 w-5 mx-auto text-destructive mb-1" />
              <p className="text-2xl font-bold font-mono text-destructive">{stats.rejected + stats.expired}</p>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Bloqueados</p>
            </CardContent>
          </Card>
        </div>

        {/* Search + Refresh */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome ou ID..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
          <Button variant="outline" onClick={fetchUsers} disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
        </div>

        {/* Users list */}
        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>
        ) : filtered.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Users className="mx-auto h-10 w-10 text-muted-foreground/50 mb-3" />
              <p className="text-muted-foreground">Nenhum usuário encontrado.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {filtered.map(u => {
              const sc = statusConfig[u.status] || statusConfig.pending;
              const daysRemaining = u.expires_at
                ? Math.max(0, Math.ceil((new Date(u.expires_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
                : null;
              const isExpired = daysRemaining !== null && daysRemaining <= 0 && u.status === 'approved';

              return (
                <UserCard
                  key={u.user_id}
                  user={u}
                  statusConfig={sc}
                  daysRemaining={daysRemaining}
                  isExpired={isExpired}
                  actionLoading={actionLoading === u.user_id}
                  onApprove={approveUser}
                  onReject={rejectUser}
                />
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}

function UserCard({
  user, statusConfig, daysRemaining, isExpired, actionLoading, onApprove, onReject,
}: {
  user: UserRow;
  statusConfig: { label: string; color: string; icon: React.ReactNode };
  daysRemaining: number | null;
  isExpired: boolean;
  actionLoading: boolean;
  onApprove: (userId: string, days: number) => void;
  onReject: (userId: string) => void;
}) {
  const [trialDays, setTrialDays] = useState(user.trial_days || 7);

  return (
    <Card className="bg-card/50 backdrop-blur-sm border-border/40 hover:border-border/60 transition-colors">
      <CardContent className="p-4 sm:p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          {/* User info */}
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-medium truncate">{user.display_name || 'Usuário'}</p>
              <div className={`inline-flex items-center gap-1 text-[10px] font-medium rounded-full px-2 py-0.5 ${statusConfig.color}`}>
                {statusConfig.icon}
                {isExpired ? 'Expirado' : statusConfig.label}
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground font-mono truncate">{user.user_id}</p>
            <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
              <span>Cadastro: {new Date(user.created_at).toLocaleDateString('pt-BR')}</span>
              {user.approved_at && <span>Aprovado: {new Date(user.approved_at).toLocaleDateString('pt-BR')}</span>}
              {daysRemaining !== null && !isExpired && (
                <span className={daysRemaining <= 3 ? 'text-warning font-medium' : ''}>
                  {daysRemaining} dias restantes
                </span>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 flex-wrap shrink-0">
            <div className="flex items-center gap-1.5">
              <label className="text-[11px] text-muted-foreground whitespace-nowrap">Dias:</label>
              <Input
                type="number"
                min={1}
                max={365}
                value={trialDays}
                onChange={e => setTrialDays(parseInt(e.target.value) || 7)}
                className="w-16 h-8 text-sm text-center"
              />
            </div>
            <Button
              size="sm"
              onClick={() => onApprove(user.user_id, trialDays)}
              disabled={actionLoading}
              className="text-xs"
            >
              {actionLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="mr-1 h-3.5 w-3.5" />}
              Aprovar
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={() => onReject(user.user_id)}
              disabled={actionLoading}
              className="text-xs"
            >
              <XCircle className="mr-1 h-3.5 w-3.5" />
              Bloquear
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
