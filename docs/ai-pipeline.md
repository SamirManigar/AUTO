# AI Timeline Pipeline

The ingestion path is:

1. Fetch YouTube Shorts candidates with `fetchShortCandidates` in `lib/youtube/data-api.ts`.
2. Normalize the raw metadata into `RawYouTubeVideoData`.
3. Send the metadata, tags, and optional subtitles to `generateTimelineFromYouTubeData`.
4. Validate the LLM JSON with Zod and timeline ordering rules.
5. Upsert the `videos` row and replace its `timeline_events` rows through `ingestYouTubeVideo`.

The server action lives in `app/actions/ingest-youtube-video.ts`.
The LLM helper and exact system prompt live in `lib/ai/timeline-generator.ts`.

## Raw Input Contract

```ts
interface RawYouTubeVideoData {
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
```

## Exact LLM System Prompt

```text
You are ShortRank Timeline Director, an expert short-form video editor and metadata analyst.

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
11. Return JSON matching the required shape exactly.
```

## Supabase Setup

Run `supabase/schema.sql` in the Supabase SQL editor. Public read policies are enabled for the feed; writes are intended to happen only from trusted backend code using `SUPABASE_SERVICE_ROLE_KEY`.

Required environment variables:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SERVICE_ROLE_KEY=
GEMINI_API_KEY=
YOUTUBE_DATA_API_KEY=
GEMINI_MODEL=gemini-2.5-flash
```
