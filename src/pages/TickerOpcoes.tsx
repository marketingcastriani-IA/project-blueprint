import { useState, useMemo, useCallback, useEffect } from "react";
import { useB3Options, type B3Option } from "@/contexts/B3OptionsContext";
import ProfessionalLayout from "@/components/ProfessionalLayout";
import Header from "@/components/Header";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, Copy, Check, Filter, Database, ArrowUpDown, TrendingDown, TrendingUp, DollarSign, RotateCcw, Wifi } from "lucide-react";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { Slider } from "@/components/ui/slider";
import { useSharedRtdBridge } from "@/contexts/RtdBridgeContext";

const normalizeTickerSearch = (value: string) =>
  value.toUpperCase().replace(/[^A-Z0-9]/g, "").trim();

const dedupeOptionsByTicker = (items: B3Option[]) =>
  Array.from(
    new Map(items.map((item) => [normalizeTickerSearch(item.ticker), item])).values()
  );

const filterOptionsByTicker = (items: B3Option[], rawQuery: string) => {
  const query = normalizeTickerSearch(rawQuery);
  if (!query) return items;
  const exactMatches = items.filter((item) => normalizeTickerSearch(item.ticker) === query);
  if (exactMatches.length > 0) return exactMatches;
  if (query.length >= 6) return items.filter((item) => normalizeTickerSearch(item.ticker).startsWith(query));
  const prefixMatches = items.filter((item) => normalizeTickerSearch(item.ticker).startsWith(query));
  if (prefixMatches.length > 0) return prefixMatches;
  return items.filter((item) => normalizeTickerSearch(item.ticker).includes(query));
};

