import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { useB3Options, type B3Option } from "@/contexts/B3OptionsContext";
import ProfessionalLayout from "@/components/ProfessionalLayout";
import Header from "@/components/Header";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, Copy, Check, Filter, Database, ArrowUpDown, TrendingDown, TrendingUp, DollarSign, RotateCcw, Wifi, Radio, Box, Zap, Send, Info, X as XIcon, Shield } from "lucide-react";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { useSharedRtdBridge } from "@/contexts/RtdBridgeContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

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

// Box Tracker localStorage types (must match BoxTrackerTab)
interface SavedFamily {
  name: string;
  tickers: string[];
  autoImported?: string[];
}
const BOX_STORAGE_KEY = "box-tracker-families";
const COLLAR_STORAGE_KEY = "collar-tracker-families";
const STRATEGY_STORAGE_KEY = "strategy-tracker-families";

// Top 18 most liquid B3 stocks for quick selection
const TOP_STOCKS = [
  { family: "PETR", label: "PETR", name: "Petrobras", sector: "Energia" },
  { family: "VALE", label: "VALE", name: "Vale", sector: "Mineração" },
  { family: "ITUB", label: "ITUB", name: "Itaú", sector: "Banco" },
  { family: "BBDC", label: "BBDC", name: "Bradesco", sector: "Banco" },
  { family: "B3SA", label: "B3SA", name: "B3", sector: "Bolsa" },
  { family: "ABEV", label: "ABEV", name: "Ambev", sector: "Bebidas" },
  { family: "BBAS", label: "BBAS", name: "BB", sector: "Banco" },
  { family: "WEGE", label: "WEGE", name: "WEG", sector: "Indústria" },
  { family: "RENT", label: "RENT", name: "Localiza", sector: "Locação" },
  { family: "MGLU", label: "MGLU", name: "Magalu", sector: "Varejo" },
  { family: "SUZB", label: "SUZB", name: "Suzano", sector: "Papel" },
  { family: "JBSS", label: "JBSS", name: "JBS", sector: "Alimentos" },
  { family: "GGBR", label: "GGBR", name: "Gerdau", sector: "Aço" },
  { family: "CSNA", label: "CSNA", name: "CSN", sector: "Siderurgia" },
  { family: "COGN", label: "COGN", name: "Cogna", sector: "Educação" },
  { family: "HAPV", label: "HAPV", name: "Hapvida", sector: "Saúde" },
  { family: "CYRE", label: "CYRE", name: "Cyrela", sector: "Imóveis" },
  { family: "RADL", label: "RADL", name: "Raia", sector: "Farmácia" },
];

