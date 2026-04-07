import { useState, useMemo, useCallback } from "react";
import { useB3Options, type B3Option } from "@/contexts/B3OptionsContext";
import ProfessionalLayout from "@/components/ProfessionalLayout";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Search, Copy, Check, Filter, Database, ArrowUpDown } from "lucide-react";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";

export default function TickerOpcoes() {
  const { options, families, vencimentos, loading } = useB3Options();
  const [search, setSearch] = useState("");
  const [selectedFamily, setSelectedFamily] = useState<string>("all");
  const [selectedVencimento, setSelectedVencimento] = useState<string>("all");
  const [selectedTipo, setSelectedTipo] = useState<string>("all");
  const [strikeMin, setStrikeMin] = useState("");
  const [strikeMax, setStrikeMax] = useState("");
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [copiedTicker, setCopiedTicker] = useState<string | null>(null);
  const [sortField, setSortField] = useState<"ticker" | "strike" | "vencimento" | "precoUltimo">("strike");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const filtered = useMemo(() => {
    let result = options;

    if (selectedFamily !== "all") {
      result = result.filter((o) => o.family === selectedFamily);
    }
    if (selectedVencimento !== "all") {
      result = result.filter((o) => o.vencimento === selectedVencimento);
    }
    if (selectedTipo !== "all") {
      result = result.filter((o) => o.tipo === selectedTipo);
    }
    if (search.trim()) {
      const q = search.toUpperCase().trim();
      result = result.filter((o) => o.ticker.includes(q) || o.family.includes(q));
    }
    if (strikeMin) {
      const min = parseFloat(strikeMin);
      if (!isNaN(min)) result = result.filter((o) => o.strike >= min);
    }
    if (strikeMax) {
      const max = parseFloat(strikeMax);
      if (!isNaN(max)) result = result.filter((o) => o.strike <= max);
    }

    // Sort
    result = [...result].sort((a, b) => {
      let cmp = 0;
      if (sortField === "ticker") cmp = a.ticker.localeCompare(b.ticker);
      else if (sortField === "strike") cmp = a.strike - b.strike;
      else if (sortField === "precoUltimo") cmp = a.precoUltimo - b.precoUltimo;
      else if (sortField === "vencimento") {
        const [da, ma, ya] = a.vencimento.split("/").map(Number);
        const [db, mb, yb] = b.vencimento.split("/").map(Number);
        cmp = new Date(ya, ma - 1, da).getTime() - new Date(yb, mb - 1, db).getTime();
      }
      return sortDir === "asc" ? cmp : -cmp;
    });

    return result;
  }, [options, selectedFamily, selectedVencimento, selectedTipo, search, strikeMin, strikeMax, sortField, sortDir]);

  const displayed = filtered.slice(0, 200);

  const toggleRow = useCallback((ticker: string) => {
    setSelectedRows((prev) => {
      const next = new Set(prev);
      if (next.has(ticker)) next.delete(ticker);
      else next.add(ticker);
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    if (selectedRows.size === displayed.length) {
      setSelectedRows(new Set());
    } else {
      setSelectedRows(new Set(displayed.map((o) => o.ticker)));
    }
  }, [displayed, selectedRows.size]);

  const copySelection = useCallback(() => {
    const selected = filtered.filter((o) => selectedRows.has(o.ticker));
    if (selected.length === 0) {
      toast.error("Nenhuma opção selecionada");
      return;
    }
    const text = selected
      .map((o) => `${o.ticker}\t${o.strike}\t${o.vencimento}\t${o.tipo}\t${o.precoUltimo}`)
      .join("\n");
    navigator.clipboard.writeText(`Ticker\tStrike\tVencimento\tTipo\tÚltimo\n${text}`);
    toast.success(`${selected.length} opções copiadas para a área de transferência`);
  }, [filtered, selectedRows]);

  const copyTicker = useCallback((ticker: string) => {
    navigator.clipboard.writeText(ticker);
    setCopiedTicker(ticker);
    setTimeout(() => setCopiedTicker(null), 1500);
    toast.success(`${ticker} copiado`);
  }, []);

  const handleSort = (field: typeof sortField) => {
    if (sortField === field) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortField(field); setSortDir("asc"); }
  };

  const availableVencimentos = useMemo(() => {
    if (selectedFamily === "all") return vencimentos;
    const fOpts = options.filter((o) => o.family === selectedFamily);
    const vSet = new Set(fOpts.map((o) => o.vencimento));
    return vencimentos.filter((v) => vSet.has(v));
  }, [selectedFamily, options, vencimentos]);

  if (loading) {
    return (
      <ProfessionalLayout>
        <div className="p-6 space-y-4">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-[400px] w-full" />
        </div>
      </ProfessionalLayout>
    );
  }

  return (
    <ProfessionalLayout>
      <div className="p-4 md:p-6 space-y-4 max-w-[1400px] mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Database className="h-6 w-6 text-primary" />
          <h1 className="text-xl md:text-2xl font-black uppercase tracking-wider text-foreground">
            Ticker Opções B3
          </h1>
          <Badge variant="outline" className="text-xs">
            {options.length.toLocaleString()} opções
          </Badge>
        </div>

        {/* Filters */}
        <Card className="border-border/50">
          <CardHeader className="py-3 px-4">
            <CardTitle className="text-sm flex items-center gap-2">
              <Filter className="h-4 w-4" /> Filtros
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 pt-0">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              {/* Search */}
              <div className="col-span-2 md:col-span-1">
                <label className="text-[10px] uppercase text-muted-foreground font-bold tracking-wider mb-1 block">Buscar Ticker</label>
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="PETR, VALE..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-9 h-9 text-sm uppercase"
                  />
                </div>
              </div>

              {/* Family */}
              <div>
                <label className="text-[10px] uppercase text-muted-foreground font-bold tracking-wider mb-1 block">Ativo Base</label>
                <Select value={selectedFamily} onValueChange={setSelectedFamily}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent className="max-h-[300px]">
                    <SelectItem value="all">Todos ({families.length})</SelectItem>
                    {families.map((f) => (
                      <SelectItem key={f} value={f}>{f}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Vencimento */}
              <div>
                <label className="text-[10px] uppercase text-muted-foreground font-bold tracking-wider mb-1 block">Vencimento</label>
                <Select value={selectedVencimento} onValueChange={setSelectedVencimento}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent className="max-h-[300px]">
                    <SelectItem value="all">Todos</SelectItem>
                    {availableVencimentos.map((v) => (
                      <SelectItem key={v} value={v}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Tipo */}
              <div>
                <label className="text-[10px] uppercase text-muted-foreground font-bold tracking-wider mb-1 block">Tipo</label>
                <Select value={selectedTipo} onValueChange={setSelectedTipo}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="CALL">CALL</SelectItem>
                    <SelectItem value="PUT">PUT</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Strike range */}
              <div>
                <label className="text-[10px] uppercase text-muted-foreground font-bold tracking-wider mb-1 block">Strike Mín</label>
                <Input
                  type="number"
                  placeholder="0"
                  value={strikeMin}
                  onChange={(e) => setStrikeMin(e.target.value)}
                  className="h-9 text-sm"
                />
              </div>
              <div>
                <label className="text-[10px] uppercase text-muted-foreground font-bold tracking-wider mb-1 block">Strike Máx</label>
                <Input
                  type="number"
                  placeholder="999"
                  value={strikeMax}
                  onChange={(e) => setStrikeMax(e.target.value)}
                  className="h-9 text-sm"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Actions bar */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">
            {filtered.length.toLocaleString()} resultados
            {filtered.length > 200 && ` (mostrando 200)`}
            {selectedRows.size > 0 && ` · ${selectedRows.size} selecionadas`}
          </span>
          <Button
            size="sm"
            variant="outline"
            onClick={copySelection}
            disabled={selectedRows.size === 0}
            className="gap-2"
          >
            <Copy className="h-3.5 w-3.5" /> Copiar Seleção
          </Button>
        </div>

        {/* Table */}
        <Card className="border-border/50 overflow-hidden">
          <div className="overflow-x-auto max-h-[60vh]">
            <Table>
              <TableHeader className="sticky top-0 bg-card z-10">
                <TableRow>
                  <TableHead className="w-10">
                    <input
                      type="checkbox"
                      checked={displayed.length > 0 && selectedRows.size === displayed.length}
                      onChange={selectAll}
                      className="accent-primary"
                    />
                  </TableHead>
                  <TableHead className="cursor-pointer select-none" onClick={() => handleSort("ticker")}>
                    <span className="flex items-center gap-1">Ticker <ArrowUpDown className="h-3 w-3" /></span>
                  </TableHead>
                  <TableHead>Família</TableHead>
                  <TableHead className="cursor-pointer select-none" onClick={() => handleSort("strike")}>
                    <span className="flex items-center gap-1">Strike <ArrowUpDown className="h-3 w-3" /></span>
                  </TableHead>
                  <TableHead className="cursor-pointer select-none" onClick={() => handleSort("vencimento")}>
                    <span className="flex items-center gap-1">Vencimento <ArrowUpDown className="h-3 w-3" /></span>
                  </TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead className="cursor-pointer select-none text-right" onClick={() => handleSort("precoUltimo")}>
                    <span className="flex items-center gap-1 justify-end">Último <ArrowUpDown className="h-3 w-3" /></span>
                  </TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {displayed.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-12 text-muted-foreground">
                      Nenhuma opção encontrada com esses filtros
                    </TableCell>
                  </TableRow>
                ) : (
                  displayed.map((opt) => (
                    <TableRow
                      key={opt.ticker}
                      className={selectedRows.has(opt.ticker) ? "bg-primary/5" : ""}
                    >
                      <TableCell>
                        <input
                          type="checkbox"
                          checked={selectedRows.has(opt.ticker)}
                          onChange={() => toggleRow(opt.ticker)}
                          className="accent-primary"
                        />
                      </TableCell>
                      <TableCell className="font-mono font-bold text-foreground">{opt.ticker}</TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="text-[10px]">{opt.family}</Badge>
                      </TableCell>
                      <TableCell className="font-mono">{opt.strike.toFixed(2)}</TableCell>
                      <TableCell className="text-sm">{opt.vencimento}</TableCell>
                      <TableCell>
                        <Badge variant={opt.tipo === "CALL" ? "default" : "destructive"} className="text-[10px]">
                          {opt.tipo}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {opt.precoUltimo > 0 ? `R$ ${opt.precoUltimo.toFixed(2)}` : "—"}
                      </TableCell>
                      <TableCell>
                        <button
                          onClick={() => copyTicker(opt.ticker)}
                          className="p-1 rounded hover:bg-muted transition-colors"
                          title="Copiar ticker"
                        >
                          {copiedTicker === opt.ticker ? (
                            <Check className="h-3.5 w-3.5 text-green-500" />
                          ) : (
                            <Copy className="h-3.5 w-3.5 text-muted-foreground" />
                          )}
                        </button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </Card>
      </div>
    </ProfessionalLayout>
  );
}
