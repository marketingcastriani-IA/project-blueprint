// ============================================================
// RASTREADOR DE BOX - Compra de Box (Stock + Put - Call)
// Lógica: Compra BOX = Stock ASK + Put ASK - Call BID
//         Lucro = Strike - Compra BOX
//         Lucro % = Lucro / Compra BOX × 100
// ============================================================

import { useState, useRef, useCallback, useEffect } from "react";
import {
  Plus,
  Trash2,
  Upload,
  TrendingUp,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Star,
  AlertCircle,
  ClipboardPaste,
  X,
  BarChart2,
  Trophy,
  Save,
  Download,
} from "lucide-react";

// ─── TIPOS ───────────────────────────────────────────────────
interface OptionTicker {
  id: string;
  symbol: string;
  type: "CALL" | "PUT";
  strike: number;
  bidPrice: number | null;
  askPrice: number | null;
  volume: number | null;
  updatedAt: string | null;
  loading: boolean;
  error: string | null;
}

interface BoxPair {
  strike: number;
  call: OptionTicker | null;
  put: OptionTicker | null;
  // Calculated
  compraBox: number | null;
  lucro: number | null;
  lucroPercent: number | null;
}

interface StockFamily {
  id: string;
  name: string;
  stockBid: number | null;
  stockAsk: number | null;
  tickers: OptionTicker[];
  expanded: boolean;
  loadingStock: boolean;
}

interface SavedFamily {
  name: string;
  tickers: string[]; // symbols only
}

// ─── CONSTANTES ──────────────────────────────────────────────
const STORAGE_KEY = "box-tracker-families";

// ─── FUNÇÕES AUXILIARES ──────────────────────────────────────
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
  // BBDCD194 → strike chars after the type letter
  const clean = symbol.toUpperCase().replace(/\s/g, "");
  // Match: 4 letters (asset) + 1 letter (type/month) + digits (strike)
  const match = clean.match(/^[A-Z]{4,5}[A-X](\d+)$/);
  if (match) {
    const raw = parseInt(match[1]);
    // B3: if 3+ digits, last 2 are decimals → divide by 100
    if (raw >= 100) return raw / 100;
    return raw;
  }
  return 0;
}

function extractTypeFromTicker(symbol: string): "CALL" | "PUT" {
  const clean = symbol.toUpperCase().replace(/\s/g, "");
  // Find the type letter: 5th character for 4-letter assets, 6th for 5-letter
  const match = clean.match(/^[A-Z]{4,5}([A-X])/);
  if (match) {
    const code = match[1].charCodeAt(0) - 65;
    return code <= 11 ? "CALL" : "PUT"; // A-L = CALL, M-X = PUT
  }
  return "CALL";
}

// ─── MOCK API (substituir por API real) ──────────────────────
async function fetchOptionData(symbol: string): Promise<Partial<OptionTicker>> {
  await new Promise((r) => setTimeout(r, 300 + Math.random() * 500));
  if (Math.random() < 0.03) throw new Error("Timeout");

  const strike = extractStrikeFromTicker(symbol);
  const type = extractTypeFromTicker(symbol);
  const base = strike > 0 ? strike : 20;

  // Simulate bid/ask based on type and how far from ATM
  let bid: number, ask: number;
  if (type === "CALL") {
    bid = parseFloat((base * (0.02 + Math.random() * 0.06)).toFixed(2));
    ask = parseFloat((bid + 0.01 + Math.random() * 0.04).toFixed(2));
  } else {
    bid = parseFloat((base * (0.015 + Math.random() * 0.08)).toFixed(2));
    ask = parseFloat((bid + 0.01 + Math.random() * 0.05).toFixed(2));
  }

  return {
    bidPrice: bid,
    askPrice: ask,
    volume: Math.floor(Math.random() * 50000),
    updatedAt: new Date().toLocaleTimeString("pt-BR"),
  };
}

