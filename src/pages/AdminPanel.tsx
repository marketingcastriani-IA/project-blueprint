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
  Loader2, LogOut, Sun, Moon, RefreshCw, Search, Rocket, Lock
} from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';

interface UserRow {
  user_id: string;
  status: string;
  plan_type: string;
  simulations_count: number;
  created_at: string;
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
      const { data: accessData } = await supabase.from('user_access').select('*').order('created_at', { ascending: false });
      const { data: profiles } = await supabase.from('profiles').select('user_id, display_name');
      const profileMap: Record<string, string> = {};
      profiles?.forEach((p: any) => { profileMap[p.user_id] = p.display_name || ''; });

      setUsers((accessData || []).map((a: any) => ({
        ...a,
        display_name: profileMap[a.user_id] || a.user_id,
      })));
    } catch (err: any) { toast.error('Erro ao carregar usuários'); } finally { setLoading(false); }
  };

  useEffect(() => { if (access.isAdmin) fetchUsers(); }, [access.isAdmin]);

  if (authLoading || access.status === 'loading') return null;
  if (!user || !access.isAdmin) return <Navigate to="/admin-login" replace />;

  const togglePlan = async (userId: string, currentPlan: string) => {
    setActionLoading(userId);
    try {
      const newPlan = currentPlan === 'pro' ? 'free' : 'pro';
      await supabase.from('user_access').update({ plan_type: newPlan } as any).eq('user_id', userId);
      toast.success(`Plano alterado para ${newPlan.toUpperCase()}`);
      fetchUsers();
    } catch (err: any) { toast.error('Erro ao alterar plano'); } finally { setActionLoading(null); }
  };

  const filtered = users.filter(u => u.display_name?.toLowerCase().includes(searchTerm.toLowerCase()) || u.user_id.includes(searchTerm));

  return (
    <div className="min-h-screen bg-background pb-16">
      <header className="sticky top-0 z-50 border-b border-border/60 bg-card/80 backdrop-blur-md">
        <div className="container flex h-14 items-center justify-between">
          <div className="flex items-center gap-2 font-bold text-lg">
            <div className="bg-primary p-1.5 rounded-lg"><TrendingUp className="h-4 w-4 text-primary-foreground" /></div>
            <span>OpçõesX Admin</span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={toggleTheme}><Sun className="h-4 w-4" /></Button>
            <Button variant="ghost" size="icon" onClick={signOut}><LogOut className="h-4 w-4" /></Button>
          </div>
        </div>
      </header>

      <main className="container py-6 space-y-6">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar usuário..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-9" />
          </div>
          <Button variant="outline" onClick={fetchUsers} disabled={loading}><RefreshCw className={loading ? 'animate-spin' : ''} /></Button>
        </div>

        <div className="space-y-3">
          {filtered.map(u => (
            <Card key={u.user_id} className="bg-card/50">
              <CardContent className="p-4 flex items-center justify-between">
                <div className="space-y-1">
                  <p className="font-bold">{u.display_name}</p>
                  <div className="flex gap-2">
                    <Badge variant={u.plan_type === 'pro' ? 'default' : 'outline'} className="text-[10px]">
                      {u.plan_type === 'pro' ? <Rocket className="h-2 w-2 mr-1" /> : <Lock className="h-2 w-2 mr-1" />}
                      {u.plan_type.toUpperCase()}
                    </Badge>
                    <Badge variant="secondary" className="text-[10px]">{u.simulations_count} simulações</Badge>
                  </div>
                </div>
                <Button 
                  size="sm" 
                  variant={u.plan_type === 'pro' ? 'outline' : 'default'}
                  onClick={() => togglePlan(u.user_id, u.plan_type)}
                  disabled={actionLoading === u.user_id}
                >
                  {u.plan_type === 'pro' ? 'Rebaixar para Free' : 'Promover para PRO'}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </main>
    </div>
  );
}