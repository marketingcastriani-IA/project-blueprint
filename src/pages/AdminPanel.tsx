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
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import {
  TrendingUp, Users, CheckCircle2, XCircle, Clock, Shield,
  Loader2, LogOut, Sun, Moon, RefreshCw, Search, Crown, Wallet,
  ArrowLeft, LayoutDashboard, Ban, RotateCcw, Calendar, Settings, Key, Save, User, Mail, DollarSign, AlertTriangle, CalendarClock, ShoppingCart, Send
} from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';
import { cn } from '@/lib/utils';

interface UserRow {
  user_id: string;
  status: string;
  trial_days: number;
  approved_at: string | null;
  expires_at: string | null;
  purchased_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
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
  const [planFilter, setPlanFilter] = useState<'all' | 'pro' | 'free'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'approved' | 'pending' | 'rejected' | 'expired'>('all');
  const [expiryFilter, setExpiryFilter] = useState<'all' | 'expiring7'>('all');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  
  // Editable fields per user
  const [editingExpiry, setEditingExpiry] = useState<Record<string, string>>({});
  const [editingNotes, setEditingNotes] = useState<Record<string, string>>({});
  const [editingPurchaseDate, setEditingPurchaseDate] = useState<Record<string, string>>({});
  
  // Email modal
  const [emailRecipients, setEmailRecipients] = useState<string[]>([]);
  const [emailContextLabel, setEmailContextLabel] = useState('');
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');
  const [sendingEmail, setSendingEmail] = useState(false);
  const [emailImageDataUrl, setEmailImageDataUrl] = useState<string | null>(null);
  const [emailImagePreview, setEmailImagePreview] = useState<string | null>(null);
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
      const { data: settings } = await (supabase
        .from('site_settings' as any)
        .select('*')
        .eq('id', 'pro_plan')
        .single() as any);
      
