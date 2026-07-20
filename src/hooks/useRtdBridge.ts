import { useState, useRef, useCallback, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";

// ─── Types ───────────────────────────────────────────────────────────────────

export type ConStatus = "disconnected" | "connecting" | "connected" | "error";

export interface RtdRow {
  ticker: string;
  ultimo: number | null;
  strike: number | null;
  negocios: number | null;
  ofCompra: number | null;
  ofVenda: number | null;
  vInt?: number | null;
  vExt?: number | null;
  abe?: number | null;
  aju?: number | null;
  aja?: number | null;
  fec?: number | null;
  max?: number | null;
  min?: number | null;
  med?: number | null;
  lmax?: number | null;
  lmin?: number | null;
  prt?: number | null;
  acp?: number | null;
  avd?: number | null;
  est?: string | null;
  qtt?: number | null;
  qte?: number | null;
  qul?: number | null;
  vol?: number | null;
  vpj?: number | null;
  voc?: number | null;
  vov?: number | null;
  cab?: number | null;
  dat?: string | null;
  hor?: string | null;
  val?: string | null;
  ven?: string | null;
  variacaoPct?: number | null;
  variacaoPts?: number | null;
  tipo: "call" | "put" | "stock";
  lado: "buy" | "sell";
  selecionado: boolean;
  lastUpdate: number | null;
  precoEntrada: number | null;
  quantidade: number;
  expiryDate?: string;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const WS_URL = "ws://localhost:8765";
const RECONNECT_DELAY = 3000;
const MAX_RECONNECT = 10;

export const PROFIT_RTD_ATTRIBUTE_CATALOG = {
  periodos: {
    "3M": "3 meses",
    "6M": "6 meses",
    "12M": "12 meses",
    ANO: "Ano",
    MES: "Mês",
    SEM: "Semana",
    SEMES: "Semestre",
    TRIM: "Trimestre",
  },
  precosELimites: {
    ABE: "Abertura",
    AJU: "Ajuste",
    AJA: "Ajuste Anterior",
    FEC: "Fechamento Anterior",
    MAX: "Máximo",
    MIN: "Mínimo",
    MED: "Média",
    ULT: "Último",
    LMAX: "Limite Máximo",
    LMIN: "Limite Mínimo",
    PRT: "Preço Teórico",
    PEX: "Strike",
  },
  negociacaoEAgentes: {
    ACP: "Agente de Compra",
    AVD: "Agente de Venda",
    OCP: "Oferta de Compra",
    OVD: "Oferta de Venda",
    NEG: "Negócios",
    EST: "Estado Atual",
  },
  quantidadesEVolumes: {
    QTT: "Quantidade",
    QTE: "Qtd. Teórica",
    QUL: "Quantidade do Último",
    VOL: "Volume",
    VPJ: "Volume Projetado",
    VOC: "Volume de Compra",
    VOV: "Volume de Venda",
    CAB: "Contratos em Aberto",
  },
  tempoEVariacao: {
    DAT: "Data",
    HOR: "Hora",
    VAL: "Validade",
    VEN: "Vencimento",
    VAR: "Variação (%)",
    VARPTS: "Variação (pts)",
    VINT: "Valor Intrínseco",
    VEXT: "Valor Extrínseco",
  },
} as const;

const PROFIT_FIELD_ALIASES = {
  ticker: ["ticker", "symbol", "ativo", "codigo"],
  timestamp: ["timestamp", "ts", "time"],
  ultimo: ["ultimo", "ult", "batida"],
  strike: ["strike", "pex"],
  negocios: ["negocios", "neg"],
  ofCompra: ["ofcompra", "ocp"],
  ofVenda: ["ofvenda", "ovd"],
  vInt: ["vint", "vintrinseco", "valorintrinseco"],
  vExt: ["vext", "vextrinseco", "valorextrinseco"],
  abe: ["abe"],
  aju: ["aju"],
  aja: ["aja"],
  fec: ["fec"],
  max: ["max"],
  min: ["min"],
  med: ["med"],
  lmax: ["lmax"],
  lmin: ["lmin"],
  prt: ["prt"],
  acp: ["acp"],
  avd: ["avd"],
  est: ["est"],
  qtt: ["qtt"],
  qte: ["qte"],
  qul: ["qul"],
  vol: ["vol"],
  vpj: ["vpj"],
  voc: ["voc"],
  vov: ["vov"],
  cab: ["cab"],
  dat: ["dat"],
  hor: ["hor"],
  val: ["val"],
  ven: ["ven"],
  variacaoPct: ["var"],
  variacaoPts: ["varpts"],
} as const;

const normalizeNumberString = (raw: string): string => {
  const value = raw.trim().replace(/\s/g, "");
  if (/^-?\d{1,3}(\.\d{3})+,\d+$/.test(value)) return value.replace(/\./g, "").replace(",", ".");
  if (/^-?\d{1,3}(,\d{3})+\.\d+$/.test(value)) return value.replace(/,/g, "");
  if (/^-?\d+,\d+$/.test(value)) return value.replace(",", ".");
  return value;
};

const parseNum = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v === "string") {
    const normalized = normalizeNumberString(v);
    if (!normalized) return null;
    const n = Number(normalized);
    return Number.isFinite(n) ? n : null;
  }
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

const parseText = (v: unknown): string | null => {
  if (v === null || v === undefined) return null;
  const text = String(v).trim();
  return text || null;
};

const parseTimestamp = (v: unknown): number | null => {
  const numeric = parseNum(v);
  if (numeric !== null) return numeric;
  const text = parseText(v);
  if (!text) return null;
  const parsed = Date.parse(text);
  return Number.isFinite(parsed) ? parsed : null;
};

const inferTipoFromTicker = (ticker: string): "call" | "put" | "stock" => {
  const match = ticker.toUpperCase().match(/^[A-Z]{4,5}([A-X])/);
  if (!match) return "stock";
  const code = match[1].charCodeAt(0) - 65;
  return code <= 11 ? "call" : "put";
};

const buildLookup = (item: Record<string, unknown>) => {
  const map = new Map<string, unknown>();
  Object.entries(item).forEach(([k, value]) => {
    map.set(k, value);
    map.set(k.toLowerCase(), value);
  });
  return map;
};

const pickValue = (lookup: Map<string, unknown>, aliases: readonly string[]) => {
  for (const alias of aliases) {
    const key = alias.toLowerCase();
    if (!lookup.has(key)) continue;
    const value = lookup.get(key);
    if (value === undefined || value === null) continue;
    if (typeof value === "string" && value.trim() === "") continue;
    return value;
  }
  return null;
};

const keepIncomingOrPrevious = (incoming: number | null, previous: number | null | undefined) =>
  incoming ?? previous ?? null;

const keepBestPrice = (incoming: number | null, previous: number | null | undefined) => {
  if (incoming === null) return previous ?? null;
  if (incoming === 0 && previous !== null && previous !== undefined && previous > 0) return previous;
  return incoming;
};

const numberField = (
  lookup: Map<string, unknown>,
  aliases: readonly string[],
  previous: number | null | undefined,
  preservePreviousOnZero = false
) => {
  const parsed = parseNum(pickValue(lookup, aliases));
  return preservePreviousOnZero
    ? keepBestPrice(parsed, previous)
    : keepIncomingOrPrevious(parsed, previous);
};

const textField = (lookup: Map<string, unknown>, aliases: readonly string[], previous?: string | null) =>
  parseText(pickValue(lookup, aliases)) ?? previous ?? null;

export const statusConfig: Record<ConStatus, { color: string; label: string }> = {
  disconnected: { color: "text-muted-foreground border-border bg-muted/30", label: "Desconectado" },
  connecting:   { color: "text-warning border-warning/30 bg-warning/10", label: "Conectando..." },
  connected:    { color: "text-chart-profit border-chart-profit/30 bg-chart-profit/10", label: "Ao Vivo" },
  error:        { color: "text-destructive border-destructive/30 bg-destructive/10", label: "Erro de Conexão" },
};

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useRtdBridge() {
  const [status, setStatus] = useState<ConStatus>("disconnected");
  const [rows, setRows] = useState<Map<string, RtdRow>>(new Map());
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [reconnectCount, setReconnectCount] = useState(0);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const shouldReconnectRef = useRef(true);
  const { toast } = useToast();

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;
    shouldReconnectRef.current = true;
    setStatus("connecting");

    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      setStatus("connected");
      setErrorMsg("");
      setReconnectCount(0);
      toast({ title: "✅ Bridge conectado!", description: "Dados do Profit chegando em tempo real." });
    };

    ws.onclose = () => {
      // Não reagenda reconexão se o componente já desmontou (evita WebSocket órfão)
      if (!shouldReconnectRef.current) return;
      setStatus("disconnected");
      setReconnectCount((prev) => {
        const next = prev + 1;
        if (next <= MAX_RECONNECT) {
          reconnectTimer.current = setTimeout(connect, RECONNECT_DELAY);
        } else {
          setStatus("error");
          setErrorMsg("Bridge não encontrado após várias tentativas. Inicie o ProfitRTDBridge.exe.");
        }
        return next;
      });
    };

    ws.onerror = () => {
      setErrorMsg("Não foi possível conectar em ws://localhost:8765");
    };

    ws.onmessage = (evt) => {
      try {
        const msg = JSON.parse(evt.data);

        if (msg.type === "rtd_data" && Array.isArray(msg.data)) {
          setRows((prev) => {
            const next = new Map(prev);
            for (const rawItem of msg.data) {
              if (!rawItem || typeof rawItem !== "object") continue;

              const lookup = buildLookup(rawItem as Record<string, unknown>);
              const tickerRaw = pickValue(lookup, PROFIT_FIELD_ALIASES.ticker);
              const ticker = parseText(tickerRaw)?.toUpperCase();
              if (!ticker) continue;

              const existing = prev.get(ticker);
              next.set(ticker, {
                ticker,
                ultimo: numberField(lookup, PROFIT_FIELD_ALIASES.ultimo, existing?.ultimo),
                strike: numberField(lookup, PROFIT_FIELD_ALIASES.strike, existing?.strike, true),
                negocios: numberField(lookup, PROFIT_FIELD_ALIASES.negocios, existing?.negocios),
                ofCompra: numberField(lookup, PROFIT_FIELD_ALIASES.ofCompra, existing?.ofCompra, true),
                ofVenda: numberField(lookup, PROFIT_FIELD_ALIASES.ofVenda, existing?.ofVenda, true),
                vInt: numberField(lookup, PROFIT_FIELD_ALIASES.vInt, existing?.vInt),
                vExt: numberField(lookup, PROFIT_FIELD_ALIASES.vExt, existing?.vExt),
                abe: numberField(lookup, PROFIT_FIELD_ALIASES.abe, existing?.abe),
                aju: numberField(lookup, PROFIT_FIELD_ALIASES.aju, existing?.aju),
                aja: numberField(lookup, PROFIT_FIELD_ALIASES.aja, existing?.aja),
                fec: numberField(lookup, PROFIT_FIELD_ALIASES.fec, existing?.fec),
                max: numberField(lookup, PROFIT_FIELD_ALIASES.max, existing?.max),
                min: numberField(lookup, PROFIT_FIELD_ALIASES.min, existing?.min),
                med: numberField(lookup, PROFIT_FIELD_ALIASES.med, existing?.med),
                lmax: numberField(lookup, PROFIT_FIELD_ALIASES.lmax, existing?.lmax),
                lmin: numberField(lookup, PROFIT_FIELD_ALIASES.lmin, existing?.lmin),
                prt: numberField(lookup, PROFIT_FIELD_ALIASES.prt, existing?.prt),
                acp: numberField(lookup, PROFIT_FIELD_ALIASES.acp, existing?.acp),
                avd: numberField(lookup, PROFIT_FIELD_ALIASES.avd, existing?.avd),
                est: textField(lookup, PROFIT_FIELD_ALIASES.est, existing?.est),
                qtt: numberField(lookup, PROFIT_FIELD_ALIASES.qtt, existing?.qtt),
                qte: numberField(lookup, PROFIT_FIELD_ALIASES.qte, existing?.qte),
                qul: numberField(lookup, PROFIT_FIELD_ALIASES.qul, existing?.qul),
                vol: numberField(lookup, PROFIT_FIELD_ALIASES.vol, existing?.vol),
                vpj: numberField(lookup, PROFIT_FIELD_ALIASES.vpj, existing?.vpj),
                voc: numberField(lookup, PROFIT_FIELD_ALIASES.voc, existing?.voc),
                vov: numberField(lookup, PROFIT_FIELD_ALIASES.vov, existing?.vov),
                cab: numberField(lookup, PROFIT_FIELD_ALIASES.cab, existing?.cab),
                dat: textField(lookup, PROFIT_FIELD_ALIASES.dat, existing?.dat),
                hor: textField(lookup, PROFIT_FIELD_ALIASES.hor, existing?.hor),
                val: textField(lookup, PROFIT_FIELD_ALIASES.val, existing?.val),
                ven: textField(lookup, PROFIT_FIELD_ALIASES.ven, existing?.ven),
                variacaoPct: numberField(lookup, PROFIT_FIELD_ALIASES.variacaoPct, existing?.variacaoPct),
                variacaoPts: numberField(lookup, PROFIT_FIELD_ALIASES.variacaoPts, existing?.variacaoPts),
                tipo: existing?.tipo ?? inferTipoFromTicker(ticker),
                lado: existing?.lado ?? "buy",
                selecionado: existing?.selecionado ?? false,
                lastUpdate:
                  parseTimestamp(pickValue(lookup, PROFIT_FIELD_ALIASES.timestamp)) ?? Date.now(),
                precoEntrada: existing?.precoEntrada ?? null,
                quantidade: existing?.quantidade ?? 1,
                expiryDate: existing?.expiryDate,
              });
            }
            return next;
          });
        }

        if (msg.type === "error") {
          setErrorMsg(msg.message);
          toast({ title: "Erro no Bridge", description: msg.message, variant: "destructive" });
        }
      } catch { /* ignore */ }
    };
  }, [toast]);

  useEffect(() => {
    connect();
    return () => {
      shouldReconnectRef.current = false;
      reconnectTimer.current && clearTimeout(reconnectTimer.current);
      wsRef.current?.close();
    };
  }, [connect]);

  const send = (payload: object) => {
    if (wsRef.current?.readyState === WebSocket.OPEN)
      wsRef.current.send(JSON.stringify(payload));
  };

  const addTicker = useCallback((ticker: string) => send({ type: "add_ticker", ticker }), []);
  const removeTicker = useCallback((ticker: string) => {
    send({ type: "remove_ticker", ticker });
    setRows((prev) => { const n = new Map(prev); n.delete(ticker); return n; });
  }, []);

  const updateRow = useCallback((ticker: string, updates: Partial<RtdRow>) => {
    setRows((prev) => {
      const next = new Map(prev);
      const row = next.get(ticker);
      if (row) next.set(ticker, { ...row, ...updates });
      return next;
    });
  }, []);

  return { status, rows, errorMsg, reconnectCount, connect, addTicker, removeTicker, updateRow, send };
}
