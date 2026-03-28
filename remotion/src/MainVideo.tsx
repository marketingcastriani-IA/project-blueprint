import { AbsoluteFill } from "remotion";
import { TransitionSeries, springTiming } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { wipe } from "@remotion/transitions/wipe";
import { Scene1Intro } from "./scenes/Scene1Intro";
import { Scene2Dashboard } from "./scenes/Scene2Dashboard";
import { Scene3TempoReal } from "./scenes/Scene3TempoReal";
import { Scene4BoxTracker } from "./scenes/Scene4BoxTracker";
import { Scene5Features } from "./scenes/Scene5Features";
import { Scene6Outro } from "./scenes/Scene6Outro";
import { PersistentBackground } from "./components/PersistentBackground";
import { C } from "./colors";

export const MainVideo: React.FC = () => {
  const transition = springTiming({ config: { damping: 200 }, durationInFrames: 20 });

  return (
    <AbsoluteFill style={{ backgroundColor: C.bg }}>
      <PersistentBackground />
      <TransitionSeries>
        <TransitionSeries.Sequence durationInFrames={210}>
          <Scene1Intro />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition
          presentation={fade()}
          timing={transition}
        />
        <TransitionSeries.Sequence durationInFrames={270}>
          <Scene2Dashboard />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition
          presentation={wipe({ direction: "from-left" })}
          timing={transition}
        />
        <TransitionSeries.Sequence durationInFrames={250}>
          <Scene3TempoReal />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition
          presentation={fade()}
          timing={transition}
        />
        <TransitionSeries.Sequence durationInFrames={250}>
          <Scene4BoxTracker />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition
          presentation={wipe({ direction: "from-right" })}
          timing={transition}
        />
        <TransitionSeries.Sequence durationInFrames={220}>
          <Scene5Features />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition
          presentation={fade()}
          timing={transition}
        />
        <TransitionSeries.Sequence durationInFrames={270}>
          <Scene6Outro />
        </TransitionSeries.Sequence>
      </TransitionSeries>
    </AbsoluteFill>
  );
};