      if (settings) {
        setProPrice(String((settings as any).value?.price));
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

  const updateExpiryDate = async (userId: string, date: string) => {
    setActionLoading(userId);
    try {
      const expiresAt = date ? new Date(date + 'T23:59:59').toISOString() : null;
      await supabase
        .from('user_access')
        .update({ expires_at: expiresAt } as any)
        .eq('user_id', userId);
      toast.success('Data de vencimento atualizada!');
      fetchUsers();
    } catch (err: any) {
      toast.error('Erro: ' + err.message);
    } finally {
      setActionLoading(null);
    }
  };

  const registerPurchase = async (userId: string, purchaseDate: string) => {
    setActionLoading(userId);
    try {
      const purchasedAt = purchaseDate ? new Date(purchaseDate + 'T12:00:00').toISOString() : new Date().toISOString();
      const expiryDate = new Date(purchasedAt);
      expiryDate.setMonth(expiryDate.getMonth() + 1);
      
      await supabase
        .from('user_access')
        .update({ 
          purchased_at: purchasedAt, 
          expires_at: expiryDate.toISOString(),
          plan_type: 'pro',
          status: 'approved'
        } as any)
        .eq('user_id', userId);
      toast.success('Compra registrada! Validade de 1 mês definida automaticamente.');
      fetchUsers();
    } catch (err: any) {
      toast.error('Erro: ' + err.message);
    } finally {
      setActionLoading(null);
    }
  };

  const buildEmailTemplate = (template: 'promo' | 'renewal' | 'news' | 'custom', recipientName?: string) => {
    const namePrefix = recipientName ? `Olá ${recipientName},` : 'Olá,';

    const templates: Record<string, { subject: string; body: string }> = {
      promo: {
        subject: '🔥 Promoção Especial - Opções PRO X',
        body: `${namePrefix}\n\nTemos uma promoção especial para você no Opções PRO X!\n\n✅ Acesso completo a todas as ferramentas\n✅ Análise de IA avançada\n✅ OCR para leitura automática de notas\n✅ Portfólio e histórico ilimitados\n\nAproveite agora!\n\nEquipe Opções PRO X`
      },
      renewal: {
        subject: '⚠️ Renovação de Assinatura - Opções PRO X',
        body: `${namePrefix}\n\nSua assinatura do Opções PRO X está próxima do vencimento.\n\nRenove agora para continuar com acesso total:\n✅ Simulações ilimitadas\n✅ Relatórios de IA\n✅ OCR e análise de imagens\n\nAcesse: https://www.opcoesprox.com.br/settings\n\nEquipe Opções PRO X`
      },
      news: {
        subject: '🚀 Novidades - Opções PRO X',
        body: `${namePrefix}\n\nConfira as últimas novidades do Opções PRO X!\n\n📊 Novos recursos de análise\n🤖 IA aprimorada\n📈 Melhorias no gráfico de payoff\n\nAcesse agora: https://www.opcoesprox.com.br\n\nEquipe Opções PRO X`
      },
      custom: {
        subject: '',
        body: `${namePrefix}\n\n\n\nEquipe Opções PRO X`
      }
    };

    return templates[template];
  };

  const openEmailForUser = (u: UserRow, template: 'promo' | 'renewal' | 'news' | 'custom') => {
    const recipient = u.email?.includes('@') ? u.email : null;
    if (!recipient) {
      toast.error('Este usuário não possui e-mail válido para envio');
      return;
    }

    const t = buildEmailTemplate(template, u.display_name);
    setEmailRecipients([recipient]);
    setEmailContextLabel(`1 usuário (${u.display_name})`);
    setEmailSubject(t.subject);
    setEmailBody(t.body);
  };

  const sendEmailViaResend = async () => {
    if (!emailRecipients.length || !emailSubject || !emailBody) {
      toast.error('Preencha todos os campos');
      return;
    }
    setSendingEmail(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-admin-email', {
        body: {
          to: emailRecipients,
          subject: emailSubject,
          body: emailBody,
          imageDataUrl: emailImageDataUrl,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success(`Email enviado com sucesso para ${emailRecipients.length} destinatário(s)!`);
      setEmailRecipients([]);
      setEmailContextLabel('');
      setEmailSubject('');
      setEmailBody('');
    } catch (err: any) {
      toast.error('Erro ao enviar email: ' + (err.message || 'Erro desconhecido'));
    } finally {
      setSendingEmail(false);
    }
  };

  const saveSettings = async () => {
    try {
      const { error } = await (supabase
        .from('site_settings' as any)
        .upsert({ 
          id: 'pro_plan', 
          value: { price: parseFloat(proPrice) } 
        }) as any);
      
      if (error) throw error;
      toast.success('Configurações salvas com sucesso!');
    } catch (err: any) {
      toast.error('Erro ao salvar: ' + err.message);
    }
  };

  const getDaysRemaining = (expiresAt: string | null) => {
    if (!expiresAt) return null;
    const now = new Date();
    const exp = new Date(expiresAt);
    const diff = Math.ceil((exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return diff;
  };

  const stats = {
    total: users.length,
    pro: users.filter(u => u.plan_type === 'pro').length,
    pending: users.filter(u => u.status === 'pending').length,
    totalSims: users.reduce((acc, u) => acc + (u.simulations_count || 0), 0),
    expired: users.filter(u => u.expires_at && new Date(u.expires_at) < new Date()).length,
  };

  const matchesUserFilters = (u: UserRow) => {
    const matchesPlan = planFilter === 'all' ? true : u.plan_type === planFilter;
    if (!matchesPlan) return false;

    // Status filter
    if (statusFilter !== 'all') {
      if (statusFilter === 'expired') {
        const isExpired = u.expires_at && new Date(u.expires_at) < new Date();
        if (!isExpired) return false;
      } else if (u.status !== statusFilter) return false;
    }

    // Expiring in 7 days filter
    if (expiryFilter === 'expiring7') {
      const days = getDaysRemaining(u.expires_at);
      if (days === null || days < 0 || days > 7) return false;
    }

    if (!searchTerm) return true;
    const s = searchTerm.toLowerCase();
    return (
      (u.display_name?.toLowerCase().includes(s)) ||
      (u.email?.toLowerCase().includes(s)) ||
      u.user_id.includes(s)
    );
  };

  const filtered = users.filter(matchesUserFilters);

  const openBulkEmailForFiltered = (template: 'promo' | 'renewal' | 'news' | 'custom') => {
    const recipients = filtered
      .map((u) => u.email)
      .filter((email): email is string => Boolean(email && email.includes('@')));

    if (!recipients.length) {
      toast.error('Nenhum e-mail válido encontrado no filtro atual');
      return;
    }

    const templateData = buildEmailTemplate(template);
    const planLabel = planFilter === 'all' ? 'Todos' : planFilter.toUpperCase();
    const statusLabel = statusFilter !== 'all' ? ` | ${statusFilter}` : '';
    const expiryLabel = expiryFilter === 'expiring7' ? ' | ⚠️ expirando 7d' : '';

    setEmailRecipients(recipients);
    setEmailContextLabel(`${recipients.length} usuários filtrados (${planLabel}${statusLabel}${expiryLabel})`);
    setEmailSubject(templateData.subject);
    setEmailBody(templateData.body);
  };

  return (
    <div className="min-h-screen bg-background pb-16">
      <header className="sticky top-0 z-50 border-b border-border/60 bg-card/80 backdrop-blur-md">
        <div className="container flex h-14 items-center justify-between">
          <div className="flex items-center gap-2 font-bold text-lg">
            <img src="/assets/logo.png" alt="Opções PRO X" className="h-8 w-8 object-contain" />
            <span className="hidden sm:inline">Opções PRO X Admin</span>
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
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
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
          <Card className="p-4 text-center space-y-1 border-destructive/30">
            <AlertTriangle className="h-5 w-5 mx-auto text-destructive" />
            <p className="text-2xl font-black text-destructive">{stats.expired}</p>
            <p className="text-[10px] font-bold uppercase text-muted-foreground">Vencidos</p>
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
            <div className="flex flex-col gap-3 lg:flex-row">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Buscar por nome, email ou ID..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-9" />
              </div>
              <Select value={planFilter} onValueChange={(value: 'all' | 'pro' | 'free') => setPlanFilter(value)}>
                <SelectTrigger className="w-full lg:w-[150px]">
                  <SelectValue placeholder="Filtrar plano" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os planos</SelectItem>
                  <SelectItem value="pro">Somente PRO</SelectItem>
                  <SelectItem value="free">Somente FREE</SelectItem>
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={(value: 'all' | 'approved' | 'pending' | 'rejected' | 'expired') => setStatusFilter(value)}>
                <SelectTrigger className="w-full lg:w-[160px]">
                  <SelectValue placeholder="Filtrar status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os status</SelectItem>
                  <SelectItem value="approved">Aprovados</SelectItem>
                  <SelectItem value="pending">Pendentes</SelectItem>
                  <SelectItem value="rejected">Rejeitados</SelectItem>
                  <SelectItem value="expired">Vencidos</SelectItem>
                </SelectContent>
              </Select>
              <Select value={expiryFilter} onValueChange={(value: 'all' | 'expiring7') => setExpiryFilter(value)}>
                <SelectTrigger className="w-full lg:w-[180px]">
                  <SelectValue placeholder="Vencimento" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os vencimentos</SelectItem>
                  <SelectItem value="expiring7">Expirando em 7 dias</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" onClick={fetchUsers}><RefreshCw className="h-4 w-4" /></Button>
            </div>

            <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border/50 bg-card p-3">
              <p className="text-xs font-bold text-muted-foreground">Email em massa (usuários filtrados):</p>
              <Button size="sm" variant="outline" onClick={() => openBulkEmailForFiltered('promo')} className="h-8 px-3 text-[10px] font-bold border-primary/30 hover:bg-primary/10">
                🔥 Promoção
              </Button>
              <Button size="sm" variant="outline" onClick={() => openBulkEmailForFiltered('renewal')} className="h-8 px-3 text-[10px] font-bold border-warning/30 text-warning hover:bg-warning/10">
                ⚠️ Renovação
              </Button>
              <Button size="sm" variant="outline" onClick={() => openBulkEmailForFiltered('news')} className="h-8 px-3 text-[10px] font-bold border-success/30 text-success hover:bg-success/10">
                🚀 Novidades
              </Button>
              <Button size="sm" variant="outline" onClick={() => openBulkEmailForFiltered('custom')} className="h-8 px-3 text-[10px] font-bold hover:bg-accent">
                ✏️ Personalizado
              </Button>
            </div>

            <div className="space-y-3">
              {filtered.map(u => {
                const daysRemaining = getDaysRemaining(u.expires_at);
                const isExpired = daysRemaining !== null && daysRemaining < 0;
                const isExpiringSoon = daysRemaining !== null && daysRemaining >= 0 && daysRemaining <= 7;
                
                return (
                <Card key={u.user_id} className={cn("p-5 transition-all border-2", u.status === 'rejected' ? "opacity-60 bg-muted/20 border-destructive/20" : isExpired ? "border-destructive/30" : "border-border/40 hover:border-primary/20")}>
                  <div className="flex flex-col gap-5">
                    {/* Top row: user info + badges */}
                    <div className="flex items-start gap-4">
                      <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0 border border-primary/20">
                        <User className="h-6 w-6 text-primary" />
                      </div>
                      <div className="space-y-1 min-w-0 flex-1">
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
                          {daysRemaining !== null && (
                            <Badge variant="outline" className={cn(
                              "text-[10px] font-black",
                              isExpired ? "text-destructive border-destructive/40 bg-destructive/10" : isExpiringSoon ? "text-warning border-warning/40 bg-warning/10" : "text-success border-success/40 bg-success/10"
                            )}>
                              {isExpired ? `Vencido há ${Math.abs(daysRemaining)} dias` : `${daysRemaining} dias restantes`}
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground font-medium">
                          <Mail className="h-3 w-3" />
                          {u.email}
                        </div>
                        <p className="text-[10px] font-mono text-muted-foreground/60 truncate max-w-[200px]">ID: {u.user_id}</p>
                        <div className="flex gap-3 pt-2 flex-wrap">
                          <Badge variant="secondary" className="text-[10px] font-bold">
                            {u.simulations_count} Simulações
                          </Badge>
                          <Badge variant="outline" className="text-[10px] font-bold text-muted-foreground gap-1">
                            <Calendar className="h-3 w-3" />
                            Cadastro: {new Date(u.created_at).toLocaleDateString('pt-BR')}
                          </Badge>
                          {u.purchased_at && (
                            <Badge variant="outline" className="text-[10px] font-bold text-primary border-primary/30 bg-primary/10 gap-1">
                              <ShoppingCart className="h-3 w-3" />
                              Compra: {new Date(u.purchased_at).toLocaleDateString('pt-BR')}
                            </Badge>
                          )}
                          {u.expires_at && (
                            <Badge variant="outline" className={cn(
                              "text-[10px] font-bold gap-1",
                              isExpired ? "text-destructive border-destructive/30" : "text-success border-success/30"
                            )}>
                              <Clock className="h-3 w-3" />
                              {isExpired ? 'Venceu' : 'Vence'}: {new Date(u.expires_at).toLocaleDateString('pt-BR')}
                            </Badge>
                          )}
                          <Badge variant="outline" className="text-[10px] font-bold text-muted-foreground/60 gap-1">
                            Atualizado: {new Date(u.updated_at).toLocaleDateString('pt-BR')}
                          </Badge>
                        </div>
                      </div>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 border-t border-border/40 pt-4">
                      <div className="space-y-1.5">
                        <Label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-1">
                          <ShoppingCart className="h-3 w-3" /> Data da Compra
                        </Label>
                        <div className="flex gap-2">
                          <Input
                            type="date"
                            value={editingPurchaseDate[u.user_id] ?? (u.purchased_at ? new Date(u.purchased_at).toISOString().split('T')[0] : '')}
                            onChange={e => setEditingPurchaseDate(prev => ({ ...prev, [u.user_id]: e.target.value }))}
                            className="h-9 text-xs font-mono flex-1"
                          />
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-9 px-3 text-[10px] font-black text-primary border-primary/30 hover:bg-primary/10"
                            disabled={actionLoading === u.user_id}
                            onClick={() => {
                              const val = editingPurchaseDate[u.user_id] ?? (u.purchased_at ? new Date(u.purchased_at).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]);
                              registerPurchase(u.user_id, val);
                            }}
                          >
                            <Save className="h-3 w-3" />
                          </Button>
                        </div>
                        <p className="text-[9px] text-muted-foreground">Salvar registra compra + 1 mês de validade</p>
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-1">
                          <CalendarClock className="h-3 w-3" /> Data de Vencimento
                        </Label>
                        <div className="flex gap-2">
                          <Input
                            type="date"
                            value={editingExpiry[u.user_id] ?? (u.expires_at ? new Date(u.expires_at).toISOString().split('T')[0] : '')}
                            onChange={e => setEditingExpiry(prev => ({ ...prev, [u.user_id]: e.target.value }))}
                            className="h-9 text-xs font-mono flex-1"
                          />
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-9 px-3 text-[10px] font-black text-primary border-primary/30 hover:bg-primary/10"
                            disabled={actionLoading === u.user_id}
                            onClick={() => {
                              const val = editingExpiry[u.user_id] ?? (u.expires_at ? new Date(u.expires_at).toISOString().split('T')[0] : '');
                              updateExpiryDate(u.user_id, val);
                            }}
                          >
                            <Save className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Alterar Plano</Label>
                        <Select value={u.plan_type} onValueChange={(v) => updatePlan(u.user_id, v)}>
                          <SelectTrigger className="h-9 text-xs font-bold">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="free">PLANO FREE</SelectItem>
                            <SelectItem value="pro">PLANO PRO</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Ações Rápidas</Label>
                        <div className="flex gap-2 flex-wrap">
                          {u.status === 'pending' || u.status === 'rejected' ? (
                            <Button size="sm" variant="outline" onClick={() => updateStatus(u.user_id, 'approved')} className="h-9 px-3 text-[10px] font-bold text-success border-success/30 hover:bg-success/10">
                              <CheckCircle2 className="h-3 w-3 mr-1" /> APROVAR
                            </Button>
                          ) : (
                            <Button size="sm" variant="outline" onClick={() => updateStatus(u.user_id, 'rejected')} className="h-9 px-3 text-[10px] font-bold text-destructive border-destructive/30 hover:bg-destructive/10">
                              <Ban className="h-3 w-3 mr-1" /> BLOQUEAR
                            </Button>
                          )}
                          <Button size="sm" variant="outline" onClick={() => resetSimulations(u.user_id)} className="h-9 px-3 text-[10px] font-bold hover:bg-primary/10">
                            <RotateCcw className="h-3 w-3 mr-1" /> RESET
                          </Button>
                        </div>
                      </div>
                    </div>

                    {/* Email actions row */}
                    <div className="border-t border-border/40 pt-4">
                      <Label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-1 mb-2">
                        <Send className="h-3 w-3" /> Enviar Email para {u.display_name}
                      </Label>
                      <div className="flex gap-2 flex-wrap">
                        <Button size="sm" variant="outline" onClick={() => openEmailForUser(u, 'promo')} className="h-8 px-3 text-[10px] font-bold border-primary/30 hover:bg-primary/10">
                          🔥 Promoção
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => openEmailForUser(u, 'renewal')} className="h-8 px-3 text-[10px] font-bold border-warning/30 text-warning hover:bg-warning/10">
                          ⚠️ Renovação
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => openEmailForUser(u, 'news')} className="h-8 px-3 text-[10px] font-bold border-success/30 text-success hover:bg-success/10">
                          🚀 Novidades
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => openEmailForUser(u, 'custom')} className="h-8 px-3 text-[10px] font-bold hover:bg-accent">
                          ✏️ Personalizado
                        </Button>
                      </div>
                    </div>
                  </div>
                </Card>
              );
              })}
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

      {/* Email Modal */}
      {emailRecipients.length > 0 && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setEmailRecipients([])}>
          <Card className="w-full max-w-lg" onClick={e => e.stopPropagation()}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Send className="h-5 w-5 text-primary" />
                Enviar Email em Massa
              </CardTitle>
              <p className="text-xs text-muted-foreground">{emailContextLabel}</p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label className="text-xs font-black uppercase">Assunto</Label>
                <Input value={emailSubject} onChange={e => setEmailSubject(e.target.value)} placeholder="Assunto do email..." />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-black uppercase">Mensagem</Label>
                <Textarea value={emailBody} onChange={e => setEmailBody(e.target.value)} rows={8} placeholder="Corpo do email..." className="text-sm" />
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setEmailRecipients([])}>Cancelar</Button>
                <Button onClick={sendEmailViaResend} disabled={sendingEmail} className="font-bold">
                  {sendingEmail ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
                  {sendingEmail ? 'Enviando...' : `Enviar para ${emailRecipients.length}`}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
