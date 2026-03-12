import { useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Leg } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Plus, CheckCircle2, CalendarIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface LegFormProps {
  onAdd: (leg: Leg) => void;
}

export default function LegForm({ onAdd }: LegFormProps) {
  const [leg, setLeg] = useState<Leg>({
    side: 'buy',
    option_type: 'call',
    asset: '',
    strike: 0,
    price: 0,
    quantity: 1,
  });
  const [expiryDate, setExpiryDate] = useState<Date | undefined>();
  const [calendarOpen, setCalendarOpen] = useState(false);

  const isStock = leg.option_type === 'stock';
  const hasAssetPrice = isStock && leg.price > 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!leg.asset) return;
    if (leg.quantity <= 0) return;
    if (leg.price < 0) return;
    
    if (leg.option_type !== 'stock') {
      if (leg.strike <= 0) return;
    }

    const strike = leg.option_type === 'stock' && leg.strike <= 0 ? leg.price : leg.strike;
    const expiry_date = expiryDate 
      ? `${expiryDate.getFullYear()}-${String(expiryDate.getMonth() + 1).padStart(2, '0')}-${String(expiryDate.getDate()).padStart(2, '0')}`
      : undefined;
    onAdd({ ...leg, strike, expiry_date });
    setLeg(prev => ({ ...prev, strike: 0, price: 0, quantity: 1 }));
    // Keep expiry date for next leg (common to reuse)
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Linha Principal de Inputs */}
      <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 items-end">
        <div className="space-y-1">
          <Label className="text-xs font-semibold uppercase tracking-wider">Lado</Label>
          <Select value={leg.side} onValueChange={v => setLeg(p => ({ ...p, side: v as 'buy' | 'sell' }))}>
            <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="buy">Compra</SelectItem>
              <SelectItem value="sell">Venda</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <Label className="text-xs font-semibold uppercase tracking-wider">Tipo</Label>
          <Select value={leg.option_type} onValueChange={v => setLeg(p => {
            const option_type = v as 'call' | 'put' | 'stock';
            return option_type === 'stock'
              ? { ...p, option_type, strike: p.price || 0 }
              : { ...p, option_type };
          })}>
            <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="call">Call</SelectItem>
              <SelectItem value="put">Put</SelectItem>
              <SelectItem value="stock">🏢 Ativo</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <Label className="text-xs font-semibold uppercase tracking-wider">Ticker</Label>
          <Input 
            value={leg.asset} 
            onChange={e => setLeg(p => ({ ...p, asset: e.target.value.toUpperCase() }))} 
            placeholder="PETR4"
            className="h-10 font-semibold"
          />
        </div>

        {/* Campo de Strike (Opções) */}
        {!isStock && (
          <div className="space-y-1">
            <Label className="text-xs font-semibold uppercase tracking-wider">Strike</Label>
            <Input
              type="number"
              step="0.01"
              value={leg.strike || ''}
              onChange={e => setLeg(p => ({ ...p, strike: parseFloat(e.target.value) || 0 }))}
              placeholder="30.00"
              className="h-10"
            />
          </div>
        )}

        {/* Campo de Preço */}
        <div className={cn(
          "space-y-1 transition-all duration-300",
          isStock && "col-span-2 sm:col-span-1"
        )}>
          <Label className={cn(
            "text-xs font-black uppercase tracking-widest transition-colors",
            isStock ? "text-primary" : "text-muted-foreground"
          )}>
            {isStock ? '💰 PREÇO' : 'Prêmio'}
          </Label>
          <div className={cn(
            "relative",
            isStock && "ring-2 ring-primary/50 rounded-lg p-2 bg-gradient-to-r from-primary/10 to-primary/5"
          )}>
            <Input
              type="number"
              step="0.01"
              value={leg.price || ''}
              onChange={e => setLeg(p => {
                const price = parseFloat(e.target.value) || 0;
                return p.option_type === 'stock'
                  ? { ...p, price, strike: price }
                  : { ...p, price };
              })}
              placeholder={isStock ? '39.61' : '1.50'}
              disabled={false}
              className={cn(
                "h-10 font-bold text-base",
                isStock && "bg-gradient-to-r from-primary/20 to-primary/10 border-primary/40 text-primary font-black",
                hasAssetPrice && "ring-2 ring-success/40"
              )}
            />
            {isStock && hasAssetPrice && (
              <CheckCircle2 className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-success" />
            )}
          </div>
        </div>

        {/* Data de Vencimento da Perna */}
        {!isStock && (
          <div className="space-y-1">
            <Label className="text-xs font-semibold uppercase tracking-wider">Vencimento</Label>
            <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "h-10 w-full justify-start text-left font-normal text-xs",
                    !expiryDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-1 h-3.5 w-3.5" />
                  {expiryDate ? format(expiryDate, "dd/MM/yy") : "Venc."}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={expiryDate}
                  onSelect={(date) => {
                    setExpiryDate(date);
                    setCalendarOpen(false);
                  }}
                  initialFocus
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
          </div>
        )}

        {/* Botão Submit */}
        <div className="flex gap-2 items-end col-span-2 sm:col-span-1">
          <div className="space-y-1 flex-1">
            <Label className="text-xs font-semibold uppercase tracking-wider">Qtd</Label>
            <Input 
              type="number" 
              min={1} 
              value={leg.quantity} 
              onChange={e => setLeg(p => ({ ...p, quantity: parseInt(e.target.value) || 1 }))}
              className="h-10"
            />
          </div>
          <Button 
            type="submit" 
            className="shrink-0 h-12 w-12 shadow-[0_0_25px_-4px_hsl(var(--primary)/0.6)] bg-primary hover:bg-primary/90 rounded-xl"
          >
            <Plus className="h-6 w-6" />
          </Button>
        </div>
      </div>

      {/* Indicador de Status para Ativos */}
      {isStock && (
        <div className={cn(
          "px-4 py-2 rounded-lg text-sm font-semibold text-center transition-all",
          hasAssetPrice
            ? "bg-success/15 text-success border border-success/30"
            : "bg-muted/50 text-muted-foreground border border-muted/30"
        )}>
          {hasAssetPrice 
            ? `✓ Preço do ativo: R$ ${leg.price.toFixed(2)}`
            : 'Insira o preço do ativo (opcional para adicionar)'
          }
        </div>
      )}
    </form>
  );
}
