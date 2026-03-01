import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Navigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { TrendingUp, Loader2, MailCheck } from 'lucide-react';
import { Separator } from '@/components/ui/separator';

export default function Auth() {
  const { user, loading, signIn, signUp, signInWithGoogle } = useAuth();
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);

  if (loading) return null;
  if (user) return <Navigate to="/dashboard" replace />;

  if (showConfirmation) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md animate-fade-in border-2">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-primary shadow-[0_0_20px_-4px_hsl(var(--primary)/0.6)]">
              <MailCheck className="h-7 w-7 text-primary-foreground" />
            </div>
            <CardTitle className="text-2xl font-black tracking-tight">Verifique seu e-mail</CardTitle>
            <CardDescription className="font-medium text-base mt-2">
              Enviamos um link de confirmação para <strong className="text-foreground">{email}</strong>. 
              Clique no link para ativar sua conta.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground text-center">
              Não recebeu? Verifique sua pasta de spam ou tente novamente.
            </p>
            <Button variant="outline" className="w-full" onClick={() => setShowConfirmation(false)}>
              Voltar ao login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (isSignUp) {
        const { error } = await signUp(email, password, name);
        if (error) throw error;
        setShowConfirmation(true);
      } else {
        const { error } = await signIn(email, password);
        if (error) throw error;
      }
    } catch (err: any) {
      toast.error(err.message || 'Erro na autenticação');
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogleLogin = async () => {
    setGoogleLoading(true);
    try {
      const { error } = await signInWithGoogle();
      if (error) throw error;
    } catch (err: any) {
      toast.error('Erro ao entrar com Google');
      setGoogleLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      {googleLoading && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background/80 backdrop-blur-sm">
          <Loader2 className="h-10 w-10 animate-spin text-primary mb-4" />
          <p className="text-lg font-bold text-foreground">Entrando com Google...</p>
          <p className="text-sm text-muted-foreground mt-1">Você será redirecionado em instantes</p>
        </div>
      )}
      <Card className="w-full max-w-md animate-fade-in border-2">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-primary shadow-[0_0_20px_-4px_hsl(var(--primary)/0.6)]">
            <TrendingUp className="h-7 w-7 text-primary-foreground" />
          </div>
          <CardTitle className="text-2xl font-black tracking-tight">OpçõesX</CardTitle>
          <CardDescription className="font-medium">
            {isSignUp ? 'Crie sua conta para começar' : 'Entre na sua conta'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <Button 
            variant="outline" 
            className="w-full h-11 font-bold gap-2 border-border/60 hover:bg-muted/50"
            onClick={handleGoogleLogin}
            disabled={googleLoading}
          >
            {googleLoading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <svg className="h-5 w-5" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.66l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
              </svg>
            )}
            {googleLoading ? 'Redirecionando...' : 'Entrar com Google'}
          </Button>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <Separator />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground font-bold">Ou use seu e-mail</span>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {isSignUp && (
              <div className="space-y-2">
                <Label htmlFor="name">Nome</Label>
                <Input id="name" value={name} onChange={e => setName(e.target.value)} placeholder="Seu nome" className="h-11" />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="seu@email.com" className="h-11" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <Input id="password" type="password" required minLength={6} value={password} onChange={e => setPassword(e.target.value)} placeholder="Mínimo 6 caracteres" className="h-11" />
            </div>
            <Button type="submit" className="w-full h-11 font-black text-base shadow-lg shadow-primary/20" disabled={submitting}>
              {submitting ? 'Carregando...' : isSignUp ? 'Criar Conta' : 'Entrar'}
            </Button>
          </form>
          {isSignUp && (
            <p className="text-xs text-center text-muted-foreground">
              🎁 Ao criar sua conta, você ganha <strong className="text-primary">3 simulações gratuitas</strong> para testar a plataforma!
            </p>
          )}
          <div className="text-center text-sm text-muted-foreground font-medium">
            {isSignUp ? 'Já tem conta?' : 'Não tem conta?'}{' '}
            <button onClick={() => setIsSignUp(!isSignUp)} className="text-primary font-bold hover:underline">
              {isSignUp ? 'Entrar' : 'Criar conta'}
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