export default function TickerOpcoes() {
  const { options, families, vencimentos, loading } = useB3Options();
  const [search, setSearch] = useState("");
  const [selectedFamily, setSelectedFamily] = useState<string>("all");
  const [selectedVencimento, setSelectedVencimento] = useState<string>("all");
  const [selectedTipo, setSelectedTipo] = useState<string>("all");
  const [precoBase, setPrecoBase] = useState("");
  const [precoBaseManual, setPrecoBaseManual] = useState(false);
  const [pctAbaixo, setPctAbaixo] = useState(20);
  const [pctAcima, setPctAcima] = useState(20);
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [copiedTicker, setCopiedTicker] = useState<string | null>(null);
  const [sortField, setSortField] = useState<"ticker" | "strike" | "vencimento" | "precoUltimo">("strike");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  // RTD Bridge — auto-fill preço base from live data
  const { status, rows, addTicker } = useSharedRtdBridge();

  // Subscribe family ticker to RTD when selected
  useEffect(() => {
    if (selectedFamily !== "all" && status === "connected") {
      addTicker(selectedFamily);
    }
  }, [selectedFamily, status, addTicker]);

  // Auto-fill preço base from live data (unless manually edited)
  useEffect(() => {
    if (precoBaseManual || selectedFamily === "all" || status !== "connected") return;
    const row = rows.get(selectedFamily);
    const livePrice = row?.ultimo;
    if (livePrice && livePrice > 0) {
      setPrecoBase(livePrice.toFixed(2));
    }
  }, [selectedFamily, rows, status, precoBaseManual]);

  const precoBaseNum = parseFloat(precoBase) || 0;
  const strikeMinCalc = precoBaseNum > 0 ? precoBaseNum * (1 - pctAbaixo / 100) : 0;
  const strikeMaxCalc = precoBaseNum > 0 ? precoBaseNum * (1 + pctAcima / 100) : Infinity;
  const livePrice = selectedFamily !== "all" ? rows.get(selectedFamily)?.ultimo : null;

  const filtered = useMemo(() => {
    let result = dedupeOptionsByTicker(options);
    if (selectedFamily !== "all") result = result.filter((o) => o.family === selectedFamily);
    if (selectedVencimento !== "all") result = result.filter((o) => o.vencimento === selectedVencimento);
    if (selectedTipo !== "all") result = result.filter((o) => o.tipo === selectedTipo);
    if (search.trim()) result = filterOptionsByTicker(result, search);
    if (precoBaseNum > 0) {
      result = result.filter((o) => o.strike >= strikeMinCalc && o.strike <= strikeMaxCalc);
    }
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
  }, [options, selectedFamily, selectedVencimento, selectedTipo, search, precoBaseNum, strikeMinCalc, strikeMaxCalc, sortField, sortDir]);

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
    if (selectedRows.size === displayed.length) setSelectedRows(new Set());
    else setSelectedRows(new Set(displayed.map((o) => o.ticker)));
  }, [displayed, selectedRows.size]);

  const copySelection = useCallback(() => {
    const selected = filtered.filter((o) => selectedRows.has(o.ticker));
    if (selected.length === 0) { toast.error("Nenhuma opção selecionada"); return; }
    const text = selected.map((o) => `${o.ticker}\t${o.strike}\t${o.vencimento}\t${o.tipo}\t${o.precoUltimo}`).join("\n");
    navigator.clipboard.writeText(`Ticker\tStrike\tVencimento\tTipo\tÚltimo\n${text}`);
    toast.success(`${selected.length} opções copiadas`);
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

  const resetFilters = () => {
    setSearch("");
    setSelectedFamily("all");
    setSelectedVencimento("all");
    setSelectedTipo("all");
    setPrecoBase("");
    setPctAbaixo(20);
    setPctAcima(20);
    setSelectedRows(new Set());
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
          <div className="grid grid-cols-3 gap-4">
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
          </div>
          <Skeleton className="h-[400px] w-full" />
        </div>
      </ProfessionalLayout>
    );
  }

  const hasActiveFilters = search || selectedFamily !== "all" || selectedVencimento !== "all" || selectedTipo !== "all" || precoBaseNum > 0;

  return (
    <ProfessionalLayout>
      <div className="p-4 md:p-6 space-y-5 max-w-[1400px] mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Database className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-black uppercase tracking-wider text-foreground">
                Opções B3
              </h1>
              <p className="text-xs text-muted-foreground">
                {options.length.toLocaleString()} opções disponíveis
              </p>
            </div>
          </div>
          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={resetFilters} className="gap-1.5 text-muted-foreground hover:text-foreground">
              <RotateCcw className="h-3.5 w-3.5" /> Limpar
            </Button>
          )}
        </div>

        {/* Filters */}
        <div className="rounded-xl border border-border/50 bg-card/50 backdrop-blur-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-border/30 flex items-center gap-2">
            <Filter className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold text-foreground">Filtros</span>
            {hasActiveFilters && (
              <Badge variant="secondary" className="text-[10px] ml-auto">{filtered.length} resultados</Badge>
            )}
          </div>
          <div className="p-4 space-y-4">
            {/* Row 1: Search + Family + Vencimento + Tipo */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="col-span-2 md:col-span-1">
                <label className="text-[10px] uppercase text-muted-foreground font-bold tracking-wider mb-1.5 block">Buscar Ticker</label>
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="PETR, VALE..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-9 h-9 text-sm uppercase bg-background/50"
                  />
                </div>
              </div>
              <div>
                <label className="text-[10px] uppercase text-muted-foreground font-bold tracking-wider mb-1.5 block">Ativo Base</label>
                <Select value={selectedFamily} onValueChange={setSelectedFamily}>
                  <SelectTrigger className="h-9 text-sm bg-background/50"><SelectValue /></SelectTrigger>
                  <SelectContent className="max-h-[300px]">
                    <SelectItem value="all">Todos ({families.length})</SelectItem>
                    {families.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-[10px] uppercase text-muted-foreground font-bold tracking-wider mb-1.5 block">Vencimento</label>
                <Select value={selectedVencimento} onValueChange={setSelectedVencimento}>
                  <SelectTrigger className="h-9 text-sm bg-background/50"><SelectValue /></SelectTrigger>
                  <SelectContent className="max-h-[300px]">
                    <SelectItem value="all">Todos</SelectItem>
                    {availableVencimentos.map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-[10px] uppercase text-muted-foreground font-bold tracking-wider mb-1.5 block">Tipo</label>
                <Select value={selectedTipo} onValueChange={setSelectedTipo}>
                  <SelectTrigger className="h-9 text-sm bg-background/50"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="CALL">CALL</SelectItem>
                    <SelectItem value="PUT">PUT</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Row 2: Strike % Range */}
            <div className="rounded-lg border border-border/30 bg-background/30 p-3 space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-[10px] uppercase text-muted-foreground font-bold tracking-wider flex items-center gap-1.5">
                  <DollarSign className="h-3.5 w-3.5" /> Filtrar Strike por % do Preço Base
                </label>
                {precoBaseNum > 0 && (
                  <span className="text-[10px] font-mono text-primary">
                    R$ {strikeMinCalc.toFixed(2)} — R$ {strikeMaxCalc.toFixed(2)}
                  </span>
                )}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
                <div>
                  <label className="text-[10px] uppercase text-muted-foreground font-bold tracking-wider mb-1.5 block">Preço do Ativo (R$)</label>
                  <div className="relative">
                    <DollarSign className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="Ex: 35.50"
                      value={precoBase}
                      onChange={(e) => setPrecoBase(e.target.value)}
                      className="pl-9 h-9 text-sm bg-background/50 font-mono"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-[10px] uppercase text-muted-foreground font-bold tracking-wider mb-1.5 flex items-center gap-1">
                    <TrendingDown className="h-3 w-3 text-destructive" /> Abaixo: {pctAbaixo}%
                  </label>
                  <Slider
                    value={[pctAbaixo]}
                    onValueChange={([v]) => setPctAbaixo(v)}
                    min={1}
                    max={50}
                    step={1}
                    className="py-2"
                  />
                </div>
                <div>
                  <label className="text-[10px] uppercase text-muted-foreground font-bold tracking-wider mb-1.5 flex items-center gap-1">
                    <TrendingUp className="h-3 w-3 text-primary" /> Acima: {pctAcima}%
                  </label>
                  <Slider
                    value={[pctAcima]}
                    onValueChange={([v]) => setPctAcima(v)}
                    min={1}
                    max={50}
                    step={1}
                    className="py-2"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Actions bar */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">
              {filtered.length.toLocaleString()} resultados
              {filtered.length > 200 && <span className="text-primary/70"> (200 visíveis)</span>}
            </span>
            {selectedRows.size > 0 && (
              <Badge variant="default" className="text-[10px]">{selectedRows.size} selecionadas</Badge>
            )}
          </div>
          <Button
            size="sm"
            variant={selectedRows.size > 0 ? "default" : "outline"}
            onClick={copySelection}
            disabled={selectedRows.size === 0}
            className="gap-2 transition-all"
          >
            <Copy className="h-3.5 w-3.5" /> Copiar Seleção
          </Button>
        </div>

        {/* Table */}
        <div className="rounded-xl border border-border/50 bg-card/50 backdrop-blur-sm overflow-hidden">
          <div className="overflow-x-auto max-h-[55vh]">
            <Table>
              <TableHeader className="sticky top-0 bg-card/95 backdrop-blur-sm z-10 border-b border-border/30">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-10">
                    <input
                      type="checkbox"
                      checked={displayed.length > 0 && selectedRows.size === displayed.length}
                      onChange={selectAll}
                      className="accent-primary rounded"
                    />
                  </TableHead>
                  <TableHead className="cursor-pointer select-none group" onClick={() => handleSort("ticker")}>
                    <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider">
                      Ticker <ArrowUpDown className="h-3 w-3 opacity-40 group-hover:opacity-100 transition-opacity" />
                    </span>
                  </TableHead>
                  <TableHead className="text-xs font-bold uppercase tracking-wider">Família</TableHead>
                  <TableHead className="cursor-pointer select-none group" onClick={() => handleSort("strike")}>
                    <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider">
                      Strike <ArrowUpDown className="h-3 w-3 opacity-40 group-hover:opacity-100 transition-opacity" />
                    </span>
                  </TableHead>
                  <TableHead className="cursor-pointer select-none group" onClick={() => handleSort("vencimento")}>
                    <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider">
                      Vencimento <ArrowUpDown className="h-3 w-3 opacity-40 group-hover:opacity-100 transition-opacity" />
                    </span>
                  </TableHead>
                  <TableHead className="text-xs font-bold uppercase tracking-wider">Tipo</TableHead>
                  <TableHead className="cursor-pointer select-none text-right group" onClick={() => handleSort("precoUltimo")}>
                    <span className="flex items-center gap-1.5 justify-end text-xs font-bold uppercase tracking-wider">
                      Último <ArrowUpDown className="h-3 w-3 opacity-40 group-hover:opacity-100 transition-opacity" />
                    </span>
                  </TableHead>
                  {precoBaseNum > 0 && (
                    <TableHead className="text-right text-xs font-bold uppercase tracking-wider">Dist %</TableHead>
                  )}
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {displayed.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={precoBaseNum > 0 ? 9 : 8} className="text-center py-16 text-muted-foreground">
                      <Database className="h-8 w-8 mx-auto mb-2 opacity-30" />
                      <p className="text-sm">Nenhuma opção encontrada</p>
                      <p className="text-xs mt-1">Ajuste os filtros para ver resultados</p>
                    </TableCell>
                  </TableRow>
                ) : (
                  displayed.map((opt, i) => {
                    const distPct = precoBaseNum > 0 ? ((opt.strike - precoBaseNum) / precoBaseNum) * 100 : null;
                    return (
                      <TableRow
                        key={`${opt.ticker}-${i}`}
                        className={`transition-colors ${selectedRows.has(opt.ticker) ? "bg-primary/5 hover:bg-primary/10" : "hover:bg-muted/30"}`}
                      >
                        <TableCell>
                          <input
                            type="checkbox"
                            checked={selectedRows.has(opt.ticker)}
                            onChange={() => toggleRow(opt.ticker)}
                            className="accent-primary rounded"
                          />
                        </TableCell>
                        <TableCell className="font-mono font-bold text-foreground tracking-wide">{opt.ticker}</TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="text-[10px] font-semibold">{opt.family}</Badge>
                        </TableCell>
                        <TableCell className="font-mono tabular-nums">{opt.strike.toFixed(2)}</TableCell>
                        <TableCell className="text-sm tabular-nums">{opt.vencimento}</TableCell>
                        <TableCell>
                          <Badge
                            className={`text-[10px] font-bold border-0 ${
                              opt.tipo === "CALL"
                                ? "bg-primary/15 text-primary"
                                : "bg-destructive/15 text-destructive"
                            }`}
                          >
                            {opt.tipo}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-mono tabular-nums">
                          {opt.precoUltimo > 0 ? `R$ ${opt.precoUltimo.toFixed(2)}` : "—"}
                        </TableCell>
                        {precoBaseNum > 0 && (
                          <TableCell className={`text-right font-mono text-xs tabular-nums ${
                            distPct !== null ? (distPct > 0 ? "text-primary" : distPct < 0 ? "text-destructive" : "text-muted-foreground") : ""
                          }`}>
                            {distPct !== null ? `${distPct > 0 ? "+" : ""}${distPct.toFixed(1)}%` : "—"}
                          </TableCell>
                        )}
                        <TableCell>
                          <button
                            onClick={() => copyTicker(opt.ticker)}
                            className="p-1.5 rounded-md hover:bg-muted transition-colors"
                            title="Copiar ticker"
                          >
                            {copiedTicker === opt.ticker ? (
                              <Check className="h-3.5 w-3.5 text-primary" />
                            ) : (
                              <Copy className="h-3.5 w-3.5 text-muted-foreground" />
                            )}
                          </button>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>
    </ProfessionalLayout>
  );
}
