import { AbsoluteFill, useCurrentFrame, interpolate, spring, useVideoConfig } from "remotion";
import { C } from "../colors";
import { loadFont } from "@remotion/google-fonts/PlusJakartaSans";
import { loadFont as loadMono } from "@remotion/google-fonts/JetBrainsMono";
import { Caption } from "../components/Caption";

const { fontFamily } = loadFont("normal", { weights: ["400", "600", "700", "800"], subsets: ["latin"] });
const { fontFamily: monoFont } = loadMono("normal", { weights: ["400", "500"], subsets: ["latin"] });

const tickers = [
  { symbol: "PETR4", price: 38.42, change: +1.23, pct: "+3.31%" },
  { symbol: "VALE3", price: 62.18, change: -0.54, pct: "-0.86%" },
  { symbol: "BBAS3", price: 27.95, change: +0.82, pct: "+3.02%" },
  { symbol: "WEGE3", price: 41.30, change: +0.15, pct: "+0.36%" },
  { symbol: "ITUB4", price: 33.60, change: -0.28, pct: "-0.83%" },
];

const options = [
  { code: "PETRA280", type: "CALL", strike: "28.00", bid: "1.52", ask: "1.55", vol: "32.1%" },
  { code: "PETRA300", type: "CALL", strike: "30.00", bid: "0.78", ask: "0.82", vol: "28.5%" },
  { code: "PETRM280", type: "PUT", strike: "28.00", bid: "0.45", ask: "0.48", vol: "35.2%" },
  { code: "PETRM300", type: "PUT", strike: "30.00", bid: "1.90", ask: "1.95", vol: "30.8%" },
];

