import { AbsoluteFill, useCurrentFrame, interpolate, spring, useVideoConfig } from "remotion";
import { C } from "../colors";
import { loadFont } from "@remotion/google-fonts/PlusJakartaSans";
import { loadFont as loadMono } from "@remotion/google-fonts/JetBrainsMono";

const { fontFamily } = loadFont("normal", { weights: ["400", "600", "700", "800"], subsets: ["latin"] });
const { fontFamily: monoFont } = loadMono("normal", { weights: ["400", "500"], subsets: ["latin"] });

const boxData = [
  { rank: 1, family: "PETR4", strike: "28.00", cost: "27.35", profit: "0.65", pct: "2.37%", cdi: "158%", above: true },
  { rank: 2, family: "VALE3", strike: "62.00", cost: "61.28", profit: "0.72", pct: "1.17%", cdi: "142%", above: true },
  { rank: 3, family: "BBAS3", strike: "30.00", cost: "29.65", profit: "0.35", pct: "1.18%", cdi: "132%", above: true },
  { rank: 4, family: "WEGE3", strike: "42.00", cost: "41.58", profit: "0.42", pct: "1.01%", cdi: "121%", above: true },
  { rank: 5, family: "ITUB4", strike: "34.00", cost: "33.80", profit: "0.20", pct: "0.59%", cdi: "88%", above: false },
];

export const Scene4BoxTracker: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const labelOp = interpolate(frame, [0, 20], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ fontFamily, padding: 40 }}>
      {/* Section label */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8, opacity: labelOp }}>
        <span style={{ fontSize: 16, color: C.primary, fontWeight: 700, letterSpacing: 3, textTransform: "uppercase" as const }}>
          ▸ RASTREADOR DE BOX
        </span>
      </div>
      <div style={{ fontSize: 14, color: C.muted, marginBottom: 24, opacity: labelOp }}>
        Top 5 Box Spreads — Ranking por % do CDI
      </div>

      {/* Winner card */}
      <div style={{
        background: `linear-gradient(135deg, ${C.bgCard}, ${C.success}15)`,
        border: `2px solid ${C.success}40`,
        borderRadius: 16,
        padding: 28,
        marginBottom: 24,
        opacity: interpolate(frame, [15, 40], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
        transform: `scale(${interpolate(spring({ frame: frame - 15, fps, config: { damping: 15 } }), [0, 1], [0.95, 1])})`,
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 13, color: C.muted, marginBottom: 4 }}>🏆 Melhor Box Spread</div>
            <div style={{ fontSize: 32, fontWeight: 800, color: C.foreground }}>PETR4</div>
            <div style={{ fontSize: 14, color: C.muted, marginTop: 4, fontFamily: monoFont }}>
              Strike: R$ 28.00 · Custo: R$ 27.35
            </div>
          </div>
          <div style={{ textAlign: "right" as const }}>
            <div style={{
              fontSize: 52,
              fontWeight: 800,
              color: C.success,
              fontFamily: monoFont,
              lineHeight: 1,
            }}>
              158%
            </div>
            <div style={{ fontSize: 14, color: C.success, marginTop: 4 }}>
              ▲ 58% acima do CDI
            </div>
          </div>
        </div>
      </div>

      {/* Table */}
      <div style={{
        background: C.bgCard,
        border: `1px solid ${C.border}`,
        borderRadius: 12,
        overflow: "hidden",
      }}>
        {/* Header */}
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
          <div style={{ width: 40 }}>#</div>
          <div style={{ flex: 2 }}>Família</div>
          <div style={{ flex: 1, textAlign: "right" as const, background: "#6b7280", color: "#111", borderRadius: 4, padding: "2px 8px" }}>Strike</div>
          <div style={{ flex: 1, textAlign: "right" as const }}>Custo</div>
          <div style={{ flex: 1, textAlign: "right" as const }}>Lucro</div>
          <div style={{ flex: 1, textAlign: "right" as const }}>% do CDI</div>
        </div>
        {/* Rows */}
        {boxData.map((row, i) => {
          const delay = 40 + i * 15;
          const rowOp = interpolate(frame, [delay, delay + 20], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
          const rowX = interpolate(spring({ frame: frame - delay, fps, config: { damping: 20 } }), [0, 1], [30, 0]);
          return (
            <div key={i} style={{
              display: "flex",
              padding: "14px 20px",
              borderBottom: i < boxData.length - 1 ? `1px solid ${C.border}` : "none",
              fontSize: 15,
              fontFamily: monoFont,
              opacity: rowOp,
              transform: `translateX(${rowX}px)`,
              alignItems: "center",
              background: i === 0 ? C.success + "08" : "transparent",
            }}>
              <div style={{ width: 40, fontWeight: 700, color: i === 0 ? C.warning : C.muted }}>
                {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${row.rank}`}
              </div>
              <div style={{ flex: 2, color: C.foreground, fontWeight: 600 }}>{row.family}</div>
              <div style={{ flex: 1, textAlign: "right" as const, color: "#111", fontWeight: 600, background: "#d1d5db", borderRadius: 4, padding: "2px 8px" }}>
                {row.strike}
              </div>
              <div style={{ flex: 1, textAlign: "right" as const, color: C.foreground }}>{row.cost}</div>
              <div style={{ flex: 1, textAlign: "right" as const, color: C.success }}>+{row.profit}</div>
              <div style={{
                flex: 1,
                textAlign: "right" as const,
                fontWeight: 700,
                fontSize: 16,
                color: row.above ? C.success : C.destructive,
              }}>
                {row.cdi}
              </div>
            </div>
          );
        })}
      </div>

      {/* CDI info bar */}
      <div style={{
        marginTop: 24,
        display: "flex",
        gap: 16,
        opacity: interpolate(frame, [140, 170], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
      }}>
        <div style={{
          flex: 1,
          background: C.bgCard,
          border: `1px solid ${C.border}`,
          borderRadius: 12,
          padding: 18,
          textAlign: "center" as const,
        }}>
          <div style={{ fontSize: 12, color: C.muted, marginBottom: 4 }}>CDI no período</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: C.warning, fontFamily: monoFont }}>0.83%</div>
        </div>
        <div style={{
          flex: 1,
          background: C.bgCard,
          border: `1px solid ${C.border}`,
          borderRadius: 12,
          padding: 18,
          textAlign: "center" as const,
        }}>
          <div style={{ fontSize: 12, color: C.muted, marginBottom: 4 }}>Benchmark</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: C.primary, fontFamily: monoFont }}>100% CDI</div>
        </div>
        <div style={{
          flex: 1,
          background: C.bgCard,
          border: `1px solid ${C.border}`,
          borderRadius: 12,
          padding: 18,
          textAlign: "center" as const,
        }}>
          <div style={{ fontSize: 12, color: C.muted, marginBottom: 4 }}>Melhor retorno</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: C.success, fontFamily: monoFont }}>158% CDI</div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
