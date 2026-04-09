// ============================================================
// RASTREADOR DE ESTRATÉGIAS PRO — Tempo Real via Profit RTD Bridge
// Suporta: Venda Coberta, Venda Put, Travas, Iron Condor, Borboleta
// ============================================================

import { useState, useMemo, useCallback, useEffect } from "react";
import { toast } from "sonner";
import trophyGold from "@/assets/trophy-gold.png";
import trophySilver from "@/assets/trophy-silver.png";
import trophyBronze from "@/assets/trophy-bronze.png";
import { format } from "date-fns";
import {
  TrendingUp, TrendingDown, Activity, Shield, Target, Layers,
  ChevronDown, ChevronUp, Trophy, Wifi, WifiOff, Info,
  Database, RefreshCw, Filter, Zap, ArrowRight, BarChart2,
  DollarSign, Percent, Star, AlertTriangle,
} from "lucide-react";
import { useSharedRtdBridge } from "@/contexts/RtdBridgeContext";
import { useB3Options, type B3Option } from "@/contexts/B3OptionsContext";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

// ─── TIPOS ───────────────────────────────────────────────────
type MarketView = "alta" | "baixa" | "lateral";
type StrategyType =
  | "covered_call"
  | "bull_call_spread"
  | "cash_secured_put"
  | "bear_put_spread"
  | "iron_condor"
  | "butterfly";

interface StrategyDef {
  id: StrategyType;
  label: string;
  view: MarketView;
  icon: typeof TrendingUp;
  description: string;
}

interface StrategyResult {
  id: string;
  strategy: StrategyType;
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

const STRATEGIES: StrategyDef[] = [
  { id: "covered_call", label: "Venda Coberta", view: "alta", icon: TrendingUp, description: "Ação + Venda Call — gera renda com ativo em carteira" },
  { id: "bull_call_spread", label: "Trava de Alta (Call)", view: "alta", icon: TrendingUp, description: "Compra Call K1 + Venda Call K2 — apostando na alta" },
  { id: "cash_secured_put", label: "Venda de Put", view: "baixa", icon: TrendingDown, description: "Venda Put — recebe prêmio aceitando comprar o ativo" },
  { id: "bear_put_spread", label: "Trava de Baixa (Put)", view: "baixa", icon: TrendingDown, description: "Compra Put K1 + Venda Put K2 — apostando na queda" },
  { id: "iron_condor", label: "Iron Condor", view: "lateral", icon: Activity, description: "Trava Put + Trava Call — lucra se ativo ficar no range" },
  { id: "butterfly", label: "Borboleta", view: "lateral", icon: Layers, description: "Compra C1 + 2x Venda C2 + Compra C3 — lucro máx no centro" },
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

const STRATEGY_STORAGE_KEY = "strategy-tracker-families";
interface SavedFamily { name: string; tickers: string[]; autoImported?: string[] }

const trophyImages = [trophyGold, trophySilver, trophyBronze];
const trophyLabels = ["🥇 MELHOR", "🥈 2º LUGAR", "🥉 3º LUGAR"];

// ─── HELPER: parse dd/MM/yyyy → Date ────────────────────────
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
  const { options, families, vencimentos, getByFamily } = useB3Options();
  const { status, rows, addTicker } = useSharedRtdBridge();

  // State
  const [selectedFamily, setSelectedFamily] = useState<string>("");
  const [selectedStrategy, setSelectedStrategy] = useState<StrategyType>("covered_call");
  const [selectedVencimento, setSelectedVencimento] = useState<string>("all");
  const [moneynessFilter, setMoneynessFilter] = useState<string>("all");
  const [minPremium, setMinPremium] = useState("");
  const [quantity, setQuantity] = useState("100");
  const [cdiRate, setCdiRate] = useState("14.65");
  const [showCdi, setShowCdi] = useState(true);
  const [expandedResult, setExpandedResult] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);

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

  // Subscribe stock to RTD
  useEffect(() => {
    if (stockCandidates.length === 0 || status !== "connected") return;
    for (const c of stockCandidates) addTicker(c);
  }, [stockCandidates, status, addTicker]);

