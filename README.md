# ShortRank

ShortRank is a Next.js 15 App Router prototype for AI-curated YouTube Shorts feeds. Each Short is rendered inside a strict 9:16 frame with timestamped ranking captions layered over the embedded player.

## Stack

- Next.js 15 App Router
- TypeScript with strict mode
- Tailwind CSS 4
- Supabase Postgres and RLS
- `react-player/youtube` for playback progress hooks
- Official Gemini API timeline generation

## Setup

1. Install dependencies with `npm install`.
2. Copy `.env.example` to `.env.local` and fill in the Supabase, Gemini, and YouTube values.
3. Run `supabase/schema.sql` in the Supabase SQL editor.
4. Start the app with `npm run dev`.
5. Visit `/category/funniest`, `/category/cats`, or any category slug populated in Supabase.

## Key Files

- `components/DynamicShortPlayer.tsx` renders the 9:16 Shorts player and time-synced overlay layer.
- `app/category/[slug]/page.tsx` fetches videos plus `timeline_events` from Supabase.
- `supabase/schema.sql` creates `videos`, `timeline_events`, indexes, checks, and public read policies.
- `app/actions/ingest-youtube-video.ts` stores generated timeline cuts.
- `app/actions/curate-category.ts` searches YouTube for niche Shorts and ingests candidates.
- `lib/ai/timeline-generator.ts` contains the exact LLM system prompt and JSON validation pipeline.
