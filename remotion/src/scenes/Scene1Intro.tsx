import { AbsoluteFill, useCurrentFrame, interpolate, spring, useVideoConfig } from "remotion";
import { C } from "../colors";
import { loadFont } from "@remotion/google-fonts/PlusJakartaSans";

const { fontFamily } = loadFont("normal", { weights: ["700", "800"], subsets: ["latin"] });

export const Scene1Intro: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Logo circle scale
  const logoScale = spring({ frame, fps, config: { damping: 15, stiffness: 120 } });
  // Glow pulse
  const glowSize = interpolate(frame, [0, 60, 120, 180], [0, 80, 60, 80], { extrapolateRight: "clamp" });
  // Title slide up
  const titleY = interpolate(spring({ frame: frame - 30, fps, config: { damping: 20 } }), [0, 1], [60, 0]);
  const titleOp = interpolate(frame, [30, 60], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  // Subtitle
  const subOp = interpolate(frame, [60, 90], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const subY = interpolate(spring({ frame: frame - 60, fps, config: { damping: 20 } }), [0, 1], [30, 0]);
  // Badge
  const badgeScale = spring({ frame: frame - 90, fps, config: { damping: 12 } });
  // Tagline
  const tagOp = interpolate(frame, [120, 150], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", fontFamily }}>
      {/* Logo circle with glow */}
      <div style={{
        width: 160,
        height: 160,
        borderRadius: "50%",
        background: `linear-gradient(135deg, ${C.primary}, ${C.success})`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        transform: `scale(${logoScale})`,
        boxShadow: `0 0 ${glowSize}px ${glowSize / 2}px ${C.primaryGlow}`,
        marginBottom: 40,
      }}>
        <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke={C.bg} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
          <polyline points="16 7 22 7 22 13" />
        </svg>
      </div>

      {/* Title */}
      <div style={{
        fontSize: 72,
        fontWeight: 800,
        color: C.foreground,
        transform: `translateY(${titleY}px)`,
        opacity: titleOp,
        letterSpacing: "-2px",
        textAlign: "center",
      }}>
        Opções <span style={{ color: C.primary }}>PRO</span> X
      </div>

      {/* Subtitle */}
      <div style={{
        fontSize: 28,
        color: C.muted,
        transform: `translateY(${subY}px)`,
        opacity: subOp,
        marginTop: 16,
        textAlign: "center",
      }}>
        Simulador de Opções com IA
      </div>

      {/* PRO Badge */}
      <div style={{
        marginTop: 30,
        transform: `scale(${Math.max(0, badgeScale)})`,
        background: `linear-gradient(135deg, ${C.warning}, #e6a800)`,
        color: C.bg,
        padding: "8px 28px",
        borderRadius: 20,
        fontSize: 18,
        fontWeight: 700,
        letterSpacing: "2px",
      }}>
        ★ PLANO PRO
      </div>

      {/* Tagline */}
      <div style={{
        marginTop: 40,
        fontSize: 22,
        color: C.muted,
        opacity: tagOp,
        textAlign: "center",
        maxWidth: 700,
        lineHeight: 1.5,
      }}>
        Monte, analise e rastreie suas operações estruturadas com dados em tempo real
      </div>
    </AbsoluteFill>
  );
};
