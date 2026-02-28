import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { TrendingUp, Clock, XCircle, AlertTriangle, LogOut } from 'lucide-react';
import { useAccessControl } from '@/hooks/useAccessControl';

interface AccessBlockedProps {
  status: 'pending' | 'rejected' | 'expired';
}

export default function AccessBlocked({ status }: AccessBlockedProps) {
  const { signOut } = useAuth();

  const content = {
    pending: {
      icon: <Clock className="h-16 w-16 text-warning" />,
      title: 'Acesso Pendente',
      description: 'Sua conta foi criada com sucesso! Aguarde a aprovação do administrador para acessar a plataforma.',
      color: 'border-warning/30',
    },
    rejected: {
      icon: <XCircle className="h-16 w-16 text-destructive" />,
      title: 'Acesso Negado',
      description: 'Seu acesso foi negado pelo administrador. Entre em contato para mais informações.',
      color: 'border-destructive/30',
    },
    expired: {
      icon: <AlertTriangle className="h-16 w-16 text-warning" />,
      title: 'Período Expirado',
      description: 'Seu período de acesso expirou. Entre em contato com o administrador para renovar.',
      color: 'border-warning/30',
    },
  };

  const c = content[status];

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <div className="flex justify-center mb-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary shadow-[0_0_24px_-4px_hsl(var(--primary)/0.5)]">
              <TrendingUp className="h-6 w-6 text-primary-foreground" />
            </div>
          </div>
          <h1 className="text-xl font-bold">OpçõesX</h1>
        </div>

        <Card className={`${c.color} bg-card/50 backdrop-blur-sm`}>
          <CardContent className="py-12 text-center space-y-4">
            <div className="flex justify-center">{c.icon}</div>
            <h2 className="text-xl font-bold">{c.title}</h2>
            <p className="text-sm text-muted-foreground leading-relaxed max-w-xs mx-auto">
              {c.description}
            </p>
          </CardContent>
        </Card>

        <div className="text-center">
          <Button variant="ghost" onClick={signOut} className="text-sm">
            <LogOut className="mr-2 h-4 w-4" />
            Sair da conta
          </Button>
        </div>
      </div>
    </div>
  );
}