async function fetchStockPrice(ticker: string): Promise<{ bid: number; ask: number }> {
  await new Promise((r) => setTimeout(r, 300));
  const prices: Record<string, number> = {
    PETR4: 38.5, VALE3: 62.3, ITUB4: 34.8, BBDC4: 19.30,
    ABEV3: 12.9, MGLU3: 8.4, WEGE3: 52.1, RENT3: 58.7,
    B3SA3: 11.3, EGIE3: 42.0, BBAS3: 28.6, SUZB3: 55.4,
    LREN3: 15.63,
  };
  const mid = prices[ticker] ?? 30 + Math.random() * 50;
  return { bid: mid, ask: parseFloat((mid + 0.02).toFixed(2)) };
}

// ─── CÁLCULO DO BOX ──────────────────────────────────────────
// Compra de Box = Compra do Ativo (ASK) + Compra da PUT (ASK) - Venda da CALL (BID)
// No vencimento recebe o Strike
// Lucro = Strike - Compra Box
// Lucro% = Lucro / Compra Box × 100
function calculateBoxPairs(family: StockFamily): BoxPair[] {
  const { tickers, stockAsk } = family;
  if (!stockAsk || stockAsk <= 0) return [];

  // Group by strike
  const strikeMap = new Map<number, { calls: OptionTicker[]; puts: OptionTicker[] }>();

  tickers.forEach((t) => {
    if (t.loading || t.error || t.strike <= 0) return;
    const key = t.strike;
    if (!strikeMap.has(key)) strikeMap.set(key, { calls: [], puts: [] });
    const group = strikeMap.get(key)!;
    if (t.type === "CALL") group.calls.push(t);
    else group.puts.push(t);
  });

  const pairs: BoxPair[] = [];

  strikeMap.forEach((group, strike) => {
    // For each call+put pair at this strike
    const call = group.calls[0] || null;
    const put = group.puts[0] || null;

    if (call && put && call.bidPrice !== null && put.askPrice !== null) {
      const compraBox = stockAsk + put.askPrice - call.bidPrice;
      const lucro = strike - compraBox;
      const lucroPercent = compraBox > 0 ? (lucro / compraBox) * 100 : null;

      pairs.push({ strike, call, put, compraBox, lucro, lucroPercent });
    } else {
      // Incomplete pair
      pairs.push({ strike, call, put, compraBox: null, lucro: null, lucroPercent: null });
    }
  });

  pairs.sort((a, b) => (b.lucroPercent ?? -999) - (a.lucroPercent ?? -999));
  return pairs;
}

