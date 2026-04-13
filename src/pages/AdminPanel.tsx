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
  ArrowLeft, LayoutDashboard, Ban, RotateCcw, Calendar, Settings, Key, Save, User, Mail, DollarSign, AlertTriangle, CalendarClock, ShoppingCart, Send, Upload, Image as ImageIcon, BarChart3, Activity, Layers, Download, Paperclip, FileText
} from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';
import { cn } from '@/lib/utils';
import { BarChart, Bar, XAxis, YAxis, Tooltip as RTooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

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

// Sugestões Panel Component
function SugestoesPanel() {
  const [sugestoes, setSugestoes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSugestoes = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('sugestoes' as any)
        .select('*')
        .order('created_at', { ascending: false });
      if (!error && data) {
        // Fetch user emails for each suggestion
        const userIds = [...new Set((data as any[]).map((s: any) => s.user_id))];
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, email, display_name')
          .in('user_id', userIds);
        const profileMap: Record<string, any> = {};
        (profiles || []).forEach((p: any) => { profileMap[p.user_id] = p; });
        setSugestoes((data as any[]).map((s: any) => ({ ...s, profile: profileMap[s.user_id] })));
      }
      setLoading(false);
    };
    fetchSugestoes();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
          <Mail className="h-4 w-4 text-primary" /> Sugestões dos Clientes
        </h3>
        <Badge variant="outline" className="font-bold">{sugestoes.length} sugestões</Badge>
      </div>

      {sugestoes.length === 0 ? (
        <Card className="border-border/40">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Mail className="h-10 w-10 text-muted-foreground mb-3" />
            <p className="text-sm font-bold text-muted-foreground">Nenhuma sugestão recebida ainda</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {sugestoes.map((s: any) => (
            <Card key={s.id} className="border-border/40 hover:border-primary/30 transition-all">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge className="text-[10px] font-black bg-primary/10 text-primary border-0">
                        <User className="h-3 w-3 mr-1" />
                        {s.profile?.display_name || s.profile?.email || 'Usuário'}
                      </Badge>
                      {s.profile?.email && (
                        <span className="text-[10px] text-muted-foreground">{s.profile.email}</span>
                      )}
                    </div>
                    <p className="text-sm text-foreground leading-relaxed bg-muted/30 rounded-lg p-3 border border-border/30">
                      {s.mensagem}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-[10px] text-muted-foreground font-bold">
                      {new Date(s.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {new Date(s.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}


function MetricsPanel({ users, proPrice }: { users: UserRow[]; proPrice: number }) {
  const [analysisCountMap, setAnalysisCountMap] = useState<Record<string, number>>({});
  const [weeklySignups, setWeeklySignups] = useState<{ week: string; count: number }[]>([]);

  useEffect(() => {
    const fetchMetrics = async () => {
      // Fetch analysis counts per user
      const { data: analyses } = await supabase
        .from('analyses')
        .select('user_id');

      if (analyses) {
        const countMap: Record<string, number> = {};
        analyses.forEach((a: any) => {
          countMap[a.user_id] = (countMap[a.user_id] || 0) + 1;
        });
        setAnalysisCountMap(countMap);
      }

      // Weekly signups (last 12 weeks)
      const weeks: { week: string; count: number }[] = [];
      for (let i = 11; i >= 0; i--) {
        const weekStart = new Date();
        weekStart.setDate(weekStart.getDate() - (i * 7 + weekStart.getDay()));
        weekStart.setHours(0, 0, 0, 0);
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekEnd.getDate() + 7);
        const count = users.filter(u => {
          const d = new Date(u.created_at);
          return d >= weekStart && d < weekEnd;
        }).length;
        weeks.push({
          week: weekStart.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
          count,
        });
      }
      setWeeklySignups(weeks);
    };
    fetchMetrics();
  }, [users]);

  const proUsers = users.filter(u => u.plan_type === 'pro');
  const activeProUsers = proUsers.filter(u => u.expires_at && new Date(u.expires_at) > new Date());
  const mrr = activeProUsers.length * proPrice;
  
  const trialUsers = users.filter(u => u.plan_type === 'free' && u.status === 'approved');
  const convertedFromTrial = users.filter(u => u.plan_type === 'pro' && u.purchased_at);
  const conversionRate = users.length > 0 ? ((convertedFromTrial.length / users.length) * 100).toFixed(1) : '0';
  
  const expiredPro = proUsers.filter(u => u.expires_at && new Date(u.expires_at) < new Date());
  const churnRate = proUsers.length > 0 ? ((expiredPro.length / proUsers.length) * 100).toFixed(1) : '0';

  const totalSimulations = users.reduce((acc, u) => acc + (u.simulations_count || 0), 0);
  const avgSimsPerUser = users.length > 0 ? (totalSimulations / users.length).toFixed(1) : '0';

  const totalAnalyses = Object.values(analysisCountMap).reduce((a, b) => a + b, 0);
  const avgAnalysesPerUser = users.length > 0 ? (totalAnalyses / users.length).toFixed(1) : '0';

  const COLORS = ['hsl(var(--primary))', 'hsl(var(--success))', 'hsl(var(--warning))', 'hsl(var(--destructive))'];
  const pieData = [
    { name: 'PRO Ativos', value: activeProUsers.length },
    { name: 'PRO Vencidos', value: expiredPro.length },
    { name: 'Free', value: trialUsers.length },
    { name: 'Pendentes', value: users.filter(u => u.status === 'pending').length },
  ].filter(d => d.value > 0);

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-success/30">
          <CardContent className="p-5 text-center space-y-1">
            <DollarSign className="h-6 w-6 mx-auto text-success" />
            <p className="text-2xl font-black text-success">R$ {mrr.toFixed(2)}</p>
            <p className="text-xs font-black uppercase text-muted-foreground">MRR Estimado</p>
          </CardContent>
        </Card>
        <Card className="border-primary/30">
          <CardContent className="p-5 text-center space-y-1">
            <TrendingUp className="h-6 w-6 mx-auto text-primary" />
            <p className="text-2xl font-black text-primary">{conversionRate}%</p>
            <p className="text-xs font-black uppercase text-muted-foreground">Conversão Trial→PRO</p>
          </CardContent>
        </Card>
        <Card className="border-destructive/30">
          <CardContent className="p-5 text-center space-y-1">
            <AlertTriangle className="h-6 w-6 mx-auto text-destructive" />
            <p className="text-2xl font-black text-destructive">{churnRate}%</p>
            <p className="text-xs font-black uppercase text-muted-foreground">Churn Rate</p>
          </CardContent>
        </Card>
        <Card className="border-primary/30">
          <CardContent className="p-5 text-center space-y-1">
            <Activity className="h-6 w-6 mx-auto text-primary" />
            <p className="text-2xl font-black">{avgSimsPerUser}</p>
            <p className="text-xs font-black uppercase text-muted-foreground">Simulações / Usuário</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Weekly Signups Chart */}
        <Card className="border-primary/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-black flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" /> Cadastros por Semana
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={weeklySignups}>
                  <XAxis dataKey="week" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" tickLine={false} axisLine={false} allowDecimals={false} />
                  <RTooltip
                    contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }}
                    formatter={(value: number) => [value, 'Cadastros']}
                  />
                  <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* User Distribution Pie */}
        <Card className="border-primary/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-black flex items-center gap-2">
              <Crown className="h-4 w-4 text-primary" /> Distribuição de Planos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[220px] flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, value }) => `${name}: ${value}`}>
                    {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <RTooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Engagement Table */}
      <Card className="border-primary/20">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-black flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-primary" /> Engajamento por Usuário
          </CardTitle>
          <p className="text-xs text-muted-foreground">Média: {avgAnalysesPerUser} análises / usuário</p>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 max-h-[300px] overflow-y-auto">
            {users
              .sort((a, b) => (analysisCountMap[b.user_id] || 0) - (analysisCountMap[a.user_id] || 0))
              .slice(0, 20)
              .map(u => {
                const count = analysisCountMap[u.user_id] || 0;
                return (
                  <div key={u.user_id} className="flex items-center justify-between p-2 rounded-lg border border-border/30 bg-muted/10">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <Badge variant={u.plan_type === 'pro' ? 'default' : 'outline'} className={cn("text-xs", u.plan_type === 'pro' && 'bg-primary')}>
                        {u.plan_type.toUpperCase()}
                      </Badge>
                      <span className="text-sm font-bold truncate">{u.display_name}</span>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <Badge variant="secondary" className="text-xs font-bold">{count} análises</Badge>
                      <Badge variant="secondary" className="text-xs font-bold">{u.simulations_count} sims</Badge>
                    </div>
                  </div>
                );
              })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
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
  const [emailAttachment, setEmailAttachment] = useState<{ name: string; content: string; type: string } | null>(null);
  // Feature flags state
  const FEATURE_KEYS = ['feature-collar-tracker', 'feature-box-tracker', 'feature-calc-cdi', 'feature-diversificador', 'feature-dados-ao-vivo'];
  const [featureFlags, setFeatureFlags] = useState<Record<string, boolean>>(() => {
    const flags: Record<string, boolean> = {};
    FEATURE_KEYS.forEach(key => {
      flags[key] = localStorage.getItem(key) !== 'false';
    });
    return flags;
  });

  // Mercado Pago Config
  const [mpPublicKey, setMpPublicKey] = useState('');
  const [mpAccessToken, setMpAccessToken] = useState('');
  const [proPrice, setProPrice] = useState('14.90');
  const [annualDiscount, setAnnualDiscount] = useState('20');

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
      
      if (settings?.value && typeof settings.value === 'object' && 'price' in settings.value) {
        const val = settings.value as { price: number; annual_discount?: number };
        setProPrice(String(val.price));
        if (val.annual_discount !== undefined) setAnnualDiscount(String(val.annual_discount));
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

  useEffect(() => {
    if (!access.isAdmin) return;

    const accessChannel = supabase
      .channel('admin-user-access-live')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'user_access',
      }, () => {
        fetchUsers();
      })
      .subscribe();

    const settingsChannel = supabase
      .channel('admin-site-settings-live')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'site_settings',
        filter: 'id=eq.pro_plan',
      }, () => {
        fetchUsers();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(accessChannel);
      supabase.removeChannel(settingsChannel);
    };
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

  type EmailTemplate = 'promo' | 'renewal' | 'news' | 'custom' | 'calc_cdi' | 'box_tracker' | 'collar_tracker' | 'tempo_real' | 'diversificador' | 'resumo_geral' | 'boas_vindas_pro' | 'rastreador_pro_x';

  const EMAIL_TEMPLATE_OPTIONS: { value: EmailTemplate; label: string; icon: string; color: string }[] = [
    { value: 'boas_vindas_pro', label: 'Boas-vindas PRO', icon: '🎉', color: 'border-green-400/50 text-green-400 hover:bg-green-400/10' },
    { value: 'promo', label: 'Promoção', icon: '🔥', color: 'border-primary/30 hover:bg-primary/10' },
    { value: 'renewal', label: 'Renovação', icon: '⚠️', color: 'border-warning/30 text-warning hover:bg-warning/10' },
    { value: 'news', label: 'Novidades', icon: '🚀', color: 'border-success/30 text-success hover:bg-success/10' },
    { value: 'rastreador_pro_x', label: 'Rastreador PRO X', icon: '⚡', color: 'border-cyan-400/50 text-cyan-400 hover:bg-cyan-400/10' },
    { value: 'calc_cdi', label: 'Calculadora CDI x Opções', icon: '🧮', color: 'border-yellow-400/50 text-yellow-500 hover:bg-yellow-400/10' },
    { value: 'box_tracker', label: 'Rastreador Box', icon: '📊', color: 'border-blue-400/50 text-blue-400 hover:bg-blue-400/10' },
    { value: 'collar_tracker', label: 'Rastreador Collar', icon: '🛡️', color: 'border-emerald-400/50 text-emerald-400 hover:bg-emerald-400/10' },
    { value: 'tempo_real', label: 'Dados ao Vivo', icon: '🔴', color: 'border-red-400/50 text-red-400 hover:bg-red-400/10' },
    { value: 'diversificador', label: 'Diversificador', icon: '🎯', color: 'border-purple-400/50 text-purple-400 hover:bg-purple-400/10' },
    { value: 'resumo_geral', label: 'Resumo Todas Novidades', icon: '📢', color: 'border-primary/50 text-primary hover:bg-primary/10' },
    { value: 'custom', label: 'Personalizado', icon: '✏️', color: 'hover:bg-accent' },
  ];

  const buildEmailTemplate = (template: EmailTemplate, recipientName?: string) => {
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
        body: `${namePrefix}\n\nConfira as últimas novidades do Opções PRO X!\n\n📊 Simulador de Estruturas — Monte e analise qualquer estratégia de opções\n🤖 IA Integrada — Análise inteligente e sugestões de melhoria\n📷 OCR — Tire foto da tela de opções e a IA monta a estrutura\n🧮 CDI x Opções — Compare o lucro com o CDI (com/sem IR)\n📊 Rastrear Box — Monitore Box Spread vs CDI em tempo real\n🛡️ Rastrear Collar — Proteção de carteira com piso e teto\n🔴 Tempo Real — Dados ao vivo do mercado via Bridge RTD\n🎯 Diversificador — Portfólio equilibrado de estratégias\n🔍 Ticker Opções B3 — Banco com 99.000+ opções, busca e pares automáticos\n📁 Portfólio e Histórico — Controle completo de operações\n🔔 Notificações Push — Alertas de oportunidades no navegador\n\nAcesse agora: https://www.opcoesprox.com.br\n\nEquipe Opções PRO X`
      },
      calc_cdi: {
        subject: '🧮 NOVO! Compare sua estrutura de opções com o CDI em segundos',
        body: `${namePrefix}\n\nTemos uma novidade exclusiva que vai transformar sua tomada de decisão:\n\n🧮 Calculadora CDI x Opções — NOVA FERRAMENTA!\n\nAgora você pode comparar, em tempo real, quanto sua estrutura de opções rende em relação ao CDI do período.\n\n✅ Insira o capital investido e a data de vencimento\n✅ Escolha se deseja considerar o Imposto de Renda (tabela regressiva automática)\n✅ Digite o % de lucro da sua estrutura\n✅ Descubra instantaneamente quantos % do CDI sua operação equivale\n\nExemplo prático:\nSe o CDI rende 1,12% no período e sua estrutura dá 1,8% — você está ganhando 160% do CDI! 🚀\n\n🔗 Acesse agora: Menu → CDI x Opções (destaque amarelo)\nhttps://www.opcoesprox.com.br/calculadora-renda-fixa\n\nEquipe Opções PRO X`
      },
      box_tracker: {
        subject: '📊 Rastreie seu Box Spread e saiba se está acima do CDI',
        body: `${namePrefix}\n\nVocê já conhece o Rastreador de Box Spread do Opções PRO X?\n\n📊 Rastrear Box — Controle Total da Rentabilidade\n\nCom esta ferramenta você consegue:\n\n✅ Monitorar a rentabilidade do Box em relação ao CDI\n✅ Acompanhar se a operação está acima ou abaixo do benchmark\n✅ Visualizar dias úteis restantes e taxa equivalente\n✅ Tomar decisão de manter ou encerrar com dados reais\n\n💡 Dica PRO: Combine o Rastreador de Box com a nova Calculadora CDI x Opções para ter uma visão completa da sua rentabilidade!\n\n🔗 Acesse agora: Menu → Rastrear Box\nhttps://www.opcoesprox.com.br/box-tracker\n\nEquipe Opções PRO X`
      },
      collar_tracker: {
        subject: '🛡️ Proteja seu patrimônio com o Rastreador de Collar',
        body: `${namePrefix}\n\nConheça o Rastreador de Collar — sua ferramenta de proteção inteligente:\n\n🛡️ Rastrear Collar — Proteção com Visibilidade\n\n✅ Acompanhe sua estratégia de proteção (Collar) em tempo real\n✅ Visualize os limites de proteção e ganho da operação\n✅ Saiba exatamente quando agir para ajustar sua posição\n✅ Ideal para quem tem carteira de ações e quer proteger sem abrir mão de ganhos\n\n🔗 Acesse agora: Menu → Rastrear Collar\nhttps://www.opcoesprox.com.br/collar-tracker\n\nEquipe Opções PRO X`
      },
      tempo_real: {
        subject: '🔴 AO VIVO! Dados de mercado em tempo real no Opções PRO X',
        body: `${namePrefix}\n\nJá experimentou os Dados ao Vivo do Opções PRO X?\n\n🔴 Tempo Real — Acompanhe o Mercado Sem Sair da Plataforma\n\n✅ Preços de ativos e opções atualizados em tempo real\n✅ Integração com o Bridge RTD para dados direto da sua corretora\n✅ Visualização profissional e limpa, sem distrações\n✅ Ideal para quem opera intraday ou precisa acompanhar vencimentos\n\n📥 Configure o Bridge: Menu → Manual → Configuração do Bridge\n\n🔗 Acesse agora: Menu → Tempo Real (botão vermelho pulsante)\nhttps://www.opcoesprox.com.br/dados-ao-vivo\n\nEquipe Opções PRO X`
      },
      rastreador_pro_x: {
        subject: '⚡ NOVO: Rastreador PRO X — 12 Estratégias em Tempo Real!',
        body: `${namePrefix}\n\nConheca o Rastreador PRO X, a mais nova ferramenta do Opções PRO X!\n\n⚡ RASTREADOR PRO X — 12 Estratégias em Tempo Real\n\nEscaneie automaticamente as melhores combinações de opções da B3, organizadas por cenário de mercado:\n\n📈 ALTA (3 estratégias)\n✅ Venda Coberta — Gere renda vendendo Call do ativo em carteira\n✅ Trava de Alta (Call) — Compra Call K1 + Venda Call K2 com risco limitado\n✅ Trava de Alta (Put) — Receba crédito apostando que não cai\n\n📉 BAIXA (3 estratégias)\n✅ Venda de Put (Cash-Secured) — Renda com compromisso de compra\n✅ Trava de Baixa (Put) — Compra Put K1 + Venda Put K2\n✅ Trava de Baixa (Call) — Receba crédito apostando que não sobe\n\n➡️ LATERAL (2 estratégias)\n✅ Iron Condor — Trava Put + Trava Call para lucrar na lateralidade\n✅ Borboleta — Lucro máximo no strike central\n\n⚡ VOLATILIDADE (4 estratégias)\n✅ Straddle Comprado — Compra Call+Put mesmo strike, lucra com volatilidade alta\n✅ Straddle Vendido — Vende Call+Put mesmo strike, lucra com mercado parado\n✅ Strangle Comprado — Compra Call+Put OTM, mais barato que Straddle\n✅ Strangle Vendido — Vende Call+Put OTM, lucra dentro da faixa de estabilidade\n\n🏆 Ranking Top 3 por Retorno %, Quality Score ou Lucro R$\n📊 Gráfico de Payoff avançado com curvas T+0 e Vencimento\n💰 Comparação CDI automática — saiba se a estratégia ganha do CDI\n🔄 Multi-ativos salvos e rastreamento simultâneo\n\n🔗 Acesse agora: Menu → Rastreador PRO X\nhttps://www.opcoesprox.com.br/strategy-tracker\n\nEquipe Opções PRO X`
      },
      diversificador: {
        subject: '🎯 Diversifique suas estratégias com inteligência',
        body: `${namePrefix}\n\nO Diversificador do Opções PRO X ajuda você a:\n\n🎯 Monte um Portfólio de Estratégias Equilibrado\n\n✅ Distribua seu patrimônio entre diferentes estratégias\n✅ Visualize a alocação por percentual e nível de risco\n✅ Controle alavancagem e frequência de cada estratégia\n✅ Veja o resultado consolidado com gráfico profissional\n\n💡 Dica PRO: Use junto com a Calculadora CDI x Opções para saber se cada estratégia supera o CDI!\n\n🔗 Acesse agora: Menu → Diversificador\nhttps://www.opcoesprox.com.br/diversificador\n\nEquipe Opções PRO X`
      },
      resumo_geral: {
        subject: '📢 TODAS as Ferramentas do Opções PRO X — Guia Completo!',
        body: `${namePrefix}\n\nO Opções PRO X é a plataforma mais completa de simulação e análise de opções da B3. Conheça TODAS as ferramentas disponíveis:\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n📊 SIMULADOR DE ESTRUTURAS\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n✅ Monte qualquer estrutura: Box, Trava, Borboleta, Condor, Collar e mais\n✅ Gráfico de Payoff interativo com métricas completas\n✅ Breakeven, lucro máximo, risco máximo e custo líquido\n✅ Simulações ilimitadas no plano PRO\n🔗 https://www.opcoesprox.com.br/dashboard\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n🤖 ANÁLISE POR INTELIGÊNCIA ARTIFICIAL\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n✅ IA analisa risco/retorno e sugere melhorias\n✅ Veredito de Saída — saiba a hora certa de encerrar\n✅ Uso ilimitado no plano PRO\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n📷 OCR — LEITURA DE IMAGENS\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n✅ Tire foto da tela de opções da sua corretora\n✅ A IA extrai automaticamente os dados e monta a estrutura\n✅ Funciona com qualquer corretora\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n🧮 CALCULADORA CDI x OPÇÕES\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n✅ Compare o lucro da operação com o CDI do período\n✅ Imposto de Renda automático (tabela regressiva)\n✅ Descubra se sua estrutura supera a renda fixa\n🔗 https://www.opcoesprox.com.br/calculadora-renda-fixa\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n⚡ RASTREADOR PRO X — NOVIDADE!\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n✅ Rastreie 12 estratégias em tempo real com ranking Top 3\n✅ Cenários: Alta (Venda Coberta, Trava de Alta Call/Put)\n✅ Cenários: Baixa (Venda de Put, Trava de Baixa Put/Call)\n✅ Cenários: Lateral (Iron Condor, Borboleta)\n✅ Cenários: Volatilidade (Straddle e Strangle — Comprado e Vendido)\n✅ Gráfico de Payoff avançado com curvas T+0 e Vencimento\n✅ Comparação CDI automática e Quality Score\n✅ Multi-ativos salvos e filtros de liquidez\n🔗 https://www.opcoesprox.com.br/strategy-tracker\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n📊 RASTREADOR DE BOX SPREAD\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n✅ Monitore todas as combinações de Box vs CDI em tempo real\n✅ Ranking automático dos melhores spreads com troféus\n✅ Cards de destaque com o melhor box de cada ação\n✅ Alertas visuais na tela (toasts) quando Box supera o CDI\n✅ Notificações push no navegador para oportunidades\n✅ Instruções passo a passo de montagem\n🔗 https://www.opcoesprox.com.br/box-tracker\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n🛡️ RASTREADOR DE COLLAR\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n✅ Proteção de carteira com Ação + Put + Call vendida\n✅ Piso (floor) e teto (cap) calculados automaticamente\n✅ Identifica collars de custo zero\n🔗 https://www.opcoesprox.com.br/collar-tracker\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n🔴 DADOS AO VIVO (TEMPO REAL)\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n✅ Cotações de ativos e opções atualizadas em tempo real\n✅ P&L automático das operações em aberto\n✅ Gráfico de payoff dinâmico com preços do mercado\n✅ Requer Profit Pro + Bridge RTD\n🔗 https://www.opcoesprox.com.br/dados-ao-vivo\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n🔍 TICKER OPÇÕES B3 — BANCO DE OPÇÕES\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n✅ Banco com 99.000+ opções listadas na B3\n✅ Busca inteligente por ticker, família e vencimento\n✅ Identificação automática de pares Call+Put\n✅ Envie tickers para Tempo Real ou Box Tracker em 1 clique\n✅ Detecta oportunidades de Box Spread automaticamente\n🔗 https://www.opcoesprox.com.br/ticker-opcoes\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n🎯 DIVERSIFICADOR DE ESTRATÉGIAS\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n✅ Monte portfólio equilibrado de estratégias\n✅ Distribua patrimônio por risco e alavancagem\n✅ Gráfico profissional de alocação\n🔗 https://www.opcoesprox.com.br/diversificador\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n📁 PORTFÓLIO E HISTÓRICO\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n✅ Controle completo de operações ativas e encerradas\n✅ Filtros por mês, ano e status\n✅ Reabra operações encerradas se necessário\n✅ Relatórios em PDF para download\n🔗 https://www.opcoesprox.com.br/portfolio\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n🔔 NOTIFICAÇÕES PUSH\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n✅ Alertas no navegador quando o Box supera o CDI\n✅ Histórico de alertas disparados\n✅ Nunca perca uma oportunidade\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n⌨️ ATALHOS DE TECLADO\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n✅ Ctrl+S (Salvar), Ctrl+Enter (IA), N (Nova), H (Histórico), P (Portfólio)\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n📖 MANUAL E FAQ COMPLETO\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n✅ 16 seções detalhadas com capturas de tela\n✅ Glossário de termos, estratégias e Gregas\n✅ Download em PDF\n🔗 https://www.opcoesprox.com.br/faq\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n👉 Acesse agora e explore todas as ferramentas!\nhttps://www.opcoesprox.com.br\n\n🚀 Assine PRO para acesso completo:\nhttps://www.opcoesprox.com.br/settings?upgrade=true\n\nEquipe Opções PRO X`
      },
      boas_vindas_pro: {
        subject: '🎉 Bem-vindo ao Opções PRO X — Seu Acesso PRO Está Ativo!',
        body: `${namePrefix}\n\nParabéns! 🚀 Seu plano PRO do Opções PRO X foi ativado com sucesso!\n\nAgora você tem acesso COMPLETO a todas as ferramentas profissionais da plataforma. Veja tudo o que você pode fazer:\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n📊 SIMULADOR DE ESTRUTURAS\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n✅ Monte e analise qualquer estrutura de opções (Box, Trava, Borboleta, Condor, etc.)\n✅ Gráfico de Payoff interativo — visualize lucro e prejuízo em cada cenário\n✅ Simulações ILIMITADAS (sem limite de 3 por dia)\n✅ Salve, edite e acompanhe suas estruturas\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n🤖 ANÁLISE POR INTELIGÊNCIA ARTIFICIAL\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n✅ IA analisa sua estrutura e dá sugestões de melhoria\n✅ Identifica riscos, oportunidades e pontos de atenção\n✅ Recomendações personalizadas para cada operação\n✅ Uso ILIMITADO da IA\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n📷 OCR — LEITURA DE IMAGENS\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n✅ Tire uma foto ou screenshot da sua tela de opções\n✅ A IA lê automaticamente os dados e monta a estrutura\n✅ Funciona com qualquer plataforma de corretora\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n⚡ RASTREADOR PRO X — 12 ESTRATÉGIAS!\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n✅ Rastreie 12 estratégias em tempo real com ranking Top 3\n✅ Alta: Venda Coberta, Trava de Alta (Call), Trava de Alta (Put)\n✅ Baixa: Venda de Put, Trava de Baixa (Put), Trava de Baixa (Call)\n✅ Lateral: Iron Condor, Borboleta\n✅ Volatilidade: Straddle Comprado/Vendido, Strangle Comprado/Vendido\n✅ Gráfico de Payoff com curvas T+0 e Vencimento + CDI\n✅ Quality Score, filtros de liquidez e multi-ativos salvos\n🔗 https://www.opcoesprox.com.br/strategy-tracker\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n🧮 CALCULADORA CDI x OPÇÕES\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n✅ Compare o lucro da sua operação com o CDI do período\n✅ Com ou sem Imposto de Renda (tabela regressiva automática)\n✅ Descubra se sua estrutura supera a renda fixa\n🔗 https://www.opcoesprox.com.br/calculadora-renda-fixa\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n📊 RASTREADOR DE BOX SPREAD\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n✅ Monitore todas as combinações de Box vs CDI em tempo real\n✅ Ranking automático com troféus dos melhores spreads\n✅ Alertas visuais na tela quando Box supera o CDI\n✅ Notificações push no navegador\n✅ Instruções passo a passo de montagem\n🔗 https://www.opcoesprox.com.br/box-tracker\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n🛡️ RASTREADOR DE COLLAR\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n✅ Proteção de carteira com Ação + Put + Call vendida\n✅ Piso (floor) e teto (cap) calculados automaticamente\n✅ Identifica collars de custo zero\n🔗 https://www.opcoesprox.com.br/collar-tracker\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n🎯 DIVERSIFICADOR DE ESTRATÉGIAS\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n✅ Monte um portfólio equilibrado de estratégias\n✅ Distribua seu patrimônio por risco, alavancagem e frequência\n✅ Gráfico profissional de alocação\n🔗 https://www.opcoesprox.com.br/diversificador\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n📁 PORTFÓLIO E HISTÓRICO\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n✅ Portfólio completo com todas as suas operações\n✅ Histórico de análises — consulte a qualquer momento\n✅ Relatórios em PDF para download\n🔗 https://www.opcoesprox.com.br/portfolio\n🔗 https://www.opcoesprox.com.br/historico\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n🔴 DADOS AO VIVO (TEMPO REAL)\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n✅ Preços de ativos e opções atualizados em tempo real\n✅ Visualização profissional e limpa\n⚠️ IMPORTANTE: Esta funcionalidade requer conexão com o Profit Pro (Nelogica)\n✅ O Profit Pro é o software da sua corretora — a conexão é feita via Bridge RTD\n✅ Basta ter o Profit Pro aberto e o Bridge configurado\n📥 Guia de configuração: Menu → Manual → Configuração do Bridge\n🔗 https://www.opcoesprox.com.br/dados-ao-vivo\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n🔗 Acesse a plataforma agora:\nhttps://www.opcoesprox.com.br/dashboard\n\n📖 Manual completo:\nhttps://www.opcoesprox.com.br/manual\n\n❓ Perguntas frequentes:\nhttps://www.opcoesprox.com.br/faq\n\nQualquer dúvida, estamos à disposição!\n\nBons trades! 📈\nEquipe Opções PRO X`
      },
      custom: {
        subject: '',
        body: `${namePrefix}\n\n\n\nEquipe Opções PRO X`
      }
    };

    return templates[template];
  };

  const openEmailForUser = (u: UserRow, template: EmailTemplate) => {
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
          attachment: emailAttachment,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      const sentCount = data?.sent || emailRecipients.length;
      const failedCount = data?.failed || 0;
      if (failedCount > 0) {
        toast.warning(`${sentCount} enviado(s), ${failedCount} falharam.`);
      } else {
        toast.success(`Email enviado com sucesso para ${sentCount} destinatário(s)!`);
      }
      setEmailRecipients([]);
      setEmailContextLabel('');
      setEmailSubject('');
      setEmailBody('');
      setEmailImageDataUrl(null);
      setEmailImagePreview(null);
      setEmailAttachment(null);
    } catch (err: any) {
      toast.error('Erro ao enviar email: ' + (err.message || 'Erro desconhecido'));
    } finally {
      setSendingEmail(false);
    }
  };

  const saveSettings = async () => {
    try {
      const { error } = await supabase
        .from('site_settings')
        .upsert({ 
          id: 'pro_plan', 
          value: { price: parseFloat(proPrice), annual_discount: parseFloat(annualDiscount) } 
        });
      
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

  const openBulkEmailForFiltered = (template: EmailTemplate) => {
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
            <Button variant="ghost" size="icon" onClick={async () => { await signOut(); navigate('/auth'); }} className="h-9 w-9"><LogOut className="h-4 w-4" /></Button>
          </div>
        </div>
      </header>

      <main className="container py-6 space-y-6 animate-fade-in">
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <Card className="p-4 text-center space-y-1">
            <Users className="h-5 w-5 mx-auto text-muted-foreground" />
            <p className="text-2xl font-black">{stats.total}</p>
            <p className="text-xs font-bold uppercase text-muted-foreground">Usuários</p>
          </Card>
          <Card className="p-4 text-center space-y-1 border-primary/30">
            <Crown className="h-5 w-5 mx-auto text-primary" />
            <p className="text-2xl font-black text-primary">{stats.pro}</p>
            <p className="text-xs font-bold uppercase text-muted-foreground">Planos PRO</p>
          </Card>
          <Card className="p-4 text-center space-y-1 border-warning/30">
            <Clock className="h-5 w-5 mx-auto text-warning" />
            <p className="text-2xl font-black text-warning">{stats.pending}</p>
            <p className="text-xs font-bold uppercase text-muted-foreground">Pendentes</p>
          </Card>
          <Card className="p-4 text-center space-y-1 border-destructive/30">
            <AlertTriangle className="h-5 w-5 mx-auto text-destructive" />
            <p className="text-2xl font-black text-destructive">{stats.expired}</p>
            <p className="text-xs font-bold uppercase text-muted-foreground">Vencidos</p>
          </Card>
          <Card className="p-4 text-center space-y-1">
            <TrendingUp className="h-5 w-5 mx-auto text-success" />
            <p className="text-2xl font-black">{stats.totalSims}</p>
            <p className="text-xs font-bold uppercase text-muted-foreground">Simulações</p>
          </Card>
        </div>

        <Tabs defaultValue="users" className="space-y-6">
          <TabsList className="grid w-full grid-cols-5 max-w-2xl">
            <TabsTrigger value="users" className="font-bold">Usuários</TabsTrigger>
            <TabsTrigger value="metrics" className="font-bold">Métricas</TabsTrigger>
            <TabsTrigger value="features" className="font-bold">Features</TabsTrigger>
            <TabsTrigger value="sugestoes" className="font-bold">Sugestões</TabsTrigger>
            <TabsTrigger value="api" className="font-bold">Config. API</TabsTrigger>
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
              <p className="text-xs font-bold text-muted-foreground mr-1">📧 Email em massa:</p>
              {EMAIL_TEMPLATE_OPTIONS.map(t => (
                <Button key={t.value} size="sm" variant="outline" onClick={() => openBulkEmailForFiltered(t.value)} className={cn("h-8 px-3 text-xs font-bold", t.color)}>
                  {t.icon} {t.label}
                </Button>
              ))}
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
                            "text-xs font-black",
                            u.status === 'approved' ? "text-success bg-success/10" : u.status === 'rejected' ? "text-destructive bg-destructive/10" : "text-warning bg-warning/10"
                          )}>
                            {u.status.toUpperCase()}
                          </Badge>
                          {daysRemaining !== null && (
                            <Badge variant="outline" className={cn(
                              "text-xs font-black",
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
                        <p className="text-xs font-mono text-muted-foreground/60 truncate max-w-[200px]">ID: {u.user_id}</p>
                        <div className="flex gap-3 pt-2 flex-wrap">
                          <Badge variant="secondary" className="text-xs font-bold">
                            {u.simulations_count} Simulações
                          </Badge>
                          <Badge variant="outline" className="text-xs font-bold text-muted-foreground gap-1">
                            <Calendar className="h-3 w-3" />
                            Cadastro: {new Date(u.created_at).toLocaleDateString('pt-BR')}
                          </Badge>
                          {u.purchased_at && (
                            <Badge variant="outline" className="text-xs font-bold text-primary border-primary/30 bg-primary/10 gap-1">
                              <ShoppingCart className="h-3 w-3" />
                              Compra: {new Date(u.purchased_at).toLocaleDateString('pt-BR')}
                            </Badge>
                          )}
                          {u.expires_at && (
                            <Badge variant="outline" className={cn(
                              "text-xs font-bold gap-1",
                              isExpired ? "text-destructive border-destructive/30" : "text-success border-success/30"
                            )}>
                              <Clock className="h-3 w-3" />
                              {isExpired ? 'Venceu' : 'Vence'}: {new Date(u.expires_at).toLocaleDateString('pt-BR')}
                            </Badge>
                          )}
                          <Badge variant="outline" className="text-xs font-bold text-muted-foreground/60 gap-1">
                            Atualizado: {new Date(u.updated_at).toLocaleDateString('pt-BR')}
                          </Badge>
                        </div>
                      </div>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 border-t border-border/40 pt-4">
                      <div className="space-y-1.5">
                        <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground flex items-center gap-1">
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
                            className="h-9 px-3 text-xs font-black text-primary border-primary/30 hover:bg-primary/10"
                            disabled={actionLoading === u.user_id}
                            onClick={() => {
                              const val = editingPurchaseDate[u.user_id] ?? (u.purchased_at ? new Date(u.purchased_at).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]);
                              registerPurchase(u.user_id, val);
                            }}
                          >
                            <Save className="h-3 w-3" />
                          </Button>
                        </div>
                        <p className="text-xs text-muted-foreground">Salvar registra compra + 1 mês de validade</p>
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground flex items-center gap-1">
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
                            className="h-9 px-3 text-xs font-black text-primary border-primary/30 hover:bg-primary/10"
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
                        <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground">Alterar Plano</Label>
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
                        <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground">Ações Rápidas</Label>
                        <div className="flex gap-2 flex-wrap">
                          {u.status === 'pending' || u.status === 'rejected' ? (
                            <Button size="sm" variant="outline" onClick={() => updateStatus(u.user_id, 'approved')} className="h-9 px-3 text-xs font-bold text-success border-success/30 hover:bg-success/10">
                              <CheckCircle2 className="h-3 w-3 mr-1" /> APROVAR
                            </Button>
                          ) : (
                            <Button size="sm" variant="outline" onClick={() => updateStatus(u.user_id, 'rejected')} className="h-9 px-3 text-xs font-bold text-destructive border-destructive/30 hover:bg-destructive/10">
                              <Ban className="h-3 w-3 mr-1" /> BLOQUEAR
                            </Button>
                          )}
                          <Button size="sm" variant="outline" onClick={() => resetSimulations(u.user_id)} className="h-9 px-3 text-xs font-bold hover:bg-primary/10">
                            <RotateCcw className="h-3 w-3 mr-1" /> RESET
                          </Button>
                        </div>
                      </div>
                    </div>

                    {/* Email actions row */}
                    <div className="border-t border-border/40 pt-4">
                      <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground flex items-center gap-1 mb-2">
                        <Send className="h-3 w-3" /> Enviar Email para {u.display_name}
                      </Label>
                      <div className="flex gap-2 flex-wrap">
                        {EMAIL_TEMPLATE_OPTIONS.map(t => (
                          <Button key={t.value} size="sm" variant="outline" onClick={() => openEmailForUser(u, t.value)} className={cn("h-8 px-3 text-xs font-bold", t.color)}>
                            {t.icon} {t.label}
                          </Button>
                        ))}
                      </div>
                    </div>
                  </div>
                </Card>
              );
              })}
            </div>
          </TabsContent>

          {/* METRICS TAB */}
          <TabsContent value="metrics" className="space-y-6">
            <MetricsPanel users={users} proPrice={parseFloat(proPrice)} />
          </TabsContent>

          <TabsContent value="features" className="space-y-6">
            <Card className="border-primary/20">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="h-5 w-5 text-primary" />
                  Feature Flags
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {[
                  { key: 'feature-collar-tracker', label: 'Collar Tracker', desc: 'Aba de rastreamento de Collar em tempo real', icon: <Shield className="h-5 w-5 text-primary" /> },
                  { key: 'feature-box-tracker', label: 'Box Tracker', desc: 'Rastreador de Box Spread vs CDI', icon: <BarChart3 className="h-5 w-5 text-primary" /> },
                  { key: 'feature-calc-cdi', label: 'Calculadora CDI', desc: 'Calculadora CDI x Opções', icon: <DollarSign className="h-5 w-5 text-primary" /> },
                  { key: 'feature-diversificador', label: 'Diversificador', desc: 'Diversificador de estratégias', icon: <Layers className="h-5 w-5 text-primary" /> },
                  { key: 'feature-dados-ao-vivo', label: 'Dados ao Vivo', desc: 'Dados de mercado em tempo real via RTD', icon: <Activity className="h-5 w-5 text-primary" /> },
                ].map(flag => (
                  <div key={flag.key} className="flex items-center justify-between p-4 rounded-lg border border-border bg-muted/20">
                    <div className="flex items-center gap-3">
                      {flag.icon}
                      <div>
                        <p className="font-bold text-sm">{flag.label}</p>
                        <p className="text-xs text-muted-foreground">{flag.desc}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        const current = featureFlags[flag.key] ?? true;
                        const newVal = !current;
                        localStorage.setItem(flag.key, newVal ? 'true' : 'false');
                        setFeatureFlags(prev => ({ ...prev, [flag.key]: newVal }));
                        toast.success(`${flag.label} ${newVal ? 'ativado' : 'desativado'}!`);
                        window.dispatchEvent(new Event('storage'));
                      }}
                      className={cn(
                        "px-4 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all",
                        featureFlags[flag.key]
                          ? "bg-success text-success-foreground shadow-[0_0_12px_hsl(var(--success)/0.4)]"
                          : "bg-destructive text-destructive-foreground"
                      )}
                    >
                      {featureFlags[flag.key] ? 'ATIVO' : 'DESATIVADO'}
                    </button>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card className="border-primary/20">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Download className="h-5 w-5 text-primary" />
                  Gerar PDF da Landing Page
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Gere um catálogo profissional em PDF com todas as capturas de tela e funcionalidades da plataforma. Ideal para enviar a potenciais clientes e parceiros.
                </p>
                <Button 
                  onClick={async () => {
                    try {
                      toast.info('Gerando PDF com imagens da landing page...');
                      const { generateLandingPagePdf } = await import('@/lib/pdf-generator');
                      const imgs = await import('@/pages/AdminPanelImages');
                      await generateLandingPagePdf(imgs.landingImages);
                      toast.success('Catálogo PDF baixado!');
                    } catch (err: any) {
                      console.error('Erro ao gerar catálogo:', err);
                      toast.error(`Erro ao gerar PDF: ${err?.message || 'desconhecido'}`);
                    }
                  }}
                  className="w-full h-12 font-black"
                >
                  <Download className="mr-2 h-5 w-5" /> GERAR CATÁLOGO PDF
                </Button>
              </CardContent>
            </Card>
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
                    <Input type="number" step="0.01" value={proPrice} onChange={e => setProPrice(e.target.value)} placeholder="14.90" className="font-mono text-lg font-bold" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-xs font-black uppercase tracking-widest">Desconto Anual (%)</Label>
                      <Input 
                        type="number" step="1" min="0" max="99" 
                        value={annualDiscount} 
                        onChange={e => setAnnualDiscount(e.target.value)} 
                        placeholder="20" 
                        className="font-mono text-lg font-bold" 
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-black uppercase tracking-widest">Parcela Mensal Equiv. (R$)</Label>
                      <Input 
                        type="number" step="0.01" 
                        value={(parseFloat(proPrice) * (1 - parseFloat(annualDiscount || '0') / 100)).toFixed(2)}
                        onChange={e => {
                          const equiv = parseFloat(e.target.value);
                          const monthly = parseFloat(proPrice);
                          if (monthly > 0 && equiv > 0) {
                            setAnnualDiscount(((1 - equiv / monthly) * 100).toFixed(0));
                          }
                        }}
                        placeholder="11.92" 
                        className="font-mono text-lg font-bold" 
                      />
                    </div>
                  </div>
                  <div className="rounded-lg border border-success/30 bg-success/5 p-3">
                    <p className="text-xs text-muted-foreground">
                      <span className="font-bold text-success">Valor Anual:</span>{' '}
                      R$ {(parseFloat(proPrice) * 12 * (1 - parseFloat(annualDiscount || '0') / 100)).toFixed(2)}{' '}
                      <span className="text-muted-foreground/60">(equivalente a R$ {(parseFloat(proPrice) * (1 - parseFloat(annualDiscount || '0') / 100)).toFixed(2)}/mês)</span>
                    </p>
                  </div>
                  <p className="text-xs text-muted-foreground">Estes valores serão exibidos na Landing Page, página de Upgrade e no checkout.</p>
                </CardContent>
              </Card>
            </div>
            <div className="pt-4">
              <Button onClick={saveSettings} className="w-full h-12 font-black shadow-lg shadow-primary/30">
                <Save className="mr-2 h-5 w-5" /> SALVAR TODAS AS CONFIGURAÇÕES
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="sugestoes" className="space-y-6">
            <SugestoesPanel />
          </TabsContent>
        </Tabs>
      </main>

      {/* Email Modal */}
      {emailRecipients.length > 0 && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setEmailRecipients([])}>
          <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Send className="h-5 w-5 text-primary" />
                Enviar Email em Massa
              </CardTitle>
              <p className="text-xs text-muted-foreground">{emailContextLabel}</p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label className="text-xs font-black uppercase">Trocar Modelo</Label>
                <div className="flex flex-wrap gap-1.5">
                  {EMAIL_TEMPLATE_OPTIONS.map(t => (
                    <button
                      key={t.value}
                      onClick={() => {
                        const data = buildEmailTemplate(t.value);
                        setEmailSubject(data.subject);
                        setEmailBody(data.body);
                      }}
                      className={cn("px-2.5 py-1 rounded-md border text-xs font-bold transition-all", t.color)}
                    >
                      {t.icon} {t.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-black uppercase">Assunto</Label>
                <Input value={emailSubject} onChange={e => setEmailSubject(e.target.value)} placeholder="Assunto do email..." />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-black uppercase">Mensagem</Label>
                <Textarea value={emailBody} onChange={e => setEmailBody(e.target.value)} rows={8} placeholder="Corpo do email..." className="text-sm" />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-black uppercase flex items-center gap-1">
                  <ImageIcon className="h-3 w-3" /> Imagem Promocional (opcional)
                </Label>
                {emailImagePreview ? (
                  <div className="relative inline-block">
                    <img src={emailImagePreview} alt="Preview" className="max-h-40 rounded-lg border border-border/40" />
                    <button
                      onClick={() => { setEmailImageDataUrl(null); setEmailImagePreview(null); }}
                      className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center text-xs hover:scale-110 transition-transform"
                    >
                      ✕
                    </button>
                  </div>
                ) : (
                  <label className="flex items-center gap-2 cursor-pointer rounded-lg border-2 border-dashed border-primary/30 hover:border-primary/50 bg-primary/5 p-4 transition-colors">
                    <Upload className="h-5 w-5 text-primary" />
                    <span className="text-sm text-muted-foreground">Clique para enviar uma imagem</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        const preview = URL.createObjectURL(file);
                        setEmailImagePreview(preview);
                        const reader = new FileReader();
                        reader.onload = (ev) => {
                          setEmailImageDataUrl(ev.target?.result as string);
                        };
                        reader.readAsDataURL(file);
                      }}
                    />
                  </label>
                )}
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-black uppercase flex items-center gap-1">
                  <Paperclip className="h-3 w-3" /> Arquivo Anexo (opcional)
                </Label>
                {emailAttachment ? (
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/30 border border-border/50">
                    <FileText className="h-4 w-4 text-primary shrink-0" />
                    <span className="text-sm truncate flex-1">{emailAttachment.name}</span>
                    <button
                      onClick={() => setEmailAttachment(null)}
                      className="h-6 w-6 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center text-xs hover:scale-110 transition-transform shrink-0"
                    >
                      ✕
                    </button>
                  </div>
                ) : (
                  <label className="flex items-center gap-2 cursor-pointer rounded-lg border-2 border-dashed border-primary/30 hover:border-primary/50 bg-primary/5 p-4 transition-colors">
                    <Paperclip className="h-5 w-5 text-primary" />
                    <span className="text-sm text-muted-foreground">Clique para anexar um arquivo (PDF, DOC, etc. - max 10MB)</span>
                    <input
                      type="file"
                      accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.zip"
                      className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        if (file.size > 10 * 1024 * 1024) {
                          const { toast } = await import('sonner');
                          toast.error('Arquivo muito grande. Máximo 10MB.');
                          return;
                        }
                        const reader = new FileReader();
                        reader.onload = (ev) => {
                          const base64 = (ev.target?.result as string).split(',')[1];
                          setEmailAttachment({ name: file.name, content: base64, type: file.type });
                        };
                        reader.readAsDataURL(file);
                      }}
                    />
                  </label>
                )}
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => { setEmailRecipients([]); setEmailImageDataUrl(null); setEmailImagePreview(null); setEmailAttachment(null); }}>Cancelar</Button>
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
