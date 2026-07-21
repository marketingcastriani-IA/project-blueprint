// ============================================================
// RASTREADOR DE COLLAR — Tempo Real via Profit RTD Bridge
// Dois modelos ZERO RISCO:
//
// 1. Collar de Alta: Comprar Ação + Comprar Put + Vender Call
//    Condição: K_put + (P_call - P_put) >= S_0
//    Lucro Máx = K_call - S_0 + (P_call - P_put)
//    Perda Máx = K_put - S_0 + (P_call - P_put)  (>= 0 se risk-free)
//
// 2. Collar de Baixa (Inverso): Vender Ação + Comprar Call + Vender Put
//    Condição: S_0 + (P_put - P_call) >= K_call
//    Lucro Máx (queda) = S_0 - K_put + (P_put - P_call)
//    Perda Máx (alta)  = S_0 - K_call + (P_put - P_call)  (>= 0 se risk-free)
// ============================================================

import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import {
  Plus, Trash2, Upload, RefreshCw, ChevronDown, ChevronUp, Star,
  ClipboardPaste, X, Shield, ShieldCheck, Trophy, Wifi, WifiOff, AlertTriangle,
  TrendingUp, TrendingDown, Minus, Pencil, Save,
  ToggleLeft, ToggleRight, BarChart3, Bell, BellOff, Volume2, VolumeX,
  Smartphone, Monitor, Zap, Download, Info, Database,
} from "lucide-react";
import { useSharedRtdBridge } from "@/contexts/RtdBridgeContext";
import { statusConfig } from "@/hooks/useRtdBridge";
import { useB3Options } from "@/contexts/B3OptionsContext";
import { useToast } from "@/hooks/use-toast";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";
import { countBusinessDays } from "@/lib/b3-calendar";
import {
  ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid,
  ReferenceLine, ResponsiveContainer, Tooltip, ReferenceDot,
} from "recharts";
import trophyGold from "@/assets/trophy-gold.png";
import trophySilver from "@/assets/trophy-silver.png";
import trophyBronze from "@/assets/trophy-bronze.png";

// ─── TIPOS ───────────────────────────────────────────────────
type CollarTipo = "Alta" | "Baixa";
type RankingMethod = "lucro" | "score" | "netcost";

interface OptionTicker {
  id: string;
  symbol: string;
  type: "CALL" | "PUT";
  strike: number;
}

interface CollarResult {
  tipo: CollarTipo;
  callSymbol: string | null;
  putSymbol: string | null;
  callStrike: number;
  putStrike: number;
  callStrikeRtd: number | null;
  putStrikeRtd: number | null;
  callBid: number | null;
  callAsk: number | null;
  putBid: number | null;
  putAsk: number | null;
  stockAsk: number | null;
  stockBid: number | null;
  stockUlt: number | null;
  // Core metrics
  netCostCredit: number | null;
  maxProfitPct: number | null;
  maxLossPct: number | null;
  breakeven: number | null;
  maxProfitAbs: number | null;
  maxLossAbs: number | null;
  // Time & CDI
  vencimento: string | null;
  diasUteis: number | null;
  cdiPeriodo: number | null;
  // CDI comparison
  diffCdiProfit: number | null;
  // Scores
  qualityScore: number;
  isRiskFree: boolean;
  riskFreeMargin: number | null; // quanto sobra acima de zero risco
}

interface StockFamily {
  id: string;
  name: string;
  tickers: OptionTicker[];
  expanded: boolean;
  quantidade: number;
}

interface SavedFamily {
  name: string;
  tickers: string[];
  autoImported?: string[];
  quantidade?: number;
}

interface AlertEntry {
  id: string;
  time: string;
  familyName: string;
  qualityScore: number;
  tipo: CollarTipo;
  maxProfit: number;
}

// ─── CONSTANTES ──────────────────────────────────────────────
const STORAGE_KEY = "collar-tracker-families";
const CDI_ANUAL_DEFAULT = 14.65;
const IR_CDI = 0.225; // 22,5%
const IR_COLLAR = 0.15; // 15%
const IR_ENABLED_KEY = "collar-tracker-ir-enabled";
const CDI_STORAGE_KEY = "collar-tracker-cdi-anual";
const NOTIF_ENABLED_KEY = "collar-tracker-notif-enabled";
const NOTIF_THRESHOLD_KEY = "collar-tracker-notif-threshold";
const NOTIF_THRESHOLD_DEFAULT = 70;
const NOTIF_THRESHOLD_URGENT_KEY = "collar-tracker-notif-threshold-urgent";
const NOTIF_THRESHOLD_URGENT_DEFAULT = 85;
const NOTIF_COOLDOWN_MS = 30_000;
const NOTIF_SOUND_ENABLED_KEY = "collar-tracker-notif-sound";
const ALERT_HISTORY_KEY = "collar-tracker-alert-history";

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
  // Calendário da B3 (exclui feriados fixos + móveis), não só seg-sex
  return countBusinessDays(hoje, target);
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
  const match = clean.match(/[A-X](\d+)$/);
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
  const match = clean.match(/([A-X])\d+$/);
  if (match) {
    const code = match[1].charCodeAt(0) - 65;
    return code <= 11 ? "CALL" : "PUT";
  }
  return "CALL";
}

// ─── PAYOFF DATA GENERATION ──────────────────────────────────
interface CollarPayoffPoint {
  price: number;
  payoffExpiry: number;
  payoffToday: number;
}

function generateCollarPayoffAlta(
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
  const v = 0.35;
  const T = diasUteis && diasUteis > 0 ? diasUteis / 252 : 0;

  const points: CollarPayoffPoint[] = [];
  for (let i = 0; i <= numPoints; i++) {
    const ST = start + step * i;
    // Alta: Compra ação + Compra Put + Vende Call
    const payoffExpiry = (ST - S0) + Math.max(Kput - ST, 0) - Math.max(ST - Kcall, 0) + (Pcall - Pput);

    let payoffToday = payoffExpiry;
    if (T > 0.001) {
      const Ncdf = (x: number) => {
        const t = 1 / (1 + 0.2316419 * Math.abs(x));
        const d = 0.3989423 * Math.exp(-x * x / 2);
        const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.7814779 + t * (-1.821256 + t * 1.3302744))));
        return x > 0 ? 1 - p : p;
      };
      const d1c = (Math.log(ST / Kcall) + (r + v * v / 2) * T) / (v * Math.sqrt(T));
      const d2c = d1c - v * Math.sqrt(T);
      const d1p = (Math.log(ST / Kput) + (r + v * v / 2) * T) / (v * Math.sqrt(T));
      const d2p = d1p - v * Math.sqrt(T);
      const callVal = ST * Ncdf(d1c) - Kcall * Math.exp(-r * T) * Ncdf(d2c);
      const putVal = Kput * Math.exp(-r * T) * Ncdf(-d2p) - ST * Ncdf(-d1p);
      payoffToday = (ST - S0) + (putVal - Pput) - (callVal - Pcall);
    }
    points.push({ price: Math.round(ST * 100) / 100, payoffExpiry: Math.round(payoffExpiry * 100) / 100, payoffToday: Math.round(payoffToday * 100) / 100 });
  }
  return points;
}

function generateCollarPayoffBaixa(
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
  const v = 0.35;
  const T = diasUteis && diasUteis > 0 ? diasUteis / 252 : 0;

  const points: CollarPayoffPoint[] = [];
  for (let i = 0; i <= numPoints; i++) {
    const ST = start + step * i;
    // Baixa: Vende ação + Compra Call + Vende Put
    const payoffExpiry = (S0 - ST) - Math.max(Kput - ST, 0) + Math.max(ST - Kcall, 0) + (Pput - Pcall);

    let payoffToday = payoffExpiry;
    if (T > 0.001) {
      const Ncdf = (x: number) => {
        const t = 1 / (1 + 0.2316419 * Math.abs(x));
        const d = 0.3989423 * Math.exp(-x * x / 2);
        const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.7814779 + t * (-1.821256 + t * 1.3302744))));
        return x > 0 ? 1 - p : p;
      };
      const d1c = (Math.log(ST / Kcall) + (r + v * v / 2) * T) / (v * Math.sqrt(T));
      const d2c = d1c - v * Math.sqrt(T);
      const d1p = (Math.log(ST / Kput) + (r + v * v / 2) * T) / (v * Math.sqrt(T));
      const d2p = d1p - v * Math.sqrt(T);
      const callVal = ST * Ncdf(d1c) - Kcall * Math.exp(-r * T) * Ncdf(d2c);
      const putVal = Kput * Math.exp(-r * T) * Ncdf(-d2p) - ST * Ncdf(-d1p);
      payoffToday = (S0 - ST) - (putVal - Pput) + (callVal - Pcall);
    }
    points.push({ price: Math.round(ST * 100) / 100, payoffExpiry: Math.round(payoffExpiry * 100) / 100, payoffToday: Math.round(payoffToday * 100) / 100 });
  }
  return points;
}

