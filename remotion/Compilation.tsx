"use client";

import {
  AbsoluteFill,
  Sequence,
  useVideoConfig,
  interpolate,
  spring,
  useCurrentFrame,
  OffthreadVideo,
} from "remotion";
import { useState, useEffect } from "react";
import ReactPlayer from "react-player/youtube";
import type { CompilationProps, ClipData } from "./types";

function getRankColor(rankNumber: number): string {
  if (rankNumber === 1) return "#FFD700"; // Gold
  if (rankNumber === 2) return "#C0C0C0"; // Silver
  if (rankNumber === 3) return "#CD7F32"; // Bronze
  return "#FFFFFF";
}

// Parse "Top 5 Speed Funniest Moments" → { line1: "Ranking Top 5", yellowWord: "Speed", whiteWords: "Funniest Moments" }
function parseTitleLines(topic: string, clipCount: number) {
  const match = topic.match(/top\s*(\d+)\s*(.*)/i);
  const count = match ? match[1] : String(clipCount);
  const rest = match ? match[2].trim() : topic;
  const words = rest.split(/\s+/).filter(Boolean);
  const yellowWord = words[0] ?? "";
  // Truncate the rest so line 2 never gets too long
  const whiteWords = words.slice(1).join(" ").substring(0, 20);
  return {
    line1: `Ranking Top ${count}`,
    yellowWord,
    whiteWords,
  };
}

// ── Title overlay at the very top ─────────────────────────────────────────
const TitleOverlay: React.FC<{ topic: string; clipCount: number }> = ({ topic, clipCount }) => {
  const { line1, yellowWord, whiteWords } = parseTitleLines(topic, clipCount);

  return (
    <div style={{
      position: "absolute",
      top: 0, left: 0, right: 0,
      zIndex: 100,
      pointerEvents: "none",
      // Semi-transparent dark gradient behind the text
      background: "linear-gradient(180deg, rgba(0,0,0,0.82) 60%, transparent 100%)",
      paddingTop: 36,
      paddingLeft: 20,
      paddingRight: 20,
      paddingBottom: 28,
      textAlign: "center",
    }}>
      {/* Line 1: "Ranking Top 5" — green italic */}
      <div style={{
        fontFamily: "'Arial Black', 'Franklin Gothic Heavy', 'Impact', sans-serif",
        fontStyle: "italic",
        fontSize: 66,
        fontWeight: 900,
        color: "#39FF14",
        lineHeight: 1.0,
        letterSpacing: 2,
        textShadow: "0 0 24px rgba(57,255,20,0.75), 3px 3px 0 rgba(0,0,0,1), 0 4px 18px rgba(0,0,0,0.9)",
      }}>
        {line1}
      </div>

      {/* Line 2: 1 line max — JS-truncated + CSS ellipsis safety net */}
      <div style={{
        display: "block",
        lineHeight: 1.1,
        marginTop: 4,
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis",
      }}>
        <span style={{
          fontFamily: "'Arial Black', 'Franklin Gothic Heavy', 'Impact', sans-serif",
          fontStyle: "italic",
          fontSize: 46,
          fontWeight: 900,
          color: "#FFD700",
          textShadow: "3px 3px 0 rgba(0,0,0,1), 0 3px 14px rgba(0,0,0,0.8)",
        }}>
          {yellowWord}{" "}
        </span>
        <span style={{
          fontFamily: "'Arial Black', 'Franklin Gothic Heavy', 'Impact', sans-serif",
          fontStyle: "italic",
          fontSize: 46,
          fontWeight: 900,
          color: "#ffffff",
          textShadow: "3px 3px 0 rgba(0,0,0,1), 0 3px 14px rgba(0,0,0,0.8)",
        }}>
          {whiteWords}
        </span>
      </div>
    </div>
  );
};

