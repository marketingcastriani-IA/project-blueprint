import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Navigate, useNavigate } from 'react-router-dom';
import Header from '@/components/Header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, Lock, Mail, LogOut, Shield, Database, CheckCircle2, XCircle } from 'lucide-react';

export default function Settings() {
  const { user, loading: authLoading, signOut } = useAuth();
  const navigate = useNavigate();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [dbStatus, setDbStatus] = useState<'idle' | 'testing' | 'connected' | 'error'>('idle');

  const testConnection = async () => {
    setDbStatus('testing');
    try {
      // Tenta uma consulta simples na tabela de perfis
      const { error } = await supabase.from('profiles').select('id').limit(1);
      if (error) throw error;
      
      setDbStatus('connected');
      toast.success('Conexão com Supabase estabelecida com sucesso!');
    } catch (err: any) {
      setDbStatus('error');
      toast.error('Erro ao conectar com o banco de dados', {
        description: err.message
      });
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword || !confirmPassword) {
      toast.error('Preencha todos os campos');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('As senhas não conferem');
      return;
    }
    if (newPassword.length < 6) {
      toast.error('A senha deve ter pelo menos 6 caracteres');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });
      if (error) throw error;
      toast.success('Senha alterada com sucesso!');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      toast.error('Erro ao alterar senha', {
        description: err.message || 'Tente novamente',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut();
      navigate('/auth');
      toast.success('Desconectado com sucesso');
    } catch (err: any) {
      toast.error('Erro ao desconectar', {
        description: err.message || 'Tente novamente',
      });
    }
  };

  if (authLoading) return null;
  if (!user) return <Navigate to="/auth" replace />;

  return (
    <div className="min-h-screen bg-background pb-16">
      <Header />
      <main className="container py-6 space-y-6 animate-fade-in">
        <div className="space-y-2">
          <h1 className="text-4xl sm:text-5xl font-black tracking-tight">Configurações</h1>
          <p className="text-lg text-muted-foreground">Gerencie sua conta e preferências</p>
        </div>

        {/* Database Connection Test */}
        <Card className="border-2 border-info/30 bg-gradient-to-br from-info/[0.08] to-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5 text-info" />
              Status do Sistema
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50 border border-muted-foreground/20">
              <div className="space-y-1">
                <p className="text-sm font-bold">Conexão com Banco de Dados</p>
                <p className="text-xs text-muted-foreground">Verifique a integridade da conexão com o Supabase</p>
              </div>
              <div className="flex items-center gap-3">
                {dbStatus === 'connected' && (
                  <Badge className="bg-success/20 text-success border-success/30 gap-1">
                    <CheckCircle2 className="h-3 w-3" /> Conectado
                  </Badge>
                )}
                {dbStatus === 'error' && (
                  <Badge className="bg-destructive/20 text-destructive border-destructive/30 gap-1">
                    <XCircle className="h-3 w-3" /> Erro
                  </Badge>
                )}
                <Button 
                  size="sm" 
                  variant="outline" 
                  onClick={testConnection}
                  disabled={dbStatus === 'testing'}
                >
                  {dbStatus === 'testing' ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Testar Agora'}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Account Info */}
        <Card className="border-2 border-primary/30 bg-gradient-to-br from-primary/[0.08] to-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5 text-primary" />
              Informações da Conta
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Email</Label>
              <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-muted/50 border border-muted-foreground/20">
                <p className="text-sm font-medium flex-1">{user.email}</p>
                <Badge className="bg-success/20 text-success border-success/30 text-xs">Verificado</Badge>
              </div>
            </div>
            <div className="space-y-2">
              <Label>ID da Conta</Label>
              <div className="px-4 py-2 rounded-lg bg-muted/50 border border-muted-foreground/20">
                <p className="text-xs font-mono text-muted-foreground">{user.id}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Change Password */}
        <Card className="border-2 border-warning/30 bg-gradient-to-br from-warning/[0.08] to-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5 text-warning" />
              Alterar Senha
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleChangePassword} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="new-password">Nova Senha</Label>
                <Input
                  id="new-password"
                  type="password"
                  placeholder="Mínimo 6 caracteres"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  disabled={loading}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-password">Confirmar Senha</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  placeholder="Confirme a nova senha"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  disabled={loading}
                />
              </div>
              <Button type="submit" disabled={loading} className="w-full">
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Shield className="mr-2 h-4 w-4" />}
                Alterar Senha
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card className="border-2 border-destructive/30 bg-gradient-to-br from-destructive/[0.08] to-card">
          <CardHeader>
            <CardTitle className="text-destructive">Zona de Perigo</CardTitle>
          </CardHeader>
          <CardContent>
            <Button onClick={handleLogout} variant="destructive" className="w-full">
              <LogOut className="mr-2 h-4 w-4" />
              Desconectar
            </Button>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}