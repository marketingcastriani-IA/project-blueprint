import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '@/components/Header';
import { ProfessionalLayout, ProfessionalHeader, ProfessionalCard } from '@/components/ProfessionalLayout';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Calculator, TrendingUp, Percent, Calendar, DollarSign, Scale, ArrowRight, Info, Zap } from 'lucide-react';
import { calcDiasUteis, calcCdiPeriodo, formatPercent } from '@/lib/b3-utils';
import { cn } from '@/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useAccessControl } from '@/hooks/useAccessControl';

// IR regressivo para renda fixa
function getIRRate(diasCorridos: number): number {
  if (diasCorridos <= 180) return 22.5;
  if (diasCorridos <= 360) return 20;
  if (diasCorridos <= 720) return 17.5;
  return 15;
}

function calcDiasCorridos(start: Date, end: Date): number {
  const diff = end.getTime() - start.getTime();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

export default function CalculadoraRendaFixa() {
  const navigate = useNavigate();
  const accessControl = useAccessControl();
  const isPro = accessControl.planType === 'pro' || accessControl.isAdmin || (!accessControl.trialExpired && accessControl.status === 'approved');
  const [capital, setCapital] = useState<string>('100000');
  const [cdiAnual, setCdiAnual] = useState<string>('14.15');
  const [percentCdi, setPercentCdi] = useState<string>('100');
  const [dataInicio, setDataInicio] = useState<Date>(new Date());
  const [dataVencimento, setDataVencimento] = useState<Date | undefined>(undefined);
  const [incluirIR, setIncluirIR] = useState(true);
  const [lucroEstrutura, setLucroEstrutura] = useState<string>('');

  const resultado = useMemo(() => {
    if (!dataVencimento) return null;

    const capitalNum = parseFloat(capital) || 0;
    const cdiNum = parseFloat(cdiAnual) || 0;
    const pctCdi = parseFloat(percentCdi) || 100;
    const lucroEstruturaNum = parseFloat(lucroEstrutura) || 0;

    const vencStr = `${String(dataVencimento.getDate()).padStart(2, '0')}/${String(dataVencimento.getMonth() + 1).padStart(2, '0')}/${dataVencimento.getFullYear()}`;
    const diasUteis = calcDiasUteis(vencStr) ?? 0;
    const diasCorridos = calcDiasCorridos(dataInicio, dataVencimento);

    // CDI bruto do período
    const cdiBrutoPeriodo = calcCdiPeriodo(diasUteis, cdiNum);
    // Aplicando % do CDI contratado
    const rendBrutoPeriodo = cdiBrutoPeriodo * (pctCdi / 100);

    // IR
    const aliquotaIR = getIRRate(diasCorridos);
    const rendLiquidoPeriodo = incluirIR
      ? rendBrutoPeriodo * (1 - aliquotaIR / 100)
      : rendBrutoPeriodo;

    // Valores em R$
    const rendBrutoRS = capitalNum * (rendBrutoPeriodo / 100);
    const rendLiquidoRS = capitalNum * (rendLiquidoPeriodo / 100);

    // Comparação com estrutura de opções
    let comparacao = null;
    if (lucroEstruturaNum !== 0) {
      // Lucro da estrutura como % do CDI bruto do período
      const pctDoCdiBruto = cdiBrutoPeriodo > 0 ? (lucroEstruturaNum / cdiBrutoPeriodo) * 100 : 0;
      // Lucro da estrutura como % do CDI líquido
      const pctDoCdiLiquido = rendLiquidoPeriodo > 0 ? (lucroEstruturaNum / rendLiquidoPeriodo) * 100 : 0;
      // Lucro em R$ da estrutura
      const lucroEstruturaRS = capitalNum * (lucroEstruturaNum / 100);

      comparacao = {
        lucroPercent: lucroEstruturaNum,
        lucroRS: lucroEstruturaRS,
        pctDoCdiBruto,
        pctDoCdiLiquido,
        vantagem: incluirIR
          ? lucroEstruturaNum > rendLiquidoPeriodo
          : lucroEstruturaNum > rendBrutoPeriodo,
      };
    }

    return {
      diasUteis,
      diasCorridos,
      cdiBrutoPeriodo,
      rendBrutoPeriodo,
      rendLiquidoPeriodo,
      rendBrutoRS,
      rendLiquidoRS,
      aliquotaIR,
      comparacao,
    };
  }, [capital, cdiAnual, percentCdi, dataInicio, dataVencimento, incluirIR, lucroEstrutura]);

  return (
    <ProfessionalLayout>
      <Header />
      <div className="container py-8 max-w-5xl space-y-8">
        <ProfessionalHeader
          title="Calculadora Renda Fixa"
          subtitle="Compare o rendimento de renda fixa com sua estrutura de opções"
          badge={
            <Badge className="bg-yellow-400 text-black font-black text-xs animate-pulse border-0">
              NOVO
            </Badge>
          }
        />

        <div className="grid md:grid-cols-2 gap-6">
          {/* Painel de Entrada */}
          <ProfessionalCard className="p-6 space-y-5">
            <h2 className="text-lg font-bold flex items-center gap-2 text-foreground">
              <Calculator className="h-5 w-5 text-primary" />
              Parâmetros
            </h2>

            <div className="space-y-4">
              <div>
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Capital Investido (R$)
                </Label>
                <div className="relative mt-1">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="number"
                    value={capital}
                    onChange={e => setCapital(e.target.value)}
                    className="pl-9 font-mono"
                    placeholder="100000"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    CDI Anual (%)
                  </Label>
                  <div className="relative mt-1">
                    <Percent className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      type="number"
                      step="0.01"
                      value={cdiAnual}
                      onChange={e => setCdiAnual(e.target.value)}
                      className="pl-9 font-mono"
                    />
                  </div>
                </div>
                <div>
                  <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    % do CDI
                  </Label>
                  <div className="relative mt-1">
                    <Percent className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      type="number"
                      step="1"
                      value={percentCdi}
                      onChange={e => setPercentCdi(e.target.value)}
                      className="pl-9 font-mono"
                      placeholder="100"
                    />
                  </div>
                </div>
              </div>

              <div>
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Data de Vencimento da Estrutura
                </Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        'w-full justify-start text-left font-mono mt-1',
                        !dataVencimento && 'text-muted-foreground animate-pulse border-yellow-400 shadow-[0_0_12px_rgba(250,204,21,0.4)]'
                      )}
                    >
                      <Calendar className="mr-2 h-4 w-4" />
                      {dataVencimento
                        ? format(dataVencimento, "dd/MM/yyyy", { locale: ptBR })
                        : '⚠️ Selecione o vencimento'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <CalendarComponent
                      mode="single"
                      selected={dataVencimento}
                      onSelect={setDataVencimento}
                      disabled={date => date <= new Date()}
                      initialFocus
                      className="p-3 pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="flex items-center justify-between rounded-lg border border-border p-3 bg-muted/30">
                <div className="flex items-center gap-2">
                  <Scale className="h-4 w-4 text-primary" />
                  <span className="text-sm font-semibold">Descontar IR</span>
                  <Tooltip>
                    <TooltipTrigger>
                      <Info className="h-3.5 w-3.5 text-muted-foreground" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs text-xs">
                      Tabela regressiva de IR: até 180 dias = 22,5%; até 360 = 20%; até 720 = 17,5%; acima = 15%.
                      Opções de até 1 dia não têm IR sobre ganho de capital.
                    </TooltipContent>
                  </Tooltip>
                </div>
                <Switch checked={incluirIR} onCheckedChange={setIncluirIR} />
              </div>

              <Separator />

              <div>
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                  <TrendingUp className="h-3.5 w-3.5" />
                  Lucro da Estrutura de Opções (%)
                </Label>
                <p className="text-[10px] text-muted-foreground mb-1">
                  Insira o % de lucro da sua estrutura para comparar com renda fixa
                </p>
                <div className="relative mt-1">
                  <Percent className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="number"
                    step="0.01"
                    value={lucroEstrutura}
                    onChange={e => setLucroEstrutura(e.target.value)}
                    className="pl-9 font-mono border-primary/40 shadow-[0_0_8px_hsl(var(--primary)/0.15)]"
                    placeholder="Ex: 2.5"
                  />
                </div>
              </div>
            </div>
          </ProfessionalCard>

          {/* Painel de Resultado */}
          <div className="space-y-6">
            <ProfessionalCard className="p-6 space-y-4">
              <h2 className="text-lg font-bold flex items-center gap-2 text-foreground">
                <TrendingUp className="h-5 w-5 text-primary" />
                Rendimento Renda Fixa
              </h2>

              {!resultado ? (
                <p className="text-sm text-muted-foreground py-8 text-center">
                  Selecione a data de vencimento para ver os resultados.
                </p>
              ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <MetricBox label="Dias Úteis" value={String(resultado.diasUteis)} />
                    <MetricBox label="Dias Corridos" value={String(resultado.diasCorridos)} />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <MetricBox
                      label="CDI Bruto Período"
                      value={formatPercent(resultado.cdiBrutoPeriodo)}
                      highlight
                    />
                    <MetricBox
                      label={`Rend. Bruto (${percentCdi}% CDI)`}
                      value={formatPercent(resultado.rendBrutoPeriodo)}
                    />
                  </div>

                  {incluirIR && (
                    <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-3 space-y-2">
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground font-semibold">Alíquota IR</span>
                        <span className="font-mono font-bold text-destructive">{resultado.aliquotaIR}%</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground font-semibold">Rend. Líquido</span>
                        <span className="font-mono font-bold text-foreground">{formatPercent(resultado.rendLiquidoPeriodo)}</span>
                      </div>
                    </div>
                  )}

                  <Separator />

                  <div className="grid grid-cols-2 gap-3">
                    <MetricBox
                      label="Lucro Bruto (R$)"
                      value={`R$ ${resultado.rendBrutoRS.toFixed(2).replace('.', ',')}`}
                      color="success"
                    />
                    <MetricBox
                      label={incluirIR ? "Lucro Líquido (R$)" : "Lucro (R$)"}
                      value={`R$ ${resultado.rendLiquidoRS.toFixed(2).replace('.', ',')}`}
                      color="success"
                      highlight
                    />
                  </div>
                </div>
              )}
            </ProfessionalCard>

            {/* Comparação */}
            {resultado?.comparacao && (
              <ProfessionalCard
                className={cn(
                  "p-6 space-y-4 border-2",
                  resultado.comparacao.vantagem
                    ? "border-green-500/50 shadow-[0_0_30px_rgba(34,197,94,0.15)]"
                    : "border-destructive/30 shadow-[0_0_30px_rgba(239,68,68,0.1)]"
                )}
              >
                <h2 className="text-lg font-bold flex items-center gap-2 text-foreground">
                  <Scale className="h-5 w-5 text-primary" />
                  Comparativo: Estrutura vs Renda Fixa
                </h2>

                <div className="flex items-center justify-center gap-4 py-2">
                  <div className="text-center">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Estrutura</p>
                    <p className="text-2xl font-black font-mono text-foreground">
                      {formatPercent(resultado.comparacao.lucroPercent)}
                    </p>
                  </div>
                  <ArrowRight className="h-5 w-5 text-muted-foreground" />
                  <div className="text-center">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                      Renda Fixa {incluirIR ? '(líq.)' : '(bruto)'}
                    </p>
                    <p className="text-2xl font-black font-mono text-foreground">
                      {formatPercent(incluirIR ? resultado.rendLiquidoPeriodo : resultado.rendBrutoPeriodo)}
                    </p>
                  </div>
                </div>

                <Separator />

                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-semibold text-muted-foreground">% do CDI Bruto</span>
                    <Badge
                      className={cn(
                        "font-mono font-bold text-sm px-3",
                        resultado.comparacao.pctDoCdiBruto >= 100
                          ? "bg-green-500/20 text-green-400 border-green-500/30"
                          : "bg-destructive/20 text-destructive border-destructive/30"
                      )}
                    >
                      {resultado.comparacao.pctDoCdiBruto.toFixed(1).replace('.', ',')}% do CDI
                    </Badge>
                  </div>

                  {incluirIR && (
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-semibold text-muted-foreground">% do CDI Líquido</span>
                      <Badge
                        className={cn(
                          "font-mono font-bold text-sm px-3",
                          resultado.comparacao.pctDoCdiLiquido >= 100
                            ? "bg-green-500/20 text-green-400 border-green-500/30"
                            : "bg-destructive/20 text-destructive border-destructive/30"
                        )}
                      >
                        {resultado.comparacao.pctDoCdiLiquido.toFixed(1).replace('.', ',')}% do CDI líq.
                      </Badge>
                    </div>
                  )}

                  <div className="flex justify-between items-center">
                    <span className="text-sm font-semibold text-muted-foreground">Lucro Estrutura (R$)</span>
                    <span className="font-mono font-bold text-foreground">
                      R$ {resultado.comparacao.lucroRS.toFixed(2).replace('.', ',')}
                    </span>
                  </div>
                </div>

                <div
                  className={cn(
                    "rounded-lg p-3 text-center text-sm font-bold",
                    resultado.comparacao.vantagem
                      ? "bg-green-500/15 text-green-400 border border-green-500/30"
                      : "bg-destructive/10 text-destructive border border-destructive/20"
                  )}
                >
                  {resultado.comparacao.vantagem
                    ? `✅ Estrutura rende ${(resultado.comparacao.pctDoCdiBruto - 100).toFixed(1).replace('.', ',')}% ACIMA do CDI bruto`
                    : `⚠️ Estrutura rende ${(100 - resultado.comparacao.pctDoCdiBruto).toFixed(1).replace('.', ',')}% ABAIXO do CDI bruto`}
                </div>
              </ProfessionalCard>
            )}
          </div>
        </div>
      </div>
    </ProfessionalLayout>
  );
}

function MetricBox({
  label,
  value,
  highlight = false,
  color,
}: {
  label: string;
  value: string;
  highlight?: boolean;
  color?: 'success' | 'destructive';
}) {
  return (
    <div
      className={cn(
        "rounded-lg p-3 border",
        highlight
          ? "bg-primary/10 border-primary/30"
          : "bg-muted/30 border-border"
      )}
    >
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">
        {label}
      </p>
      <p
        className={cn(
          "text-lg font-bold font-mono",
          color === 'success' && 'text-green-500',
          color === 'destructive' && 'text-destructive',
          !color && 'text-foreground'
        )}
      >
        {value}
      </p>
    </div>
  );
}
