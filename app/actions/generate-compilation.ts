"use server";

import { sql } from "@/lib/db/neon";
import type { RawYouTubeVideoData } from "@/lib/ai/timeline-generator";

// Use Groq to generate a catchy AI compilation title based on topic + clips
async function generateCompilationTitle(topic: string, videos: RawYouTubeVideoData[]): Promise<string> {
  const count = videos.length;
  const clipTitles = videos.map(v => `- ${v.title}`).join("\n");

  const prompt = `You are a viral YouTube Shorts compilation expert.

Given this search topic: "${topic}"
And these ${count} clips:
${clipTitles}

Generate ONE catchy, viral compilation title in exactly this format:
"Top ${count} [Subject] [Theme] Moments"

Examples of good titles:
- "Top 5 Speed's Funniest Moments"
- "Top 7 GTA RP Craziest Fails"
- "Top 6 Streamer Rage Moments"

Rules:
- Must start with "Top ${count}"
- Max 8 words total
- Must reflect the actual content of the clips
- Sound viral and clickable
- NO hashtags, NO quotes in output

Return ONLY the title string, nothing else.`;

  try {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 30,
      }),
    });

    if (res.ok) {
      const data = await res.json();
      const title = data.choices[0].message.content.trim().replace(/['"]/g, "");
      if (title.length > 5 && title.length < 80) return title;
    }
  } catch (e) {
    console.warn("[generate] Groq title generation failed:", e);
  }

  // Fallback: derive from topic
  return `Top ${count} ${topic.replace(/top\s*\d+\s*/gi, "").trim()}`;
}

// Use Groq to generate short, punchy titles for each individual clip
async function generateClipTitles(topic: string, videos: RawYouTubeVideoData[]): Promise<string[]> {
  const titles = videos.map(v => v.title);
  
  const prompt = `You are a viral YouTube Shorts editor.
I am making a compilation about: "${topic}"

Here are the original YouTube titles for the ${videos.length} clips in this compilation:
${titles.map((t, i) => `${i + 1}. ${t}`).join('\n')}

For EACH clip, generate a very short, punchy, clickable phrase (max 3-5 words) that summarizes the specific moment.
Make it mostly lowercase. No punctuation. No hashtags. No emojis. Just the short punchy phrase.

Return a JSON object containing a "titles" array of strings, with exactly ${videos.length} strings, in the exact same order.
Output ONLY valid JSON, nothing else.`;

  try {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
      }),
    });

    if (res.ok) {
      const data = await res.json();
      const parsed = JSON.parse(data.choices[0].message.content);
      if (Array.isArray(parsed.titles) && parsed.titles.length === videos.length) {
        return parsed.titles;
      }
    }
  } catch (e) {
    console.warn("[generate] Groq clip title generation failed:", e);
  }

  // Fallback: use cleaned up original titles
  return videos.map(v => v.title.replace(/#\S+/g, "").trim().substring(0, 40));
}

export async function generateCompilationAction(topic: string, videos: RawYouTubeVideoData[]): Promise<string> {
  // Generate AI compilation title & short clip titles in parallel
  const [aiTitle, shortTitles] = await Promise.all([
    generateCompilationTitle(topic, videos),
    generateClipTitles(topic, videos),
  ]);
  
  console.log(`[generate] AI title: "${aiTitle}"`);
  console.log(`[generate] Short clip titles:`, shortTitles);

  const [compilation] = await sql`
    INSERT INTO compilations (topic) VALUES (${aiTitle}) RETURNING id;
  `;
  const compilationId = compilation.id;

  let rank = videos.length;

  for (const video of videos) {
    const [dbVideo] = await sql`
      INSERT INTO videos (
        youtube_id, category, title, description, channel_id, channel_title,
        thumbnail_url, duration_seconds, view_count, like_count, comment_count, score
      ) VALUES (
        ${video.youtubeId}, 'compilation', ${video.title}, ${video.description},
        ${video.channelId}, ${video.channelTitle}, ${video.thumbnailUrl ?? null},
        ${video.durationSeconds}, ${video.viewCount}, ${video.likeCount},
        ${video.commentCount}, 50
      )
      ON CONFLICT (youtube_id) DO UPDATE SET updated_at = now()
      RETURNING id;
    `;

    const startTime = 0;
    const endTime = video.durationSeconds;
    // Use the AI generated punchy title
    const overlayText = shortTitles[videos.length - rank];

    await sql`
      INSERT INTO compilation_clips (
        compilation_id, video_id, start_time, end_time, rank_number, overlay_text
      ) VALUES (
        ${compilationId}, ${dbVideo.id}, ${startTime}, ${endTime}, ${rank}, ${overlayText}
      )
    `;

    rank -= 1;
  }

  return compilationId;
}
