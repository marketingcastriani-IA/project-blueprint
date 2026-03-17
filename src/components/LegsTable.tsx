import { useState } from 'react';
import { format } from 'date-fns';
import { Leg } from '@/lib/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Trash2, CheckCircle2, CalendarIcon } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';

interface LegsTableProps {
  legs: Leg[];
  onRemove: (index: number) => void;
  onUpdate: (index: number, leg: Leg) => void;
}

export default function LegsTable({ legs, onRemove, onUpdate }: LegsTableProps) {
  if (legs.length === 0) return null;

  const updateField = (index: number, field: keyof Leg, value: string | number) => {
    const current = legs[index];
    let updated: Leg = {
      ...current,
      [field]: value,
    } as Leg;

    if (field === 'option_type' && value === 'stock') {
      updated = { ...updated, strike: current.price };
    }
    if (field === 'price' && current.option_type === 'stock') {
      updated = { ...updated, strike: Number(value) || 0 };
    }

    onUpdate(index, updated);
  };

  return (
    <div className="rounded-lg border-2 border-primary/30 overflow-x-auto bg-gradient-to-br from-card/80 to-card/40 shadow-[0_0_30px_-12px_hsl(var(--primary)/0.2)] -mx-4 sm:mx-0">
      <Table className="min-w-[700px]">
        <TableHeader>
          <TableRow className="border-b-2 border-primary/20 bg-gradient-to-r from-primary/10 to-primary/5">
            <TableHead className="font-black text-xs uppercase tracking-wider">Lado</TableHead>
            <TableHead className="font-black text-xs uppercase tracking-wider">Tipo</TableHead>
            <TableHead className="font-black text-xs uppercase tracking-wider">Ativo</TableHead>
            <TableHead className="text-right font-black text-xs uppercase tracking-wider">Strike</TableHead>
            <TableHead className="text-right font-black text-xs uppercase tracking-wider">Preço</TableHead>
            <TableHead className="text-center font-black text-xs uppercase tracking-wider">Vencimento</TableHead>
            <TableHead className="text-right font-black text-xs uppercase tracking-wider">Qtd</TableHead>
            <TableHead className="w-10" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {legs.map((leg, i) => {
            const isStock = leg.option_type === 'stock';
            const hasPrice = isStock && leg.price > 0;
            const legExpiryDate = leg.expiry_date ? new Date(leg.expiry_date + 'T12:00:00') : undefined;

            return (
              <TableRow 
                key={i}
                className={cn(
                  "border-b border-primary/10 transition-all hover:bg-primary/5",
                  isStock && "bg-gradient-to-r from-primary/[0.08] to-primary/[0.03]"
                )}
              >
                <TableCell>
                  <select
                    value={leg.side}
                    onChange={(e) => updateField(i, 'side', e.target.value as 'buy' | 'sell')}
                    className="h-9 rounded-md border border-input bg-background px-2 text-xs font-semibold"
                  >
                    <option value="buy">Compra</option>
                    <option value="sell">Venda</option>
                  </select>
                </TableCell>
                <TableCell>
                  <select
                    value={leg.option_type}
                    onChange={(e) => updateField(i, 'option_type', e.target.value as 'call' | 'put' | 'stock')}
                    className={cn(
                      "h-9 rounded-md border px-2 text-xs font-semibold",
                      isStock 
                        ? "border-primary/40 bg-gradient-to-r from-primary/15 to-primary/5 text-primary font-black"
                        : "border-input bg-background"
                    )}
                  >
                    <option value="call">Call</option>
                    <option value="put">Put</option>
                    <option value="stock">🏢 Ativo</option>
                  </select>
                </TableCell>
                <TableCell>
                  <Input
                    value={leg.asset}
                    onChange={(e) => updateField(i, 'asset', e.target.value.toUpperCase())}
                    className={cn(
                      "h-9 font-black text-base",
                      isStock && "border-primary/40 bg-gradient-to-r from-primary/15 to-primary/5 text-primary"
                    )}
                  />
                </TableCell>
                <TableCell>
                  <div className="relative">
                    <Input
                      type="number"
                      step="0.01"
                      value={isStock ? leg.strike : leg.strike}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value) || 0;
                        if (isStock) {
                          onUpdate(i, { ...leg, strike: val });
                        } else {
                          updateField(i, 'strike', val);
                        }
                      }}
                      className={cn(
                        "h-9 text-right font-bold text-base pr-8",
                        isStock && "border-primary/40 bg-gradient-to-r from-primary/20 to-primary/10 text-primary font-black",
                        !isStock && "font-mono"
                      )}
                    />
                    {isStock && hasPrice && (
                      <CheckCircle2 className="absolute right-2 top-1/2 -translate-y-1/2 h-5 w-5 text-success" />
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="relative">
                    <Input
                      type="number"
                      step="0.01"
                      value={leg.price}
                      onChange={(e) => updateField(i, 'price', parseFloat(e.target.value) || 0)}
                      className={cn(
                        "h-9 text-right font-bold text-base pr-8",
                        isStock && "border-primary/40 bg-gradient-to-r from-primary/20 to-primary/10 text-primary font-black",
                        !isStock && "font-mono"
                      )}
                    />
                    {isStock && hasPrice && (
                      <CheckCircle2 className="absolute right-2 top-1/2 -translate-y-1/2 h-5 w-5 text-success" />
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  {!isStock ? (
                    <LegDatePicker
                      date={legExpiryDate}
                      onChange={(date) => {
                        const expiry_date = date 
                          ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
                          : undefined;
                        onUpdate(i, { ...leg, expiry_date });
                      }}
                    />
                  ) : (
                    <span className="text-xs text-muted-foreground text-center block">—</span>
                  )}
                </TableCell>
                <TableCell>
                  <Input
                    type="number"
                    min={1}
                    value={leg.quantity}
                    onChange={(e) => updateField(i, 'quantity', parseInt(e.target.value) || 1)}
                    className="h-9 text-right font-semibold"
                  />
                </TableCell>
                <TableCell>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-8 w-8 hover:bg-destructive/10" 
                    onClick={() => onRemove(i)}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

function LegDatePicker({ date, onChange }: { date?: Date; onChange: (date?: Date) => void }) {
  const [open, setOpen] = useState(false);
  const isEmpty = !date;
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "h-9 w-full justify-center text-xs px-2 transition-all",
            isEmpty 
              ? "border-2 border-warning text-warning font-black animate-pulse bg-warning/10 hover:bg-warning/20 shadow-[0_0_12px_2px_hsl(var(--warning)/0.4)]"
              : "border-success/50 text-success font-bold bg-success/10",
          )}
        >
          <CalendarIcon className={cn("mr-1 h-3 w-3", isEmpty ? "text-warning" : "text-success")} />
          {date ? format(date, "dd/MM/yy") : "⚠️ Preencher"}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={date}
          onSelect={(d) => {
            onChange(d);
            setOpen(false);
          }}
          initialFocus
          className={cn("p-3 pointer-events-auto")}
        />
      </PopoverContent>
    </Popover>
  );
}