// ─── COMPONENTE PRINCIPAL ─────────────────────────────────────
export default function BoxTracker() {
  const [families, setFamilies] = useState<StockFamily[]>([]);
  const [newFamilyName, setNewFamilyName] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  // Load from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed: SavedFamily[] = JSON.parse(saved);
        parsed.forEach((sf) => {
          addFamilyFromSaved(sf.name, sf.tickers);
        });
      }
    } catch {}
  }, []);

  // Save to localStorage whenever families change
  useEffect(() => {
    const toSave: SavedFamily[] = families.map((f) => ({
      name: f.name,
      tickers: f.tickers.map((t) => t.symbol),
    }));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
  }, [families]);

  const addFamilyFromSaved = (name: string, symbols: string[]) => {
    const familyId = generateId();
    const newFamily: StockFamily = {
      id: familyId,
      name,
      stockBid: null,
      stockAsk: null,
      tickers: [],
      expanded: true,
      loadingStock: true,
    };

    setFamilies((prev) => {
      if (prev.find((f) => f.name === name)) return prev;
      return [...prev, newFamily];
    });

    fetchStockPrice(name).then((price) => {
      setFamilies((prev) =>
        prev.map((f) =>
          f.id === familyId
            ? { ...f, stockBid: price.bid, stockAsk: price.ask, loadingStock: false }
            : f
        )
      );
    });

    if (symbols.length > 0) {
      const newTickers: OptionTicker[] = symbols.map((symbol) => ({
        id: generateId(),
        symbol: symbol.toUpperCase(),
        type: extractTypeFromTicker(symbol),
        strike: extractStrikeFromTicker(symbol),
        bidPrice: null,
        askPrice: null,
        volume: null,
        updatedAt: null,
        loading: true,
        error: null,
      }));

      setFamilies((prev) =>
        prev.map((f) =>
          f.id === familyId ? { ...f, tickers: [...f.tickers, ...newTickers] } : f
        )
      );

      newTickers.forEach((ticker) => {
        fetchOptionData(ticker.symbol)
          .then((data) => {
            setFamilies((prev) =>
              prev.map((f) =>
                f.id !== familyId
                  ? f
                  : {
                      ...f,
                      tickers: f.tickers.map((t) =>
                        t.id === ticker.id ? { ...t, ...data, loading: false } : t
                      ),
                    }
              )
            );
          })
          .catch((err) => {
            setFamilies((prev) =>
              prev.map((f) =>
                f.id !== familyId
                  ? f
                  : {
                      ...f,
                      tickers: f.tickers.map((t) =>
                        t.id === ticker.id ? { ...t, loading: false, error: err.message } : t
                      ),
                    }
              )
            );
          });
      });
    }
  };

  const addFamily = useCallback(() => {
    const name = newFamilyName.trim().toUpperCase();
    if (!name) return;
    if (families.find((f) => f.name === name)) return;

    const familyId = generateId();
    const newFamily: StockFamily = {
      id: familyId,
      name,
      stockBid: null,
      stockAsk: null,
      tickers: [],
      expanded: true,
      loadingStock: true,
    };

    setFamilies((prev) => [...prev, newFamily]);
    setNewFamilyName("");

    fetchStockPrice(name).then((price) => {
      setFamilies((prev) =>
        prev.map((f) =>
          f.id === familyId
            ? { ...f, stockBid: price.bid, stockAsk: price.ask, loadingStock: false }
            : f
        )
      );
    });
  }, [newFamilyName, families]);

  const removeFamily = useCallback((familyId: string) => {
    setFamilies((prev) => prev.filter((f) => f.id !== familyId));
  }, []);

  const toggleExpand = useCallback((familyId: string) => {
    setFamilies((prev) =>
      prev.map((f) => (f.id === familyId ? { ...f, expanded: !f.expanded } : f))
    );
  }, []);

  const processTickerSymbols = useCallback((familyId: string, rawText: string) => {
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
      bidPrice: null,
      askPrice: null,
      volume: null,
      updatedAt: null,
      loading: true,
      error: null,
    }));

    setFamilies((prev) =>
      prev.map((f) => {
        if (f.id !== familyId) return f;
        const existing = new Set(f.tickers.map((t) => t.symbol));
        const toAdd = newTickers.filter((t) => !existing.has(t.symbol));
        return { ...f, tickers: [...f.tickers, ...toAdd] };
      })
    );

    newTickers.forEach((ticker) => {
      fetchOptionData(ticker.symbol)
        .then((data) => {
          setFamilies((prev) =>
            prev.map((f) =>
              f.id !== familyId
                ? f
                : {
                    ...f,
                    tickers: f.tickers.map((t) =>
                      t.id === ticker.id ? { ...t, ...data, loading: false } : t
                    ),
                  }
            )
          );
        })
        .catch((err) => {
          setFamilies((prev) =>
            prev.map((f) =>
              f.id !== familyId
                ? f
                : {
                    ...f,
                    tickers: f.tickers.map((t) =>
                      t.id === ticker.id ? { ...t, loading: false, error: err.message } : t
                    ),
                  }
            )
          );
        });
    });
  }, []);

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

  const refreshAll = useCallback(async () => {
    setRefreshing(true);
    const updates: Promise<void>[] = [];

    families.forEach((family) => {
      updates.push(
        fetchStockPrice(family.name).then((price) => {
          setFamilies((prev) =>
            prev.map((f) =>
              f.id === family.id ? { ...f, stockBid: price.bid, stockAsk: price.ask } : f
            )
          );
        })
      );

      family.tickers.forEach((ticker) => {
        updates.push(
          fetchOptionData(ticker.symbol)
            .then((data) => {
              setFamilies((prev) =>
                prev.map((f) =>
                  f.id !== family.id
                    ? f
                    : {
                        ...f,
                        tickers: f.tickers.map((t) =>
                          t.id === ticker.id ? { ...t, ...data, loading: false, error: null } : t
                        ),
                      }
                )
              );
            })
            .catch(() => {})
        );
      });
    });

    await Promise.all(updates);
    setRefreshing(false);
  }, [families]);

  // Collect all box pairs across families for global ranking
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

  // ─── RENDER ───────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#0a0e1a] text-white font-mono p-4 md:p-6">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-emerald-400 flex items-center gap-2">
            <BarChart2 className="w-6 h-6" />
            Rastreador de Box
          </h1>
          <p className="text-xs text-zinc-500 mt-1">
            Compra de Box · Ativo + Put - Call = Lucro garantido no vencimento
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={refreshAll}
            disabled={refreshing}
            className="flex items-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 border border-zinc-600 rounded-lg text-sm transition-all disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
            {refreshing ? "Atualizando..." : "Atualizar Tudo"}
          </button>
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
                  ? "bg-gradient-to-br from-yellow-900/30 to-yellow-950/20 border-yellow-600/50"
                  : i === 1
                  ? "bg-gradient-to-br from-zinc-700/30 to-zinc-800/20 border-zinc-500/50"
                  : "bg-gradient-to-br from-amber-900/20 to-amber-950/10 border-amber-700/40"
              }`}
            >
              <div className="flex items-center gap-2 mb-2">
                <Trophy
                  className={`w-5 h-5 ${
                    i === 0 ? "text-yellow-400" : i === 1 ? "text-zinc-300" : "text-amber-500"
                  }`}
                />
                <span className="text-xs text-zinc-400 uppercase tracking-wider">
                  {i === 0 ? "🥇 Melhor Box" : i === 1 ? "🥈 2º Melhor" : "🥉 3º Melhor"}
                </span>
              </div>

              <div className="flex items-baseline gap-2 mb-1">
                <span className="text-lg font-black text-white">{pair.familyName}</span>
                <span className="text-xs text-zinc-400">Strike {formatBRL(pair.strike)}</span>
              </div>

              <div className="flex items-center gap-3 text-sm">
                <span className="text-zinc-400">
                  Call: <span className="text-blue-300 font-bold">{pair.call?.symbol}</span>
                </span>
                <span className="text-zinc-400">
                  Put: <span className="text-red-300 font-bold">{pair.put?.symbol}</span>
                </span>
              </div>

              <div className="mt-3 flex items-end justify-between">
                <div>
                  <p className="text-xs text-zinc-500">Compra Box</p>
                  <p className="text-sm font-bold text-yellow-400">{formatBRL(pair.compraBox)}</p>
                </div>
                <div>
                  <p className="text-xs text-zinc-500">Lucro</p>
                  <p className="text-sm font-bold text-emerald-400">{formatBRL(pair.lucro)}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-zinc-500">Retorno</p>
                  <p className="text-xl font-black text-emerald-300">
                    {formatPercent(pair.lucroPercent)}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* TOP 10 TABLE */}
      {topPairs.length > 3 && (
        <div className="mb-6 bg-zinc-900/60 border border-emerald-900/40 rounded-xl p-4">
          <h2 className="text-sm font-bold text-emerald-400 mb-3 flex items-center gap-2">
            <Star className="w-4 h-4 text-yellow-400" />
            Top 10 · Melhores Box Spreads
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-zinc-500 border-b border-zinc-800">
                  <th className="text-left py-2 pr-3">#</th>
                  <th className="text-left py-2 pr-3">Ativo</th>
                  <th className="text-left py-2 pr-3">CALL</th>
                  <th className="text-left py-2 pr-3">PUT</th>
                  <th className="text-right py-2 pr-3">Strike</th>
                  <th className="text-right py-2 pr-3">Compra Box</th>
                  <th className="text-right py-2 pr-3">Lucro</th>
                  <th className="text-right py-2">Lucro %</th>
                </tr>
              </thead>
              <tbody>
                {topPairs.slice(3).map((p, i) => (
                  <tr key={`rank-${i + 3}`} className="border-b border-zinc-800/50 hover:bg-zinc-800/30">
                    <td className="py-2 pr-3 text-zinc-500">{i + 4}º</td>
                    <td className="py-2 pr-3 font-bold text-white">{p.familyName}</td>
                    <td className="py-2 pr-3 text-blue-300">{p.call?.symbol}</td>
                    <td className="py-2 pr-3 text-red-300">{p.put?.symbol}</td>
                    <td className="py-2 pr-3 text-right">{formatBRL(p.strike)}</td>
                    <td className="py-2 pr-3 text-right text-yellow-400">{formatBRL(p.compraBox)}</td>
                    <td className="py-2 pr-3 text-right text-emerald-400">{formatBRL(p.lucro)}</td>
                    <td className="py-2 text-right font-bold text-emerald-300">
                      {formatPercent(p.lucroPercent)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ADD FAMILY */}
      <div className="flex gap-2 mb-6">
        <input
          type="text"
          value={newFamilyName}
          onChange={(e) => setNewFamilyName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addFamily()}
          placeholder="Ticker do ativo (ex: PETR4, BBDC4, LREN3...)"
          className="flex-1 bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-emerald-500 transition-colors placeholder-zinc-600"
        />
        <button
          onClick={addFamily}
          className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-lg text-sm font-bold transition-colors"
        >
          <Plus className="w-4 h-4" />
          Adicionar Família
        </button>
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
  onRemoveFamily: (id: string) => void;
  onToggleExpand: (id: string) => void;
  onAddTickers: (familyId: string, raw: string) => void;
  onRemoveTicker: (familyId: string, tickerId: string) => void;
  onFileUpload: (familyId: string, file: File) => void;
}

function FamilyCard({
  family,
  onRemoveFamily,
  onToggleExpand,
  onAddTickers,
  onRemoveTicker,
  onFileUpload,
}: FamilyCardProps) {
  const [pasteText, setPasteText] = useState("");
  const [showPaste, setShowPaste] = useState(false);
  const [manualTicker, setManualTicker] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const pasteRef = useRef<HTMLTextAreaElement>(null);

  // Handle paste from clipboard API directly
  const handlePasteFromClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text.trim()) {
        onAddTickers(family.id, text);
      }
    } catch {
      // Fallback: show paste area
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

  // Global paste handler when paste area is open
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

  return (
    <div className="bg-zinc-900/70 border border-zinc-700/50 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-zinc-800/50">
        <div className="flex items-center gap-3">
          <button
            onClick={() => onToggleExpand(family.id)}
            className="text-zinc-400 hover:text-white transition-colors"
          >
            {family.expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
          <div>
            <span className="font-bold text-white text-base">{family.name}</span>
            {family.loadingStock ? (
              <span className="text-xs text-zinc-500 ml-2">Carregando...</span>
            ) : (
              <span className="text-xs ml-2">
                <span className="text-zinc-400">BID</span>{" "}
                <span className="text-emerald-400 font-semibold">{formatBRL(family.stockBid)}</span>
                <span className="text-zinc-600 mx-1">|</span>
                <span className="text-zinc-400">ASK</span>{" "}
                <span className="text-emerald-400 font-semibold">{formatBRL(family.stockAsk)}</span>
              </span>
            )}
          </div>
          <span className="text-xs text-zinc-500">{family.tickers.length} tickers</span>
          {bestPair && (
            <span className="hidden md:flex items-center gap-1 text-xs bg-emerald-950 border border-emerald-800 text-emerald-400 px-2 py-0.5 rounded-full">
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
            title="Colar tickers da área de transferência"
            className="flex items-center gap-1 px-2 py-1 text-xs bg-emerald-700 hover:bg-emerald-600 rounded transition-colors"
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
              className="flex-1 bg-zinc-900 border border-zinc-700 rounded px-3 py-2 text-xs font-mono focus:outline-none focus:border-emerald-500 resize-none"
            />
            <div className="flex flex-col gap-2">
              <button
                onClick={handlePasteSubmit}
                className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 rounded text-xs font-bold transition-colors"
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
              className="flex-1 bg-zinc-900 border border-zinc-700 rounded px-3 py-1.5 text-xs focus:outline-none focus:border-emerald-500 transition-colors placeholder-zinc-600"
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
                <tr className="text-zinc-500 border-b border-zinc-800 bg-zinc-900/50">
                  <th className="text-left px-4 py-2">ATIVO</th>
                  <th className="text-left px-2 py-2">CALL</th>
                  <th className="text-left px-2 py-2">PUT</th>
                  <th className="text-right px-2 py-2">BID (Ativo)</th>
                  <th className="text-right px-2 py-2">ASK (Ativo)</th>
                  <th className="text-right px-2 py-2">BID (Call)</th>
                  <th className="text-right px-2 py-2">ASK (Call)</th>
                  <th className="text-right px-2 py-2">BID (Put)</th>
                  <th className="text-right px-2 py-2">ASK (Put)</th>
                  <th className="text-right px-2 py-2 text-yellow-400">Compra BOX</th>
                  <th className="text-right px-2 py-2">Strike</th>
                  <th className="text-right px-2 py-2 text-emerald-400">Lucro</th>
                  <th className="text-right px-2 py-2 text-emerald-300 font-bold">Lucro %</th>
                  <th className="px-2 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {boxPairs.map((pair, idx) => {
                  const isBest = idx === 0 && pair.lucroPercent !== null && pair.lucroPercent > 0;

                  return (
                    <tr
                      key={`pair-${pair.strike}-${idx}`}
                      className={`border-b border-zinc-800/30 hover:bg-zinc-800/20 transition-colors ${
                        isBest ? "bg-emerald-950/20" : ""
                      }`}
                    >
                      <td className="px-4 py-2 font-bold text-white flex items-center gap-1">
                        {isBest && <Star className="w-3 h-3 text-yellow-400 flex-shrink-0" />}
                        {family.name}
                      </td>
                      <td className="px-2 py-2">
                        {pair.call ? (
                          <span className="text-blue-300 font-semibold">{pair.call.symbol}</span>
                        ) : (
                          <span className="text-zinc-600">—</span>
                        )}
                      </td>
                      <td className="px-2 py-2">
                        {pair.put ? (
                          <span className="text-red-300 font-semibold">{pair.put.symbol}</span>
                        ) : (
                          <span className="text-zinc-600">—</span>
                        )}
                      </td>
                      {/* Stock Bid/Ask */}
                      <td className="px-2 py-2 text-right text-zinc-300">
                        {formatBRL(family.stockBid)}
                      </td>
                      <td className="px-2 py-2 text-right text-zinc-300">
                        {formatBRL(family.stockAsk)}
                      </td>
                      {/* Call Bid/Ask */}
                      <td className="px-2 py-2 text-right text-blue-300">
                        {pair.call?.loading ? (
                          <RefreshCw className="w-3 h-3 animate-spin inline" />
                        ) : (
                          formatBRL(pair.call?.bidPrice ?? null)
                        )}
                      </td>
                      <td className="px-2 py-2 text-right text-blue-200">
                        {formatBRL(pair.call?.askPrice ?? null)}
                      </td>
                      {/* Put Bid/Ask */}
                      <td className="px-2 py-2 text-right text-red-300">
                        {pair.put?.loading ? (
                          <RefreshCw className="w-3 h-3 animate-spin inline" />
                        ) : (
                          formatBRL(pair.put?.bidPrice ?? null)
                        )}
                      </td>
                      <td className="px-2 py-2 text-right text-red-200">
                        {formatBRL(pair.put?.askPrice ?? null)}
                      </td>
                      {/* Compra BOX */}
                      <td className="px-2 py-2 text-right font-bold text-yellow-400">
                        {formatBRL(pair.compraBox)}
                      </td>
                      {/* Strike */}
                      <td className="px-2 py-2 text-right font-semibold text-white">
                        {formatBRL(pair.strike)}
                      </td>
                      {/* Lucro */}
                      <td className="px-2 py-2 text-right font-bold">
                        {pair.lucro !== null ? (
                          <span className={pair.lucro >= 0 ? "text-emerald-400" : "text-red-400"}>
                            {formatBRL(pair.lucro)}
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                      {/* Lucro % */}
                      <td className="px-2 py-2 text-right font-black">
                        {pair.lucroPercent !== null ? (
                          <span className={pair.lucroPercent >= 0 ? "text-emerald-300" : "text-red-400"}>
                            {formatPercent(pair.lucroPercent)}
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                      {/* Actions */}
                      <td className="px-2 py-2">
                        <div className="flex gap-1">
                          {pair.call && (
                            <button
                              onClick={() => onRemoveTicker(family.id, pair.call!.id)}
                              className="text-zinc-700 hover:text-red-400 transition-colors"
                              title={`Remover ${pair.call.symbol}`}
                            >
                              <X className="w-3 h-3" />
                            </button>
                          )}
                          {pair.put && (
                            <button
                              onClick={() => onRemoveTicker(family.id, pair.put!.id)}
                              className="text-zinc-700 hover:text-red-400 transition-colors"
                              title={`Remover ${pair.put.symbol}`}
                            >
                              <X className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {/* Unpaired tickers (no matching strike pair) */}
                {family.tickers
                  .filter((t) => !boxPairs.some((p) => p.call?.id === t.id || p.put?.id === t.id))
                  .map((ticker) => (
                    <tr
                      key={ticker.id}
                      className="border-b border-zinc-800/30 hover:bg-zinc-800/20 opacity-50"
                    >
                      <td className="px-4 py-2 text-zinc-500">{family.name}</td>
                      <td className="px-2 py-2" colSpan={2}>
                        <span
                          className={`px-1.5 py-0.5 rounded text-xs font-bold ${
                            ticker.type === "CALL"
                              ? "bg-blue-900/40 text-blue-300"
                              : "bg-red-900/40 text-red-300"
                          }`}
                        >
                          {ticker.type}: {ticker.symbol}
                        </span>
                        <span className="text-zinc-600 text-xs ml-2">
                          (sem par {ticker.type === "CALL" ? "PUT" : "CALL"} no strike {formatBRL(ticker.strike)})
                        </span>
                      </td>
                      <td className="px-2 py-2 text-right text-zinc-500" colSpan={2}>
                        {formatBRL(family.stockBid)} / {formatBRL(family.stockAsk)}
                      </td>
                      <td className="px-2 py-2 text-right text-zinc-500" colSpan={2}>
                        {ticker.loading ? (
                          <RefreshCw className="w-3 h-3 animate-spin inline" />
                        ) : (
                          `${formatBRL(ticker.bidPrice)} / ${formatBRL(ticker.askPrice)}`
                        )}
                      </td>
                      <td className="px-2 py-2 text-zinc-600 text-center" colSpan={5}>
                        Aguardando par...
                      </td>
                      <td className="px-2 py-2">
                        <button
                          onClick={() => onRemoveTicker(family.id, ticker.id)}
                          className="text-zinc-700 hover:text-red-400 transition-colors"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