export default function TickerOpcoes({ embedded = false }: { embedded?: boolean }) {
  const { options, families, vencimentos, loading } = useB3Options();
  const navigate = useNavigate();
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
  const [sentToRtd, setSentToRtd] = useState<Set<string>>(new Set());

  // NEW filter states
  const [onlyPaired, setOnlyPaired] = useState(false);
  const [moneyness, setMoneyness] = useState<string>("all");
  const [precoMin, setPrecoMin] = useState("");
  const [precoMax, setPrecoMax] = useState("");
  const [displayLimit, setDisplayLimit] = useState(100);

  // RTD Bridge — auto-fill preço base from live data
  const { status, rows, addTicker } = useSharedRtdBridge();

  // All candidate stock tickers for a family (try 4 first — most liquid PN shares)
  const stockCandidates = useMemo(() => {
    if (selectedFamily === "all") return [];
    return [`${selectedFamily}4`, `${selectedFamily}3`, `${selectedFamily}11`];
  }, [selectedFamily]);

  // Derive the stock ticker from family (e.g., VALE -> VALE3, PETR -> PETR4)
  const stockTicker = useMemo(() => {
    if (stockCandidates.length === 0) return null;
    for (const c of stockCandidates) {
      const row = rows.get(c);
      if (row?.ultimo && row.ultimo > 0) return c;
    }
    return stockCandidates[0];
  }, [stockCandidates, rows]);

  // Subscribe ALL candidate tickers to RTD when family is selected
  useEffect(() => {
    if (stockCandidates.length === 0 || status !== "connected") return;
    for (const c of stockCandidates) {
      addTicker(c);
    }
  }, [stockCandidates, status, addTicker]);

  // Estimate underlying price from ATM option strikes when RTD is unavailable
  const estimatedPriceFromOptions = useMemo(() => {
    if (selectedFamily === "all") return null;
    const familyOptions = options.filter((o) => o.family === selectedFamily && o.precoUltimo > 0);
    if (familyOptions.length === 0) return null;
    const strikes = familyOptions.map((o) => o.strike).sort((a, b) => a - b);
    const medianStrike = strikes[Math.floor(strikes.length / 2)];
    return medianStrike;
  }, [selectedFamily, options]);

  // Auto-fill preço base from live data OR fallback to estimated price
  useEffect(() => {
    if (precoBaseManual) return;
    if (stockTicker && status === "connected") {
      const row = rows.get(stockTicker);
      const live = row?.ultimo;
      if (live && live > 0) {
        setPrecoBase(live.toFixed(2));
        return;
      }
    }
    if (estimatedPriceFromOptions && estimatedPriceFromOptions > 0) {
      setPrecoBase(estimatedPriceFromOptions.toFixed(2));
    }
  }, [stockTicker, rows, status, precoBaseManual, estimatedPriceFromOptions]);

  const precoBaseNum = parseFloat(precoBase) || 0;
  const strikeMinCalc = precoBaseNum > 0 ? precoBaseNum * (1 - pctAbaixo / 100) : 0;
  const strikeMaxCalc = precoBaseNum > 0 ? precoBaseNum * (1 + pctAcima / 100) : Infinity;
  const livePrice = stockTicker ? rows.get(stockTicker)?.ultimo ?? null : null;

  // Pre-compute paired strike keys BEFORE filtering (needed for onlyPaired filter)
  const allPairedStrikeKeys = useMemo(() => {
    let base = dedupeOptionsByTicker(options);
    if (selectedFamily !== "all") base = base.filter((o) => o.family === selectedFamily);
    if (selectedVencimento !== "all") base = base.filter((o) => o.vencimento === selectedVencimento);

    const callKeys = new Set<string>();
    const putKeys = new Set<string>();
    base.forEach((o) => {
      const key = `${o.strike}|${o.vencimento}`;
      if (o.tipo === "CALL") callKeys.add(key);
      else putKeys.add(key);
    });
    const paired = new Set<string>();
    callKeys.forEach((k) => { if (putKeys.has(k)) paired.add(k); });
    return paired;
  }, [options, selectedFamily, selectedVencimento]);

  const precoMinNum = parseFloat(precoMin) || 0;
  const precoMaxNum = parseFloat(precoMax) || 0;

  const filtered = useMemo(() => {
    let result = dedupeOptionsByTicker(options);
    if (selectedFamily !== "all") result = result.filter((o) => o.family === selectedFamily);
    if (selectedVencimento !== "all") result = result.filter((o) => o.vencimento === selectedVencimento);
    if (selectedTipo !== "all") result = result.filter((o) => o.tipo === selectedTipo);
    if (search.trim()) result = filterOptionsByTicker(result, search);
    if (precoBaseNum > 0) {
      result = result.filter((o) => o.strike >= strikeMinCalc && o.strike <= strikeMaxCalc);
    }

    // NEW: Only paired (Call+Put)
    if (onlyPaired) {
      result = result.filter((o) => allPairedStrikeKeys.has(`${o.strike}|${o.vencimento}`));
    }

    // NEW: Moneyness filter
    if (moneyness !== "all" && precoBaseNum > 0) {
      result = result.filter((o) => {
        const ratio = o.strike / precoBaseNum;
        if (moneyness === "ITM") {
          return o.tipo === "CALL" ? ratio < 0.95 : ratio > 1.05;
        } else if (moneyness === "ATM") {
          return ratio >= 0.95 && ratio <= 1.05;
        } else if (moneyness === "OTM") {
          return o.tipo === "CALL" ? ratio > 1.05 : ratio < 0.95;
        }
        return true;
      });
    }

    // NEW: Premium range filter
    if (precoMinNum > 0) {
      result = result.filter((o) => o.precoUltimo >= precoMinNum);
    }
    if (precoMaxNum > 0) {
      result = result.filter((o) => o.precoUltimo <= precoMaxNum);
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
  }, [options, selectedFamily, selectedVencimento, selectedTipo, search, precoBaseNum, strikeMinCalc, strikeMaxCalc, sortField, sortDir, onlyPaired, allPairedStrikeKeys, moneyness, precoMinNum, precoMaxNum]);

  // Set of strike|vencimento keys that have both CALL and PUT (paired for box) — from filtered results
  const pairedStrikeKeys = useMemo(() => {
    const callKeys = new Set<string>();
    const putKeys = new Set<string>();
    filtered.forEach((o) => {
      const key = `${o.strike}|${o.vencimento}`;
      if (o.tipo === "CALL") callKeys.add(key);
      else putKeys.add(key);
    });
    const paired = new Set<string>();
    callKeys.forEach((k) => { if (putKeys.has(k)) paired.add(k); });
    return paired;
  }, [filtered]);

  // Reset displayLimit when filters change
  useEffect(() => {
    setDisplayLimit(100);
  }, [selectedFamily, selectedVencimento, selectedTipo, search, precoBaseNum, pctAbaixo, pctAcima, onlyPaired, moneyness, precoMinNum, precoMaxNum]);

  const displayed = filtered.slice(0, displayLimit);
  const remaining = filtered.length - displayLimit;

  // Assina no RTD as opções visíveis na tabela (até 80) para cotarem ao vivo —
  // senão, com o catálogo grande, a coluna Último fica vazia.
  const visibleTickers = useMemo(
    () => filtered.slice(0, Math.min(displayLimit, 80)).map((o) => o.ticker),
    [filtered, displayLimit]
  );
  useEffect(() => {
    if (status !== "connected") return;
    visibleTickers.forEach((t) => addTicker(t));
  }, [visibleTickers, status, addTicker]);

  // ─── BOX OPPORTUNITIES ─────────────────────────────────────
  // Tickers candidatos a Box (pares call+put por strike, próximos do ATM) —
  // subscritos no RTD para receberem BID/ASK ao vivo antes de virarem oportunidade.
  const boxCandidateTickers = useMemo(() => {
    if (selectedFamily === "all" || precoBaseNum <= 0) return [] as string[];
    const groups = new Map<string, { call?: B3Option; put?: B3Option; strike: number }>();
    filtered.forEach((o) => {
      const key = `${o.strike}|${o.vencimento}`;
      if (!groups.has(key)) groups.set(key, { strike: o.strike });
      const g = groups.get(key)!;
      if (o.tipo === "CALL") g.call = o; else g.put = o;
    });
    const pairs = [...groups.values()].filter((g) => g.call && g.put);
    pairs.sort((a, b) => Math.abs(a.strike - precoBaseNum) - Math.abs(b.strike - precoBaseNum));
    return pairs.slice(0, 20).flatMap((g) => [g.call!.ticker, g.put!.ticker]);
  }, [filtered, selectedFamily, precoBaseNum]);

  useEffect(() => {
    if (status !== "connected") return;
    boxCandidateTickers.forEach((t) => addTicker(t));
  }, [boxCandidateTickers, status, addTicker]);

  const boxOpportunities = useMemo(() => {
    if (selectedFamily === "all" || precoBaseNum <= 0) return [];
    const groups = new Map<string, { calls: B3Option[]; puts: B3Option[] }>();
    filtered.forEach((o) => {
      const key = `${o.strike}|${o.vencimento}`;
      if (!groups.has(key)) groups.set(key, { calls: [], puts: [] });
      const g = groups.get(key)!;
      if (o.tipo === "CALL") g.calls.push(o);
      else g.puts.push(o);
    });

    const stockRow = stockTicker ? rows.get(stockTicker) : null;
    // Ativo ao vivo (RTD do ativo ou preço ao vivo); nunca um valor manual/estimado.
    const liveStock = (livePrice && livePrice > 0 && !precoBaseManual) ? livePrice : null;
    const stockAsk = stockRow?.ofVenda ?? stockRow?.ultimo ?? liveStock;

    const opportunities: Array<{
      strike: number;
      vencimento: string;
      call: B3Option;
      put: B3Option;
      custo: number;
      lucro: number;
      lucroPct: number;
      stockPrice: number;
      callPrice: number;
      putPrice: number;
      isLive: boolean;
    }> = [];

    groups.forEach((g) => {
      if (g.calls.length === 0 || g.puts.length === 0) return;
      const call = g.calls[0];
      const put = g.puts[0];

      const callRow = rows.get(call.ticker);
      const putRow = rows.get(put.ticker);
      const callBid = callRow?.ofCompra ?? null;
      const putAsk = putRow?.ofVenda ?? null;
      const liveStrike = callRow?.strike ?? putRow?.strike ?? null;

      // Box só é confiável com TUDO ao vivo e do mesmo feed: BID da call, ASK da
      // put, ASK do ativo e o strike ajustado do Profit. Sem isso, os preços de
      // fechamento do JSON geram lucros-fantasma (strike desatualizado por proventos).
      if (callBid === null || callBid <= 0) return;
      if (putAsk === null || putAsk <= 0) return;
      if (stockAsk === null || stockAsk <= 0) return;
      if (liveStrike === null || liveStrike <= 0) return;

      const callPrice = callBid;
      const putPrice = putAsk;
      const usedStock = stockAsk;
      const strikeReal = liveStrike;

      // Sanidade: a call (BID) não pode valer bem menos que o intrínseco (ativo −
      // strike). Se valer, os dados estão incoerentes — descarta.
      const intrinsic = Math.max(0, usedStock - strikeReal);
      if (callPrice < intrinsic - 0.05) return;

      const custo = (usedStock + putPrice) - callPrice;
      if (custo <= 0) return;
      const lucro = strikeReal - custo;
      const lucroPct = (lucro / custo) * 100;
      if (lucro > 0) {
        opportunities.push({
          strike: strikeReal, vencimento: call.vencimento,
          call, put, custo, lucro, lucroPct,
          stockPrice: usedStock, callPrice, putPrice, isLive: true,
        });
      }
    });

    return opportunities.sort((a, b) => b.lucroPct - a.lucroPct).slice(0, 10);
  }, [filtered, selectedFamily, precoBaseNum, rows, stockTicker, livePrice, precoBaseManual]);

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
    setPrecoBaseManual(false);
    setPctAbaixo(20);
    setPctAcima(20);
    setSelectedRows(new Set());
    setOnlyPaired(false);
    setMoneyness("all");
    setPrecoMin("");
    setPrecoMax("");
    setDisplayLimit(100);
  };

  const availableVencimentos = useMemo(() => {
    if (selectedFamily === "all") return vencimentos;
    const fOpts = options.filter((o) => o.family === selectedFamily);
    const vSet = new Set(fOpts.map((o) => o.vencimento));
    return vencimentos.filter((v) => vSet.has(v));
  }, [selectedFamily, options, vencimentos]);

  // Próximo vencimento mensal (3ª sexta) a partir de hoje — default dos cálculos
  const nextMonthlyExpiry = useMemo(() => {
    const list = availableVencimentos;
    if (list.length === 0) return "all";
    const now = new Date();
    const thirdFriday = (year: number, month: number): Date => {
      const first = new Date(year, month, 1);
      const firstFriday = ((5 - first.getDay()) + 7) % 7 + 1;
      return new Date(year, month, firstFriday + 14);
    };
    const parse = (v: string): Date | null => {
      const p = v.split("/");
      return p.length === 3 ? new Date(+p[2], +p[1] - 1, +p[0]) : null;
    };
    // 1ª tentativa: próximo vencimento mensal (±2 dias da 3ª sexta, por feriados)
    for (const v of list) {
      const d = parse(v);
      if (d && d >= now) {
        const tf = thirdFriday(d.getFullYear(), d.getMonth());
        if (Math.abs(d.getTime() - tf.getTime()) / 86400000 <= 2) return v;
      }
    }
    // Fallback: primeiro vencimento futuro
    for (const v of list) {
      const d = parse(v);
      if (d && d >= now) return v;
    }
    return list[0] || "all";
  }, [availableVencimentos]);

  // Default: ao escolher um ativo, já seleciona o próximo vencimento mensal
  const prevFamilyRef = useRef<string | null>(null);
  useEffect(() => {
    if (selectedFamily !== "all" && prevFamilyRef.current !== selectedFamily) {
      if (nextMonthlyExpiry && nextMonthlyExpiry !== "all") {
        setSelectedVencimento(nextMonthlyExpiry);
      }
    }
    prevFamilyRef.current = selectedFamily;
  }, [selectedFamily, nextMonthlyExpiry]);

  // ─── INTEGRATION: Send single ticker to RTD ────────────────
  const sendToRtd = useCallback((ticker: string) => {
    if (status !== "connected") {
      toast.error("Bridge não conectado. Conecte o Profit RTD Bridge primeiro.");
      return;
    }
    addTicker(ticker);
    setSentToRtd((prev) => new Set(prev).add(ticker));
    toast.success(`${ticker} adicionado ao Tempo Real`);
  }, [status, addTicker]);

  // ─── INTEGRATION: Send selected tickers to RTD (bulk) ──────
  const sendSelectedToRtd = useCallback(() => {
    if (status !== "connected") {
      toast.error("Bridge não conectado. Conecte o Profit RTD Bridge primeiro.");
      return;
    }
    const selected = filtered.filter((o) => selectedRows.has(o.ticker));
    if (selected.length === 0) { toast.error("Nenhuma opção selecionada"); return; }
    const limit = Math.min(selected.length, 20);
    const toSend = selected.slice(0, limit);
    toSend.forEach((o) => addTicker(o.ticker));
    setSentToRtd((prev) => {
      const next = new Set(prev);
      toSend.forEach((o) => next.add(o.ticker));
      return next;
    });
    toast.success(`${toSend.length} tickers enviados ao Tempo Real${selected.length > 20 ? " (máx 20)" : ""}`);
  }, [status, addTicker, filtered, selectedRows]);

  // ─── INTEGRATION: Monitor all family tickers ───────────────
  const monitorFamily = useCallback(() => {
    if (status !== "connected") {
      toast.error("Bridge não conectado. Conecte o Profit RTD Bridge primeiro.");
      return;
    }
    if (selectedFamily === "all") {
      toast.error("Selecione uma família primeiro");
      return;
    }
    const familyOpts = filtered.slice(0, 20);
    familyOpts.forEach((o) => addTicker(o.ticker));
    setSentToRtd((prev) => {
      const next = new Set(prev);
      familyOpts.forEach((o) => next.add(o.ticker));
      return next;
    });
    toast.success(`${familyOpts.length} opções de ${selectedFamily} enviadas ao Tempo Real`);
  }, [status, addTicker, selectedFamily, filtered]);

  // ─── INTEGRATION: Send selected pair to Box Tracker ────────
  const sendSelectedToBox = useCallback(() => {
    const selected = filtered.filter((o) => selectedRows.has(o.ticker));
    const calls = selected.filter((o) => o.tipo === "CALL");
    const puts = selected.filter((o) => o.tipo === "PUT");
    if (calls.length === 0 || puts.length === 0) {
      toast.error("Selecione pelo menos 1 CALL e 1 PUT");
      return;
    }
    const familyName = calls[0]?.family || puts[0]?.family || selectedFamily;
    if (!familyName || familyName === "all") {
      toast.error("Não foi possível determinar a família");
      return;
    }
    const putsByStrike = new Map(puts.map((p) => [p.strike, p]));
    const pairedTickers: string[] = [];
    for (const call of calls) {
      const matchingPut = putsByStrike.get(call.strike);
      if (matchingPut) {
        pairedTickers.push(call.ticker, matchingPut.ticker);
        putsByStrike.delete(call.strike);
      }
    }
    if (pairedTickers.length === 0) {
      toast.error("Nenhum par Call+Put com mesmo strike encontrado na seleção");
      return;
    }
    const tickers = pairedTickers;

    let existingFamilies: SavedFamily[] = [];
    try {
      const saved = localStorage.getItem(BOX_STORAGE_KEY);
      if (saved) existingFamilies = JSON.parse(saved);
    } catch {}

    const existingIdx = existingFamilies.findIndex((f) => f.name === familyName);
    if (existingIdx >= 0) {
      const existing = new Set(existingFamilies[existingIdx].tickers);
      tickers.forEach((t) => existing.add(t));
      existingFamilies[existingIdx].tickers = Array.from(existing);
      const autoSet = new Set(existingFamilies[existingIdx].autoImported || []);
      tickers.forEach((t) => autoSet.add(t));
      existingFamilies[existingIdx].autoImported = Array.from(autoSet);
    } else {
      existingFamilies.push({ name: familyName, tickers, autoImported: [...tickers] });
    }

    localStorage.setItem(BOX_STORAGE_KEY, JSON.stringify(existingFamilies));
    toast.success(`${tickers.length} tickers enviados ao Rastrear Box (${familyName})`);
    navigate("/box-tracker");
  }, [filtered, selectedRows, selectedFamily, navigate]);

  // ─── INTEGRATION: Send selected to Collar Tracker ─────────
  const sendSelectedToCollar = useCallback(() => {
    const selected = filtered.filter((o) => selectedRows.has(o.ticker));
    const familyName = selected[0]?.family || selectedFamily;
    if (!familyName || familyName === "all") {
      toast.error("Não foi possível determinar a família");
      return;
    }
    const tickers = selected.map((o) => o.ticker);

    let existingFamilies: SavedFamily[] = [];
    try {
      const saved = localStorage.getItem(COLLAR_STORAGE_KEY);
      if (saved) existingFamilies = JSON.parse(saved);
    } catch {}

    const existingIdx = existingFamilies.findIndex((f) => f.name === familyName);
    if (existingIdx >= 0) {
      const existing = new Set(existingFamilies[existingIdx].tickers);
      tickers.forEach((t) => existing.add(t));
      existingFamilies[existingIdx].tickers = Array.from(existing);
      const autoSet = new Set(existingFamilies[existingIdx].autoImported || []);
      tickers.forEach((t) => autoSet.add(t));
      existingFamilies[existingIdx].autoImported = Array.from(autoSet);
    } else {
      existingFamilies.push({ name: familyName, tickers, autoImported: [...tickers] });
    }

    localStorage.setItem(COLLAR_STORAGE_KEY, JSON.stringify(existingFamilies));
    toast.success(`${tickers.length} tickers enviados ao Rastrear Collar (${familyName})`);
    navigate("/collar-tracker");
  }, [filtered, selectedRows, selectedFamily, navigate]);

  // ─── INTEGRATION: Send selected to Strategy Tracker PRO ────
  const sendSelectedToStrategy = useCallback(() => {
    const selected = filtered.filter((o) => selectedRows.has(o.ticker));
    const familyName = selected[0]?.family || selectedFamily;
    if (!familyName || familyName === "all") {
      toast.error("Não foi possível determinar a família");
      return;
    }
    const tickers = selected.map((o) => o.ticker);
    // Get the most common vencimento from selected options
    const vencimentoCount = new Map<string, number>();
    selected.forEach((o) => {
      if (o.vencimento) vencimentoCount.set(o.vencimento, (vencimentoCount.get(o.vencimento) || 0) + 1);
    });
    let bestVencimento = "";
    let bestCount = 0;
    vencimentoCount.forEach((count, v) => { if (count > bestCount) { bestCount = count; bestVencimento = v; } });

    let existingFamilies: SavedFamily[] = [];
    try {
      const saved = localStorage.getItem(STRATEGY_STORAGE_KEY);
      if (saved) existingFamilies = JSON.parse(saved);
    } catch {}

    const existingIdx = existingFamilies.findIndex((f) => f.name === familyName);
    if (existingIdx >= 0) {
      const existing = new Set(existingFamilies[existingIdx].tickers);
      tickers.forEach((t) => existing.add(t));
      existingFamilies[existingIdx].tickers = Array.from(existing);
      const autoSet = new Set(existingFamilies[existingIdx].autoImported || []);
      tickers.forEach((t) => autoSet.add(t));
      existingFamilies[existingIdx].autoImported = Array.from(autoSet);
      if (bestVencimento) (existingFamilies[existingIdx] as any).vencimento = bestVencimento;
    } else {
      existingFamilies.push({ name: familyName, tickers, autoImported: [...tickers], ...(bestVencimento ? { vencimento: bestVencimento } : {}) } as any);
    }

    localStorage.setItem(STRATEGY_STORAGE_KEY, JSON.stringify(existingFamilies));
    toast.success(`${tickers.length} tickers enviados ao Rastreador de Estratégias (${familyName})`);
    navigate("/strategy-tracker");
  }, [filtered, selectedRows, selectedFamily, navigate]);

  const sendOpportunityToBox = useCallback((call: B3Option, put: B3Option) => {
    const familyName = call.family;
    const tickers = [call.ticker, put.ticker];

    let existingFamilies: SavedFamily[] = [];
    try {
      const saved = localStorage.getItem(BOX_STORAGE_KEY);
      if (saved) existingFamilies = JSON.parse(saved);
    } catch {}

    const existingIdx = existingFamilies.findIndex((f) => f.name === familyName);
    if (existingIdx >= 0) {
      const existing = new Set(existingFamilies[existingIdx].tickers);
      tickers.forEach((t) => existing.add(t));
      existingFamilies[existingIdx].tickers = Array.from(existing);
      const autoSet = new Set(existingFamilies[existingIdx].autoImported || []);
      tickers.forEach((t) => autoSet.add(t));
      existingFamilies[existingIdx].autoImported = Array.from(autoSet);
    } else {
      existingFamilies.push({ name: familyName, tickers, autoImported: [...tickers] });
    }

    localStorage.setItem(BOX_STORAGE_KEY, JSON.stringify(existingFamilies));
    toast.success(`Par ${call.ticker}/${put.ticker} enviado ao Rastrear Box`);
    navigate("/box-tracker");
  }, [navigate]);

  // Check if selection has valid call+put pair for box
  const selectedHasBoxPair = useMemo(() => {
    const selected = filtered.filter((o) => selectedRows.has(o.ticker));
    return selected.some((o) => o.tipo === "CALL") && selected.some((o) => o.tipo === "PUT");
  }, [filtered, selectedRows]);

  // Instructional banner dismiss
  const [showInstructions, setShowInstructions] = useState(() => {
    try { return localStorage.getItem("opcoes-b3-instructions-dismissed") !== "true"; } catch { return true; }
  });
  const dismissInstructions = () => {
    setShowInstructions(false);
    localStorage.setItem("opcoes-b3-instructions-dismissed", "true");
  };

  // Pair counter
  const pairCount = pairedStrikeKeys.size;

  // ─── Active filter chips ───────────────────────────────────
  const activeFilterChips = useMemo(() => {
    const chips: Array<{ label: string; onRemove: () => void }> = [];
    if (search) chips.push({ label: `Busca: ${search}`, onRemove: () => setSearch("") });
    if (selectedFamily !== "all") chips.push({ label: selectedFamily, onRemove: () => setSelectedFamily("all") });
    if (selectedVencimento !== "all") chips.push({ label: `Venc: ${selectedVencimento}`, onRemove: () => setSelectedVencimento("all") });
    if (selectedTipo !== "all") chips.push({ label: selectedTipo, onRemove: () => setSelectedTipo("all") });
    if (onlyPaired) chips.push({ label: "Apenas PAR", onRemove: () => setOnlyPaired(false) });
    if (moneyness !== "all") chips.push({ label: moneyness, onRemove: () => setMoneyness("all") });
    if (precoMinNum > 0) chips.push({ label: `Prêmio ≥ R$${precoMin}`, onRemove: () => setPrecoMin("") });
    if (precoMaxNum > 0) chips.push({ label: `Prêmio ≤ R$${precoMax}`, onRemove: () => setPrecoMax("") });
    if (precoBaseNum > 0 && (pctAbaixo !== 20 || pctAcima !== 20)) {
      chips.push({ label: `Strike: -${pctAbaixo}% / +${pctAcima}%`, onRemove: () => { setPctAbaixo(20); setPctAcima(20); } });
    }
    return chips;
  }, [search, selectedFamily, selectedVencimento, selectedTipo, onlyPaired, moneyness, precoMinNum, precoMaxNum, precoMin, precoMax, precoBaseNum, pctAbaixo, pctAcima]);

  // Count active filters for badge
  const activeFilterCount = activeFilterChips.length;

  if (loading) {
    return (
      <ProfessionalLayout className={embedded ? "!min-h-0 !bg-transparent" : ""}>
        {!embedded && <Header />}
        <div className={embedded ? "space-y-4" : "p-6 space-y-4"}>
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

  const hasActiveFilters = activeFilterCount > 0 || precoBaseNum > 0;

  return (
    <ProfessionalLayout className={embedded ? "!min-h-0 !bg-transparent" : ""}>
      {!embedded && <Header />}
      <div className={embedded ? "space-y-5" : "p-4 md:p-6 space-y-5 max-w-[1400px] mx-auto"}>
        {/* Hero */}
        <div className="rounded-2xl border border-primary/25 bg-gradient-to-br from-primary/[0.08] via-card to-card p-4 sm:p-5 shadow-[0_8px_30px_-12px_hsl(var(--primary)/0.3)] flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-2xl bg-primary text-primary-foreground flex items-center justify-center shadow-[0_0_22px_-4px_hsl(var(--primary))] shrink-0">
              <Database className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black uppercase tracking-wider text-foreground leading-tight">
                Banco de Opções
              </h1>
              <p className="text-sm text-muted-foreground font-medium">
                <span className="text-primary font-black">{options.length.toLocaleString()}</span> opções da B3
                {pairCount > 0 && (
                  <span className="ml-2 text-primary font-semibold">· {pairCount} pares Call+Put</span>
                )}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {selectedFamily !== "all" && (
              <Button
                size="sm"
                variant="outline"
                onClick={monitorFamily}
                className="gap-1.5 text-xs"
                title="Monitorar as 20 opções mais próximas do ATM no Tempo Real"
              >
                <Radio className="h-3.5 w-3.5" /> Monitorar {selectedFamily}
              </Button>
            )}
            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={resetFilters} className="gap-1.5 text-muted-foreground hover:text-foreground">
                <RotateCcw className="h-3.5 w-3.5" /> Limpar
              </Button>
            )}
          </div>
        </div>

        {/* Instructional Banner */}
        {showInstructions && (
          <div className="rounded-xl border border-primary/20 bg-primary/5 backdrop-blur-sm p-4 relative">
            <button
              onClick={dismissInstructions}
              className="absolute top-3 right-3 text-muted-foreground hover:text-foreground transition-colors"
            >
              <XIcon className="h-4 w-4" />
            </button>
            <div className="flex items-center gap-2 mb-3">
              <Info className="h-4 w-4 text-primary" />
              <span className="text-sm font-bold text-foreground">Como usar o Banco de Opções</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="flex items-start gap-2.5">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">1</span>
                <div>
                  <p className="text-xs font-semibold text-foreground">Filtre por família e vencimento</p>
                  <p className="text-xs leading-snug font-medium text-muted-foreground">Selecione um ativo (ex: PETR) e o vencimento desejado</p>
                </div>
              </div>
              <div className="flex items-start gap-2.5">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">2</span>
                <div>
                  <p className="text-xs font-semibold text-foreground">Selecione os tickers</p>
                  <p className="text-xs leading-snug font-medium text-muted-foreground">Marque com checkbox — opções com <span className="text-primary font-bold">PAR</span> são ideais para Box</p>
                </div>
              </div>
              <div className="flex items-start gap-2.5">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">3</span>
                <div>
                  <p className="text-xs font-semibold text-foreground">Envie automaticamente</p>
                  <p className="text-xs leading-snug font-medium text-muted-foreground">Use "Tempo Real", "Rastrear Box" ou "Rastrear Collar" para enviar os tickers selecionados</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Quick-select top stocks — compact dark cards */}
        <div className="rounded-xl border border-border/40 bg-gradient-to-b from-card/80 to-card/40 backdrop-blur-md overflow-hidden shadow-lg shadow-black/10" style={{ perspective: "800px" }}>
          <div className="px-4 py-3 border-b border-border/30 flex items-center gap-2.5">
            <div className="h-7 w-7 rounded-lg bg-primary/15 flex items-center justify-center shrink-0">
              <Zap className="h-4 w-4 text-primary" />
            </div>
            <div className="flex flex-col leading-tight">
              <span className="text-sm font-black uppercase tracking-wide text-foreground">Seleção Rápida</span>
              <span className="text-[11px] text-muted-foreground">Toque num ativo para ver as opções · Top 18</span>
            </div>
            {selectedFamily !== "all" && (
              <button
                onClick={() => setSelectedFamily("all")}
                className="ml-auto text-xs font-semibold text-destructive hover:text-destructive/80 flex items-center gap-1 transition-colors bg-destructive/10 hover:bg-destructive/20 px-2.5 py-1 rounded-md border border-destructive/30"
              >
                <XIcon className="h-3.5 w-3.5" /> Limpar
              </button>
            )}
          </div>
          <div className="px-3 py-3 border-t border-border/20">
            <div className="grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-px bg-border/50 rounded-lg overflow-hidden shadow-inner shadow-black/5" style={{ transform: "rotateX(1deg)" }}>
              {TOP_STOCKS.map((stock, index) => {
                const isActive = selectedFamily === stock.family;
                const familyExists = families.includes(stock.family);
                if (!familyExists) return null;
                const count = options.filter((o) => o.family === stock.family).length;
                return (
                  <motion.button
                    key={stock.family}
                    initial={{ opacity: 0, y: 12, scale: 0.9 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ duration: 0.3, delay: index * 0.04, ease: "easeOut" }}
                    whileHover={{ scale: 1.03, boxShadow: "0 4px 16px hsl(var(--primary) / 0.15)" }}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => setSelectedFamily(isActive ? "all" : stock.family)}
                    className={`group relative flex items-center gap-2 px-3.5 py-3 transition-colors duration-200 ${
                      isActive
                        ? "bg-primary/15 shadow-[inset_0_2px_8px_hsl(var(--primary)/0.2)]"
                        : index < 6
                          ? "bg-amber-50 dark:bg-amber-950/20 hover:bg-amber-100 dark:hover:bg-amber-900/30"
                          : "bg-card hover:bg-muted/60"
                    }`}
                  >
                    {index < 6 && (
                      <span className="flex items-center justify-center h-5 w-5 rounded-full bg-gradient-to-br from-amber-400 to-amber-500 text-white text-[10px] font-black shadow-sm shrink-0">
                        {index + 1}
                      </span>
                    )}
                    <span className={`text-sm font-black tracking-wide ${
                      isActive ? "text-primary" : index < 6 ? "text-amber-600 dark:text-amber-400 group-hover:text-amber-500" : "text-foreground group-hover:text-primary"
                    } transition-colors`}>
                      {stock.label}
                    </span>
                    <span className={`text-[10px] font-medium ${
                      isActive ? "text-primary/70" : "text-muted-foreground group-hover:text-foreground/70"
                    } transition-colors`}>
                      {stock.name}
                    </span>
                  </motion.button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Filters — painel sólido */}
        <div className="rounded-xl border border-border bg-card overflow-hidden shadow-md">
          <div className="px-4 py-3 border-b border-border bg-muted/30 flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg bg-primary/15 flex items-center justify-center">
              <Filter className="h-3.5 w-3.5 text-primary" />
            </div>
            <span className="text-sm font-bold text-foreground">Filtros Avançados</span>
            {activeFilterCount > 0 && (
              <Badge className="text-[10px] bg-primary/15 text-primary border border-primary/20 font-bold">{activeFilterCount} ativos</Badge>
            )}
            {hasActiveFilters && (
              <Badge variant="secondary" className="text-[10px] ml-auto font-mono">{filtered.length.toLocaleString()} resultados</Badge>
            )}
          </div>
          <div className="p-4 space-y-4">
            {/* Barra de busca em destaque */}
            <div>
              <label className="text-[11px] uppercase text-primary font-bold tracking-widest mb-1.5 flex items-center gap-1.5">
                <Search className="h-3.5 w-3.5" /> Buscar Ticker
              </label>
              <div className="relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-5 w-5 text-primary/70 pointer-events-none" />
                <Input
                  placeholder="Digite o ativo: PETR, VALE, BBAS..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-11 h-12 text-base uppercase font-semibold bg-background border-2 border-primary/30 focus:border-primary focus-visible:ring-2 focus-visible:ring-primary/20 shadow-sm transition-all placeholder:normal-case placeholder:font-normal placeholder:text-muted-foreground"
                />
              </div>
            </div>
            {/* Row 1: Family + Vencimento + Tipo */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <div>
                <label className="text-[11px] uppercase text-foreground/70 font-bold tracking-wide mb-1.5 block">Escolher o Ativo</label>
                <Select value={selectedFamily} onValueChange={setSelectedFamily}>
                  <SelectTrigger className="h-11 text-sm font-medium bg-background border-border focus:border-primary/60"><SelectValue /></SelectTrigger>
                  <SelectContent className="max-h-[300px]">
                    <SelectItem value="all">Todos ({families.length})</SelectItem>
                    {families.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-[11px] uppercase text-foreground/70 font-bold tracking-wide mb-1.5 flex items-center gap-1.5">
                  <span className="relative flex h-2.5 w-2.5">
                    {selectedVencimento === "all" && (
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                    )}
                    <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${selectedVencimento === "all" ? "bg-amber-500" : "bg-emerald-500"}`} />
                  </span>
                  Vencimento
                  <span className={`normal-case tracking-normal font-semibold ${selectedVencimento === "all" ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400"}`}>
                    {selectedVencimento === "all" ? "· escolha o mês" : "· mês definido"}
                  </span>
                </label>
                <Select value={selectedVencimento} onValueChange={setSelectedVencimento}>
                  <SelectTrigger className={`h-11 text-sm font-bold bg-background focus:border-primary/60 ${selectedVencimento === "all" ? "border-2 border-amber-400/70 ring-2 ring-amber-400/20" : "border-2 border-emerald-500/40"}`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="max-h-[300px]">
                    <SelectItem value="all">Todos os meses</SelectItem>
                    {availableVencimentos.map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
                <p className="text-[10px] text-muted-foreground mt-1 leading-tight">Defina o mês para lucro, retorno e dias úteis corretos.</p>
              </div>
              <div>
                <label className="text-[11px] uppercase text-foreground/70 font-bold tracking-wide mb-1.5 block">Tipo</label>
                <Select value={selectedTipo} onValueChange={setSelectedTipo}>
                  <SelectTrigger className="h-11 text-sm font-medium bg-background border-border focus:border-primary/60"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="CALL">CALL</SelectItem>
                    <SelectItem value="PUT">PUT</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Row 2: Moneyness + Apenas PAR + Faixa de Prêmio */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 items-end">
              <div>
                <label className="text-[11px] uppercase text-foreground/70 font-bold tracking-wide mb-1.5 block">Moneyness</label>
                <Select value={moneyness} onValueChange={setMoneyness}>
                  <SelectTrigger className="h-11 text-sm font-medium bg-background border-border focus:border-primary/60"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="ITM">ITM (In The Money)</SelectItem>
                    <SelectItem value="ATM">ATM (±5%)</SelectItem>
                    <SelectItem value="OTM">OTM (Out The Money)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] uppercase text-foreground/70 font-bold tracking-wide flex items-center gap-1.5">
                  <Box className="h-3 w-3" /> Apenas com PAR
                </label>
                <div className="flex items-center gap-2 h-11 px-3 rounded-md bg-background border border-border">
                  <Switch checked={onlyPaired} onCheckedChange={setOnlyPaired} />
                  <span className={`text-xs font-semibold ${onlyPaired ? "text-primary" : "text-muted-foreground"}`}>
                    {onlyPaired ? `${allPairedStrikeKeys.size} pares` : "Off"}
                  </span>
                </div>
              </div>
              <div>
                <label className="text-[11px] uppercase text-foreground/70 font-bold tracking-wide mb-1.5 block">Prêmio Mín (R$)</label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={precoMin}
                  onChange={(e) => setPrecoMin(e.target.value)}
                  className="h-11 text-sm font-medium bg-background border-border focus:border-primary/60 font-mono"
                />
              </div>
              <div>
                <label className="text-[11px] uppercase text-foreground/70 font-bold tracking-wide mb-1.5 block">Prêmio Máx (R$)</label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="∞"
                  value={precoMax}
                  onChange={(e) => setPrecoMax(e.target.value)}
                  className="h-11 text-sm font-medium bg-background border-border focus:border-primary/60 font-mono"
                />
              </div>
            </div>

            {/* Row 3: Strike % Range — card destacado */}
            <div className="rounded-xl border border-primary/25 bg-primary/[0.06] p-4 space-y-3 shadow-sm">
              <div className="flex items-center justify-between">
                <label className="text-[11px] uppercase text-foreground/70 font-bold tracking-wide flex items-center gap-1.5">
                  <DollarSign className="h-3.5 w-3.5 text-primary" /> Filtrar Strike por % do Preço Base
                </label>
                {precoBaseNum > 0 && (
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-destructive/10 text-destructive border border-destructive/20">
                      R$ {strikeMinCalc.toFixed(2)}
                    </span>
                    <span className="text-[10px] text-muted-foreground">—</span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-primary/10 text-primary border border-primary/20">
                      R$ {strikeMaxCalc.toFixed(2)}
                    </span>
                  </div>
                )}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                <div>
                  <label className="text-[11px] uppercase text-foreground/70 font-bold tracking-wide mb-1.5 flex items-center gap-1.5">
                    Preço do Ativo (R$)
                    {livePrice && livePrice > 0 && !precoBaseManual && (
                      <span className="flex items-center gap-0.5 text-primary">
                        <Wifi className="h-3 w-3 animate-pulse" /> ao vivo
                      </span>
                    )}
                  </label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-primary/70 pointer-events-none" />
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="Ex: 35.50"
                      value={precoBase}
                      onChange={(e) => { setPrecoBase(e.target.value); setPrecoBaseManual(true); }}
                      className="pl-9 h-11 text-sm font-medium bg-background border-border focus:border-primary/60 font-mono"
                    />
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-[11px] uppercase text-foreground/70 font-bold tracking-wide flex items-center gap-1">
                      <TrendingDown className="h-3 w-3 text-destructive" /> Abaixo
                    </label>
                    <span className="text-xs font-bold font-mono text-destructive">{pctAbaixo}%</span>
                  </div>
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
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-[11px] uppercase text-foreground/70 font-bold tracking-wide flex items-center gap-1">
                      <TrendingUp className="h-3 w-3 text-primary" /> Acima
                    </label>
                    <span className="text-xs font-bold font-mono text-primary">{pctAcima}%</span>
                  </div>
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

          {/* Active filter chips */}
          {activeFilterChips.length > 0 && (
            <div className="px-4 pb-3 flex flex-wrap gap-1.5">
              {activeFilterChips.map((chip, i) => (
                <button
                  key={i}
                  onClick={chip.onRemove}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold border border-primary/20 hover:bg-destructive/10 hover:text-destructive hover:border-destructive/20 transition-colors group"
                >
                  {chip.label}
                  <XIcon className="h-3 w-3 opacity-60 group-hover:opacity-100" />
                </button>
              ))}
              <button
                onClick={resetFilters}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                <RotateCcw className="h-3 w-3" /> Limpar todos
              </button>
            </div>
          )}
        </div>

        {/* Box Opportunities */}
        {/* Estado vazio: ativo selecionado, mas sem oportunidade de Box ao vivo */}
        {selectedFamily !== "all" && precoBaseNum > 0 && boxOpportunities.length === 0 && (
          <div className="rounded-xl border border-border bg-muted/30 p-4 flex items-start gap-3">
            <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
              <Box className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="text-sm min-w-0">
              <p className="font-bold text-foreground mb-0.5">Sem oportunidade de Box ao vivo para {selectedFamily} agora</p>
              {boxCandidateTickers.length === 0 ? (
                <p className="text-muted-foreground text-xs leading-relaxed">
                  O catálogo de opções não tem pares Call+Put no mesmo strike para este ativo/vencimento —
                  o banco de dados pode estar desatualizado. Tente outro vencimento ou atualize o catálogo.
                </p>
              ) : status === "connected" ? (
                <p className="text-muted-foreground text-xs leading-relaxed">
                  <b className="text-foreground">Abra a grade de opções do {selectedFamily} no seu Profit Pro</b> —
                  o Profit só envia as cotações (BID/ASK) das opções que estão abertas nele. Assim que abrir, os
                  dados chegam em segundos. Se mesmo assim não aparecer, o ativo pode não ter arbitragem positiva
                  neste vencimento (comum em papéis de baixa liquidez).
                </p>
              ) : (
                <p className="text-muted-foreground text-xs leading-relaxed">
                  Conecte o Profit Pro para receber BID/ASK ao vivo e ver as oportunidades reais (sem dados ao vivo, não exibimos números para não induzir a erro).
                </p>
              )}
            </div>
          </div>
        )}

        {boxOpportunities.length > 0 && (
          <div className="rounded-xl border border-primary/30 bg-primary/5 backdrop-blur-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-primary/20">
              <div className="flex items-center gap-2.5">
                <div className="h-8 w-8 rounded-lg bg-primary/15 flex items-center justify-center shrink-0">
                  <Box className="h-4 w-4 text-primary" />
                </div>
                <div className="flex flex-col leading-tight">
                  <span className="text-sm font-black text-foreground">
                    Oportunidades de Box <span className="font-medium text-muted-foreground">· renda fixa sintética</span>
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    Comprar a ação + a put e vender a call trava um <b className="text-foreground">lucro garantido</b> no vencimento — como um CDI. Toque para levar ao Rastrear Box.
                  </span>
                </div>
                <Badge variant="default" className="text-xs ml-auto shrink-0">{boxOpportunities.length} achadas</Badge>
              </div>
              {/* Legenda do que cada número significa */}
              <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
                <span><b className="text-foreground">Monta por</b> = sai do bolso hoje</span>
                <span><b className="text-foreground">Recebe</b> = garantido no vencimento (o strike)</span>
                <span><b className="text-emerald-600 dark:text-emerald-400">Lucro</b> = diferença travada</span>
                <span><b className="text-primary">%</b> = retorno até vencer</span>
              </div>
            </div>
            <div className="p-3 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2.5">
              {boxOpportunities.map((opp) => (
                <button
                  key={`${opp.call.ticker}-${opp.put.ticker}`}
                  onClick={() => sendOpportunityToBox(opp.call, opp.put)}
                  className="text-left rounded-xl border-2 border-border/50 bg-card p-3.5 hover:border-primary/50 hover:shadow-lg hover:shadow-primary/10 hover:-translate-y-0.5 transition-all group"
                >
                  {/* Topo: strike + retorno */}
                  <div className="flex items-center justify-between mb-2 pb-2 border-b border-border/40">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-black text-foreground">Strike {opp.strike.toFixed(2)}</span>
                      {opp.isLive && (
                        <span className="inline-flex items-center gap-0.5 text-[9px] font-bold text-emerald-600 dark:text-emerald-400">
                          <Wifi className="h-2.5 w-2.5" /> ao vivo
                        </span>
                      )}
                    </div>
                    <div className="text-right leading-none">
                      <div className={`text-base font-black ${opp.lucroPct > 1.5 ? "text-primary" : "text-muted-foreground"}`}>
                        {opp.lucroPct.toFixed(2)}%
                      </div>
                      <div className="text-[9px] text-muted-foreground uppercase tracking-wide">retorno</div>
                    </div>
                  </div>

                  {/* Valores em destaque, rotulados */}
                  <div className="space-y-1 text-xs">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Monta por</span>
                      <span className="font-semibold text-foreground">R$ {opp.custo.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Recebe no venc.</span>
                      <span className="font-semibold text-foreground">R$ {opp.strike.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center rounded-md bg-emerald-500/10 px-1.5 py-1 -mx-0.5">
                      <span className="text-emerald-700 dark:text-emerald-300 font-semibold">Lucro travado</span>
                      <span className="font-black text-emerald-600 dark:text-emerald-400">R$ {opp.lucro.toFixed(2)}</span>
                    </div>
                  </div>

                  {/* Rodapé: códigos, preços e vencimento */}
                  <div className="mt-2 pt-2 border-t border-border/40 space-y-1">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-mono font-semibold text-foreground">{opp.call.ticker} <span className="font-sans font-normal text-muted-foreground">call</span></span>
                      <span className="font-mono font-semibold text-foreground">{opp.put.ticker} <span className="font-sans font-normal text-muted-foreground">put</span></span>
                    </div>
                    <div className="text-[10px] text-muted-foreground">
                      Ativo {opp.stockPrice.toFixed(2)} · Call {opp.callPrice.toFixed(2)} · Put {opp.putPrice.toFixed(2)}
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-muted-foreground">Vence {opp.vencimento}</span>
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                        <Send className="h-2.5 w-2.5" /> Rastrear
                      </span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Actions bar */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">
              {filtered.length.toLocaleString()} resultados
              {filtered.length > displayLimit && <span className="text-primary/70"> ({displayLimit} visíveis)</span>}
            </span>
            {selectedRows.size > 0 && (
              <Badge variant="default" className="text-xs">{selectedRows.size} selecionadas</Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            {selectedRows.size > 0 ? (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={sendSelectedToRtd}
                  className="gap-1.5 text-xs"
                  title="Enviar selecionados ao Tempo Real (máx 20)"
                >
                  <Radio className="h-3.5 w-3.5" /> Tempo Real
                </Button>
                {selectedHasBoxPair && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={sendSelectedToBox}
                    className="gap-1.5 text-xs border-primary/40 text-primary hover:bg-primary/10"
                    title="Enviar Call+Put selecionados ao Rastrear Box"
                  >
                    <Box className="h-3.5 w-3.5" /> Rastrear Box
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={sendSelectedToCollar}
                  className="gap-1.5 text-xs border-primary/40 text-primary hover:bg-primary/10"
                  title="Enviar selecionados ao Rastrear Collar"
                >
                  <Shield className="h-3.5 w-3.5" /> Rastrear Collar
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={sendSelectedToStrategy}
                  className="gap-1.5 text-xs border-amber-500/40 text-amber-600 hover:bg-amber-500/10"
                  title="Enviar selecionados ao Rastreador de Estratégias PRO"
                >
                  <Zap className="h-3.5 w-3.5" /> Estratégias PRO
                </Button>
              </>
            ) : (
              <span className="text-xs text-muted-foreground italic">Selecione opções na tabela para enviar</span>
            )}
            <Button
              size="sm"
              variant={selectedRows.size > 0 ? "default" : "outline"}
              onClick={copySelection}
              disabled={selectedRows.size === 0}
              className="gap-2 transition-all"
            >
              <Copy className="h-3.5 w-3.5" /> Copiar
            </Button>
          </div>
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
                  <TableHead className="w-20 text-xs font-bold uppercase tracking-wider text-center">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {displayed.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={precoBaseNum > 0 ? 10 : 9} className="text-center py-16 text-muted-foreground">
                      <Database className="h-8 w-8 mx-auto mb-2 opacity-30" />
                      <p className="text-sm">Nenhuma opção encontrada</p>
                      <p className="text-xs mt-1">Ajuste os filtros para ver resultados</p>
                    </TableCell>
                  </TableRow>
                ) : (
                  displayed.map((opt, i) => {
                    // Strike ao vivo do Profit (ajustado por proventos) tem prioridade sobre o nominal do JSON
                    const liveStrike = rows.get(opt.ticker)?.strike;
                    const effStrike = (liveStrike != null && liveStrike > 0) ? liveStrike : opt.strike;
                    const distPct = precoBaseNum > 0 ? ((effStrike - precoBaseNum) / precoBaseNum) * 100 : null;
                    const isSentToRtd = sentToRtd.has(opt.ticker);
                    const isPaired = pairedStrikeKeys.has(`${opt.strike}|${opt.vencimento}`);
                    return (
                      <TableRow
                        key={`${opt.ticker}-${i}`}
                        className={`transition-colors ${selectedRows.has(opt.ticker) ? "bg-primary/5 hover:bg-primary/10" : isPaired ? "hover:bg-muted/30 border-l-2 border-l-primary/50" : "hover:bg-muted/30 opacity-60"}`}
                      >
                        <TableCell>
                          <input
                            type="checkbox"
                            checked={selectedRows.has(opt.ticker)}
                            onChange={() => toggleRow(opt.ticker)}
                            className="accent-primary rounded"
                          />
                        </TableCell>
                        <TableCell className="font-mono font-bold text-foreground tracking-wide">
                          <span className="flex items-center gap-1.5">
                            {opt.ticker}
                            {isPaired && (
                              <TooltipProvider delayDuration={200}>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-primary/15 text-primary text-xs font-bold border border-primary/20 cursor-help">
                                      <Box className="h-2.5 w-2.5" /> PAR
                                    </span>
                                  </TooltipTrigger>
                                  <TooltipContent side="top" className="max-w-[200px]">
                                    <p className="text-xs">Este strike tem Call e Put disponíveis — ideal para montar Box Spread</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            )}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="text-xs font-semibold">{opt.family}</Badge>
                        </TableCell>
                        <TableCell className="font-mono tabular-nums">{effStrike.toFixed(2)}</TableCell>
                        <TableCell className="text-sm tabular-nums">{opt.vencimento}</TableCell>
                        <TableCell>
                          <Badge
                            className={`text-xs font-bold border-0 ${
                              opt.tipo === "CALL"
                                ? "bg-primary/15 text-primary"
                                : "bg-destructive/15 text-destructive"
                            }`}
                          >
                            {opt.tipo}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-mono tabular-nums">
                          {(() => {
                            const rtdRow = rows.get(opt.ticker);
                            const rtdUltimo = rtdRow?.ultimo;
                            const displayPrice = (rtdUltimo && rtdUltimo > 0) ? rtdUltimo : opt.precoUltimo;
                            const isLive = rtdUltimo && rtdUltimo > 0;
                            return displayPrice > 0 ? (
                              <span className={isLive ? "text-primary font-semibold" : ""}>
                                R$ {displayPrice.toFixed(2)}
                                {isLive && <Wifi className="inline h-3 w-3 ml-1 opacity-60" />}
                              </span>
                            ) : "—";
                          })()}
                        </TableCell>
                        {precoBaseNum > 0 && (
                          <TableCell className={`text-right font-mono text-xs tabular-nums ${
                            distPct !== null ? (distPct > 0 ? "text-primary" : distPct < 0 ? "text-destructive" : "text-muted-foreground") : ""
                          }`}>
                            {distPct !== null ? `${distPct > 0 ? "+" : ""}${distPct.toFixed(1)}%` : "—"}
                          </TableCell>
                        )}
                        <TableCell>
                          <div className="flex items-center justify-center gap-0.5">
                            <button
                              onClick={() => sendToRtd(opt.ticker)}
                              className={`p-1.5 rounded-md transition-colors ${isSentToRtd ? "text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}
                              title={isSentToRtd ? "Já enviado ao Tempo Real" : "Enviar ao Tempo Real"}
                            >
                              {isSentToRtd ? (
                                <Check className="h-3.5 w-3.5" />
                              ) : (
                                <Radio className="h-3.5 w-3.5" />
                              )}
                            </button>
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
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>

          {/* Load more button */}
          {remaining > 0 && (
            <div className="px-4 py-3 border-t border-border/30 flex items-center justify-center">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setDisplayLimit((prev) => prev + 100)}
                className="gap-2 text-xs"
              >
                Carregar mais 100 <span className="text-muted-foreground">(restam {remaining.toLocaleString()})</span>
              </Button>
            </div>
          )}
        </div>
      </div>
    </ProfessionalLayout>
  );
}
