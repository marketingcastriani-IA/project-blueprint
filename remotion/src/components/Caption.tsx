import { useCurrentFrame, interpolate, spring, useVideoConfig } from "remotion";
import { C } from "../colors";
import { loadFont } from "@remotion/google-fonts/PlusJakartaSans";

const { fontFamily } = loadFont("normal", { weights: ["500", "700"], subsets: ["latin"] });

interface CaptionProps {
  text: string;
  startFrame?: number;
  endFrame?: number;
  position?: "bottom" | "top";
}

export const Caption: React.FC<CaptionProps> = ({
  text,
  startFrame = 10,
  endFrame = 9999,
  position = "bottom",
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const fadeIn = interpolate(frame, [startFrame, startFrame + 15], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const fadeOut = interpolate(frame, [endFrame - 15, endFrame], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const opacity = Math.min(fadeIn, fadeOut);

  const slideY = interpolate(
    spring({ frame: frame - startFrame, fps, config: { damping: 20 } }),
    [0, 1],
    [20, 0]
  );

  if (frame < startFrame || frame > endFrame) return null;

  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        [position]: 28,
        display: "flex",
        justifyContent: "center",
        zIndex: 100,
        opacity,
        transform: `translateY(${position === "bottom" ? slideY : -slideY}px)`,
        fontFamily,
        pointerEvents: "none" as const,
      }}
    >
      <div
        style={{
          background: `linear-gradient(135deg, ${C.bg}e6, ${C.bgCard}e6)`,
          border: `1px solid ${C.primary}40`,
          borderRadius: 14,
          padding: "12px 28px",
          maxWidth: "85%",
          backdropFilter: undefined,
        }}
      >
        <span
          style={{
            fontSize: 20,
            fontWeight: 500,
            color: C.foreground,
            lineHeight: 1.4,
            textAlign: "center" as const,
            display: "block",
          }}
        >
          {text}
        </span>
      </div>
    </div>
  );
};
