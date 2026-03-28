// ============================================================
// RASTREADOR DE BOX - Aba completa para seu app Lovable
// Cole este componente em: src/components/BoxTracker.tsx
// ============================================================
// DEPENDÊNCIAS necessárias no seu projeto Lovable:
//   - lucide-react (já incluso no Lovable)
//   - shadcn/ui components (já incluso no Lovable)
//   - tailwindcss (já incluso no Lovable)
// ============================================================

import { useState, useRef, useCallback, useEffect } from "react";
import {
  Plus,
  Trash2,
  Upload,
  TrendingUp,
  TrendingDown,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Star,
  AlertCircle,
  Copy,
  X,
  BarChart2,
} from "lucide-react";

// ─── TIPOS ───────────────────────────────────────────────────
interface Ticker {
  id: string;
  symbol: string;        // ex: "PETRK350"
  type: "CALL" | "PUT";
  strike: number;
  expiry: string;        // "YYYY-MM-DD"
  lastPrice: number | null;
  bidPrice: number | null;
  askPrice: number | null;
  volume: number | null;
  openInterest: number | null;
  updatedAt: string | null;
  loading: boolean;
  error: string | null;
}

interface StockFamily {
  id: string;
  name: string;          // ex: "PETR4"
  underlyingPrice: number | null;
  tickers: Ticker[];
  expanded: boolean;
  loadingStock: boolean;
}

interface BoxResult {
  tickerId: string;
  symbol: string;
  type: "CALL" | "PUT";
  strike: number;
  expiry: string;
  stockPrice: number;
  optionPrice: number;
  periodDays: number;
  // Cálculos
  boxReturn: number;       // retorno % do box
  annualReturn: number;    // retorno anualizado %
  premium: number;         // prêmio recebido/pago
  breakeven: number;       // ponto de equilíbrio
  isProfit: boolean;
}

// ─── CONSTANTES ──────────────────────────────────────────────
const OPCOESPROX_BASE = "https://opcoesprox.com.br";

// Períodos disponíveis para cálculo
const PERIODS = [
  { label: "7 dias", value: 7 },
  { label: "15 dias", value: 15 },
  { label: "21 dias", value: 21 },
  { label: "30 dias", value: 30 },
  { label: "45 dias", value: 45 },
  { label: "60 dias", value: 60 },
];

// ─── FUNÇÕES AUXILIARES ──────────────────────────────────────
function generateId(): string {
  return Math.random().toString(36).substring(2, 9);
}

