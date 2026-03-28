import { AbsoluteFill, useCurrentFrame, interpolate } from "remotion";
import { C } from "../colors";

export const PersistentBackground: React.FC = () => {
  const frame = useCurrentFrame();

  const x1 = interpolate(frame, [0, 1350], [0, 200]);
  const y1 = interpolate(frame, [0, 1350], [0, 150]);
  const x2 = interpolate(frame, [0, 1350], [1080, 880]);
  const y2 = interpolate(frame, [0, 1350], [1350, 1100]);

  return (
    <AbsoluteFill>
      {/* Base gradient */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `radial-gradient(ellipse 600px 600px at ${x1}px ${y1}px, ${C.primaryGlow}, transparent),
                       radial-gradient(ellipse 500px 500px at ${x2}px ${y2}px, rgba(0,230,138,0.08), transparent)`,
        }}
      />
      {/* Grid overlay */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          opacity: 0.03,
          backgroundImage: `linear-gradient(${C.primary} 1px, transparent 1px), linear-gradient(90deg, ${C.primary} 1px, transparent 1px)`,
          backgroundSize: "60px 60px",
        }}
      />
    </AbsoluteFill>
  );
};
