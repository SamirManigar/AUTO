import { z } from "zod";
import type {
  GeneratedTimelineEvent,
  GeneratedTimelinePayload,
} from "@/types/video";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RawYouTubeVideoData {
  youtubeId: string;
  title: string;
  description: string;
  tags: string[];
  channelId: string;
  channelTitle: string;
  thumbnailUrl?: string | null;
  durationSeconds: number;
  viewCount: number;
  likeCount: number;
  commentCount: number;
  subtitles?: string;
}

// ─── System Prompt ────────────────────────────────────────────────────────────

export const TIMELINE_SYSTEM_PROMPT = `You are ShortRank Timeline Director, an expert short-form video editor and metadata analyst.

Your job is to transform one YouTube Shorts candidate into a clean JSON object used by a browser-based ranking overlay system.

Return ONLY valid JSON. Do not use markdown, code fences, comments, trailing commas, or prose.

Required output shape:
{
  "category": "lowercase-slug",
  "overall_title": "short punchy compilation title",
  "score": 0.0,
  "timeline_events": [
    {
      "start_time": 0,
      "end_time": 2.8,
      "event_type": "title",
      "rank_number": null,
      "overlay_text": "TOP 5 FUNNIEST CAT MOMENTS"
    },
    {
      "start_time": 2.8,
      "end_time": 6.4,
      "event_type": "rank",
      "rank_number": 5,
      "overlay_text": "BRO FORGOT HOW TO JUMP"
    }
  ]
}

Rules:
1. category must be a lowercase URL slug using only a-z, 0-9, and hyphens.
2. score must be a number from 0 to 100 estimating viral/ranking usefulness.
3. timeline_events must cover a compelling ranking edit for the supplied duration.
4. The first event must always be event_type "title", start_time 0, rank_number null, and end in the opening 1.5 to 4 seconds.
5. Rank events must use event_type "rank", a positive integer rank_number, and punchy overlay_text.
6. Use descending rank order when creating a countdown: 5, 4, 3, 2, 1 when enough moments exist. Use fewer rank events only when the clip is too short.
7. start_time and end_time must be seconds as numbers. They must be non-overlapping, ascending, and end_time must be greater than start_time.
8. No event may exceed the video's durationSeconds.
9. overlay_text must be uppercase, high-energy, and 120 characters or fewer.
10. Do not invent claims that conflict with the supplied title, description, tags, or subtitles. If subtitles are absent, infer cautiously from metadata.
11. Return JSON matching the required shape exactly.`;

// ─── Zod Schemas ──────────────────────────────────────────────────────────────

const timelineEventSchema = z
  .object({
    start_time: z.number().min(0),
    end_time: z.number().positive(),
    event_type: z.enum(["title", "rank"]),
    rank_number: z.number().int().positive().nullable(),
    overlay_text: z.string().trim().min(1).max(120),
  })
  .superRefine((event, ctx) => {
    if (event.end_time <= event.start_time) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "end_time must be greater than start_time",
        path: ["end_time"],
      });
    }

    if (event.event_type === "title" && event.rank_number !== null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "title events must use rank_number null",
        path: ["rank_number"],
      });
    }

    if (event.event_type === "rank" && event.rank_number === null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "rank events must include rank_number",
        path: ["rank_number"],
      });
    }
  });

const timelinePayloadSchema = z.object({
  category: z.string().regex(/^[a-z0-9-]+$/),
  overall_title: z.string().trim().min(1).max(120),
  score: z.number().min(0).max(100),
  timeline_events: z.array(timelineEventSchema).min(2).max(12),
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function extractJsonObject(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) return trimmed;

  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");

  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
    throw new Error("LLM response did not contain a JSON object.");
  }

  return trimmed.slice(firstBrace, lastBrace + 1);
}

function normalizeEventText(event: GeneratedTimelineEvent): GeneratedTimelineEvent {
  return { ...event, overlay_text: event.overlay_text.trim().toUpperCase() };
}

function validateTimelineOrdering(
  payload: GeneratedTimelinePayload,
  durationSeconds: number,
): GeneratedTimelinePayload {
  const events = payload.timeline_events.map(normalizeEventText);

  events.forEach((event, index) => {
    if (event.end_time > durationSeconds) {
      throw new Error(`Timeline event ${index} exceeds video duration ${durationSeconds}s.`);
    }
    if (index > 0 && event.start_time < events[index - 1].end_time) {
      throw new Error(`Timeline event ${index} overlaps the previous event.`);
    }
  });

  const first = events[0];
  if (first.event_type !== "title" || first.start_time !== 0 || first.rank_number !== null) {
    throw new Error("The first timeline event must be a title event starting at 0 seconds.");
  }

  return {
    ...payload,
    overall_title: payload.overall_title.trim().toUpperCase(),
    timeline_events: events,
  };
}

// Shared OpenAI-compatible response type used by both Groq and OpenRouter.
interface ChatCompletion {
  choices?: Array<{
    message?: { content?: string | null };
    finish_reason?: string;
  }>;
  error?: { message: string };
}

function extractContentFromCompletion(
  completion: ChatCompletion,
  providerName: string,
  modelName: string,
): string {
  if (completion.error) {
    throw new Error(`${providerName} API error: ${completion.error.message}`);
  }

  const finishReason = completion.choices?.[0]?.finish_reason;
  const content = completion.choices?.[0]?.message?.content?.trim();

  if (!content) {
    console.error(
      `[timeline-generator] Empty content from ${modelName}. finish_reason=${finishReason}. Full response:`,
      JSON.stringify(completion, null, 2),
    );
    throw new Error(
      `${providerName} returned an empty response (model=${modelName}, finish_reason=${finishReason}).`,
    );
  }

  return content;
}