  // Underlying price
  const stockPrice = useMemo(() => {
    if (stockTicker) {
      const row = rows.get(stockTicker);
      if (row?.ultimo && row.ultimo > 0) return row.ultimo;
    }
    // Fallback: estimate from options
    if (!selectedFamily) return 0;
    const familyOpts = options.filter((o) => o.family === selectedFamily && o.precoUltimo > 0);
    if (familyOpts.length === 0) return 0;
    const strikes = familyOpts.map((o) => o.strike).sort((a, b) => a - b);
    return strikes[Math.floor(strikes.length / 2)];
  }, [stockTicker, rows, selectedFamily, options]);

  // Available vencimentos for this family
  const availableVencimentos = useMemo(() => {
    if (!selectedFamily) return vencimentos;
    const fOpts = options.filter((o) => o.family === selectedFamily);
    const vSet = new Set(fOpts.map((o) => o.vencimento));
    return vencimentos.filter((v) => vSet.has(v));
  }, [selectedFamily, options, vencimentos]);

  // Load imported families from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STRATEGY_STORAGE_KEY);
      if (saved) {
        const families: SavedFamily[] = JSON.parse(saved);
        if (families.length > 0 && !selectedFamily) {
          setSelectedFamily(families[0].name);
        }
      }
    } catch {}
  }, []);

  // Get option price (RTD live or static)
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

  // ─── SCAN ENGINE ──────────────────────────────────────────
  const results = useMemo((): StrategyResult[] => {
    if (!selectedFamily || stockPrice <= 0) return [];

    const familyOpts = options.filter((o) => o.family === selectedFamily);
    let opts = familyOpts;

    // Filter by vencimento
    if (selectedVencimento !== "all") {
      opts = opts.filter((o) => o.vencimento === selectedVencimento);
    }

    // Filter by moneyness
    if (moneynessFilter !== "all" && stockPrice > 0) {
      const margin = stockPrice * 0.05;
      if (moneynessFilter === "itm") {
        opts = opts.filter((o) =>
          o.tipo === "CALL" ? o.strike < stockPrice : o.strike > stockPrice
        );
      } else if (moneynessFilter === "atm") {
        opts = opts.filter((o) => Math.abs(o.strike - stockPrice) <= margin);
      } else if (moneynessFilter === "otm") {
        opts = opts.filter((o) =>
          o.tipo === "CALL" ? o.strike > stockPrice : o.strike < stockPrice
        );
      }
    }

    const calls = opts.filter((o) => o.tipo === "CALL");
    const puts = opts.filter((o) => o.tipo === "PUT");
    const minPrem = parseFloat(minPremium) || 0;
    const qty = parseInt(quantity) || 100;

    // Subscribe all tickers to RTD
    if (status === "connected") {
      opts.slice(0, 60).forEach((o) => addTicker(o.ticker));
    }

    const allResults: StrategyResult[] = [];

    // ── VENDA COBERTA ──────────────────────────────────────
    if (selectedStrategy === "covered_call") {
      for (const call of calls) {
        const { price: callPrice, isLive } = getPrice(call.ticker, "ofCompra");
        if (callPrice <= 0 || callPrice < minPrem) continue;
        const returnPct = (callPrice / stockPrice) * 100;
        const maxProfit = (call.strike - stockPrice + callPrice) * qty;
        const maxLoss = (stockPrice - callPrice) * qty; // stock goes to 0
        const breakeven = stockPrice - callPrice;
        allResults.push({
          id: `cc_${call.ticker}`,
          strategy: "covered_call",
          legs: [
            { ticker: stockTicker || `${selectedFamily}4`, side: "buy", type: "STOCK", strike: 0, price: stockPrice, qty },
            { ticker: call.ticker, side: "sell", type: "CALL", strike: call.strike, price: callPrice, qty },
          ],
          maxProfit,
          maxLoss,
          breakeven: [breakeven],
          returnPct,
          qualityScore: maxProfit > 0 && maxLoss > 0 ? maxProfit / maxLoss : 0,
          netCredit: callPrice * qty,
          vencimento: call.vencimento,
          isLive,
        });
      }
    }

    // ── VENDA DE PUT ───────────────────────────────────────
    if (selectedStrategy === "cash_secured_put") {
      for (const put of puts) {
        const { price: putPrice, isLive } = getPrice(put.ticker, "ofCompra");
        if (putPrice <= 0 || putPrice < minPrem) continue;
        const returnPct = (putPrice / put.strike) * 100;
        const maxProfit = putPrice * qty;
        const maxLoss = (put.strike - putPrice) * qty;
        const breakeven = put.strike - putPrice;
        allResults.push({
          id: `csp_${put.ticker}`,
          strategy: "cash_secured_put",
          legs: [
            { ticker: put.ticker, side: "sell", type: "PUT", strike: put.strike, price: putPrice, qty },
          ],
          maxProfit,
          maxLoss,
          breakeven: [breakeven],
          returnPct,
          qualityScore: maxLoss > 0 ? maxProfit / maxLoss : 0,
          netCredit: putPrice * qty,
          vencimento: put.vencimento,
          isLive,
        });
      }
    }

    // ── TRAVA DE ALTA COM CALL ─────────────────────────────
    if (selectedStrategy === "bull_call_spread") {
      for (let i = 0; i < calls.length; i++) {
        for (let j = i + 1; j < calls.length && j < i + 8; j++) {
          const longCall = calls[i]; // lower strike
          const shortCall = calls[j]; // higher strike
          if (longCall.strike >= shortCall.strike) continue;
          if (longCall.vencimento !== shortCall.vencimento) continue;

          const { price: longPrice, isLive: l1 } = getPrice(longCall.ticker, "ofVenda");
          const { price: shortPrice, isLive: l2 } = getPrice(shortCall.ticker, "ofCompra");
          if (longPrice <= 0 || shortPrice <= 0) continue;

          const netCost = longPrice - shortPrice;
          if (netCost <= 0) continue; // debit spread
          if (minPrem > 0 && netCost < minPrem) continue;

          const width = shortCall.strike - longCall.strike;
          const maxProfit = (width - netCost) * qty;
          const maxLoss = netCost * qty;
          const breakeven = longCall.strike + netCost;
          const returnPct = maxLoss > 0 ? (maxProfit / maxLoss) * 100 : 0;

          allResults.push({
            id: `bcs_${longCall.ticker}_${shortCall.ticker}`,
            strategy: "bull_call_spread",
            legs: [
              { ticker: longCall.ticker, side: "buy", type: "CALL", strike: longCall.strike, price: longPrice, qty },
              { ticker: shortCall.ticker, side: "sell", type: "CALL", strike: shortCall.strike, price: shortPrice, qty },
            ],
            maxProfit,
            maxLoss,
            breakeven: [breakeven],
            returnPct,
            qualityScore: maxLoss > 0 ? maxProfit / maxLoss : 0,
            netCredit: -netCost * qty,
            vencimento: longCall.vencimento,
            isLive: l1 && l2,
          });
        }
      }
    }

    // ── TRAVA DE BAIXA COM PUT ─────────────────────────────
    if (selectedStrategy === "bear_put_spread") {
      const sortedPuts = [...puts].sort((a, b) => a.strike - b.strike);
      for (let i = 0; i < sortedPuts.length; i++) {
        for (let j = i + 1; j < sortedPuts.length && j < i + 8; j++) {
          const shortPut = sortedPuts[i]; // lower strike (sell)
          const longPut = sortedPuts[j];  // higher strike (buy)
          if (shortPut.vencimento !== longPut.vencimento) continue;

          const { price: longPrice, isLive: l1 } = getPrice(longPut.ticker, "ofVenda");
          const { price: shortPrice, isLive: l2 } = getPrice(shortPut.ticker, "ofCompra");
          if (longPrice <= 0 || shortPrice <= 0) continue;

          const netCost = longPrice - shortPrice;
          if (netCost <= 0) continue;
          if (minPrem > 0 && netCost < minPrem) continue;

          const width = longPut.strike - shortPut.strike;
          const maxProfit = (width - netCost) * qty;
          const maxLoss = netCost * qty;
          const breakeven = longPut.strike - netCost;
          const returnPct = maxLoss > 0 ? (maxProfit / maxLoss) * 100 : 0;

          allResults.push({
            id: `bps_${longPut.ticker}_${shortPut.ticker}`,
            strategy: "bear_put_spread",
            legs: [
              { ticker: longPut.ticker, side: "buy", type: "PUT", strike: longPut.strike, price: longPrice, qty },
              { ticker: shortPut.ticker, side: "sell", type: "PUT", strike: shortPut.strike, price: shortPrice, qty },
            ],
            maxProfit,
            maxLoss,
            breakeven: [breakeven],
            returnPct,
            qualityScore: maxLoss > 0 ? maxProfit / maxLoss : 0,
            netCredit: -netCost * qty,
            vencimento: longPut.vencimento,
            isLive: l1 && l2,
          });
        }
      }
    }

    // ── IRON CONDOR ────────────────────────────────────────
    if (selectedStrategy === "iron_condor") {
      // Group by vencimento
      const byVenc = new Map<string, { calls: B3Option[]; puts: B3Option[] }>();
      calls.forEach((c) => {
        if (!byVenc.has(c.vencimento)) byVenc.set(c.vencimento, { calls: [], puts: [] });
        byVenc.get(c.vencimento)!.calls.push(c);
      });
      puts.forEach((p) => {
        if (!byVenc.has(p.vencimento)) byVenc.set(p.vencimento, { calls: [], puts: [] });
        byVenc.get(p.vencimento)!.puts.push(p);
      });

      byVenc.forEach(({ calls: vc, puts: vp }, venc) => {
        const sc = [...vc].sort((a, b) => a.strike - b.strike);
        const sp = [...vp].sort((a, b) => a.strike - b.strike);
        // Pick put spread below ATM, call spread above ATM
        const atmPuts = sp.filter((p) => p.strike <= stockPrice);
        const otmCalls = sc.filter((c) => c.strike >= stockPrice);

        for (let pi = 0; pi < Math.min(atmPuts.length - 1, 4); pi++) {
          for (let ci = 0; ci < Math.min(otmCalls.length - 1, 4); ci++) {
            const sellPut = atmPuts[atmPuts.length - 1 - pi]; // highest below ATM
            const buyPut = atmPuts.length > 1 + pi ? atmPuts[atmPuts.length - 2 - pi] : null;
            const sellCall = otmCalls[ci]; // lowest above ATM
            const buyCall = otmCalls.length > ci + 1 ? otmCalls[ci + 1] : null;
            if (!buyPut || !buyCall) continue;

            const { price: spP, isLive: l1 } = getPrice(sellPut.ticker, "ofCompra");
            const { price: bpP, isLive: l2 } = getPrice(buyPut.ticker, "ofVenda");
            const { price: scP, isLive: l3 } = getPrice(sellCall.ticker, "ofCompra");
            const { price: bcP, isLive: l4 } = getPrice(buyCall.ticker, "ofVenda");
            if (spP <= 0 || bpP <= 0 || scP <= 0 || bcP <= 0) continue;

            const netCredit = (spP - bpP) + (scP - bcP);
            if (netCredit <= 0) continue;

            const putWidth = sellPut.strike - buyPut.strike;
            const callWidth = buyCall.strike - sellCall.strike;
            const maxWidth = Math.max(putWidth, callWidth);
            const maxLoss = (maxWidth - netCredit) * (parseInt(quantity) || 100);
            const maxProfit = netCredit * (parseInt(quantity) || 100);
            const returnPct = maxLoss > 0 ? (maxProfit / maxLoss) * 100 : 0;

            allResults.push({
              id: `ic_${buyPut.ticker}_${sellPut.ticker}_${sellCall.ticker}_${buyCall.ticker}`,
              strategy: "iron_condor",
              legs: [
                { ticker: buyPut.ticker, side: "buy", type: "PUT", strike: buyPut.strike, price: bpP, qty: parseInt(quantity) || 100 },
                { ticker: sellPut.ticker, side: "sell", type: "PUT", strike: sellPut.strike, price: spP, qty: parseInt(quantity) || 100 },
                { ticker: sellCall.ticker, side: "sell", type: "CALL", strike: sellCall.strike, price: scP, qty: parseInt(quantity) || 100 },
                { ticker: buyCall.ticker, side: "buy", type: "CALL", strike: buyCall.strike, price: bcP, qty: parseInt(quantity) || 100 },
              ],
              maxProfit,
              maxLoss,
              breakeven: [sellPut.strike - netCredit, sellCall.strike + netCredit],
              returnPct,
              qualityScore: maxLoss > 0 ? maxProfit / maxLoss : 0,
              netCredit: maxProfit,
              vencimento: venc,
              isLive: l1 && l2 && l3 && l4,
            });
          }
        }
      });
    }

    // ── BORBOLETA (BUTTERFLY) ──────────────────────────────
    if (selectedStrategy === "butterfly") {
      const byVenc = new Map<string, B3Option[]>();
      calls.forEach((c) => {
        if (!byVenc.has(c.vencimento)) byVenc.set(c.vencimento, []);
        byVenc.get(c.vencimento)!.push(c);
      });

      byVenc.forEach((vc, venc) => {
        const sorted = [...vc].sort((a, b) => a.strike - b.strike);
        for (let i = 0; i < sorted.length; i++) {
          for (let j = i + 1; j < sorted.length; j++) {
            for (let k = j + 1; k < sorted.length; k++) {
              const c1 = sorted[i], c2 = sorted[j], c3 = sorted[k];
              // Check equidistant
              const w1 = c2.strike - c1.strike;
              const w2 = c3.strike - c2.strike;
              if (Math.abs(w1 - w2) > 0.1) continue;

              const { price: p1, isLive: l1 } = getPrice(c1.ticker, "ofVenda");
              const { price: p2, isLive: l2 } = getPrice(c2.ticker, "ofCompra");
              const { price: p3, isLive: l3 } = getPrice(c3.ticker, "ofVenda");
              if (p1 <= 0 || p2 <= 0 || p3 <= 0) continue;

              const netCost = p1 - 2 * p2 + p3;
              if (netCost <= 0) continue;

              const maxProfit = (w1 - netCost) * (parseInt(quantity) || 100);
              const maxLoss = netCost * (parseInt(quantity) || 100);
              const returnPct = maxLoss > 0 ? (maxProfit / maxLoss) * 100 : 0;

              allResults.push({
                id: `bf_${c1.ticker}_${c2.ticker}_${c3.ticker}`,
                strategy: "butterfly",
                legs: [
                  { ticker: c1.ticker, side: "buy", type: "CALL", strike: c1.strike, price: p1, qty: parseInt(quantity) || 100 },
                  { ticker: c2.ticker, side: "sell", type: "CALL", strike: c2.strike, price: p2, qty: (parseInt(quantity) || 100) * 2 },
                  { ticker: c3.ticker, side: "buy", type: "CALL", strike: c3.strike, price: p3, qty: parseInt(quantity) || 100 },
                ],
                maxProfit,
                maxLoss,
                breakeven: [c1.strike + netCost, c3.strike - netCost],
                returnPct,
                qualityScore: maxLoss > 0 ? maxProfit / maxLoss : 0,
                netCredit: -netCost * (parseInt(quantity) || 100),
                vencimento: venc,
                isLive: l1 && l2 && l3,
              });
            }
          }
        }
      });
    }

    // Sort by returnPct descending
    return allResults.sort((a, b) => b.returnPct - a.returnPct).slice(0, 50);
  }, [selectedFamily, selectedStrategy, selectedVencimento, moneynessFilter, minPremium, quantity, stockPrice, options, rows, status, getPrice, addTicker, stockTicker]);

  const top3 = results.slice(0, 3);
  const rest = results.slice(3);

  const currentView = STRATEGIES.find((s) => s.id === selectedStrategy)?.view ?? "alta";

  const viewColors: Record<MarketView, string> = {
    alta: "text-emerald-500",
    baixa: "text-red-500",
    lateral: "text-amber-500",
  };

  const viewBg: Record<MarketView, string> = {
    alta: "from-emerald-500/10 to-emerald-500/5",
    baixa: "from-red-500/10 to-red-500/5",
    lateral: "from-amber-500/10 to-amber-500/5",
  };

  // CDI comparison helper
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
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <Target className="h-7 w-7 text-primary" />
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-foreground">
              Rastreador de Estratégias
            </h1>
            <Badge className="bg-primary/20 text-primary border-0 text-xs font-black">PRO</Badge>
            {status === "connected" && (
              <Badge className="bg-emerald-500/20 text-emerald-500 border-0 text-xs font-black animate-pulse">
                <Wifi className="h-3 w-3 mr-1" /> AO VIVO
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            Escaneie automaticamente as melhores combinações de opções da B3 para cada cenário de mercado
          </p>
        </div>
      </div>

      {/* ASSET SELECTOR */}
      <Card className="border-primary/20">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
            <Database className="h-4 w-4 text-primary" />
            Escolher o Ativo
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-1.5">
            {TOP_STOCKS.map((s) => (
              <button
                key={s.family}
                onClick={() => setSelectedFamily(s.family)}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all",
                  selectedFamily === s.family
                    ? "bg-primary text-primary-foreground shadow-lg shadow-primary/30"
                    : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground"
                )}
              >
                {s.label}
              </button>
            ))}
          </div>
          {stockPrice > 0 && (
            <div className="mt-3 flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">Preço do ativo:</span>
              <span className="font-black text-foreground">R$ {stockPrice.toFixed(2)}</span>
              {status === "connected" && (
                <Badge variant="outline" className="text-emerald-500 border-emerald-500/40 text-[10px]">
                  <Wifi className="h-2.5 w-2.5 mr-1" /> RTD
                </Badge>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* STRATEGY SELECTOR */}
      <div className="space-y-3">
        <h2 className="text-sm font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
          <BarChart2 className="h-4 w-4" /> Cenário de Mercado e Estratégia
        </h2>
        
        {/* Market view tabs */}
        <div className="flex gap-2">
          {(["alta", "baixa", "lateral"] as MarketView[]).map((view) => {
            const Icon = view === "alta" ? TrendingUp : view === "baixa" ? TrendingDown : Activity;
            const label = view === "alta" ? "📈 ALTA" : view === "baixa" ? "📉 BAIXA" : "➡️ LATERAL";
            const active = currentView === view;
            return (
              <button
                key={view}
                onClick={() => {
                  const first = STRATEGIES.find((s) => s.view === view);
                  if (first) setSelectedStrategy(first.id);
                }}
                className={cn(
                  "flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all flex-1",
                  active
                    ? `bg-gradient-to-b ${viewBg[view]} border-2 ${view === "alta" ? "border-emerald-500/40" : view === "baixa" ? "border-red-500/40" : "border-amber-500/40"} ${viewColors[view]} shadow-lg`
                    : "bg-muted text-muted-foreground hover:bg-muted/80 border-2 border-transparent"
                )}
              >
                <Icon className="h-4 w-4" />
                {label}
              </button>
            );
          })}
        </div>

        {/* Strategies for current view */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {STRATEGIES.filter((s) => s.view === currentView).map((strat) => (
            <button
              key={strat.id}
              onClick={() => setSelectedStrategy(strat.id)}
              className={cn(
                "p-3 rounded-xl text-left transition-all border-2",
                selectedStrategy === strat.id
                  ? "bg-primary/10 border-primary/40 shadow-md"
                  : "bg-card border-border/40 hover:border-primary/20"
              )}
            >
              <div className="flex items-center gap-2 mb-1">
                <strat.icon className={cn("h-4 w-4", selectedStrategy === strat.id ? "text-primary" : "text-muted-foreground")} />
                <span className="text-xs font-black uppercase tracking-wide">{strat.label}</span>
              </div>
              <p className="text-[10px] text-muted-foreground leading-snug">{strat.description}</p>
            </button>
          ))}
        </div>
      </div>

      {/* FILTERS */}
      <Card className="border-border/40">
        <CardHeader className="pb-2">
          <CardTitle className="text-xs font-black uppercase tracking-widest flex items-center gap-2">
            <Filter className="h-3.5 w-3.5 text-primary" /> Filtros
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
            {/* Vencimento */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-muted-foreground uppercase">Vencimento</label>
              <Select value={selectedVencimento} onValueChange={setSelectedVencimento}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {availableVencimentos.map((v) => (
                    <SelectItem key={v} value={v}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Moneyness */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-muted-foreground uppercase">Moneyness</label>
              <Select value={moneynessFilter} onValueChange={setMoneynessFilter}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  <SelectItem value="itm">ITM</SelectItem>
                  <SelectItem value="atm">ATM ±5%</SelectItem>
                  <SelectItem value="otm">OTM</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Prêmio mínimo */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-muted-foreground uppercase">Prêmio Mín R$</label>
              <Input
                type="number"
                value={minPremium}
                onChange={(e) => setMinPremium(e.target.value)}
                placeholder="0.00"
                className="h-8 text-xs"
              />
            </div>

            {/* Quantidade */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-muted-foreground uppercase">Quantidade</label>
              <Input
                type="number"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="100"
                className="h-8 text-xs"
              />
            </div>

            {/* CDI */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-muted-foreground uppercase flex items-center gap-1">
                CDI %
                <Switch checked={showCdi} onCheckedChange={setShowCdi} className="scale-75" />
              </label>
              <Input
                type="number"
                value={cdiRate}
                onChange={(e) => setCdiRate(e.target.value)}
                placeholder="14.65"
                className="h-8 text-xs"
                disabled={!showCdi}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* NO FAMILY SELECTED */}
      {!selectedFamily && (
        <div className="text-center py-16 space-y-3">
          <Database className="h-12 w-12 text-muted-foreground mx-auto" />
          <p className="text-lg font-bold text-muted-foreground">Selecione um ativo para rastrear</p>
          <p className="text-sm text-muted-foreground">Escolha um dos ativos acima para iniciar a varredura de estratégias</p>
        </div>
      )}

      {/* RESULTS */}
      {selectedFamily && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
              <Trophy className="h-4 w-4 text-primary" />
              Top Resultados — {STRATEGIES.find((s) => s.id === selectedStrategy)?.label}
              <Badge variant="outline" className="text-[10px]">{results.length} encontrados</Badge>
            </h2>
          </div>

          {results.length === 0 && (
            <div className="text-center py-12 space-y-3">
              <AlertTriangle className="h-10 w-10 text-amber-500 mx-auto" />
              <p className="text-sm font-bold text-muted-foreground">Nenhuma combinação encontrada</p>
              <p className="text-xs text-muted-foreground">Tente ajustar os filtros ou selecionar outro vencimento</p>
            </div>
          )}

          {/* TOP 3 PODIUM */}
          {top3.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {top3.map((result, idx) => {
                const cdi = showCdi ? cdiComparison(result) : null;
                const expanded = expandedResult === result.id;
                return (
                  <Card
                    key={result.id}
                    className={cn(
                      "relative overflow-hidden transition-all cursor-pointer hover:shadow-lg border-2",
                      idx === 0 ? "border-yellow-400/60 shadow-[0_0_20px_rgba(250,204,21,0.3)]" :
                      idx === 1 ? "border-gray-400/40 shadow-[0_0_12px_rgba(156,163,175,0.2)]" :
                      "border-amber-600/30"
                    )}
                    onClick={() => setExpandedResult(expanded ? null : result.id)}
                  >
                    <CardContent className="p-4 space-y-3">
                      {/* Trophy header */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <img src={trophyImages[idx]} alt={trophyLabels[idx]} className="h-8 w-8 object-contain" />
                          <div>
                            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{trophyLabels[idx]}</p>
                            <p className="text-xs font-bold text-foreground">{result.vencimento}</p>
                          </div>
                        </div>
                        {result.isLive && (
                          <Badge className="bg-emerald-500/20 text-emerald-500 border-0 text-[8px] font-black">
                            <Wifi className="h-2.5 w-2.5 mr-0.5" /> LIVE
                          </Badge>
                        )}
                      </div>

                      {/* Key metrics */}
                      <div className="space-y-2">
                        <div className="flex items-baseline justify-between">
                          <span className="text-[10px] text-muted-foreground font-bold uppercase">Retorno</span>
                          <span className={cn("text-2xl font-black", result.returnPct > 0 ? "text-emerald-500" : "text-red-500")}>
                            {result.returnPct.toFixed(1)}%
                          </span>
                        </div>
                        <div className="flex items-baseline justify-between">
                          <span className="text-[10px] text-muted-foreground font-bold uppercase">Lucro Máx</span>
                          <span className="text-sm font-black text-emerald-500">R$ {result.maxProfit.toFixed(2)}</span>
                        </div>
                        <div className="flex items-baseline justify-between">
                          <span className="text-[10px] text-muted-foreground font-bold uppercase">Risco Máx</span>
                          <span className="text-sm font-black text-red-500">R$ {result.maxLoss.toFixed(2)}</span>
                        </div>
                        <div className="flex items-baseline justify-between">
                          <span className="text-[10px] text-muted-foreground font-bold uppercase">Quality Score</span>
                          <span className="text-sm font-black text-primary">{result.qualityScore.toFixed(2)}</span>
                        </div>
                        {cdi && (
                          <div className="flex items-baseline justify-between">
                            <span className="text-[10px] text-muted-foreground font-bold uppercase">vs CDI ({cdi.days}du)</span>
                            <span className={cn("text-sm font-black", cdi.beats ? "text-emerald-500" : "text-red-500")}>
                              {cdi.beats ? "+" : ""}{cdi.diff}%
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Breakeven */}
                      <div className="text-[10px] text-muted-foreground">
                        <span className="font-bold uppercase">Breakeven:</span>{" "}
                        {result.breakeven.map((b) => `R$ ${b.toFixed(2)}`).join(" | ")}
                      </div>

                      {/* Expanded legs */}
                      {expanded && (
                        <div className="pt-2 border-t border-border/40 space-y-1.5 animate-fade-in">
                          <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Pernas da Operação</p>
                          {result.legs.map((leg, li) => (
                            <div key={li} className="flex items-center justify-between bg-muted/50 rounded-lg px-3 py-1.5">
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className={cn(
                                  "text-[8px] font-black",
                                  leg.side === "buy" ? "border-emerald-500/40 text-emerald-500" : "border-red-500/40 text-red-500"
                                )}>
                                  {leg.side === "buy" ? "COMPRA" : "VENDA"}
                                </Badge>
                                <span className="text-[10px] font-bold">{leg.ticker}</span>
                                <span className="text-[10px] text-muted-foreground">{leg.type}</span>
                              </div>
                              <div className="text-right">
                                {leg.strike > 0 && <p className="text-[10px] font-bold">K: {leg.strike.toFixed(2)}</p>}
                                <p className="text-[10px] text-muted-foreground">R$ {leg.price.toFixed(2)} × {leg.qty}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      <div className="flex items-center justify-center pt-1">
                        {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}

          {/* REST OF RESULTS TABLE */}
          {rest.length > 0 && (
            <Card className="border-border/40">
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-border/40 bg-muted/30">
                        <th className="text-left p-2 font-black uppercase tracking-widest text-[10px]">#</th>
                        <th className="text-left p-2 font-black uppercase tracking-widest text-[10px]">Pernas</th>
                        <th className="text-right p-2 font-black uppercase tracking-widest text-[10px]">Retorno %</th>
                        <th className="text-right p-2 font-black uppercase tracking-widest text-[10px]">Lucro Máx</th>
                        <th className="text-right p-2 font-black uppercase tracking-widest text-[10px]">Risco Máx</th>
                        <th className="text-right p-2 font-black uppercase tracking-widest text-[10px]">Breakeven</th>
                        <th className="text-right p-2 font-black uppercase tracking-widest text-[10px]">Venc.</th>
                        {showCdi && <th className="text-right p-2 font-black uppercase tracking-widest text-[10px]">vs CDI</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {rest.map((r, i) => {
                        const cdi = showCdi ? cdiComparison(r) : null;
                        return (
                          <tr key={r.id} className="border-b border-border/20 hover:bg-muted/20 transition-colors cursor-pointer" onClick={() => setExpandedResult(expandedResult === r.id ? null : r.id)}>
                            <td className="p-2 text-muted-foreground font-bold">{i + 4}</td>
                            <td className="p-2">
                              <div className="flex flex-wrap gap-1">
                                {r.legs.map((l, li) => (
                                  <span key={li} className="text-[10px] font-bold">
                                    {l.side === "buy" ? "C" : "V"} {l.ticker}
                                  </span>
                                ))}
                              </div>
                              {expandedResult === r.id && (
                                <div className="mt-2 space-y-1">
                                  {r.legs.map((leg, li) => (
                                    <div key={li} className="flex gap-2 text-[10px] text-muted-foreground">
                                      <Badge variant="outline" className={cn("text-[7px]", leg.side === "buy" ? "text-emerald-500" : "text-red-500")}>
                                        {leg.side === "buy" ? "C" : "V"}
                                      </Badge>
                                      {leg.ticker} {leg.type} K:{leg.strike.toFixed(2)} R${leg.price.toFixed(2)}×{leg.qty}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </td>
                            <td className={cn("p-2 text-right font-black", r.returnPct > 0 ? "text-emerald-500" : "text-red-500")}>{r.returnPct.toFixed(1)}%</td>
                            <td className="p-2 text-right font-bold text-emerald-500">R$ {r.maxProfit.toFixed(0)}</td>
                            <td className="p-2 text-right font-bold text-red-500">R$ {r.maxLoss.toFixed(0)}</td>
                            <td className="p-2 text-right text-muted-foreground">{r.breakeven.map((b) => b.toFixed(2)).join(" | ")}</td>
                            <td className="p-2 text-right text-muted-foreground">{r.vencimento}</td>
                            {showCdi && cdi && (
                              <td className={cn("p-2 text-right font-bold", cdi.beats ? "text-emerald-500" : "text-red-500")}>
                                {cdi.beats ? "+" : ""}{cdi.diff}%
                              </td>
                            )}
                            {showCdi && !cdi && <td className="p-2" />}
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
