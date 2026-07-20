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
import { EMAIL_TEMPLATE_OPTIONS, buildEmailTemplate, type EmailTemplate } from '@/pages/admin/email-templates';
import {
  TrendingUp, Users, CheckCircle2, XCircle, Clock, Shield,
  Loader2, LogOut, Sun, Moon, RefreshCw, Search, Crown, Wallet,
  ArrowLeft, LayoutDashboard, Ban, RotateCcw, Calendar, Settings, Key, Save, User, Mail, DollarSign, AlertTriangle, CalendarClock, ShoppingCart, Send, Upload, Image as ImageIcon, BarChart3, Activity, Layers, Download, Paperclip, FileText, Trash2, CheckCheck, CircleDot
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
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [sendingReply, setSendingReply] = useState(false);
  const [expandedHistory, setExpandedHistory] = useState<string | null>(null);
  const [filterResolved, setFilterResolved] = useState<'all' | 'resolved' | 'pending'>('all');

  const fetchSugestoes = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('sugestoes' as any)
      .select('*')
      .order('created_at', { ascending: false });
    if (!error && data) {
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

  useEffect(() => { fetchSugestoes(); }, []);

  const handleReply = async (s: any) => {
    if (!replyText.trim() || !s.profile?.email) return;
    setSendingReply(true);
    try {
      // Check if user is PRO to conditionally hide CTA
      const { data: accessData } = await supabase
        .from('user_access')
        .select('plan_type, status, expires_at')
        .eq('user_id', s.user_id)
        .maybeSingle();

      const isPro = accessData?.plan_type === 'pro' && accessData?.status === 'approved' && 
        (!accessData?.expires_at || new Date(accessData.expires_at) > new Date());

      const { error } = await supabase.functions.invoke('send-admin-email', {
        body: {
          to: s.profile.email,
          subject: 'Resposta à sua sugestão — OpçõesProX',
          hideCta: isPro,
          body: `
            <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;background:#f8fafc;border-radius:12px;">
              <h2 style="color:#1e40af;margin-bottom:16px;">Olá, ${s.profile.display_name || 'Usuário'}!</h2>
              <p style="color:#475569;font-size:14px;">Recebemos sua sugestão e gostaríamos de responder:</p>
              <div style="background:#e2e8f0;border-radius:8px;padding:12px;margin:16px 0;font-size:13px;color:#334155;">
                <strong>Sua mensagem:</strong><br/>${s.mensagem}
              </div>
              <div style="background:#ffffff;border:1px solid #cbd5e1;border-radius:8px;padding:12px;margin:16px 0;font-size:14px;color:#1e293b;">
                <strong>Nossa resposta:</strong><br/>${replyText.replace(/\n/g, '<br/>')}
              </div>
              <p style="color:#64748b;font-size:12px;margin-top:24px;">Equipe OpçõesProX</p>
            </div>
          `,
        },
      });
      if (error) throw error;

      // Save reply to history
      const currentHistory = Array.isArray(s.reply_history) ? s.reply_history : [];
      const newEntry = { text: replyText, date: new Date().toISOString() };
      const updatedHistory = [...currentHistory, newEntry];

      await supabase
        .from('sugestoes' as any)
        .update({ reply_history: updatedHistory, resolved: true } as any)
        .eq('id', s.id);

      toast.success(`Resposta enviada para ${s.profile.email}`);
      setReplyingTo(null);
      setReplyText('');
      fetchSugestoes();
    } catch (err: any) {
      toast.error('Erro ao enviar resposta: ' + (err.message || 'Tente novamente'));
    }
    setSendingReply(false);
  };

  const toggleResolved = async (s: any) => {
    const newResolved = !s.resolved;
    await supabase
      .from('sugestoes' as any)
      .update({ resolved: newResolved } as any)
      .eq('id', s.id);
    toast.success(newResolved ? 'Marcada como resolvida' : 'Marcada como pendente');
    fetchSugestoes();
  };

  const clearHistory = async (s: any) => {
    if (!confirm('Tem certeza que deseja apagar o histórico de respostas?')) return;
    await supabase
      .from('sugestoes' as any)
      .update({ reply_history: [] } as any)
      .eq('id', s.id);
    toast.success('Histórico apagado');
    fetchSugestoes();
  };

  const filteredSugestoes = sugestoes.filter(s => {
    if (filterResolved === 'resolved') return s.resolved;
    if (filterResolved === 'pending') return !s.resolved;
    return true;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h3 className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
          <Mail className="h-4 w-4 text-primary" /> Sugestões dos Clientes
        </h3>
        <div className="flex items-center gap-2">
          <Select value={filterResolved} onValueChange={(v: any) => setFilterResolved(v)}>
            <SelectTrigger className="h-7 text-xs w-[130px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas ({sugestoes.length})</SelectItem>
              <SelectItem value="pending">Pendentes ({sugestoes.filter(s => !s.resolved).length})</SelectItem>
              <SelectItem value="resolved">Resolvidas ({sugestoes.filter(s => s.resolved).length})</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {filteredSugestoes.length === 0 ? (
        <Card className="border-border/40">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Mail className="h-10 w-10 text-muted-foreground mb-3" />
            <p className="text-sm font-bold text-muted-foreground">
              {filterResolved === 'all' ? 'Nenhuma sugestão recebida ainda' : `Nenhuma sugestão ${filterResolved === 'resolved' ? 'resolvida' : 'pendente'}`}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredSugestoes.map((s: any) => {
            const history = Array.isArray(s.reply_history) ? s.reply_history : [];
            const isExpanded = expandedHistory === s.id;

            return (
              <Card key={s.id} className={cn(
                "border-border/40 hover:border-primary/30 transition-all",
                s.resolved && "border-green-500/30 bg-green-500/5"
              )}>
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
                        <Badge
                          variant={s.resolved ? 'default' : 'outline'}
                          className={cn(
                            "text-[10px] font-bold cursor-pointer select-none",
                            s.resolved ? "bg-green-600 hover:bg-green-700 text-white" : "text-orange-500 border-orange-500/40 hover:bg-orange-500/10"
                          )}
                          onClick={() => toggleResolved(s)}
                        >
                          {s.resolved ? <><CheckCheck className="h-3 w-3 mr-1" /> Resolvida</> : <><CircleDot className="h-3 w-3 mr-1" /> Pendente</>}
                        </Badge>
                      </div>
                      <p className="text-sm text-foreground leading-relaxed bg-muted/30 rounded-lg p-3 border border-border/30">
                        {s.mensagem}
                      </p>

                      {/* Reply History */}
                      {history.length > 0 && (
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-[11px] gap-1 h-6 px-2 text-muted-foreground hover:text-foreground"
                              onClick={() => setExpandedHistory(isExpanded ? null : s.id)}
                            >
                              <Clock className="h-3 w-3" />
                              {history.length} resposta{history.length > 1 ? 's' : ''} enviada{history.length > 1 ? 's' : ''}
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-[11px] gap-1 h-6 px-2 text-destructive hover:text-destructive hover:bg-destructive/10"
                              onClick={() => clearHistory(s)}
                            >
                              <Trash2 className="h-3 w-3" />
                              Apagar histórico
                            </Button>
                          </div>
                          {isExpanded && (
                            <div className="space-y-2 pl-2 border-l-2 border-primary/20 ml-1">
                              {history.map((h: any, i: number) => (
                                <div key={i} className="text-xs bg-primary/5 rounded-md p-2.5 border border-primary/10">
                                  <p className="text-foreground whitespace-pre-wrap">{h.text}</p>
                                  <p className="text-[10px] text-muted-foreground mt-1">
                                    {new Date(h.date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })} às{' '}
                                    {new Date(h.date).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                  </p>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Reply Section */}
                      {replyingTo === s.id ? (
                        <div className="space-y-2 pt-1">
                          <Textarea
                            placeholder="Escreva sua resposta ao cliente..."
                            value={replyText}
                            onChange={(e) => setReplyText(e.target.value)}
                            rows={3}
                            className="resize-none text-sm bg-background/50"
                          />
                          <div className="flex gap-2 justify-end">
                            <Button size="sm" variant="ghost" className="text-xs" onClick={() => { setReplyingTo(null); setReplyText(''); }}>
                              Cancelar
                            </Button>
                            <Button size="sm" className="text-xs gap-1.5 font-bold" onClick={() => handleReply(s)} disabled={sendingReply || !replyText.trim()}>
                              {sendingReply ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
                              {sendingReply ? 'Enviando...' : 'Enviar Resposta'}
                            </Button>
                          </div>
                        </div>
                      ) : (
                        s.profile?.email && (
                          <Button size="sm" variant="outline" className="text-xs gap-1.5 mt-1" onClick={() => setReplyingTo(s.id)}>
                            <Send className="h-3 w-3" />
                            Responder
                          </Button>
                        )
                      )}
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
            );
          })}
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

  const openWinbackEmail = () => {
    const now = new Date();
    const recipients = users
      .filter(u => u.plan_type === 'pro' && u.expires_at && new Date(u.expires_at) < now)
      .map(u => u.email)
      .filter((email): email is string => Boolean(email && email.includes('@')));

    if (!recipients.length) {
      toast.error('Nenhum cliente PRO expirado com e-mail válido');
      return;
    }

    const templateData = buildEmailTemplate('winback');
    setEmailRecipients(recipients);
    setEmailContextLabel(`💜 Win-back: ${recipients.length} cliente(s) PRO expirado(s)`);
    setEmailSubject(templateData.subject);
    setEmailBody(templateData.body);
  };

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
              <Button size="sm" variant="outline" onClick={openWinbackEmail} className="h-8 px-3 text-xs font-bold border-purple-400/50 text-purple-400 hover:bg-purple-400/10">
                💜 Win-back PROs expirados
              </Button>
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
                <CardContent className="space-y-2">
                  <p className="text-sm text-muted-foreground">
                    As credenciais do Mercado Pago são configuradas como secrets no painel do Supabase
                    (<span className="font-mono text-xs">MP_ACCESS_TOKEN</span> e <span className="font-mono text-xs">MP_WEBHOOK_SECRET</span>),
                    em Edge Functions → Secrets. Elas nunca ficam no banco nem no código.
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Status: checkout e webhook ativos usando os secrets configurados.
                  </p>
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
