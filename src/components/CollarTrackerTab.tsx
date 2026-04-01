// ============================================================
// RASTREADOR DE COLLAR - Tempo Real via Profit RTD Bridge
// Payoff = S_T - S_0 + max(K_put - S_T, 0) - max(S_T - K_call, 0) + (P_call - P_put)
// R_max = (K_call - S_0 + (P_call - P_put)) / S_0
// R_min = (K_put - S_0 + (P_call - P_put)) / S_0
// Custo = P_put - P_call (ideal: ~0 = collar financiado)
// ============================================================

import { useState, useCallback, useEffect, useMemo } from "react";
import {
  Plus, Trash2, Upload, RefreshCw, ChevronDown, ChevronUp, Star,
  ClipboardPaste, X, Shield, Trophy, Wifi, WifiOff, AlertTriangle,
  TrendingUp, TrendingDown, Minus, CalendarIcon, Pencil, Save,
  ToggleLeft, ToggleRight, BarChart3,
} from "lucide-react";
import { useSharedRtdBridge } from "@/contexts/RtdBridgeContext";
import { statusConfig } from "@/hooks/useRtdBridge";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import {
  ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid,
  ReferenceLine, ResponsiveContainer, Tooltip, ReferenceDot,
} from "recharts";

// ─── TIPOS ───────────────────────────────────────────────────
type CollarTipo = "Normal" | "Baixa" | "ATM" | "Calendário";
type CollarCusto = "Zero-Cost" | "Crédito" | "Débito";

interface OptionTicker {
  id: string;
  symbol: string;
  type: "CALL" | "PUT";
  strike: number;
}

interface CollarResult {
  callSymbol: string | null;
  putSymbol: string | null;
  callStrike: number;
  putStrike: number;
  callStrikeRtd: number | null;
  putStrikeRtd: number | null;
  callBid: number | null;   // P_call (prêmio da call vendida)
  putAsk: number | null;    // P_put (prêmio da put comprada)
  stockAsk: number | null;  // S_0 (preço de entrada do ativo)
  stockUlt: number | null;
  custoCollar: number | null; // P_put - P_call (< 0 = crédito)
  rentBaixa: number | null;  // R_min = (K_put - S_0 + (P_call - P_put)) / S_0
  rentNeutra: number | null;
  rentAlta: number | null;   // R_max = (K_call - S_0 + (P_call - P_put)) / S_0
  vencimento: string | null;
  diasUteis: number | null;
  cdiPeriodo: number | null;
  rating: number; // 1-3 stars
  tipo: CollarTipo;
  custoTipo: CollarCusto;
  distPutPct: number | null;   // % distância put do preço (negativo = OTM)
  distCallPct: number | null;  // % distância call do preço (positivo = OTM)
  riskRewardRatio: number | null; // rentAlta / |rentBaixa| (quanto maior melhor)
  qualityScore: number; // 0-100 score composto
}

interface StockFamily {
  id: string;
  name: string;
  tickers: OptionTicker[];
  expanded: boolean;
}

interface SavedFamily {
  name: string;
  tickers: string[];
}

// ─── CONSTANTES ──────────────────────────────────────────────
const STORAGE_KEY = "collar-tracker-families";
const VENC_STORAGE_KEY = "collar-tracker-vencimento";
const CDI_ANUAL_DEFAULT = 14.15;
const CDI_STORAGE_KEY = "collar-tracker-cdi-anual";

const COLORS = [
  "text-blue-500", "text-emerald-500", "text-amber-500", "text-purple-500",
  "text-rose-500", "text-cyan-500", "text-orange-500", "text-indigo-500",
];

function calcDiasUteis(vencimentoStr: string | null): number | null {
  if (!vencimentoStr) return null;
  let target: Date | null = null;
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(vencimentoStr)) {
    const [d, m, y] = vencimentoStr.split("/").map(Number);
    target = new Date(y, m - 1, d);
  } else if (/^\d{4}-\d{2}-\d{2}/.test(vencimentoStr)) {
    target = new Date(vencimentoStr);
  } else {
    return null;
  }
  if (isNaN(target.getTime())) return null;
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  target.setHours(0, 0, 0, 0);
  if (target <= hoje) return 0;
  let dias = 0;
  const cursor = new Date(hoje);
  while (cursor < target) {
    cursor.setDate(cursor.getDate() + 1);
    const dow = cursor.getDay();
    if (dow !== 0 && dow !== 6) dias++;
  }
  return dias;
}

function calcCdiPeriodo(diasUteis: number, cdiAnual: number): number {
  return ((1 + cdiAnual / 100) ** (diasUteis / 252) - 1) * 100;
}

function generateId(): string {
  return Math.random().toString(36).substring(2, 9);
}

function formatBRL(val: number | null): string {
  if (val === null || val === undefined) return "—";
  return `R$ ${val.toFixed(2).replace(".", ",")}`;
}

function formatPercent(val: number | null): string {
  if (val === null) return "—";
  return `${val.toFixed(2).replace(".", ",")}%`;
}

function extractStrikeFromTicker(symbol: string): number {
  const clean = symbol.toUpperCase().replace(/\s/g, "");
  const match = clean.match(/^[A-Z]{4,5}[A-X](\d+)$/);
  if (match) {
    const raw = parseInt(match[1]);
    if (raw >= 1000) return raw / 100;
    if (raw >= 100) return raw / 10;
    return raw;
  }
  return 0;
}

function extractTypeFromTicker(symbol: string): "CALL" | "PUT" {
  const clean = symbol.toUpperCase().replace(/\s/g, "");
  const match = clean.match(/^[A-Z]{4,5}([A-X])/);
  if (match) {
    const code = match[1].charCodeAt(0) - 65;
    return code <= 11 ? "CALL" : "PUT";
  }
  return "CALL";
}

function dateToStr(d: Date): string {
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

function strToDate(s: string): Date | undefined {
  if (!s) return undefined;
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) {
    const [d, m, y] = s.split("/").map(Number);
    return new Date(y, m - 1, d);
  }
  return undefined;
}

function calcMeses(diasUteis: number | null): string {
  if (diasUteis === null || diasUteis <= 0) return "—";
  const meses = diasUteis / 21;
  return meses < 1 ? `${diasUteis}d` : `${meses.toFixed(1)}m`;
}

