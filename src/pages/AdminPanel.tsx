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
  Loader2, LogOut, Sun, Moon, RefreshCw, Search, Crown, Star
} from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';

interface UserRow {
  user_id: string;
  status: string;
  trial_days: number;
  approved_at: string | null;
  expires_at: string | null;
  plan_type: string;
  created_at: string;
  email?: string;
  display_name?: string;
  sim_count?: number;
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
      const { data: accessData } = await supabase
        .from('user_access')
        .select('*')
        .order('created_at', { ascending: false });

      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, display_name, email');

      const { data: analyses } = await supabase
        .from('analyses')
        .select('user_id');

      const profileMap: Record<string, any> = {};
      profiles?.forEach((p: any) => { profileMap[p.user_id] = p; });

      const simMap: Record<string, number> = {};
      analyses?.forEach((a: any) => {
        simMap[a.user_id] = (simMap[a.user_id] || 0) + 1;
      });

      const rows: UserRow[] = (accessData || []).map((a: any) => ({
        ...a,
        display_name: profileMap[a.user_id]?.display_name || a.user_id,
        email: profileMap[a.user_id]?.email || '',
        sim_count: simMap[a.user_id] || 0
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

  const updatePlan = async (userId: string, plan: string) => {
    setActionLoading(userId);
    try {
      await supabase
        .from('user_access')
        .update({ plan_type: plan } as any)
        .eq('user_id', userId);
      toast.success(`Plano atualizado para ${plan.toUpperCase()}`);
      fetchUsers();
    } catch (err: any) {
      toast.error('Erro: ' + err.message);
    } finally {
      setActionLoading(null);
    }
  };

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

  const filtered = users.filter(u => {
    if (!searchTerm) return true;
    const s = searchTerm.toLowerCase();
    return (u.display_name?.toLowerCase().includes(s)) || u.email?.toLowerCase().includes(s) || u.user_id.includes(s);
  });

  return (
    <div className="min-h-screen bg-background pb-16">
      <header className="sticky top-0 z-50 border-b border-border/60 bg-card/80 backdrop-blur-md">
        <div className="container flex h-14 items-center justify-between">
          <div className="flex items-center gap-2 font-bold text-lg">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary shadow-[0_0_16px_-4px_hsl(var(--primary)/0.5)]">
              <TrendingUp className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="hidden sm:inline tracking-tight">OpçõesX Admin</span>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" onClick={toggleTheme}><Sun className="h-4 w-4" /></Button>
            <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard')}><TrendingUp className="h-4 w-4" /></Button>
            <Button variant="ghost" size="icon" onClick={signOut}><LogOut className="h-4 w-4" /></Button>
          </div>
        </div>
      </header>

      <main className="container py-6 space-y-6">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar usuários..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-9" />
          </div>
          <Button variant="outline" onClick={fetchUsers} disabled={loading}><RefreshCw className={cn("mr-2 h-4 w-4", loading && "animate-spin")} /> Atualizar</Button>
        </div>

        <div className="space-y-3">
          {filtered.map(u => (
            <Card key={u.user_id} className="bg-card/50 backdrop-blur-sm border-border/40">
              <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <p className="font-bold">{u.display_name}</p>
                    <Badge variant={u.plan_type === 'pro' ? 'default' : 'outline'} className={cn(u.plan_type === 'pro' && "bg-primary text-primary-foreground")}>
                      {u.plan_type === 'pro' ? <Crown className="h-3 w-3 mr-1" /> : <Star className="h-3 w-3 mr-1" />}
                      {u.plan_type.toUpperCase()}
                    </Badge>
                    <Badge variant="secondary" className="text-[10px]">{u.sim_count}/3 Sims</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">{u.email || u.user_id}</p>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <Button size="sm" variant="outline" onClick={() => updatePlan(u.user_id, u.plan_type === 'pro' ? 'free' : 'pro')} disabled={actionLoading === u.user_id}>
                    Mudar para {u.plan_type === 'pro' ? 'FREE' : 'PRO'}
                  </Button>
                  <Button size="sm" onClick={() => approveUser(u.user_id, 30)} disabled={actionLoading === u.user_id || u.status === 'approved'}>
                    Aprovar 30 dias
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </main>
    </div>
  );
}