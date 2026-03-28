import { createContext, useContext, type ReactNode } from "react";
import { useRtdBridge } from "@/hooks/useRtdBridge";
import type { ConStatus, RtdRow } from "@/hooks/useRtdBridge";

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
}

const RtdBridgeContext = createContext<RtdBridgeContextValue | null>(null);

export function RtdBridgeProvider({ children }: { children: ReactNode }) {
  const bridge = useRtdBridge();
  return (
    <RtdBridgeContext.Provider value={bridge}>
      {children}
    </RtdBridgeContext.Provider>
  );
}

export function useSharedRtdBridge(): RtdBridgeContextValue {
  const ctx = useContext(RtdBridgeContext);
  if (!ctx) throw new Error("useSharedRtdBridge must be used within RtdBridgeProvider");
  return ctx;
}
