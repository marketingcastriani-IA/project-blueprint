// ============================================================
// RASTREADOR DE ESTRATÉGIAS PRO X — Tempo Real via Profit RTD Bridge
// 10 Estratégias: Alta, Baixa, Lateral, Volatilidade
// Multi-Asset Save/Track + Volume Filter
// ============================================================

import { useState, useMemo, useCallback, useEffect } from "react";
import { toast } from "sonner";
import trophyGold from "@/assets/trophy-gold.png";
import trophySilver from "@/assets/trophy-silver.png";
import trophyBronze from "@/assets/trophy-bronze.png";
import {
  TrendingUp, TrendingDown, Activity, Target, Layers,
  ChevronDown, ChevronUp, Trophy, Wifi, WifiOff, Info,
  Database, Filter, Zap, BarChart2, ArrowUpDown,
  DollarSign, Percent, Star, AlertTriangle, Crosshair,
  ArrowLeftRight, GitBranch, Anchor, Rocket,
  Plus, Trash2, Save, X, Check,
} from "lucide-react";
import { useSharedRtdBridge } from "@/contexts/RtdBridgeContext";
import { useB3Options, type B3Option } from "@/contexts/B3OptionsContext";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Area, CartesianGrid, ReferenceLine, XAxis, YAxis, ComposedChart, Line, ResponsiveContainer } from "recharts";
import { calculatePayoffAtExpiry } from "@/lib/payoff";

// ─── TIPOS ───────────────────────────────────────────────────
type MarketView = "alta" | "baixa" | "lateral" | "volatilidade";
type StrategyType =
  | "covered_call"
  | "bull_call_spread"
  | "bull_put_spread"
  | "cash_secured_put"
  | "bear_put_spread"
  | "bear_call_spread"
  | "iron_condor"
  | "butterfly"
  | "straddle"
  | "strangle";

interface StrategyDef {
  id: StrategyType;
  label: string;
  view: MarketView;
  icon: typeof TrendingUp;
  description: string;
  composition: string;
}

interface StrategyResult {
  id: string;
  strategy: StrategyType;
  strategyLabel: string;
  legs: { ticker: string; side: "buy" | "sell"; type: "CALL" | "PUT" | "STOCK"; strike: number; price: number; qty: number }[];
  maxProfit: number;
  maxLoss: number;
  breakeven: number[];
  returnPct: number;
  qualityScore: number;
  netCredit: number;
  vencimento: string;
  isLive: boolean;
}

interface SavedAsset {
  family: string;
  label: string;
  addedAt: string;
}

const STRATEGIES: StrategyDef[] = [
  // ALTA
  { id: "covered_call", label: "Venda Coberta", view: "alta", icon: TrendingUp, description: "Gera renda vendendo Call do ativo em carteira", composition: "Ação + Venda Call" },
  { id: "bull_call_spread", label: "Trava de Alta (Call)", view: "alta", icon: Rocket, description: "Aposta na alta com risco limitado", composition: "Compra Call K1 + Venda Call K2" },
  { id: "bull_put_spread", label: "Trava de Alta (Put)", view: "alta", icon: TrendingUp, description: "Recebe crédito apostando que não cai", composition: "Venda Put K1 + Compra Put K2" },
  // BAIXA
  { id: "cash_secured_put", label: "Venda de Put", view: "baixa", icon: Anchor, description: "Recebe prêmio aceitando comprar o ativo", composition: "Venda Put" },
  { id: "bear_put_spread", label: "Trava de Baixa (Put)", view: "baixa", icon: TrendingDown, description: "Aposta na queda com risco limitado", composition: "Compra Put K1 + Venda Put K2" },
  { id: "bear_call_spread", label: "Trava de Baixa (Call)", view: "baixa", icon: TrendingDown, description: "Recebe crédito apostando que não sobe", composition: "Venda Call K1 + Compra Call K2" },
  // LATERAL
  { id: "iron_condor", label: "Iron Condor", view: "lateral", icon: ArrowLeftRight, description: "Lucra se o ativo ficar dentro do range", composition: "Trava Put + Trava Call" },
  { id: "butterfly", label: "Borboleta", view: "lateral", icon: Layers, description: "Lucro máximo se o ativo fechar no strike central", composition: "C1 + 2×V C2 + C3" },
  // VOLATILIDADE
  { id: "straddle", label: "Straddle", view: "volatilidade", icon: GitBranch, description: "Lucra com movimentos grandes em qualquer direção", composition: "Compra Call + Compra Put (mesmo K)" },
  { id: "strangle", label: "Strangle", view: "volatilidade", icon: Crosshair, description: "Lucra com movimento forte, custo menor que Straddle", composition: "Compra Call K2 + Compra Put K1" },
];

const TOP_STOCKS = [
  { family: "PETR", label: "PETR", name: "Petrobras" },
  { family: "VALE", label: "VALE", name: "Vale" },
  { family: "ITUB", label: "ITUB", name: "Itaú" },
  { family: "BBDC", label: "BBDC", name: "Bradesco" },
  { family: "B3SA", label: "B3SA", name: "B3" },
  { family: "ABEV", label: "ABEV", name: "Ambev" },
  { family: "BBAS", label: "BBAS", name: "BB" },
  { family: "WEGE", label: "WEGE", name: "WEG" },
  { family: "RENT", label: "RENT", name: "Localiza" },
  { family: "MGLU", label: "MGLU", name: "Magalu" },
  { family: "SUZB", label: "SUZB", name: "Suzano" },
  { family: "JBSS", label: "JBSS", name: "JBS" },
  { family: "GGBR", label: "GGBR", name: "Gerdau" },
  { family: "CSNA", label: "CSNA", name: "CSN" },
  { family: "COGN", label: "COGN", name: "Cogna" },
  { family: "HAPV", label: "HAPV", name: "Hapvida" },
  { family: "CYRE", label: "CYRE", name: "Cyrela" },
  { family: "RADL", label: "RADL", name: "Raia" },
];

const SAVED_ASSETS_KEY = "strategy-tracker-saved-assets";
const STRATEGY_STORAGE_KEY = "strategy-tracker-families";

const trophyImages = [trophyGold, trophySilver, trophyBronze];
const trophyLabels = ["🥇 MELHOR", "🥈 2º LUGAR", "🥉 3º LUGAR"];

const VIEW_CONFIG: Record<MarketView, { label: string; emoji: string; color: string; border: string; bg: string; glow: string }> = {
  alta: { label: "ALTA", emoji: "📈", color: "text-emerald-500", border: "border-emerald-500/40", bg: "from-emerald-500/15 to-emerald-500/5", glow: "shadow-[0_0_20px_rgba(16,185,129,0.15)]" },
  baixa: { label: "BAIXA", emoji: "📉", color: "text-red-500", border: "border-red-500/40", bg: "from-red-500/15 to-red-500/5", glow: "shadow-[0_0_20px_rgba(239,68,68,0.15)]" },
  lateral: { label: "LATERAL", emoji: "➡️", color: "text-amber-500", border: "border-amber-500/40", bg: "from-amber-500/15 to-amber-500/5", glow: "shadow-[0_0_20px_rgba(245,158,11,0.15)]" },
  volatilidade: { label: "VOLATILIDADE", emoji: "⚡", color: "text-violet-500", border: "border-violet-500/40", bg: "from-violet-500/15 to-violet-500/5", glow: "shadow-[0_0_20px_rgba(139,92,246,0.15)]" },
};