// ─── PAYOFF DATA GENERATION ──────────────────────────────────
interface CollarPayoffPoint {
  price: number;
  payoffExpiry: number;
  payoffToday: number;
}

function generateCollarPayoff(
  S0: number, Kput: number, Kcall: number,
  Pput: number, Pcall: number, diasUteis: number | null,
  cdiAnual: number, numPoints = 200
): CollarPayoffPoint[] {
  const range = Math.max(Kcall - Kput, S0 * 0.3);
  const padding = range * 1.2;
  const start = Math.max(0, Math.min(Kput, S0) - padding);
  const end = Math.max(Kcall, S0) + padding;
  const step = (end - start) / numPoints;

  const r = cdiAnual / 100;
  const v = 0.35; // vol implícita estimada
  const T = diasUteis && diasUteis > 0 ? diasUteis / 252 : 0;

  const points: CollarPayoffPoint[] = [];
  for (let i = 0; i <= numPoints; i++) {
    const ST = start + step * i;

    // Payoff no vencimento: ST - S0 + max(Kput - ST, 0) - max(ST - Kcall, 0) + (Pcall - Pput)
    const payoffExpiry = ST - S0 + Math.max(Kput - ST, 0) - Math.max(ST - Kcall, 0) + (Pcall - Pput);

    // Payoff hoje (T+0) via Black-Scholes approximation
    let payoffToday = payoffExpiry;
    if (T > 0.001) {
      // Simplified BS for collar today
      const d1c = (Math.log(ST / Kcall) + (r + v * v / 2) * T) / (v * Math.sqrt(T));
      const d2c = d1c - v * Math.sqrt(T);
      const d1p = (Math.log(ST / Kput) + (r + v * v / 2) * T) / (v * Math.sqrt(T));
      const d2p = d1p - v * Math.sqrt(T);

      const Ncdf = (x: number) => {
        const t = 1 / (1 + 0.2316419 * Math.abs(x));
        const d = 0.3989423 * Math.exp(-x * x / 2);
        const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.7814779 + t * (-1.821256 + t * 1.3302744))));
        return x > 0 ? 1 - p : p;
      };

      const callVal = ST * Ncdf(d1c) - Kcall * Math.exp(-r * T) * Ncdf(d2c);
      const putVal = Kput * Math.exp(-r * T) * Ncdf(-d2p) - ST * Ncdf(-d1p);

      // Today: stock P&L + put value - put cost - (call value - call premium)
      payoffToday = (ST - S0) + (putVal - Pput) - (callVal - Pcall);
    }

    points.push({
      price: Math.round(ST * 100) / 100,
      payoffExpiry: Math.round(payoffExpiry * 100) / 100,
      payoffToday: Math.round(payoffToday * 100) / 100,
    });
  }
  return points;
}