// ─── PAYOFF CHART TOOLTIP ────────────────────────────────────
const CollarChartTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border bg-card/95 p-3 shadow-xl backdrop-blur-sm">
      <div className="mb-2 border-b border-border/50 pb-1">
        <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Preço do Ativo</p>
        <p className="text-sm font-bold font-mono">R$ {Number(label).toFixed(2)}</p>
      </div>
      <div className="space-y-1.5">
        {payload.map((p: any, i: number) => {
          if (p.dataKey === "belowZero" || p.dataKey === "aboveZero") return null;
          return (
            <div key={i} className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full" style={{ backgroundColor: p.color }} />
                <span className="text-xs font-bold text-foreground/80">{p.name}</span>
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

// ─── TIPO BADGE CONFIG ───────────────────────────────────────
const TIPO_CONFIG: Record<CollarTipo, { label: string; emoji: string; desc: string; descLong: string; bgClass: string; textClass: string }> = {
  "Alta": {
    label: "Collar de Alta",
    emoji: "🟢",
    desc: "Compra Ação + Compra Put + Vende Call",
    descLong: "Garante que não perde se cair. Lucra até o Strike da Call se subir.",
    bgClass: "bg-emerald-100 dark:bg-emerald-900/40",
    textClass: "text-emerald-700 dark:text-emerald-300",
  },
  "Baixa": {
    label: "Collar de Baixa",
    emoji: "🔴",
    desc: "Vende Ação + Compra Call + Vende Put",
    descLong: "Garante que não perde se subir. Lucra com a queda até o Strike da Put.",
    bgClass: "bg-red-100 dark:bg-red-900/40",
    textClass: "text-red-700 dark:text-red-300",
  },
};

// ─── COMPONENTE PRINCIPAL ─────────────────────────────────────
export default function CollarTrackerTab() {
  const { getStrikeAndExpiry } = useB3Options();
  const { toast } = useToast();

  const [families, setFamilies] = useState<StockFamily[]>([]);
  const [newFamilyName, setNewFamilyName] = useState("");
  const [filterTipo, setFilterTipo] = useState<CollarTipo | "Todos">("Todos");
  const [rankingMethod, setRankingMethod] = useState<RankingMethod>("lucro");
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [autoImportedMap, setAutoImportedMap] = useState<Map<string, Set<string>>>(new Map());
  const [cdiAnual, setCdiAnual] = useState<number>(() => {
    try {
      const saved = localStorage.getItem(CDI_STORAGE_KEY);
      return saved ? parseFloat(saved) : CDI_ANUAL_DEFAULT;
    } catch { return CDI_ANUAL_DEFAULT; }
  });
  const [editingCdi, setEditingCdi] = useState(false);
  const [cdiInput, setCdiInput] = useState(String(cdiAnual).replace(".", ","));

  const [descontarIR, setDescontarIR] = useState<boolean>(() => {
    try { return localStorage.getItem(IR_ENABLED_KEY) === "true"; } catch { return false; }
  });
  const [notifEnabled, setNotifEnabled] = useState<boolean>(() => {
    try { return localStorage.getItem(NOTIF_ENABLED_KEY) === "true"; } catch { return false; }
  });
  const [notifThreshold, setNotifThreshold] = useState<number>(() => {
    try {
      const saved = localStorage.getItem(NOTIF_THRESHOLD_KEY);
      return saved ? parseFloat(saved) : NOTIF_THRESHOLD_DEFAULT;
    } catch { return NOTIF_THRESHOLD_DEFAULT; }
  });
  const [notifThresholdUrgent, setNotifThresholdUrgent] = useState<number>(() => {
    try {
      const saved = localStorage.getItem(NOTIF_THRESHOLD_URGENT_KEY);
      return saved ? parseFloat(saved) : NOTIF_THRESHOLD_URGENT_DEFAULT;
    } catch { return NOTIF_THRESHOLD_URGENT_DEFAULT; }
  });
  const [soundEnabled, setSoundEnabled] = useState<boolean>(() => {
    try { return localStorage.getItem(NOTIF_SOUND_ENABLED_KEY) !== "false"; } catch { return true; }
  });
  const lastNotifRef = useRef<number>(0);
  const notifPermissionRef = useRef<NotificationPermission>("default");
  const [alertHistory, setAlertHistory] = useState<AlertEntry[]>(() => {
    try {
      const saved = localStorage.getItem(ALERT_HISTORY_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });
  const [showAlertHistory, setShowAlertHistory] = useState(false);

  const [showInstructions, setShowInstructions] = useState(() => {
    try { return localStorage.getItem("collar-tracker-instructions-dismissed") !== "true"; } catch { return true; }
  });
  const dismissInstructions = () => {
    setShowInstructions(false);
    localStorage.setItem("collar-tracker-instructions-dismissed", "true");
  };

  const { status, rows, connect, addTicker: bridgeAddTicker } = useSharedRtdBridge();

  const postToSW = useCallback(async (message: object) => {
    if (!('serviceWorker' in navigator)) return false;
    if (navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage(message);
      return true;
    }
    try {
      const reg = await navigator.serviceWorker.ready;
      if (reg.active) { reg.active.postMessage(message); return true; }
    } catch {}
    return false;
  }, []);

  const sendPushNotification = useCallback(async (title: string, body: string, data?: any) => {
    const tag = data?.priority === 'urgent' ? 'collar-tracker-urgent' : 'collar-tracker-alert';
    const sent = await postToSW({ type: 'BOX_ALERT', title, body, tag, data });
    if (sent) return;
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(title, { body, icon: '/favicon.png', tag });
    }
  }, [postToSW]);

  const toggleNotifications = useCallback(async () => {
    if (notifEnabled) {
      setNotifEnabled(false);
      localStorage.setItem(NOTIF_ENABLED_KEY, "false");
      return;
    }
    if (!("Notification" in window)) {
      alert("Seu navegador não suporta notificações push.");
      return;
    }
    const permission = await Notification.requestPermission();
    notifPermissionRef.current = permission;
    if (permission === "granted") {
      setNotifEnabled(true);
      localStorage.setItem(NOTIF_ENABLED_KEY, "true");
      await postToSW({
        type: 'BOX_ALERT',
        title: '🔔 Alertas Collar Ativados!',
        body: `✅ Score ≥ ${notifThreshold} para alertas.`,
        tag: 'collar-tracker-test',
      });
    } else {
      alert("Permissão de notificação negada.");
    }
  }, [notifEnabled, notifThreshold, postToSW]);

  const sendTestAlert = useCallback(async () => {
    const isIframe = window.self !== window.top;
    if (isIframe) {
      toast({ title: "⚠️ Preview não suporta Push", description: "Abra o site publicado ou instale o PWA.", variant: "destructive" });
      return;
    }
    if (!("Notification" in window)) {
      toast({ title: "❌ Navegador incompatível", variant: "destructive" });
      return;
    }
    let perm = Notification.permission;
    if (perm === "default") perm = await Notification.requestPermission();
    if (perm !== "granted") {
      toast({ title: "❌ Permissão negada", variant: "destructive" });
      return;
    }
    await sendPushNotification(
      '🧪 Teste de Alerta Collar',
      `📊 Alerta teste — ${new Date().toLocaleTimeString('pt-BR')}`,
      { url: '/collar-tracker', priority: 'normal', sound: soundEnabled }
    );
    toast({ title: "✅ Alerta teste enviado!" });
  }, [sendPushNotification, soundEnabled, toast]);

  // Load families
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed: SavedFamily[] = JSON.parse(saved);
        const loaded: StockFamily[] = parsed.map((sf) => ({
          id: generateId(),
          name: sf.name,
          quantidade: sf.quantidade ?? 100,
          tickers: sf.tickers.map((sym) => {
            const b3Info = getStrikeAndExpiry(sym);
            return {
              id: generateId(),
              symbol: sym.toUpperCase(),
              type: b3Info?.tipo ?? extractTypeFromTicker(sym),
              strike: (b3Info && b3Info.strike > 0) ? b3Info.strike : extractStrikeFromTicker(sym),
            };
          }),
          expanded: true,
        }));
        setFamilies(loaded);
        const autoMap = new Map<string, Set<string>>();
        parsed.forEach((sf) => {
          if (sf.autoImported && sf.autoImported.length > 0) {
            autoMap.set(sf.name, new Set(sf.autoImported));
          }
        });
        setAutoImportedMap(autoMap);
      }
    } catch {}
  }, []);

  // Save families
  useEffect(() => {
    const toSave: SavedFamily[] = families.map((f) => ({
      name: f.name,
      tickers: f.tickers.map((t) => t.symbol),
      autoImported: Array.from(autoImportedMap.get(f.name) || []),
      quantidade: f.quantidade,
    }));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
  }, [families, autoImportedMap]);

  const familyStockTickers = useCallback((familyName: string): string => {
    const candidates = [`${familyName}4`, `${familyName}3`, `${familyName}11`];
    for (const c of candidates) {
      if (rows.has(c)) return c;
    }
    return `${familyName}4`;
  }, [rows]);

  // Auto-subscribe
  useEffect(() => {
    if (status !== "connected") return;
    families.forEach((f) => {
      const stockTicker = familyStockTickers(f.name);
      bridgeAddTicker(stockTicker);
      const altSuffixes = ["3", "4", "11"];
      altSuffixes.forEach((s) => bridgeAddTicker(`${f.name}${s}`));
      f.tickers.forEach((t) => bridgeAddTicker(t.symbol));
    });
  }, [status, families, bridgeAddTicker, familyStockTickers]);

  const addFamily = useCallback(() => {
    const name = newFamilyName.trim().toUpperCase();
    if (!name) return;
    if (families.find((f) => f.name === name)) return;
    setFamilies((prev) => [...prev, { id: generateId(), name, tickers: [], expanded: true, quantidade: 100 }]);
    setNewFamilyName("");
    if (status === "connected") bridgeAddTicker(name);
  }, [newFamilyName, families, status, bridgeAddTicker]);

  const removeFamily = useCallback((familyId: string) => {
    setFamilies((prev) => prev.filter((f) => f.id !== familyId));
    setSelectedKey(null);
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
        .filter((s) => s.length >= 5 && /^[A-Z]{3,6}\d{0,2}[A-X]\d+$/.test(s));
      if (!symbols.length) return;
      const newTickers: OptionTicker[] = symbols.map((symbol) => {
        const b3Info = getStrikeAndExpiry(symbol);
        return {
          id: generateId(), symbol,
          type: b3Info?.tipo ?? extractTypeFromTicker(symbol),
          strike: (b3Info && b3Info.strike > 0) ? b3Info.strike : extractStrikeFromTicker(symbol),
        };
      });
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
    [status, bridgeAddTicker, getStrikeAndExpiry]
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
    setSelectedKey(null);
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
      const stockTicker = familyStockTickers(family.name);
      let stockRow = rows.get(stockTicker);
      if (!stockRow || (!stockRow.ofCompra && !stockRow.ofVenda && !stockRow.ultimo)) {
        for (const s of ["4", "3", "11"]) {
          const candidate = rows.get(`${family.name}${s}`);
          if (candidate && (candidate.ofCompra || candidate.ofVenda || candidate.ultimo)) {
            stockRow = candidate;
            break;
          }
        }
      }
      const stockAsk = getPrice(stockRow, "ofVenda");
      const stockBid = getPrice(stockRow, "ofCompra");
      const stockUlt = stockRow?.ultimo ?? null;

      const calls = family.tickers.filter((t) => t.type === "CALL");
      const puts = family.tickers.filter((t) => t.type === "PUT");

      const results: CollarResult[] = [];

      for (const call of calls) {
        for (const put of puts) {
          const callRow = rows.get(call.symbol);
          const putRow = rows.get(put.symbol);

          const callBid = getPrice(callRow, "ofCompra");
          const callAsk = getPrice(callRow, "ofVenda");
          const putBid = getPrice(putRow, "ofCompra");
          const putAsk = getPrice(putRow, "ofVenda");

          const callStrikeRtd = (callRow?.strike && callRow.strike > 0) ? callRow.strike : null;
          const putStrikeRtd = (putRow?.strike && putRow.strike > 0) ? putRow.strike : null;

          const b3CallInfo = getStrikeAndExpiry(call.symbol);
          const b3PutInfo = getStrikeAndExpiry(put.symbol);
          const callStrike = callStrikeRtd ?? ((b3CallInfo && b3CallInfo.strike > 0) ? b3CallInfo.strike : call.strike);
          const putStrike = putStrikeRtd ?? ((b3PutInfo && b3PutInfo.strike > 0) ? b3PutInfo.strike : put.strike);

          // Vencimento from tickers (no manual date)
          const vencRtd = callRow?.ven ?? putRow?.ven ?? null;
          const b3Venc = b3CallInfo?.vencimento ?? b3PutInfo?.vencimento ?? null;
          const vencimento = vencRtd || b3Venc || null;
          const diasUteis = calcDiasUteis(vencimento);
          const cdiPeriodo = diasUteis !== null && diasUteis > 0 ? calcCdiPeriodo(diasUteis, cdiAnual) : null;

          // Skip invalid: Call strike must be > Put strike
          if (callStrike <= putStrike) continue;

          // ═══ COLLAR DE ALTA ═══
          // Compra Ação (S0=stockAsk) + Compra Put (paga putAsk) + Vende Call (recebe callBid)
          if (stockAsk !== null && callBid !== null && putAsk !== null && stockAsk > 0) {
            const S0 = stockAsk;
            const Pcall = callBid;
            const Pput = putAsk;
            const net = Pcall - Pput; // positive = credit

            // Condição Risco Zero: K_put + net >= S_0
            const riskFreeMargin = putStrike + net - S0;
            const isRiskFree = riskFreeMargin >= -0.01;

            // Lucro Máx (alta) = K_call - S0 + net
            const maxProfitAbs = callStrike - S0 + net;
            const maxProfitPct = (maxProfitAbs / S0) * 100;

            // Perda Máx (baixa) = K_put - S0 + net (>= 0 se risk-free)
            const maxLossAbs = putStrike - S0 + net;
            const maxLossPct = (maxLossAbs / S0) * 100;

            // Break-even = S0 - net
            const breakeven = S0 - net;

            const diffCdiProfit = cdiPeriodo !== null ? maxProfitPct - cdiPeriodo : null;

            // Qualidade
            let qualityScore = 0;
            if (isRiskFree) {
              // Base 50 for being risk-free
              qualityScore = 50;
              // +30 for profit potential
              qualityScore += Math.min(30, maxProfitPct * 5);
              // +10 for risk-free margin
              qualityScore += Math.min(10, (riskFreeMargin / S0) * 100 * 5);
              // +10 for CDI beat
              if (diffCdiProfit !== null && diffCdiProfit > 0) {
                qualityScore += Math.min(10, diffCdiProfit * 2);
              }
            }
            qualityScore = Math.max(0, Math.min(100, Math.round(qualityScore)));

            if (isRiskFree) {
              results.push({
                tipo: "Alta",
                callSymbol: call.symbol, putSymbol: put.symbol,
                callStrike, putStrike,
                callStrikeRtd, putStrikeRtd,
                callBid, callAsk, putBid, putAsk,
                stockAsk, stockBid, stockUlt,
                netCostCredit: net, maxProfitPct, maxLossPct, breakeven,
                maxProfitAbs, maxLossAbs,
                vencimento, diasUteis, cdiPeriodo,
                diffCdiProfit,
                qualityScore, isRiskFree, riskFreeMargin,
              });
            }
          }

          // ═══ COLLAR DE BAIXA (INVERSO) ═══
          // Vende Ação (S0=stockBid) + Compra Call (paga callAsk) + Vende Put (recebe putBid)
          if (stockBid !== null && callAsk !== null && putBid !== null && stockBid > 0) {
            const S0 = stockBid;
            const Pcall = callAsk;
            const Pput = putBid;
            const net = Pput - Pcall; // positive = credit

            // Condição Risco Zero: S0 + net >= K_call
            const riskFreeMargin = S0 + net - callStrike;
            const isRiskFree = riskFreeMargin >= -0.01;

            // Lucro Máx (queda) = S0 - K_put + net
            const maxProfitAbs = S0 - putStrike + net;
            const maxProfitPct = (maxProfitAbs / S0) * 100;

            // Perda Máx (alta) = S0 - K_call + net (>= 0 se risk-free)
            const maxLossAbs = S0 - callStrike + net;
            const maxLossPct = (maxLossAbs / S0) * 100;

            // Break-even = S0 + net
            const breakeven = S0 + net;

            const diffCdiProfit = cdiPeriodo !== null ? maxProfitPct - cdiPeriodo : null;

            let qualityScore = 0;
            if (isRiskFree) {
              qualityScore = 50;
              qualityScore += Math.min(30, maxProfitPct * 5);
              qualityScore += Math.min(10, (riskFreeMargin / S0) * 100 * 5);
              if (diffCdiProfit !== null && diffCdiProfit > 0) {
                qualityScore += Math.min(10, diffCdiProfit * 2);
              }
            }
            qualityScore = Math.max(0, Math.min(100, Math.round(qualityScore)));

            if (isRiskFree) {
              results.push({
                tipo: "Baixa",
                callSymbol: call.symbol, putSymbol: put.symbol,
                callStrike, putStrike,
                callStrikeRtd, putStrikeRtd,
                callBid, callAsk, putBid, putAsk,
                stockAsk, stockBid, stockUlt,
                netCostCredit: net, maxProfitPct, maxLossPct, breakeven,
                maxProfitAbs, maxLossAbs,
                vencimento, diasUteis, cdiPeriodo,
                diffCdiProfit,
                qualityScore, isRiskFree, riskFreeMargin,
              });
            }
          }
        }
      }

      // Sort based on ranking method
      results.sort((a, b) => {
        switch (rankingMethod) {
          case "lucro":
            return (b.maxProfitPct ?? -999) - (a.maxProfitPct ?? -999);
          case "netcost":
            return (b.netCostCredit ?? -999) - (a.netCostCredit ?? -999);
          case "score":
          default:
            return b.qualityScore - a.qualityScore;
        }
      });
      return results;
    },
    [rows, cdiAnual, getStrikeAndExpiry, familyStockTickers, rankingMethod]
  );

  // Global best — one per ranking method
  const topCollars = useMemo(() => {
    // Collect all valid collars across families
    const allValid: (CollarResult & { familyName: string })[] = [];
    families.forEach((f) => {
      if (f.tickers.length === 0) return;
      const collars = calculateCollars(f);
      collars.forEach((c) => {
        if (c.maxProfitPct !== null) allValid.push({ ...c, familyName: f.name });
      });
    });
    if (allValid.length === 0) return [];

    const methods: { key: RankingMethod; label: string; sort: (a: CollarResult, b: CollarResult) => number }[] = [
      { key: "lucro", label: "Maior Lucro", sort: (a, b) => (b.maxProfitPct ?? -999) - (a.maxProfitPct ?? -999) },
      { key: "score", label: "Qualidade", sort: (a, b) => b.qualityScore - a.qualityScore },
      { key: "netcost", label: "Crédito Líquido", sort: (a, b) => (b.netCostCredit ?? -999) - (a.netCostCredit ?? -999) },
    ];

    const result: (CollarResult & { familyName: string; rankLabel: string; rankKey: RankingMethod })[] = [];
    const usedKeys = new Set<string>();

    for (const m of methods) {
      const sorted = [...allValid].sort(m.sort);
      // Pick best that hasn't been used yet, or fallback to absolute best
      const pick = sorted.find((c) => !usedKeys.has(`${c.tipo}-${c.callSymbol}-${c.putSymbol}`)) ?? sorted[0];
      if (pick) {
        usedKeys.add(`${pick.tipo}-${pick.callSymbol}-${pick.putSymbol}`);
        result.push({ ...pick, rankLabel: m.label, rankKey: m.key });
      }
    }
    return result;
  }, [families, calculateCollars]);

  const topCollarsKey = topCollars.map(c => `${c.tipo}-${c.callSymbol}-${c.putSymbol}`).join(",");

  // Deriva o collar selecionado SEMPRE do dado fresco (não guarda snapshot).
  // Procura primeiro no topo (barato); só varre as famílias se a seleção veio
  // de uma tabela expandida — evita recalcular TODAS as famílias a cada tick.
  const selectedCollar = useMemo(() => {
    if (!selectedKey) return topCollars[0] ?? null;
    const inTop = topCollars.find(c => `${c.tipo}-${c.callSymbol}-${c.putSymbol}` === selectedKey);
    if (inTop) return inTop;
    for (const f of families) {
      const found = calculateCollars(f).find(c => `${c.tipo}-${c.callSymbol}-${c.putSymbol}` === selectedKey);
      if (found) return { ...found, familyName: (found as any).familyName ?? f.name };
    }
    return topCollars[0] ?? null;
  }, [selectedKey, topCollars, families, calculateCollars]);

  // Push alert trigger
  useEffect(() => {
    if (!notifEnabled || !("Notification" in window) || Notification.permission !== "granted") return;
    if (topCollars.length === 0) return;
    const now = Date.now();
    if (now - lastNotifRef.current < NOTIF_COOLDOWN_MS) return;
    const best = topCollars[0];
    if (best.qualityScore < notifThreshold) return;
    lastNotifRef.current = now;
    const isUrgent = best.qualityScore >= notifThresholdUrgent;

    const entry: AlertEntry = {
      id: generateId(),
      time: new Date().toLocaleString('pt-BR'),
      familyName: best.familyName,
      qualityScore: best.qualityScore,
      tipo: best.tipo,
      maxProfit: best.maxProfitPct ?? 0,
    };
    setAlertHistory(prev => {
      const updated = [entry, ...prev].slice(0, 50);
      localStorage.setItem(ALERT_HISTORY_KEY, JSON.stringify(updated));
      return updated;
    });

    sendPushNotification(
      isUrgent
        ? `🚨 COLLAR ${best.tipo.toUpperCase()} ${best.familyName} — Score ${best.qualityScore}!`
        : `🔔 Collar ${best.tipo} ${best.familyName} — Score ${best.qualityScore}`,
      `Lucro Máx: ${formatPercent(best.maxProfitPct)} · Net: ${formatBRL(best.netCostCredit)}`,
      { url: '/collar-tracker', priority: isUrgent ? 'urgent' : 'normal', sound: soundEnabled }
    );
  }, [topCollarsKey, topCollars[0]?.qualityScore, notifEnabled, notifThreshold, notifThresholdUrgent, soundEnabled, sendPushNotification]);

  // ─── CHART DATA ─────────────────────────────────────────────
  const payoffData = useMemo(() => {
    if (!selectedCollar || selectedCollar.stockAsk === null) return [];
    const S0 = selectedCollar.tipo === "Alta" ? selectedCollar.stockAsk! : selectedCollar.stockBid!;
    if (!S0) return [];
    const Pput = selectedCollar.tipo === "Alta" ? (selectedCollar.putAsk ?? 0) : (selectedCollar.putBid ?? 0);
    const Pcall = selectedCollar.tipo === "Alta" ? (selectedCollar.callBid ?? 0) : (selectedCollar.callAsk ?? 0);

    const rawPoints = selectedCollar.tipo === "Alta"
      ? generateCollarPayoffAlta(S0, selectedCollar.putStrike, selectedCollar.callStrike, Pput, Pcall, selectedCollar.diasUteis, cdiAnual)
      : generateCollarPayoffBaixa(S0, selectedCollar.putStrike, selectedCollar.callStrike, Pput, Pcall, selectedCollar.diasUteis, cdiAnual);

    // Add CDI reference line (flat profit from CDI for the period)
    const cdiPct = selectedCollar.cdiPeriodo ?? 0;
    const cdiProfitPerShare = S0 * (cdiPct / 100);
    const cdiProfitLiq = descontarIR ? cdiProfitPerShare * (1 - IR_CDI) : cdiProfitPerShare;

    return rawPoints.map((p) => ({
      ...p,
      cdiLine: Math.round(cdiProfitLiq * 100) / 100,
    }));
  }, [selectedCollar, cdiAnual, descontarIR]);

  const selectedBreakeven = selectedCollar?.breakeven ?? null;
  const connColor = statusConfig[status]?.color ?? "text-muted-foreground";

  // ─── RENDER ─────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="text-xl font-black tracking-tight text-foreground flex items-center gap-2">
            <Shield className="h-6 w-6 text-primary" /> Rastreador de Collar — Zero Risco
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Identifica collars com <span className="font-black text-success">RISCO ZERO</span> para operações de Alta e Baixa
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className={cn("flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full border", connColor)}>
            {status === "connected" ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
            {statusConfig[status]?.label ?? status}
          </span>
          {status !== "connected" && (
            <button onClick={connect}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-primary hover:bg-primary/90 text-primary-foreground rounded-full text-xs font-bold transition-all active:scale-[0.97]">
              <RefreshCw className="w-3 h-3" /> Conectar
            </button>
          )}
        </div>
      </div>

      {/* INSTRUCTIONS */}
      {showInstructions && (
        <div className="relative p-4 rounded-2xl border-2 border-primary/20 bg-primary/5 animate-fade-in">
          <button onClick={dismissInstructions}
            className="absolute top-3 right-3 p-1 rounded-full hover:bg-muted transition-colors text-muted-foreground">
            <X className="h-4 w-4" />
          </button>
          <div className="flex items-center gap-2 mb-3">
            <Info className="h-4 w-4 text-primary" />
            <span className="text-sm font-bold text-foreground">Tipos de Collar Zero Risco</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-3 rounded-xl border border-emerald-200 dark:border-emerald-800/50 bg-emerald-50/50 dark:bg-emerald-950/20">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-lg">🟢</span>
                <span className="text-sm font-black text-emerald-700 dark:text-emerald-300">Collar de Alta</span>
              </div>
              <p className="text-xs text-muted-foreground mb-2">
                <strong>Montagem:</strong> Compra Ação + Compra Put + Vende Call
              </p>
              <p className="text-xs text-muted-foreground mb-1">
                <strong>Condição Zero Risco:</strong> <code className="bg-muted px-1 py-0.5 rounded text-[10px]">K_put + (P_call − P_put) ≥ S₀</code>
              </p>
              <p className="text-xs text-muted-foreground">
                Se cair → exerce Put, recupera capital. Se subir → lucra até Strike da Call.
              </p>
            </div>
            <div className="p-3 rounded-xl border border-red-200 dark:border-red-800/50 bg-red-50/50 dark:bg-red-950/20">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-lg">🔴</span>
                <span className="text-sm font-black text-red-700 dark:text-red-300">Collar de Baixa (Inverso)</span>
              </div>
              <p className="text-xs text-muted-foreground mb-2">
                <strong>Montagem:</strong> Vende Ação + Compra Call + Vende Put
              </p>
              <p className="text-xs text-muted-foreground mb-1">
                <strong>Condição Zero Risco:</strong> <code className="bg-muted px-1 py-0.5 rounded text-[10px]">S₀ + (P_put − P_call) ≥ K_call</code>
              </p>
              <p className="text-xs text-muted-foreground">
                Se subir → perda travada na Call. Se cair → lucra até Strike da Put.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* TOP COLLARS CARDS */}
      {topCollars.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {topCollars.map((c, i) => {
            const tipoCfg = TIPO_CONFIG[c.tipo];
            const trophyImg = i === 0 ? trophyGold : i === 1 ? trophySilver : i === 2 ? trophyBronze : null;
            const isSelected = selectedCollar?.tipo === c.tipo && selectedCollar?.callSymbol === c.callSymbol && selectedCollar?.putSymbol === c.putSymbol;

            // CDI comparison calculations
            const fam = families.find(f => f.name === c.familyName);
            const qty = fam?.quantidade ?? 100;
            const S0 = c.tipo === "Alta" ? c.stockAsk! : c.stockBid!;
            const investTotal = S0 * qty;
            const lucroCollarAbs = (c.maxProfitAbs ?? 0) * qty;
            const collarPct = c.maxProfitPct ?? 0;

            // CDI do período
            const cdiPctBruto = c.cdiPeriodo ?? 0;
            const cdiRendBruto = investTotal * (cdiPctBruto / 100);

            // Com IR
            const collarPctLiq = descontarIR ? collarPct * (1 - IR_COLLAR) : collarPct;
            const collarRendLiq = descontarIR ? lucroCollarAbs * (1 - IR_COLLAR) : lucroCollarAbs;
            const cdiPctLiq = descontarIR ? cdiPctBruto * (1 - IR_CDI) : cdiPctBruto;
            const cdiRendLiq = descontarIR ? cdiRendBruto * (1 - IR_CDI) : cdiRendBruto;

            const diffPp = collarPctLiq - cdiPctLiq;
            const diffBrl = collarRendLiq - cdiRendLiq;
            const collarGanha = diffPp >= 0;

            return (
              <div key={`${c.tipo}-${c.callSymbol}-${c.putSymbol}`}
                onClick={() => setSelectedKey(`${c.tipo}-${c.callSymbol}-${c.putSymbol}`)}
                className={cn(
                  "relative cursor-pointer rounded-2xl border-2 p-4 transition-all hover:shadow-lg active:scale-[0.98]",
                  isSelected
                    ? "border-primary bg-primary/5 shadow-md ring-2 ring-primary/30"
                    : "border-border bg-card hover:border-primary/40"
                )}>
                {trophyImg && (
                  <img src={trophyImg} alt={`#${i + 1}`} className="absolute top-2 right-2 w-6 h-6" />
                )}
                <div className="flex items-center gap-2 mb-2">
                  <span className={cn("text-[9px] font-black px-2 py-0.5 rounded-full", tipoCfg.bgClass, tipoCfg.textClass)}>
                    {tipoCfg.emoji} {tipoCfg.label}
                  </span>
                  <ShieldCheck className="w-3.5 h-3.5 text-success" />
                  <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-foreground text-background">
                    {c.rankLabel}
                  </span>
                </div>
                <p className="text-lg font-black text-foreground">{c.familyName}</p>

                {/* Ticker details */}
                <div className="mt-1.5 space-y-1 text-xs font-mono" style={{ textRendering: 'geometricPrecision', WebkitFontSmoothing: 'antialiased' }}>
                  <div className="flex items-center gap-1.5">
                    <span className={cn("px-1 py-px rounded font-black", c.tipo === "Alta" ? "bg-success/20 text-success" : "bg-destructive/20 text-destructive")}>
                      {c.tipo === "Alta" ? "C" : "V"}
                    </span>
                    <span className="text-muted-foreground">Ação</span>
                    <span className="font-bold text-foreground">{familyStockTickers(c.familyName)}</span>
                    <span className="text-muted-foreground">@ {formatBRL(c.tipo === "Alta" ? c.stockAsk : c.stockBid)}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className={cn("px-1 py-px rounded font-black", c.tipo === "Alta" ? "bg-success/20 text-success" : "bg-destructive/20 text-destructive")}>
                      {c.tipo === "Alta" ? "C" : "V"}
                    </span>
                    <span className="text-muted-foreground">Put</span>
                    <span className="font-bold text-foreground">{c.putSymbol}</span>
                    <span className="text-muted-foreground">K {c.putStrike?.toFixed(2)}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className={cn("px-1 py-px rounded font-black", c.tipo === "Alta" ? "bg-destructive/20 text-destructive" : "bg-success/20 text-success")}>
                      {c.tipo === "Alta" ? "V" : "C"}
                    </span>
                    <span className="text-muted-foreground">Call</span>
                    <span className="font-bold text-foreground">{c.callSymbol}</span>
                    <span className="text-muted-foreground">K {c.callStrike?.toFixed(2)}</span>
                  </div>
                </div>

                <div className="mt-2 grid grid-cols-2 gap-2">
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase font-bold">Ganho Máx</p>
                    <p className="text-sm font-black text-success">{formatPercent(c.maxProfitPct)}</p>
                    <p className="text-[9px] font-mono text-success">{formatBRL((c.maxProfitAbs ?? 0) * qty)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase font-bold">Ganho Mín</p>
                    <p className={cn("text-sm font-black", (c.maxLossPct ?? 0) >= 0 ? "text-success" : "text-destructive")}>
                      {formatPercent(c.maxLossPct)}
                    </p>
                    <p className={cn("text-[9px] font-mono", (c.maxLossAbs ?? 0) >= 0 ? "text-success" : "text-destructive")}>
                      {formatBRL((c.maxLossAbs ?? 0) * qty)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase font-bold">
                      Collar {descontarIR ? "(Líq 15%)" : "(Bruto)"}
                    </p>
                    <p className="text-sm font-black text-success">{formatPercent(collarPctLiq)}</p>
                    <p className="text-[9px] font-mono text-success">{formatBRL(collarRendLiq)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase font-bold">
                      CDI {descontarIR ? "(Líq 22,5%)" : "(Bruto)"}
                    </p>
                    <p className="text-sm font-black text-warning">{formatPercent(cdiPctLiq)}</p>
                    <p className="text-[9px] font-mono text-warning">{formatBRL(cdiRendLiq)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase font-bold">Investimento</p>
                    <p className="text-sm font-black text-foreground">{formatBRL(investTotal)}</p>
                    <p className="text-[9px] font-mono text-muted-foreground">{qty} ações</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase font-bold">Collar vs CDI</p>
                    <p className={cn("text-sm font-black", collarGanha ? "text-success" : "text-destructive")}>
                      {collarGanha ? "+" : ""}{diffPp.toFixed(2).replace(".", ",")} pp
                    </p>
                    <p className={cn("text-[9px] font-mono", collarGanha ? "text-success" : "text-destructive")}>
                      {collarGanha ? "+" : ""}{formatBRL(diffBrl)}
                    </p>
                  </div>
                </div>

                {/* Winner badge */}
                <div className={cn(
                  "mt-3 text-center py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest",
                  collarGanha
                    ? "bg-success/10 text-success border border-success/20"
                    : "bg-destructive/10 text-destructive border border-destructive/20"
                )}>
                  {collarGanha ? "✅ COLLAR GANHA DO CDI" : "⚠️ CDI RENDE MAIS"}
                </div>

                {c.vencimento && (
                  <p className="text-[10px] text-muted-foreground mt-2">
                    Venc: <span className="font-bold text-foreground">{c.vencimento}</span>
                    {c.diasUteis !== null && <span> · {c.diasUteis}du</span>}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* SELECTED COLLAR DETAIL + CHART */}
      {selectedCollar && selectedCollar.stockAsk && (
        <div className="rounded-2xl border-2 border-primary/30 bg-card overflow-hidden shadow-lg">
          <div className="px-4 py-3 bg-muted/30 border-b border-border/50">
            <div className="flex items-center gap-3">
              <span className={cn("text-xs font-black px-2.5 py-1 rounded-full", TIPO_CONFIG[selectedCollar.tipo].bgClass, TIPO_CONFIG[selectedCollar.tipo].textClass)}>
                {TIPO_CONFIG[selectedCollar.tipo].emoji} {TIPO_CONFIG[selectedCollar.tipo].label}
              </span>
              <ShieldCheck className="w-4 h-4 text-success" />
              <span className="text-xs text-success font-black uppercase">Zero Risco</span>
              <span className="text-sm font-black text-foreground ml-auto">{selectedCollar.familyName}</span>
            </div>
          </div>

          {/* Metrics row */}
          {(() => {
            const selFamily = families.find(f => f.name === selectedCollar.familyName);
            const qty = selFamily?.quantidade ?? 100;
            const S0 = selectedCollar.tipo === "Alta" ? selectedCollar.stockAsk! : selectedCollar.stockBid!;
            const investTotal = S0 * qty;
            const lucroTotal = (selectedCollar.maxProfitAbs ?? 0) * qty;
            const perdaTotal = (selectedCollar.maxLossAbs ?? 0) * qty;
            return (
              <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-8 gap-4 p-4 border-b border-border/50 bg-muted/10">
                <div>
                  <p className="text-xs font-black uppercase text-muted-foreground">Investimento</p>
                  <p className="text-sm font-black text-foreground">{formatBRL(investTotal)}</p>
                  <p className="text-[10px] font-mono text-muted-foreground">{qty} × {formatBRL(S0)}</p>
                </div>
                <div>
                  <p className="text-xs font-black uppercase text-muted-foreground">Lucro Máximo</p>
                  <p className="text-sm font-black text-success">{formatPercent(selectedCollar.maxProfitPct)}</p>
                  <p className="text-[10px] font-mono text-success">{formatBRL(lucroTotal)}</p>
                </div>
                <div>
                  <p className="text-xs font-black uppercase text-muted-foreground">Perda Máxima</p>
                  <p className={cn("text-sm font-black", (selectedCollar.maxLossPct ?? 0) >= 0 ? "text-success" : "text-destructive")}>
                    {formatPercent(selectedCollar.maxLossPct)}
                  </p>
                  <p className={cn("text-[10px] font-mono", perdaTotal >= 0 ? "text-success" : "text-destructive")}>
                    {formatBRL(perdaTotal)}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-black uppercase text-muted-foreground">Net Cost/Credit</p>
                  <p className={cn("text-sm font-black", (selectedCollar.netCostCredit ?? 0) >= 0 ? "text-success" : "text-destructive")}>
                    {formatBRL(selectedCollar.netCostCredit)}
                  </p>
                  <p className="text-[10px] font-mono text-muted-foreground">
                    Total: {formatBRL((selectedCollar.netCostCredit ?? 0) * qty)}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-black uppercase text-muted-foreground">Break-even</p>
                  <p className="text-sm font-black text-foreground">{formatBRL(selectedCollar.breakeven)}</p>
                </div>
                <div>
                  <p className="text-xs font-black uppercase text-muted-foreground">Margem Risco Zero</p>
                  <p className="text-sm font-black text-success">{formatBRL(selectedCollar.riskFreeMargin)}</p>
                </div>
                <div>
                  <p className="text-xs font-black uppercase text-muted-foreground">
                    CDI {descontarIR ? "Líq (22,5%)" : "Bruto"}
                  </p>
                  <p className="text-sm font-black text-warning">
                    {formatPercent(descontarIR ? (selectedCollar.cdiPeriodo ?? 0) * (1 - IR_CDI) : selectedCollar.cdiPeriodo)}
                  </p>
                  {(() => {
                    const collarLiq = descontarIR ? (selectedCollar.maxProfitPct ?? 0) * (1 - IR_COLLAR) : (selectedCollar.maxProfitPct ?? 0);
                    const cdiLiq = descontarIR ? (selectedCollar.cdiPeriodo ?? 0) * (1 - IR_CDI) : (selectedCollar.cdiPeriodo ?? 0);
                    const diff = collarLiq - cdiLiq;
                    return (
                      <p className={cn("text-[10px] font-bold font-mono", diff >= 0 ? "text-success" : "text-destructive")}>
                        {diff >= 0 ? "+" : ""}{diff.toFixed(2).replace(".", ",")} pp vs CDI
                      </p>
                    );
                  })()}
                </div>
                <div>
                  <p className="text-xs font-black uppercase text-muted-foreground">
                    Retorno {descontarIR ? "Líq (15%)" : "Bruto"}
                  </p>
                  <p className="text-sm font-black text-success">
                    {formatBRL(descontarIR ? lucroTotal * (1 - IR_COLLAR) : lucroTotal)}
                  </p>
                  <p className="text-[10px] font-mono text-muted-foreground">em {qty} ações</p>
                </div>
              </div>
            );
          })()}

          {/* Chart */}
          <div className="px-3 py-4">
            <div className="h-[400px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={payoffData} margin={{ top: 20, right: 30, left: 10, bottom: 5 }}>
                  <defs>
                    <linearGradient id="collarLoss" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(var(--destructive))" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="hsl(var(--destructive))" stopOpacity={0.02} />
                    </linearGradient>
                    <linearGradient id="collarGain" x1="0" y1="1" x2="0" y2="0">
                      <stop offset="0%" stopColor="hsl(142 76% 36%)" stopOpacity={0.05} />
                      <stop offset="100%" stopColor="hsl(142 76% 36%)" stopOpacity={0.35} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" opacity={0.3} />
                  <XAxis type="number" dataKey="price" domain={["dataMin", "dataMax"]}
                    tickFormatter={(v) => v.toFixed(2)} stroke="hsl(var(--muted-foreground))" fontSize={11}
                    label={{ value: "Preço", position: "insideBottomRight", offset: -5, fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                  <YAxis tickFormatter={(v) => `R$${v.toFixed(0)}`}
                    stroke="hsl(var(--muted-foreground))" fontSize={11} width={65}
                    label={{ value: "Lucro", angle: -90, position: "insideLeft", offset: 5, fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                  <ReferenceLine y={0} stroke="hsl(var(--muted-foreground))" strokeDasharray="4 4" strokeOpacity={0.5} />
                  <ReferenceLine x={selectedCollar.putStrike} stroke="hsl(0 84% 60%)" strokeDasharray="6 3" strokeWidth={1.5}
                    label={{ value: `PUT ${selectedCollar.putStrike.toFixed(2)}`, position: "top", fill: "hsl(0 84% 60%)", fontSize: 10, fontWeight: 700 }} />
                  <ReferenceLine x={selectedCollar.callStrike} stroke="hsl(217 91% 60%)" strokeDasharray="6 3" strokeWidth={1.5}
                    label={{ value: `CALL ${selectedCollar.callStrike.toFixed(2)}`, position: "top", fill: "hsl(217 91% 60%)", fontSize: 10, fontWeight: 700 }} />
                  {selectedCollar.stockAsk && (
                    <ReferenceLine x={selectedCollar.tipo === "Alta" ? selectedCollar.stockAsk : selectedCollar.stockBid!} stroke="hsl(var(--primary))" strokeWidth={2.5}
                      label={{ value: `PREÇO ${(selectedCollar.tipo === "Alta" ? selectedCollar.stockAsk : selectedCollar.stockBid!).toFixed(2)}`, position: "top", fill: "hsl(var(--primary))", fontSize: 11, fontWeight: 900 }} />
                  )}
                  {selectedBreakeven && (
                    <ReferenceLine x={selectedBreakeven} stroke="hsl(45 95% 55%)" strokeDasharray="4 2" strokeWidth={1.5}
                      label={{ value: `BE ${selectedBreakeven.toFixed(2)}`, position: "insideTopRight", fill: "hsl(45 95% 55%)", fontSize: 10, fontWeight: 700 }} />
                  )}
                  <Tooltip content={<CollarChartTooltip />} />
                  <Area type="monotone" dataKey="payoffExpiry" stroke="none" fill="url(#collarLoss)"
                    isAnimationActive={false} baseValue={0} activeDot={false} />
                  <Line name="── CDI ──" type="monotone" dataKey="cdiLine"
                    stroke="hsl(45 95% 55%)" strokeWidth={2.5} strokeDasharray="8 4"
                    dot={false} isAnimationActive={false} />
                  <Line name="Hoje (T+0)" type="monotone" dataKey="payoffToday"
                    stroke="hsl(142 76% 36%)" strokeWidth={2} strokeDasharray="5 5"
                    dot={false} isAnimationActive={false} />
                  <Line name="No Vencimento" type="monotone" dataKey="payoffExpiry"
                    stroke="hsl(217 91% 60%)" strokeWidth={3} dot={false} isAnimationActive={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>

            {/* Legend */}
            <div className="flex flex-wrap items-center justify-center gap-6 mt-3 text-xs">
              <span className="flex items-center gap-2">
                <span className="w-6 h-0.5 bg-blue-500 rounded" style={{ display: "inline-block" }} />
                <span className="text-muted-foreground font-bold">No Vencimento</span>
              </span>
              <span className="flex items-center gap-2">
                <span className="w-6 h-0.5 rounded" style={{ display: "inline-block", background: "hsl(142 76% 36%)" }} />
                <span className="text-muted-foreground font-bold">Hoje (T+0)</span>
              </span>
              <span className="flex items-center gap-2">
                <span className="w-6 h-0.5 rounded" style={{ display: "inline-block", background: "hsl(45 95% 55%)", borderTop: "2px dashed hsl(45 95% 55%)" }} />
                <span className="text-muted-foreground font-bold">── CDI {descontarIR ? "Líq" : "Bruto"} ──</span>
              </span>
            </div>

            {/* Structure summary */}
            <div className="mt-4 p-3 rounded-xl bg-muted/30 border border-border/50">
              <p className="text-xs font-black uppercase text-muted-foreground mb-2">Estrutura da Operação</p>
              <div className="grid grid-cols-3 gap-4 text-xs">
                {selectedCollar.tipo === "Alta" ? (
                  <>
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-foreground" />
                      <span className="text-muted-foreground">Compra <span className="font-black text-foreground">{selectedCollar.familyName}</span></span>
                      <span className="ml-auto font-bold">{formatBRL(selectedCollar.stockAsk)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-red-500" />
                      <span className="text-muted-foreground">C Put <span className="font-black text-foreground">{selectedCollar.putSymbol}</span></span>
                      <span className="ml-auto font-bold">K {formatBRL(selectedCollar.putStrike)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-blue-500" />
                      <span className="text-muted-foreground">V Call <span className="font-black text-foreground">{selectedCollar.callSymbol}</span></span>
                      <span className="ml-auto font-bold">K {formatBRL(selectedCollar.callStrike)}</span>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-foreground" />
                      <span className="text-muted-foreground">Vende <span className="font-black text-foreground">{selectedCollar.familyName}</span></span>
                      <span className="ml-auto font-bold">{formatBRL(selectedCollar.stockBid)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-blue-500" />
                      <span className="text-muted-foreground">C Call <span className="font-black text-foreground">{selectedCollar.callSymbol}</span></span>
                      <span className="ml-auto font-bold">K {formatBRL(selectedCollar.callStrike)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-red-500" />
                      <span className="text-muted-foreground">V Put <span className="font-black text-foreground">{selectedCollar.putSymbol}</span></span>
                      <span className="ml-auto font-bold">K {formatBRL(selectedCollar.putStrike)}</span>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CONTROLS — CDI + Alertas */}
      <div className="space-y-3">
        {/* CDI */}
        <div className="flex flex-col sm:flex-row gap-2.5">
          <div className="flex items-center gap-3 px-4 py-3 rounded-2xl border border-border bg-card shadow-sm">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap">CDI Anual</span>
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
                    } else if (e.key === "Escape") {
                      setCdiInput(String(cdiAnual).replace(".", ",")); setEditingCdi(false);
                    }
                  }}
                  className="w-20 bg-background border border-primary/40 rounded-lg px-2 py-1 text-sm text-center font-bold text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                  autoFocus />
                <span className="text-sm font-medium text-muted-foreground">%</span>
                <button onClick={() => {
                  const val = parseFloat(cdiInput.replace(",", "."));
                  if (!isNaN(val) && val > 0 && val < 100) {
                    setCdiAnual(val); localStorage.setItem(CDI_STORAGE_KEY, String(val)); setEditingCdi(false);
                  }
                }} className="p-1.5 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg transition-colors active:scale-95">
                  <Save className="w-3 h-3" />
                </button>
                <button onClick={() => { setCdiInput(String(cdiAnual).replace(".", ",")); setEditingCdi(false); }}
                  className="p-1.5 bg-muted hover:bg-muted/80 text-muted-foreground rounded-lg transition-colors active:scale-95">
                  <X className="w-3 h-3" />
                </button>
              </div>
            ) : (
              <button onClick={() => { setCdiInput(String(cdiAnual).replace(".", ",")); setEditingCdi(true); }}
                className="flex items-center gap-1.5 text-lg font-extrabold text-primary hover:text-primary/80 transition-colors cursor-pointer"
                title="Clique para editar a taxa CDI anual">
                {String(cdiAnual).replace(".", ",")}%
                <Pencil className="w-3 h-3 opacity-40" />
              </button>
            )}
          </div>

          {/* IR Toggle */}
          <div className="flex items-center gap-3 px-4 py-3 rounded-2xl border border-border bg-card shadow-sm">
            <button onClick={() => { const next = !descontarIR; setDescontarIR(next); localStorage.setItem(IR_ENABLED_KEY, String(next)); }}
              className={cn(
                "flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-bold transition-all active:scale-[0.97]",
                descontarIR
                  ? "bg-primary/10 border-primary/30 text-primary"
                  : "bg-muted border-border text-muted-foreground hover:text-foreground"
              )}>
              {descontarIR ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
              Descontar IR
            </button>
            {descontarIR && (
              <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                <span className="px-2 py-1 rounded-lg bg-warning/10 border border-warning/20 text-warning font-black">CDI: 22,5%</span>
                <span className="px-2 py-1 rounded-lg bg-success/10 border border-success/20 text-success font-black">Collar: 15%</span>
              </div>
            )}
          </div>
        </div>


        <div className="rounded-2xl border-2 border-border bg-card p-4 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <button onClick={toggleNotifications}
                className={cn(
                  "flex items-center gap-3 px-5 py-3 rounded-2xl border-2 text-sm font-bold transition-all relative overflow-hidden active:scale-[0.97]",
                  notifEnabled
                    ? "bg-success/10 border-success/40 text-success shadow-[0_0_20px_hsl(var(--success)/0.15)]"
                    : "bg-card border-border text-muted-foreground hover:border-primary/40 hover:text-foreground"
                )}>
                {notifEnabled && (
                  <span className="absolute top-2 right-2 flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-success"></span>
                  </span>
                )}
                {notifEnabled ? <Bell className="w-5 h-5 animate-bounce" /> : <BellOff className="w-5 h-5" />}
                <span className="flex flex-col items-start leading-tight">
                  <span className="text-xs font-bold">Alerta Push</span>
                  <span className="text-xs font-normal opacity-60">
                    {notifEnabled ? "Ativo" : "Clique para ativar"}
                  </span>
                </span>
              </button>

              {notifEnabled && (
                <button onClick={() => { const next = !soundEnabled; setSoundEnabled(next); localStorage.setItem(NOTIF_SOUND_ENABLED_KEY, String(next)); }}
                  className={cn("flex items-center gap-1.5 px-3 py-2.5 rounded-xl border text-xs font-semibold transition-all active:scale-[0.97]",
                    soundEnabled ? "bg-primary/10 border-primary/30 text-primary" : "bg-muted border-border text-muted-foreground")}>
                  {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
                </button>
              )}

              {notifEnabled && (
                <button onClick={sendTestAlert}
                  className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl border border-warning/30 bg-warning/10 text-warning text-xs font-semibold transition-all active:scale-[0.97] hover:bg-warning/20">
                  🧪 Testar
                </button>
              )}
            </div>

            {notifEnabled && alertHistory.length > 0 && (
              <button onClick={() => setShowAlertHistory(!showAlertHistory)}
                className={cn("flex items-center gap-1.5 px-4 py-2.5 rounded-2xl border text-xs font-semibold transition-all active:scale-[0.97]",
                  showAlertHistory ? "bg-success/10 border-success/30 text-success" : "bg-card border-border text-muted-foreground hover:text-foreground")}>
                🕐 Histórico ({alertHistory.length})
                {showAlertHistory ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </button>
            )}
          </div>

          {notifEnabled && (
            <div className="space-y-4 pt-2">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Bell className="w-3.5 h-3.5 text-success" />
                    <span className="text-xs font-bold text-foreground">Normal</span>
                  </div>
                  <span className="text-sm font-extrabold text-success">Score ≥ {notifThreshold}</span>
                </div>
                <Slider value={[notifThreshold]} onValueChange={([val]) => { setNotifThreshold(val); localStorage.setItem(NOTIF_THRESHOLD_KEY, String(val)); }} min={40} max={95} step={5} className="w-full" />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Zap className="w-3.5 h-3.5 text-warning" />
                    <span className="text-xs font-bold text-foreground">Urgente</span>
                  </div>
                  <span className="text-sm font-extrabold text-warning">Score ≥ {notifThresholdUrgent}</span>
                </div>
                <Slider value={[notifThresholdUrgent]} onValueChange={([val]) => { setNotifThresholdUrgent(val); localStorage.setItem(NOTIF_THRESHOLD_URGENT_KEY, String(val)); }} min={60} max={100} step={5} className="w-full" />
              </div>
            </div>
          )}

          {showAlertHistory && alertHistory.length > 0 && (
            <div className="rounded-xl border border-border bg-muted/30 p-3 animate-fade-in">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold text-foreground flex items-center gap-2">🔔 Histórico</h3>
                <button onClick={() => { setAlertHistory([]); localStorage.removeItem(ALERT_HISTORY_KEY); }}
                  className="text-xs text-destructive hover:underline font-medium">Limpar</button>
              </div>
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {alertHistory.map((entry) => (
                  <div key={entry.id} className={cn(
                    "flex flex-wrap items-center gap-2 text-xs px-3 py-2 rounded-xl border",
                    entry.qualityScore >= notifThresholdUrgent ? "bg-warning/10 border-warning/30" : "bg-muted/50 border-border/50"
                  )}>
                    <span className="text-muted-foreground">{entry.time}</span>
                    <span className="font-bold text-foreground">{entry.familyName}</span>
                    <span className={cn("font-bold", entry.tipo === "Alta" ? "text-emerald-500" : "text-red-500")}>{entry.tipo}</span>
                    <span className="font-bold text-success">Score {entry.qualityScore}</span>
                    <span className="text-muted-foreground">Lucro {entry.maxProfit.toFixed(2)}%</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* FILTROS */}
      <div className="p-4 rounded-2xl border border-border bg-card shadow-sm">
        <h3 className="text-xs font-black text-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
          🎯 Filtros & Ranking
        </h3>
        <div className="flex flex-wrap gap-3 items-center">
          <div className="flex items-center gap-2">
            <label className="text-xs text-muted-foreground uppercase tracking-wider">Tipo:</label>
            <select value={filterTipo} onChange={(e) => setFilterTipo(e.target.value as CollarTipo | "Todos")}
              className="bg-background border border-input rounded-lg px-2 py-1.5 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-primary">
              <option value="Todos">Todos</option>
              <option value="Alta">🟢 Collar de Alta</option>
              <option value="Baixa">🔴 Collar de Baixa</option>
            </select>
          </div>
        </div>

        {/* RANKING METHOD */}
        <div className="mt-4 pt-4 border-t border-border/50">
          <h4 className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-2">📊 Método de Ranking</h4>
          <div className="flex flex-wrap gap-2">
            {([
              { key: "lucro" as RankingMethod, label: "Maior Lucro", desc: "Ordena pelo maior lucro máximo %" },
              { key: "score" as RankingMethod, label: "Qualidade", desc: "Fórmula ponderada (lucro + margem)" },
              { key: "netcost" as RankingMethod, label: "Crédito Líquido", desc: "Maior crédito líquido" },
            ]).map((m) => (
              <button key={m.key} onClick={() => setRankingMethod(m.key)} title={m.desc}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-bold border transition-all",
                  rankingMethod === m.key
                    ? "bg-foreground text-background border-foreground"
                    : "bg-background text-foreground border-border hover:border-foreground/50"
                )}>
                {m.label}
              </button>
            ))}
          </div>
          <p className="text-[10px] text-muted-foreground mt-1.5">
            {rankingMethod === "lucro" && "Ordena pelo maior Lucro Máximo % — encontra a melhor oportunidade de ganho"}
            {rankingMethod === "score" && "Qualidade (0-100): 50% risco zero + 30% lucro + 10% margem + 10% CDI"}
            {rankingMethod === "netcost" && "Net = crédito/débito líquido da montagem. Positivo = você recebe."}
          </p>
        </div>
      </div>

      {/* ADD FAMILY */}
      <div className="p-4 rounded-2xl border border-border bg-card shadow-sm">
        <h3 className="text-sm font-black mb-3 text-foreground flex items-center gap-2 uppercase tracking-wider">
          <Plus className="w-4 h-4 text-primary" /> Adicionar Ação
        </h3>
        <div className="flex gap-2">
          <input type="text" value={newFamilyName}
            onChange={(e) => setNewFamilyName(e.target.value.toUpperCase())}
            onKeyDown={(e) => e.key === "Enter" && addFamily()}
            placeholder="Ex: PETR, VALE, BOVA"
            className="flex-1 bg-background border border-input rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary" />
          <button onClick={addFamily}
            className="flex items-center gap-2 px-5 py-2.5 bg-primary hover:bg-primary/90 text-primary-foreground rounded-full text-sm font-bold transition-all shadow-md active:scale-[0.97]">
            <Plus className="w-4 h-4" /> Adicionar
          </button>
        </div>
      </div>

      {/* FAMILIES */}
      {families.map((family) => {
        const allCollars = calculateCollars(family);
        const collars = allCollars.filter((c) => {
          if (filterTipo !== "Todos" && c.tipo !== filterTipo) return false;
          return true;
        });
        const stockTicker = familyStockTickers(family.name);
        const stockRow = rows.get(stockTicker) || rows.get(family.name);
        const stockPrice = stockRow?.ultimo;
        const calls = family.tickers.filter((t) => t.type === "CALL");
        const puts = family.tickers.filter((t) => t.type === "PUT");
        const autoImported = autoImportedMap.get(family.name);
        const altaCount = collars.filter(c => c.tipo === "Alta").length;
        const baixaCount = collars.filter(c => c.tipo === "Baixa").length;

        return (
          <div key={family.id} className="rounded-2xl border-2 border-primary/30 bg-card overflow-hidden shadow-sm">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between px-4 py-3 bg-muted/30 border-b border-border/50 gap-2">
              <button onClick={() => toggleExpand(family.id)} className="flex items-center gap-3 flex-1">
                {family.expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                <span className="font-black text-base text-foreground">{family.name}</span>
                {stockPrice && <span className="text-sm text-primary font-bold">{formatBRL(stockPrice)}</span>}
                <span className="text-xs text-muted-foreground">
                  {calls.length}C · {puts.length}P
                </span>
                {collars.length > 0 && (
                  <span className="text-xs font-bold text-success flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3" /> {collars.length} zero risco
                    {altaCount > 0 && <span className="text-emerald-500">({altaCount}↑</span>}
                    {baixaCount > 0 && <span className="text-red-500">{baixaCount}↓)</span>}
                  </span>
                )}
              </button>
              <div className="flex items-center gap-2">
                <label className="text-[10px] font-black text-muted-foreground uppercase tracking-wider whitespace-nowrap">Qtd Ações:</label>
                <input
                  type="number"
                  min={1}
                  value={family.quantidade}
                  onChange={(e) => {
                    const val = Math.max(1, parseInt(e.target.value) || 1);
                    setFamilies(prev => prev.map(f => f.id === family.id ? { ...f, quantidade: val } : f));
                  }}
                  className="w-20 bg-background border border-input rounded-lg px-2 py-1 text-sm text-center font-bold font-mono focus:outline-none focus:ring-2 focus:ring-primary"
                />
                {stockPrice && (
                  <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                    Invest: <span className="font-black text-foreground">{formatBRL(stockPrice * family.quantidade)}</span>
                  </span>
                )}
              </div>
              <button onClick={() => removeFamily(family.id)} className="p-2 text-destructive/60 hover:text-destructive transition-colors">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>

            {family.expanded && (
              <div className="p-4 space-y-4">
                {/* Add tickers */}
                <div className="flex flex-wrap gap-2">
                  <div className="flex-1 min-w-[200px]">
                    <input type="text" placeholder="Cole tickers: PETRB28 PETRN28 ..."
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          processTickerSymbols(family.id, (e.target as HTMLInputElement).value);
                          (e.target as HTMLInputElement).value = "";
                        }
                      }}
                      className="w-full bg-background border border-input rounded-lg px-3 py-2 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-primary" />
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
                    {family.tickers.map((t) => {
                      const isAuto = autoImported?.has(t.symbol);
                      return (
                        <span key={t.id} className={cn(
                          "inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold border",
                          t.type === "CALL"
                            ? "bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800/50 text-blue-700 dark:text-blue-300"
                            : "bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800/50 text-red-700 dark:text-red-300"
                        )}>
                          {t.type === "CALL" ? "C" : "P"} {t.symbol}
                          {isAuto && (
                            <span className="inline-flex items-center gap-0.5 px-1 py-0 rounded text-[8px] font-black bg-primary/10 text-primary border border-primary/20">
                              <Database className="w-2 h-2" /> AUTO
                            </span>
                          )}
                          <button onClick={() => removeTicker(family.id, t.id)} className="hover:text-destructive">
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      );
                    })}
                  </div>
                )}

                {/* Results table */}
                {collars.length > 0 && (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-border text-xs uppercase tracking-wider text-muted-foreground">
                          <th className="text-center py-2 px-1">Tipo</th>
                          <th className="text-left py-2 px-2">Call</th>
                          <th className="text-left py-2 px-2">Put</th>
                          <th className="text-right py-2 px-2 bg-muted/50">K Call</th>
                          <th className="text-right py-2 px-2 bg-muted/50">K Put</th>
                          <th className="text-right py-2 px-2" title="Prêmios usados na montagem">P Call</th>
                          <th className="text-right py-2 px-2">P Put</th>
                          <th className="text-right py-2 px-2 font-black" title="Crédito/Débito líquido">Líquido</th>
                          <th className="text-right py-2 px-2 font-black" title="Lucro máximo %">Lucro Máx%</th>
                          <th className="text-right py-2 px-2 font-black" title="Lucro máximo em R$ (qty)">Lucro R$</th>
                          <th className="text-right py-2 px-2" title="Perda máxima %">Perda Máx%</th>
                          <th className="text-right py-2 px-2" title="Investimento total (qty × preço)">Invest. R$</th>
                          <th className="text-right py-2 px-2" title="Ponto de equilíbrio">Equil.</th>
                          <th className="text-right py-2 px-2" title="Margem acima de risco zero">Margem</th>
                          <th className="text-center py-2 px-2">Venc.</th>
                          <th className="text-right py-2 px-2">CDI Per.</th>
                          <th className="text-right py-2 px-2" title="Lucro - CDI (pp)">vs CDI</th>
                          <th className="text-center py-2 px-1" title="Qualidade">Nota</th>
                        </tr>
                      </thead>
                      <tbody>
                        {collars.map((c, ci) => {
                          const tipoCfg = TIPO_CONFIG[c.tipo];
                          const isSelected = selectedCollar?.tipo === c.tipo && selectedCollar?.callSymbol === c.callSymbol && selectedCollar?.putSymbol === c.putSymbol;
                          return (
                            <tr key={ci}
                              onClick={() => setSelectedKey(`${c.tipo}-${c.callSymbol}-${c.putSymbol}`)}
                              className={cn("border-b border-border/30 hover:bg-muted/20 transition-colors cursor-pointer",
                              ci === 0 && "bg-success/5",
                              isSelected && "ring-2 ring-primary/50 bg-primary/5")}>
                              <td className="py-2 px-1 text-center">
                                <span className={cn("text-[9px] font-black px-1.5 py-0.5 rounded-full whitespace-nowrap", tipoCfg.bgClass, tipoCfg.textClass)}>
                                  {tipoCfg.emoji} {c.tipo}
                                </span>
                              </td>
                              <td className="py-2 px-2 font-bold text-blue-600 dark:text-blue-400">{c.callSymbol ?? "—"}</td>
                              <td className="py-2 px-2 font-bold text-red-600 dark:text-red-400">{c.putSymbol ?? "—"}</td>
                              <td className="py-2 px-2 text-right bg-muted/30 font-bold">{formatBRL(c.callStrike)}</td>
                              <td className="py-2 px-2 text-right bg-muted/30 font-bold">{formatBRL(c.putStrike)}</td>
                              <td className="py-2 px-2 text-right">
                                {c.tipo === "Alta" ? formatBRL(c.callBid) : formatBRL(c.callAsk)}
                              </td>
                              <td className="py-2 px-2 text-right">
                                {c.tipo === "Alta" ? formatBRL(c.putAsk) : formatBRL(c.putBid)}
                              </td>
                              <td className={cn("py-2 px-2 text-right font-black", (c.netCostCredit ?? 0) >= 0 ? "text-success" : "text-destructive")}>
                                {formatBRL(c.netCostCredit)}
                              </td>
                              <td className="py-2 px-2 text-right font-black text-success">
                                {formatPercent(c.maxProfitPct)}
                              </td>
                              <td className="py-2 px-2 text-right font-black text-success font-mono">
                                {c.maxProfitAbs !== null ? formatBRL(c.maxProfitAbs * family.quantidade) : "—"}
                              </td>
                              <td className={cn("py-2 px-2 text-right font-bold", (c.maxLossPct ?? 0) >= 0 ? "text-success" : "text-destructive")}>
                                {formatPercent(c.maxLossPct)}
                              </td>
                              <td className="py-2 px-2 text-right font-mono font-bold text-muted-foreground">
                                {c.tipo === "Alta" && c.stockAsk ? formatBRL(c.stockAsk * family.quantidade) : c.tipo === "Baixa" && c.stockBid ? formatBRL(c.stockBid * family.quantidade) : "—"}
                              </td>
                              <td className="py-2 px-2 text-right font-mono font-bold text-foreground">
                                {formatBRL(c.breakeven)}
                              </td>
                              <td className="py-2 px-2 text-right font-bold text-success">
                                {formatBRL(c.riskFreeMargin)}
                              </td>
                              <td className="py-2 px-2 text-center text-muted-foreground">
                                {c.vencimento ?? "—"}
                              </td>
                              <td className="py-2 px-2 text-right text-warning">{formatPercent(c.cdiPeriodo)}</td>
                              <td className={cn("py-2 px-2 text-right font-bold font-mono",
                                (c.diffCdiProfit ?? 0) >= 0 ? "text-success" : "text-destructive")}>
                                {c.diffCdiProfit !== null ? `${c.diffCdiProfit >= 0 ? "+" : ""}${c.diffCdiProfit.toFixed(2).replace(".", ",")} pp` : "—"}
                              </td>
                              <td className="py-2 px-1 text-center">
                                <span className={cn("text-xs font-black px-1.5 py-0.5 rounded-full",
                                  c.qualityScore >= 80 ? "bg-success/10 text-success" :
                                  c.qualityScore >= 60 ? "bg-warning/10 text-warning" :
                                  "bg-muted text-muted-foreground")}>{c.qualityScore}</span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}

                {collars.length === 0 && family.tickers.length > 0 && (
                  <div className="text-center py-6">
                    <ShieldCheck className="w-8 h-8 mx-auto mb-2 text-muted-foreground/30" />
                    <p className="text-xs text-muted-foreground font-bold">
                      Nenhum collar de risco zero encontrado com os tickers atuais.
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-1">
                      Adicione mais calls e puts para aumentar as combinações possíveis.
                    </p>
                  </div>
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
          <p className="text-xs mt-1">Adicione uma ação acima para rastrear collars de risco zero.</p>
        </div>
      )}
    </div>
  );
}
