import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { MessageSquarePlus, Send, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

export default function SuggestionWidget() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [mensagem, setMensagem] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async () => {
    if (!user) {
      toast.error('Faça login para enviar.');
      navigate('/auth');
      return;
    }
    if (!mensagem.trim()) return;
    setSending(true);
    const { error } = await supabase.from('sugestoes' as any).insert({
      user_id: user.id,
      mensagem: mensagem.trim(),
      tipo: 'sugestao',
    } as any);
    setSending(false);
    if (error) {
      toast.error('Erro ao enviar. Tente novamente.');
    } else {
      setSent(true);
      setMensagem('');
      toast.success('Sugestão enviada! Obrigado!');
      setTimeout(() => setSent(false), 3000);
    }
  };

  return (
    <div className="w-full max-w-lg mx-auto rounded-xl border border-border/50 bg-card/50 backdrop-blur-sm p-4 space-y-3">
      <div className="flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
          <MessageSquarePlus className="h-4 w-4 text-primary" />
        </div>
        <div>
          <p className="text-sm font-bold text-foreground">Deixe sua sugestão</p>
          <p className="text-[10px] text-muted-foreground">Ajude-nos a melhorar o sistema</p>
        </div>
      </div>
      <Textarea
        placeholder="Sua ideia, melhoria ou feedback..."
        value={mensagem}
        onChange={(e) => setMensagem(e.target.value)}
        rows={2}
        maxLength={500}
        className="resize-none text-sm bg-background/50"
      />
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-muted-foreground">{mensagem.length}/500</span>
        <Button
          size="sm"
          onClick={handleSubmit}
          disabled={sending || !mensagem.trim()}
          className="gap-1.5 text-xs font-bold"
        >
          {sent ? (
            <>
              <CheckCircle className="h-3.5 w-3.5" />
              Enviado!
            </>
          ) : (
            <>
              <Send className="h-3.5 w-3.5" />
              {sending ? 'Enviando...' : 'Enviar'}
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
