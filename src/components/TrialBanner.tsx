import { useState } from 'react';
import { useAccessControl } from '@/hooks/useAccessControl';
import { useProPrice } from '@/hooks/useProPrice';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Crown, Loader2, Timer } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

/**
 * Faixa fixa exibida durante o teste grátis (plano free aprovado com vencimento).
 * Some para PRO, admin e contas sem expiração.
 */
export default function TrialBanner() {
  const access = useAccessControl();
  const { proPrice } = useProPrice();
  const [upgrading, setUpgrading] = useState(false);

  const isTrial =
    !access.isAdmin &&
    access.status === 'approved' &&
    access.planType === 'free' &&
    access.daysRemaining !== null;

  if (!isTrial) return null;

  const days = access.daysRemaining as number;
  const urgent = days <= 2;

  const handleUpgrade = async () => {
    setUpgrading(true);
    try {
      const { data, error } = await supabase.functions.invoke('mercado-pago-checkout', {
        body: { plan_period: 'monthly' },
      });
      if (error || !data?.url) {
        toast.error('Falha no checkout', { description: error?.message || 'Tente novamente.' });
        return;
      }
      window.location.href = data.url;
    } catch {
      toast.error('Erro de conexão ao iniciar o checkout.');
    } finally {
      setUpgrading(false);
    }
  };

  return (
    <div
      className={cn(
        'w-full px-4 py-2 flex items-center justify-center gap-3 text-sm font-semibold border-b',
        urgent
          ? 'bg-destructive/15 text-destructive border-destructive/30'
          : 'bg-primary/10 text-foreground border-primary/20'
      )}
    >
      <Timer className="h-4 w-4 shrink-0" />
      <span>
        {days === 0
          ? 'Seu teste grátis termina hoje!'
          : `Seu teste grátis termina em ${days} dia${days > 1 ? 's' : ''}.`}{' '}
        <span className="hidden sm:inline text-muted-foreground font-normal">
          Continue com todas as ferramentas por R$ {proPrice.toFixed(2).replace('.', ',')}/mês.
        </span>
      </span>
      <Button
        size="sm"
        onClick={handleUpgrade}
        disabled={upgrading}
        className="h-7 px-3 font-bold shrink-0"
      >
        {upgrading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : (
          <><Crown className="h-3.5 w-3.5 mr-1" /> Assinar PRO</>
        )}
      </Button>
    </div>
  );
}