// ─── Tier 1: Groq (Text-only, fast, generous free limits) ────────────────────

const GROQ_DEFAULT_MODEL = "llama-3.3-70b-versatile";

async function generateWithGroq(rawVideo: RawYouTubeVideoData): Promise<GeneratedTimelinePayload> {
  const apiKey = requireEnv("GROQ_API_KEY");
  const model = process.env.GROQ_MODEL ?? GROQ_DEFAULT_MODEL;

  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.35,
      response_format: { type: "json_object" }, // Groq fully supports this
      messages: [
        { role: "system", content: TIMELINE_SYSTEM_PROMPT },
        {
          role: "user",
          content: JSON.stringify({
            youtubeId: rawVideo.youtubeId,
            title: rawVideo.title,
            description: rawVideo.description,
            tags: rawVideo.tags,
            durationSeconds: rawVideo.durationSeconds,
            viewCount: rawVideo.viewCount,
            likeCount: rawVideo.likeCount,
            commentCount: rawVideo.commentCount,
            subtitles: rawVideo.subtitles ?? null,
          }),
        },
      ],
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Groq request failed: ${body}`);
  }

  const completion = (await response.json()) as ChatCompletion;
  const content = extractContentFromCompletion(completion, "Groq", model);
  const parsed = timelinePayloadSchema.parse(JSON.parse(extractJsonObject(content)));
  return validateTimelineOrdering(parsed, rawVideo.durationSeconds);
}

export async function generateTimelineFromYouTubeData(
  rawVideo: RawYouTubeVideoData,
): Promise<GeneratedTimelinePayload> {
  const category = "uncategorized"; // We don't have the exact slug here, but it gets overridden in the ingest action anyway.
  
  try {
    if (process.env.GROQ_API_KEY) {
      return await generateWithGroq(rawVideo);
    }
  } catch (err: any) {
    console.warn(`[timeline-generator] Groq generation failed: ${err.message}. Trying OpenRouter...`);
  }

  try {
    if (process.env.OPENROUTER_API_KEY) {
      return await generateWithOpenRouter(rawVideo);
    }
  } catch (err: any) {
    console.warn(`[timeline-generator] OpenRouter generation failed: ${err.message}. Using deterministic fallback...`);
  }

  console.warn(`[timeline-generator] Falling back to deterministic timeline generation.`);
  return makeFallbackTimeline(rawVideo, category);
}

const OPENROUTER_DEFAULT_MODEL = "google/gemini-2.0-flash-exp:free";

async function generateWithOpenRouter(rawVideo: RawYouTubeVideoData): Promise<GeneratedTimelinePayload> {
  const apiKey = requireEnv("OPENROUTER_API_KEY");
  const model = process.env.OPENROUTER_MODEL ?? OPENROUTER_DEFAULT_MODEL;

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.35,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: TIMELINE_SYSTEM_PROMPT },
        {
          role: "user",
          content: JSON.stringify({
            youtubeId: rawVideo.youtubeId,
            title: rawVideo.title,
            description: rawVideo.description,
            tags: rawVideo.tags,
            durationSeconds: rawVideo.durationSeconds,
            viewCount: rawVideo.viewCount,
            likeCount: rawVideo.likeCount,
            commentCount: rawVideo.commentCount,
            subtitles: rawVideo.subtitles ?? null,
          }),
        },
      ],
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`OpenRouter request failed: ${body}`);
  }

  const completion = (await response.json()) as ChatCompletion;
  const content = extractContentFromCompletion(completion, "OpenRouter", model);
  const parsed = timelinePayloadSchema.parse(JSON.parse(extractJsonObject(content)));
  return validateTimelineOrdering(parsed, rawVideo.durationSeconds);
}

// ─── Fallback: deterministic timeline when all AI tiers fail ─────────────────

export function makeFallbackTimeline(
  rawVideo: RawYouTubeVideoData,
  category: string,
): GeneratedTimelinePayload {
  const safeDuration = Math.max(rawVideo.durationSeconds, 2.5);
  const titleEnd = Math.min(3, Math.max(1.5, safeDuration * 0.2));
  const rankSlots = safeDuration < 10 ? 3 : 5;
  const slotLength = (safeDuration - titleEnd) / rankSlots;
  const title = rawVideo.title.slice(0, 86).toUpperCase();

  const events: GeneratedTimelineEvent[] = [
    {
      start_time: 0,
      end_time: titleEnd,
      event_type: "title",
      rank_number: null,
      overlay_text: title,
    },
  ];

  for (let index = 0; index < rankSlots; index += 1) {
    const start = titleEnd + slotLength * index;
    const end = index === rankSlots - 1 ? safeDuration : start + slotLength;

    events.push({
      start_time: Number(start.toFixed(2)),
      end_time: Number(end.toFixed(2)),
      event_type: "rank",
      rank_number: rankSlots - index,
      overlay_text: `MOMENT ${rankSlots - index} WORTH REPLAYING`,
    });
  }

  return {
    category,
    overall_title: title,
    score: 50,
    timeline_events: events,
  };
}
