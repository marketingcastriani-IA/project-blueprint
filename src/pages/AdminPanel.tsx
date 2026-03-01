import { useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useAccessControl } from '@/hooks/useAccessControl';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import {
  TrendingUp, Users, CheckCircle2, XCircle, Clock, Shield,
  Loader2, LogOut, Sun, Moon, RefreshCw, Search, Crown, Wallet,
  ArrowLeft, LayoutDashboard
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
  plan_type: string;
  simulations_count: number;
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

      const profileMap: Record<string, any> = {};
      profiles?.forEach((p: any) => { profileMap[p.user_id] = p; });

      const rows: UserRow[] = (accessData || []).map((a: any) => ({
        ...a,
        display_name: profileMap[a.user_id]?.display_name || a.user_id,
        email: profileMap[a.user_id]?.email || '',
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

  const updatePlan = async (userId: string, planType: string) => {
    setActionLoading(userId);
    try {
      await supabase
        .from('user_access')
        .update({ plan_type: planType } as any)
        .eq('user_id', userId);
      toast.success(`Plano atualizado para ${planType.toUpperCase()}`);
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

  const stats = {
    total: users.length,
    pro: users.filter(u => u.plan_type === 'pro').length,
    pending: users.filter(u => u.status === 'pending').length,
    totalSims: users.reduce((acc, u) => acc + (u.simulations_count || 0), 0),
  };

  const filtered = users.filter(u => {
    if (!searchTerm) return true;
    const s = searchTerm.toLowerCase();
    return (u.display_name?.toLowerCase().includes(s)) || u.user_id.includes(s) || u.email?.toLowerCase().includes(s);
  });

  return (
    <div className="min-h-screen bg-background pb-16">
      <header className="sticky top-0 z-50 border-b border-border/60 bg-card/80 backdrop-blur-md">
        <div className="container flex h-14 items-center justify-between">
          <div className="flex items-center gap-2 font-bold text-lg">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
              <TrendingUp className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="hidden sm:inline">OpçõesX Admin</span>
          </div>
          <div className="flex items-center gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => navigate('/dashboard')} 
              className="h-9 font-bold border-primary/30 text-primary hover:bg-primary/10"
            >
              <LayoutDashboard className="mr-2 h-4 w-4" /> Voltar para o App
            </Button>
            <Button variant="ghost" size="icon" onClick={toggleTheme} className="h-9 w-9"><Sun className="h-4 w-4" /></Button>
            <Button variant="ghost" size="icon" onClick={signOut} className="h-9 w-9"><LogOut className="h-4 w-4" /></Button>
          </div>
        </div>
      </header>

      <main className="container py-6 space-y-6 animate-fade-in">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Card className="p-4 text-center space-y-1">
            <Users className="h-5 w-5 mx-auto text-muted-foreground" />
            <p className="text-2xl font-black">{stats.total}</p>
            <p className="text-[10px] font-bold uppercase text-muted-foreground">Usuários</p>
          </Card>
          <Card className="p-4 text-center space-y-1 border-primary/30">
            <Crown className="h-5 w-5 mx-auto text-primary" />
            <p className="text-2xl font-black text-primary">{stats.pro}</p>
            <p className="text-[10px] font-bold uppercase text-muted-foreground">Planos PRO</p>
          </Card>
          <Card className="p-4 text-center space-y-1 border-warning/30">
            <Clock className="h-5 w-5 mx-auto text-warning" />
            <p className="text-2xl font-black text-warning">{stats.pending}</p>
            <p className="text-[10px] font-bold uppercase text-muted-foreground">Pendentes</p>
          </Card>
          <Card className="p-4 text-center space-y-1">
            <TrendingUp className="h-5 w-5 mx-auto text-success" />
            <p className="text-2xl font-black">{stats.totalSims}</p>
            <p className="text-[10px] font-bold uppercase text-muted-foreground">Simulações</p>
          </Card>
        </div>

        <div className="flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar usuário..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-9" />
          </div>
          <Button variant="outline" onClick={fetchUsers}><RefreshCw className="h-4 w-4" /></Button>
        </div>

        <div className="space-y-3">
          {filtered.map(u => (
            <Card key={u.user_id} className="p-5">
              <div className="flex flex-col sm:flex-row justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <p className="font-black">{u.display_name}</p>
                    <Badge variant={u.plan_type === 'pro' ? 'default' : 'outline'} className={u.plan_type === 'pro' ? 'bg-primary' : ''}>
                      {u.plan_type.toUpperCase()}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">{u.email}</p>
                  <p className="text-[10px] font-mono text-muted-foreground">{u.user_id}</p>
                  <div className="flex gap-3 pt-2">
                    <Badge variant="secondary" className="text-[10px]">{u.simulations_count} Simulações</Badge>
                    <Badge variant="secondary" className="text-[10px]">{u.status.toUpperCase()}</Badge>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <Select value={u.plan_type} onValueChange={(v) => updatePlan(u.user_id, v)}>
                    <SelectTrigger className="w-28 h-9 text-xs font-bold">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="free">FREE</SelectItem>
                      <SelectItem value="pro">PRO</SelectItem>
                    </SelectContent>
                  </Select>
                  
                  {u.status === 'pending' && (
                    <Button size="sm" onClick={() => approveUser(u.user_id, 7)} className="h-9 text-xs font-bold">
                      APROVAR
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      </main>
    </div>
  );
}