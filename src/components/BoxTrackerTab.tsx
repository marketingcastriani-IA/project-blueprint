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
  diasUteis: number | null;
  cdiPeriodo: number | null;
  vsCD: string | null;
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
const CDI_ANUAL = 14.15;

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

function calcCdiPeriodo(diasUteis: number): number {
  return ((1 + CDI_ANUAL / 100) ** (diasUteis / 252) - 1) * 100;
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
        // Using ASK for buys (stock, put) and BID for sells (call)
        let compraBox: number | null = null;
        let lucro: number | null = null;
        let lucroTotal: number | null = null;
        let lucroPercent: number | null = null;

        if (stockAsk !== null && callBid !== null && putAsk !== null) {
          compraBox = (stockAsk + putAsk) - callBid;
          lucro = strike - compraBox;
          lucroTotal = lucro * qty;
          lucroPercent = compraBox > 0 ? (lucro / compraBox) * 100 : null;
        }

        const vencParaCalculo = vencimentoManual || vencimento;
        const diasUteis = calcDiasUteis(vencParaCalculo);
        const cdiPeriodo = diasUteis !== null && diasUteis > 0 ? calcCdiPeriodo(diasUteis) : null;
        const vsCD = lucroPercent !== null && cdiPeriodo !== null
          ? (lucroPercent > cdiPeriodo ? "acima" : "abaixo")
          : null;

        pairs.push({
          strike, strikeRtd, vencimento: vencParaCalculo,
          callSymbol: call?.symbol ?? null, putSymbol: put?.symbol ?? null,
          callBid, callAsk, putBid, putAsk, stockBid, stockAsk,
          compraBox, lucro, lucroTotal, lucroPercent,
          diasUteis, cdiPeriodo, vsCD,
        });
      });

      pairs.sort((a, b) => (b.lucroPercent ?? -999) - (a.lucroPercent ?? -999));
      return pairs;
    },
    [rows, quantidade, vencimentoManual]
  );

  // Global ranking
  const allPairs: (BoxPair & { familyName: string })[] = [];
  families.forEach((f) => {
    const pairs = calculateBoxPairs(f);
    pairs.forEach((p) => {
      if (p.lucroPercent !== null && p.lucroPercent > 0) {
        allPairs.push({ ...p, familyName: f.name });
      }
    });
  });
  allPairs.sort((a, b) => (b.lucroPercent ?? 0) - (a.lucroPercent ?? 0));
  const topPairs = allPairs.slice(0, 10);

  const isConnected = status === "connected";
  const statusCfg = statusConfig[status];

  const diasUteisVenc = calcDiasUteis(vencimentoManual);

  // ─── RENDER ───────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#0a0e1a] text-white font-mono p-4 md:p-6">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-orange-400 flex items-center gap-2">
            <BarChart2 className="w-6 h-6" />
            Rastreador de Box
          </h1>
          <p className="text-xs text-zinc-500 mt-1">
            Custo = (Ação + Put) - Call · Lucro = Strike - Custo
          </p>
        </div>

        <div className="flex items-center gap-3">
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
              <span className="text-emerald-500">· {rows.size} tickers</span>
            )}
          </div>

          {!isConnected && status !== "connecting" && (
            <button
              onClick={connect}
              className="flex items-center gap-2 px-4 py-2 bg-orange-600 hover:bg-orange-500 rounded-lg text-sm font-bold transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Conectar Bridge
            </button>
          )}
        </div>
      </div>

      {/* Bridge not connected warning */}
      {!isConnected && status !== "connecting" && (
        <div className="mb-6 bg-yellow-900/20 border border-yellow-700/40 rounded-xl p-4 text-sm">
          <div className="flex items-center gap-2 text-yellow-400 font-bold mb-1">
            <AlertTriangle className="w-4 h-4" />
            Bridge RTD não conectado
          </div>
          <p className="text-zinc-400 text-xs">
            Inicie o <strong>ProfitRTDBridge.exe</strong> para receber dados em tempo real do Profit Pro.
          </p>
        </div>
      )}

      {/* VENCIMENTO CARD - Calendar picker with save/edit/delete */}
      <div className="mb-6">
        <div className={cn(
          "rounded-xl border p-4 transition-all",
          vencSaved
            ? "bg-gradient-to-r from-orange-950/40 to-amber-950/30 border-orange-600/50"
            : "bg-gradient-to-r from-zinc-900/80 to-zinc-800/50 border-amber-600/40 shadow-[0_0_15px_rgba(245,158,11,0.15)]"
        )}>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-black text-orange-400 flex items-center gap-2 uppercase tracking-wider">
              <CalendarIcon className="w-4 h-4" />
              📅 Data de Vencimento
            </h3>
            {vencSaved && (
              <div className="flex gap-2">
                <button
                  onClick={handleEditVenc}
                  className="flex items-center gap-1 px-3 py-1 text-xs bg-amber-700/40 hover:bg-amber-600/50 border border-amber-600/40 rounded-lg text-amber-300 font-bold transition-colors"
                >
                  <Pencil className="w-3 h-3" /> Editar
                </button>
                <button
                  onClick={handleDeleteVenc}
                  className="flex items-center gap-1 px-3 py-1 text-xs bg-red-900/40 hover:bg-red-800/50 border border-red-700/40 rounded-lg text-red-400 font-bold transition-colors"
                >
                  <Trash2 className="w-3 h-3" /> Excluir
                </button>
              </div>
            )}
          </div>

          {vencSaved && !editingVenc ? (
            /* Saved state - show card */
            <div className="flex items-center gap-6">
              <div>
                <p className="text-3xl font-black text-orange-300">{vencimentoManual}</p>
                {diasUteisVenc !== null && (
                  <p className="text-sm text-zinc-400 mt-1">
                    <span className="text-amber-400 font-bold">{diasUteisVenc}</span> dias úteis restantes
                    {diasUteisVenc > 0 && (
                      <span className="ml-2 text-zinc-500">
                        · CDI do período: <span className="text-amber-300 font-bold">{formatPercent(calcCdiPeriodo(diasUteisVenc))}</span>
                      </span>
                    )}
                  </p>
                )}
              </div>
            </div>
          ) : (
            /* Editing/Creating state */
            <div className="flex flex-wrap items-end gap-4">
              <div className="flex flex-col gap-1">
                <label className="text-[10px] text-zinc-400 uppercase tracking-wider">Selecione a data</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <button
                      className={cn(
                        "flex items-center gap-2 px-4 py-2.5 rounded-lg border text-sm font-bold transition-all w-[220px] justify-start",
                        vencimentoManual
                          ? "bg-zinc-900 border-orange-500/60 text-orange-300"
                          : "bg-zinc-900 border-amber-600/40 text-zinc-500 animate-pulse"
                      )}
                    >
                      <CalendarIcon className="w-4 h-4" />
                      {vencimentoManual || "⚠️ Selecionar data"}
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 bg-zinc-900 border-zinc-700" align="start">
                    <Calendar
                      mode="single"
                      selected={strToDate(vencimentoManual)}
                      onSelect={(date) => {
                        if (date) setVencimentoManual(dateToStr(date));
                      }}
                      initialFocus
                      className={cn("p-3 pointer-events-auto")}
                    />
                  </PopoverContent>
                </Popover>
              </div>

              {vencimentoManual && (
                <>
                  {diasUteisVenc !== null && (
                    <div className="text-sm text-zinc-400">
                      <span className="text-amber-400 font-bold">{diasUteisVenc}</span> dias úteis
                      {diasUteisVenc > 0 && (
                        <span className="ml-2">
                          · CDI: <span className="text-amber-300 font-bold">{formatPercent(calcCdiPeriodo(diasUteisVenc))}</span>
                        </span>
                      )}
                    </div>
                  )}
                  <button
                    onClick={handleSaveVenc}
                    className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 rounded-lg text-sm font-black transition-all shadow-lg shadow-orange-900/30"
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

      {/* WINNER CARDS - Top 3 */}
      {topPairs.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          {topPairs.slice(0, 3).map((pair, i) => (
            <div
              key={`top-${i}`}
              className={`relative overflow-hidden rounded-xl border p-4 ${
                i === 0
                  ? "bg-gradient-to-br from-orange-900/40 to-amber-950/30 border-orange-500/60"
                  : i === 1
                  ? "bg-gradient-to-br from-zinc-700/30 to-zinc-800/20 border-zinc-500/50"
                  : "bg-gradient-to-br from-amber-900/20 to-amber-950/10 border-amber-700/40"
              }`}
            >
              <div className="flex items-center gap-2 mb-2">
                <Trophy
                  className={`w-5 h-5 ${
                    i === 0 ? "text-orange-400" : i === 1 ? "text-zinc-300" : "text-amber-500"
                  }`}
                />
                <span className="text-xs text-zinc-400 uppercase tracking-wider">
                  {i === 0 ? "🥇 Melhor Box" : i === 1 ? "🥈 2º Melhor" : "🥉 3º Melhor"}
                </span>
              </div>

              <div className="flex items-baseline gap-2 mb-1">
                <span className="text-lg font-black text-white">{pair.familyName}</span>
                <span className="text-xs text-zinc-400">Strike {formatBRL(pair.strikeRtd ?? pair.strike)}</span>
                {pair.vencimento && (
                  <span className="text-xs text-amber-400/70 ml-1">· {pair.vencimento}</span>
                )}
              </div>

              <div className="flex items-center gap-3 text-sm">
                <span className="text-zinc-400">
                  Call: <span className="text-blue-300 font-bold">{pair.callSymbol ?? "—"}</span>
                </span>
                <span className="text-zinc-400">
                  Put: <span className="text-red-300 font-bold">{pair.putSymbol ?? "—"}</span>
                </span>
              </div>

              <div className="mt-3 grid grid-cols-5 gap-2">
                <div>
                  <p className="text-[9px] text-zinc-500 uppercase">Custo</p>
                  <p className="text-sm font-bold text-orange-400">{formatBRL(pair.compraBox)}</p>
                </div>
                <div>
                  <p className="text-[9px] text-zinc-500 uppercase">Lucro (1)</p>
                  <p className="text-sm font-bold text-emerald-400">{formatBRL(pair.lucro)}</p>
                </div>
                <div>
                  <p className="text-[9px] text-zinc-500 uppercase">Total ({quantidade}x)</p>
                  <p className="text-sm font-bold text-emerald-300">{formatBRL(pair.lucroTotal)}</p>
                </div>
                <div>
                  <p className="text-[9px] text-zinc-500 uppercase">CDI Per.</p>
                  <p className="text-sm font-bold text-amber-400">{pair.cdiPeriodo !== null ? formatPercent(pair.cdiPeriodo) : "—"}</p>
                </div>
                <div className="text-right">
                  <p className="text-[9px] text-zinc-500 uppercase">Retorno</p>
                  <p className="text-xl font-black text-emerald-300">
                    {formatPercent(pair.lucroPercent)}
                  </p>
                  {pair.vsCD === "acima" && (
                    <span className="text-[9px] text-emerald-500 font-bold">▲ ACIMA CDI</span>
                  )}
                  {pair.vsCD === "abaixo" && (
                    <span className="text-[9px] text-red-400 font-bold">▼ ABAIXO CDI</span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* TOP 10 TABLE */}
      {topPairs.length > 3 && (
        <div className="mb-6 bg-zinc-900/60 border border-orange-900/40 rounded-xl p-4">
          <h2 className="text-sm font-bold text-orange-400 mb-3 flex items-center gap-2">
            <Star className="w-4 h-4 text-yellow-400" />
            Top 10 · Melhores Box Spreads
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-zinc-500 border-b border-zinc-800">
                  <th className="text-left py-2 pr-3">#</th>
                  <th className="text-left py-2 pr-3">Ativo</th>
                  <th className="text-left py-2 pr-3 text-blue-400">CALL</th>
                  <th className="text-left py-2 pr-3 text-red-400">PUT</th>
                  <th className="text-right py-2 pr-3">Strike</th>
                  <th className="text-center py-2 pr-3">Venc.</th>
                  <th className="text-right py-2 pr-3 text-orange-400">Custo</th>
                  <th className="text-right py-2 pr-3">Lucro (1)</th>
                  <th className="text-right py-2 pr-3">Total ({quantidade}x)</th>
                  <th className="text-right py-2 pr-3">Lucro %</th>
                  <th className="text-right py-2 pr-3 text-amber-400">CDI Per.</th>
                  <th className="text-center py-2">vs CDI</th>
                </tr>
              </thead>
              <tbody>
                {topPairs.slice(3).map((p, i) => (
                  <tr key={`rank-${i + 3}`} className="border-b border-zinc-800/50 hover:bg-zinc-800/30">
                    <td className="py-2 pr-3 text-zinc-500">{i + 4}º</td>
                    <td className="py-2 pr-3 font-bold text-white">{p.familyName}</td>
                    <td className="py-2 pr-3 text-blue-300">{p.callSymbol}</td>
                    <td className="py-2 pr-3 text-red-300">{p.putSymbol}</td>
                    <td className="py-2 pr-3 text-right">{formatBRL(p.strikeRtd ?? p.strike)}</td>
                    <td className="py-2 pr-3 text-center text-zinc-400 text-[10px]">{p.vencimento ?? "—"}</td>
                    <td className="py-2 pr-3 text-right text-orange-400">{formatBRL(p.compraBox)}</td>
                    <td className="py-2 pr-3 text-right text-emerald-400">{formatBRL(p.lucro)}</td>
                    <td className="py-2 pr-3 text-right text-emerald-300 font-semibold">{formatBRL(p.lucroTotal)}</td>
                    <td className="py-2 pr-3 text-right font-bold text-emerald-300">{formatPercent(p.lucroPercent)}</td>
                    <td className="py-2 pr-3 text-right text-amber-400">{p.cdiPeriodo !== null ? formatPercent(p.cdiPeriodo) : "—"}</td>
                    <td className="py-2 text-center">
                      {p.vsCD === "acima" ? (
                        <span className="text-emerald-400 font-bold text-[10px]">▲ ACIMA</span>
                      ) : p.vsCD === "abaixo" ? (
                        <span className="text-red-400 font-bold text-[10px]">▼ ABAIXO</span>
                      ) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* CONTROLES: Quantidade e Adicionar Família */}
      <div className="flex flex-wrap gap-3 mb-6 items-end">
        <div className="flex flex-col gap-1">
          <label className="text-[10px] text-orange-400/70 uppercase tracking-wider font-bold">Quantidade</label>
          <input
            type="number"
            value={quantidade}
            onChange={(e) => setQuantidade(Math.max(1, parseInt(e.target.value) || 1))}
            min={1}
            className="w-24 bg-zinc-900 border border-orange-700/40 rounded-lg px-3 py-2 text-sm text-center font-bold text-orange-300 focus:outline-none focus:border-orange-500 transition-colors"
          />
        </div>
        <div className="flex gap-2 flex-1">
          <input
            type="text"
            value={newFamilyName}
            onChange={(e) => setNewFamilyName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addFamily()}
            placeholder="Ticker do ativo (ex: PETR4, BBDC4, LREN3...)"
            className="flex-1 bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-orange-500 transition-colors placeholder-zinc-600"
          />
          <button
            onClick={addFamily}
            className="flex items-center gap-2 px-4 py-2 bg-orange-600 hover:bg-orange-500 rounded-lg text-sm font-bold transition-colors"
          >
            <Plus className="w-4 h-4" />
            Adicionar
          </button>
        </div>
      </div>

      {/* FAMILIES */}
      {families.length === 0 ? (
        <div className="text-center py-20 text-zinc-600">
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
    <div className="bg-zinc-900/70 border border-zinc-700/50 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-zinc-800/80 to-zinc-800/50 border-b border-orange-900/30">
        <div className="flex items-center gap-3">
          <button
            onClick={() => onToggleExpand(family.id)}
            className="text-zinc-400 hover:text-white transition-colors"
          >
            {family.expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
          <div>
            <span className="font-bold text-orange-300 text-base">{family.name}</span>
            {hasLiveStock ? (
              <span className="text-xs ml-2">
                <span className="text-zinc-400">BID</span>{" "}
                <span className="text-emerald-400 font-semibold">{formatBRL(stockBid)}</span>
                <span className="text-zinc-600 mx-1">|</span>
                <span className="text-zinc-400">ASK</span>{" "}
                <span className="text-emerald-400 font-semibold">{formatBRL(stockAsk)}</span>
                <span className="ml-1 inline-block w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
              </span>
            ) : (
              <span className="text-xs text-zinc-500 ml-2">Aguardando dados...</span>
            )}
          </div>
          <span className="text-xs text-zinc-500">{family.tickers.length} tickers</span>
          {bestPair && (
            <span className="hidden md:flex items-center gap-1 text-xs bg-orange-950/50 border border-orange-800/50 text-orange-400 px-2 py-0.5 rounded-full">
              <Star className="w-3 h-3 text-yellow-400" />
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
            className="flex items-center gap-1 px-2 py-1 text-xs bg-zinc-700 hover:bg-zinc-600 rounded transition-colors"
          >
            <Upload className="w-3 h-3" /> Upload
          </button>
          <button
            onClick={handlePasteFromClipboard}
            title="Colar tickers"
            className="flex items-center gap-1 px-2 py-1 text-xs bg-orange-700/60 hover:bg-orange-600/70 rounded transition-colors"
          >
            <ClipboardPaste className="w-3 h-3" /> Colar
          </button>
          <button
            onClick={() => onRemoveFamily(family.id)}
            className="text-zinc-600 hover:text-red-400 transition-colors ml-1"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Paste area fallback */}
      {showPaste && (
        <div className="px-4 py-3 border-b border-zinc-700/50 bg-zinc-950/50">
          <p className="text-xs text-zinc-500 mb-2">
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
              className="flex-1 bg-zinc-900 border border-zinc-700 rounded px-3 py-2 text-xs font-mono focus:outline-none focus:border-orange-500 resize-none"
            />
            <div className="flex flex-col gap-2">
              <button
                onClick={handlePasteSubmit}
                className="px-3 py-1 bg-orange-600 hover:bg-orange-500 rounded text-xs font-bold transition-colors"
              >
                Adicionar
              </button>
              <button
                onClick={() => { setPasteText(""); setShowPaste(false); }}
                className="px-3 py-1 bg-zinc-700 hover:bg-zinc-600 rounded text-xs transition-colors"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Manual ticker input */}
      {family.expanded && (
        <div className="px-4 py-2 border-b border-zinc-800/50 bg-zinc-900/30">
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
              className="flex-1 bg-zinc-900 border border-zinc-700 rounded px-3 py-1.5 text-xs focus:outline-none focus:border-orange-500 transition-colors placeholder-zinc-600"
            />
            <button
              onClick={handleManualAdd}
              className="px-3 py-1.5 bg-zinc-700 hover:bg-zinc-600 rounded text-xs transition-colors"
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
            <div className="px-6 py-8 text-center text-zinc-600 text-sm">
              <p>Nenhum ticker adicionado.</p>
              <p className="text-xs mt-1">
                Use o campo acima, "Colar" ou "Upload" para importar tickers de opções.
              </p>
              <p className="text-xs mt-1 text-zinc-500">
                Dica: adicione pares CALL+PUT com mesmo strike (ex: BBDCD194 + BBDCP194)
              </p>
            </div>
          ) : (
            <table className="w-full text-xs">
              <thead>
                {/* Group headers with vibrant orange tones */}
                <tr className="border-b border-zinc-700">
                  <th className="px-4 py-1" />
                  <th colSpan={2} className="px-2 py-2 text-center text-[10px] uppercase tracking-widest font-black bg-zinc-600/80 text-zinc-100 border-x border-zinc-500/60">
                    ATIVO
                  </th>
                  <th colSpan={3} className="px-2 py-2 text-center text-[10px] uppercase tracking-widest font-black bg-blue-700/50 text-blue-200 border-x border-blue-500/40">
                    📘 CALL
                  </th>
                  <th colSpan={3} className="px-2 py-2 text-center text-[10px] uppercase tracking-widest font-black bg-red-700/50 text-red-200 border-x border-red-500/40">
                    📕 PUT
                  </th>
                  <th colSpan={6} className="px-2 py-2 text-center text-[10px] uppercase tracking-widest font-black bg-orange-700/50 text-orange-200 border-x border-orange-500/40">
                    💰 BOX SPREAD
                  </th>
                  <th colSpan={2} className="px-2 py-2 text-center text-[10px] uppercase tracking-widest font-black bg-amber-700/50 text-amber-200 border-x border-amber-500/40">
                    📊 CDI
                  </th>
                  <th className="px-2 py-1" />
                </tr>
                {/* Column headers */}
                <tr className="text-zinc-400 border-b border-zinc-800 bg-zinc-800/60">
                  <th className="text-left px-4 py-2 font-bold">ATIVO</th>
                  <th className="text-right px-2 py-2">BID</th>
                  <th className="text-right px-2 py-2">ASK</th>
                  <th className="text-left px-2 py-2 text-blue-300">Ticker</th>
                  <th className="text-right px-2 py-2 text-blue-300">BID</th>
                  <th className="text-right px-2 py-2 text-blue-300">ASK</th>
                  <th className="text-left px-2 py-2 text-red-300">Ticker</th>
                  <th className="text-right px-2 py-2 text-red-300">BID</th>
                  <th className="text-right px-2 py-2 text-red-300">ASK</th>
                  <th className="text-right px-2 py-2 text-orange-300">Strike</th>
                  <th className="text-center px-2 py-2 text-orange-300">Venc.</th>
                  <th className="text-right px-2 py-2 text-orange-400 font-bold">Custo</th>
                  <th className="text-right px-2 py-2 text-emerald-400">Lucro (1)</th>
                  <th className="text-right px-2 py-2 text-emerald-300 font-bold">Total ({quantidade}x)</th>
                  <th className="text-right px-2 py-2 text-emerald-200 font-bold">Lucro %</th>
                  <th className="text-right px-2 py-2 text-amber-400">CDI Per.</th>
                  <th className="text-center px-2 py-2 text-amber-300">vs CDI</th>
                  <th className="px-2 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {boxPairs.map((pair, idx) => {
                  const isBest = idx === 0 && pair.lucroPercent !== null && pair.lucroPercent > 0;
                  const displayStrike = pair.strikeRtd ?? pair.strike;

                  return (
                    <tr
                      key={`pair-${pair.strike}-${idx}`}
                      className={`border-b border-zinc-800/30 hover:bg-zinc-800/20 transition-colors ${
                        isBest ? "bg-orange-950/15" : ""
                      }`}
                    >
                      <td className="px-4 py-2 font-bold text-white flex items-center gap-1">
                        {isBest && <Star className="w-3 h-3 text-orange-400 flex-shrink-0" />}
                        {family.name}
                      </td>
                      <td className="px-2 py-2 text-right text-zinc-300">{formatBRL(pair.stockBid)}</td>
                      <td className="px-2 py-2 text-right text-zinc-300">{formatBRL(pair.stockAsk)}</td>
                      {/* CALL */}
                      <td className="px-2 py-2 bg-blue-950/10">
                        {pair.callSymbol ? (
                          <span className="text-blue-300 font-semibold">{pair.callSymbol}</span>
                        ) : (
                          <span className="text-zinc-600">—</span>
                        )}
                      </td>
                      <td className="px-2 py-2 text-right text-blue-300 bg-blue-950/10">{formatBRL(pair.callBid)}</td>
                      <td className="px-2 py-2 text-right text-blue-200 bg-blue-950/10">{formatBRL(pair.callAsk)}</td>
                      {/* PUT */}
                      <td className="px-2 py-2 bg-red-950/10">
                        {pair.putSymbol ? (
                          <span className="text-red-300 font-semibold">{pair.putSymbol}</span>
                        ) : (
                          <span className="text-zinc-600">—</span>
                        )}
                      </td>
                      <td className="px-2 py-2 text-right text-red-300 bg-red-950/10">{formatBRL(pair.putBid)}</td>
                      <td className="px-2 py-2 text-right text-red-200 bg-red-950/10">{formatBRL(pair.putAsk)}</td>
                      {/* Box Spread */}
                      <td className="px-2 py-2 text-right font-semibold text-orange-300">{formatBRL(displayStrike)}</td>
                      <td className="px-2 py-2 text-center text-zinc-400 text-[10px]">
                        {pair.vencimento ?? "—"}
                        {pair.diasUteis !== null && (
                          <span className="block text-amber-500/70 font-bold">{pair.diasUteis}du</span>
                        )}
                      </td>
                      <td className="px-2 py-2 text-right font-bold text-orange-400">{formatBRL(pair.compraBox)}</td>
                      <td className="px-2 py-2 text-right font-bold">
                        {pair.lucro !== null ? (
                          <span className={pair.lucro >= 0 ? "text-emerald-400" : "text-red-400"}>
                            {formatBRL(pair.lucro)}
                          </span>
                        ) : "—"}
                      </td>
                      <td className="px-2 py-2 text-right font-bold">
                        {pair.lucroTotal !== null ? (
                          <span className={pair.lucroTotal >= 0 ? "text-emerald-300" : "text-red-400"}>
                            {formatBRL(pair.lucroTotal)}
                          </span>
                        ) : "—"}
                      </td>
                      <td className="px-2 py-2 text-right font-black">
                        {pair.lucroPercent !== null ? (
                          <span className={pair.lucroPercent >= 0 ? "text-emerald-300" : "text-red-400"}>
                            {formatPercent(pair.lucroPercent)}
                          </span>
                        ) : "—"}
                      </td>
                      {/* CDI */}
                      <td className="px-2 py-2 text-right text-amber-400">
                        {pair.cdiPeriodo !== null ? formatPercent(pair.cdiPeriodo) : "—"}
                      </td>
                      <td className="px-2 py-2 text-center">
                        {pair.vsCD === "acima" ? (
                          <span className="inline-flex items-center gap-0.5 text-emerald-400 font-bold text-[10px] bg-emerald-950/40 px-1.5 py-0.5 rounded">
                            <TrendingUp className="w-3 h-3" /> ACIMA
                          </span>
                        ) : pair.vsCD === "abaixo" ? (
                          <span className="inline-flex items-center gap-0.5 text-red-400 font-bold text-[10px] bg-red-950/40 px-1.5 py-0.5 rounded">
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
                              className="text-zinc-700 hover:text-red-400 transition-colors"
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
                              className="text-zinc-700 hover:text-red-400 transition-colors"
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
                        className="border-b border-zinc-800/30 hover:bg-zinc-800/20 opacity-50"
                      >
                        <td className="px-4 py-2 text-zinc-500">{family.name}</td>
                        <td className="px-2 py-2" colSpan={2}>
                          <span className={`px-1.5 py-0.5 rounded text-xs font-bold ${
                            ticker.type === "CALL" ? "bg-blue-900/40 text-blue-300" : "bg-red-900/40 text-red-300"
                          }`}>
                            {ticker.type}: {ticker.symbol}
                          </span>
                          <span className="text-zinc-600 text-xs ml-2">
                            (sem par {ticker.type === "CALL" ? "PUT" : "CALL"} no strike {formatBRL(ticker.strike)})
                          </span>
                        </td>
                        <td className="px-2 py-2 text-right text-zinc-500" colSpan={3}>
                          {liveRow ? `${formatBRL(liveRow.ofCompra)} / ${formatBRL(liveRow.ofVenda)}` : "—"}
                        </td>
                        <td className="px-2 py-2 text-zinc-600 text-center" colSpan={8}>
                          Aguardando par...
                        </td>
                        <td className="px-2 py-2" colSpan={2} />
                        <td className="px-2 py-2">
                          <button
                            onClick={() => onRemoveTicker(family.id, ticker.id)}
                            className="text-zinc-700 hover:text-red-400 transition-colors"
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
