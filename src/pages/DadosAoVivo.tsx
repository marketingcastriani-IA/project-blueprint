import { useState, useMemo, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import Header from '@/components/Header';
import PayoffChart from '@/components/PayoffChart';
import MetricsCards from '@/components/MetricsCards';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Leg, PayoffPoint, AnalysisMetrics } from '@/lib/types';
import { calculatePayoffAtExpiry, calculatePayoffToday, calculateMetrics } from '@/lib/payoff';
import { cn } from '@/lib/utils';
import { Radio, Plus, Trash2, ClipboardPaste, ArrowRight, Info, Zap, BookOpen } from 'lucide-react';
import { toast } from 'sonner';

interface RTDRow {
  id: string;
  ticker: string;
  ultimo: number;
  strike: number;
  negocios: number;
  ofCompra: number;
  ofVenda: number;
  valorIntrinseco: number;
  valorExtrinseco: number;
  optionType: 'call' | 'put' | 'stock';
  side: 'buy' | 'sell';
  quantity: number;
  selected: boolean;
}

const emptyRow = (): RTDRow => ({
  id: crypto.randomUUID(),
  ticker: '',
  ultimo: 0,
  strike: 0,
  negocios: 0,
  ofCompra: 0,
  ofVenda: 0,
  valorIntrinseco: 0,
  valorExtrinseco: 0,
  optionType: 'call',
  side: 'buy',
  quantity: 1,
  selected: true,
});

const RTD_FORMULAS = [
  { campo: 'Último', formula: '=RTD("rtdtrading.rtdserver";; A2; "ULT")' },
  { campo: 'Strike', formula: '=RTD("rtdtrading.rtdserver";; A2; "PEX")' },
  { campo: 'Negócios', formula: '=RTD("rtdtrading.rtdserver";; A2; "NEG")' },
  { campo: 'Of. Compra', formula: '=RTD("rtdtrading.rtdserver";; A2; "OCP")' },
  { campo: 'Of. Venda', formula: '=RTD("rtdtrading.rtdserver";; A2; "OVD")' },
  { campo: 'V. Intrínseco', formula: '=RTD("rtdtrading.rtdserver";; A2; "VINT")' },
  { campo: 'V. Extrínseco', formula: '=RTD("rtdtrading.rtdserver";; A2; "VEXT")' },
];

function parseNumber(val: string): number {
  if (!val || val.trim() === '') return 0;
  return parseFloat(val.replace(',', '.')) || 0;
}

