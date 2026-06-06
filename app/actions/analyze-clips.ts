"use server";

export interface ClipAnalysisInput {
  youtubeId: string;
  durationSeconds: number;
}

export interface ClipAnalysisResult {
  youtubeId: string;
  startSeconds: number;
  endSeconds: number;
  description: string;
  rank: number;
  overlayText: string;
  success: boolean;
}

export interface GeminiAnalysisResult {
  clipIndex: number;
  startSeconds: number;
  endSeconds: number;
  description: string;
  rank: number;
  overlayText: string;
  success: boolean;
}

const MAX_TOKENS = 800; // Increased to allow more output for titles and ranks

/**
 * Sends ALL clips to Gemini in a SINGLE API call.
 * Much more credit-efficient than one call per clip.
 * Gemini can handle multiple YouTube URLs in one request.
 */
export async function analyzeClipsAction(
  clips: ClipAnalysisInput[]
): Promise<ClipAnalysisResult[]> {
  const fallbacks: GeminiAnalysisResult[] = clips.map((c, i) => ({
    clipIndex: i + 1,
    startSeconds: 0,
    endSeconds: Math.min(15, c.durationSeconds),
    description: "Fallback to full clip",
    rank: clips.length - i,
    overlayText: "", // We'll handle fallback in the player
    success: false,
  }));

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.warn("[gemini] GEMINI_API_KEY not set — returning full clip fallbacks");
    return fallbacks.map(f => ({ ...f, youtubeId: clips[f.clipIndex - 1].youtubeId }));
  }

  // Build prompt listing all clips by index so Gemini can reference them
  const clipList = clips
    .map((c, i) => `Clip ${i + 1} (YouTube ID: ${c.youtubeId}, duration: ${Math.round(c.durationSeconds)}s)`)
    .join("\n");

  const prompt = `You are analyzing ${clips.length} YouTube Short video clips.

${clipList}

For EACH clip, find the single BEST highlight moment — the most exciting, funny, surprising, or impactful moment.
Additionally, rank all ${clips.length} clips from BEST to WORST. Assign rank 1 to the absolute best clip, rank 2 to the second best, etc.
Also generate a short, punchy, clickable phrase (max 3-5 words) to use as the title for each clip.

Rules:
- If the clip duration is 15 seconds or less, return the ENTIRE clip (start=0, end=full duration).
- If the clip duration is MORE than 15 seconds, find the BEST contiguous 15-second highlight and return that (the difference between start and end MUST be exactly 15 seconds).
- The final cut must NEVER exceed 15 seconds.
- Provide a brief description of the moment (max 6 words).
- Provide an 'overlay_text' (max 3-5 words) that is mostly lowercase, no punctuation, no emojis.
- Every clip MUST have a unique 'rank' from 1 to ${clips.length}.

Return ONLY a JSON array (no markdown, no explanation) with exactly ${clips.length} objects in this format:
[
  { "clip_index": 1, "start_seconds": 0.0, "end_seconds": 15.0, "description": "Epic ragequit moment", "rank": 3, "overlay_text": "speed crashes out" },
  ...
]`;

  try {
    // Build the parts array: one file_data per YouTube URL + the text prompt
    const videoParts = clips.map(c => ({
      file_data: {
        mime_type: "video/youtube",
        file_uri: `https://www.youtube.com/watch?v=${c.youtubeId}`,
      },
    }));

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                ...videoParts,
                { text: prompt },
              ],
            },
          ],
          generationConfig: {
            responseMimeType: "application/json",
          },
        }),
      }
    );

    if (!res.ok) {
      const err = await res.text();
      console.error("[gemini] Batch API error:", err);
      return fallbacks.map(f => ({ ...f, youtubeId: clips[f.clipIndex - 1].youtubeId }));
    }

    const data = await res.json();
    let raw: string = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    raw = raw.replace(/```json/g, "").replace(/```/g, "").trim();

    const parsed: Array<any> = JSON.parse(raw);

    // Map results back to clips by index
    return clips.map((clip, i) => {
      const c = parsed.find(p => p.clip_index === i + 1);
      const duration = clip.durationSeconds;
      
      if (!c) return { ...fallbacks[i], youtubeId: clip.youtubeId };

      const start = typeof c.start_seconds === "number" ? c.start_seconds : 0;
      let end = typeof c.end_seconds === "number" ? c.end_seconds : duration;

      // Enforce max 15 seconds strictly
      if (end - start > 15) {
        end = start + 15;
      }

      return {
        youtubeId: clip.youtubeId,
        clipIndex: Number(c.clip_index) || i + 1,
        startSeconds: Math.max(0, start),
        endSeconds: Math.min(end, duration),
        description: c.description || "Highlighted moment",
        rank: c.rank || i + 1,
        overlayText: c.overlay_text || "highlight moment",
        success: true,
      };
    });

  } catch (err) {
    console.error("[gemini] Batch analysis failed:", err);
    return fallbacks.map(f => ({ ...f, youtubeId: clips[f.clipIndex - 1].youtubeId }));
  }
}
