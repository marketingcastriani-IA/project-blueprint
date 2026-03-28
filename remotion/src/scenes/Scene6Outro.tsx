import { AbsoluteFill, useCurrentFrame, interpolate, spring, useVideoConfig } from "remotion";
import { C } from "../colors";
import { loadFont } from "@remotion/google-fonts/PlusJakartaSans";
import { Caption } from "../components/Caption";

const { fontFamily } = loadFont("normal", { weights: ["400", "600", "700", "800"], subsets: ["latin"] });

export const Scene6Outro: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const logoScale = spring({ frame, fps, config: { damping: 12, stiffness: 100 } });
  const titleOp = interpolate(frame, [20, 50], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const titleY = interpolate(spring({ frame: frame - 20, fps, config: { damping: 20 } }), [0, 1], [40, 0]);
  const subtitleOp = interpolate(frame, [50, 80], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const badgeScale = spring({ frame: frame - 80, fps, config: { damping: 10 } });
  const urlOp = interpolate(frame, [110, 140], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  // Glow ring
  const glowSize = interpolate(frame, [0, 60, 120, 180, 240], [40, 70, 50, 70, 40], { extrapolateRight: "clamp" });
  const ringRotation = interpolate(frame, [0, 270], [0, 360]);

  return (
    <AbsoluteFill style={{ fontFamily, justifyContent: "center", alignItems: "center" }}>
      {/* Glow ring behind logo */}
      <div style={{
        position: "absolute",
        width: 220,
        height: 220,
        borderRadius: "50%",
        border: `3px solid ${C.primary}30`,
        transform: `rotate(${ringRotation}deg) scale(${logoScale})`,
        boxShadow: `0 0 ${glowSize}px ${glowSize / 3}px ${C.primaryGlow}`,
      }} />

      {/* Logo */}
      <div style={{
        width: 140,
        height: 140,
        borderRadius: "50%",
        background: `linear-gradient(135deg, ${C.primary}, ${C.success})`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        transform: `scale(${logoScale})`,
        marginBottom: 40,
        boxShadow: `0 0 40px ${C.primaryGlow}`,
      }}>
        <svg width="70" height="70" viewBox="0 0 24 24" fill="none" stroke={C.bg} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
          <polyline points="16 7 22 7 22 13" />
        </svg>
      </div>

      {/* Title */}
      <div style={{
        fontSize: 64,
        fontWeight: 800,
        color: C.foreground,
        opacity: titleOp,
        transform: `translateY(${titleY}px)`,
        letterSpacing: "-2px",
      }}>
        Opções <span style={{ color: C.primary }}>PRO</span> X
      </div>

      {/* Subtitle */}
      <div style={{
        fontSize: 24,
        color: C.muted,
        opacity: subtitleOp,
        marginTop: 16,
        textAlign: "center" as const,
      }}>
        Suas operações estruturadas no próximo nível
      </div>

      {/* Badge */}
      <div style={{
        marginTop: 36,
        display: "flex",
        gap: 16,
        transform: `scale(${Math.max(0, badgeScale)})`,
      }}>
        <div style={{
          background: `linear-gradient(135deg, ${C.warning}, #e6a800)`,
          color: C.bg,
          padding: "10px 32px",
          borderRadius: 24,
          fontSize: 18,
          fontWeight: 700,
          letterSpacing: 2,
        }}>
          ★ ASSINE O PRO
        </div>
      </div>

      {/* URL */}
      <div style={{
        marginTop: 40,
        fontSize: 20,
        color: C.primary,
        opacity: urlOp,
        fontWeight: 600,
        letterSpacing: 1,
      }}>
        opoesxpro.lovable.app
      </div>

      <Caption text="Assine o plano PRO e leve suas operações estruturadas para o próximo nível" startFrame={50} />
    </AbsoluteFill>
  );
};
