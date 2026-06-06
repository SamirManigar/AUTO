import { Composition } from "remotion";
import { Compilation } from "./Compilation";
import type { CompilationProps } from "./types";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="Compilation"
        component={Compilation as any}
        durationInFrames={300} // Will be overridden by calculateMetadata or renderMedia props
        fps={30}
        width={1080}
        height={1920}
        defaultProps={{
          topic: "Top 5 Default Clips",
          clips: [],
          mode: "preview" as const,
        } as CompilationProps}
      />
    </>
  );
};
