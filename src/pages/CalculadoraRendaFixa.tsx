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
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Cell, Legend } from 'recharts';

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

// Format number as BRL: 100000 -> "100.000,00"
function formatBRL(value: number): string {
  return value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Parse BRL formatted string back to number: "100.000,00" -> 100000
function parseBRL(value: string): number {
  const cleaned = value.replace(/\./g, '').replace(',', '.');
  return parseFloat(cleaned) || 0;
}

export default function CalculadoraRendaFixa() {
  const navigate = useNavigate();
  const accessControl = useAccessControl();
  const isPro = accessControl.planType === 'pro' || accessControl.isAdmin || (!accessControl.trialExpired && accessControl.status === 'approved');
  const [capitalRaw, setCapitalRaw] = useState<number>(100000);
  const [capitalDisplay, setCapitalDisplay] = useState<string>('100.000,00');
  const [cdiAnual, setCdiAnual] = useState<string>('14.65');
  const [percentCdi, setPercentCdi] = useState<string>('100');
  const [dataInicio, setDataInicio] = useState<Date>(new Date());
  const [dataVencimento, setDataVencimento] = useState<Date | undefined>(undefined);
  const [incluirIRRF, setIncluirIRRF] = useState(true);
  const [incluirIROpcoes, setIncluirIROpcoes] = useState(false);
  const [irOpcoesTaxa, setIrOpcoesTaxa] = useState<number>(15);
  const [lucroEstrutura, setLucroEstrutura] = useState<string>('');

  const handleCapitalChange = (rawValue: string) => {
    // Allow typing numbers, remove non-numeric except comma and dot
    const numericOnly = rawValue.replace(/[^0-9,]/g, '');
    // Parse as number (treat comma as decimal)
    const asNumber = parseFloat(numericOnly.replace(',', '.')) || 0;
    setCapitalRaw(asNumber);
    setCapitalDisplay(rawValue);
  };

  const handleCapitalBlur = () => {
    setCapitalDisplay(formatBRL(capitalRaw));
  };

  const handleCapitalFocus = () => {
    // Show raw number for easier editing
    if (capitalRaw > 0) {
      setCapitalDisplay(String(capitalRaw));
    }
  };

  const dateError = useMemo(() => {
    if (!dataVencimento) return null;
    if (dataVencimento <= dataInicio) return 'Data de vencimento deve ser posterior à data de início';
    return null;
  }, [dataInicio, dataVencimento]);

  const resultado = useMemo(() => {
    if (!dataVencimento || dateError) return null;

    const capitalNum = capitalRaw;
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

    // IR Renda Fixa
    const aliquotaIRRF = getIRRate(diasCorridos);
    const rendLiquidoPeriodo = incluirIRRF
      ? rendBrutoPeriodo * (1 - aliquotaIRRF / 100)
      : rendBrutoPeriodo;

    // Valores em R$
    const rendBrutoRS = capitalNum * (rendBrutoPeriodo / 100);
    const rendLiquidoRS = capitalNum * (rendLiquidoPeriodo / 100);

    // Comparação com estrutura de opções
    let comparacao = null;
    if (lucroEstruturaNum !== 0) {
      const lucroEstruturaRS = capitalNum * (lucroEstruturaNum / 100);
      // Aplicar IR sobre opções se ativado
      const lucroOpcoesBruto = lucroEstruturaNum;
      const lucroOpcoesLiquido = incluirIROpcoes
        ? lucroEstruturaNum * (1 - irOpcoesTaxa / 100)
        : lucroEstruturaNum;
      const lucroOpcoesRS = capitalNum * (lucroOpcoesLiquido / 100);

      // % do CDI bruto
      const pctDoCdiBruto = cdiBrutoPeriodo > 0 ? (lucroOpcoesLiquido / cdiBrutoPeriodo) * 100 : 0;
      // % do CDI líquido
      const pctDoCdiLiquido = rendLiquidoPeriodo > 0 ? (lucroOpcoesLiquido / rendLiquidoPeriodo) * 100 : 0;

      const referenciaRF = incluirIRRF ? rendLiquidoPeriodo : rendBrutoPeriodo;
      comparacao = {
        lucroPercentBruto: lucroOpcoesBruto,
        lucroPercentLiquido: lucroOpcoesLiquido,
        lucroRS: lucroOpcoesRS,
        lucroBrutoRS: lucroEstruturaRS,
        pctDoCdiBruto,
        pctDoCdiLiquido,
        vantagem: lucroOpcoesLiquido > referenciaRF,
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
      aliquotaIRRF,
      comparacao,
    };
  }, [capitalRaw, cdiAnual, percentCdi, dataInicio, dataVencimento, incluirIRRF, incluirIROpcoes, irOpcoesTaxa, lucroEstrutura]);

  // Chart data
  const chartData = useMemo(() => {
    if (!resultado) return [];
    const data = [];

    // Renda Fixa bars
    data.push({
      name: 'RF Bruto',
      valor: resultado.rendBrutoRS,
      percent: resultado.rendBrutoPeriodo,
      fill: 'hsl(var(--primary))',
    });
    if (incluirIRRF) {
      data.push({
        name: 'RF Líquido',
        valor: resultado.rendLiquidoRS,
        percent: resultado.rendLiquidoPeriodo,
        fill: 'hsl(var(--primary) / 0.6)',
      });
    }

    // Opções bars
    if (resultado.comparacao) {
      data.push({
        name: 'Opções Bruto',
        valor: resultado.comparacao.lucroBrutoRS,
        percent: resultado.comparacao.lucroPercentBruto,
        fill: resultado.comparacao.vantagem ? '#22c55e' : '#ef4444',
      });
      if (incluirIROpcoes) {
        data.push({
          name: 'Opções Líquido',
          valor: resultado.comparacao.lucroRS,
          percent: resultado.comparacao.lucroPercentLiquido,
          fill: resultado.comparacao.vantagem ? 'rgba(34,197,94,0.6)' : 'rgba(239,68,68,0.6)',
        });
      }
    }
    return data;
  }, [resultado, incluirIRRF, incluirIROpcoes]);

  if (!isPro) {
    return (
      <ProfessionalLayout>
        <Header />
        <main className="container py-20 text-center space-y-6">
          <div className="p-4 rounded-2xl bg-primary/10 inline-flex">
            <Calculator className="w-12 h-12 text-primary" />
          </div>
          <h1 className="text-3xl font-black tracking-tight">Calculadora Renda Fixa — Recurso PRO</h1>
          <p className="text-muted-foreground max-w-md mx-auto">
            A calculadora de renda fixa com comparação CDI é exclusiva para assinantes do plano PRO.
          </p>
          <Button size="lg" className="font-black shadow-lg shadow-primary/20" onClick={() => navigate('/settings')}>
            Assinar PRO <Zap className="ml-2 h-5 w-5" />
          </Button>
        </main>
      </ProfessionalLayout>
    );
  }

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
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-muted-foreground">R$</span>
                  <Input
                    type="text"
                    inputMode="decimal"
                    value={capitalDisplay}
                    onChange={e => handleCapitalChange(e.target.value)}
                    onBlur={handleCapitalBlur}
                    onFocus={handleCapitalFocus}
                    className="pl-10 font-mono"
                    placeholder="100.000,00"
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

              {/* IR Renda Fixa */}
              <div className={cn(
                "flex items-center justify-between rounded-lg border-2 p-3 transition-all",
                incluirIRRF
                  ? "border-success/60 bg-success/10"
                  : "border-destructive/40 bg-destructive/10"
              )}>
                <div className="flex items-center gap-2">
                  <Scale className="h-4 w-4 text-primary" />
                  <span className="text-sm font-bold">IR Renda Fixa</span>
                  <Tooltip>
                    <TooltipTrigger>
                      <Info className="h-3.5 w-3.5 text-muted-foreground" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs text-xs">
                      Tabela regressiva: até 180d = 22,5%; até 360d = 20%; até 720d = 17,5%; acima = 15%.
                    </TooltipContent>
                  </Tooltip>
                </div>
                <Switch
                  checked={incluirIRRF}
                  onCheckedChange={setIncluirIRRF}
                  className={cn(
                    incluirIRRF ? "data-[state=checked]:bg-success" : "data-[state=unchecked]:bg-destructive/50"
                  )}
                />
              </div>

              {/* IR Opções */}
              <div className={cn(
                "flex items-center justify-between rounded-lg border-2 p-3 transition-all",
                incluirIROpcoes
                  ? "border-success/60 bg-success/10"
                  : "border-destructive/40 bg-destructive/10"
              )}>
                <div className="flex items-center gap-2">
                  <Scale className="h-4 w-4 text-primary" />
                  <span className="text-sm font-bold">IR Opções</span>
                  <Tooltip>
                    <TooltipTrigger>
                      <Info className="h-3.5 w-3.5 text-muted-foreground" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs text-xs">
                      Alíquota fixa de IR sobre ganho de capital em opções (padrão 15%).
                    </TooltipContent>
                  </Tooltip>
                  {incluirIROpcoes && (
                    <>
                      <Input
                        type="number"
                        step="0.5"
                        value={irOpcoesTaxa}
                        onChange={e => setIrOpcoesTaxa(parseFloat(e.target.value) || 0)}
                        className="h-7 w-16 text-xs font-mono font-bold text-center ml-1"
                      />
                      <span className="text-xs font-bold text-success">%</span>
                    </>
                  )}
                </div>
                <Switch
                  checked={incluirIROpcoes}
                  onCheckedChange={setIncluirIROpcoes}
                  className={cn(
                    incluirIROpcoes ? "data-[state=checked]:bg-success" : "data-[state=unchecked]:bg-destructive/50"
                  )}
                />
              </div>

              <Separator />

              <div>
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                  <TrendingUp className="h-3.5 w-3.5" />
                  Lucro da Estrutura de Opções (%)
                </Label>
                <p className="text-xs text-muted-foreground mb-1">
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

                  {incluirIRRF && (
                    <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-3 space-y-2">
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground font-semibold">Alíquota IR RF</span>
                        <span className="font-mono font-bold text-destructive">{resultado.aliquotaIRRF}%</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground font-semibold">Rend. Líquido RF</span>
                        <span className="font-mono font-bold text-foreground">{formatPercent(resultado.rendLiquidoPeriodo)}</span>
                      </div>
                    </div>
                  )}

                  <Separator />

                  <div className="grid grid-cols-2 gap-3">
                    <MetricBox
                      label="Lucro Bruto (R$)"
                      value={`R$ ${formatBRL(resultado.rendBrutoRS)}`}
                      color="success"
                    />
                    <MetricBox
                      label={incluirIRRF ? "Lucro Líquido RF (R$)" : "Lucro RF (R$)"}
                      value={`R$ ${formatBRL(resultado.rendLiquidoRS)}`}
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
                    <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                      Opções {incluirIROpcoes ? '(líq.)' : '(bruto)'}
                    </p>
                    <p className="text-2xl font-black font-mono text-foreground">
                      {formatPercent(resultado.comparacao.lucroPercentLiquido)}
                    </p>
                  </div>
                  <ArrowRight className="h-5 w-5 text-muted-foreground" />
                  <div className="text-center">
                    <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                      Renda Fixa {incluirIRRF ? '(líq.)' : '(bruto)'}
                    </p>
                    <p className="text-2xl font-black font-mono text-foreground">
                      {formatPercent(incluirIRRF ? resultado.rendLiquidoPeriodo : resultado.rendBrutoPeriodo)}
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

                  {incluirIRRF && (
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
                    <span className="text-sm font-semibold text-muted-foreground">
                      Lucro Opções {incluirIROpcoes ? '(líq.)' : ''} (R$)
                    </span>
                    <span className="font-mono font-bold text-foreground">
                      R$ {formatBRL(resultado.comparacao.lucroRS)}
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

            {/* Gráfico de Comparação */}
            {resultado && chartData.length > 0 && (
              <ProfessionalCard className="p-6 space-y-4">
                <h2 className="text-lg font-bold flex items-center gap-2 text-foreground">
                  <TrendingUp className="h-5 w-5 text-primary" />
                  Gráfico Comparativo (R$)
                </h2>
                <div className="h-[280px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis
                        dataKey="name"
                        tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11, fontWeight: 600 }}
                      />
                      <YAxis
                        tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                        tickFormatter={(v) => `R$ ${formatBRL(v)}`}
                      />
                      <RechartsTooltip
                        contentStyle={{
                          backgroundColor: 'hsl(var(--card))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: 8,
                          color: 'hsl(var(--foreground))',
                          fontSize: 13,
                        }}
                        formatter={(value: number, name: string, props: any) => [
                          `R$ ${formatBRL(value)} (${props.payload.percent.toFixed(2)}%)`,
                          props.payload.name
                        ]}
                      />
                      <Bar dataKey="valor" radius={[6, 6, 0, 0]} maxBarSize={60}>
                        {chartData.map((entry, index) => (
                          <Cell key={index} fill={entry.fill} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
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
      <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-1">
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