export default function DadosAoVivo() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [rows, setRows] = useState<RTDRow[]>([emptyRow()]);
  const [showFormulas, setShowFormulas] = useState(false);
  const [underlyingPrice, setUnderlyingPrice] = useState<number>(0);

  // Redirect after hooks
  if (!user) {
    navigate('/auth');
    return null;
  }

  const addRow = () => setRows(prev => [...prev, emptyRow()]);

  const removeRow = (id: string) => setRows(prev => prev.filter(r => r.id !== id));

  const updateRow = (id: string, field: keyof RTDRow, value: any) => {
    setRows(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r));
  };

  const handlePasteFromExcel = useCallback(async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (!text.trim()) {
        toast.error('Clipboard vazio. Copie os dados do Excel primeiro.');
        return;
      }

      const lines = text.trim().split('\n').filter(l => l.trim());
      const newRows: RTDRow[] = [];

      for (const line of lines) {
        const cols = line.split('\t');
        if (cols.length < 2) continue;

        const ticker = cols[0]?.trim() || '';
        if (!ticker) continue;

        // Expected columns: Ticker, Último, Strike, Negócios, Of.Compra, Of.Venda, V.Intrínseco, V.Extrínseco
        const row = emptyRow();
        row.ticker = ticker;
        row.ultimo = parseNumber(cols[1] || '');
        row.strike = parseNumber(cols[2] || '');
        row.negocios = parseNumber(cols[3] || '');
        row.ofCompra = parseNumber(cols[4] || '');
        row.ofVenda = parseNumber(cols[5] || '');
        row.valorIntrinseco = parseNumber(cols[6] || '');
        row.valorExtrinseco = parseNumber(cols[7] || '');

        // Auto-detect type from ticker suffix
        const lastChar = ticker.slice(-1).toUpperCase();
        if (['A','B','C','D','E','F','G','H','I','J','K','L'].includes(lastChar)) {
          row.optionType = 'call';
        } else if (['M','N','O','P','Q','R','S','T','U','V','W','X'].includes(lastChar)) {
          row.optionType = 'put';
        }

        newRows.push(row);
      }

      if (newRows.length === 0) {
        toast.error('Nenhum dado válido encontrado. Verifique o formato.');
        return;
      }

      setRows(newRows);
      toast.success(`${newRows.length} ticker(s) importado(s) do Excel!`);
    } catch {
      toast.error('Não foi possível acessar o clipboard. Use Ctrl+V em um campo.');
    }
  }, []);

  // Convert selected rows to legs for payoff calculation
  const legs: Leg[] = useMemo(() => {
    return rows
      .filter(r => r.selected && r.ticker && (r.ultimo > 0 || r.strike > 0))
      .map(r => ({
        side: r.side,
        option_type: r.optionType,
        asset: r.ticker,
        strike: r.optionType === 'stock' ? 0 : r.strike,
        price: r.ultimo || r.ofCompra || r.ofVenda,
        quantity: r.quantity,
      }));
  }, [rows]);

  // Calculate payoff data
  const { payoffData, metrics } = useMemo(() => {
    if (legs.length === 0) return { payoffData: [] as PayoffPoint[], metrics: null };

    const data = calculatePayoffData(legs);
    const m = calculateMetrics(legs);
    return { payoffData: data, metrics: m };
  }, [legs]);

  const spotPrice = useMemo(() => {
    if (underlyingPrice > 0) return underlyingPrice;
    const stockLeg = rows.find(r => r.optionType === 'stock' && r.ultimo > 0);
    return stockLeg?.ultimo || 0;
  }, [rows, underlyingPrice]);

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container py-6 space-y-6">
        {/* Title */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <Radio className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-black tracking-tight">Tempo Real — Estruturas</h1>
            <Badge className="bg-primary/20 text-primary border-0 text-[10px] font-black">RTD</Badge>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowFormulas(!showFormulas)}>
              <BookOpen className="h-4 w-4 mr-1" />
              {showFormulas ? 'Ocultar' : 'Ver'} Fórmulas RTD
            </Button>
            <Button variant="outline" size="sm" onClick={handlePasteFromExcel}>
              <ClipboardPaste className="h-4 w-4 mr-1" />
              Colar do Excel
            </Button>
            <Button size="sm" onClick={addRow}>
              <Plus className="h-4 w-4 mr-1" />
              Adicionar Ticker
            </Button>
          </div>
        </div>

        {/* RTD Formulas Reference */}
        {showFormulas && (
          <Card className="border-primary/30 bg-primary/5">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Info className="h-4 w-4 text-primary" />
                Fórmulas RTD para Excel — Profit Pro
              </CardTitle>
              <CardDescription className="text-xs">
                Configure essas fórmulas no Excel com o Profit aberto. Coluna A = ticker. Depois copie e cole aqui.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {RTD_FORMULAS.map(f => (
                  <div key={f.campo} className="rounded-lg bg-background border border-border p-2.5">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">{f.campo}</p>
                    <code className="text-[10px] text-primary font-mono break-all">{f.formula}</code>
                  </div>
                ))}
              </div>
              <div className="mt-3 p-3 rounded-lg bg-muted/50 border border-border">
                <p className="text-[11px] text-muted-foreground">
                  <strong>Formato para colar:</strong> Ticker | Último | Strike | Negócios | Of.Compra | Of.Venda | V.Intrínseco | V.Extrínseco
                  <br />Separe por TAB (copie direto do Excel). O tipo (Call/Put) é detectado automaticamente pelo ticker.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Underlying Price */}
        <div className="flex items-center gap-3">
          <label className="text-sm font-semibold text-muted-foreground whitespace-nowrap">Preço do Ativo-Base:</label>
          <Input
            type="number"
            step="0.01"
            placeholder="Ex: 28.50"
            value={underlyingPrice || ''}
            onChange={e => setUnderlyingPrice(parseNumber(e.target.value))}
            className="w-40"
          />
        </div>

        {/* Data Table */}
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8">✓</TableHead>
                    <TableHead>Ticker</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Lado</TableHead>
                    <TableHead className="text-right">Qtd</TableHead>
                    <TableHead className="text-right">Último</TableHead>
                    <TableHead className="text-right">Strike</TableHead>
                    <TableHead className="text-right">Neg.</TableHead>
                    <TableHead className="text-right">Of.Compra</TableHead>
                    <TableHead className="text-right">Of.Venda</TableHead>
                    <TableHead className="text-right">V.Intr.</TableHead>
                    <TableHead className="text-right">V.Extr.</TableHead>
                    <TableHead className="w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map(row => (
                    <TableRow key={row.id} className={cn(!row.selected && 'opacity-40')}>
                      <TableCell>
                        <input
                          type="checkbox"
                          checked={row.selected}
                          onChange={e => updateRow(row.id, 'selected', e.target.checked)}
                          className="accent-primary"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          value={row.ticker}
                          onChange={e => updateRow(row.id, 'ticker', e.target.value.toUpperCase())}
                          placeholder="PETR4"
                          className="h-8 w-28 text-xs font-mono"
                        />
                      </TableCell>
                      <TableCell>
                        <Select value={row.optionType} onValueChange={v => updateRow(row.id, 'optionType', v)}>
                          <SelectTrigger className="h-8 w-20 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="call">Call</SelectItem>
                            <SelectItem value="put">Put</SelectItem>
                            <SelectItem value="stock">Ação</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Select value={row.side} onValueChange={v => updateRow(row.id, 'side', v)}>
                          <SelectTrigger className="h-8 w-24 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="buy">Compra</SelectItem>
                            <SelectItem value="sell">Venda</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          value={row.quantity || ''}
                          onChange={e => updateRow(row.id, 'quantity', parseInt(e.target.value) || 1)}
                          className="h-8 w-16 text-xs text-right"
                        />
                      </TableCell>
                      {(['ultimo', 'strike', 'negocios', 'ofCompra', 'ofVenda', 'valorIntrinseco', 'valorExtrinseco'] as const).map(field => (
                        <TableCell key={field}>
                          <Input
                            type="number"
                            step="0.01"
                            value={row[field] || ''}
                            onChange={e => updateRow(row.id, field, parseNumber(e.target.value))}
                            className="h-8 w-20 text-xs text-right font-mono"
                          />
                        </TableCell>
                      ))}
                      <TableCell>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeRow(row.id)}>
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Summary of selected legs */}
        {legs.length > 0 && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Zap className="h-4 w-4 text-primary" />
            <span><strong className="text-foreground">{legs.length}</strong> perna(s) selecionada(s) para o gráfico Payoff</span>
          </div>
        )}

        {/* Metrics + Payoff Chart */}
        {metrics && (
          <div className="space-y-4">
            <MetricsCards metrics={metrics} />
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2">
                  <ArrowRight className="h-5 w-5 text-primary" />
                  Gráfico Payoff — Tempo Real
                </CardTitle>
              </CardHeader>
              <CardContent>
                <PayoffChart
                  data={payoffData}
                  breakevens={metrics.breakevens}
                  netCost={metrics.netCost}
                  montageTotal={metrics.montageTotal}
                  maxGain={metrics.maxGain}
                  maxLoss={metrics.maxLoss}
                  currentSpotPrice={spotPrice || null}
                />
              </CardContent>
            </Card>
          </div>
        )}

        {/* Empty state */}
        {legs.length === 0 && (
          <Card className="border-dashed">
            <CardContent className="py-12 text-center">
              <Radio className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
              <h3 className="text-lg font-bold text-muted-foreground mb-2">Nenhuma perna configurada</h3>
              <p className="text-sm text-muted-foreground max-w-md mx-auto">
                Adicione tickers manualmente ou cole dados do Excel (com fórmulas RTD do Profit Pro) para gerar o gráfico Payoff automaticamente.
              </p>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
