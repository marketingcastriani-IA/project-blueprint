import { AbsoluteFill, useCurrentFrame, interpolate, spring, useVideoConfig } from "remotion";
import { C } from "../colors";
import { loadFont } from "@remotion/google-fonts/PlusJakartaSans";
import { Caption } from "../components/Caption";

const { fontFamily } = loadFont("normal", { weights: ["400", "600", "700", "800"], subsets: ["latin"] });

const features = [
  { icon: "📊", title: "Gráfico de Payoff", desc: "Visualize lucro e perda antes de operar" },
  { icon: "🤖", title: "IA Integrada", desc: "Sugestões de saída com inteligência artificial" },
  { icon: "📡", title: "Tempo Real", desc: "Dados do Profit sincronizados via WebSocket" },
  { icon: "📦", title: "Rastreador Box", desc: "Encontre os melhores box spreads vs CDI" },
  { icon: "📸", title: "OCR de Opções", desc: "Importe dados direto de screenshots" },
  { icon: "💼", title: "Portfólio Unificado", desc: "Todas suas operações em um só lugar" },
];

export const Scene5Features: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const titleOp = interpolate(frame, [0, 25], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const titleY = interpolate(spring({ frame, fps, config: { damping: 20 } }), [0, 1], [30, 0]);

  return (
    <AbsoluteFill style={{ fontFamily, padding: 40, justifyContent: "center" }}>
      {/* Title */}
      <div style={{
        fontSize: 40,
        fontWeight: 800,
        color: C.foreground,
        textAlign: "center" as const,
        marginBottom: 12,
        opacity: titleOp,
        transform: `translateY(${titleY}px)`,
      }}>
        Tudo que você precisa
      </div>
      <div style={{
        fontSize: 18,
        color: C.muted,
        textAlign: "center" as const,
        marginBottom: 48,
        opacity: titleOp,
      }}>
        em uma única ferramenta
      </div>

      {/* Feature grid */}
      <div style={{
        display: "flex",
        flexWrap: "wrap" as const,
        gap: 20,
        justifyContent: "center",
      }}>
        {features.map((f, i) => {
          const delay = 20 + i * 12;
          const cardScale = spring({ frame: frame - delay, fps, config: { damping: 14 } });
          const cardOp = interpolate(frame, [delay, delay + 20], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
          return (
            <div key={i} style={{
              width: 310,
              background: C.bgCard,
              border: `1px solid ${C.border}`,
              borderRadius: 16,
              padding: 28,
              opacity: cardOp,
              transform: `scale(${Math.max(0, cardScale)})`,
            }}>
              <div style={{ fontSize: 36, marginBottom: 12 }}>{f.icon}</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: C.foreground, marginBottom: 8 }}>{f.title}</div>
              <div style={{ fontSize: 14, color: C.muted, lineHeight: 1.5 }}>{f.desc}</div>
            </div>
          );
        })}
      </div>

      <Caption text="Payoff, IA, tempo real, box tracker, OCR e portfólio — tudo integrado em uma plataforma" startFrame={40} />
    </AbsoluteFill>
  );
};