function parseVencimento(v: string): Date | null {
  const [d, m, y] = v.split("/").map(Number);
  if (!d || !m || !y) return null;
  return new Date(y, m - 1, d);
}

function diasUteis(from: Date, to: Date): number {
  let count = 0;
  const curr = new Date(from);
  while (curr < to) {
    curr.setDate(curr.getDate() + 1);
    const dow = curr.getDay();
    if (dow !== 0 && dow !== 6) count++;
  }
  return count;
}

// ─── COMPONENTE PRINCIPAL ────────────────────────────────────
export default function StrategyTrackerTab() {
  const { options, vencimentos } = useB3Options();
  const { status, rows, addTicker } = useSharedRtdBridge();

  // ─── SAVED ASSETS (multi-asset tracking) ──────────────────
  const [savedAssets, setSavedAssets] = useState<SavedAsset[]>(() => {
    try {
      const saved = localStorage.getItem(SAVED_ASSETS_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });
  const [customAssetInput, setCustomAssetInput] = useState("");

  const [selectedFamily, setSelectedFamily] = useState<string>("");
  const [selectedStrategy, setSelectedStrategy] = useState<StrategyType>("covered_call");
  const [selectedVencimento, setSelectedVencimento] = useState<string>("all");
  const [moneynessFilter, setMoneynessFilter] = useState<string>("all");
  const [minPremium, setMinPremium] = useState("");
  const [minTrades, setMinTrades] = useState("");
  const [quantity, setQuantity] = useState("100");
  const [cdiRate, setCdiRate] = useState("14.65");
  const [showCdi, setShowCdi] = useState(true);
  const [expandedResult, setExpandedResult] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<"return" | "quality" | "profit">("return");

  // Persist saved assets
  useEffect(() => {
    localStorage.setItem(SAVED_ASSETS_KEY, JSON.stringify(savedAssets));
  }, [savedAssets]);

  // Load initial selected family from saved assets
  useEffect(() => {
    if (!selectedFamily && savedAssets.length > 0) {
      setSelectedFamily(savedAssets[0].family);
    }
  }, []);

  const addSavedAsset = useCallback((family: string, label?: string) => {
    setSavedAssets((prev) => {
      if (prev.find((a) => a.family === family)) {
        toast.info(`${family} já está na lista de rastreamento`);
        return prev;
      }
      toast.success(`${family} adicionado ao rastreamento!`);
      return [...prev, { family, label: label || family, addedAt: new Date().toISOString() }];
    });
  }, []);

  const removeSavedAsset = useCallback((family: string) => {
    setSavedAssets((prev) => prev.filter((a) => a.family !== family));
    if (selectedFamily === family) {
      setSelectedFamily("");
    }
    toast.info(`${family} removido do rastreamento`);
  }, [selectedFamily]);

  const handleAddCustomAsset = useCallback(() => {
    const input = customAssetInput.trim().toUpperCase();
    if (!input || input.length < 3) {
      toast.error("Digite pelo menos 3 letras do ativo");
      return;
    }
    // Extract family (first 4 letters)
    const family = input.replace(/\d+$/, "").substring(0, 4);
    if (family.length < 3) {
      toast.error("Ativo inválido");
      return;
    }
    addSavedAsset(family, family);
    setCustomAssetInput("");
    setSelectedFamily(family);
  }, [customAssetInput, addSavedAsset]);

  const selectAndSaveAsset = useCallback((family: string, label: string) => {
    setSelectedFamily(family);
    addSavedAsset(family, label);
  }, [addSavedAsset]);

  // Derive stock ticker
  const stockCandidates = useMemo(() => {
    if (!selectedFamily) return [];
    return [`${selectedFamily}4`, `${selectedFamily}3`, `${selectedFamily}11`];
  }, [selectedFamily]);

  const stockTicker = useMemo(() => {
    if (stockCandidates.length === 0) return null;
    for (const c of stockCandidates) {
      const row = rows.get(c);
      if (row?.ultimo && row.ultimo > 0) return c;
    }
    return stockCandidates[0];
  }, [stockCandidates, rows]);

  useEffect(() => {
    if (stockCandidates.length === 0 || status !== "connected") return;
    for (const c of stockCandidates) addTicker(c);
  }, [stockCandidates, status, addTicker]);

  const stockPrice = useMemo(() => {
    if (stockTicker) {
      const row = rows.get(stockTicker);
      if (row?.ultimo && row.ultimo > 0) return row.ultimo;
    }
    if (!selectedFamily) return 0;
    const familyOpts = options.filter((o) => o.family === selectedFamily && o.precoUltimo > 0);
    if (familyOpts.length === 0) return 0;
    const strikes = familyOpts.map((o) => o.strike).sort((a, b) => a - b);
    return strikes[Math.floor(strikes.length / 2)];
  }, [stockTicker, rows, selectedFamily, options]);

  const availableVencimentos = useMemo(() => {
    if (!selectedFamily) return vencimentos;
    const fOpts = options.filter((o) => o.family === selectedFamily);
    const vSet = new Set(fOpts.map((o) => o.vencimento));
    return vencimentos.filter((v) => vSet.has(v));
  }, [selectedFamily, options, vencimentos]);

  const getPrice = useCallback((ticker: string, field: "ofCompra" | "ofVenda" | "ultimo"): { price: number; isLive: boolean } => {
    const row = rows.get(ticker);
    if (row) {
      const val = row[field];
      if (val && val > 0) return { price: val, isLive: true };
      if (row.ultimo && row.ultimo > 0) return { price: row.ultimo, isLive: true };
    }
    const opt = options.find((o) => o.ticker === ticker);
    return { price: opt?.precoUltimo ?? 0, isLive: false };
  }, [rows, options]);

  // Helper: check if option has enough trades (volume)
  const hasMinTrades = useCallback((ticker: string): boolean => {
    const minT = parseInt(minTrades) || 0;
    if (minT <= 0) return true;
    const row = rows.get(ticker);
    if (row?.negocios && row.negocios >= minT) return true;
    // Also check from B3 options data
    const opt = options.find((o) => o.ticker === ticker);
    if (opt && (opt as any).negocios >= minT) return true;
    // If no trade data available and filter is set, check volume
    return false;
  }, [minTrades, rows, options]);

  // ─── SCAN ENGINE ──────────────────────────────────────────
  const results = useMemo((): StrategyResult[] => {
    if (!selectedFamily || stockPrice <= 0) return [];

    let opts = options.filter((o) => o.family === selectedFamily);
    if (selectedVencimento !== "all") opts = opts.filter((o) => o.vencimento === selectedVencimento);

    if (moneynessFilter !== "all" && stockPrice > 0) {
      const margin = stockPrice * 0.05;
      if (moneynessFilter === "itm") opts = opts.filter((o) => o.tipo === "CALL" ? o.strike < stockPrice : o.strike > stockPrice);
      else if (moneynessFilter === "atm") opts = opts.filter((o) => Math.abs(o.strike - stockPrice) <= margin);
      else if (moneynessFilter === "otm") opts = opts.filter((o) => o.tipo === "CALL" ? o.strike > stockPrice : o.strike < stockPrice);
    }

    const calls = opts.filter((o) => o.tipo === "CALL").sort((a, b) => a.strike - b.strike);
    const puts = opts.filter((o) => o.tipo === "PUT").sort((a, b) => a.strike - b.strike);
    const minPrem = parseFloat(minPremium) || 0;
    const qty = parseInt(quantity) || 100;

    if (status === "connected") opts.slice(0, 80).forEach((o) => addTicker(o.ticker));

    const allResults: StrategyResult[] = [];
    const stratLabel = STRATEGIES.find((s) => s.id === selectedStrategy)?.label ?? "";

    // ── VENDA COBERTA ──────────────────────────────────────
    if (selectedStrategy === "covered_call") {
      for (const call of calls) {
        if (!hasMinTrades(call.ticker)) continue;
        const { price: callPrice, isLive } = getPrice(call.ticker, "ofCompra");
        if (callPrice <= 0 || callPrice < minPrem) continue;
        const returnPct = (callPrice / stockPrice) * 100;
        const maxProfit = (call.strike - stockPrice + callPrice) * qty;
        const maxLoss = (stockPrice - callPrice) * qty;
        const breakeven = stockPrice - callPrice;
        allResults.push({
          id: `cc_${call.ticker}`, strategy: "covered_call", strategyLabel: stratLabel,
          legs: [
            { ticker: stockTicker || `${selectedFamily}4`, side: "buy", type: "STOCK", strike: 0, price: stockPrice, qty },
            { ticker: call.ticker, side: "sell", type: "CALL", strike: call.strike, price: callPrice, qty },
          ],
          maxProfit, maxLoss, breakeven: [breakeven], returnPct,
          qualityScore: maxProfit > 0 && maxLoss > 0 ? maxProfit / maxLoss : 0,
          netCredit: callPrice * qty, vencimento: call.vencimento, isLive,
        });
      }
    }

    // ── VENDA DE PUT ───────────────────────────────────────
    if (selectedStrategy === "cash_secured_put") {
      for (const put of puts) {
        if (!hasMinTrades(put.ticker)) continue;
        const { price: putPrice, isLive } = getPrice(put.ticker, "ofCompra");
        if (putPrice <= 0 || putPrice < minPrem) continue;
        const returnPct = (putPrice / put.strike) * 100;
        const maxProfit = putPrice * qty;
        const maxLoss = (put.strike - putPrice) * qty;
        allResults.push({
          id: `csp_${put.ticker}`, strategy: "cash_secured_put", strategyLabel: stratLabel,
          legs: [{ ticker: put.ticker, side: "sell", type: "PUT", strike: put.strike, price: putPrice, qty }],
          maxProfit, maxLoss, breakeven: [put.strike - putPrice], returnPct,
          qualityScore: maxLoss > 0 ? maxProfit / maxLoss : 0,
          netCredit: putPrice * qty, vencimento: put.vencimento, isLive,
        });
      }
    }

    // ── TRAVA DE ALTA COM CALL (debit) ─────────────────────
    if (selectedStrategy === "bull_call_spread") {
      for (let i = 0; i < calls.length; i++) {
        for (let j = i + 1; j < calls.length && j < i + 8; j++) {
          const lc = calls[i], sc = calls[j];
          if (lc.vencimento !== sc.vencimento) continue;
          if (!hasMinTrades(lc.ticker) || !hasMinTrades(sc.ticker)) continue;
          const { price: lp, isLive: l1 } = getPrice(lc.ticker, "ofVenda");
          const { price: sp, isLive: l2 } = getPrice(sc.ticker, "ofCompra");
          if (lp <= 0 || sp <= 0) continue;
          const netCost = lp - sp;
          if (netCost <= 0) continue;
          if (minPrem > 0 && netCost < minPrem) continue;
          const width = sc.strike - lc.strike;
          const maxProfit = (width - netCost) * qty;
          const maxLoss = netCost * qty;
          const returnPct = maxLoss > 0 ? (maxProfit / maxLoss) * 100 : 0;
          allResults.push({
            id: `bcs_${lc.ticker}_${sc.ticker}`, strategy: "bull_call_spread", strategyLabel: stratLabel,
            legs: [
              { ticker: lc.ticker, side: "buy", type: "CALL", strike: lc.strike, price: lp, qty },
              { ticker: sc.ticker, side: "sell", type: "CALL", strike: sc.strike, price: sp, qty },
            ],
            maxProfit, maxLoss, breakeven: [lc.strike + netCost], returnPct,
            qualityScore: maxLoss > 0 ? maxProfit / maxLoss : 0,
            netCredit: -netCost * qty, vencimento: lc.vencimento, isLive: l1 && l2,
          });
        }
      }
    }

    // ── TRAVA DE ALTA COM PUT (credit) ─────────────────────
    if (selectedStrategy === "bull_put_spread") {
      for (let i = 0; i < puts.length; i++) {
        for (let j = i + 1; j < puts.length && j < i + 8; j++) {
          const buyPut = puts[i]; // lower strike
          const sellPut = puts[j]; // higher strike
          if (buyPut.vencimento !== sellPut.vencimento) continue;
          if (!hasMinTrades(buyPut.ticker) || !hasMinTrades(sellPut.ticker)) continue;
          const { price: bp, isLive: l1 } = getPrice(buyPut.ticker, "ofVenda");
          const { price: sp, isLive: l2 } = getPrice(sellPut.ticker, "ofCompra");
          if (bp <= 0 || sp <= 0) continue;
          const netCredit = sp - bp;
          if (netCredit <= 0) continue;
          const width = sellPut.strike - buyPut.strike;
          const maxProfit = netCredit * qty;
          const maxLoss = (width - netCredit) * qty;
          const returnPct = maxLoss > 0 ? (maxProfit / maxLoss) * 100 : 0;
          allResults.push({
            id: `bups_${buyPut.ticker}_${sellPut.ticker}`, strategy: "bull_put_spread", strategyLabel: stratLabel,
            legs: [
              { ticker: sellPut.ticker, side: "sell", type: "PUT", strike: sellPut.strike, price: sp, qty },
              { ticker: buyPut.ticker, side: "buy", type: "PUT", strike: buyPut.strike, price: bp, qty },
            ],
            maxProfit, maxLoss, breakeven: [sellPut.strike - netCredit], returnPct,
            qualityScore: maxLoss > 0 ? maxProfit / maxLoss : 0,
            netCredit: maxProfit, vencimento: buyPut.vencimento, isLive: l1 && l2,
          });
        }
      }
    }

    // ── TRAVA DE BAIXA COM PUT (debit) ─────────────────────
    if (selectedStrategy === "bear_put_spread") {
      for (let i = 0; i < puts.length; i++) {
        for (let j = i + 1; j < puts.length && j < i + 8; j++) {
          const shortPut = puts[i]; const longPut = puts[j];
          if (shortPut.vencimento !== longPut.vencimento) continue;
          if (!hasMinTrades(shortPut.ticker) || !hasMinTrades(longPut.ticker)) continue;
          const { price: lp, isLive: l1 } = getPrice(longPut.ticker, "ofVenda");
          const { price: sp, isLive: l2 } = getPrice(shortPut.ticker, "ofCompra");
          if (lp <= 0 || sp <= 0) continue;
          const netCost = lp - sp;
          if (netCost <= 0) continue;
          const width = longPut.strike - shortPut.strike;
          const maxProfit = (width - netCost) * qty;
          const maxLoss = netCost * qty;
          const returnPct = maxLoss > 0 ? (maxProfit / maxLoss) * 100 : 0;
          allResults.push({
            id: `bps_${longPut.ticker}_${shortPut.ticker}`, strategy: "bear_put_spread", strategyLabel: stratLabel,
            legs: [
              { ticker: longPut.ticker, side: "buy", type: "PUT", strike: longPut.strike, price: lp, qty },
              { ticker: shortPut.ticker, side: "sell", type: "PUT", strike: shortPut.strike, price: sp, qty },
            ],
            maxProfit, maxLoss, breakeven: [longPut.strike - netCost], returnPct,
            qualityScore: maxLoss > 0 ? maxProfit / maxLoss : 0,
            netCredit: -netCost * qty, vencimento: longPut.vencimento, isLive: l1 && l2,
          });
        }
      }
    }

    // ── TRAVA DE BAIXA COM CALL (credit) ───────────────────
    if (selectedStrategy === "bear_call_spread") {
      for (let i = 0; i < calls.length; i++) {
        for (let j = i + 1; j < calls.length && j < i + 8; j++) {
          const sellCall = calls[i]; const buyCall = calls[j];
          if (sellCall.vencimento !== buyCall.vencimento) continue;
          if (!hasMinTrades(sellCall.ticker) || !hasMinTrades(buyCall.ticker)) continue;
          const { price: sp, isLive: l1 } = getPrice(sellCall.ticker, "ofCompra");
          const { price: bp, isLive: l2 } = getPrice(buyCall.ticker, "ofVenda");
          if (sp <= 0 || bp <= 0) continue;
          const netCredit = sp - bp;
          if (netCredit <= 0) continue;
          const width = buyCall.strike - sellCall.strike;
          const maxProfit = netCredit * qty;
          const maxLoss = (width - netCredit) * qty;
          const returnPct = maxLoss > 0 ? (maxProfit / maxLoss) * 100 : 0;
          allResults.push({
            id: `becs_${sellCall.ticker}_${buyCall.ticker}`, strategy: "bear_call_spread", strategyLabel: stratLabel,
            legs: [
              { ticker: sellCall.ticker, side: "sell", type: "CALL", strike: sellCall.strike, price: sp, qty },
              { ticker: buyCall.ticker, side: "buy", type: "CALL", strike: buyCall.strike, price: bp, qty },
            ],
            maxProfit, maxLoss, breakeven: [sellCall.strike + netCredit], returnPct,
            qualityScore: maxLoss > 0 ? maxProfit / maxLoss : 0,
            netCredit: maxProfit, vencimento: sellCall.vencimento, isLive: l1 && l2,
          });
        }
      }
    }

    // ── IRON CONDOR ────────────────────────────────────────
    if (selectedStrategy === "iron_condor") {
      const byVenc = new Map<string, { calls: B3Option[]; puts: B3Option[] }>();
      calls.forEach((c) => { if (!byVenc.has(c.vencimento)) byVenc.set(c.vencimento, { calls: [], puts: [] }); byVenc.get(c.vencimento)!.calls.push(c); });
      puts.forEach((p) => { if (!byVenc.has(p.vencimento)) byVenc.set(p.vencimento, { calls: [], puts: [] }); byVenc.get(p.vencimento)!.puts.push(p); });

      byVenc.forEach(({ calls: vc, puts: vp }, venc) => {
        const sc = [...vc].sort((a, b) => a.strike - b.strike);
        const sp = [...vp].sort((a, b) => a.strike - b.strike);
        const atmPuts = sp.filter((p) => p.strike <= stockPrice);
        const otmCalls = sc.filter((c) => c.strike >= stockPrice);

        for (let pi = 0; pi < Math.min(atmPuts.length - 1, 4); pi++) {
          for (let ci = 0; ci < Math.min(otmCalls.length - 1, 4); ci++) {
            const sellPut = atmPuts[atmPuts.length - 1 - pi];
            const buyPut = atmPuts.length > 1 + pi ? atmPuts[atmPuts.length - 2 - pi] : null;
            const sellCall = otmCalls[ci];
            const buyCall = otmCalls.length > ci + 1 ? otmCalls[ci + 1] : null;
            if (!buyPut || !buyCall) continue;
            if (!hasMinTrades(sellPut.ticker) || !hasMinTrades(buyPut.ticker) || !hasMinTrades(sellCall.ticker) || !hasMinTrades(buyCall.ticker)) continue;

            const { price: spP, isLive: l1 } = getPrice(sellPut.ticker, "ofCompra");
            const { price: bpP, isLive: l2 } = getPrice(buyPut.ticker, "ofVenda");
            const { price: scP, isLive: l3 } = getPrice(sellCall.ticker, "ofCompra");
            const { price: bcP, isLive: l4 } = getPrice(buyCall.ticker, "ofVenda");
            if (spP <= 0 || bpP <= 0 || scP <= 0 || bcP <= 0) continue;

            const netCred = (spP - bpP) + (scP - bcP);
            if (netCred <= 0) continue;
            const maxWidth = Math.max(sellPut.strike - buyPut.strike, buyCall.strike - sellCall.strike);
            const maxLoss = (maxWidth - netCred) * qty;
            const maxProfit = netCred * qty;
            const returnPct = maxLoss > 0 ? (maxProfit / maxLoss) * 100 : 0;
            allResults.push({
              id: `ic_${buyPut.ticker}_${sellPut.ticker}_${sellCall.ticker}_${buyCall.ticker}`,
              strategy: "iron_condor", strategyLabel: stratLabel,
              legs: [
                { ticker: buyPut.ticker, side: "buy", type: "PUT", strike: buyPut.strike, price: bpP, qty },
                { ticker: sellPut.ticker, side: "sell", type: "PUT", strike: sellPut.strike, price: spP, qty },
                { ticker: sellCall.ticker, side: "sell", type: "CALL", strike: sellCall.strike, price: scP, qty },
                { ticker: buyCall.ticker, side: "buy", type: "CALL", strike: buyCall.strike, price: bcP, qty },
              ],
              maxProfit, maxLoss, breakeven: [sellPut.strike - netCred, sellCall.strike + netCred], returnPct,
              qualityScore: maxLoss > 0 ? maxProfit / maxLoss : 0,
              netCredit: maxProfit, vencimento: venc, isLive: l1 && l2 && l3 && l4,
            });
          }
        }
      });
    }

    // ── BORBOLETA ──────────────────────────────────────────
    if (selectedStrategy === "butterfly") {
      const byVenc = new Map<string, B3Option[]>();
      calls.forEach((c) => { if (!byVenc.has(c.vencimento)) byVenc.set(c.vencimento, []); byVenc.get(c.vencimento)!.push(c); });
      byVenc.forEach((vc, venc) => {
        const sorted = [...vc].sort((a, b) => a.strike - b.strike);
        for (let i = 0; i < sorted.length; i++) {
          for (let j = i + 1; j < sorted.length; j++) {
            for (let k = j + 1; k < sorted.length; k++) {
              const c1 = sorted[i], c2 = sorted[j], c3 = sorted[k];
              if (Math.abs((c2.strike - c1.strike) - (c3.strike - c2.strike)) > 0.1) continue;
              if (!hasMinTrades(c1.ticker) || !hasMinTrades(c2.ticker) || !hasMinTrades(c3.ticker)) continue;
              const { price: p1, isLive: l1 } = getPrice(c1.ticker, "ofVenda");
              const { price: p2, isLive: l2 } = getPrice(c2.ticker, "ofCompra");
              const { price: p3, isLive: l3 } = getPrice(c3.ticker, "ofVenda");
              if (p1 <= 0 || p2 <= 0 || p3 <= 0) continue;
              const netCost = p1 - 2 * p2 + p3;
              if (netCost <= 0) continue;
              const w1 = c2.strike - c1.strike;
              const maxProfit = (w1 - netCost) * qty;
              const maxLoss = netCost * qty;
              const returnPct = maxLoss > 0 ? (maxProfit / maxLoss) * 100 : 0;
              allResults.push({
                id: `bf_${c1.ticker}_${c2.ticker}_${c3.ticker}`,
                strategy: "butterfly", strategyLabel: stratLabel,
                legs: [
                  { ticker: c1.ticker, side: "buy", type: "CALL", strike: c1.strike, price: p1, qty },
                  { ticker: c2.ticker, side: "sell", type: "CALL", strike: c2.strike, price: p2, qty: qty * 2 },
                  { ticker: c3.ticker, side: "buy", type: "CALL", strike: c3.strike, price: p3, qty },
                ],
                maxProfit, maxLoss, breakeven: [c1.strike + netCost, c3.strike - netCost], returnPct,
                qualityScore: maxLoss > 0 ? maxProfit / maxLoss : 0,
                netCredit: -netCost * qty, vencimento: venc, isLive: l1 && l2 && l3,
              });
            }
          }
        }
      });
    }

    // ── STRADDLE ───────────────────────────────────────────
    if (selectedStrategy === "straddle") {
      const byStrikeVenc = new Map<string, { call: B3Option; put: B3Option }>();
      calls.forEach((c) => { const k = `${c.strike}|${c.vencimento}`; const e = byStrikeVenc.get(k); if (e) e.call = c; else byStrikeVenc.set(k, { call: c, put: null as any }); });
      puts.forEach((p) => { const k = `${p.strike}|${p.vencimento}`; const e = byStrikeVenc.get(k); if (e) e.put = p; else byStrikeVenc.set(k, { call: null as any, put: p }); });
      byStrikeVenc.forEach((pair) => {
        if (!pair.call || !pair.put) return;
        if (!hasMinTrades(pair.call.ticker) || !hasMinTrades(pair.put.ticker)) return;
        const { price: cp, isLive: l1 } = getPrice(pair.call.ticker, "ofVenda");
        const { price: pp, isLive: l2 } = getPrice(pair.put.ticker, "ofVenda");
        if (cp <= 0 || pp <= 0) return;
        const totalCost = (cp + pp) * qty;
        const maxLoss = totalCost;
        const beUp = pair.call.strike + cp + pp;
        const beDown = pair.put.strike - cp - pp;
        const bigMove = stockPrice * 0.2;
        const maxProfit = (bigMove - cp - pp) * qty;
        const returnPct = maxLoss > 0 && maxProfit > 0 ? (maxProfit / maxLoss) * 100 : 0;
        allResults.push({
          id: `str_${pair.call.ticker}_${pair.put.ticker}`, strategy: "straddle", strategyLabel: stratLabel,
          legs: [
            { ticker: pair.call.ticker, side: "buy", type: "CALL", strike: pair.call.strike, price: cp, qty },
            { ticker: pair.put.ticker, side: "buy", type: "PUT", strike: pair.put.strike, price: pp, qty },
          ],
          maxProfit: Math.max(maxProfit, 0), maxLoss, breakeven: [Math.max(beDown, 0), beUp], returnPct: Math.max(returnPct, 0),
          qualityScore: maxLoss > 0 ? Math.max(maxProfit, 0) / maxLoss : 0,
          netCredit: -totalCost, vencimento: pair.call.vencimento, isLive: l1 && l2,
        });
      });
    }

    // ── STRANGLE ──────────────────────────────────────────
    if (selectedStrategy === "strangle") {
      for (const put of puts) {
        if (put.strike >= stockPrice) continue;
        if (!hasMinTrades(put.ticker)) continue;
        for (const call of calls) {
          if (call.strike <= stockPrice) continue;
          if (put.vencimento !== call.vencimento) continue;
          if (!hasMinTrades(call.ticker)) continue;
          const { price: pp, isLive: l1 } = getPrice(put.ticker, "ofVenda");
          const { price: cp, isLive: l2 } = getPrice(call.ticker, "ofVenda");
          if (pp <= 0 || cp <= 0) continue;
          const totalCost = (pp + cp) * qty;
          const beUp = call.strike + pp + cp;
          const beDown = put.strike - pp - cp;
          const bigMove = stockPrice * 0.2;
          const maxProfit = Math.max((bigMove - pp - cp) * qty, 0);
          const returnPct = totalCost > 0 && maxProfit > 0 ? (maxProfit / totalCost) * 100 : 0;
          allResults.push({
            id: `stg_${put.ticker}_${call.ticker}`, strategy: "strangle", strategyLabel: stratLabel,
            legs: [
              { ticker: put.ticker, side: "buy", type: "PUT", strike: put.strike, price: pp, qty },
              { ticker: call.ticker, side: "buy", type: "CALL", strike: call.strike, price: cp, qty },
            ],
            maxProfit, maxLoss: totalCost, breakeven: [Math.max(beDown, 0), beUp], returnPct,
            qualityScore: totalCost > 0 ? maxProfit / totalCost : 0,
            netCredit: -totalCost, vencimento: put.vencimento, isLive: l1 && l2,
          });
        }
      }
    }

    // Sort
    const sorter = sortBy === "return" ? (a: StrategyResult, b: StrategyResult) => b.returnPct - a.returnPct
      : sortBy === "quality" ? (a: StrategyResult, b: StrategyResult) => b.qualityScore - a.qualityScore
      : (a: StrategyResult, b: StrategyResult) => b.maxProfit - a.maxProfit;
    return allResults.sort(sorter).slice(0, 50);
  }, [selectedFamily, selectedStrategy, selectedVencimento, moneynessFilter, minPremium, minTrades, quantity, stockPrice, options, rows, status, getPrice, addTicker, stockTicker, sortBy, hasMinTrades]);

  const top3 = results.slice(0, 3);
  const rest = results.slice(3);
  const currentView = STRATEGIES.find((s) => s.id === selectedStrategy)?.view ?? "alta";
  const viewCfg = VIEW_CONFIG[currentView];

  const cdiComparison = useCallback((result: StrategyResult) => {
    const vDate = parseVencimento(result.vencimento);
    if (!vDate) return null;
    const days = diasUteis(new Date(), vDate);
    if (days <= 0) return null;
    const rate = parseFloat(cdiRate) || 14.65;
    const capital = Math.abs(result.maxLoss) || 1;
    const cdiReturn = capital * (Math.pow(1 + rate / 100, days / 252) - 1);
    const cdiPct = (cdiReturn / capital) * 100;
    const diff = result.returnPct - cdiPct;
    return { cdiPct: cdiPct.toFixed(2), diff: diff.toFixed(2), beats: diff > 0, days };
  }, [cdiRate]);

  return (
    <div className="space-y-6">
      {/* ═══ HEADER ═══ */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border border-primary/20 p-6">
        <div className="absolute top-0 right-0 w-40 h-40 bg-primary/5 rounded-full -translate-y-1/2 translate-x-1/2" />
        <div className="relative flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-3 flex-wrap">
              <div className="h-10 w-10 rounded-xl bg-primary/20 flex items-center justify-center">
                <Target className="h-5 w-5 text-primary" />
              </div>
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-foreground">
                Rastreador PRO X
              </h1>
              <Badge className="bg-primary text-primary-foreground border-0 text-xs font-black px-3 py-1 shadow-lg shadow-primary/30">
                <Zap className="h-3 w-3 mr-1" /> PRO
              </Badge>
              {status === "connected" && (
                <Badge className="bg-emerald-500/20 text-emerald-500 border-emerald-500/30 text-xs font-black animate-pulse shadow-[0_0_12px_rgba(16,185,129,0.3)]">
                  <Wifi className="h-3 w-3 mr-1" /> AO VIVO
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground max-w-lg">
              Escaneie <strong className="text-foreground">10 estratégias</strong> em tempo real e encontre as melhores combinações para cada cenário de mercado
            </p>
          </div>
          <div className="flex gap-4">
            <div className="text-center">
              <p className="text-2xl font-black text-primary">{results.length}</p>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Resultados</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-black text-foreground">{savedAssets.length}</p>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Rastreando</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-black text-foreground">10</p>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Estratégias</p>
            </div>
          </div>
        </div>
      </div>

      {/* ═══ SAVED ASSETS BAR ═══ */}
      {savedAssets.length > 0 && (
        <Card className="border-primary/20 overflow-hidden">
          <CardHeader className="pb-2 bg-gradient-to-r from-primary/5 to-transparent">
            <CardTitle className="text-xs font-black uppercase tracking-widest flex items-center gap-2">
              <Save className="h-3.5 w-3.5 text-primary" />
              Ativos Rastreados ({savedAssets.length})
              <span className="text-[10px] font-normal normal-case text-muted-foreground ml-1">— clique para analisar, X para remover</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-2 pb-3">
            <div className="flex flex-wrap gap-2">
              {savedAssets.map((asset) => (
                <div
                  key={asset.family}
                  className={cn(
                    "group flex items-center gap-1.5 pl-3 pr-1.5 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all cursor-pointer border-2",
                    selectedFamily === asset.family
                      ? "bg-primary text-primary-foreground border-primary shadow-lg shadow-primary/30 scale-105"
                      : "bg-card text-foreground border-border/40 hover:border-primary/30 hover:bg-muted/50"
                  )}
                >
                  <span onClick={() => setSelectedFamily(asset.family)}>{asset.label}</span>
                  <button
                    onClick={(e) => { e.stopPropagation(); removeSavedAsset(asset.family); }}
                    className={cn(
                      "h-5 w-5 rounded flex items-center justify-center transition-colors",
                      selectedFamily === asset.family
                        ? "hover:bg-primary-foreground/20 text-primary-foreground"
                        : "hover:bg-destructive/20 text-muted-foreground hover:text-destructive"
                    )}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ═══ ASSET SELECTOR ═══ */}
      <Card className="border-primary/20 overflow-hidden">
        <CardHeader className="pb-3 bg-gradient-to-r from-primary/5 to-transparent">
          <CardTitle className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
            <Database className="h-4 w-4 text-primary" />
            Escolher o Ativo
            {stockPrice > 0 && (
              <Badge variant="outline" className="ml-auto text-xs font-black">
                {selectedFamily} — R$ {stockPrice.toFixed(2)}
                {status === "connected" && <Wifi className="h-2.5 w-2.5 ml-1 text-emerald-500" />}
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-3 space-y-3">
          {/* Add custom asset */}
          <div className="flex gap-2">
            <Input
              value={customAssetInput}
              onChange={(e) => setCustomAssetInput(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === "Enter" && handleAddCustomAsset()}
              placeholder="Adicionar ativo (ex: PETR, VALE, BOVA...)"
              className="h-9 text-xs font-bold uppercase flex-1"
            />
            <Button size="sm" onClick={handleAddCustomAsset} className="h-9 px-4 text-xs font-black">
              <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar
            </Button>
          </div>

          {/* Quick select buttons */}
          <div className="flex flex-wrap gap-1.5">
            {TOP_STOCKS.map((s) => {
              const isSaved = savedAssets.some((a) => a.family === s.family);
              return (
                <button
                  key={s.family}
                  onClick={() => selectAndSaveAsset(s.family, s.label)}
                  className={cn(
                    "px-3 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all relative",
                    selectedFamily === s.family
                      ? "bg-primary text-primary-foreground shadow-lg shadow-primary/30 scale-105"
                      : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground hover:scale-105"
                  )}
                >
                  {s.label}
                  {isSaved && selectedFamily !== s.family && (
                    <div className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-emerald-500 border-2 border-background" />
                  )}
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* ═══ STRATEGY SELECTOR ═══ */}
      <div className="space-y-4">
        <h2 className="text-sm font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
          <BarChart2 className="h-4 w-4 text-primary" /> Cenário de Mercado
        </h2>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {(["alta", "baixa", "lateral", "volatilidade"] as MarketView[]).map((view) => {
            const cfg = VIEW_CONFIG[view];
            const active = currentView === view;
            const count = STRATEGIES.filter((s) => s.view === view).length;
            return (
              <button
                key={view}
                onClick={() => {
                  const first = STRATEGIES.find((s) => s.view === view);
                  if (first) setSelectedStrategy(first.id);
                }}
                className={cn(
                  "relative flex flex-col items-center gap-1 px-4 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all",
                  active
                    ? `bg-gradient-to-b ${cfg.bg} border-2 ${cfg.border} ${cfg.color} ${cfg.glow}`
                    : "bg-card text-muted-foreground hover:bg-muted/50 border-2 border-border/40 hover:border-primary/20"
                )}
              >
                <span className="text-lg">{cfg.emoji}</span>
                <span>{cfg.label}</span>
                <span className={cn("text-[10px] font-bold", active ? "opacity-80" : "opacity-50")}>{count} estratégias</span>
              </button>
            );
          })}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {STRATEGIES.filter((s) => s.view === currentView).map((strat) => {
            const active = selectedStrategy === strat.id;
            return (
              <button
                key={strat.id}
                onClick={() => setSelectedStrategy(strat.id)}
                className={cn(
                  "relative p-4 rounded-xl text-left transition-all border-2 group",
                  "hover:shadow-md hover:scale-[1.02]",
                  active
                    ? `bg-gradient-to-br ${VIEW_CONFIG[strat.view].bg} ${VIEW_CONFIG[strat.view].border} shadow-lg`
                    : "bg-card border-border/40 hover:border-primary/20"
                )}
                style={{ perspective: "800px", transform: active ? "perspective(800px) rotateX(1deg)" : undefined }}
              >
                <div className="flex items-center gap-2.5 mb-2">
                  <div className={cn(
                    "h-8 w-8 rounded-lg flex items-center justify-center",
                    active ? "bg-primary/20" : "bg-muted"
                  )}>
                    <strat.icon className={cn("h-4 w-4", active ? "text-primary" : "text-muted-foreground")} />
                  </div>
                  <span className="text-xs font-black uppercase tracking-wide text-foreground">{strat.label}</span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">{strat.description}</p>
                <p className="text-[10px] text-muted-foreground/60 mt-1.5 font-bold">{strat.composition}</p>
              </button>
            );
          })}
        </div>
      </div>

      {/* ═══ FILTERS ═══ */}
      <Card className="border-border/40 overflow-hidden">
        <CardHeader className="pb-2 bg-muted/30">
          <CardTitle className="text-xs font-black uppercase tracking-widest flex items-center gap-2">
            <Filter className="h-3.5 w-3.5 text-primary" /> Filtros e Ordenação
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-3">
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-bold text-muted-foreground uppercase">Vencimento</label>
              <Select value={selectedVencimento} onValueChange={setSelectedVencimento}>
                <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {availableVencimentos.map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-muted-foreground uppercase">Moneyness</label>
              <Select value={moneynessFilter} onValueChange={setMoneynessFilter}>
                <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  <SelectItem value="itm">ITM</SelectItem>
                  <SelectItem value="atm">ATM ±5%</SelectItem>
                  <SelectItem value="otm">OTM</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-muted-foreground uppercase">Prêmio Mín</label>
              <Input type="number" value={minPremium} onChange={(e) => setMinPremium(e.target.value)} placeholder="R$ 0.00" className="h-9 text-xs" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-muted-foreground uppercase">Negócios ≥</label>
              <Input type="number" value={minTrades} onChange={(e) => setMinTrades(e.target.value)} placeholder="0" className="h-9 text-xs" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-muted-foreground uppercase">Quantidade</label>
              <Input type="number" value={quantity} onChange={(e) => setQuantity(e.target.value)} placeholder="100" className="h-9 text-xs" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-muted-foreground uppercase flex items-center gap-1">
                CDI % <Switch checked={showCdi} onCheckedChange={setShowCdi} className="scale-75" />
              </label>
              <Input type="number" value={cdiRate} onChange={(e) => setCdiRate(e.target.value)} placeholder="14.65" className="h-9 text-xs" disabled={!showCdi} />
            </div>
            <div className="space-y-1 col-span-2 sm:col-span-1">
              <label className="text-xs font-bold text-muted-foreground uppercase">Ordenar por</label>
              <Select value={sortBy} onValueChange={(v) => setSortBy(v as any)}>
                <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="return">Maior Retorno %</SelectItem>
                  <SelectItem value="quality">Melhor Quality</SelectItem>
                  <SelectItem value="profit">Maior Lucro R$</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ═══ EMPTY STATE ═══ */}
      {!selectedFamily && (
        <div className="text-center py-20 space-y-4">
          <div className="h-20 w-20 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
            <Target className="h-10 w-10 text-primary" />
          </div>
          <p className="text-xl font-black text-foreground">Selecione um ativo para rastrear</p>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">Escolha um ativo acima ou adicione um personalizado para iniciar a varredura automática de estratégias</p>
        </div>
      )}

      {/* ═══ RESULTS ═══ */}
      {selectedFamily && (
        <div className="space-y-5">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h2 className="text-sm font-black uppercase tracking-widest text-foreground flex items-center gap-2">
              <Trophy className="h-4 w-4 text-primary" />
              Top Resultados — {STRATEGIES.find((s) => s.id === selectedStrategy)?.label}
              <Badge variant="outline" className="text-xs font-bold ml-1">{selectedFamily}</Badge>
            </h2>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs font-bold">{results.length} encontrados</Badge>
              <Badge className={cn("text-xs font-black border-0", viewCfg.color, `bg-current/10`)}>
                {viewCfg.emoji} {viewCfg.label}
              </Badge>
            </div>
          </div>

          {results.length === 0 && (
            <Card className="border-amber-500/20 bg-amber-500/5">
              <CardContent className="flex flex-col items-center justify-center py-12 space-y-3">
                <AlertTriangle className="h-12 w-12 text-amber-500" />
                <p className="text-sm font-black text-foreground">Nenhuma combinação encontrada</p>
                <p className="text-xs text-muted-foreground text-center">
                  Ajuste os filtros (reduza "Negócios ≥"), selecione outro vencimento ou tente uma estratégia diferente
                </p>
              </CardContent>
            </Card>
          )}

          {/* ═══ TOP 3 PODIUM ═══ */}
          {top3.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {top3.map((result, idx) => {
                const cdi = showCdi ? cdiComparison(result) : null;
                const expanded = expandedResult === result.id;
                const podiumColors = [
                  "border-yellow-400/60 shadow-[0_0_30px_rgba(250,204,21,0.25)] bg-gradient-to-b from-yellow-400/10 to-transparent",
                  "border-gray-400/50 shadow-[0_0_20px_rgba(156,163,175,0.15)] bg-gradient-to-b from-gray-400/10 to-transparent",
                  "border-amber-600/40 shadow-[0_0_15px_rgba(217,119,6,0.15)] bg-gradient-to-b from-amber-600/10 to-transparent",
                ];
                return (
                  <Card
                    key={result.id}
                    className={cn(
                      "relative overflow-hidden transition-all cursor-pointer hover:shadow-xl border-2 hover:scale-[1.02]",
                      podiumColors[idx]
                    )}
                    style={{ perspective: "800px", transform: "perspective(800px) rotateX(1deg)" }}
                    onClick={() => setExpandedResult(expanded ? null : result.id)}
                  >
                    <div className={cn(
                      "h-1 w-full",
                      idx === 0 ? "bg-gradient-to-r from-yellow-400 to-yellow-500" :
                      idx === 1 ? "bg-gradient-to-r from-gray-300 to-gray-400" :
                      "bg-gradient-to-r from-amber-500 to-amber-600"
                    )} />

                    <CardContent className="p-5 space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <img src={trophyImages[idx]} alt={trophyLabels[idx]} className="h-10 w-10 object-contain drop-shadow-lg" />
                          <div>
                            <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">{trophyLabels[idx]}</p>
                            <p className="text-xs font-bold text-foreground">{result.vencimento}</p>
                          </div>
                        </div>
                        {result.isLive && (
                          <div className="flex items-center gap-1 bg-emerald-500/20 text-emerald-500 rounded-full px-2 py-1">
                            <Wifi className="h-3 w-3" />
                            <span className="text-[10px] font-black">LIVE</span>
                          </div>
                        )}
                      </div>

                      <div className="text-center py-2">
                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">Retorno</p>
                        <p className={cn(
                          "text-4xl font-black tracking-tighter",
                          result.returnPct > 0 ? "text-emerald-500" : "text-red-500"
                        )}>
                          {result.returnPct.toFixed(1)}%
                        </p>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div className="bg-emerald-500/10 rounded-lg p-2.5 text-center">
                          <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold uppercase">Lucro Máx</p>
                          <p className="text-sm font-black text-emerald-500">R$ {result.maxProfit.toFixed(0)}</p>
                        </div>
                        <div className="bg-red-500/10 rounded-lg p-2.5 text-center">
                          <p className="text-[10px] text-red-600 dark:text-red-400 font-bold uppercase">Risco Máx</p>
                          <p className="text-sm font-black text-red-500">R$ {result.maxLoss.toFixed(0)}</p>
                        </div>
                        <div className="bg-primary/10 rounded-lg p-2.5 text-center">
                          <p className="text-[10px] text-primary font-bold uppercase">Quality</p>
                          <p className="text-sm font-black text-primary">{result.qualityScore.toFixed(2)}</p>
                        </div>
                        {cdi ? (
                          <div className={cn("rounded-lg p-2.5 text-center", cdi.beats ? "bg-emerald-500/10" : "bg-red-500/10")}>
                            <p className="text-[10px] font-bold uppercase text-muted-foreground">vs CDI</p>
                            <p className={cn("text-sm font-black", cdi.beats ? "text-emerald-500" : "text-red-500")}>
                              {cdi.beats ? "+" : ""}{cdi.diff}%
                            </p>
                          </div>
                        ) : (
                          <div className="bg-muted/50 rounded-lg p-2.5 text-center">
                            <p className="text-[10px] text-muted-foreground font-bold uppercase">Breakeven</p>
                            <p className="text-xs font-black text-foreground">{result.breakeven.map((b) => b.toFixed(2)).join(" | ")}</p>
                          </div>
                        )}
                      </div>

                      <div className="bg-muted/30 rounded-lg px-3 py-2 flex items-center justify-between">
                        <span className="text-[10px] font-bold uppercase text-muted-foreground">Breakeven</span>
                        <span className="text-xs font-black text-foreground">{result.breakeven.map((b) => `R$ ${b.toFixed(2)}`).join(" | ")}</span>
                      </div>

                      {expanded && (
                        <div className="pt-3 border-t border-border/40 space-y-2 animate-in slide-in-from-top-2 duration-200">
                          <p className="text-xs font-black uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
                            <Layers className="h-3.5 w-3.5" /> Pernas da Operação
                          </p>
                          {result.legs.map((leg, li) => (
                            <div key={li} className="flex items-center justify-between bg-card border border-border/40 rounded-xl px-4 py-2.5 shadow-sm">
                              <div className="flex items-center gap-2.5">
                                <div className={cn(
                                  "h-7 w-7 rounded-lg flex items-center justify-center text-[10px] font-black",
                                  leg.side === "buy"
                                    ? "bg-emerald-500/20 text-emerald-500"
                                    : "bg-red-500/20 text-red-500"
                                )}>
                                  {leg.side === "buy" ? "C" : "V"}
                                </div>
                                <div>
                                  <p className="text-xs font-black text-foreground">{leg.ticker}</p>
                                  <p className="text-[10px] text-muted-foreground">{leg.type}{leg.strike > 0 ? ` K${leg.strike.toFixed(2)}` : ""}</p>
                                </div>
                              </div>
                              <div className="text-right">
                                <p className="text-xs font-black text-foreground">R$ {leg.price.toFixed(2)}</p>
                                <p className="text-[10px] text-muted-foreground">× {leg.qty}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      <button className="w-full flex items-center justify-center gap-1 text-xs font-bold text-muted-foreground hover:text-foreground transition-colors pt-1">
                        {expanded ? <><ChevronUp className="h-4 w-4" /> Recolher</> : <><ChevronDown className="h-4 w-4" /> Ver Pernas</>}
                      </button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}

          {/* ═══ REST TABLE ═══ */}
          {rest.length > 0 && (
            <Card className="border-border/40 overflow-hidden">
              <CardHeader className="py-3 bg-muted/20">
                <CardTitle className="text-xs font-black uppercase tracking-widest flex items-center gap-2">
                  <ArrowUpDown className="h-3.5 w-3.5 text-primary" />
                  Mais Resultados ({rest.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-border/40 bg-muted/30">
                        <th className="text-left p-3 font-black uppercase tracking-widest text-xs text-muted-foreground">#</th>
                        <th className="text-left p-3 font-black uppercase tracking-widest text-xs text-muted-foreground">Pernas</th>
                        <th className="text-right p-3 font-black uppercase tracking-widest text-xs text-muted-foreground">Retorno</th>
                        <th className="text-right p-3 font-black uppercase tracking-widest text-xs text-muted-foreground">Lucro</th>
                        <th className="text-right p-3 font-black uppercase tracking-widest text-xs text-muted-foreground">Risco</th>
                        <th className="text-right p-3 font-black uppercase tracking-widest text-xs text-muted-foreground">Quality</th>
                        <th className="text-right p-3 font-black uppercase tracking-widest text-xs text-muted-foreground">Venc.</th>
                        {showCdi && <th className="text-right p-3 font-black uppercase tracking-widest text-xs text-muted-foreground">vs CDI</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {rest.map((r, i) => {
                        const cdi = showCdi ? cdiComparison(r) : null;
                        const isExpanded = expandedResult === r.id;
                        return (
                          <tr
                            key={r.id}
                            className="border-b border-border/20 hover:bg-muted/20 transition-colors cursor-pointer"
                            onClick={() => setExpandedResult(isExpanded ? null : r.id)}
                          >
                            <td className="p-3 text-muted-foreground font-black">{i + 4}</td>
                            <td className="p-3">
                              <div className="flex flex-wrap gap-1.5">
                                {r.legs.map((l, li) => (
                                  <Badge key={li} variant="outline" className={cn(
                                    "text-[10px] font-black",
                                    l.side === "buy" ? "border-emerald-500/40 text-emerald-600 dark:text-emerald-400" : "border-red-500/40 text-red-600 dark:text-red-400"
                                  )}>
                                    {l.side === "buy" ? "C" : "V"} {l.ticker}
                                  </Badge>
                                ))}
                              </div>
                              {isExpanded && (
                                <div className="mt-2 space-y-1">
                                  {r.legs.map((leg, li) => (
                                    <div key={li} className="text-xs text-muted-foreground">
                                      {leg.side === "buy" ? "Compra" : "Venda"} {leg.ticker} {leg.type} K:{leg.strike.toFixed(2)} R${leg.price.toFixed(2)}×{leg.qty}
                                    </div>
                                  ))}
                                  <p className="text-xs text-muted-foreground">Breakeven: {r.breakeven.map((b) => `R$ ${b.toFixed(2)}`).join(" | ")}</p>
                                </div>
                              )}
                            </td>
                            <td className={cn("p-3 text-right font-black text-sm", r.returnPct > 0 ? "text-emerald-500" : "text-red-500")}>{r.returnPct.toFixed(1)}%</td>
                            <td className="p-3 text-right font-bold text-emerald-500">R$ {r.maxProfit.toFixed(0)}</td>
                            <td className="p-3 text-right font-bold text-red-500">R$ {r.maxLoss.toFixed(0)}</td>
                            <td className="p-3 text-right font-black text-primary">{r.qualityScore.toFixed(2)}</td>
                            <td className="p-3 text-right text-muted-foreground font-bold">{r.vencimento}</td>
                            {showCdi && cdi && <td className={cn("p-3 text-right font-black", cdi.beats ? "text-emerald-500" : "text-red-500")}>{cdi.beats ? "+" : ""}{cdi.diff}%</td>}
                            {showCdi && !cdi && <td className="p-3" />}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
