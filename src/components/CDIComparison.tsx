import { useMemo, useState } from 'react';
import { calculateCDIReturn } from '@/lib/payoff';
import { AnalysisMetrics } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { countBusinessDays } from '@/lib/b3-calendar';
import { cn } from '@/lib/utils';

interface CDIComparisonProps {
  metrics: AnalysisMetrics;
  cdiRate: number;
  setCdiRate: (v: number) => void;
  daysToExpiry: number;
  setDaysToExpiry: (v: number) => void;
}

const formatMoney = (value: number) => `R$ ${value.toFixed(2)}`;

export default function CDIComparison({ metrics, cdiRate, setCdiRate, daysToExpiry, setDaysToExpiry }: CDIComparisonProps) {
  const [applyIRCDI, setApplyIRCDI] = useState(false);
  const [applyIROptions, setApplyIROptions] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [calendarOpen, setCalendarOpen] = useState(false);

  const hasStrategy = !!metrics.strategyType;

  // Capital investido: usa montageTotal se disponível (estratégia detectada), senão netCost
  // Sempre usa valor absoluto pois representa o desembolso real
  const investedCapital = useMemo(() => {
    if (hasStrategy && metrics.montageTotal != null && metrics.montageTotal !== 0) {
      return Math.abs(metrics.montageTotal);
    }
    const nc = Math.abs(metrics.netCost);
    return nc > 0 ? nc : 100;
  }, [hasStrategy, metrics.montageTotal, metrics.netCost]);

  const cdiReturn = calculateCDIReturn(investedCapital, cdiRate, daysToExpiry, applyIRCDI);

  const optionMaxGainRaw = metrics.maxGain === 'Ilimitado'
    ? Number.POSITIVE_INFINITY
    : (typeof metrics.maxGain === 'number' ? metrics.maxGain : Number.POSITIVE_INFINITY);

  const optionMaxLossRaw = metrics.maxLoss === 'Ilimitado'
    ? Number.NEGATIVE_INFINITY
    : (typeof metrics.maxLoss === 'number' ? metrics.maxLoss : Number.NEGATIVE_INFINITY);

  const optionMaxGain = Number.isFinite(optionMaxGainRaw)
    ? (applyIROptions ? optionMaxGainRaw * 0.85 : optionMaxGainRaw)
    : optionMaxGainRaw;

  const optionMaxLoss = Number.isFinite(optionMaxLossRaw)
    ? (applyIROptions ? optionMaxLossRaw * 0.85 : optionMaxLossRaw)
    : optionMaxLossRaw;

  const comparison = useMemo(() => {
    if (cdiRate <= 0 || daysToExpiry <= 0) return null;

    const optionBetter = Number.isFinite(optionMaxGain) && optionMaxGain > cdiReturn;
    const spread = Number.isFinite(optionMaxGain) ? optionMaxGain - cdiReturn : Number.POSITIVE_INFINITY;
    const efficiency = cdiReturn > 0 && Number.isFinite(optionMaxGain)
      ? (optionMaxGain / cdiReturn) * 100
      : null;

    let verdict = 'Dados insuficientes para concluir.';
    if (metrics.isRiskFree && optionBetter) {
      verdict = 'Estrutura com risco zero e retorno acima do CDI. Excelente oportunidade.';
    } else if (!Number.isFinite(optionMaxGain)) {
      verdict = 'Estrutura com ganho potencial ilimitado: avalie o risco antes de comparar.';
    } else if (optionBetter) {
      verdict = 'Retorno máximo supera o CDI no período.';
    } else {
      verdict = 'No cenário informado, CDI está mais competitivo que a estrutura.';
    }

    return { optionBetter, spread, verdict, efficiency };
  }, [cdiRate, daysToExpiry, cdiReturn, optionMaxGain, metrics.isRiskFree]);

  const cdiRoi = investedCapital > 0 ? (cdiReturn / investedCapital) * 100 : 0;
  const optionRoi = Number.isFinite(optionMaxGain) && investedCapital > 0
    ? (optionMaxGain / investedCapital) * 100
    : null;

  const handleDateSelect = (date: Date | undefined) => {
    setSelectedDate(date);
    setCalendarOpen(false);
    if (date) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      setDaysToExpiry(countBusinessDays(today, date));
    }
  };

  // Rótulo do breakeven
  const breakevenDisplay = metrics.realBreakeven != null
    ? (Array.isArray(metrics.realBreakeven)
      ? metrics.realBreakeven.map(b => `R$ ${b.toFixed(2)}`).join(' | ')
      : `R$ ${metrics.realBreakeven.toFixed(2)}`)
    : (metrics.breakevens.length > 0
      ? metrics.breakevens.map(v => `R$ ${v.toFixed(2)}`).join(' | ')
      : 'N/A');

  return (
    <Card className="border-2 border-primary/30 bg-gradient-to-br from-primary/[0.08] to-card shadow-[0_0_40px_-12px_hsl(var(--primary)/0.2)]">
      <CardHeader>
        <CardTitle className="text-2xl font-black tracking-tight flex items-center gap-3">
          📊 COMPARATIVO: ESTRATÉGIA vs CDI
          {comparison?.efficiency != null && (
            <Badge
              variant={comparison.efficiency >= 100 ? 'default' : 'destructive'}
              className={comparison.efficiency >= 100 ? 'bg-success text-success-foreground' : ''}
            >
              {comparison.efficiency.toFixed(0)}% do CDI
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1">
            <Label className="text-xs">Taxa CDI (% a.a.)</Label>
            <Input
              type="number"
              step="0.01"
              value={cdiRate || ''}
              onChange={e => setCdiRate(parseFloat(e.target.value) || 0)}
              placeholder="14.90"
              className="font-mono"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Dias úteis até vencimento</Label>
            <Input
              type="number"
              min={1}
              value={daysToExpiry || ''}
              onChange={e => setDaysToExpiry(parseInt(e.target.value) || 0)}
              placeholder="30"
              className="font-mono"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Data de vencimento</Label>
            <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full h-10 justify-start text-left font-mono text-sm",
                    !selectedDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {selectedDate ? format(selectedDate, "dd/MM/yyyy", { locale: ptBR }) : "Selecione a data"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={handleDateSelect}
                  disabled={(date) => date < new Date()}
                  initialFocus
                  className="pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Capital investido</Label>
            <Input value={formatMoney(investedCapital)} readOnly className="font-mono" />
          </div>
        </div>

        <div className="flex flex-wrap gap-4">
          <div className="flex items-center gap-2 rounded-lg border-2 border-warning/40 bg-warning/10 px-3 py-2">
            <Switch checked={applyIRCDI} onCheckedChange={setApplyIRCDI} id="ir-cdi-switch" className="data-[state=checked]:bg-warning" />
            <Label htmlFor="ir-cdi-switch" className="text-xs font-black text-warning cursor-pointer">⚠️ Aplicar IR no CDI</Label>
          </div>
          <div className="flex items-center gap-2 rounded-lg border-2 border-warning/40 bg-warning/10 px-3 py-2">
            <Switch checked={applyIROptions} onCheckedChange={setApplyIROptions} id="ir-opcoes-switch" className="data-[state=checked]:bg-warning" />
            <Label htmlFor="ir-opcoes-switch" className="text-xs font-black text-warning cursor-pointer">⚠️ Aplicar IR nas opções</Label>
          </div>
        </div>

        {cdiRate > 0 && daysToExpiry > 0 && (
          <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-lg border p-3 bg-muted/20">
                <p className="text-xs text-muted-foreground mb-1">Retorno CDI</p>
                <p className="text-lg font-bold font-mono">{formatMoney(cdiReturn)}</p>
                <p className="text-xs text-muted-foreground font-mono">ROI: {cdiRoi.toFixed(2)}%</p>
              </div>

              <div className="rounded-lg border p-3 bg-muted/20">
                <p className="text-xs text-muted-foreground mb-1">Ganho máximo da estrutura</p>
                <p className="text-lg font-bold font-mono text-success">
                  {Number.isFinite(optionMaxGain) ? formatMoney(optionMaxGain) : 'Ilimitado'}
                </p>
                <p className="text-xs text-muted-foreground font-mono">
                  ROI: {optionRoi !== null ? `${optionRoi.toFixed(2)}%` : '∞'}
                </p>
              </div>

              <div className="rounded-lg border p-3 bg-muted/20">
                <p className="text-xs text-muted-foreground mb-1">Perda máxima da estrutura</p>
                <p className={`text-lg font-bold font-mono ${metrics.isRiskFree ? 'text-success' : 'text-destructive'}`}>
                  {metrics.isRiskFree
                    ? 'Risco Zero'
                    : (Number.isFinite(optionMaxLoss)
                      ? formatMoney(Math.abs(optionMaxLoss))
                      : 'Ilimitada')}
                </p>
              </div>

              <div className="rounded-lg border p-3 bg-muted/20">
                <p className="text-xs text-muted-foreground mb-1">Breakeven</p>
                <p className="text-sm font-mono">{breakevenDisplay}</p>
              </div>
            </div>

            {comparison && (
              <div className="rounded-lg border bg-muted/40 p-4 space-y-3">
                <div className="text-center">
                  {comparison.efficiency !== null ? (
                    <div className={`text-3xl font-extrabold font-mono ${comparison.efficiency >= 100 ? 'text-success' : 'text-destructive'}`}>
                      {comparison.efficiency.toFixed(0)}%
                      <span className="text-sm font-medium ml-1">do CDI</span>
                    </div>
                  ) : (
                    <div className="text-3xl font-extrabold text-success font-mono">
                      ∞ <span className="text-sm font-medium ml-1">potencial ilimitado</span>
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground mt-1 font-mono">
                    Estrutura: {optionRoi !== null ? `${optionRoi.toFixed(2)}%` : '∞'} ROI | CDI: {cdiRoi.toFixed(2)}% ROI
                  </p>
                </div>
                <p className="text-sm font-medium text-center">{comparison.verdict}</p>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
