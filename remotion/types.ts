export interface ClipData {
  videoId: string;
  youtubeId: string;
  startTime: number;
  endTime: number;
  rankNumber: number;
  overlayText: string;
  durationSeconds: number;
  localUrl?: string; // Used during export mode
}

export interface CompilationProps {
  topic: string;
  clips: ClipData[];
  mode?: "preview" | "export";
}
