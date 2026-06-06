import { NextResponse } from "next/server";
import { sql } from "@/lib/db/neon";
import { downloadYouTubeClip } from "@/lib/video-downloader";
import { bundle } from "@remotion/bundler";
import { getCompositions, renderMedia } from "@remotion/renderer";
import path from "path";
import fs from "fs";

export async function POST(req: Request) {
  try {
    const { compilationId, clips: clientClips } = await req.json();
    if (!compilationId) return NextResponse.json({ error: "Missing compilationId" }, { status: 400 });

    console.log(`[render] Starting render process for compilation ${compilationId}`);

    // 1. Fetch data
    const [compilation] = await sql`SELECT * FROM compilations WHERE id = ${compilationId}`;
    if (!compilation) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const clipsData = await sql`
      SELECT c.*, v.youtube_id, v.duration_seconds
      FROM compilation_clips c
      JOIN videos v ON c.video_id = v.id
      WHERE c.compilation_id = ${compilationId}
      ORDER BY c.rank_number DESC
    `;

    // Map database clips to internal ClipData format
    const dbClips = clipsData.map((c) => ({
      videoId: c.video_id,
      youtubeId: c.youtube_id,
      startTime: parseFloat(c.start_time),
      endTime: parseFloat(c.end_time),
      rankNumber: c.rank_number,
      overlayText: c.overlay_text,
      durationSeconds: parseFloat(c.duration_seconds),
    }));

    // Use client provided clips (e.g., Gemini refined) or fallback to raw database clips
    const sourceClips = clientClips && clientClips.length > 0 ? clientClips : dbClips;

    // Get the base URL of the Next.js server to serve the MP4s via HTTP
    const host = req.headers.get("host") || "localhost:3000";
    const protocol = host.includes("localhost") ? "http" : "https";
    const baseUrl = `${protocol}://${host}`;

    // 2. Download all clips
    const enhancedClips = await Promise.all(
      sourceClips.map(async (c: any) => {
        await downloadYouTubeClip(c.youtubeId);
        const fileName = `${c.youtubeId}.mp4`;
        return {
          ...c,
          localUrl: `${baseUrl}/downloads/${fileName}`, // Let Next.js serve the file via HTTP to Chromium
        };
      })
    );

    const inputProps = {
      topic: compilation.topic,
      clips: enhancedClips,
      mode: "export",
    };

    // Calculate total duration in frames (30fps)
    let totalFrames = 0;
    for (const clip of enhancedClips) {
      const dur = Math.max(30, Math.round((clip.endTime - clip.startTime) * 30));
      totalFrames += dur;
    }

    console.log(`[render] Total frames: ${totalFrames}. Bundling Remotion project...`);

    // 3. Bundle the Remotion project
    // The entry point is remotion/index.ts
    const bundled = await bundle({
      entryPoint: path.join(process.cwd(), "remotion/index.ts"),
      webpackOverride: (config) => {
        config.cache = false;
        return config;
      },
    });

    console.log(`[render] Bundled successfully. Rendering media...`);

    // 4. Render Media
    const outFileName = `compilation-${compilationId}.mp4`;
    const outPath = path.join(process.cwd(), "public", "downloads", outFileName);

    const { selectComposition } = await import("@remotion/renderer");
    const composition = await selectComposition({
      serveUrl: bundled,
      id: "Compilation",
      inputProps,
      port: 3333,
    });

    // Override the static 300 frame default with our dynamically calculated length
    composition.durationInFrames = Math.max(1, totalFrames);

    await renderMedia({
      composition,
      serveUrl: bundled,
      codec: "h264",
      outputLocation: outPath,
      inputProps,
      imageFormat: "jpeg",
      port: 3333,
    });

    console.log(`[render] Render complete! Saved to ${outPath}`);

    return NextResponse.json({ url: `/downloads/${outFileName}` });

  } catch (error: any) {
    console.error("[render] Error:", error);
    return NextResponse.json({ error: error.message || "Render failed" }, { status: 500 });
  }
}
