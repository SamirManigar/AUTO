"use client";

import { useState } from "react";
import { Player } from "@remotion/player";
import { Compilation } from "@/remotion/Compilation";
import type { CompilationProps, ClipData } from "@/remotion/types";
import { analyzeClipsAction } from "@/app/actions/analyze-clips";

type AnalysisState = "idle" | "analyzing" | "done";
type ExportState = "idle" | "rendering" | "done";

export default function CompilationPlayer({ topic, clips: initialClips, compilationId }: CompilationProps & { compilationId: string }) {
  const [clips, setClips] = useState<ClipData[]>(initialClips);
  const [analysisState, setAnalysisState] = useState<AnalysisState>("idle");
  const [exportState, setExportState] = useState<ExportState>("idle");
  const [exportTarget, setExportTarget] = useState<"original" | "gemini" | null>(null);
  const [progress, setProgress] = useState<string>("");
  const [analysisLog, setAnalysisLog] = useState<string[]>([]);

  const fps = 30;
  // Intro card (4s) + all clips
  const INTRO_FRAMES = fps * 4;
  const clipFrames = clips.reduce((acc, c) => acc + Math.max(fps, Math.round((c.endTime - c.startTime) * fps)), 0);
  const totalFrames = Math.max(1, INTRO_FRAMES + clipFrames);

  const handleAnalyze = async () => {
    setAnalysisState("analyzing");
    setAnalysisLog([]);

    const inputs = clips.map(c => ({
      youtubeId: c.youtubeId,
      durationSeconds: c.durationSeconds,
    }));

    const log: string[] = [];
    const msg = `Sending all ${inputs.length} clips to Gemini 2.5 Flash in a single request...`;
    setProgress(msg);
    log.push(msg);
    setAnalysisLog([...log]);

    try {
      // Single batched API call — all clips analyzed at once
      const results = await analyzeClipsAction(inputs);

      const refined: ClipData[] = clips.map((clip, i) => {
        const result = results[i];
        return {
          ...clip,
          startTime: result.startSeconds,
          endTime: result.endSeconds,
          rankNumber: result.success ? result.rank : clip.rankNumber,
          overlayText: result.success ? result.overlayText : clip.overlayText,
        };
      });

      // Sort clips based on new Gemini ranks (rank 1 to N, typically played sequentially or descending)
      // Actually, Compilation component handles its own hierarchy/sorting based on rankNumber. 
      // We just pass the updated array. But we should sort it so the playback sequence (from 0 to N) makes sense.
      // E.g. rank N to rank 1 (worst to best for climax), or rank 1 to N. Let's sort by rankNumber descending (worst to best) like a Top 5 list.
      refined.sort((a, b) => b.rankNumber - a.rankNumber);

      results.forEach((result, i) => {
        const line = result.success
          ? `✅ Clip ${i + 1} -> Rank ${result.rank}: "${result.overlayText}" (${result.startSeconds.toFixed(1)}s – ${result.endSeconds.toFixed(1)}s)`
          : `⚠️ Clip ${i + 1}: Gemini unavailable — using full clip`;
        log.push(line);
      });

      setAnalysisLog([...log]);
      setClips(refined);
      setAnalysisState("done");
      setProgress("Analysis complete!");
    } catch (error) {
      console.error(error);
      log.push("❌ Analysis failed — check Gemini API key in .env.local");
      setAnalysisLog([...log]);
      setAnalysisState("idle");
    }
  };

  const handleReset = () => {
    setClips(initialClips);
    setAnalysisState("idle");
    setAnalysisLog([]);
    setProgress("");
  };

  const handleExport = async (targetClips: ClipData[], target: "original" | "gemini") => {
    setExportState("rendering");
    setExportTarget(target);
    try {
      const res = await fetch("/api/render", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ compilationId, clips: targetClips }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      // Trigger file download
      const a = document.createElement("a");
      a.href = data.url;
      a.download = `compilation-${compilationId}.mp4`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      
      setExportState("done");
    } catch (err) {
      console.error(err);
      alert("Failed to render video. " + String(err));
    } finally {
      setExportState("idle");
      setExportTarget(null);
    }
  };

  return (
    <div className="flex flex-col items-center gap-8 w-full max-w-lg">

      {/* Remotion Player */}
      <div className="w-full aspect-[9/16] bg-zinc-900 rounded-2xl overflow-hidden shadow-2xl border border-zinc-800">
        <Player
          component={Compilation}
          inputProps={{ topic, clips }}
          durationInFrames={totalFrames}
          fps={fps}
          compositionWidth={1080}
          compositionHeight={1920}
          style={{ width: "100%", height: "100%" }}
          controls
          autoPlay
        />
      </div>

      {/* Analyze Panel */}
      <div className="w-full bg-zinc-900/80 border border-zinc-800 rounded-2xl p-6 space-y-4">

        {analysisState === "idle" && (
          <>
            <div className="text-center space-y-2">
              <p className="text-zinc-300 font-semibold text-lg">Step 2 — Find Best Highlights</p>
              <p className="text-zinc-500 text-sm">
                Gemini 2.5 Flash will watch each clip and find the single best highlight moment with exact timestamps.
              </p>
            </div>
            <button
              onClick={handleAnalyze}
              className="w-full py-4 rounded-xl font-bold text-lg bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-500 hover:to-violet-500 transition-all shadow-lg flex items-center justify-center gap-3"
            >
              <span className="text-2xl">✨</span>
              Analyze with Gemini 2.5 Flash
            </button>
            <div className="flex items-center gap-4 py-2 w-full">
              <div className="h-px bg-zinc-800 flex-1"></div>
              <span className="text-zinc-600 text-sm font-medium uppercase tracking-wider">OR</span>
              <div className="h-px bg-zinc-800 flex-1"></div>
            </div>
            {exportState === "rendering" && exportTarget === "original" ? (
              <div className="w-full py-4 rounded-xl font-bold text-lg bg-zinc-800 text-zinc-400 flex items-center justify-center gap-3 border border-zinc-700">
                <div className="w-5 h-5 border-2 border-zinc-400 border-t-transparent rounded-full animate-spin" />
                Rendering Original Compilation...
              </div>
            ) : (
              <button
                onClick={() => handleExport(initialClips, "original")}
                disabled={exportState !== "idle"}
                className="w-full py-3 rounded-xl font-semibold text-md bg-zinc-800 hover:bg-zinc-700 transition-all border border-zinc-700 text-zinc-300 flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Download Original (Raw Clips)
              </button>
            )}
          </>
        )}

        {analysisState === "analyzing" && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-5 h-5 border-2 border-violet-400 border-t-transparent rounded-full animate-spin" />
              <span className="text-violet-300 font-semibold">{progress}</span>
            </div>
            <div className="bg-black/40 rounded-xl p-4 space-y-1 max-h-48 overflow-y-auto">
              {analysisLog.map((line, i) => (
                <p key={i} className="text-xs font-mono text-zinc-400">{line}</p>
              ))}
            </div>
          </div>
        )}

        {analysisState === "done" && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-green-400 font-semibold">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Compilation refined with Gemini highlights!
            </div>

            {/* Download Button */}
            {exportState === "rendering" && exportTarget === "gemini" ? (
              <div className="w-full py-4 rounded-xl font-bold text-lg bg-zinc-800 text-zinc-400 flex items-center justify-center gap-3 border border-zinc-700">
                <div className="w-5 h-5 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
                Downloading & Rendering (Takes 1-2 mins)...
              </div>
            ) : (
              <button
                onClick={() => handleExport(clips, "gemini")}
                disabled={exportState !== "idle"}
                className="w-full py-4 rounded-xl font-bold text-lg bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 transition-all shadow-lg flex items-center justify-center gap-3 disabled:opacity-50"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Download Refined MP4 Video
              </button>
            )}



            <button
              onClick={handleReset}
              className="w-full py-3 mt-4 rounded-xl font-semibold text-sm bg-zinc-800 hover:bg-zinc-700 transition-all border border-zinc-700 text-zinc-300"
            >
              ↩ Reset to Full Clips
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
