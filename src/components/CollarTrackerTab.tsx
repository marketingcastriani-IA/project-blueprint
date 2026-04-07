// ============================================================
// RASTREADOR DE COLLAR - Tempo Real via Profit RTD Bridge
// Payoff = S_T - S_0 + max(K_put - S_T, 0) - max(S_T - K_call, 0) + (P_call - P_put)
// R_max = (K_call - S_0 + (P_call - P_put)) / S_0
// R_min = (K_put - S_0 + (P_call - P_put)) / S_0
// Custo = P_put - P_call (ideal: ~0 = collar financiado)
// ============================================================

import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import {
  Plus, Trash2, Upload, RefreshCw, ChevronDown, ChevronUp, Star,
  ClipboardPaste, X, Shield, ShieldCheck, Trophy, Wifi, WifiOff, AlertTriangle,
  TrendingUp, TrendingDown, Minus, CalendarIcon, Pencil, Save,
  ToggleLeft, ToggleRight, BarChart3, Bell, BellOff, Volume2, VolumeX,
  Smartphone, Monitor, Zap, Download, Info, Database,
} from "lucide-react";
import { useSharedRtdBridge } from "@/contexts/RtdBridgeContext";
import { statusConfig } from "@/hooks/useRtdBridge";
import { useB3Options } from "@/contexts/B3OptionsContext";
import { useToast } from "@/hooks/use-toast";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";
import {
  ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid,
  ReferenceLine, ResponsiveContainer, Tooltip, ReferenceDot,
} from "recharts";
import trophyGold from "@/assets/trophy-gold.png";
import trophySilver from "@/assets/trophy-silver.png";
import trophyBronze from "@/assets/trophy-bronze.png";

// ─── TIPOS ───────────────────────────────────────────────────
type CollarTipo = "Normal" | "Baixa" | "ATM" | "Calendário";
type CollarCusto = "Zero-Cost" | "Crédito" | "Débito";
type RankingMethod = "score" | "custo" | "per" | "combinado";

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
  callBid: number | null;
  putAsk: number | null;
  stockAsk: number | null;
  stockUlt: number | null;
  custoCollar: number | null;
  rentBaixa: number | null;
  rentNeutra: number | null;
  rentAlta: number | null;
  vencimento: string | null;
  diasUteis: number | null;
  cdiPeriodo: number | null;
  rating: number;
  tipo: CollarTipo;
  custoTipo: CollarCusto;
  distPutPct: number | null;
  distCallPct: number | null;
  riskRewardRatio: number | null;
  qualityScore: number;
  isRiskFree: boolean;
  // CDI comparison
  diffCdiBaixa: number | null;   // rentBaixa - cdiPeriodo (pp)
  diffCdiAlta: number | null;    // rentAlta - cdiPeriodo (pp)
  per: number | null;            // Protection Efficiency Ratio
  custoLiquidoPct: number | null; // custo líquido como % do ativo
  protecaoPct: number | null;    // downside protegido como % do ativo
  upsidePct: number | null;      // upside permitido como % do ativo
  scoreCombinado: number;        // 0.5*Proteção + 0.3*Upside - 0.2*Custo
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
  autoImported?: string[];
}

interface AlertEntry {
  id: string;
  time: string;
  familyName: string;
  qualityScore: number;
  rentAlta: number;
  custoTipo: string;
}

