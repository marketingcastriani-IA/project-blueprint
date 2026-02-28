import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, TrendingDown, Trash2, Plus, Calendar, DollarSign } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ClosedOperation {
  id: string;
  name: string;
  asset: string;
  entryDate: string;
  exitDate: string;
  profitLoss: number;
  percentage: number;
  strategy: string;
}

export default function Portfolio() {
  const [operations, setOperations] = useState<ClosedOperation[]>([
    // Exemplo para demonstração
    {
      id: '1',
      name: 'Compra Coberta PETR4',
      asset: 'PETR4',
      entryDate: '2024-01-15',
      exitDate: '2024-02-15',
      profitLoss: 850.00,
      percentage: 2.2,
      strategy: 'Covered Call',
    },
  ]);

  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    asset: '',
    entryDate: '',
    exitDate: '',
    profitLoss: 0,
    strategy: '',
  });

  const stats = useMemo(() => {
    const totalPL = operations.reduce((sum, op) => sum + op.profitLoss, 0);
    const wins = operations.filter(op => op.profitLoss > 0).length;
    const losses = operations.filter(op => op.profitLoss < 0).length;
    const winRate = operations.length > 0 ? ((wins / operations.length) * 100).toFixed(1) : '0';

    return { totalPL, wins, losses, winRate };
  }, [operations]);

  const handleAddOperation = () => {
    if (!formData.name || !formData.asset || formData.profitLoss === 0) return;

    const newOp: ClosedOperation = {
      id: Date.now().toString(),
      name: formData.name,
      asset: formData.asset,
      entryDate: formData.entryDate,
      exitDate: formData.exitDate,
      profitLoss: formData.profitLoss,
      percentage: ((formData.profitLoss / Math.abs(formData.profitLoss)) * 2.5),
      strategy: formData.strategy,
    };

    setOperations([...operations, newOp]);
    setFormData({ name: '', asset: '', entryDate: '', exitDate: '', profitLoss: 0, strategy: '' });
    setShowForm(false);
  };

  const handleDelete = (id: string) => {
    setOperations(operations.filter(op => op.id !== id));
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <h2 className="text-3xl font-black tracking-tight">Portfólio</h2>
        <p className="text-muted-foreground">Acompanhe suas operações encerradas e lucros/prejuízos</p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 sm:grid-cols-4">
        <Card className="relative overflow-hidden border-2 border-primary/30 bg-gradient-to-br from-primary/[0.08] to-card">
          <CardContent className="p-4 space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Total P&L</p>
            <p className={cn('text-2xl font-black', stats.totalPL >= 0 ? 'text-success' : 'text-destructive')}>
              R$ {Math.abs(stats.totalPL).toFixed(2)}
            </p>
            <p className="text-xs text-muted-foreground">{operations.length} operações</p>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden border-2 border-success/30 bg-gradient-to-br from-success/[0.08] to-card">
          <CardContent className="p-4 space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Ganhos</p>
            <p className="text-2xl font-black text-success">{stats.wins}</p>
            <p className="text-xs text-muted-foreground">operações lucrativas</p>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden border-2 border-destructive/30 bg-gradient-to-br from-destructive/[0.08] to-card">
          <CardContent className="p-4 space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Perdas</p>
            <p className="text-2xl font-black text-destructive">{stats.losses}</p>
            <p className="text-xs text-muted-foreground">operações com prejuízo</p>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden border-2 border-primary/30 bg-gradient-to-br from-primary/[0.08] to-card">
          <CardContent className="p-4 space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Taxa de Acerto</p>
            <p className="text-2xl font-black text-primary">{stats.winRate}%</p>
            <p className="text-xs text-muted-foreground">taxa de sucesso</p>
          </CardContent>
        </Card>
      </div>

      {/* Add Operation Button */}
      <Button
        onClick={() => setShowForm(!showForm)}
        className="text-base h-11 px-6 shadow-[0_0_30px_-8px_hsl(var(--primary)/0.4)]"
      >
        <Plus className="mr-2 h-5 w-5" />
        Nova Operação Encerrada
      </Button>

      {/* Add Form */}
      {showForm && (
        <Card className="border-2 border-primary/30 bg-gradient-to-br from-primary/5 to-card">
          <CardHeader>
            <CardTitle>Registrar Operação Encerrada</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Nome da Operação</Label>
                <Input
                  placeholder="Ex: Compra Coberta PETR4"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Ativo</Label>
                <Input
                  placeholder="Ex: PETR4"
                  value={formData.asset}
                  onChange={(e) => setFormData({ ...formData, asset: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Data de Entrada</Label>
                <Input
                  type="date"
                  value={formData.entryDate}
                  onChange={(e) => setFormData({ ...formData, entryDate: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Data de Saída</Label>
                <Input
                  type="date"
                  value={formData.exitDate}
                  onChange={(e) => setFormData({ ...formData, exitDate: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Lucro/Prejuízo (R$)</Label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={formData.profitLoss}
                  onChange={(e) => setFormData({ ...formData, profitLoss: parseFloat(e.target.value) || 0 })}
                />
              </div>
              <div className="space-y-2">
                <Label>Estratégia</Label>
                <Input
                  placeholder="Ex: Covered Call"
                  value={formData.strategy}
                  onChange={(e) => setFormData({ ...formData, strategy: e.target.value })}
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button onClick={handleAddOperation} className="flex-1">Salvar</Button>
              <Button onClick={() => setShowForm(false)} variant="outline" className="flex-1">Cancelar</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Operations List */}
      <div className="space-y-3">
        {operations.map((op) => (
          <Card key={op.id} className="relative overflow-hidden border-2 transition-all hover:shadow-lg group">
            <CardContent className="p-5 flex items-center justify-between gap-4">
              <div className="flex items-center gap-4 flex-1">
                <div className={cn(
                  'flex h-12 w-12 items-center justify-center rounded-lg',
                  op.profitLoss >= 0
                    ? 'bg-success/20 text-success'
                    : 'bg-destructive/20 text-destructive'
                )}>
                  {op.profitLoss >= 0 ? <TrendingUp className="h-6 w-6" /> : <TrendingDown className="h-6 w-6" />}
                </div>

                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <p className="font-bold text-base">{op.name}</p>
                    <Badge variant="outline" className="text-xs">{op.asset}</Badge>
                    <Badge className="text-xs bg-primary/20 text-primary border-primary/30">{op.strategy}</Badge>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {op.entryDate} → {op.exitDate}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className="text-right space-y-1">
                  <p className={cn('text-lg font-black', op.profitLoss >= 0 ? 'text-success' : 'text-destructive')}>
                    {op.profitLoss >= 0 ? '+' : ''}R$ {op.profitLoss.toFixed(2)}
                  </p>
                  <p className={cn('text-xs font-semibold', op.profitLoss >= 0 ? 'text-success' : 'text-destructive')}>
                    {op.profitLoss >= 0 ? '+' : ''}{op.percentage.toFixed(1)}%
                  </p>
                </div>

                <Button
                  onClick={() => handleDelete(op.id)}
                  variant="ghost"
                  size="sm"
                  className="opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {operations.length === 0 && !showForm && (
        <Card className="border-dashed border-2 border-muted-foreground/30">
          <CardContent className="p-12 text-center space-y-3">
            <p className="text-muted-foreground font-medium">Nenhuma operação encerrada registrada</p>
            <p className="text-sm text-muted-foreground">Clique em "Nova Operação Encerrada" para começar</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
