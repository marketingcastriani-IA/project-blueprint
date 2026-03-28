// ============================================================
// RASTREADOR DE BOX - Tempo Real via Profit RTD Bridge
// Custo = (Preço_Ação + Preço_Put) - Preço_Call
// Lucro = Strike - Custo
// Lucro % = Lucro / Custo × 100
// ============================================================

import { useState, useRef, useCallback, useEffect } from "react";
import { format } from "date-fns";
import {
  Plus,
  Trash2,
  Upload,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Star,
  ClipboardPaste,
  X,
  BarChart2,
  Trophy,
  Wifi,
  WifiOff,
  AlertTriangle,
  TrendingUp,
  CalendarIcon,
  Pencil,
  Save,
  ToggleLeft,
  ToggleRight,
} from "lucide-react";
import { useSharedRtdBridge } from "@/contexts/RtdBridgeContext";
import { statusConfig } from "@/hooks/useRtdBridge";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

// ─── TIPOS ───────────────────────────────────────────────────
interface OptionTicker {
  id: string;
  symbol: string;
  type: "CALL" | "PUT";
  strike: number;
}

interface BoxPair {
  strike: number;
  strikeRtd: number | null;
  vencimento: string | null;
  callSymbol: string | null;
  putSymbol: string | null;
  callBid: number | null;
  callAsk: number | null;
  putBid: number | null;
  putAsk: number | null;
  stockBid: number | null;
  stockAsk: number | null;
  compraBox: number | null;
  lucro: number | null;
  lucroTotal: number | null;
  lucroPercent: number | null;
  lucroLiqAcoes: number | null;
  lucroLiqAcoesTotal: number | null;
  lucroLiqAcoesPercent: number | null;
  diasUteis: number | null;
  cdiPeriodo: number | null;
  cdiPeriodoLiq: number | null;
  vsCD: string | null;
  vsCDLiq: string | null;
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
const STORAGE_KEY = "box-tracker-families";
const VENC_STORAGE_KEY = "box-tracker-vencimento";
const CDI_ANUAL_DEFAULT = 14.15;
const CDI_STORAGE_KEY = "box-tracker-cdi-anual";
const IR_ACOES = 15;
const IR_RENDA_FIXA = 22.5;

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
    if (raw >= 100) return raw / 100;
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

// ─── COMPONENTE PRINCIPAL ─────────────────────────────────────
export default function BoxTracker() {
  const [families, setFamilies] = useState<StockFamily[]>([]);
  const [newFamilyName, setNewFamilyName] = useState("");
  const [quantidade, setQuantidade] = useState<number>(100);
  const [vencimentoManual, setVencimentoManual] = useState<string>("");
  const [vencSaved, setVencSaved] = useState(false);
  const [editingVenc, setEditingVenc] = useState(false);
  const [descontarIRAcoes, setDescontarIRAcoes] = useState(false);
  const [descontarIRRendaFixa, setDescontarIRRendaFixa] = useState(false);
  const [cdiAnual, setCdiAnual] = useState<number>(() => {
    try {
      const saved = localStorage.getItem(CDI_STORAGE_KEY);
      return saved ? parseFloat(saved) : CDI_ANUAL_DEFAULT;
    } catch { return CDI_ANUAL_DEFAULT; }
  });
  const [editingCdi, setEditingCdi] = useState(false);
  const [cdiInput, setCdiInput] = useState(String(cdiAnual).replace(".", ","));

  const { status, rows, connect, addTicker: bridgeAddTicker } = useSharedRtdBridge();

  // Load vencimento from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(VENC_STORAGE_KEY);
      if (saved) {
        setVencimentoManual(saved);
        setVencSaved(true);
      }
    } catch {}
  }, []);

  // Load families from localStorage
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

  // Save families to localStorage
  useEffect(() => {
    const toSave: SavedFamily[] = families.map((f) => ({
      name: f.name,
      tickers: f.tickers.map((t) => t.symbol),
    }));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
  }, [families]);

  // Auto-subscribe tickers
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

  const handleEditVenc = () => {
    setVencSaved(false);
    setEditingVenc(true);
  };

  const handleDeleteVenc = () => {
    setVencimentoManual("");
    setVencSaved(false);
    setEditingVenc(false);
    localStorage.removeItem(VENC_STORAGE_KEY);
  };

  const addFamily = useCallback(() => {
    const name = newFamilyName.trim().toUpperCase();
    if (!name) return;
    if (families.find((f) => f.name === name)) return;
    setFamilies((prev) => [
      ...prev,
      { id: generateId(), name, tickers: [], expanded: true },
    ]);
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
        id: generateId(),
        symbol,
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

  const calculateBoxPairs = useCallback(
    (family: StockFamily): BoxPair[] => {
      const stockRow = rows.get(family.name);
      const stockBid = getPrice(stockRow, "ofCompra");
      const stockAsk = getPrice(stockRow, "ofVenda");
      const qty = quantidade;

      const strikeMap = new Map<number, { calls: OptionTicker[]; puts: OptionTicker[] }>();
      family.tickers.forEach((t) => {
        if (t.strike <= 0) return;
        if (!strikeMap.has(t.strike)) strikeMap.set(t.strike, { calls: [], puts: [] });
        const group = strikeMap.get(t.strike)!;
        if (t.type === "CALL") group.calls.push(t);
        else group.puts.push(t);
      });

      const pairs: BoxPair[] = [];

      strikeMap.forEach((group, strike) => {
        const call = group.calls[0] || null;
        const put = group.puts[0] || null;
        const callRow = call ? rows.get(call.symbol) : null;
        const putRow = put ? rows.get(put.symbol) : null;

        const callBid = getPrice(callRow, "ofCompra");
        const callAsk = getPrice(callRow, "ofVenda");
        const putBid = getPrice(putRow, "ofCompra");
        const putAsk = getPrice(putRow, "ofVenda");

        const strikeRtd = callRow?.strike ?? putRow?.strike ?? null;
        const vencimento = callRow?.ven ?? putRow?.ven ?? null;

        // Custo = (Preço_Ação + Preço_Put) - Preço_Call
        let compraBox: number | null = null;
        let lucro: number | null = null;
        let lucroTotal: number | null = null;
        let lucroPercent: number | null = null;
        let lucroLiqAcoes: number | null = null;
        let lucroLiqAcoesTotal: number | null = null;
        let lucroLiqAcoesPercent: number | null = null;

        if (stockAsk !== null && callBid !== null && putAsk !== null) {
          compraBox = (stockAsk + putAsk) - callBid;
          const strikeReal = strikeRtd ?? strike;
          lucro = strikeReal - compraBox;
          lucroTotal = lucro * qty;
          lucroPercent = compraBox > 0 ? (lucro / compraBox) * 100 : null;

          // Lucro líquido com IR de ações (15%)
          if (descontarIRAcoes && lucro > 0) {
            lucroLiqAcoes = lucro * (1 - IR_ACOES / 100);
            lucroLiqAcoesTotal = lucroLiqAcoes * qty;
            lucroLiqAcoesPercent = compraBox > 0 ? (lucroLiqAcoes / compraBox) * 100 : null;
          } else {
            lucroLiqAcoes = lucro;
            lucroLiqAcoesTotal = lucroTotal;
            lucroLiqAcoesPercent = lucroPercent;
          }
        }

        const vencParaCalculo = vencimentoManual || vencimento;
        const diasUteis = calcDiasUteis(vencParaCalculo);
        const cdiPeriodo = diasUteis !== null && diasUteis > 0 ? calcCdiPeriodo(diasUteis, cdiAnual) : null;

        // CDI líquido com IR renda fixa (22.5%)
        let cdiPeriodoLiq = cdiPeriodo;
        if (descontarIRRendaFixa && cdiPeriodo !== null) {
          cdiPeriodoLiq = cdiPeriodo * (1 - IR_RENDA_FIXA / 100);
        }

        const lucroFinalPercent = descontarIRAcoes ? lucroLiqAcoesPercent : lucroPercent;
        const cdiFinal = descontarIRRendaFixa ? cdiPeriodoLiq : cdiPeriodo;
        const vsCD = lucroFinalPercent !== null && cdiFinal !== null
          ? (lucroFinalPercent > cdiFinal ? "acima" : "abaixo")
          : null;
        const vsCDLiq = vsCD;

        pairs.push({
          strike, strikeRtd, vencimento: vencParaCalculo,
          callSymbol: call?.symbol ?? null, putSymbol: put?.symbol ?? null,
          callBid, callAsk, putBid, putAsk, stockBid, stockAsk,
          compraBox, lucro, lucroTotal, lucroPercent,
          lucroLiqAcoes, lucroLiqAcoesTotal, lucroLiqAcoesPercent,
          diasUteis, cdiPeriodo, cdiPeriodoLiq,
          vsCD, vsCDLiq,
        });
      });

      pairs.sort((a, b) => (b.lucroPercent ?? -999) - (a.lucroPercent ?? -999));
      return pairs;
    },
    [rows, quantidade, vencimentoManual, descontarIRAcoes, descontarIRRendaFixa, cdiAnual]
  );

  // Global ranking — only the #1 best box per family
  const bestPerFamily: (BoxPair & { familyName: string })[] = [];
  families.forEach((f) => {
    const pairs = calculateBoxPairs(f);
    const best = pairs.find((p) => p.lucroPercent !== null && p.lucroPercent > 0);
    if (best) bestPerFamily.push({ ...best, familyName: f.name });
  });
  bestPerFamily.sort((a, b) => (b.lucroPercent ?? 0) - (a.lucroPercent ?? 0));
  const topPairs = bestPerFamily.slice(0, 10);

  const isConnected = status === "connected";
  const statusCfg = statusConfig[status];

  const diasUteisVenc = calcDiasUteis(vencimentoManual);

  // Determine winner
  const winnerKey = topPairs.length > 0 ? `${topPairs[0].familyName}-${topPairs[0].strike}` : null;

  // ─── RENDER ───────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-background text-foreground font-mono p-3 md:p-6">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
        <div>
          <h1 className="text-xl md:text-2xl font-bold tracking-tight text-primary flex items-center gap-2">
            <BarChart2 className="w-5 h-5 md:w-6 md:h-6" />
            Rastreador de Box
          </h1>
          <p className="text-[10px] md:text-xs text-muted-foreground mt-1">
            Custo = (Ação + Put) - Call · Lucro = Strike - Custo
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-semibold ${statusCfg.color}`}>
            {status === "connected" ? (
              <Wifi className="w-3.5 h-3.5" />
            ) : status === "error" ? (
              <AlertTriangle className="w-3.5 h-3.5" />
            ) : status === "connecting" ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <WifiOff className="w-3.5 h-3.5" />
            )}
            {statusCfg.label}
            {isConnected && (
              <span className="text-emerald-600 dark:text-emerald-400">· {rows.size} tickers</span>
            )}
          </div>

          {!isConnected && status !== "connecting" && (
            <button
              onClick={connect}
              className="flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-400 text-white rounded-lg text-sm font-bold transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Conectar Bridge
            </button>
          )}
        </div>
      </div>

      {/* Bridge not connected warning */}
      {!isConnected && status !== "connecting" && (
        <div className="mb-5 bg-warning/10 border border-warning/30 rounded-xl p-4 text-sm">
          <div className="flex items-center gap-2 text-warning font-bold mb-1">
            <AlertTriangle className="w-4 h-4" />
            Bridge RTD não conectado
          </div>
          <p className="text-muted-foreground text-xs">
            Inicie o <strong>ProfitRTDBridge.exe</strong> para receber dados em tempo real do Profit Pro.
          </p>
        </div>
      )}

      {/* IR TOGGLES + CDI ANUAL EDITÁVEL */}
      <div className="mb-5 flex flex-col sm:flex-row gap-3 flex-wrap">
        {/* CDI Anual Editável */}
        <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-amber-300 dark:border-amber-500/50 bg-amber-50 dark:bg-amber-950/30">
          <span className="text-xs font-bold text-amber-700 dark:text-amber-300 uppercase tracking-wider whitespace-nowrap">📊 CDI Anual:</span>
          {editingCdi ? (
            <div className="flex items-center gap-1.5">
              <input
                type="text"
                value={cdiInput}
                onChange={(e) => setCdiInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    const val = parseFloat(cdiInput.replace(",", "."));
                    if (!isNaN(val) && val > 0 && val < 100) {
                      setCdiAnual(val);
                      localStorage.setItem(CDI_STORAGE_KEY, String(val));
                      setEditingCdi(false);
                    }
                  } else if (e.key === "Escape") {
                    setCdiInput(String(cdiAnual).replace(".", ","));
                    setEditingCdi(false);
                  }
                }}
                className="w-20 bg-card border border-amber-400 dark:border-amber-500 rounded-lg px-2 py-1 text-sm text-center font-black text-amber-700 dark:text-amber-300 focus:outline-none focus:ring-2 focus:ring-amber-400"
                autoFocus
              />
              <span className="text-sm font-bold text-amber-600 dark:text-amber-400">%</span>
              <button
                onClick={() => {
                  const val = parseFloat(cdiInput.replace(",", "."));
                  if (!isNaN(val) && val > 0 && val < 100) {
                    setCdiAnual(val);
                    localStorage.setItem(CDI_STORAGE_KEY, String(val));
                    setEditingCdi(false);
                  }
                }}
                className="px-2 py-1 bg-amber-500 hover:bg-amber-400 text-white rounded-lg text-xs font-bold transition-colors"
              >
                <Save className="w-3 h-3" />
              </button>
              <button
                onClick={() => { setCdiInput(String(cdiAnual).replace(".", ",")); setEditingCdi(false); }}
                className="px-2 py-1 bg-muted hover:bg-muted/80 text-muted-foreground rounded-lg text-xs font-bold transition-colors"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => { setCdiInput(String(cdiAnual).replace(".", ",")); setEditingCdi(true); }}
              className="flex items-center gap-1.5 text-lg font-black text-amber-600 dark:text-amber-400 hover:text-amber-500 dark:hover:text-amber-300 transition-colors cursor-pointer"
              title="Clique para editar a taxa CDI anual"
            >
              {String(cdiAnual).replace(".", ",")}%
              <Pencil className="w-3.5 h-3.5 opacity-50" />
            </button>
          )}
        </div>

        {/* IR Ações */}
        <button
          onClick={() => setDescontarIRAcoes(!descontarIRAcoes)}
          className={cn(
            "flex items-center gap-2 px-4 py-2.5 rounded-xl border text-xs font-bold transition-all",
            descontarIRAcoes
              ? "bg-emerald-100 dark:bg-emerald-950/40 border-emerald-500/60 text-emerald-700 dark:text-emerald-300 shadow-[0_0_12px_rgba(16,185,129,0.3)] animate-pulse"
              : "bg-red-50 dark:bg-red-950/20 border-red-400/40 text-red-600 dark:text-red-400"
          )}
        >
          {descontarIRAcoes ? <ToggleRight className="w-5 h-5" /> : <ToggleLeft className="w-5 h-5" />}
          IR Ações {IR_ACOES}%
          <span className={cn(
            "text-[9px] px-1.5 py-0.5 rounded-full font-black uppercase",
            descontarIRAcoes ? "bg-emerald-500 text-white" : "bg-red-400 text-white"
          )}>
            {descontarIRAcoes ? "ON" : "OFF"}
          </span>
        </button>

        {/* IR Renda Fixa */}
        <button
          onClick={() => setDescontarIRRendaFixa(!descontarIRRendaFixa)}
          className={cn(
            "flex items-center gap-2 px-4 py-2.5 rounded-xl border text-xs font-bold transition-all",
            descontarIRRendaFixa
              ? "bg-emerald-100 dark:bg-emerald-950/40 border-emerald-500/60 text-emerald-700 dark:text-emerald-300 shadow-[0_0_12px_rgba(16,185,129,0.3)] animate-pulse"
              : "bg-red-50 dark:bg-red-950/20 border-red-400/40 text-red-600 dark:text-red-400"
          )}
        >
          {descontarIRRendaFixa ? <ToggleRight className="w-5 h-5" /> : <ToggleLeft className="w-5 h-5" />}
          IR Renda Fixa {IR_RENDA_FIXA}%
          <span className={cn(
            "text-[9px] px-1.5 py-0.5 rounded-full font-black uppercase",
            descontarIRRendaFixa ? "bg-emerald-500 text-white" : "bg-red-400 text-white"
          )}>
            {descontarIRRendaFixa ? "ON" : "OFF"}
          </span>
        </button>
      </div>

      {/* VENCIMENTO CARD */}
      <div className="mb-5">
        <div className={cn(
          "rounded-xl border p-4 transition-all",
          vencSaved
            ? "bg-orange-50 dark:bg-orange-950/20 border-orange-400/50"
            : "bg-card border-border shadow-md"
        )}>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-black text-orange-600 dark:text-orange-400 flex items-center gap-2 uppercase tracking-wider">
              <CalendarIcon className="w-4 h-4" />
              📅 Data de Vencimento
            </h3>
            {vencSaved && (
              <div className="flex gap-2">
                <button
                  onClick={handleEditVenc}
                  className="flex items-center gap-1 px-3 py-1 text-xs bg-amber-100 dark:bg-amber-700/40 hover:bg-amber-200 dark:hover:bg-amber-600/50 border border-amber-400/50 rounded-lg text-amber-700 dark:text-amber-300 font-bold transition-colors"
                >
                  <Pencil className="w-3 h-3" /> Editar
                </button>
                <button
                  onClick={handleDeleteVenc}
                  className="flex items-center gap-1 px-3 py-1 text-xs bg-red-100 dark:bg-red-900/40 hover:bg-red-200 dark:hover:bg-red-800/50 border border-red-400/50 rounded-lg text-red-600 dark:text-red-400 font-bold transition-colors"
                >
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
                      <span className="ml-2">
                        · CDI do período: <span className="text-amber-600 dark:text-amber-300 font-bold">{formatPercent(calcCdiPeriodo(diasUteisVenc, cdiAnual))}</span>
                        {descontarIRRendaFixa && (
                          <span className="ml-1 text-muted-foreground">
                            (líq: <span className="text-emerald-600 dark:text-emerald-400 font-bold">{formatPercent(calcCdiPeriodo(diasUteisVenc, cdiAnual) * (1 - IR_RENDA_FIXA / 100))}</span>)
                          </span>
                        )}
                      </span>
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
                    <button
                      className={cn(
                        "flex items-center gap-2 px-4 py-2.5 rounded-lg border text-sm font-bold transition-all w-[220px] justify-start",
                        vencimentoManual
                          ? "bg-card border-orange-500/60 text-orange-600 dark:text-orange-300"
                          : "bg-card border-border text-muted-foreground animate-pulse"
                      )}
                    >
                      <CalendarIcon className="w-4 h-4" />
                      {vencimentoManual || "⚠️ Selecionar data"}
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={strToDate(vencimentoManual)}
                      onSelect={(date) => {
                        if (date) setVencimentoManual(dateToStr(date));
                      }}
                      initialFocus
                      className="p-3 pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>

              {vencimentoManual && (
                <>
                  {diasUteisVenc !== null && (
                    <div className="text-sm text-muted-foreground">
                      <span className="text-amber-600 dark:text-amber-400 font-bold">{diasUteisVenc}</span> dias úteis
                      {diasUteisVenc > 0 && (
                        <span className="ml-2">
                          · CDI: <span className="text-amber-600 dark:text-amber-300 font-bold">{formatPercent(calcCdiPeriodo(diasUteisVenc, cdiAnual))}</span>
                        </span>
                      )}
                    </div>
                  )}
                  <button
                    onClick={handleSaveVenc}
                    className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-400 hover:to-amber-400 rounded-lg text-sm font-black text-white transition-all shadow-lg"
                  >
                    <Save className="w-4 h-4" />
                    Salvar Vencimento
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* WINNER CARDS - Top 1 de cada ação */}
      {topPairs.length > 0 && (
        <div className={cn("grid gap-3 mb-5", topPairs.length === 1 ? "grid-cols-1" : topPairs.length === 2 ? "grid-cols-1 md:grid-cols-2" : "grid-cols-1 md:grid-cols-3")}>
          {topPairs.map((pair, i) => {
            const isWinner = i === 0;
            const lucroDisplay = descontarIRAcoes ? pair.lucroLiqAcoes : pair.lucro;
            const lucroTotalDisplay = descontarIRAcoes ? pair.lucroLiqAcoesTotal : pair.lucroTotal;
            const lucroPercentDisplay = descontarIRAcoes ? pair.lucroLiqAcoesPercent : pair.lucroPercent;
            const cdiDisplay = descontarIRRendaFixa ? pair.cdiPeriodoLiq : pair.cdiPeriodo;

            return (
              <div
                key={`top-${i}`}
                className={cn(
                  "relative overflow-hidden rounded-xl border-2 p-4 transition-all duration-300",
                  isWinner
                    ? "bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/40 dark:to-teal-950/30 border-emerald-500 dark:border-emerald-400 shadow-[0_0_30px_-5px_rgba(16,185,129,0.4)] ring-2 ring-emerald-400/30 dark:ring-emerald-400/20 hover:shadow-[0_0_40px_-5px_rgba(16,185,129,0.5)] hover:scale-[1.01]"
                    : i === 1
                    ? "bg-card border-border/80 hover:border-muted-foreground/30 hover:shadow-md"
                    : "bg-card border-border/80 hover:border-muted-foreground/30 hover:shadow-md"
                )}
              >
                {isWinner && (
                  <span className="absolute top-3 right-3 flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500" />
                  </span>
                )}
                <div className="flex items-center gap-2 mb-2">
                  <Trophy
                    className={cn("w-5 h-5", 
                      isWinner ? "text-emerald-500" : i === 1 ? "text-gray-400" : "text-amber-600"
                    )}
                  />
                  <span className="text-xs text-muted-foreground uppercase tracking-wider font-bold">
                    {i === 0 ? "🥇 Melhor Box" : i === 1 ? "🥈 2º Melhor" : "🥉 3º Melhor"}
                  </span>
                </div>

                <div className="flex flex-wrap items-baseline gap-2 mb-1">
                  <span className="text-lg font-black text-foreground">{pair.familyName}</span>
                  <span className="text-xs text-muted-foreground">Strike {formatBRL(pair.strikeRtd ?? pair.strike)}</span>
                  {pair.vencimento && (
                    <span className="text-xs text-amber-600 dark:text-amber-400/70 ml-1">· {pair.vencimento}</span>
                  )}
                </div>

                <div className="flex items-center gap-3 text-sm">
                  <span className="text-muted-foreground">
                    Call: <span className="text-blue-600 dark:text-blue-300 font-bold">{pair.callSymbol ?? "—"}</span>
                  </span>
                  <span className="text-muted-foreground">
                    Put: <span className="text-red-600 dark:text-red-300 font-bold">{pair.putSymbol ?? "—"}</span>
                  </span>
                </div>

                <div className="mt-3 grid grid-cols-3 md:grid-cols-6 gap-2">
                  <div>
                    <p className="text-[9px] text-muted-foreground uppercase">Custo</p>
                    <p className="text-sm font-bold text-orange-600 dark:text-orange-400">{formatBRL(pair.compraBox)}</p>
                  </div>
                  <div>
                    <p className="text-[9px] text-muted-foreground uppercase">Lucro (1){descontarIRAcoes ? " líq" : ""}</p>
                    <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400">{formatBRL(lucroDisplay)}</p>
                  </div>
                  <div>
                    <p className="text-[9px] text-muted-foreground uppercase">Total ({quantidade}x)</p>
                    <p className="text-sm font-bold text-emerald-600 dark:text-emerald-300">{formatBRL(lucroTotalDisplay)}</p>
                  </div>
                  <div>
                    <p className="text-[9px] text-muted-foreground uppercase">CDI Per.{descontarIRRendaFixa ? " líq" : ""}</p>
                    <p className="text-sm font-bold text-amber-600 dark:text-amber-400">{cdiDisplay !== null ? formatPercent(cdiDisplay) : "—"}</p>
                  </div>
                  <div>
                    <p className="text-[9px] text-muted-foreground uppercase">Retorno{descontarIRAcoes ? " líq" : ""}</p>
                    <p className="text-sm font-bold text-emerald-600 dark:text-emerald-300">{formatPercent(lucroPercentDisplay)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[9px] text-muted-foreground uppercase">vs CDI</p>
                    {(() => {
                      const diff = (lucroPercentDisplay ?? 0) - (cdiDisplay ?? 0);
                      const isAbove = diff > 0;
                      return (
                        <>
                          <p className={cn(
                            "text-2xl font-black",
                            isAbove ? "text-emerald-500 dark:text-emerald-300" : "text-red-500"
                          )}>
                            {isAbove ? "+" : ""}{diff.toFixed(2).replace(".", ",")}%
                          </p>
                          <span className={cn(
                            "text-[9px] font-bold",
                            isAbove ? "text-emerald-600 dark:text-emerald-500" : "text-red-500"
                          )}>
                            {isAbove ? "▲ ACIMA CDI" : "▼ ABAIXO CDI"}
                          </span>
                        </>
                      );
                    })()}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* TOP 10 TABLE — Top 1 de cada ação */}
      {topPairs.length > 0 && (
        <div className="mb-5 bg-card border border-border rounded-xl p-4">
          <h2 className="text-sm font-bold text-primary mb-3 flex items-center gap-2">
            <Star className="w-4 h-4 text-amber-500" />
            🏆 Ranking · Melhor Box por Ação
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-muted-foreground border-b border-border">
                  <th className="text-left py-2 pr-2">#</th>
                  <th className="text-left py-2 pr-2">Ativo</th>
                  <th className="text-left py-2 pr-2 text-blue-600 dark:text-blue-400">CALL</th>
                  <th className="text-left py-2 pr-2 text-red-600 dark:text-red-400">PUT</th>
                  <th className="text-right py-2 pr-2">Strike</th>
                  <th className="text-right py-2 pr-2 text-orange-600 dark:text-orange-400">Custo</th>
                  <th className="text-right py-2 pr-2">Lucro</th>
                  <th className="text-right py-2 pr-2">Total</th>
                  <th className="text-right py-2 pr-2">Lucro %</th>
                  <th className="text-right py-2 pr-2 text-amber-600 dark:text-amber-400">CDI Per.</th>
                  <th className="text-center py-2 pr-2 text-emerald-600 dark:text-emerald-400 font-bold">% vs CDI</th>
                </tr>
              </thead>
              <tbody>
                {topPairs.map((p, i) => {
                  const lucroDisplay = descontarIRAcoes ? p.lucroLiqAcoes : p.lucro;
                  const lucroTotalDisplay = descontarIRAcoes ? p.lucroLiqAcoesTotal : p.lucroTotal;
                  const lucroPercentDisplay = descontarIRAcoes ? p.lucroLiqAcoesPercent : p.lucroPercent;
                  const cdiDisplay = descontarIRRendaFixa ? p.cdiPeriodoLiq : p.cdiPeriodo;
                  const isFirst = i === 0;
                  return (
                    <tr key={`rank-${i}`} className={cn("border-b border-border/50 hover:bg-muted/50", isFirst && "bg-emerald-50/50 dark:bg-emerald-950/20")}>
                      <td className="py-2 pr-2 text-muted-foreground font-bold">{i + 1}º</td>
                      <td className="py-2 pr-2 font-bold text-foreground">{p.familyName}</td>
                      <td className="py-2 pr-2 text-blue-600 dark:text-blue-300">{p.callSymbol}</td>
                      <td className="py-2 pr-2 text-red-600 dark:text-red-300">{p.putSymbol}</td>
                      <td className="py-2 pr-2 text-right">{formatBRL(p.strikeRtd ?? p.strike)}</td>
                      <td className="py-2 pr-2 text-right text-orange-600 dark:text-orange-400">{formatBRL(p.compraBox)}</td>
                      <td className="py-2 pr-2 text-right text-emerald-600 dark:text-emerald-400">{formatBRL(lucroDisplay)}</td>
                      <td className="py-2 pr-2 text-right text-emerald-600 dark:text-emerald-300 font-semibold">{formatBRL(lucroTotalDisplay)}</td>
                      <td className="py-2 pr-2 text-right font-bold text-emerald-600 dark:text-emerald-300">{formatPercent(lucroPercentDisplay)}</td>
                      <td className="py-2 pr-2 text-right text-amber-600 dark:text-amber-400">{cdiDisplay !== null ? formatPercent(cdiDisplay) : "—"}</td>
                      <td className="py-2 pr-2 text-center">
                        {(() => {
                          const diff = (lucroPercentDisplay ?? 0) - (cdiDisplay ?? 0);
                          const isAbove = diff > 0;
                          return (
                            <span className={cn("font-black text-sm", isAbove ? "text-emerald-500 dark:text-emerald-300" : "text-red-500")}>
                              {isAbove ? "+" : ""}{diff.toFixed(2).replace(".", ",")}%
                            </span>
                          );
                        })()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* CONTROLES: Quantidade e Adicionar Família */}
      <div className="flex flex-col sm:flex-row flex-wrap gap-3 mb-5 items-stretch sm:items-end">
        <div className="flex flex-col gap-1">
          <label className="text-[10px] text-orange-600 dark:text-orange-400/70 uppercase tracking-wider font-bold">Quantidade</label>
          <input
            type="number"
            value={quantidade}
            onChange={(e) => setQuantidade(Math.max(1, parseInt(e.target.value) || 1))}
            min={1}
            className="w-full sm:w-24 bg-card border border-border rounded-lg px-3 py-2 text-sm text-center font-bold text-orange-600 dark:text-orange-300 focus:outline-none focus:border-primary transition-colors"
          />
        </div>
        <div className="flex gap-2 flex-1">
          <input
            type="text"
            value={newFamilyName}
            onChange={(e) => setNewFamilyName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addFamily()}
            placeholder="Ticker do ativo (ex: PETR4, BBDC4...)"
            className="flex-1 bg-card border border-border rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-primary transition-colors placeholder-muted-foreground"
          />
          <button
            onClick={addFamily}
            className="flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-400 text-white rounded-lg text-sm font-bold transition-colors"
          >
            <Plus className="w-4 h-4" />
            Adicionar
          </button>
        </div>
      </div>

      {/* FAMILIES */}
      {families.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <BarChart2 className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="text-sm">Nenhuma família criada.</p>
          <p className="text-xs mt-1">Adicione um ativo acima para começar a rastrear.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {families.map((family) => (
            <FamilyCard
              key={family.id}
              family={family}
              rows={rows}
              quantidade={quantidade}
              calculateBoxPairs={calculateBoxPairs}
              onRemoveFamily={removeFamily}
              onToggleExpand={toggleExpand}
              onAddTickers={processTickerSymbols}
              onRemoveTicker={removeTicker}
              onFileUpload={handleFileUpload}
              descontarIRAcoes={descontarIRAcoes}
              descontarIRRendaFixa={descontarIRRendaFixa}
              winnerKey={winnerKey}
              cdiAnual={cdiAnual}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── CARD DE FAMÍLIA ──────────────────────────────────────────
interface FamilyCardProps {
  family: StockFamily;
  rows: Map<string, any>;
  quantidade: number;
  calculateBoxPairs: (family: StockFamily) => BoxPair[];
  onRemoveFamily: (id: string) => void;
  onToggleExpand: (id: string) => void;
  onAddTickers: (familyId: string, raw: string) => void;
  onRemoveTicker: (familyId: string, tickerId: string) => void;
  onFileUpload: (familyId: string, file: File) => void;
  descontarIRAcoes: boolean;
  descontarIRRendaFixa: boolean;
  winnerKey: string | null;
  cdiAnual: number;
}

function FamilyCard({
  family,
  rows,
  quantidade,
  calculateBoxPairs,
  onRemoveFamily,
  onToggleExpand,
  onAddTickers,
  onRemoveTicker,
  onFileUpload,
  descontarIRAcoes,
  descontarIRRendaFixa,
  winnerKey,
  cdiAnual,
}: FamilyCardProps) {
  const [showPaste, setShowPaste] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const [manualTicker, setManualTicker] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const pasteRef = useRef<HTMLTextAreaElement>(null);

  const handlePasteFromClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text.trim()) onAddTickers(family.id, text);
    } catch {
      setShowPaste(true);
      setTimeout(() => pasteRef.current?.focus(), 100);
    }
  };

  const handlePasteSubmit = () => {
    if (!pasteText.trim()) return;
    onAddTickers(family.id, pasteText);
    setPasteText("");
    setShowPaste(false);
  };

  const handleManualAdd = () => {
    if (!manualTicker.trim()) return;
    onAddTickers(family.id, manualTicker);
    setManualTicker("");
  };

  const handleTextAreaPaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const text = e.clipboardData.getData("text");
    if (text.trim()) {
      e.preventDefault();
      onAddTickers(family.id, text);
      setShowPaste(false);
      setPasteText("");
    }
  };

  const boxPairs = calculateBoxPairs(family);
  const bestPair = boxPairs.find((p) => p.lucroPercent !== null && p.lucroPercent > 0);

  const stockRow = rows.get(family.name);
  const stockBid = (stockRow?.ofCompra && stockRow.ofCompra !== 0) ? stockRow.ofCompra : stockRow?.ultimo ?? null;
  const stockAsk = (stockRow?.ofVenda && stockRow.ofVenda !== 0) ? stockRow.ofVenda : stockRow?.ultimo ?? null;
  const hasLiveStock = stockRow?.ultimo !== null && stockRow?.ultimo !== undefined && stockRow?.ultimo !== 0;

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-muted/50 border-b border-border">
        <div className="flex items-center gap-3 flex-wrap">
          <button
            onClick={() => onToggleExpand(family.id)}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            {family.expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-orange-600 dark:text-orange-300 text-base">{family.name}</span>
            {hasLiveStock ? (
              <span className="text-xs">
                <span className="text-muted-foreground">BID</span>{" "}
                <span className="text-emerald-600 dark:text-emerald-400 font-semibold">{formatBRL(stockBid)}</span>
                <span className="text-muted-foreground mx-1">|</span>
                <span className="text-muted-foreground">ASK</span>{" "}
                <span className="text-emerald-600 dark:text-emerald-400 font-semibold">{formatBRL(stockAsk)}</span>
                <span className="ml-1 inline-block w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
              </span>
            ) : (
              <span className="text-xs text-muted-foreground">Aguardando dados...</span>
            )}
            <span className="text-xs text-muted-foreground">{family.tickers.length} tickers</span>
          </div>
          {bestPair && (
            <span className="hidden md:flex items-center gap-1 text-xs bg-orange-100 dark:bg-orange-950/50 border border-orange-400/50 text-orange-600 dark:text-orange-400 px-2 py-0.5 rounded-full">
              <Star className="w-3 h-3 text-amber-500" />
              Melhor: Strike {formatBRL(bestPair.strike)} · {formatPercent(bestPair.lucroPercent)}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <input
            ref={fileRef}
            type="file"
            accept=".csv,.txt"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) onFileUpload(family.id, file);
              e.target.value = "";
            }}
          />
          <button
            onClick={() => fileRef.current?.click()}
            title="Upload CSV/TXT"
            className="flex items-center gap-1 px-2 py-1 text-xs bg-secondary hover:bg-secondary/80 rounded transition-colors text-secondary-foreground"
          >
            <Upload className="w-3 h-3" /> Upload
          </button>
          <button
            onClick={handlePasteFromClipboard}
            title="Colar tickers"
            className="flex items-center gap-1 px-2 py-1 text-xs bg-orange-500/80 hover:bg-orange-500 text-white rounded transition-colors"
          >
            <ClipboardPaste className="w-3 h-3" /> Colar
          </button>
          <button
            onClick={() => onRemoveFamily(family.id)}
            className="text-muted-foreground hover:text-destructive transition-colors ml-1"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Paste area fallback */}
      {showPaste && (
        <div className="px-4 py-3 border-b border-border bg-muted/30">
          <p className="text-xs text-muted-foreground mb-2">
            Cole os tickers (Ctrl+V) — separados por vírgula, espaço ou enter:
          </p>
          <div className="flex gap-2">
            <textarea
              ref={pasteRef}
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              onPaste={handleTextAreaPaste}
              placeholder="BBDCD194, BBDCP194, BBDCD209, BBDCP209..."
              rows={3}
              className="flex-1 bg-card border border-border rounded px-3 py-2 text-xs font-mono focus:outline-none focus:border-primary resize-none"
            />
            <div className="flex flex-col gap-2">
              <button
                onClick={handlePasteSubmit}
                className="px-3 py-1 bg-orange-500 hover:bg-orange-400 text-white rounded text-xs font-bold transition-colors"
              >
                Adicionar
              </button>
              <button
                onClick={() => { setPasteText(""); setShowPaste(false); }}
                className="px-3 py-1 bg-secondary hover:bg-secondary/80 rounded text-xs transition-colors text-secondary-foreground"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Manual ticker input */}
      {family.expanded && (
        <div className="px-4 py-2 border-b border-border bg-muted/20">
          <div className="flex gap-2">
            <input
              type="text"
              value={manualTicker}
              onChange={(e) => setManualTicker(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleManualAdd()}
              onPaste={(e) => {
                const text = e.clipboardData.getData("text");
                if (text.includes(",") || text.includes("\n") || text.includes("\t") || text.includes(" ")) {
                  e.preventDefault();
                  onAddTickers(family.id, text);
                }
              }}
              placeholder="Adicionar ticker (ex: BBDCD194) ou colar vários (Ctrl+V)"
              className="flex-1 bg-card border border-border rounded px-3 py-1.5 text-xs focus:outline-none focus:border-primary transition-colors placeholder-muted-foreground"
            />
            <button
              onClick={handleManualAdd}
              className="px-3 py-1.5 bg-secondary hover:bg-secondary/80 rounded text-xs transition-colors text-secondary-foreground"
            >
              <Plus className="w-3 h-3" />
            </button>
          </div>
        </div>
      )}

      {/* Box Pairs Table */}
      {family.expanded && (
        <div className="overflow-x-auto">
          {family.tickers.length === 0 ? (
            <div className="px-6 py-8 text-center text-muted-foreground text-sm">
              <p>Nenhum ticker adicionado.</p>
              <p className="text-xs mt-1">
                Use o campo acima, "Colar" ou "Upload" para importar tickers de opções.
              </p>
              <p className="text-xs mt-1 text-muted-foreground/70">
                Dica: adicione pares CALL+PUT com mesmo strike (ex: BBDCD194 + BBDCP194)
              </p>
            </div>
          ) : (
            <table className="w-full text-xs">
              <thead>
                {/* Group headers */}
                <tr className="border-b border-border">
                  <th className="px-3 py-1" />
                  <th colSpan={2} className="px-2 py-2 text-center text-[10px] uppercase tracking-widest font-black bg-gray-200 dark:bg-zinc-600/80 text-gray-700 dark:text-zinc-100 border-x border-gray-300 dark:border-zinc-500/60">
                    ATIVO
                  </th>
                  <th colSpan={3} className="px-2 py-2 text-center text-[10px] uppercase tracking-widest font-black bg-blue-100 dark:bg-blue-700/50 text-blue-700 dark:text-blue-200 border-x border-blue-300 dark:border-blue-500/40">
                    📘 CALL
                  </th>
                  <th colSpan={3} className="px-2 py-2 text-center text-[10px] uppercase tracking-widest font-black bg-red-100 dark:bg-red-700/50 text-red-700 dark:text-red-200 border-x border-red-300 dark:border-red-500/40">
                    📕 PUT
                  </th>
                  <th colSpan={6} className="px-2 py-2 text-center text-[10px] uppercase tracking-widest font-black bg-orange-100 dark:bg-orange-700/50 text-orange-700 dark:text-orange-200 border-x border-orange-300 dark:border-orange-500/40">
                    💰 BOX SPREAD
                  </th>
                  <th colSpan={2} className="px-2 py-2 text-center text-[10px] uppercase tracking-widest font-black bg-amber-100 dark:bg-amber-700/50 text-amber-700 dark:text-amber-200 border-x border-amber-300 dark:border-amber-500/40">
                    📊 CDI
                  </th>
                  <th className="px-2 py-1" />
                </tr>
                {/* Column headers */}
                <tr className="text-muted-foreground border-b border-border bg-muted/40">
                  <th className="text-left px-3 py-2 font-bold">ATIVO</th>
                  <th className="text-right px-2 py-2">BID</th>
                  <th className="text-right px-2 py-2">ASK</th>
                  <th className="text-left px-2 py-2 text-blue-600 dark:text-blue-300">Ticker</th>
                  <th className="text-right px-2 py-2 text-blue-600 dark:text-blue-300">BID</th>
                  <th className="text-right px-2 py-2 text-blue-600 dark:text-blue-300">ASK</th>
                  <th className="text-left px-2 py-2 text-red-600 dark:text-red-300">Ticker</th>
                  <th className="text-right px-2 py-2 text-red-600 dark:text-red-300">BID</th>
                  <th className="text-right px-2 py-2 text-red-600 dark:text-red-300">ASK</th>
                  <th className="text-right px-2 py-2 text-orange-600 dark:text-orange-300">Strike</th>
                  <th className="text-center px-2 py-2 text-orange-600 dark:text-orange-300">Venc.</th>
                  <th className="text-right px-2 py-2 text-orange-600 dark:text-orange-400 font-bold">Custo</th>
                  <th className="text-right px-2 py-2 text-emerald-600 dark:text-emerald-400">Lucro (1)</th>
                  <th className="text-right px-2 py-2 text-emerald-600 dark:text-emerald-300 font-bold">Total ({quantidade}x)</th>
                  <th className="text-right px-2 py-2 text-emerald-600 dark:text-emerald-200 font-bold">Lucro %</th>
                  <th className="text-right px-2 py-2 text-amber-600 dark:text-amber-400 font-bold">CDI Anual</th>
                  <th className="text-right px-2 py-2 text-amber-600 dark:text-amber-400">CDI Per.</th>
                  <th className="text-center px-2 py-2 text-amber-600 dark:text-amber-300">vs CDI</th>
                  <th className="px-2 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {boxPairs.map((pair, idx) => {
                  const pairKey = `${family.name}-${pair.strike}`;
                  const isGlobalWinner = pairKey === winnerKey;
                  const isBest = idx === 0 && pair.lucroPercent !== null && pair.lucroPercent > 0;
                  const displayStrike = pair.strikeRtd ?? pair.strike;
                  const lucroDisplay = descontarIRAcoes ? pair.lucroLiqAcoes : pair.lucro;
                  const lucroTotalDisplay = descontarIRAcoes ? pair.lucroLiqAcoesTotal : pair.lucroTotal;
                  const lucroPercentDisplay = descontarIRAcoes ? pair.lucroLiqAcoesPercent : pair.lucroPercent;
                  const cdiDisplay = descontarIRRendaFixa ? pair.cdiPeriodoLiq : pair.cdiPeriodo;

                  return (
                    <tr
                      key={`pair-${pair.strike}-${idx}`}
                      className={cn(
                        "border-b border-border/50 hover:bg-muted/30 transition-colors",
                        isGlobalWinner
                          ? "bg-gradient-to-r from-emerald-50/80 to-teal-50/50 dark:from-emerald-950/30 dark:to-teal-950/10 border-l-4 border-l-emerald-500"
                          : isBest ? "bg-primary/5" : ""
                      )}
                    >
                      <td className="px-3 py-2 font-bold text-foreground flex items-center gap-1">
                        {isGlobalWinner && <Trophy className="w-3 h-3 text-emerald-500 flex-shrink-0" />}
                        {isBest && !isGlobalWinner && <Star className="w-3 h-3 text-amber-500 flex-shrink-0" />}
                        {family.name}
                      </td>
                      <td className="px-2 py-2 text-right text-foreground/80">{formatBRL(pair.stockBid)}</td>
                      <td className="px-2 py-2 text-right text-foreground/80">{formatBRL(pair.stockAsk)}</td>
                      {/* CALL */}
                      <td className="px-2 py-2 bg-blue-50/50 dark:bg-blue-950/10">
                        {pair.callSymbol ? (
                          <span className="text-blue-600 dark:text-blue-300 font-semibold">{pair.callSymbol}</span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-2 py-2 text-right text-blue-600 dark:text-blue-300 bg-blue-50/50 dark:bg-blue-950/10">{formatBRL(pair.callBid)}</td>
                      <td className="px-2 py-2 text-right text-blue-700 dark:text-blue-200 bg-blue-50/50 dark:bg-blue-950/10">{formatBRL(pair.callAsk)}</td>
                      {/* PUT */}
                      <td className="px-2 py-2 bg-red-50/50 dark:bg-red-950/10">
                        {pair.putSymbol ? (
                          <span className="text-red-600 dark:text-red-300 font-semibold">{pair.putSymbol}</span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-2 py-2 text-right text-red-600 dark:text-red-300 bg-red-50/50 dark:bg-red-950/10">{formatBRL(pair.putBid)}</td>
                      <td className="px-2 py-2 text-right text-red-700 dark:text-red-200 bg-red-50/50 dark:bg-red-950/10">{formatBRL(pair.putAsk)}</td>
                      {/* Box Spread */}
                      <td className="px-2 py-2 text-right font-semibold text-orange-600 dark:text-orange-300">{formatBRL(displayStrike)}</td>
                      <td className="px-2 py-2 text-center text-muted-foreground text-[10px]">
                        {pair.vencimento ?? "—"}
                        {pair.diasUteis !== null && (
                          <span className="block text-amber-600 dark:text-amber-500/70 font-bold">{pair.diasUteis}du</span>
                        )}
                      </td>
                      <td className="px-2 py-2 text-right font-bold text-orange-600 dark:text-orange-400">{formatBRL(pair.compraBox)}</td>
                      <td className="px-2 py-2 text-right font-bold">
                        {lucroDisplay !== null ? (
                          <span className={lucroDisplay >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-500"}>
                            {formatBRL(lucroDisplay)}
                          </span>
                        ) : "—"}
                      </td>
                      <td className="px-2 py-2 text-right font-bold">
                        {lucroTotalDisplay !== null ? (
                          <span className={lucroTotalDisplay >= 0 ? "text-emerald-600 dark:text-emerald-300" : "text-red-500"}>
                            {formatBRL(lucroTotalDisplay)}
                          </span>
                        ) : "—"}
                      </td>
                      <td className="px-2 py-2 text-right font-black">
                        {lucroPercentDisplay !== null ? (
                          <span className={lucroPercentDisplay >= 0 ? "text-emerald-600 dark:text-emerald-300" : "text-red-500"}>
                            {formatPercent(lucroPercentDisplay)}
                          </span>
                        ) : "—"}
                      </td>
                      {/* CDI */}
                      <td className="px-2 py-2 text-right text-amber-600 dark:text-amber-400 font-bold">
                        {String(cdiAnual).replace(".", ",")}%
                      </td>
                      <td className="px-2 py-2 text-right text-amber-600 dark:text-amber-400">
                        {cdiDisplay !== null ? formatPercent(cdiDisplay) : "—"}
                      </td>
                      <td className="px-2 py-2 text-center">
                        {pair.vsCD === "acima" ? (
                          <span className="inline-flex items-center gap-0.5 text-emerald-600 dark:text-emerald-400 font-bold text-[10px] bg-emerald-100 dark:bg-emerald-950/40 px-1.5 py-0.5 rounded">
                            <TrendingUp className="w-3 h-3" /> ACIMA
                          </span>
                        ) : pair.vsCD === "abaixo" ? (
                          <span className="inline-flex items-center gap-0.5 text-red-500 font-bold text-[10px] bg-red-100 dark:bg-red-950/40 px-1.5 py-0.5 rounded">
                            ABAIXO
                          </span>
                        ) : "—"}
                      </td>
                      <td className="px-2 py-2">
                        <div className="flex gap-1">
                          {pair.callSymbol && (
                            <button
                              onClick={() => {
                                const t = family.tickers.find((t) => t.symbol === pair.callSymbol);
                                if (t) onRemoveTicker(family.id, t.id);
                              }}
                              className="text-muted-foreground hover:text-destructive transition-colors"
                              title={`Remover ${pair.callSymbol}`}
                            >
                              <X className="w-3 h-3" />
                            </button>
                          )}
                          {pair.putSymbol && (
                            <button
                              onClick={() => {
                                const t = family.tickers.find((t) => t.symbol === pair.putSymbol);
                                if (t) onRemoveTicker(family.id, t.id);
                              }}
                              className="text-muted-foreground hover:text-destructive transition-colors"
                              title={`Remover ${pair.putSymbol}`}
                            >
                              <X className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {/* Unpaired tickers */}
                {family.tickers
                  .filter((t) => !boxPairs.some((p) => p.callSymbol === t.symbol || p.putSymbol === t.symbol))
                  .map((ticker) => {
                    const liveRow = rows.get(ticker.symbol);
                    return (
                      <tr
                        key={ticker.id}
                        className="border-b border-border/30 hover:bg-muted/20 opacity-50"
                      >
                        <td className="px-3 py-2 text-muted-foreground">{family.name}</td>
                        <td className="px-2 py-2" colSpan={2}>
                          <span className={`px-1.5 py-0.5 rounded text-xs font-bold ${
                            ticker.type === "CALL" ? "bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-300" : "bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-300"
                          }`}>
                            {ticker.type}: {ticker.symbol}
                          </span>
                          <span className="text-muted-foreground text-xs ml-2">
                            (sem par {ticker.type === "CALL" ? "PUT" : "CALL"} no strike {formatBRL(ticker.strike)})
                          </span>
                        </td>
                        <td className="px-2 py-2 text-right text-muted-foreground" colSpan={3}>
                          {liveRow ? `${formatBRL(liveRow.ofCompra)} / ${formatBRL(liveRow.ofVenda)}` : "—"}
                        </td>
                        <td className="px-2 py-2 text-muted-foreground text-center" colSpan={9}>
                          Aguardando par...
                        </td>
                        <td className="px-2 py-2" colSpan={3} />
                        <td className="px-2 py-2">
                          <button
                            onClick={() => onRemoveTicker(family.id, ticker.id)}
                            className="text-muted-foreground hover:text-destructive transition-colors"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
