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
  const { toast } = useToast();

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;
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

        if (msg.type === "rtd_data") {
          setRows((prev) => {
            const next = new Map(prev);
            for (const item of msg.data) {
              const existing = prev.get(item.ticker);
              next.set(item.ticker, {
                ticker: item.ticker,
                ultimo: item.ultimo ?? null,
                strike: item.strike ?? null,
                negocios: item.negocios ?? null,
                ofCompra: item.ofCompra ?? null,
                ofVenda: item.ofVenda ?? null,
                tipo: existing?.tipo ?? "call",
                lado: existing?.lado ?? "buy",
                selecionado: existing?.selecionado ?? false,
                lastUpdate: item.timestamp ?? Date.now(),
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