export const Scene3TempoReal: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const labelOp = interpolate(frame, [0, 20], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  // Simulated live dot blinking
  const dotOpacity = interpolate(Math.sin(frame * 0.15), [-1, 1], [0.3, 1]);

  return (
    <AbsoluteFill style={{ fontFamily, padding: 40 }}>
      {/* Section label */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 24, opacity: labelOp }}>
        <div style={{
          width: 10,
          height: 10,
          borderRadius: "50%",
          background: C.success,
          opacity: dotOpacity,
          boxShadow: `0 0 8px ${C.success}`,
        }} />
        <span style={{ fontSize: 16, color: C.primary, fontWeight: 700, letterSpacing: 3, textTransform: "uppercase" as const }}>
          TEMPO REAL — DADOS AO VIVO
        </span>
      </div>

      {/* Ticker strip */}
      <div style={{
        display: "flex",
        gap: 12,
        marginBottom: 28,
        overflow: "hidden",
      }}>
        {tickers.map((t, i) => {
          const delay = i * 8;
          const op = interpolate(frame, [delay + 10, delay + 30], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
          const y = interpolate(spring({ frame: frame - delay - 10, fps, config: { damping: 18 } }), [0, 1], [30, 0]);
          const isUp = t.change > 0;
          // Price fluctuation simulation
          const priceWiggle = Math.sin(frame * 0.08 + i * 2) * 0.03;
          const displayPrice = (t.price + priceWiggle).toFixed(2);
          return (
            <div key={i} style={{
              flex: 1,
              background: C.bgCard,
              border: `1px solid ${C.border}`,
              borderRadius: 12,
              padding: "14px 16px",
              opacity: op,
              transform: `translateY(${y}px)`,
            }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: C.foreground, marginBottom: 4 }}>{t.symbol}</div>
              <div style={{ fontSize: 22, fontWeight: 600, color: C.foreground, fontFamily: monoFont }}>
                {displayPrice}
              </div>
              <div style={{
                fontSize: 13,
                color: isUp ? C.success : C.destructive,
                fontFamily: monoFont,
                marginTop: 4,
              }}>
                {isUp ? "▲" : "▼"} {t.pct}
              </div>
            </div>
          );
        })}
      </div>

      {/* Options table header */}
      <div style={{
        background: C.primary + "15",
        borderRadius: 12,
        border: `1px solid ${C.border}`,
        overflow: "hidden",
        opacity: interpolate(frame, [50, 70], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
      }}>
        <div style={{
          display: "flex",
          padding: "12px 20px",
          borderBottom: `1px solid ${C.border}`,
          fontSize: 12,
          color: C.muted,
          fontWeight: 600,
          textTransform: "uppercase" as const,
          letterSpacing: 1,
        }}>
          <div style={{ flex: 2 }}>Código</div>
          <div style={{ flex: 1 }}>Tipo</div>
          <div style={{ flex: 1, textAlign: "right" as const }}>Strike</div>
          <div style={{ flex: 1, textAlign: "right" as const }}>Bid</div>
          <div style={{ flex: 1, textAlign: "right" as const }}>Ask</div>
          <div style={{ flex: 1, textAlign: "right" as const }}>Vol. Impl.</div>
        </div>
        {options.map((o, i) => {
          const delay = 60 + i * 12;
          const rowOp = interpolate(frame, [delay, delay + 20], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
          const isCall = o.type === "CALL";
          // Price tick animation
          const bidWiggle = Math.sin(frame * 0.1 + i * 3) * 0.02;
          const askWiggle = Math.sin(frame * 0.12 + i * 2) * 0.02;
          return (
            <div key={i} style={{
              display: "flex",
              padding: "14px 20px",
              borderBottom: i < options.length - 1 ? `1px solid ${C.border}` : "none",
              fontSize: 15,
              fontFamily: monoFont,
              opacity: rowOp,
              background: i % 2 === 0 ? "transparent" : C.bg + "40",
            }}>
              <div style={{ flex: 2, color: C.foreground, fontWeight: 600 }}>{o.code}</div>
              <div style={{
                flex: 1,
                color: isCall ? C.success : C.destructive,
                fontWeight: 600,
              }}>{o.type}</div>
              <div style={{ flex: 1, textAlign: "right" as const, color: C.foreground }}>{o.strike}</div>
              <div style={{ flex: 1, textAlign: "right" as const, color: C.success }}>
                {(parseFloat(o.bid) + bidWiggle).toFixed(2)}
              </div>
              <div style={{ flex: 1, textAlign: "right" as const, color: C.foreground }}>
                {(parseFloat(o.ask) + askWiggle).toFixed(2)}
              </div>
              <div style={{ flex: 1, textAlign: "right" as const, color: C.warning }}>{o.vol}</div>
            </div>
          );
        })}
      </div>

      {/* P&L Live bar */}
      <div style={{
        marginTop: 28,
        display: "flex",
        gap: 16,
        opacity: interpolate(frame, [120, 150], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
      }}>
        <div style={{
          flex: 1,
          background: C.bgCard,
          border: `1px solid ${C.border}`,
          borderRadius: 12,
          padding: 20,
          textAlign: "center" as const,
        }}>
          <div style={{ fontSize: 12, color: C.muted, marginBottom: 6 }}>P&L Atual</div>
          <div style={{
            fontSize: 36,
            fontWeight: 800,
            color: C.success,
            fontFamily: monoFont,
          }}>
            +R$ {(Math.sin(frame * 0.05) * 200 + 850).toFixed(0)}
          </div>
        </div>
        <div style={{
          flex: 1,
          background: C.bgCard,
          border: `1px solid ${C.border}`,
          borderRadius: 12,
          padding: 20,
          textAlign: "center" as const,
        }}>
          <div style={{ fontSize: 12, color: C.muted, marginBottom: 6 }}>Status</div>
          <div style={{
            fontSize: 20,
            fontWeight: 700,
            color: C.success,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
          }}>
            <div style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: C.success,
              opacity: dotOpacity,
              boxShadow: `0 0 6px ${C.success}`,
            }} />
            Conectado ao Profit
          </div>
        </div>
      </div>

      <Caption text="Cotações ao vivo sincronizadas via WebSocket com o Profit Pro — preços atualizados automaticamente" startFrame={20} endFrame={120} />
      <Caption text="Acompanhe P&L em tempo real com status de conexão ao Profit" startFrame={120} />
    </AbsoluteFill>
  );
};
