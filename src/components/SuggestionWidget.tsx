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
  const [open, setOpen] = useState(false);
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
      setTimeout(() => { setSent(false); setOpen(false); }, 2500);
    }
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary transition-colors"
      >
        <MessageSquarePlus className="h-3.5 w-3.5" />
        Deixe sua sugestão
      </button>
    );
  }

  return (
    <div className="w-full max-w-md mx-auto space-y-2 animate-fade-in">
      <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <MessageSquarePlus className="h-4 w-4 text-primary" />
        Deixe sua sugestão
      </div>
      <Textarea
        placeholder="Sua ideia ou melhoria..."
        value={mensagem}
        onChange={(e) => setMensagem(e.target.value)}
        rows={2}
        maxLength={500}
        className="resize-none text-sm"
      />
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-muted-foreground">{mensagem.length}/500</span>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={() => setOpen(false)} className="text-xs">
            Cancelar
          </Button>
          <Button size="sm" onClick={handleSubmit} disabled={sending || !mensagem.trim()} className="gap-1 text-xs">
            {sent ? <><CheckCircle className="h-3 w-3" /> Enviado!</> : <><Send className="h-3 w-3" /> {sending ? '...' : 'Enviar'}</>}
          </Button>
        </div>
      </div>
    </div>
  );
}
