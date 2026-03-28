import { AbsoluteFill, useCurrentFrame, interpolate, spring, useVideoConfig, Sequence } from "remotion";
import { C } from "../colors";
import { loadFont } from "@remotion/google-fonts/PlusJakartaSans";
import { loadFont as loadMono } from "@remotion/google-fonts/JetBrainsMono";
import { Caption } from "../components/Caption";

const { fontFamily } = loadFont("normal", { weights: ["400", "600", "700"], subsets: ["latin"] });
const { fontFamily: monoFont } = loadMono("normal", { weights: ["400", "500"], subsets: ["latin"] });

const Card: React.FC<{ children: React.ReactNode; style?: React.CSSProperties }> = ({ children, style }) => (
  <div style={{
    background: C.bgCard,
    border: `1px solid ${C.border}`,
    borderRadius: 16,
    padding: 24,
    ...style,
  }}>
    {children}
  </div>
);

export const Scene2Dashboard: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Header bar slide down
  const headerY = interpolate(spring({ frame, fps, config: { damping: 20 } }), [0, 1], [-60, 0]);
  // Cards stagger
  const card1Op = interpolate(frame, [20, 45], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const card1Y = interpolate(spring({ frame: frame - 20, fps, config: { damping: 18 } }), [0, 1], [40, 0]);
  const card2Op = interpolate(frame, [35, 60], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const card2Y = interpolate(spring({ frame: frame - 35, fps, config: { damping: 18 } }), [0, 1], [40, 0]);
  // Payoff chart draw
  const chartProgress = interpolate(frame, [60, 160], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  // Metrics cards
  const metricsOp = interpolate(frame, [100, 130], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  // Simulated payoff line
  const payoffPoints = generatePayoff(chartProgress);

  return (
    <AbsoluteFill style={{ fontFamily, padding: 40 }}>
      {/* Section label */}
      <div style={{
        fontSize: 16,
        color: C.primary,
        fontWeight: 700,
        letterSpacing: 3,
        textTransform: "uppercase" as const,
        marginBottom: 12,
        opacity: interpolate(frame, [0, 20], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
      }}>
        ▸ NOVA ANÁLISE
      </div>

      {/* Header bar */}
      <div style={{
        transform: `translateY(${headerY}px)`,
        background: C.primary,
        borderRadius: 12,
        padding: "12px 24px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: 24,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={C.bg} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
            <polyline points="16 7 22 7 22 13" />
          </svg>
          <span style={{ fontWeight: 700, color: C.bg, fontSize: 18 }}>Opções PRO X</span>
        </div>
        <div style={{
          background: "rgba(0,0,0,0.2)",
          padding: "4px 14px",
          borderRadius: 10,
          color: C.bg,
          fontWeight: 600,
          fontSize: 12,
        }}>
          PRO
        </div>
      </div>

      {/* Leg form cards */}
      <div style={{ display: "flex", gap: 16, marginBottom: 20 }}>
        <div style={{ flex: 1, opacity: card1Op, transform: `translateY(${card1Y}px)` }}>
          <Card>
            <div style={{ fontSize: 13, color: C.muted, marginBottom: 8 }}>Perna 1 — CALL</div>
            <div style={{ display: "flex", gap: 12, fontFamily: monoFont }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, color: C.muted }}>Strike</div>
                <div style={{ fontSize: 22, color: C.foreground, fontWeight: 600 }}>28.00</div>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, color: C.muted }}>Prêmio</div>
                <div style={{ fontSize: 22, color: C.success, fontWeight: 600 }}>1.50</div>
              </div>
              <div style={{
                background: C.success + "20",
                color: C.success,
                padding: "4px 12px",
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 600,
                alignSelf: "center",
              }}>
                COMPRA
              </div>
            </div>
          </Card>
        </div>
        <div style={{ flex: 1, opacity: card2Op, transform: `translateY(${card2Y}px)` }}>
          <Card>
            <div style={{ fontSize: 13, color: C.muted, marginBottom: 8 }}>Perna 2 — CALL</div>
            <div style={{ display: "flex", gap: 12, fontFamily: monoFont }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, color: C.muted }}>Strike</div>
                <div style={{ fontSize: 22, color: C.foreground, fontWeight: 600 }}>30.00</div>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, color: C.muted }}>Prêmio</div>
                <div style={{ fontSize: 22, color: C.destructive, fontWeight: 600 }}>0.80</div>
              </div>
              <div style={{
                background: C.destructive + "20",
                color: C.destructive,
                padding: "4px 12px",
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 600,
                alignSelf: "center",
              }}>
                VENDA
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* Payoff Chart */}
      <Card style={{ marginBottom: 20, opacity: interpolate(frame, [50, 70], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) }}>
        <div style={{ fontSize: 14, color: C.muted, marginBottom: 12 }}>Gráfico de Payoff</div>
        <svg width="960" height="320" viewBox="0 0 960 320">
          {/* Grid lines */}
          {[0, 1, 2, 3, 4].map(i => (
            <line key={i} x1={0} y1={i * 80} x2={960} y2={i * 80} stroke={C.border} strokeWidth={1} />
          ))}
          {/* Zero line */}
          <line x1={0} y1={160} x2={960} y2={160} stroke={C.muted} strokeWidth={1} strokeDasharray="4 4" />
          {/* Payoff line */}
          <polyline
            points={payoffPoints}
            fill="none"
            stroke={C.primary}
            strokeWidth={3}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {/* Profit area */}
          <polygon
            points={`${payoffPoints} 960,160 0,160`}
            fill={C.primary}
            opacity={0.08}
          />
        </svg>
      </Card>

      {/* Metrics */}
      <div style={{ display: "flex", gap: 16, opacity: metricsOp }}>
        {[
          { label: "Lucro Máx", value: "+R$ 1.300", color: C.success },
          { label: "Perda Máx", value: "-R$ 700", color: C.destructive },
          { label: "Breakeven", value: "R$ 28.70", color: C.warning },
          { label: "Risco/Retorno", value: "1.86x", color: C.primary },
        ].map((m, i) => (
          <Card key={i} style={{ flex: 1, textAlign: "center" as const }}>
            <div style={{ fontSize: 12, color: C.muted, marginBottom: 6 }}>{m.label}</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: m.color, fontFamily: monoFont }}>{m.value}</div>
          </Card>
        ))}
      </div>
    </AbsoluteFill>
  );
};

function generatePayoff(progress: number): string {
  const points: string[] = [];
  const totalPoints = Math.floor(48 * progress);
  for (let i = 0; i <= totalPoints; i++) {
    const x = (i / 48) * 960;
    const price = 24 + (i / 48) * 12; // 24 to 36
    let payoff: number;
    if (price <= 28) payoff = -70; // loss zone
    else if (price <= 30) payoff = (price - 28) * 100 - 70; // climbing
    else payoff = 130; // max profit
    const y = 160 - (payoff / 200) * 160;
    points.push(`${x},${y}`);
  }
  return points.join(" ");
}
