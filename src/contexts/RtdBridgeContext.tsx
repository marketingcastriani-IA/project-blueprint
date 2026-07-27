import { createContext, useContext, useCallback, type ReactNode } from "react";
import { useRtdBridge } from "@/hooks/useRtdBridge";
import type { ConStatus, RtdRow } from "@/hooks/useRtdBridge";
import { useEodPrices, type EodData } from "@/hooks/useEodPrices";

export type QuoteFonte = "rt" | "eod";

/** Cotação efetiva: tempo real do Profit quando conectado, senão fim de dia (EOD). */
export interface EffectiveQuote {
  bid: number | null;
  ask: number | null;
  last: number | null;
  strike: number | null;
  negocios: number | null;
  fonte: QuoteFonte;
}

interface RtdBridgeContextValue {
  status: ConStatus;
  rows: Map<string, RtdRow>;
  errorMsg: string;
  reconnectCount: number;
  connect: () => void;
  addTicker: (ticker: string) => void;
  removeTicker: (ticker: string) => void;
  updateRow: (ticker: string, updates: Partial<RtdRow>) => void;
  send: (payload: object) => void;
  // Fim de dia (EOD) — fallback quando o Profit não está ao vivo
  eod: EodData;
  eodDate: string | null;
  eodReady: boolean;
  /** Resolve a melhor cotação disponível para um ticker (RT se ao vivo, senão EOD). */
  resolveQuote: (ticker: string, catalogStrike?: number | null) => EffectiveQuote | null;
  /**
   * Row efetiva para um ticker: a do Profit se estiver ao vivo, senão uma row
   * sintética montada do fim de dia (EOD). Mesmo shape de RtdRow (campo _fonte marca a origem).
   * Permite trocar `rows.get(t)` por `getRow(t)` sem alterar o resto da lógica.
   */
  getRow: (ticker: string) => RtdRow | null;
}

const inferTipo = (ticker: string): "call" | "put" | "stock" => {
  const m = ticker.toUpperCase().match(/^[A-Z]{4,5}([A-X])\d/);
  if (!m) return "stock";
  return m[1].charCodeAt(0) - 65 <= 11 ? "call" : "put";
};

const RtdBridgeContext = createContext<RtdBridgeContextValue | null>(null);

export function RtdBridgeProvider({ children }: { children: ReactNode }) {
  const bridge = useRtdBridge();
  const eod = useEodPrices();

  const resolveQuote = useCallback(
    (ticker: string, catalogStrike?: number | null): EffectiveQuote | null => {
      const t = ticker?.toUpperCase();
      if (!t) return null;
      const row = bridge.rows.get(t);
      const rtValido =
        bridge.status === "connected" &&
        row &&
        (row.ofCompra != null || row.ofVenda != null || row.ultimo != null);
      if (rtValido && row) {
        return {
          bid: row.ofCompra ?? null,
          ask: row.ofVenda ?? null,
          last: row.ultimo ?? null,
          strike: row.strike ?? catalogStrike ?? null,
          negocios: row.negocios ?? null,
          fonte: "rt",
        };
      }
      const e = eod.opcoes.get(t) || eod.ativos.get(t);
      if (e) {
        return {
          bid: e.b ?? null,
          ask: e.a ?? null,
          last: e.u ?? null,
          strike: e.s ?? catalogStrike ?? null,
          negocios: e.n ?? null,
          fonte: "eod",
        };
      }
      return null;
    },
    [bridge.rows, bridge.status, eod]
  );

  const getRow = useCallback(
    (ticker: string): RtdRow | null => {
      const t = ticker?.toUpperCase();
      if (!t) return null;
      const row = bridge.rows.get(t);
      const rtValido =
        bridge.status === "connected" &&
        row &&
        (row.ofCompra != null || row.ofVenda != null || row.ultimo != null);
      if (rtValido && row) return { ...row, _fonte: "rt" };
      const isAtivo = eod.ativos.has(t);
      const e = eod.opcoes.get(t) || eod.ativos.get(t);
      if (e) {
        return {
          ticker: t,
          ultimo: e.u ?? null,
          strike: e.s ?? null,
          negocios: e.n ?? null,
          ofCompra: e.b ?? null,
          ofVenda: e.a ?? null,
          tipo: isAtivo ? "stock" : inferTipo(t),
          lado: "buy",
          selecionado: false,
          lastUpdate: null,
          precoEntrada: null,
          quantidade: 1,
          _fonte: "eod",
        };
      }
      return null;
    },
    [bridge.rows, bridge.status, eod]
  );

  return (
    <RtdBridgeContext.Provider
      value={{ ...bridge, eod, eodDate: eod.data, eodReady: eod.ready, resolveQuote, getRow }}
    >
      {children}
    </RtdBridgeContext.Provider>
  );
}

export function useSharedRtdBridge(): RtdBridgeContextValue {
  const ctx = useContext(RtdBridgeContext);
  if (!ctx) throw new Error("useSharedRtdBridge must be used within RtdBridgeProvider");
  return ctx;
}
