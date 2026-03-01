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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import {
  TrendingUp, Users, CheckCircle2, XCircle, Clock, Shield,
  Loader2, LogOut, Sun, Moon, RefreshCw, Search, Crown, Wallet,
  ArrowLeft, LayoutDashboard, Ban, RotateCcw, Calendar, Settings, Key, Save, User, Mail, DollarSign
} from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';
import { cn } from '@/lib/utils';

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
  
  // Mercado Pago Config
  const [mpPublicKey, setMpPublicKey] = useState('TEST-223bd091-629e-4853-a6df-c50a120fb48b');
  const [mpAccessToken, setMpAccessToken] = useState('TEST-8723062167465367-030112-b03bf6309f490dcda5d967d47b41851c-467698330');
  const [proPrice, setProPrice] = useState('19.90');

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

      const rows: UserRow[] = (accessData || []).map((a: any) => {
        const profile = profileMap[a.user_id];
        return {
          ...a,
          display_name: profile?.display_name || profile?.email || 'Usuário sem nome',
          email: profile?.email || 'E-mail não disponível',
        };
      });

      setUsers(rows);

      // Fetch current price from settings
      const { data: settings } = await supabase
        .from('site_settings')
        .select('*')
        .eq('id', 'pro_plan')
        .single();
      
      if (settings) {
        setProPrice(String((settings.value as any).price));
      }
    } catch (err: any) {
      toast.error('Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (access.isAdmin) fetchUsers();
  }, [access.isAdmin]);

  if (authLoading || access.status === 'loading') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

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

  const updateStatus = async (userId: string, status: string) => {
    setActionLoading(userId);
    try {
      await supabase
        .from('user_access')
        .update({ status } as any)
        .eq('user_id', userId);
      toast.success(`Status atualizado para ${status.toUpperCase()}`);
      fetchUsers();
    } catch (err: any) {
      toast.error('Erro: ' + err.message);
    } finally {
      setActionLoading(null);
    }
  };

  const resetSimulations = async (userId: string) => {
    setActionLoading(userId);
    try {
      await supabase
        .from('user_access')
        .update({ simulations_count: 0 } as any)
        .eq('user_id', userId);
      toast.success('Simulações resetadas!');
      fetchUsers();
    } catch (err: any) {
      toast.error('Erro: ' + err.message);
    } finally {
      setActionLoading(null);
    }
  };

  const saveSettings = async () => {
    try {
      const { error } = await supabase
        .from('site_settings')
        .upsert({ 
          id: 'pro_plan', 
          value: { price: parseFloat(proPrice) } 
        } as any);
      
      if (error) throw error;
      toast.success('Configurações salvas com sucesso!');
    } catch (err: any) {
      toast.error('Erro ao salvar: ' + err.message);
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
    return (
      (u.display_name?.toLowerCase().includes(s)) || 
      (u.email?.toLowerCase().includes(s)) || 
      u.user_id.includes(s)
    );
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
            <Button variant="ghost" size="icon" onClick={toggleTheme} className="h-9 w-9">
              {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
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

        <Tabs defaultValue="users" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2 max-w-md">
            <TabsTrigger value="users" className="font-bold">Usuários</TabsTrigger>
            <TabsTrigger value="api" className="font-bold">Configurações API</TabsTrigger>
          </TabsList>

          <TabsContent value="users" className="space-y-6">
            <div className="flex gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Buscar por nome, email ou ID..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-9" />
              </div>
              <Button variant="outline" onClick={fetchUsers}><RefreshCw className="h-4 w-4" /></Button>
            </div>

            <div className="space-y-3">
              {filtered.map(u => (
                <Card key={u.user_id} className={cn("p-5 transition-all border-2", u.status === 'rejected' ? "opacity-60 bg-muted/20 border-destructive/20" : "border-border/40 hover:border-primary/20")}>
                  <div className="flex flex-col lg:flex-row justify-between gap-6">
                    <div className="flex items-start gap-4 flex-1">
                      <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0 border border-primary/20">
                        <User className="h-6 w-6 text-primary" />
                      </div>
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-black text-lg tracking-tight">{u.display_name}</p>
                          <Badge variant={u.plan_type === 'pro' ? 'default' : 'outline'} className={u.plan_type === 'pro' ? 'bg-primary' : ''}>
                            {u.plan_type.toUpperCase()}
                          </Badge>
                          <Badge variant="secondary" className={cn(
                            "text-[10px] font-black",
                            u.status === 'approved' ? "text-success bg-success/10" : u.status === 'rejected' ? "text-destructive bg-destructive/10" : "text-warning bg-warning/10"
                          )}>
                            {u.status.toUpperCase()}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground font-medium">
                          <Mail className="h-3 w-3" />
                          {u.email}
                        </div>
                        <p className="text-[10px] font-mono text-muted-foreground/60 truncate max-w-[200px]">ID: {u.user_id}</p>
                        <div className="flex gap-3 pt-2">
                          <Badge variant="secondary" className="text-[10px] font-bold">
                            {u.simulations_count} Simulações Realizadas
                          </Badge>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-4 lg:border-l lg:pl-6 border-border/40">
                      <div className="flex flex-col gap-1.5">
                        <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Alterar Plano</span>
                        <Select value={u.plan_type} onValueChange={(v) => updatePlan(u.user_id, v)}>
                          <SelectTrigger className="w-32 h-10 text-xs font-bold">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="free">PLANO FREE</SelectItem>
                            <SelectItem value="pro">PLANO PRO</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      
                      <div className="flex flex-col gap-1.5">
                        <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Ações de Acesso</span>
                        <div className="flex gap-2">
                          {u.status === 'pending' || u.status === 'rejected' ? (
                            <Button size="sm" variant="outline" onClick={() => updateStatus(u.user_id, 'approved')} className="h-10 px-4 text-xs font-bold text-success border-success/30 hover:bg-success/10">
                              <CheckCircle2 className="h-4 w-4 mr-2" /> APROVAR
                            </Button>
                          ) : (
                            <Button size="sm" variant="outline" onClick={() => updateStatus(u.user_id, 'rejected')} className="h-10 px-4 text-xs font-bold text-destructive border-destructive/30 hover:bg-destructive/10">
                              <Ban className="h-4 w-4 mr-2" /> BLOQUEAR
                            </Button>
                          )}
                          <Button size="sm" variant="outline" onClick={() => resetSimulations(u.user_id)} className="h-10 px-4 text-xs font-bold hover:bg-primary/10">
                            <RotateCcw className="h-4 w-4 mr-2" /> RESET SIMS
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="api" className="space-y-6">
            <div className="grid gap-6 md:grid-cols-2">
              <Card className="border-primary/20 bg-gradient-to-br from-primary/[0.03] to-card">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Key className="h-5 w-5 text-primary" />
                    Integração Mercado Pago
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-xs font-black uppercase tracking-widest">Public Key</Label>
                    <Input value={mpPublicKey} onChange={e => setMpPublicKey(e.target.value)} placeholder="APP_USR-..." className="font-mono" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-black uppercase tracking-widest">Access Token</Label>
                    <Input type="password" value={mpAccessToken} onChange={e => setMpAccessToken(e.target.value)} placeholder="APP_USR-..." className="font-mono" />
                  </div>
                </CardContent>
              </Card>

              <Card className="border-success/20 bg-gradient-to-br from-success/[0.03] to-card">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <DollarSign className="h-5 w-5 text-success" />
                    Preço do Plano PRO
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-xs font-black uppercase tracking-widest">Valor Mensal (R$)</Label>
                    <Input type="number" step="0.01" value={proPrice} onChange={e => setProPrice(e.target.value)} placeholder="19.90" className="font-mono text-lg font-bold" />
                  </div>
                  <p className="text-xs text-muted-foreground">Este valor será exibido na Landing Page e na página de Upgrade.</p>
                </CardContent>
              </Card>
            </div>
            <div className="pt-4">
              <Button onClick={saveSettings} className="w-full h-12 font-black shadow-lg shadow-primary/30">
                <Save className="mr-2 h-5 w-5" /> SALVAR TODAS AS CONFIGURAÇÕES
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}