// ─── PAYOFF CHART TOOLTIP ────────────────────────────────────
const CollarChartTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border bg-card/95 p-3 shadow-xl backdrop-blur-sm">
      <div className="mb-2 border-b border-border/50 pb-1">
        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Preço do Ativo</p>
        <p className="text-sm font-bold font-mono">R$ {Number(label).toFixed(2)}</p>
      </div>
      <div className="space-y-1.5">
        {payload.map((p: any, i: number) => {
          if (p.dataKey === "belowZero" || p.dataKey === "aboveZero") return null;
          return (
            <div key={i} className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full" style={{ backgroundColor: p.color }} />
                <span className="text-[11px] font-bold text-foreground/80">{p.name}</span>
              </div>
              <span className={cn("text-xs font-black font-mono", p.value >= 0 ? "text-emerald-500" : "text-red-500")}>
                R$ {Number(p.value).toFixed(2)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ─── COMPONENTE PRINCIPAL ─────────────────────────────────────
export default function CollarTrackerTab() {
  const [families, setFamilies] = useState<StockFamily[]>([]);
  const [newFamilyName, setNewFamilyName] = useState("");
  const [vencimentoManual, setVencimentoManual] = useState<string>("");
  const [vencSaved, setVencSaved] = useState(false);
  const [editingVenc, setEditingVenc] = useState(false);
  const [filterTipo, setFilterTipo] = useState<CollarTipo | "Todos">("Todos");
  const [filterCusto, setFilterCusto] = useState<CollarCusto | "Todos">("Todos");
  const [hideNegative, setHideNegative] = useState(false);
  const [selectedCollar, setSelectedCollar] = useState<(CollarResult & { familyName: string }) | null>(null);
  const [cdiAnual, setCdiAnual] = useState<number>(() => {
    try {
      const saved = localStorage.getItem(CDI_STORAGE_KEY);
      return saved ? parseFloat(saved) : CDI_ANUAL_DEFAULT;
    } catch { return CDI_ANUAL_DEFAULT; }
  });
  const [editingCdi, setEditingCdi] = useState(false);
  const [cdiInput, setCdiInput] = useState(String(cdiAnual).replace(".", ","));

  const { status, rows, connect, addTicker: bridgeAddTicker } = useSharedRtdBridge();

  // Load vencimento
  useEffect(() => {
    try {
      const saved = localStorage.getItem(VENC_STORAGE_KEY);
      if (saved) { setVencimentoManual(saved); setVencSaved(true); }
    } catch {}
  }, []);

  // Load families
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed: SavedFamily[] = JSON.parse(saved);
        const loaded: StockFamily[] = parsed.map((sf) => ({
          id: generateId(),
          name: sf.name,
          tickers: sf.tickers.map((sym) => ({
            id: generateId(),
            symbol: sym.toUpperCase(),
            type: extractTypeFromTicker(sym),
            strike: extractStrikeFromTicker(sym),
          })),
          expanded: true,
        }));
        setFamilies(loaded);
      }
    } catch {}
  }, []);

  // Save families
  useEffect(() => {
    const toSave: SavedFamily[] = families.map((f) => ({
      name: f.name,
      tickers: f.tickers.map((t) => t.symbol),
    }));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
  }, [families]);

  // Auto-subscribe
  useEffect(() => {
    if (status !== "connected") return;
    families.forEach((f) => {
      bridgeAddTicker(f.name);
      f.tickers.forEach((t) => bridgeAddTicker(t.symbol));
    });
  }, [status, families, bridgeAddTicker]);

  const handleSaveVenc = () => {
    if (vencimentoManual) {
      localStorage.setItem(VENC_STORAGE_KEY, vencimentoManual);
      setVencSaved(true);
      setEditingVenc(false);
    }
  };

  const handleEditVenc = () => { setVencSaved(false); setEditingVenc(true); };
  const handleDeleteVenc = () => {
    setVencimentoManual(""); setVencSaved(false); setEditingVenc(false);
    localStorage.removeItem(VENC_STORAGE_KEY);
  };

  const addFamily = useCallback(() => {
    const name = newFamilyName.trim().toUpperCase();
    if (!name) return;
    if (families.find((f) => f.name === name)) return;
    setFamilies((prev) => [...prev, { id: generateId(), name, tickers: [], expanded: true }]);
    setNewFamilyName("");
    if (status === "connected") bridgeAddTicker(name);
  }, [newFamilyName, families, status, bridgeAddTicker]);

  const removeFamily = useCallback((familyId: string) => {
    setFamilies((prev) => prev.filter((f) => f.id !== familyId));
  }, []);

  const toggleExpand = useCallback((familyId: string) => {
    setFamilies((prev) =>
      prev.map((f) => (f.id === familyId ? { ...f, expanded: !f.expanded } : f))
    );
  }, []);

  const processTickerSymbols = useCallback(
    (familyId: string, rawText: string) => {
      const symbols = rawText
        .split(/[\n,;\t\s]+/)
        .map((s) => s.trim().toUpperCase())
        .filter((s) => s.length >= 5 && /^[A-Z]{4,5}[A-X]\d+$/.test(s));
      if (!symbols.length) return;
      const newTickers: OptionTicker[] = symbols.map((symbol) => ({
        id: generateId(), symbol,
        type: extractTypeFromTicker(symbol),
        strike: extractStrikeFromTicker(symbol),
      }));
      setFamilies((prev) =>
        prev.map((f) => {
          if (f.id !== familyId) return f;
          const existing = new Set(f.tickers.map((t) => t.symbol));
          const toAdd = newTickers.filter((t) => !existing.has(t.symbol));
          return { ...f, tickers: [...f.tickers, ...toAdd] };
        })
      );
      if (status === "connected") {
        newTickers.forEach((t) => bridgeAddTicker(t.symbol));
      }
    },
    [status, bridgeAddTicker]
  );

  const handleFileUpload = useCallback(
    (familyId: string, file: File) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result as string;
        processTickerSymbols(familyId, text);
      };
      reader.readAsText(file);
    },
    [processTickerSymbols]
  );

  const removeTicker = useCallback((familyId: string, tickerId: string) => {
    setFamilies((prev) =>
      prev.map((f) =>
        f.id !== familyId ? f : { ...f, tickers: f.tickers.filter((t) => t.id !== tickerId) }
      )
    );
  }, []);

  const getPrice = (row: any, field: "ofCompra" | "ofVenda"): number | null => {
    if (!row) return null;
    const val = row[field];
    if (val !== null && val !== undefined && val !== 0) return val;
    return row.ultimo ?? null;
  };

  // ─── COLLAR CALCULATION ──────────────────────────────────────
  const calculateCollars = useCallback(
    (family: StockFamily): CollarResult[] => {
      const stockRow = rows.get(family.name);
      const stockAsk = getPrice(stockRow, "ofVenda");
      const stockUlt = stockRow?.ultimo ?? null;

      const calls = family.tickers.filter((t) => t.type === "CALL");
      const puts = family.tickers.filter((t) => t.type === "PUT");

      const results: CollarResult[] = [];

      // Generate all call × put combinations
      for (const call of calls) {
        for (const put of puts) {
          const callRow = rows.get(call.symbol);
          const putRow = rows.get(put.symbol);

          const callBid = getPrice(callRow, "ofCompra");
          const putAsk = getPrice(putRow, "ofVenda");

          const callStrikeRtd = (callRow?.strike && callRow.strike > 0) ? callRow.strike : null;
          const putStrikeRtd = (putRow?.strike && putRow.strike > 0) ? putRow.strike : null;
          const callStrike = callStrikeRtd ?? call.strike;
          const putStrike = putStrikeRtd ?? put.strike;

          const vencimento = callRow?.ven ?? putRow?.ven ?? null;
          const vencParaCalculo = vencimentoManual || vencimento;
          const diasUteis = calcDiasUteis(vencParaCalculo);
          const cdiPeriodo = diasUteis !== null && diasUteis > 0 ? calcCdiPeriodo(diasUteis, cdiAnual) : null;

          let custoCollar: number | null = null;
          let rentBaixa: number | null = null;
          let rentNeutra: number | null = null;
          let rentAlta: number | null = null;

          if (stockAsk !== null && callBid !== null && putAsk !== null) {
            const S0 = stockAsk;
            const Pcall = callBid;
            const Pput = putAsk;

            // Custo do Collar = P_put - P_call (negativo = crédito líquido)
            custoCollar = Pput - Pcall;

            if (S0 > 0) {
              // R_max (teto - cenário de alta): ativo sobe até K_call
              // R_max = (K_call - S_0 + (P_call - P_put)) / S_0
              rentAlta = ((callStrike - S0 + (Pcall - Pput)) / S0) * 100;

              // R_min (piso - cenário de baixa): ativo cai até K_put
              // R_min = (K_put - S_0 + (P_call - P_put)) / S_0
              rentBaixa = ((putStrike - S0 + (Pcall - Pput)) / S0) * 100;

              // Cenário neutro: preço fica em S_0
              // Payoff = S_0 - S_0 + 0 - 0 + (P_call - P_put) = P_call - P_put
              rentNeutra = ((Pcall - Pput) / S0) * 100;
            }
          }

          // Rating: compare all 3 scenarios against CDI
          let rating = 1;
          if (cdiPeriodo !== null && rentBaixa !== null && rentNeutra !== null && rentAlta !== null) {
            const aboveCdi = [rentBaixa >= cdiPeriodo, rentNeutra >= cdiPeriodo, rentAlta >= cdiPeriodo];
            const count = aboveCdi.filter(Boolean).length;
            if (count === 3) rating = 3;
            else if (count >= 1) rating = 2;
          }

          // Classificação do tipo de collar baseado nos strikes
          let tipo: CollarTipo = "Normal";
          const distPutPct = stockAsk !== null && stockAsk > 0 ? ((putStrike - stockAsk) / stockAsk) * 100 : null;
          const distCallPct = stockAsk !== null && stockAsk > 0 ? ((callStrike - stockAsk) / stockAsk) * 100 : null;

          if (callStrike < putStrike) {
            // Call vendida ABAIXO da put = collar de baixa (bearish)
            tipo = "Baixa";
          } else if (distPutPct !== null && Math.abs(distPutPct) < 2) {
            // Put muito próxima do preço = ATM collar (mais proteção)
            tipo = "ATM";
          } else {
            // Normal: K_put < S₀ < K_call
            tipo = "Normal";
          }

          // Custo tipo
          let custoTipo: CollarCusto = "Débito";
          if (custoCollar !== null) {
            if (Math.abs(custoCollar) < 0.05) custoTipo = "Zero-Cost";
            else if (custoCollar < 0) custoTipo = "Crédito";
          }

          // Risk/reward ratio
          const riskRewardRatio = (rentAlta !== null && rentBaixa !== null && rentBaixa !== 0)
            ? Math.abs(rentAlta / rentBaixa) : null;

          // Quality score (0-100) para auto-ranking inteligente
          let qualityScore = 50;
          if (rentAlta !== null && rentBaixa !== null && cdiPeriodo !== null) {
            // +20 se rentAlta > CDI
            if (rentAlta > cdiPeriodo) qualityScore += 20;
            // +15 se rentBaixa > CDI (raro, excelente)
            if (rentBaixa > cdiPeriodo) qualityScore += 15;
            // +10 se collar zero-cost ou crédito
            if (custoTipo === "Zero-Cost") qualityScore += 10;
            if (custoTipo === "Crédito") qualityScore += 15;
            // +10 se put 5-15% OTM (zona ideal)
            if (distPutPct !== null && distPutPct >= -15 && distPutPct <= -5) qualityScore += 10;
            // +10 se call 5-15% OTM (zona ideal)
            if (distCallPct !== null && distCallPct >= 5 && distCallPct <= 15) qualityScore += 10;
            // -20 se perda muito grande
            if (rentBaixa < -10) qualityScore -= 20;
            // +5 por bom risk/reward
            if (riskRewardRatio !== null && riskRewardRatio > 2) qualityScore += 5;
          }
          qualityScore = Math.max(0, Math.min(100, qualityScore));

          results.push({
            callSymbol: call.symbol, putSymbol: put.symbol,
            callStrike, putStrike,
            callStrikeRtd, putStrikeRtd,
            callBid, putAsk, stockAsk, stockUlt,
            custoCollar, rentBaixa, rentNeutra, rentAlta,
            vencimento: vencParaCalculo, diasUteis, cdiPeriodo,
            rating, tipo, custoTipo,
            distPutPct, distCallPct, riskRewardRatio, qualityScore,
          });
        }
      }

      // Sort by qualityScore (melhor primeiro)
      results.sort((a, b) => b.qualityScore - a.qualityScore);
      return results;
    },
    [rows, vencimentoManual, cdiAnual]
  );

  // Global best per family
  const bestPerFamily: (CollarResult & { familyName: string })[] = [];
  families.forEach((f) => {
    const collars = calculateCollars(f);
    const best = collars.find((c) => c.rentAlta !== null && c.stockAsk !== null);
    if (best) bestPerFamily.push({ ...best, familyName: f.name });
  });
  bestPerFamily.sort((a, b) => b.qualityScore - a.qualityScore);
  const topCollars = bestPerFamily.slice(0, 10);

  const isConnected = status === "connected";
  const statusCfg = statusConfig[status];
  const diasUteisVenc = calcDiasUteis(vencimentoManual);

  // ─── RENDER ───────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-background text-foreground font-mono p-3 md:p-6">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
        <div>
          <h1 className="text-xl md:text-2xl font-bold tracking-tight text-primary flex items-center gap-2">
            <Shield className="w-5 h-5 md:w-6 md:h-6" />
            Rastreador de Collar
          </h1>
          <p className="text-[10px] md:text-xs text-muted-foreground mt-1">
            R↑ = (K_call − S₀ + P_call − P_put) / S₀ · R↓ = (K_put − S₀ + P_call − P_put) / S₀ · Custo = P_put − P_call
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-semibold ${statusCfg.color}`}>
            {status === "connected" ? <Wifi className="w-3.5 h-3.5" /> :
             status === "error" ? <AlertTriangle className="w-3.5 h-3.5" /> :
             status === "connecting" ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> :
             <WifiOff className="w-3.5 h-3.5" />}
            {statusCfg.label}
            {isConnected && <span className="text-emerald-600 dark:text-emerald-400">· {rows.size} tickers</span>}
          </div>
          {!isConnected && status !== "connecting" && (
            <button onClick={connect}
              className="flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-400 text-white rounded-lg text-sm font-bold transition-colors">
              <RefreshCw className="w-4 h-4" /> Conectar Bridge
            </button>
          )}
        </div>
      </div>

      {/* Bridge warning */}
      {!isConnected && status !== "connecting" && (
        <div className="mb-5 bg-warning/10 border border-warning/30 rounded-xl p-4 text-sm">
          <div className="flex items-center gap-2 text-warning font-bold mb-1">
            <AlertTriangle className="w-4 h-4" /> Bridge RTD não conectado
          </div>
          <p className="text-muted-foreground text-xs">
            Inicie o <strong>ProfitRTDBridge.exe</strong> para receber dados em tempo real do Profit Pro.
          </p>
        </div>
      )}

      {/* CDI ANUAL */}
      <div className="mb-5 flex flex-col sm:flex-row gap-3 flex-wrap">
        <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-amber-300 dark:border-amber-500/50 bg-amber-50 dark:bg-amber-950/30">
          <span className="text-xs font-bold text-amber-700 dark:text-amber-300 uppercase tracking-wider whitespace-nowrap">📊 CDI Anual:</span>
          {editingCdi ? (
            <div className="flex items-center gap-1.5">
              <input type="text" value={cdiInput}
                onChange={(e) => setCdiInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    const val = parseFloat(cdiInput.replace(",", "."));
                    if (!isNaN(val) && val > 0 && val < 100) {
                      setCdiAnual(val); localStorage.setItem(CDI_STORAGE_KEY, String(val)); setEditingCdi(false);
                    }
                  } else if (e.key === "Escape") { setCdiInput(String(cdiAnual).replace(".", ",")); setEditingCdi(false); }
                }}
                className="w-20 bg-card border border-amber-400 dark:border-amber-500 rounded-lg px-2 py-1 text-sm text-center font-black text-amber-700 dark:text-amber-300 focus:outline-none focus:ring-2 focus:ring-amber-400"
                autoFocus />
              <span className="text-sm font-bold text-amber-600 dark:text-amber-400">%</span>
              <button onClick={() => {
                const val = parseFloat(cdiInput.replace(",", "."));
                if (!isNaN(val) && val > 0 && val < 100) {
                  setCdiAnual(val); localStorage.setItem(CDI_STORAGE_KEY, String(val)); setEditingCdi(false);
                }
              }} className="px-2 py-1 bg-amber-500 hover:bg-amber-400 text-white rounded-lg text-xs font-bold"><Save className="w-3 h-3" /></button>
              <button onClick={() => { setCdiInput(String(cdiAnual).replace(".", ",")); setEditingCdi(false); }}
                className="px-2 py-1 bg-muted hover:bg-muted/80 text-muted-foreground rounded-lg text-xs font-bold"><X className="w-3 h-3" /></button>
            </div>
          ) : (
            <button onClick={() => { setCdiInput(String(cdiAnual).replace(".", ",")); setEditingCdi(true); }}
              className="flex items-center gap-1.5 text-lg font-black text-amber-600 dark:text-amber-400 hover:text-amber-500 dark:hover:text-amber-300 transition-colors cursor-pointer">
              {String(cdiAnual).replace(".", ",")}%
              <Pencil className="w-3.5 h-3.5 opacity-50" />
            </button>
          )}
        </div>
      </div>

      {/* FILTROS INTELIGENTES */}
      <div className="mb-5 p-4 rounded-xl border border-border bg-card shadow-md">
        <h3 className="text-xs font-black text-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
          🎯 Filtros de Seleção de Strike
        </h3>
        <div className="flex flex-wrap gap-3 items-center">
          <div className="flex items-center gap-2">
            <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Tipo:</label>
            <select value={filterTipo} onChange={(e) => setFilterTipo(e.target.value as CollarTipo | "Todos")}
              className="bg-background border border-input rounded-lg px-2 py-1.5 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-primary">
              <option value="Todos">Todos</option>
              <option value="Normal">Normal (Put OTM + Call OTM)</option>
              <option value="ATM">ATM (Put próxima do preço)</option>
              <option value="Baixa">Baixa (Call abaixo da Put)</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Custo:</label>
            <select value={filterCusto} onChange={(e) => setFilterCusto(e.target.value as CollarCusto | "Todos")}
              className="bg-background border border-input rounded-lg px-2 py-1.5 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-primary">
              <option value="Todos">Todos</option>
              <option value="Zero-Cost">Zero-Cost</option>
              <option value="Crédito">Crédito</option>
              <option value="Débito">Débito</option>
            </select>
          </div>
          <button
            onClick={() => setHideNegative(!hideNegative)}
            className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors",
              hideNegative ? "bg-emerald-100 dark:bg-emerald-900/30 border-emerald-400 text-emerald-700 dark:text-emerald-300" : "bg-muted border-border text-muted-foreground")}>
            {hideNegative ? <ToggleRight className="w-3.5 h-3.5" /> : <ToggleLeft className="w-3.5 h-3.5" />}
            Ocultar negativos
          </button>
        </div>
        <p className="text-[9px] text-muted-foreground mt-2">
          📐 Zona ideal: PUT 5-15% abaixo · CALL 5-15% acima · Custo ≈ zero · Rent. &gt; CDI
        </p>
      </div>

      <div className="mb-5">
        <div className={cn("rounded-xl border p-4 transition-all",
          vencSaved ? "bg-orange-50 dark:bg-orange-950/20 border-orange-400/50" : "bg-card border-border shadow-md")}>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-black text-orange-600 dark:text-orange-400 flex items-center gap-2 uppercase tracking-wider">
              <CalendarIcon className="w-4 h-4" /> 📅 Data de Vencimento
            </h3>
            {vencSaved && (
              <div className="flex gap-2">
                <button onClick={handleEditVenc} className="flex items-center gap-1 px-3 py-1 text-xs bg-amber-100 dark:bg-amber-700/40 hover:bg-amber-200 dark:hover:bg-amber-600/50 border border-amber-400/50 rounded-lg text-amber-700 dark:text-amber-300 font-bold transition-colors">
                  <Pencil className="w-3 h-3" /> Editar
                </button>
                <button onClick={handleDeleteVenc} className="flex items-center gap-1 px-3 py-1 text-xs bg-red-100 dark:bg-red-900/40 hover:bg-red-200 dark:hover:bg-red-800/50 border border-red-400/50 rounded-lg text-red-600 dark:text-red-400 font-bold transition-colors">
                  <Trash2 className="w-3 h-3" /> Excluir
                </button>
              </div>
            )}
          </div>
          {vencSaved && !editingVenc ? (
            <div className="flex flex-wrap items-center gap-4 md:gap-6">
              <div>
                <p className="text-2xl md:text-3xl font-black text-orange-600 dark:text-orange-300">{vencimentoManual}</p>
                {diasUteisVenc !== null && (
                  <p className="text-sm text-muted-foreground mt-1">
                    <span className="text-amber-600 dark:text-amber-400 font-bold">{diasUteisVenc}</span> dias úteis restantes
                    {diasUteisVenc > 0 && (
                      <span className="ml-2">· CDI do período: <span className="text-amber-600 dark:text-amber-300 font-bold">{formatPercent(calcCdiPeriodo(diasUteisVenc, cdiAnual))}</span></span>
                    )}
                  </p>
                )}
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap items-end gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Selecione a data</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <button className={cn(
                      "flex items-center gap-2 px-4 py-2.5 rounded-lg border text-sm font-bold transition-all w-[220px] justify-start",
                      vencimentoManual ? "bg-card border-orange-500/60 text-orange-600 dark:text-orange-300" : "bg-card border-border text-muted-foreground animate-pulse")}>
                      <CalendarIcon className="w-4 h-4" /> {vencimentoManual || "⚠️ Selecionar data"}
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={strToDate(vencimentoManual)}
                      onSelect={(date) => { if (date) setVencimentoManual(dateToStr(date)); }}
                      initialFocus className="p-3 pointer-events-auto" />
                  </PopoverContent>
                </Popover>
              </div>
              {vencimentoManual && (
                <>
                  {diasUteisVenc !== null && (
                    <div className="text-sm text-muted-foreground">
                      <span className="text-amber-600 dark:text-amber-400 font-bold">{diasUteisVenc}</span> dias úteis
                      {diasUteisVenc > 0 && (
                        <span className="ml-2">· CDI: <span className="text-amber-600 dark:text-amber-300 font-bold">{formatPercent(calcCdiPeriodo(diasUteisVenc, cdiAnual))}</span></span>
                      )}
                    </div>
                  )}
                  <button onClick={handleSaveVenc}
                    className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-400 hover:to-amber-400 rounded-lg text-sm font-black text-white transition-all shadow-lg">
                    <Save className="w-4 h-4" /> Salvar Vencimento
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* TOP COLLARS CARDS */}
      {topCollars.length > 0 && (
        <div className={cn("grid gap-3 mb-5", topCollars.length === 1 ? "grid-cols-1" : topCollars.length === 2 ? "grid-cols-1 md:grid-cols-2" : "grid-cols-1 md:grid-cols-3")}>
          {topCollars.map((collar, i) => {
            const isWinner = i === 0;
            return (
              <div key={`top-${i}`}
                className={cn(
                  "relative overflow-hidden rounded-2xl border-2 p-5 transition-all duration-300",
                  isWinner
                    ? "bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/40 dark:to-teal-950/30 border-emerald-500 dark:border-emerald-400 shadow-[0_0_30px_-5px_rgba(16,185,129,0.4)] ring-2 ring-emerald-400/30 hover:shadow-[0_0_40px_-5px_rgba(16,185,129,0.5)] hover:scale-[1.01]"
                    : "bg-card border-primary/30 shadow-[0_8px_30px_-4px_hsl(var(--primary)/0.15)] hover:shadow-[0_20px_50px_-8px_hsl(var(--primary)/0.25)] hover:border-primary/50 hover:-translate-y-1"
                )}
                style={{ transform: isWinner ? undefined : 'perspective(800px) rotateX(1deg)', transformStyle: 'preserve-3d' }}
              >
                {isWinner && (
                  <span className="absolute top-3 right-3 flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500" />
                  </span>
                )}

                {/* Header: badge + stock */}
                <div className="flex items-center gap-2 mb-3">
                  <Trophy className={cn("w-5 h-5", isWinner ? "text-emerald-500" : i === 1 ? "text-gray-400" : "text-amber-600")} />
                  <span className="text-xs text-muted-foreground uppercase tracking-wider font-bold">
                    {i === 0 ? "🥇 Melhor Collar" : i === 1 ? "🥈 2º Melhor" : "🥉 3º Melhor"}
                  </span>
                  <span className={cn("ml-auto text-[9px] uppercase tracking-widest font-black px-2 py-0.5 rounded-full",
                    collar.tipo === "Normal" ? "bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300" :
                    collar.tipo === "ATM" ? "bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300" :
                    collar.tipo === "Baixa" ? "bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300" :
                    "bg-muted text-muted-foreground")}>{collar.tipo}</span>
                  <span className={cn("text-[9px] uppercase tracking-widest font-black px-2 py-0.5 rounded-full",
                    collar.custoTipo === "Crédito" ? "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300" :
                    collar.custoTipo === "Zero-Cost" ? "bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300" :
                    "bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300")}>{collar.custoTipo}</span>
                </div>

                {/* Stock info */}
                <div className="flex items-baseline gap-2 mb-2">
                  <span className="text-lg font-black text-foreground">{collar.familyName}</span>
                  <span className="text-sm text-muted-foreground">{formatBRL(collar.stockUlt ?? collar.stockAsk)}</span>
                </div>

                {/* Call / Put row */}
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div className="rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800/50 px-3 py-2">
                    <p className="text-[9px] font-bold text-blue-600 dark:text-blue-400 uppercase mb-0.5">V Call</p>
                    <p className="text-sm font-black text-foreground">{collar.callSymbol ?? "—"}</p>
                    <p className="text-[10px] text-muted-foreground">Strike {formatBRL(collar.callStrike)} · Bid {formatBRL(collar.callBid)}</p>
                  </div>
                  <div className="rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/50 px-3 py-2">
                    <p className="text-[9px] font-bold text-red-600 dark:text-red-400 uppercase mb-0.5">C Put</p>
                    <p className="text-sm font-black text-foreground">{collar.putSymbol ?? "—"}</p>
                    <p className="text-[10px] text-muted-foreground">Strike {formatBRL(collar.putStrike)} · Ask {formatBRL(collar.putAsk)}</p>
                  </div>
                </div>

                {/* Custo do Collar */}
                <div className="bg-muted/50 rounded-lg px-3 py-2 mb-3 flex items-center justify-between">
                  <span className="text-xs font-bold text-muted-foreground uppercase">Custo Collar</span>
                  <span className={cn("text-lg font-black", (collar.custoCollar ?? 0) <= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400")}>
                    {formatBRL(collar.custoCollar)} {(collar.custoCollar ?? 0) <= -0.05 ? "💰" : (collar.custoCollar ?? 0) < 0.05 ? "⚖️" : "💸"}
                  </span>
                </div>

                {/* Rentabilidade 3 cenários */}
                <div className="grid grid-cols-3 gap-2 mb-3">
                  <div className="text-center rounded-lg border border-red-200 dark:border-red-800/40 bg-red-50/50 dark:bg-red-950/20 p-2">
                    <TrendingDown className="w-3.5 h-3.5 mx-auto text-red-500 mb-0.5" />
                    <p className="text-[9px] text-red-600 dark:text-red-400 font-bold uppercase">Baixa</p>
                    <p className={cn("text-sm font-black", (collar.rentBaixa ?? 0) >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400")}>
                      {formatPercent(collar.rentBaixa)}
                    </p>
                  </div>
                  <div className="text-center rounded-lg border border-amber-200 dark:border-amber-800/40 bg-amber-50/50 dark:bg-amber-950/20 p-2">
                    <Minus className="w-3.5 h-3.5 mx-auto text-amber-500 mb-0.5" />
                    <p className="text-[9px] text-amber-600 dark:text-amber-400 font-bold uppercase">Neutra</p>
                    <p className={cn("text-sm font-black", (collar.rentNeutra ?? 0) >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400")}>
                      {formatPercent(collar.rentNeutra)}
                    </p>
                  </div>
                  <div className="text-center rounded-lg border border-emerald-200 dark:border-emerald-800/40 bg-emerald-50/50 dark:bg-emerald-950/20 p-2">
                    <TrendingUp className="w-3.5 h-3.5 mx-auto text-emerald-500 mb-0.5" />
                    <p className="text-[9px] text-emerald-600 dark:text-emerald-400 font-bold uppercase">Alta</p>
                    <p className={cn("text-sm font-black", (collar.rentAlta ?? 0) >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400")}>
                      {formatPercent(collar.rentAlta)}
                    </p>
                  </div>
                </div>

                {/* Bottom metrics */}
                <div className="flex flex-wrap items-center gap-3 text-[10px]">
                  <span className="text-muted-foreground">
                    Meses: <span className="font-bold text-foreground">{calcMeses(collar.diasUteis)}</span>
                  </span>
                  <span className="text-muted-foreground">
                    CDI Período: <span className="font-bold text-amber-600 dark:text-amber-400">{formatPercent(collar.cdiPeriodo)}</span>
                  </span>
                  <span className="text-muted-foreground">
                    Put: <span className="font-bold">{collar.distPutPct !== null ? formatPercent(collar.distPutPct) : "—"}</span>
                  </span>
                  <span className="text-muted-foreground">
                    Call: <span className="font-bold">{collar.distCallPct !== null ? `+${formatPercent(collar.distCallPct)}` : "—"}</span>
                  </span>
                  <span className={cn("font-black px-1.5 py-0.5 rounded-full text-[9px]",
                    collar.qualityScore >= 80 ? "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300" :
                    collar.qualityScore >= 60 ? "bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300" :
                    "bg-muted text-muted-foreground")}>
                    Score: {collar.qualityScore}
                  </span>
                  <span className="flex items-center gap-0.5">
                    {Array.from({ length: 3 }).map((_, si) => (
                      <Star key={si} className={cn("w-3.5 h-3.5", si < collar.rating ? "text-amber-400 fill-amber-400" : "text-muted-foreground/30")} />
                    ))}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ADD FAMILY */}
      <div className="mb-5 p-4 rounded-xl border border-border bg-card shadow-md">
        <h3 className="text-sm font-black mb-3 text-foreground flex items-center gap-2 uppercase tracking-wider">
          <Plus className="w-4 h-4 text-primary" /> Adicionar Ação
        </h3>
        <div className="flex gap-2">
          <input
            type="text" value={newFamilyName}
            onChange={(e) => setNewFamilyName(e.target.value.toUpperCase())}
            onKeyDown={(e) => e.key === "Enter" && addFamily()}
            placeholder="Ex: PETR4"
            className="flex-1 bg-background border border-input rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary"
          />
          <button onClick={addFamily}
            className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg text-sm font-bold transition-colors">
            <Plus className="w-4 h-4" /> Adicionar
          </button>
        </div>
      </div>

      {/* FAMILIES */}
      {families.map((family) => {
        const allCollars = calculateCollars(family);
        const collars = allCollars.filter((c) => {
          if (filterTipo !== "Todos" && c.tipo !== filterTipo) return false;
          if (filterCusto !== "Todos" && c.custoTipo !== filterCusto) return false;
          if (hideNegative && c.rentAlta !== null && c.rentAlta < 0) return false;
          return true;
        });
        const stockRow = rows.get(family.name);
        const stockPrice = stockRow?.ultimo;
        const calls = family.tickers.filter((t) => t.type === "CALL");
        const puts = family.tickers.filter((t) => t.type === "PUT");

        return (
          <div key={family.id} className="mb-4 rounded-xl border-2 border-primary/30 bg-card overflow-hidden shadow-[0_8px_30px_-4px_hsl(var(--primary)/0.1)]"
            style={{ transform: 'perspective(800px) rotateX(0.5deg)', transformStyle: 'preserve-3d' }}>
            {/* Family Header */}
            <div className="flex items-center justify-between px-4 py-3 bg-muted/30 border-b border-border/50">
              <button onClick={() => toggleExpand(family.id)} className="flex items-center gap-3 flex-1">
                {family.expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                <span className="font-black text-base text-foreground">{family.name}</span>
                {stockPrice && <span className="text-sm text-primary font-bold">{formatBRL(stockPrice)}</span>}
                <span className="text-xs text-muted-foreground">
                  {calls.length}C · {puts.length}P · {collars.length} collars
                </span>
              </button>
              <button onClick={() => removeFamily(family.id)} className="p-2 text-destructive/60 hover:text-destructive transition-colors">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>

            {family.expanded && (
              <div className="p-4 space-y-4">
                {/* Add tickers */}
                <div className="flex flex-wrap gap-2">
                  <div className="flex-1 min-w-[200px]">
                    <input
                      type="text"
                      placeholder="Cole tickers: PETRB28 PETRN28 ..."
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          processTickerSymbols(family.id, (e.target as HTMLInputElement).value);
                          (e.target as HTMLInputElement).value = "";
                        }
                      }}
                      className="w-full bg-background border border-input rounded-lg px-3 py-2 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                  <label className="flex items-center gap-2 px-3 py-2 bg-muted hover:bg-muted/80 rounded-lg text-xs font-bold cursor-pointer transition-colors">
                    <Upload className="w-3.5 h-3.5" /> Arquivo
                    <input type="file" accept=".txt,.csv" className="hidden"
                      onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileUpload(family.id, f); }} />
                  </label>
                  <button onClick={async () => {
                    const text = await navigator.clipboard.readText();
                    processTickerSymbols(family.id, text);
                  }} className="flex items-center gap-2 px-3 py-2 bg-muted hover:bg-muted/80 rounded-lg text-xs font-bold transition-colors">
                    <ClipboardPaste className="w-3.5 h-3.5" /> Colar
                  </button>
                </div>

                {/* Ticker chips */}
                {family.tickers.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {family.tickers.map((t) => (
                      <span key={t.id} className={cn(
                        "inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold border",
                        t.type === "CALL"
                          ? "bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800/50 text-blue-700 dark:text-blue-300"
                          : "bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800/50 text-red-700 dark:text-red-300"
                      )}>
                        {t.type === "CALL" ? "C" : "P"} {t.symbol}
                        <button onClick={() => removeTicker(family.id, t.id)} className="hover:text-destructive">
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}

                {/* Results table */}
                {collars.length > 0 && (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-border text-[9px] uppercase tracking-wider text-muted-foreground">
                          <th className="text-center py-2 px-1">Tipo</th>
                          <th className="text-left py-2 px-2">V Call</th>
                          <th className="text-left py-2 px-2">C Put</th>
                          <th className="text-right py-2 px-2 bg-muted/50">Strike Call</th>
                          <th className="text-right py-2 px-2 bg-muted/50">Strike Put</th>
                          <th className="text-right py-2 px-2">Call Bid</th>
                          <th className="text-right py-2 px-2">Put Ask</th>
                          <th className="text-right py-2 px-2 font-black">Custo</th>
                          <th className="text-right py-2 px-2">↓ Baixa</th>
                          <th className="text-right py-2 px-2">↔ Neutra</th>
                          <th className="text-right py-2 px-2">↑ Alta</th>
                          <th className="text-right py-2 px-2">CDI Per.</th>
                          <th className="text-center py-2 px-1">Score</th>
                          <th className="text-center py-2 px-2">Rating</th>
                        </tr>
                      </thead>
                      <tbody>
                        {collars.map((c, ci) => (
                          <tr key={ci} className={cn("border-b border-border/30 hover:bg-muted/20 transition-colors",
                            ci === 0 && "bg-emerald-50/50 dark:bg-emerald-950/10")}>
                            <td className="py-2 px-1 text-center">
                              <span className={cn("text-[8px] font-black px-1.5 py-0.5 rounded-full whitespace-nowrap",
                                c.tipo === "Normal" ? "bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300" :
                                c.tipo === "ATM" ? "bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300" :
                                c.tipo === "Baixa" ? "bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300" :
                                "bg-muted text-muted-foreground")}>{c.tipo}</span>
                            </td>
                            <td className="py-2 px-2 font-bold text-blue-600 dark:text-blue-400">{c.callSymbol ?? "—"}</td>
                            <td className="py-2 px-2 font-bold text-red-600 dark:text-red-400">{c.putSymbol ?? "—"}</td>
                            <td className="py-2 px-2 text-right bg-muted/30 font-bold">{formatBRL(c.callStrike)}</td>
                            <td className="py-2 px-2 text-right bg-muted/30 font-bold">{formatBRL(c.putStrike)}</td>
                            <td className="py-2 px-2 text-right">{formatBRL(c.callBid)}</td>
                            <td className="py-2 px-2 text-right">{formatBRL(c.putAsk)}</td>
                            <td className={cn("py-2 px-2 text-right font-black", (c.custoCollar ?? 0) <= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-orange-600 dark:text-orange-400")}>{formatBRL(c.custoCollar)}</td>
                            <td className={cn("py-2 px-2 text-right font-bold", (c.rentBaixa ?? 0) >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400")}>
                              {formatPercent(c.rentBaixa)}
                            </td>
                            <td className={cn("py-2 px-2 text-right font-bold", (c.rentNeutra ?? 0) >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400")}>
                              {formatPercent(c.rentNeutra)}
                            </td>
                            <td className={cn("py-2 px-2 text-right font-bold", (c.rentAlta ?? 0) >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400")}>
                              {formatPercent(c.rentAlta)}
                            </td>
                            <td className="py-2 px-2 text-right text-amber-600 dark:text-amber-400">{formatPercent(c.cdiPeriodo)}</td>
                            <td className="py-2 px-1 text-center">
                              <span className={cn("text-[9px] font-black px-1.5 py-0.5 rounded-full",
                                c.qualityScore >= 80 ? "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300" :
                                c.qualityScore >= 60 ? "bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300" :
                                "bg-muted text-muted-foreground")}>{c.qualityScore}</span>
                            </td>
                            <td className="py-2 px-2 text-center">
                              <span className="flex items-center justify-center gap-0.5">
                                {Array.from({ length: 3 }).map((_, si) => (
                                  <Star key={si} className={cn("w-3 h-3", si < c.rating ? "text-amber-400 fill-amber-400" : "text-muted-foreground/20")} />
                                ))}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {collars.length === 0 && family.tickers.length > 0 && (
                  <p className="text-xs text-muted-foreground text-center py-4">
                    Adicione pelo menos uma CALL e uma PUT para calcular collars.
                  </p>
                )}
                {family.tickers.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-4">
                    Adicione tickers de opções (calls e puts) para esta ação.
                  </p>
                )}
              </div>
            )}
          </div>
        );
      })}

      {families.length === 0 && (
        <div className="text-center py-16 text-muted-foreground">
          <Shield className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="font-bold">Nenhuma ação adicionada</p>
          <p className="text-xs mt-1">Adicione uma ação acima para começar a rastrear collars em tempo real.</p>
        </div>
      )}
    </div>
  );
}