// ─── CONSTANTES ──────────────────────────────────────────────
const STORAGE_KEY = "collar-tracker-families";
const VENC_STORAGE_KEY = "collar-tracker-vencimento";
const CDI_ANUAL_DEFAULT = 14.15;
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
  const v = 0.35;
  const T = diasUteis && diasUteis > 0 ? diasUteis / 252 : 0;

  const points: CollarPayoffPoint[] = [];
  for (let i = 0; i <= numPoints; i++) {
    const ST = start + step * i;
    const payoffExpiry = ST - S0 + Math.max(Kput - ST, 0) - Math.max(ST - Kcall, 0) + (Pcall - Pput);

    let payoffToday = payoffExpiry;
    if (T > 0.001) {
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

// ─── COMPONENTE PRINCIPAL ─────────────────────────────────────
export default function CollarTrackerTab() {
  const { getStrikeAndExpiry } = useB3Options();
  const { toast } = useToast();

  const [families, setFamilies] = useState<StockFamily[]>([]);
  const [newFamilyName, setNewFamilyName] = useState("");
  const [vencimentoManual, setVencimentoManual] = useState<string>("");
  const [vencSaved, setVencSaved] = useState(false);
  const [editingVenc, setEditingVenc] = useState(false);
  const [filterTipo, setFilterTipo] = useState<CollarTipo | "Todos">("Todos");
  const [filterCusto, setFilterCusto] = useState<CollarCusto | "Todos">("Todos");
  const [hideNegative, setHideNegative] = useState(false);
  const [onlyRiskFree, setOnlyRiskFree] = useState(false);
  const [rankingMethod, setRankingMethod] = useState<RankingMethod>("score");
  const [selectedCollar, setSelectedCollar] = useState<(CollarResult & { familyName: string }) | null>(null);
  const [autoImportedMap, setAutoImportedMap] = useState<Map<string, Set<string>>>(new Map());
  const [cdiAnual, setCdiAnual] = useState<number>(() => {
    try {
      const saved = localStorage.getItem(CDI_STORAGE_KEY);
      return saved ? parseFloat(saved) : CDI_ANUAL_DEFAULT;
    } catch { return CDI_ANUAL_DEFAULT; }
  });
  const [editingCdi, setEditingCdi] = useState(false);
  const [cdiInput, setCdiInput] = useState(String(cdiAnual).replace(".", ","));

  // ─── NOTIFICAÇÕES ──────────────────────────────────────────
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

  // Instructional banner
  const [showInstructions, setShowInstructions] = useState(() => {
    try { return localStorage.getItem("collar-tracker-instructions-dismissed") !== "true"; } catch { return true; }
  });
  const dismissInstructions = () => {
    setShowInstructions(false);
    localStorage.setItem("collar-tracker-instructions-dismissed", "true");
  };

  const { status, rows, connect, addTicker: bridgeAddTicker } = useSharedRtdBridge();

  // Helper: send message to Service Worker
  const postToSW = useCallback(async (message: object) => {
    if (!('serviceWorker' in navigator)) return false;
    if (navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage(message);
      return true;
    }
    try {
      const reg = await navigator.serviceWorker.ready;
      if (reg.active) {
        reg.active.postMessage(message);
        return true;
      }
    } catch {}
    return false;
  }, []);

  // Push notification sender
  const sendPushNotification = useCallback(async (title: string, body: string, data?: any) => {
    const tag = data?.priority === 'urgent' ? 'collar-tracker-urgent' : 'collar-tracker-alert';
    const sent = await postToSW({ type: 'BOX_ALERT', title, body, tag, data });
    if (sent) return;
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(title, { body, icon: '/favicon.png', tag });
    }
  }, [postToSW]);

  // Toggle notifications
  const toggleNotifications = useCallback(async () => {
    if (notifEnabled) {
      setNotifEnabled(false);
      localStorage.setItem(NOTIF_ENABLED_KEY, "false");
      return;
    }
    if (!("Notification" in window)) {
      alert("Seu navegador não suporta notificações push. Instale o app (PWA) para receber alertas.");
      return;
    }
    const permission = await Notification.requestPermission();
    notifPermissionRef.current = permission;
    if (permission === "granted") {
      setNotifEnabled(true);
      localStorage.setItem(NOTIF_ENABLED_KEY, "true");
      const sent = await postToSW({
        type: 'BOX_ALERT',
        title: '🔔 Alertas Collar Ativados!',
        body: `✅ Você será notificado quando um collar atingir score ≥ ${notifThreshold}.\n📱 Funciona mesmo com o app minimizado!`,
        tag: 'collar-tracker-test',
      });
      if (!sent) {
        new Notification("🔔 Alertas Collar Ativados!", {
          body: `Você será notificado quando um collar atingir score ≥ ${notifThreshold}.`,
          icon: "/favicon.png",
        });
      }
    } else {
      alert("Permissão de notificação negada.\n\n📱 No celular: Configurações → Notificações → Permitir\n💻 No PC: Clique no 🔒 ao lado da URL → Permitir Notificações");
    }
  }, [notifEnabled, notifThreshold, postToSW]);

  // Test alert
  const sendTestAlert = useCallback(async () => {
    const isIframe = window.self !== window.top;
    if (isIframe) {
      toast({
        title: "⚠️ Preview não suporta Push",
        description: "Abra o site publicado ou instale o PWA para receber notificações push.",
        variant: "destructive",
      });
      return;
    }
    if (!("Notification" in window)) {
      toast({ title: "❌ Navegador incompatível", description: "Este navegador não suporta notificações.", variant: "destructive" });
      return;
    }
    let perm = Notification.permission;
    if (perm === "default") perm = await Notification.requestPermission();
    if (perm !== "granted") {
      toast({ title: "❌ Permissão negada", description: "Ative as notificações: clique no 🔒 ao lado da URL → Permitir Notificações", variant: "destructive" });
      return;
    }

    let swOk = false;
    if ('serviceWorker' in navigator) {
      try {
        const reg = await navigator.serviceWorker.ready;
        if (reg.active) swOk = true;
      } catch {}
    }

    await sendPushNotification(
      '🧪 Teste de Alerta Collar',
      `📊 Alerta teste — ${new Date().toLocaleTimeString('pt-BR')}\n🎯 Score Normal: ≥ ${notifThreshold}\n🚨 Score Urgente: ≥ ${notifThresholdUrgent}`,
      { url: '/collar-tracker', priority: 'normal', sound: soundEnabled }
    );

    if (!swOk) {
      try { new Notification('🧪 Teste Direto', { body: 'Fallback sem Service Worker', icon: '/favicon.png' }); } catch {}
    }

    toast({
      title: swOk ? "✅ Alerta teste enviado!" : "⚠️ Alerta enviado (fallback)",
      description: swOk ? "A notificação push deve aparecer agora." : "Service Worker indisponível.",
    });
  }, [sendPushNotification, notifThreshold, notifThresholdUrgent, soundEnabled, toast]);

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
    }));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
  }, [families, autoImportedMap]);

  // Derive stock ticker from family name
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
    setSelectedCollar(null);
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
        .filter((s) => {
          if (s.length < 5) return false;
          return /^[A-Z]{3,6}\d{0,2}[A-X]\d+$/.test(s);
        });
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
    setSelectedCollar(null);
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
      const stockUlt = stockRow?.ultimo ?? null;

      const calls = family.tickers.filter((t) => t.type === "CALL");
      const puts = family.tickers.filter((t) => t.type === "PUT");

      const results: CollarResult[] = [];

      for (const call of calls) {
        for (const put of puts) {
          const callRow = rows.get(call.symbol);
          const putRow = rows.get(put.symbol);

          const callBid = getPrice(callRow, "ofCompra");
          const putAsk = getPrice(putRow, "ofVenda");

          const callStrikeRtd = (callRow?.strike && callRow.strike > 0) ? callRow.strike : null;
          const putStrikeRtd = (putRow?.strike && putRow.strike > 0) ? putRow.strike : null;

          // Strike priority: RTD > B3 DB > ticker-parsed
          const b3CallInfo = getStrikeAndExpiry(call.symbol);
          const b3PutInfo = getStrikeAndExpiry(put.symbol);
          const callStrike = callStrikeRtd ?? ((b3CallInfo && b3CallInfo.strike > 0) ? b3CallInfo.strike : call.strike);
          const putStrike = putStrikeRtd ?? ((b3PutInfo && b3PutInfo.strike > 0) ? b3PutInfo.strike : put.strike);

          const vencRtd = callRow?.ven ?? putRow?.ven ?? null;
          const b3Venc = b3CallInfo?.vencimento ?? b3PutInfo?.vencimento ?? null;
          const vencimento = vencimentoManual || vencRtd || b3Venc || null;
          const diasUteis = calcDiasUteis(vencimento);
          const cdiPeriodo = diasUteis !== null && diasUteis > 0 ? calcCdiPeriodo(diasUteis, cdiAnual) : null;

          let custoCollar: number | null = null;
          let rentBaixa: number | null = null;
          let rentNeutra: number | null = null;
          let rentAlta: number | null = null;

          if (stockAsk !== null && callBid !== null && putAsk !== null) {
            const S0 = stockAsk;
            const Pcall = callBid;
            const Pput = putAsk;

            custoCollar = Pput - Pcall;

            if (S0 > 0) {
              rentAlta = ((callStrike - S0 + (Pcall - Pput)) / S0) * 100;
              rentBaixa = ((putStrike - S0 + (Pcall - Pput)) / S0) * 100;
              rentNeutra = ((Pcall - Pput) / S0) * 100;
            }
          }

          let rating = 1;
          if (cdiPeriodo !== null && rentBaixa !== null && rentNeutra !== null && rentAlta !== null) {
            const aboveCdi = [rentBaixa >= cdiPeriodo, rentNeutra >= cdiPeriodo, rentAlta >= cdiPeriodo];
            const count = aboveCdi.filter(Boolean).length;
            if (count === 3) rating = 3;
            else if (count >= 1) rating = 2;
          }

          let tipo: CollarTipo = "Normal";
          const distPutPct = stockAsk !== null && stockAsk > 0 ? ((putStrike - stockAsk) / stockAsk) * 100 : null;
          const distCallPct = stockAsk !== null && stockAsk > 0 ? ((callStrike - stockAsk) / stockAsk) * 100 : null;

          if (callStrike < putStrike) {
            tipo = "Baixa";
          } else if (distPutPct !== null && Math.abs(distPutPct) < 2) {
            tipo = "ATM";
          } else {
            tipo = "Normal";
          }

          let custoTipo: CollarCusto = "Débito";
          if (custoCollar !== null) {
            if (Math.abs(custoCollar) < 0.05) custoTipo = "Zero-Cost";
            else if (custoCollar < 0) custoTipo = "Crédito";
          }

          const riskRewardRatio = (rentAlta !== null && rentBaixa !== null && rentBaixa !== 0)
            ? Math.abs(rentAlta / rentBaixa) : null;

          const isRiskFree = rentAlta !== null && rentBaixa !== null && rentNeutra !== null
            && rentBaixa >= -0.01 && rentNeutra >= -0.01 && rentAlta >= -0.01;

          // CDI comparison metrics
          const diffCdiBaixa = (rentBaixa !== null && cdiPeriodo !== null) ? rentBaixa - cdiPeriodo : null;
          const diffCdiAlta = (rentAlta !== null && cdiPeriodo !== null) ? rentAlta - cdiPeriodo : null;

          // Custo líquido como % do ativo
          const custoLiquidoPct = (custoCollar !== null && stockAsk !== null && stockAsk > 0)
            ? (custoCollar / stockAsk) * 100 : null;

          // Proteção e Upside como % do ativo
          const protecaoPct = (stockAsk !== null && stockAsk > 0) ? ((stockAsk - putStrike) / stockAsk) * 100 : null;
          const upsidePct = (stockAsk !== null && stockAsk > 0) ? ((callStrike - stockAsk) / stockAsk) * 100 : null;

          // PER (Protection Efficiency Ratio)
          let per: number | null = null;
          if (protecaoPct !== null && custoLiquidoPct !== null) {
            per = Math.abs(custoLiquidoPct) > 0.01
              ? Math.abs(protecaoPct / custoLiquidoPct)
              : (custoLiquidoPct <= 0.01 ? Infinity : null);
          }

          // Score Combinado (fórmula do comparador)
          // 0.5*Proteção + 0.3*Upside - 0.2*Custo
          let scoreCombinado = 0;
          if (protecaoPct !== null && upsidePct !== null && custoLiquidoPct !== null) {
            scoreCombinado = 0.5 * protecaoPct + 0.3 * upsidePct - 0.2 * custoLiquidoPct;
          }

          // Quality Score — fórmula combinada com pesos CDI
          // w1=0.30 rentAlta vs CDI | w2=0.25 proteção (risco zero) | w3=0.20 custo | w4=0.15 PER | w5=0.10 estrutura
          let qualityScore = 0;
          if (rentAlta !== null && rentBaixa !== null && cdiPeriodo !== null) {
            // Componente 1: Rent. Alta vs CDI (0-30 pts)
            const altaVsCdi = diffCdiAlta ?? 0;
            const comp1 = altaVsCdi > 0
              ? Math.min(30, 15 + altaVsCdi * 3)  // acima CDI: 15-30
              : Math.max(0, 15 + altaVsCdi * 3);   // abaixo CDI: 0-15

            // Componente 2: Proteção / Risco Zero (0-25 pts)
            let comp2 = 0;
            if (isRiskFree) comp2 = 25;
            else if (rentBaixa >= 0) comp2 = 20;
            else if (diffCdiBaixa !== null && diffCdiBaixa >= -2) comp2 = 15;
            else if (diffCdiBaixa !== null && diffCdiBaixa >= -5) comp2 = 8;
            else comp2 = 0;

            // Componente 3: Custo do collar (0-20 pts)
            let comp3 = 10; // base
            if (custoTipo === "Crédito") comp3 = 20;
            else if (custoTipo === "Zero-Cost") comp3 = 15;
            else if (custoLiquidoPct !== null) {
              comp3 = Math.max(0, 10 - Math.abs(custoLiquidoPct) * 2);
            }

            // Componente 4: PER (0-15 pts)
            let comp4 = 0;
            if (per === Infinity) comp4 = 15;
            else if (per !== null) comp4 = Math.min(15, per * 3);

            // Componente 5: Estrutura / distância strikes (0-10 pts)
            let comp5 = 5; // base
            if (distPutPct !== null && distPutPct >= -15 && distPutPct <= -3) comp5 += 2.5;
            if (distCallPct !== null && distCallPct >= 3 && distCallPct <= 15) comp5 += 2.5;

            qualityScore = Math.round(comp1 + comp2 + comp3 + comp4 + comp5);
          }
          qualityScore = Math.max(0, Math.min(100, qualityScore));

          results.push({
            callSymbol: call.symbol, putSymbol: put.symbol,
            callStrike, putStrike,
            callStrikeRtd, putStrikeRtd,
            callBid, putAsk, stockAsk, stockUlt,
            custoCollar, rentBaixa, rentNeutra, rentAlta,
            vencimento, diasUteis, cdiPeriodo,
            rating, tipo, custoTipo,
            distPutPct, distCallPct, riskRewardRatio, qualityScore,
            isRiskFree,
            diffCdiBaixa, diffCdiAlta, per, custoLiquidoPct,
            protecaoPct, upsidePct, scoreCombinado,
          });
        }
      }

      // Sort based on ranking method
      results.sort((a, b) => {
        switch (rankingMethod) {
          case "custo":
            return (a.custoCollar ?? 999) - (b.custoCollar ?? 999);
          case "per":
            return ((b.per === Infinity ? 9999 : b.per) ?? -1) - ((a.per === Infinity ? 9999 : a.per) ?? -1);
          case "combinado":
            return b.scoreCombinado - a.scoreCombinado;
          case "score":
          default:
            return b.qualityScore - a.qualityScore;
        }
      });
      return results;
    },
    [rows, vencimentoManual, cdiAnual, getStrikeAndExpiry, familyStockTickers, rankingMethod]
  );

  // Global best per family (memoized)
  const topCollars = useMemo(() => {
    const bestPerFamily: (CollarResult & { familyName: string })[] = [];
    families.forEach((f) => {
      if (f.tickers.length === 0) return;
      const collars = calculateCollars(f);
      const best = collars.find((c) => c.rentAlta !== null && c.stockAsk !== null);
      if (best) bestPerFamily.push({ ...best, familyName: f.name });
    });
    bestPerFamily.sort((a, b) => {
      switch (rankingMethod) {
        case "custo": return (a.custoCollar ?? 999) - (b.custoCollar ?? 999);
        case "per": return ((b.per === Infinity ? 9999 : b.per) ?? -1) - ((a.per === Infinity ? 9999 : a.per) ?? -1);
        case "combinado": return b.scoreCombinado - a.scoreCombinado;
        default: return b.qualityScore - a.qualityScore;
      }
    });
    return bestPerFamily.slice(0, 10);
  }, [families, calculateCollars]);

  // Auto-select best collar for chart
  const topCollarsKey = topCollars.map(c => `${c.callSymbol}-${c.putSymbol}`).join(",");
  useEffect(() => {
    if (topCollars.length > 0) {
      const stillExists = selectedCollar && topCollars.some(
        c => c.callSymbol === selectedCollar.callSymbol && c.putSymbol === selectedCollar.putSymbol
      );
      if (!stillExists) {
        setSelectedCollar(topCollars[0]);
      }
    } else {
      setSelectedCollar(null);
    }
  }, [topCollarsKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── PUSH ALERT TRIGGER ──────────────────────────────────────
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
      rentAlta: best.rentAlta ?? 0,
      custoTipo: best.custoTipo,
    };
    setAlertHistory(prev => {
      const updated = [entry, ...prev].slice(0, 50);
      localStorage.setItem(ALERT_HISTORY_KEY, JSON.stringify(updated));
      return updated;
    });

    sendPushNotification(
      isUrgent
        ? `🚨 URGENTE! COLLAR ${best.familyName} — Score ${best.qualityScore}!`
        : `🛡️ COLLAR ${best.familyName} — Score ${best.qualityScore}`,
      `📊 Quality Score: ${best.qualityScore}/100\n📈 Rent. Alta: ${formatPercent(best.rentAlta)}\n💰 Custo: ${best.custoTipo}${best.isRiskFree ? '\n🛡️ RISCO ZERO!' : ''}`,
      {
        url: '/collar-tracker',
        familyName: best.familyName,
        qualityScore: best.qualityScore,
        priority: isUrgent ? 'urgent' : 'normal',
        sound: soundEnabled,
      }
    );
  }, [topCollars, notifEnabled, notifThreshold, notifThresholdUrgent, soundEnabled, sendPushNotification]);

  // Payoff data for selected collar
  const payoffData = useMemo(() => {
    if (!selectedCollar || !selectedCollar.stockAsk || !selectedCollar.callBid || !selectedCollar.putAsk) return [];
    return generateCollarPayoff(
      selectedCollar.stockAsk,
      selectedCollar.putStrike,
      selectedCollar.callStrike,
      selectedCollar.putAsk,
      selectedCollar.callBid,
      selectedCollar.diasUteis,
      cdiAnual
    );
  }, [selectedCollar, cdiAnual]);

  const selectedBreakeven = useMemo(() => {
    if (!selectedCollar?.stockAsk) return null;
    const S0 = selectedCollar.stockAsk;
    const Pcall = selectedCollar.callBid ?? 0;
    const Pput = selectedCollar.putAsk ?? 0;
    return S0 + Pput - Pcall;
  }, [selectedCollar]);

  const isConnected = status === "connected";
  const statusCfg = statusConfig[status];
  const diasUteisVenc = calcDiasUteis(vencimentoManual);

  // ─── RENDER ───────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-background text-foreground font-sans p-3 md:p-6">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-xl md:text-2xl font-extrabold tracking-tight text-foreground flex items-center gap-2.5">
            <span className="p-2 rounded-xl bg-primary/10">
              <Shield className="w-5 h-5 md:w-6 md:h-6 text-primary" />
            </span>
            Rastreador de Collar
          </h1>
          <p className="text-xs md:text-xs text-muted-foreground mt-1.5 font-medium">
            R↑ = (K_call − S₀ + P_call − P_put) / S₀ · R↓ = (K_put − S₀ + P_call − P_put) / S₀ · Custo = P_put − P_call
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {families.length > 0 && (
            <button onClick={() => { setFamilies([]); setSelectedCollar(null); localStorage.removeItem(STORAGE_KEY); }}
              className="flex items-center gap-2 px-3 py-1.5 bg-destructive/10 hover:bg-destructive/20 border border-destructive/30 text-destructive rounded-full text-xs font-bold transition-colors active:scale-[0.97]">
              <Trash2 className="w-3.5 h-3.5" /> Limpar Tudo
            </button>
          )}
          <div className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-full border text-xs font-semibold transition-all",
            isConnected
              ? "bg-success/10 border-success/30 text-success"
              : status === "error"
              ? "bg-destructive/10 border-destructive/30 text-destructive"
              : "bg-muted border-border text-muted-foreground"
          )}>
            {status === "connected" ? <Wifi className="w-3.5 h-3.5" /> :
             status === "error" ? <AlertTriangle className="w-3.5 h-3.5" /> :
             status === "connecting" ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> :
             <WifiOff className="w-3.5 h-3.5" />}
            {statusCfg.label}
            {isConnected && <span className="text-success font-bold">· {rows.size} tickers</span>}
          </div>
          {!isConnected && status !== "connecting" && (
            <button onClick={connect}
              className="flex items-center gap-2 px-5 py-2.5 bg-primary hover:bg-primary/90 text-primary-foreground rounded-full text-sm font-bold transition-all shadow-md hover:shadow-lg active:scale-[0.97]">
              <RefreshCw className="w-4 h-4" /> Conectar Bridge
            </button>
          )}
        </div>
      </div>

      {/* Bridge warning */}
      {!isConnected && status !== "connecting" && (
        <div className="mb-5 bg-warning/5 border border-warning/20 rounded-2xl p-4 text-sm backdrop-blur-sm">
          <div className="flex items-center gap-2 text-warning font-bold mb-1">
            <AlertTriangle className="w-4 h-4" /> Bridge RTD não conectado
          </div>
          <p className="text-muted-foreground text-xs">
            Inicie o <strong>ProfitRTDBridge.exe</strong> para receber dados em tempo real do Profit Pro.
          </p>
        </div>
      )}

      {/* Instructional Banner */}
      {showInstructions && (
        <div className="mb-5 rounded-xl border border-primary/20 bg-primary/5 backdrop-blur-sm p-4 relative">
          <button
            onClick={dismissInstructions}
            className="absolute top-3 right-3 text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
          <div className="flex items-center gap-2 mb-3">
            <Info className="h-4 w-4 text-primary" />
            <span className="text-sm font-bold text-foreground">Como usar o Rastreador de Collar</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="flex items-start gap-2.5">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">1</span>
              <div>
                <p className="text-xs font-semibold text-foreground">Adicione uma família</p>
                <p className="text-xs text-muted-foreground">Digite o nome base (ex: PETR, VALE) ou envie tickers automaticamente do <strong>Opções B3</strong></p>
              </div>
            </div>
            <div className="flex items-start gap-2.5">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">2</span>
              <div>
                <p className="text-xs font-semibold text-foreground">Calls + Puts automáticas</p>
                <p className="text-xs text-muted-foreground">Conecte o Bridge — o sistema calcula todas as combinações de Collar automaticamente</p>
              </div>
            </div>
            <div className="flex items-start gap-2.5">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">3</span>
              <div>
                <p className="text-xs font-semibold text-foreground">Ranking & Alertas</p>
                <p className="text-xs text-muted-foreground">Os melhores collars aparecem no ranking com Quality Score e alertas push</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CONTROLS GRID — CDI + Alertas */}
      <div className="mb-6 space-y-3">
        {/* Row 1: CDI */}
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
        </div>

        {/* Row 2: Modern Alert Panel */}
        <div className="rounded-2xl border-2 border-border bg-card p-4 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <button
                onClick={toggleNotifications}
                className={cn(
                  "flex items-center gap-3 px-5 py-3 rounded-2xl border-2 text-sm font-bold transition-all relative overflow-hidden active:scale-[0.97]",
                  notifEnabled
                    ? "bg-success/10 border-success/40 text-success shadow-[0_0_20px_hsl(var(--success)/0.15)]"
                    : "bg-card border-border text-muted-foreground hover:border-primary/40 hover:text-foreground"
                )}
              >
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
                    {notifEnabled ? "Ativo · PC + Celular" : "Clique para ativar"}
                  </span>
                </span>
                <span className={cn(
                  "text-xs px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ml-auto",
                  notifEnabled ? "bg-success/20 text-success" : "bg-muted text-muted-foreground"
                )}>
                  {notifEnabled ? "ON" : "OFF"}
                </span>
              </button>

              {notifEnabled && (
                <button
                  onClick={() => {
                    const next = !soundEnabled;
                    setSoundEnabled(next);
                    localStorage.setItem(NOTIF_SOUND_ENABLED_KEY, String(next));
                  }}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-2.5 rounded-xl border text-xs font-semibold transition-all active:scale-[0.97]",
                    soundEnabled
                      ? "bg-primary/10 border-primary/30 text-primary"
                      : "bg-muted border-border text-muted-foreground"
                  )}
                  title={soundEnabled ? "Som ativado" : "Som desativado"}
                >
                  {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
                </button>
              )}

              {notifEnabled && (
                <button
                  onClick={sendTestAlert}
                  className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl border border-warning/30 bg-warning/10 text-warning text-xs font-semibold transition-all active:scale-[0.97] hover:bg-warning/20"
                  title="Enviar notificação de teste"
                >
                  🧪 Testar
                </button>
              )}

              {notifEnabled && (
                <span className="hidden sm:flex items-center gap-1.5 text-xs text-muted-foreground bg-muted px-3 py-1.5 rounded-full">
                  <Monitor className="w-3 h-3" />
                  <Smartphone className="w-3 h-3" />
                  {(() => {
                    try {
                      return window.matchMedia('(display-mode: standalone)').matches ? 'PWA Instalado' : 'Navegador';
                    } catch { return 'Navegador'; }
                  })()}
                </span>
              )}
            </div>

            {notifEnabled && alertHistory.length > 0 && (
              <button
                onClick={() => setShowAlertHistory(!showAlertHistory)}
                className={cn(
                  "flex items-center gap-1.5 px-4 py-2.5 rounded-2xl border text-xs font-semibold transition-all active:scale-[0.97]",
                  showAlertHistory
                    ? "bg-success/10 border-success/30 text-success"
                    : "bg-card border-border text-muted-foreground hover:text-foreground"
                )}
              >
                🕐 Histórico ({alertHistory.length})
                {showAlertHistory ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </button>
            )}
          </div>

          {/* Sliders for thresholds */}
          {notifEnabled && (
            <div className="space-y-4 pt-2">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Bell className="w-3.5 h-3.5 text-success" />
                    <span className="text-xs font-bold text-foreground">Nível 1 — Normal</span>
                  </div>
                  <span className="text-sm font-extrabold text-success">Score ≥ {notifThreshold}</span>
                </div>
                <Slider
                  value={[notifThreshold]}
                  onValueChange={([val]) => {
                    setNotifThreshold(val);
                    localStorage.setItem(NOTIF_THRESHOLD_KEY, String(val));
                  }}
                  min={40}
                  max={95}
                  step={5}
                  className="w-full"
                />
                <p className="text-xs text-muted-foreground">
                  📩 Notificação quando o melhor collar atingir Quality Score ≥ <strong>{notifThreshold}</strong>
                </p>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Zap className="w-3.5 h-3.5 text-warning" />
                    <span className="text-xs font-bold text-foreground">Nível 2 — Urgente</span>
                  </div>
                  <span className="text-sm font-extrabold text-warning">Score ≥ {notifThresholdUrgent}</span>
                </div>
                <Slider
                  value={[notifThresholdUrgent]}
                  onValueChange={([val]) => {
                    setNotifThresholdUrgent(val);
                    localStorage.setItem(NOTIF_THRESHOLD_URGENT_KEY, String(val));
                  }}
                  min={60}
                  max={100}
                  step={5}
                  className="w-full"
                />
                <p className="text-xs text-muted-foreground">
                  🚨 Alerta urgente com vibração extra quando superar Score <strong>{notifThresholdUrgent}</strong>
                </p>
              </div>

              {/* PWA Install Guide */}
              {(() => {
                try {
                  const isPWA = window.matchMedia('(display-mode: standalone)').matches;
                  if (isPWA) return null;
                } catch {}
                return (
                  <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <Download className="w-3.5 h-3.5 text-primary" />
                      <span className="text-xs font-bold text-foreground">Instale o app para alertas no celular</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs text-muted-foreground">
                      <div className="flex items-start gap-1.5">
                        <Monitor className="w-3 h-3 mt-0.5 text-primary shrink-0" />
                        <span><strong>Chrome PC:</strong> Clique no ícone de instalação na barra de URL</span>
                      </div>
                      <div className="flex items-start gap-1.5">
                        <Smartphone className="w-3 h-3 mt-0.5 text-primary shrink-0" />
                        <span><strong>Android:</strong> Menu ⋮ → Adicionar à tela inicial</span>
                      </div>
                      <div className="flex items-start gap-1.5">
                        <Smartphone className="w-3 h-3 mt-0.5 text-primary shrink-0" />
                        <span><strong>iPhone:</strong> Compartilhar ↑ → Tela de Início</span>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

          {/* Alert History Panel */}
          {showAlertHistory && alertHistory.length > 0 && (
            <div className="rounded-xl border border-border bg-muted/30 p-3 animate-fade-in">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                  🔔 Histórico de Alertas
                </h3>
                <button
                  onClick={() => {
                    setAlertHistory([]);
                    localStorage.removeItem(ALERT_HISTORY_KEY);
                  }}
                  className="text-xs text-destructive hover:underline font-medium"
                >
                  Limpar tudo
                </button>
              </div>
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {alertHistory.map((entry) => (
                  <div key={entry.id} className={cn(
                    "flex flex-wrap items-center gap-2 text-xs px-3 py-2 rounded-xl border",
                    entry.qualityScore >= notifThresholdUrgent
                      ? "bg-warning/10 border-warning/30"
                      : "bg-muted/50 border-border/50"
                  )}>
                    {entry.qualityScore >= notifThresholdUrgent && <Zap className="w-3 h-3 text-warning" />}
                    <span className="text-muted-foreground">{entry.time}</span>
                    <span className="font-bold text-foreground">{entry.familyName}</span>
                    <span className="font-bold text-success">Score {entry.qualityScore}</span>
                    <span className="text-muted-foreground">{entry.custoTipo}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* FILTROS INTELIGENTES */}
      <div className="mb-5 p-4 rounded-2xl border border-border bg-card shadow-sm">
        <h3 className="text-xs font-black text-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
          🎯 Filtros de Seleção de Strike
        </h3>
        <div className="flex flex-wrap gap-3 items-center">
          <div className="flex items-center gap-2">
            <label className="text-xs text-muted-foreground uppercase tracking-wider">Tipo:</label>
            <select value={filterTipo} onChange={(e) => setFilterTipo(e.target.value as CollarTipo | "Todos")}
              className="bg-background border border-input rounded-lg px-2 py-1.5 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-primary">
              <option value="Todos">Todos</option>
              <option value="Normal">Normal (Put OTM + Call OTM)</option>
              <option value="ATM">ATM (Put próxima do preço)</option>
              <option value="Baixa">Baixa (Call abaixo da Put)</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-muted-foreground uppercase tracking-wider">Custo:</label>
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
              hideNegative ? "bg-success/10 border-success/30 text-success" : "bg-muted border-border text-muted-foreground")}>
            {hideNegative ? <ToggleRight className="w-3.5 h-3.5" /> : <ToggleLeft className="w-3.5 h-3.5" />}
            Ocultar negativos
          </button>
          <button
            onClick={() => setOnlyRiskFree(!onlyRiskFree)}
            className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border transition-all",
              onlyRiskFree
                ? "bg-success/10 border-success/30 text-success shadow-[0_0_12px_-2px_hsl(var(--success)/0.4)] ring-1 ring-success/50"
                : "bg-muted border-border text-muted-foreground")}>
            <ShieldCheck className={cn("w-3.5 h-3.5", onlyRiskFree && "animate-pulse")} />
            Só Risco Zero
          </button>
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          📐 Zona ideal: PUT 5-15% abaixo · CALL 5-15% acima · Custo ≈ zero · Rent. &gt; CDI
        </p>

        {/* MÉTODO DE RANKING */}
        <div className="mt-4 pt-4 border-t border-border/50">
          <h4 className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-2">
            📊 Método de Ranking
          </h4>
          <div className="flex flex-wrap gap-2">
            {([
              { key: "score" as RankingMethod, label: "Quality Score", desc: "Fórmula CDI ponderada (5 componentes)" },
              { key: "custo" as RankingMethod, label: "Custo Líquido", desc: "Menor custo = melhor proteção" },
              { key: "per" as RankingMethod, label: "Eficiência (PER)", desc: "Proteção / Custo — maior = melhor" },
              { key: "combinado" as RankingMethod, label: "Score Combinado", desc: "0.5×Proteção + 0.3×Upside – 0.2×Custo" },
            ]).map((m) => (
              <button
                key={m.key}
                onClick={() => setRankingMethod(m.key)}
                title={m.desc}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-bold border transition-all",
                  rankingMethod === m.key
                    ? "bg-foreground text-background border-foreground"
                    : "bg-background text-foreground border-border hover:border-foreground/50"
                )}
              >
                {m.label}
              </button>
            ))}
          </div>
          <p className="text-[10px] text-muted-foreground mt-1.5">
            {rankingMethod === "score" && "Quality Score (0-100): 30% Rent. Alta vs CDI · 25% Proteção · 20% Custo · 15% PER · 10% Estrutura"}
            {rankingMethod === "custo" && "Custo Líquido = Prêmio Put – Prêmio Call · Menor valor = melhor (mais barato montar a proteção)"}
            {rankingMethod === "per" && "PER = Proteção (%) / |Custo Líquido (%)| · Maior valor = mais proteção por unidade de custo"}
            {rankingMethod === "combinado" && "Score = 0.5 × Proteção(%) + 0.3 × Upside(%) – 0.2 × Custo(%) · Maior valor = melhor equilíbrio"}
          </p>
        </div>
      </div>

      {/* VENCIMENTO */}
      <div className="mb-5">
        <div className={cn("rounded-2xl border p-4 transition-all",
          vencSaved ? "bg-warning/5 border-warning/20" : "bg-card border-border shadow-sm")}>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-black text-warning flex items-center gap-2 uppercase tracking-wider">
              <CalendarIcon className="w-4 h-4" /> 📅 Data de Vencimento
            </h3>
            {vencSaved && (
              <div className="flex gap-2">
                <button onClick={handleEditVenc} className="flex items-center gap-1 px-3 py-1 text-xs bg-warning/10 hover:bg-warning/20 border border-warning/30 rounded-lg text-warning font-bold transition-colors">
                  <Pencil className="w-3 h-3" /> Editar
                </button>
                <button onClick={handleDeleteVenc} className="flex items-center gap-1 px-3 py-1 text-xs bg-destructive/10 hover:bg-destructive/20 border border-destructive/30 rounded-lg text-destructive font-bold transition-colors">
                  <Trash2 className="w-3 h-3" /> Excluir
                </button>
              </div>
            )}
          </div>
          {vencSaved && !editingVenc ? (
            <div className="flex flex-wrap items-center gap-4 md:gap-6">
              <div>
                <p className="text-2xl md:text-3xl font-black text-warning">{vencimentoManual}</p>
                {diasUteisVenc !== null && (
                  <p className="text-sm text-muted-foreground mt-1">
                    <span className="text-warning font-bold">{diasUteisVenc}</span> dias úteis restantes
                    {diasUteisVenc > 0 && (
                      <span className="ml-2">· CDI do período: <span className="text-warning font-bold">{formatPercent(calcCdiPeriodo(diasUteisVenc, cdiAnual))}</span></span>
                    )}
                  </p>
                )}
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap items-end gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-xs text-muted-foreground uppercase tracking-wider">Selecione a data</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <button className={cn(
                      "flex items-center gap-2 px-4 py-2.5 rounded-lg border text-sm font-bold transition-all w-[220px] justify-start",
                      vencimentoManual ? "bg-card border-warning/60 text-warning" : "bg-card border-border text-muted-foreground animate-pulse")}>
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
                      <span className="text-warning font-bold">{diasUteisVenc}</span> dias úteis
                      {diasUteisVenc > 0 && (
                        <span className="ml-2">· CDI: <span className="text-warning font-bold">{formatPercent(calcCdiPeriodo(diasUteisVenc, cdiAnual))}</span></span>
                      )}
                    </div>
                  )}
                  <button onClick={handleSaveVenc}
                    className="flex items-center gap-2 px-5 py-2.5 bg-primary hover:bg-primary/90 rounded-lg text-sm font-black text-primary-foreground transition-all shadow-lg active:scale-[0.97]">
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
        <div className={cn("grid gap-4 mb-6", topCollars.length === 1 ? "grid-cols-1" : topCollars.length === 2 ? "grid-cols-1 md:grid-cols-2" : "grid-cols-1 md:grid-cols-3")}>
          {topCollars.map((collar, i) => {
            const isWinner = i === 0;
            const trophyImg = i === 0 ? trophyGold : i === 1 ? trophySilver : trophyBronze;
            return (
              <div key={`top-${i}`}
                onClick={() => setSelectedCollar(collar)}
                className={cn(
                  "relative overflow-hidden rounded-2xl border transition-all duration-300 cursor-pointer",
                  isWinner
                    ? "bg-card border-success/40 shadow-[0_0_30px_hsl(var(--success)/0.15)] ring-1 ring-success/20"
                    : "bg-card border-border hover:border-muted-foreground/30 hover:shadow-md"
                )}
              >
                {isWinner && (
                  <span className="absolute top-3 right-3 flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75" />
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-success" />
                  </span>
                )}

                {/* Header */}
                <div className={cn(
                  "flex items-center gap-3 px-5 py-3",
                  isWinner ? "bg-success/5" : "bg-muted/30"
                )}>
                  <img src={trophyImg} alt="" className="w-8 h-8 object-contain" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-black text-foreground">{collar.familyName}</p>
                    <p className="text-xs text-muted-foreground">{formatBRL(collar.stockUlt ?? collar.stockAsk)}</p>
                  </div>
                  <span className={cn("text-xs uppercase tracking-widest font-black px-2 py-0.5 rounded-full",
                    collar.custoTipo === "Crédito" ? "bg-success/10 text-success" :
                    collar.custoTipo === "Zero-Cost" ? "bg-warning/10 text-warning" :
                    "bg-destructive/10 text-destructive")}>{collar.custoTipo}</span>
                </div>

                {/* Risk Free banner */}
                {collar.isRiskFree && (
                  <div className="mx-4 mt-3 flex items-center gap-2 px-3 py-2 rounded-xl bg-success/10 border border-success/30 animate-pulse">
                    <ShieldCheck className="w-4 h-4 text-success" />
                    <span className="text-xs font-black uppercase tracking-widest text-success">
                      🛡️ Risco Zero
                    </span>
                  </div>
                )}

                <div className="p-4 space-y-3">
                  {/* Call / Put row */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800/50 px-3 py-2">
                      <p className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase mb-0.5">V Call</p>
                      <p className="text-sm font-black text-foreground">{collar.callSymbol ?? "—"}</p>
                      <p className="text-xs text-muted-foreground">Strike {formatBRL(collar.callStrike)} · Bid {formatBRL(collar.callBid)}</p>
                    </div>
                    <div className="rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/50 px-3 py-2">
                      <p className="text-xs font-bold text-red-600 dark:text-red-400 uppercase mb-0.5">C Put</p>
                      <p className="text-sm font-black text-foreground">{collar.putSymbol ?? "—"}</p>
                      <p className="text-xs text-muted-foreground">Strike {formatBRL(collar.putStrike)} · Ask {formatBRL(collar.putAsk)}</p>
                    </div>
                  </div>

                  {/* Custo */}
                  <div className="bg-muted/50 rounded-lg px-3 py-2 flex items-center justify-between">
                    <span className="text-xs font-bold text-muted-foreground uppercase">Custo Collar</span>
                    <span className={cn("text-lg font-black", (collar.custoCollar ?? 0) <= 0 ? "text-success" : "text-destructive")}>
                      {formatBRL(collar.custoCollar)} {(collar.custoCollar ?? 0) <= -0.05 ? "💰" : (collar.custoCollar ?? 0) < 0.05 ? "⚖️" : "💸"}
                    </span>
                  </div>

                  {/* Rentabilidade 3 cenários */}
                  <div className="grid grid-cols-3 gap-2">
                    <div className="text-center rounded-lg border border-destructive/20 bg-destructive/5 p-2">
                      <TrendingDown className="w-3.5 h-3.5 mx-auto text-destructive mb-0.5" />
                      <p className="text-xs text-destructive font-bold uppercase">Baixa</p>
                      <p className={cn("text-sm font-black", (collar.rentBaixa ?? 0) >= 0 ? "text-success" : "text-destructive")}>
                        {formatPercent(collar.rentBaixa)}
                      </p>
                    </div>
                    <div className="text-center rounded-lg border border-warning/20 bg-warning/5 p-2">
                      <Minus className="w-3.5 h-3.5 mx-auto text-warning mb-0.5" />
                      <p className="text-xs text-warning font-bold uppercase">Neutra</p>
                      <p className={cn("text-sm font-black", (collar.rentNeutra ?? 0) >= 0 ? "text-success" : "text-destructive")}>
                        {formatPercent(collar.rentNeutra)}
                      </p>
                    </div>
                    <div className="text-center rounded-lg border border-success/20 bg-success/5 p-2">
                      <TrendingUp className="w-3.5 h-3.5 mx-auto text-success mb-0.5" />
                      <p className="text-xs text-success font-bold uppercase">Alta</p>
                      <p className={cn("text-sm font-black", (collar.rentAlta ?? 0) >= 0 ? "text-success" : "text-destructive")}>
                        {formatPercent(collar.rentAlta)}
                      </p>
                    </div>
                  </div>

                  {/* Bottom metrics */}
                  <div className="flex flex-wrap items-center gap-3 text-xs">
                    <span className="text-muted-foreground">
                      Meses: <span className="font-bold text-foreground">{calcMeses(collar.diasUteis)}</span>
                    </span>
                    <span className="text-muted-foreground">
                      CDI: <span className="font-bold text-warning">{formatPercent(collar.cdiPeriodo)}</span>
                    </span>
                    {(() => {
                      const activeScore = rankingMethod === "combinado" ? collar.scoreCombinado.toFixed(1)
                        : rankingMethod === "per" ? (collar.per === Infinity ? "∞" : collar.per?.toFixed(1) ?? "—")
                        : rankingMethod === "custo" ? formatBRL(collar.custoCollar)
                        : collar.qualityScore;
                      const label = rankingMethod === "combinado" ? "Comb."
                        : rankingMethod === "per" ? "PER"
                        : rankingMethod === "custo" ? "Custo"
                        : "Score";
                      return (
                        <span className={cn("font-black px-1.5 py-0.5 rounded-full text-xs",
                          collar.qualityScore >= 80 ? "bg-success/10 text-success" :
                          collar.qualityScore >= 60 ? "bg-warning/10 text-warning" :
                          "bg-muted text-muted-foreground")}>
                          {label} {activeScore}
                        </span>
                      );
                    })()}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* PAYOFF CHART */}
      {selectedCollar && payoffData.length > 0 && (
        <div className="mb-6 rounded-2xl border-2 border-primary/30 bg-card overflow-hidden shadow-sm">
          <div className="flex items-center justify-between px-5 py-4 bg-muted/30 border-b border-border/50">
            <div className="flex items-center gap-3">
              <BarChart3 className="w-5 h-5 text-primary" />
              <div>
                <h3 className="text-sm font-black text-foreground uppercase tracking-wider">
                  Gráfico Payoff — Collar {selectedCollar.familyName}
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {selectedCollar.callSymbol} (V Call) + {selectedCollar.putSymbol} (C Put) · Score: {selectedCollar.qualityScore}
                </p>
              </div>
            </div>
            <button onClick={() => setSelectedCollar(null)}
              className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Metrics row */}
          <div className="px-5 py-3 grid grid-cols-2 sm:grid-cols-4 gap-3 border-b border-border/30 bg-muted/10">
            <div>
              <p className="text-xs font-black uppercase text-muted-foreground flex items-center gap-1">
                <TrendingUp className="h-3 w-3 text-success" /> Ganho Máx (Teto)
              </p>
              <p className="text-sm font-black text-success">{formatPercent(selectedCollar.rentAlta)}</p>
              {selectedCollar.diffCdiAlta !== null && (
                <p className={cn("text-[10px] font-bold font-mono", selectedCollar.diffCdiAlta >= 0 ? "text-success" : "text-destructive")}>
                  {selectedCollar.diffCdiAlta >= 0 ? "+" : ""}{selectedCollar.diffCdiAlta.toFixed(2).replace(".", ",")} pp vs CDI
                </p>
              )}
            </div>
            <div>
              <p className="text-xs font-black uppercase text-muted-foreground flex items-center gap-1">
                <TrendingDown className="h-3 w-3 text-destructive" /> Perda Máx (Piso)
              </p>
              <p className="text-sm font-black text-destructive">{formatPercent(selectedCollar.rentBaixa)}</p>
              {selectedCollar.diffCdiBaixa !== null && (
                <p className={cn("text-[10px] font-bold font-mono", selectedCollar.diffCdiBaixa >= 0 ? "text-success" : "text-destructive")}>
                  {selectedCollar.diffCdiBaixa >= 0 ? "+" : ""}{selectedCollar.diffCdiBaixa.toFixed(2).replace(".", ",")} pp vs CDI
                </p>
              )}
            </div>
            <div>
              <p className="text-xs font-black uppercase text-muted-foreground">Custo Collar</p>
              <p className={cn("text-sm font-black", (selectedCollar.custoCollar ?? 0) <= 0 ? "text-success" : "text-warning")}>
                {formatBRL(selectedCollar.custoCollar)}
              </p>
              {selectedCollar.custoLiquidoPct !== null && (
                <p className="text-[10px] font-mono text-muted-foreground">
                  {selectedCollar.custoLiquidoPct.toFixed(2).replace(".", ",")}% do ativo
                </p>
              )}
            </div>
            <div>
              <p className="text-xs font-black uppercase text-muted-foreground">CDI Período</p>
              <p className="text-sm font-black text-warning">{formatPercent(selectedCollar.cdiPeriodo)}</p>
              {selectedCollar.per !== null && (
                <p className="text-[10px] font-mono text-muted-foreground">
                  PER: {selectedCollar.per === Infinity ? "∞" : selectedCollar.per.toFixed(1)}
                </p>
              )}
            </div>
          </div>

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
                    <ReferenceLine x={selectedCollar.stockAsk} stroke="hsl(var(--primary))" strokeWidth={2.5}
                      label={{ value: `PREÇO ${selectedCollar.stockAsk.toFixed(2)}`, position: "top", fill: "hsl(var(--primary))", fontSize: 11, fontWeight: 900 }} />
                  )}
                  {selectedBreakeven && (
                    <ReferenceLine x={selectedBreakeven} stroke="hsl(45 95% 55%)" strokeDasharray="4 2" strokeWidth={1.5}
                      label={{ value: `BE ${selectedBreakeven.toFixed(2)}`, position: "insideTopRight", fill: "hsl(45 95% 55%)", fontSize: 10, fontWeight: 700 }} />
                  )}
                  <Tooltip content={<CollarChartTooltip />} />
                  <Area type="monotone" dataKey="payoffExpiry" stroke="none" fill="url(#collarLoss)"
                    isAnimationActive={false} baseValue={0} activeDot={false} />
                  <Line name="Hoje (T+0)" type="monotone" dataKey="payoffToday"
                    stroke="hsl(142 76% 36%)" strokeWidth={2} strokeDasharray="5 5"
                    dot={false} isAnimationActive={false} />
                  <Line name="No Vencimento" type="monotone" dataKey="payoffExpiry"
                    stroke="hsl(217 91% 60%)" strokeWidth={3} dot={false} isAnimationActive={false} />
                  {selectedCollar.stockAsk && (() => {
                    const closest = payoffData.reduce((prev, curr) =>
                      Math.abs(curr.price - selectedCollar.stockAsk!) < Math.abs(prev.price - selectedCollar.stockAsk!) ? curr : prev
                    );
                    return (
                      <ReferenceDot x={closest.price} y={closest.payoffExpiry}
                        r={6} fill="hsl(var(--primary))" stroke="white" strokeWidth={2} />
                    );
                  })()}
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
                <span className="w-6 h-0.5 rounded" style={{ display: "inline-block", background: "hsl(142 76% 36%)", borderStyle: "dashed" }} />
                <span className="text-muted-foreground font-bold">Hoje (T+0)</span>
              </span>
              <span className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-primary" style={{ display: "inline-block" }} />
                <span className="text-muted-foreground font-bold">Preço Atual</span>
              </span>
            </div>

            {/* Structure summary */}
            <div className="mt-4 p-3 rounded-xl bg-muted/30 border border-border/50">
              <div className="grid grid-cols-3 gap-4 text-xs">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-foreground" />
                  <span className="text-muted-foreground">Compra <span className="font-black text-foreground">{selectedCollar.familyName}</span></span>
                  <span className="ml-auto font-bold">{formatBRL(selectedCollar.stockAsk)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-red-500" />
                  <span className="text-muted-foreground">C Put <span className="font-black text-foreground">{selectedCollar.putSymbol}</span></span>
                  <span className="ml-auto font-bold">Strike {formatBRL(selectedCollar.putStrike)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-blue-500" />
                  <span className="text-muted-foreground">V Call <span className="font-black text-foreground">{selectedCollar.callSymbol}</span></span>
                  <span className="ml-auto font-bold">Strike {formatBRL(selectedCollar.callStrike)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ADD FAMILY */}
      <div className="mb-5 p-4 rounded-2xl border border-border bg-card shadow-sm">
        <h3 className="text-sm font-black mb-3 text-foreground flex items-center gap-2 uppercase tracking-wider">
          <Plus className="w-4 h-4 text-primary" /> Adicionar Ação
        </h3>
        <div className="flex gap-2">
          <input
            type="text" value={newFamilyName}
            onChange={(e) => setNewFamilyName(e.target.value.toUpperCase())}
            onKeyDown={(e) => e.key === "Enter" && addFamily()}
            placeholder="Ex: PETR, VALE, BOVA"
            className="flex-1 bg-background border border-input rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary"
          />
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
          if (filterCusto !== "Todos" && c.custoTipo !== filterCusto) return false;
          if (hideNegative && c.rentAlta !== null && c.rentAlta < 0) return false;
          if (onlyRiskFree && !c.isRiskFree) return false;
          return true;
        });
        const stockTicker = familyStockTickers(family.name);
        const stockRow = rows.get(stockTicker) || rows.get(family.name);
        const stockPrice = stockRow?.ultimo;
        const calls = family.tickers.filter((t) => t.type === "CALL");
        const puts = family.tickers.filter((t) => t.type === "PUT");
        const autoImported = autoImportedMap.get(family.name);

        return (
          <div key={family.id} className="mb-4 rounded-2xl border-2 border-primary/30 bg-card overflow-hidden shadow-sm">
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
                          <th className="text-center py-2 px-1">🛡️</th>
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
                          <th className="text-right py-2 px-2" title="Baixa vs CDI (pp)">↓ vs CDI</th>
                          <th className="text-right py-2 px-2" title="Alta vs CDI (pp)">↑ vs CDI</th>
                          <th className="text-right py-2 px-2" title="Protection Efficiency Ratio">PER</th>
                          <th className="text-center py-2 px-1">Score</th>
                          <th className="text-center py-2 px-2">Rating</th>
                        </tr>
                      </thead>
                      <tbody>
                        {collars.map((c, ci) => (
                          <tr key={ci}
                            onClick={() => setSelectedCollar({ ...c, familyName: family.name })}
                            className={cn("border-b border-border/30 hover:bg-muted/20 transition-colors cursor-pointer",
                            ci === 0 && "bg-success/5",
                            c.isRiskFree && "bg-success/5",
                            selectedCollar?.callSymbol === c.callSymbol && selectedCollar?.putSymbol === c.putSymbol && "ring-2 ring-primary/50 bg-primary/5")}>
                            <td className="py-2 px-1 text-center">
                              {c.isRiskFree ? <ShieldCheck className="w-3.5 h-3.5 mx-auto text-success" /> : <span className="text-muted-foreground/30">—</span>}
                            </td>
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
                            <td className={cn("py-2 px-2 text-right font-black", (c.custoCollar ?? 0) <= 0 ? "text-success" : "text-destructive")}>{formatBRL(c.custoCollar)}</td>
                            <td className={cn("py-2 px-2 text-right font-bold", (c.rentBaixa ?? 0) >= 0 ? "text-success" : "text-destructive")}>
                              {formatPercent(c.rentBaixa)}
                            </td>
                            <td className={cn("py-2 px-2 text-right font-bold", (c.rentNeutra ?? 0) >= 0 ? "text-success" : "text-destructive")}>
                              {formatPercent(c.rentNeutra)}
                            </td>
                            <td className={cn("py-2 px-2 text-right font-bold", (c.rentAlta ?? 0) >= 0 ? "text-success" : "text-destructive")}>
                              {formatPercent(c.rentAlta)}
                            </td>
                            <td className="py-2 px-2 text-right text-warning">{formatPercent(c.cdiPeriodo)}</td>
                            <td className={cn("py-2 px-2 text-right font-bold font-mono",
                              (c.diffCdiBaixa ?? 0) >= 0 ? "text-success" : "text-destructive")}>
                              {c.diffCdiBaixa !== null ? `${c.diffCdiBaixa >= 0 ? "+" : ""}${c.diffCdiBaixa.toFixed(2).replace(".", ",")} pp` : "—"}
                            </td>
                            <td className={cn("py-2 px-2 text-right font-bold font-mono",
                              (c.diffCdiAlta ?? 0) >= 0 ? "text-success" : "text-destructive")}>
                              {c.diffCdiAlta !== null ? `${c.diffCdiAlta >= 0 ? "+" : ""}${c.diffCdiAlta.toFixed(2).replace(".", ",")} pp` : "—"}
                            </td>
                            <td className="py-2 px-2 text-right font-mono text-muted-foreground">
                              {c.per === null ? "—" : c.per === Infinity ? "∞" : c.per.toFixed(1)}
                            </td>
                            <td className="py-2 px-1 text-center">
                              <span className={cn("text-xs font-black px-1.5 py-0.5 rounded-full",
                                c.qualityScore >= 80 ? "bg-success/10 text-success" :
                                c.qualityScore >= 60 ? "bg-warning/10 text-warning" :
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