// ── Persistent scoreboard overlaid on video ────────────────────────────────
const ScoreBoard: React.FC<{
  clips: ClipData[];
  clipStartFrames: number[];
}> = ({ clips, clipStartFrames }) => {
  const frame = useCurrentFrame();

  // Fade in immediately
  const opacity = interpolate(frame, [0, 20], [0, 1], { extrapolateRight: "clamp" });

  // Sorted: rank 1 at top, rank N at bottom (hierarchy order)
  const sorted = [...clips].sort((a, b) => a.rankNumber - b.rankNumber);

  return (
    <div style={{
      position: "absolute",
      top: 196,
      left: 0, right: 0,
      zIndex: 90,
      opacity,
      pointerEvents: "none",
      padding: "0 22px",
    }}>
      {sorted.map((clip) => {
        const originalIndex = clips.findIndex(c => c.youtubeId === clip.youtubeId);
        const clipStartFrame = clipStartFrames[originalIndex];
        const nextStartFrame = originalIndex < clips.length - 1
          ? clipStartFrames[originalIndex + 1]
          : Infinity;

        const clipStarted = frame >= clipStartFrame;
        const isActive = clipStarted && frame < nextStartFrame;

        const titleOpacity = interpolate(
          frame,
          [clipStartFrame, clipStartFrame + 18],
          [0, 1],
          { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
        );

        const rankColor = getRankColor(clip.rankNumber);

        return (
          <div key={clip.youtubeId} style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: isActive ? "8px 12px" : "6px 2px",
            marginBottom: 18,
            background: isActive ? "rgba(0,0,0,0.28)" : "transparent",
            borderRadius: isActive ? 10 : 0,
          }}>
            {/* Rank number */}
            <div style={{
              fontFamily: "'Arial Black', 'Franklin Gothic Heavy', 'Impact', sans-serif",
              fontStyle: "italic",
              fontSize: 72,
              fontWeight: 900,
              color: rankColor,
              WebkitTextStroke: "1.5px rgba(0,0,0,0.7)",
              textShadow: `0 0 10px ${rankColor}50, 2px 2px 0 rgba(0,0,0,0.9)`,
              minWidth: 68,
              textAlign: "left",
              lineHeight: 1,
              flexShrink: 0,
            }}>
              {clip.rankNumber}.
            </div>

            {/* Clip title — fades in when clip starts, stays visible forever after */}
            {clipStarted && (
              <div style={{
                fontFamily: "'Arial Black', 'Franklin Gothic Heavy', 'Impact', sans-serif",
                fontStyle: "italic",
                fontSize: 54,
                fontWeight: 900,
                color: "#ffffff",
                WebkitTextStroke: "1.5px #000",
                textTransform: "lowercase",
                letterSpacing: 0.3,
                lineHeight: 1.15,
                opacity: titleOpacity,
                textShadow: "2px 2px 0 rgba(0,0,0,0.9), 0 2px 10px rgba(0,0,0,0.8)",
                flex: 1,
              }}>
                {clip.overlayText}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

// ── Center rank burst — springs in then fades out ─────────────────────────
const RankPopup: React.FC<{ rankNumber: number }> = ({ rankNumber }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const scaleValue = spring({ frame, fps, config: { damping: 10, stiffness: 200, mass: 0.6 } });
  const scale = interpolate(scaleValue, [0, 1], [0.3, 1], { extrapolateRight: "clamp" });
  const opacity = interpolate(
    frame,
    [0, 8, fps * 1.2, fps * 2.2],
    [0, 1, 1, 0],
    { extrapolateRight: "clamp" }
  );

  const rankColor = getRankColor(rankNumber);

  return (
    <div style={{
      position: "absolute", inset: 0,
      display: "flex", alignItems: "center", justifyContent: "center",
      pointerEvents: "none", opacity, zIndex: 50,
    }}>
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "center",
        width: 280, height: 280, borderRadius: "50%",
        background: `radial-gradient(circle, ${rankColor}20 0%, transparent 70%)`,
        border: `6px solid ${rankColor}`,
        boxShadow: `0 0 60px ${rankColor}60, 0 0 120px ${rankColor}20`,
        transform: `scale(${scale})`,
      }}>
        <span style={{
          fontFamily: "'Impact', 'Arial Black', sans-serif",
          fontSize: 140, fontWeight: 900, color: rankColor,
          textShadow: `0 0 30px ${rankColor}, 0 0 60px ${rankColor}80`,
          WebkitTextStroke: "3px rgba(0,0,0,0.4)", lineHeight: 1,
        }}>
          {rankNumber}
        </span>
      </div>
    </div>
  );
};

// ── Main composition ───────────────────────────────────────────────────────
export const Compilation: React.FC<CompilationProps> = ({ topic, clips, mode = "preview" }) => {
  const { fps } = useVideoConfig();
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Clips start at frame 0 — no intro card
  const clipStartFrames: number[] = [];
  let runningFrame = 0;
  for (const clip of clips) {
    clipStartFrames.push(runningFrame);
    const dur = Math.max(fps, Math.round((clip.endTime - clip.startTime) * fps));
    runningFrame += dur;
  }

  let currentFrame = 0;

  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>

      {/* ── Clips play full-frame sequentially */}
      {clips.map((clip) => {
        const durationSec = clip.endTime - clip.startTime;
        const durationFrames = Math.max(fps, Math.round(durationSec * fps));
        const startFrame = currentFrame;
        currentFrame += durationFrames;

        return (
          <Sequence key={clip.videoId} from={startFrame} durationInFrames={durationFrames}>
            <AbsoluteFill>
              {/* Full-frame video: ReactPlayer for preview, Remotion native Video for export */}
              {mode === "export" && clip.localUrl ? (
                <OffthreadVideo
                  src={clip.localUrl}
                  startFrom={Math.round(clip.startTime * fps)}
                  endAt={Math.round(clip.endTime * fps)}
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                  }}
                />
              ) : isMounted ? (
                <ReactPlayer
                  url={`https://www.youtube.com/watch?v=${clip.youtubeId}`}
                  playing={true}
                  controls={false}
                  muted={true}
                  width="100%"
                  height="100%"
                  style={{ objectFit: "cover" }}
                  config={{
                    playerVars: {
                      start: Math.floor(clip.startTime),
                      end: Math.ceil(clip.endTime),
                      autoplay: 1,
                      modestbranding: 1,
                      rel: 0,
                    },
                  }}
                />
              ) : null}

              {/* Center rank burst popup */}
              <RankPopup rankNumber={clip.rankNumber} />
            </AbsoluteFill>
          </Sequence>
        );
      })}

      {/* ── Title overlay — shown throughout entire compilation */}
      <TitleOverlay topic={topic} clipCount={clips.length} />

      {/* ── Scoreboard — persistent, outside sequences, spans full timeline */}
      <ScoreBoard clips={clips} clipStartFrames={clipStartFrames} />

    </AbsoluteFill>
  );
};