function formatCurrency(val: number | null): string {
  if (val === null) return "—";
  return val.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatPercent(val: number): string {
  return `${val >= 0 ? "+" : ""}${val.toFixed(2)}%`;
}

function extractStrikeFromTicker(symbol: string): number {
  // Extrai strike de tickers como PETRK350 → 35.00, VALED220 → 22.00
  const match = symbol.match(/([A-Z]{4}[A-Z]\d*)(\d{2,4})$/);
  if (match) {
    const raw = parseInt(match[2]);
    // Convenção B3: últimos 2 dígitos são decimais se > 2 dígitos
    return raw > 999 ? raw / 100 : raw;
  }
  return 0;
}

function extractTypeFromTicker(symbol: string): "CALL" | "PUT" {
  // Letras A-L = CALL, M-X = PUT (convenção B3)
  const match = symbol.match(/[A-Z]{4}([A-X])/);
  if (match) {
    const letter = match[1].charCodeAt(0) - 65; // A=0, L=11
    return letter <= 11 ? "CALL" : "PUT";
  }
  return "CALL";
}

// ─── MOCK DE API (substituir pela API real opcoesprox.com.br) ──
// A opcoesprox.com.br não expõe API pública REST documentada.
// Este mock simula os dados — você pode substituir pela integração real
// via fetch quando tiver a chave/endpoint da plataforma.
async function fetchOptionData(symbol: string): Promise<Partial<Ticker>> {
  // Simula latência de rede
  await new Promise((r) => setTimeout(r, 600 + Math.random() * 800));

  // Simula erro ocasional
  if (Math.random() < 0.05) throw new Error("Timeout na requisição");

  const strike = extractStrikeFromTicker(symbol);
  const base = strike > 0 ? strike : 30 + Math.random() * 20;

  return {
    lastPrice: parseFloat((base * (0.02 + Math.random() * 0.08)).toFixed(2)),
    bidPrice: parseFloat((base * (0.018 + Math.random() * 0.075)).toFixed(2)),
    askPrice: parseFloat((base * (0.022 + Math.random() * 0.085)).toFixed(2)),
    volume: Math.floor(Math.random() * 50000),
    openInterest: Math.floor(Math.random() * 200000),
    updatedAt: new Date().toLocaleTimeString("pt-BR"),
  };
}

async function fetchStockPrice(ticker: string): Promise<number> {
  await new Promise((r) => setTimeout(r, 400));
  // Mock: preços aproximados de ações populares
  const prices: Record<string, number> = {
    PETR4: 38.5, VALE3: 62.3, ITUB4: 34.8, BBDC4: 14.2,
    ABEV3: 12.9, MGLU3: 8.4, WEGE3: 52.1, RENT3: 58.7,
    B3SA3: 11.3, EGIE3: 42.0, BBAS3: 28.6, SUZB3: 55.4,
  };
  return prices[ticker] ?? 30 + Math.random() * 50;
}

// ─── CÁLCULO DO BOX ──────────────────────────────────────────
function calculateBoxReturn(
  ticker: Ticker,
  stockPrice: number,
  periodDays: number
): BoxResult | null {
  if (!ticker.lastPrice || stockPrice <= 0) return null;

  const optionPrice = ticker.lastPrice;
  const strike = ticker.strike;

  let premium = 0;
  let breakeven = 0;

  if (ticker.type === "CALL") {
    // Venda de CALL coberta: recebe prêmio, limita upside no strike
    premium = optionPrice;
    breakeven = stockPrice - premium;
  } else {
    // Compra de PUT protetora: paga prêmio, protege abaixo do strike
    premium = -optionPrice;
    breakeven = stockPrice + optionPrice;
  }

  // Retorno do box no período
  const periodReturn = (premium / stockPrice) * 100;

  // Anualizado
  const annualReturn = (periodReturn / periodDays) * 252;

  return {
    tickerId: ticker.id,
    symbol: ticker.symbol,
    type: ticker.type,
    strike,
    expiry: ticker.expiry,
    stockPrice,
    optionPrice,
    periodDays,
    boxReturn: periodReturn,
    annualReturn,
    premium,
    breakeven,
    isProfit: periodReturn > 0,
  };
}

// ─── COMPONENTE PRINCIPAL ─────────────────────────────────────
export default function BoxTracker() {
  const [families, setFamilies] = useState<StockFamily[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState<number>(30);
  const [newFamilyName, setNewFamilyName] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [bestResults, setBestResults] = useState<BoxResult[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pasteAreaRef = useRef<HTMLTextAreaElement>(null);

  // ── Adicionar família de ações ────────────────────────────
  const addFamily = useCallback(() => {
    const name = newFamilyName.trim().toUpperCase();
    if (!name) return;
    if (families.find((f) => f.name === name)) {
      alert(`Família ${name} já existe.`);
      return;
    }

    const newFamily: StockFamily = {
      id: generateId(),
      name,
      underlyingPrice: null,
      tickers: [],
      expanded: true,
      loadingStock: true,
    };

    setFamilies((prev) => [...prev, newFamily]);
    setNewFamilyName("");

    // Busca preço do ativo
    fetchStockPrice(name).then((price) => {
      setFamilies((prev) =>
        prev.map((f) =>
          f.id === newFamily.id
            ? { ...f, underlyingPrice: price, loadingStock: false }
            : f
        )
      );
    });
  }, [newFamilyName, families]);

  // ── Remover família ───────────────────────────────────────
  const removeFamily = useCallback((familyId: string) => {
    setFamilies((prev) => prev.filter((f) => f.id !== familyId));
  }, []);

  // ── Toggle expand ─────────────────────────────────────────
  const toggleExpand = useCallback((familyId: string) => {
    setFamilies((prev) =>
      prev.map((f) =>
        f.id === familyId ? { ...f, expanded: !f.expanded } : f
      )
    );
  }, []);

  // ── Processar tickers (lista de symbols) ──────────────────
  const processTickerSymbols = useCallback(
    (familyId: string, rawText: string) => {
      const symbols = rawText
        .split(/[\n,;\t ]+/)
        .map((s) => s.trim().toUpperCase())
        .filter((s) => s.length >= 5);

      if (!symbols.length) return;

      const newTickers: Ticker[] = symbols.map((symbol) => ({
        id: generateId(),
        symbol,
        type: extractTypeFromTicker(symbol),
        strike: extractStrikeFromTicker(symbol),
        expiry: "",
        lastPrice: null,
        bidPrice: null,
        askPrice: null,
        volume: null,
        openInterest: null,
        updatedAt: null,
        loading: true,
        error: null,
      }));

      setFamilies((prev) =>
        prev.map((f) => {
          if (f.id !== familyId) return f;
          // Evita duplicatas
          const existingSymbols = new Set(f.tickers.map((t) => t.symbol));
          const toAdd = newTickers.filter((t) => !existingSymbols.has(t.symbol));
          return { ...f, tickers: [...f.tickers, ...toAdd] };
        })
      );

      // Busca dados de cada ticker
      newTickers.forEach((ticker) => {
        fetchOptionData(ticker.symbol)
          .then((data) => {
            setFamilies((prev) =>
              prev.map((f) => {
                if (f.id !== familyId) return f;
                return {
                  ...f,
                  tickers: f.tickers.map((t) =>
                    t.id === ticker.id
                      ? { ...t, ...data, loading: false, error: null }
                      : t
                  ),
                };
              })
            );
          })
          .catch((err) => {
            setFamilies((prev) =>
              prev.map((f) => {
                if (f.id !== familyId) return f;
                return {
                  ...f,
                  tickers: f.tickers.map((t) =>
                    t.id === ticker.id
                      ? { ...t, loading: false, error: err.message }
                      : t
                  ),
                };
              })
            );
          });
      });
    },
    []
  );

  // ── Upload de arquivo CSV/TXT ─────────────────────────────
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

  // ── Remover ticker ────────────────────────────────────────
  const removeTicker = useCallback((familyId: string, tickerId: string) => {
    setFamilies((prev) =>
      prev.map((f) =>
        f.id !== familyId
          ? f
          : { ...f, tickers: f.tickers.filter((t) => t.id !== tickerId) }
      )
    );
  }, []);

  // ── Refresh geral ─────────────────────────────────────────
  const refreshAll = useCallback(async () => {
    setRefreshing(true);
    const updates: Promise<void>[] = [];

    families.forEach((family) => {
      // Atualiza preço do ativo
      updates.push(
        fetchStockPrice(family.name).then((price) => {
          setFamilies((prev) =>
            prev.map((f) =>
              f.id === family.id ? { ...f, underlyingPrice: price } : f
            )
          );
        })
      );

      // Atualiza cada ticker
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
                          t.id === ticker.id
                            ? { ...t, ...data, loading: false, error: null }
                            : t
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

  // ── Calcular melhores strikes ─────────────────────────────
  useEffect(() => {
    const results: BoxResult[] = [];
    families.forEach((family) => {
      if (!family.underlyingPrice) return;
      family.tickers.forEach((ticker) => {
        const r = calculateBoxReturn(ticker, family.underlyingPrice!, selectedPeriod);
        if (r) results.push(r);
      });
    });
    results.sort((a, b) => b.annualReturn - a.annualReturn);
    setBestResults(results.slice(0, 10));
  }, [families, selectedPeriod]);

  // ─── RENDER ───────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#0a0e1a] text-white font-mono p-4 md:p-6">
      {/* ── HEADER ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-emerald-400 flex items-center gap-2">
            <BarChart2 className="w-6 h-6" />
            Rastreador de Box
          </h1>
          <p className="text-xs text-zinc-500 mt-1">
            Monitoramento de opções · opcoesprox.com.br
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {/* Seletor de período */}
          <div className="flex items-center gap-1 bg-zinc-900 border border-zinc-700 rounded-lg p-1">
            {PERIODS.map((p) => (
              <button
                key={p.value}
                onClick={() => setSelectedPeriod(p.value)}
                className={`px-3 py-1 rounded text-xs font-semibold transition-all ${
                  selectedPeriod === p.value
                    ? "bg-emerald-500 text-black"
                    : "text-zinc-400 hover:text-white"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Botão refresh */}
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

      {/* ── MELHORES STRIKES (TOP 10) ── */}
      {bestResults.length > 0 && (
        <div className="mb-8 bg-zinc-900/60 border border-emerald-900/40 rounded-xl p-4">
          <h2 className="text-sm font-bold text-emerald-400 mb-3 flex items-center gap-2">
            <Star className="w-4 h-4 text-yellow-400" />
            Top Strikes · Maior Retorno ({selectedPeriod} dias)
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-zinc-500 border-b border-zinc-800">
                  <th className="text-left py-2 pr-4">#</th>
                  <th className="text-left py-2 pr-4">Ticker</th>
                  <th className="text-left py-2 pr-4">Tipo</th>
                  <th className="text-right py-2 pr-4">Strike</th>
                  <th className="text-right py-2 pr-4">Prêmio</th>
                  <th className="text-right py-2 pr-4">Retorno Box</th>
                  <th className="text-right py-2">Ret. Anual.</th>
                </tr>
              </thead>
              <tbody>
                {bestResults.map((r, i) => (
                  <tr
                    key={r.tickerId}
                    className={`border-b border-zinc-800/50 hover:bg-zinc-800/30 ${
                      i === 0 ? "bg-emerald-950/30" : ""
                    }`}
                  >
                    <td className="py-2 pr-4 text-zinc-500">
                      {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}º`}
                    </td>
                    <td className="py-2 pr-4 font-bold text-white">{r.symbol}</td>
                    <td className="py-2 pr-4">
                      <span
                        className={`px-2 py-0.5 rounded text-xs font-bold ${
                          r.type === "CALL"
                            ? "bg-blue-900/50 text-blue-300"
                            : "bg-red-900/50 text-red-300"
                        }`}
                      >
                        {r.type}
                      </span>
                    </td>
                    <td className="py-2 pr-4 text-right">{formatCurrency(r.strike)}</td>
                    <td className="py-2 pr-4 text-right text-yellow-400">
                      {formatCurrency(r.optionPrice)}
                    </td>
                    <td className="py-2 pr-4 text-right">
                      <span className={r.isProfit ? "text-emerald-400" : "text-red-400"}>
                        {formatPercent(r.boxReturn)}
                      </span>
                    </td>
                    <td className="py-2 text-right">
                      <span className={r.isProfit ? "text-emerald-300 font-bold" : "text-red-400"}>
                        {formatPercent(r.annualReturn)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── ADICIONAR FAMÍLIA ── */}
      <div className="flex gap-2 mb-6">
        <input
          type="text"
          value={newFamilyName}
          onChange={(e) => setNewFamilyName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addFamily()}
          placeholder="Ticker do ativo (ex: PETR4, VALE3...)"
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

      {/* ── FAMÍLIAS ── */}
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
              selectedPeriod={selectedPeriod}
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
  selectedPeriod: number;
  onRemoveFamily: (id: string) => void;
  onToggleExpand: (id: string) => void;
  onAddTickers: (familyId: string, raw: string) => void;
  onRemoveTicker: (familyId: string, tickerId: string) => void;
  onFileUpload: (familyId: string, file: File) => void;
}

function FamilyCard({
  family,
  selectedPeriod,
  onRemoveFamily,
  onToggleExpand,
  onAddTickers,
  onRemoveTicker,
  onFileUpload,
}: FamilyCardProps) {
  const [pasteText, setPasteText] = useState("");
  const [showPaste, setShowPaste] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handlePaste = () => {
    if (!pasteText.trim()) return;
    onAddTickers(family.id, pasteText);
    setPasteText("");
    setShowPaste(false);
  };

  const handlePasteEvent = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const text = e.clipboardData.getData("text");
    if (text) {
      e.preventDefault();
      setPasteText(text);
    }
  };

  const boxResults = family.tickers
    .map((t) =>
      family.underlyingPrice
        ? calculateBoxReturn(t, family.underlyingPrice, selectedPeriod)
        : null
    )
    .filter(Boolean) as BoxResult[];

  const bestResult =
    boxResults.length > 0
      ? boxResults.reduce((a, b) => (a.annualReturn > b.annualReturn ? a : b))
      : null;

  return (
    <div className="bg-zinc-900/70 border border-zinc-700/50 rounded-xl overflow-hidden">
      {/* Header da família */}
      <div className="flex items-center justify-between px-4 py-3 bg-zinc-800/50">
        <div className="flex items-center gap-3">
          <button
            onClick={() => onToggleExpand(family.id)}
            className="text-zinc-400 hover:text-white transition-colors"
          >
            {family.expanded ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </button>
          <div>
            <span className="font-bold text-white text-base">{family.name}</span>
            {family.loadingStock ? (
              <span className="text-xs text-zinc-500 ml-2">Carregando preço...</span>
            ) : (
              <span className="text-xs text-emerald-400 ml-2 font-semibold">
                {formatCurrency(family.underlyingPrice)}
              </span>
            )}
          </div>
          <span className="text-xs text-zinc-500">
            {family.tickers.length} tickers
          </span>
          {bestResult && (
            <span className="hidden md:flex items-center gap-1 text-xs bg-emerald-950 border border-emerald-800 text-emerald-400 px-2 py-0.5 rounded-full">
              <Star className="w-3 h-3 text-yellow-400" />
              Melhor: {bestResult.symbol} · {formatPercent(bestResult.annualReturn)} a.a.
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Upload arquivo */}
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
            title="Upload CSV/TXT de tickers"
            className="flex items-center gap-1 px-2 py-1 text-xs bg-zinc-700 hover:bg-zinc-600 rounded transition-colors"
          >
            <Upload className="w-3 h-3" /> Upload
          </button>

          {/* Colar tickers */}
          <button
            onClick={() => setShowPaste(!showPaste)}
            title="Colar tickers (Ctrl+C / Ctrl+V)"
            className="flex items-center gap-1 px-2 py-1 text-xs bg-zinc-700 hover:bg-zinc-600 rounded transition-colors"
          >
            <Copy className="w-3 h-3" /> Colar
          </button>

          {/* Remover família */}
          <button
            onClick={() => onRemoveFamily(family.id)}
            className="text-zinc-600 hover:text-red-400 transition-colors ml-1"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Área de colar tickers */}
      {showPaste && (
        <div className="px-4 py-3 border-b border-zinc-700/50 bg-zinc-950/50">
          <p className="text-xs text-zinc-500 mb-2">
            Cole os tickers abaixo (separados por vírgula, espaço, enter ou tab):
          </p>
          <div className="flex gap-2">
            <textarea
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              onPaste={handlePasteEvent}
              placeholder="PETRK350, PETRK380, PETRL320..."
              rows={3}
              className="flex-1 bg-zinc-900 border border-zinc-700 rounded px-3 py-2 text-xs font-mono focus:outline-none focus:border-emerald-500 resize-none"
            />
            <div className="flex flex-col gap-2">
              <button
                onClick={handlePaste}
                className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 rounded text-xs font-bold transition-colors"
              >
                Adicionar
              </button>
              <button
                onClick={() => {
                  setPasteText("");
                  setShowPaste(false);
                }}
                className="px-3 py-1 bg-zinc-700 hover:bg-zinc-600 rounded text-xs transition-colors"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tabela de tickers */}
      {family.expanded && (
        <div className="overflow-x-auto">
          {family.tickers.length === 0 ? (
            <div className="px-6 py-6 text-center text-zinc-600 text-sm">
              Nenhum ticker adicionado. Use "Colar" ou "Upload" acima.
            </div>
          ) : (
            <table className="w-full text-xs">
              <thead>
                <tr className="text-zinc-500 border-b border-zinc-800 bg-zinc-900/50">
                  <th className="text-left px-4 py-2">Ticker</th>
                  <th className="text-left px-2 py-2">Tipo</th>
                  <th className="text-right px-2 py-2">Strike</th>
                  <th className="text-right px-2 py-2">Último</th>
                  <th className="text-right px-2 py-2">Bid</th>
                  <th className="text-right px-2 py-2">Ask</th>
                  <th className="text-right px-2 py-2">Volume</th>
                  <th className="text-right px-2 py-2">Retorno Box</th>
                  <th className="text-right px-2 py-2">Ret. Anual.</th>
                  <th className="text-right px-2 py-2">Breakeven</th>
                  <th className="text-center px-2 py-2">Status</th>
                  <th className="px-2 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {family.tickers.map((ticker) => {
                  const result = family.underlyingPrice
                    ? calculateBoxReturn(ticker, family.underlyingPrice, selectedPeriod)
                    : null;

                  const isBest =
                    bestResult?.tickerId === ticker.id && boxResults.length > 1;

                  return (
                    <tr
                      key={ticker.id}
                      className={`border-b border-zinc-800/30 hover:bg-zinc-800/20 transition-colors ${
                        isBest ? "bg-emerald-950/20" : ""
                      }`}
                    >
                      <td className="px-4 py-2 font-bold text-white flex items-center gap-1">
                        {isBest && <Star className="w-3 h-3 text-yellow-400 flex-shrink-0" />}
                        {ticker.symbol}
                      </td>
                      <td className="px-2 py-2">
                        <span
                          className={`px-1.5 py-0.5 rounded text-xs font-bold ${
                            ticker.type === "CALL"
                              ? "bg-blue-900/40 text-blue-300"
                              : "bg-red-900/40 text-red-300"
                          }`}
                        >
                          {ticker.type}
                        </span>
                      </td>
                      <td className="px-2 py-2 text-right">
                        {formatCurrency(ticker.strike)}
                      </td>

                      {ticker.loading ? (
                        <td colSpan={7} className="px-2 py-2 text-center text-zinc-600">
                          <span className="inline-flex items-center gap-1">
                            <RefreshCw className="w-3 h-3 animate-spin" /> Buscando...
                          </span>
                        </td>
                      ) : ticker.error ? (
                        <td colSpan={7} className="px-2 py-2 text-center text-red-500">
                          <span className="inline-flex items-center gap-1">
                            <AlertCircle className="w-3 h-3" /> {ticker.error}
                          </span>
                        </td>
                      ) : (
                        <>
                          <td className="px-2 py-2 text-right text-yellow-400">
                            {formatCurrency(ticker.lastPrice)}
                          </td>
                          <td className="px-2 py-2 text-right text-zinc-400">
                            {formatCurrency(ticker.bidPrice)}
                          </td>
                          <td className="px-2 py-2 text-right text-zinc-400">
                            {formatCurrency(ticker.askPrice)}
                          </td>
                          <td className="px-2 py-2 text-right text-zinc-500">
                            {ticker.volume?.toLocaleString("pt-BR") ?? "—"}
                          </td>
                          <td className="px-2 py-2 text-right">
                            {result ? (
                              <span
                                className={
                                  result.isProfit ? "text-emerald-400" : "text-red-400"
                                }
                              >
                                {formatPercent(result.boxReturn)}
                              </span>
                            ) : (
                              "—"
                            )}
                          </td>
                          <td className="px-2 py-2 text-right font-bold">
                            {result ? (
                              <span
                                className={
                                  result.isProfit ? "text-emerald-300" : "text-red-400"
                                }
                              >
                                {formatPercent(result.annualReturn)}
                              </span>
                            ) : (
                              "—"
                            )}
                          </td>
                          <td className="px-2 py-2 text-right text-zinc-400">
                            {result ? formatCurrency(result.breakeven) : "—"}
                          </td>
                          <td className="px-2 py-2 text-center">
                            {result ? (
                              result.isProfit ? (
                                <TrendingUp className="w-3.5 h-3.5 text-emerald-400 mx-auto" />
                              ) : (
                                <TrendingDown className="w-3.5 h-3.5 text-red-400 mx-auto" />
                              )
                            ) : null}
                          </td>
                        </>
                      )}

                      <td className="px-2 py-2">
                        <button
                          onClick={() => onRemoveTicker(family.id, ticker.id)}
                          className="text-zinc-700 hover:text-red-400 transition-colors"
                        >
                          <X className="w-3.5 h-3.5" />
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
