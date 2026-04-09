import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Mail, MessageSquarePlus, Send, CheckCircle, Headphones } from 'lucide-react';
import { toast } from 'sonner';
import Header from '@/components/Header';
import { ProfessionalHeader } from '@/components/ProfessionalLayout';

export default function Suporte() {
  const { user } = useAuth();
  const [mensagem, setMensagem] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async () => {
    if (!mensagem.trim()) {
      toast.error('Digite sua sugestão antes de enviar.');
      return;
    }
    if (!user) {
      toast.error('Faça login para enviar sua sugestão.');
      return;
    }
    setSending(true);
    const { error } = await supabase.from('sugestoes' as any).insert({
      user_id: user.id,
      mensagem: mensagem.trim(),
      tipo: 'sugestao',
    } as any);
    setSending(false);
    if (error) {
      toast.error('Erro ao enviar sugestão. Tente novamente.');
    } else {
      setSent(true);
      setMensagem('');
      toast.success('Sugestão enviada com sucesso! Obrigado pelo feedback.');
      setTimeout(() => setSent(false), 4000);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container py-8 space-y-8">
        <ProfessionalHeader title="Suporte" subtitle="Entre em contato ou deixe sua sugestão para melhorias" />
        <div className="grid gap-6 md:grid-cols-2 max-w-4xl mx-auto">
          {/* Card: Falar por E-mail */}
          <Card className="border-2 border-primary/20 hover:border-primary/40 transition-all">
            <CardHeader className="text-center pb-2">
              <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
                <Mail className="h-7 w-7 text-primary" />
              </div>
              <CardTitle className="text-lg">Falar Comigo</CardTitle>
              <CardDescription>Entre em contato por e-mail</CardDescription>
            </CardHeader>
            <CardContent className="text-center space-y-4">
              <p className="text-sm text-muted-foreground">
                Envie dúvidas, problemas ou solicite suporte direto pelo e-mail. Responderemos o mais rápido possível.
              </p>
              <Button asChild className="w-full gap-2 font-bold">
                <a href="mailto:contato@opcoesprox.com.br">
                  <Mail className="h-4 w-4" />
                  contato@opcoesprox.com.br
                </a>
              </Button>
            </CardContent>
          </Card>

          {/* Card: Deixe sua Sugestão */}
          <Card className="border-2 border-accent/20 hover:border-accent/40 transition-all">
            <CardHeader className="text-center pb-2">
              <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-accent/20">
                <MessageSquarePlus className="h-7 w-7 text-accent-foreground" />
              </div>
              <CardTitle className="text-lg">Deixe sua Sugestão</CardTitle>
              <CardDescription>Ajude-nos a melhorar o sistema</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea
                placeholder="Escreva aqui sua sugestão, ideia ou melhoria que gostaria de ver no sistema..."
                value={mensagem}
                onChange={(e) => setMensagem(e.target.value)}
                rows={4}
                maxLength={1000}
                className="resize-none"
              />
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">{mensagem.length}/1000</span>
                <Button
                  onClick={handleSubmit}
                  disabled={sending || !mensagem.trim()}
                  className="gap-2 font-bold"
                >
                  {sent ? (
                    <>
                      <CheckCircle className="h-4 w-4" />
                      Enviado!
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4" />
                      {sending ? 'Enviando...' : 'Enviar Sugestão'}
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
