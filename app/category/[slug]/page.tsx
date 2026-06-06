import DynamicShortPlayer from "@/components/DynamicShortPlayer";
import IngestButton from "@/components/IngestButton";
import { sql } from "@/lib/db/neon";
import { mapVideo } from "@/lib/video-mappers";
import type { DbVideoRow } from "@/types/video";

export const revalidate = 60;

interface CategoryPageProps {
  params: Promise<{
    slug: string;
  }>;
}

function titleCaseSlug(slug: string): string {
  return slug
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function isMissingVideosTableError(message: string): boolean {
  return (
    message.includes("Could not find the table 'public.videos'") ||
    message.includes("relation \"public.videos\" does not exist") ||
    message.includes("schema cache") ||
    message.includes("relation \"videos\" does not exist")
  );
}

export default async function CategoryPage({ params }: CategoryPageProps) {
  const { slug } = await params;
  
  let data: DbVideoRow[] = [];
  let error: any = null;

  try {
    data = await sql`
      SELECT v.*,
        COALESCE(
          json_agg(
            json_build_object(
              'id', te.id,
              'video_id', te.video_id,
              'start_time', te.start_time,
              'end_time', te.end_time,
              'event_type', te.event_type,
              'rank_number', te.rank_number,
              'overlay_text', te.overlay_text,
              'created_at', te.created_at
            ) ORDER BY te.start_time ASC
          ) FILTER (WHERE te.id IS NOT NULL),
          '[]'
        ) as timeline_events
      FROM videos v
      LEFT JOIN timeline_events te ON v.id = te.video_id
      WHERE v.category = ${slug}
      GROUP BY v.id
      ORDER BY v.score DESC, v.created_at DESC
      LIMIT 24;
    ` as DbVideoRow[];
  } catch (err: any) {
    error = err;
  }

  if (error && isMissingVideosTableError(error.message)) {
    const categoryTitle = titleCaseSlug(slug);

    return (
      <main className="min-h-screen px-4 py-6 sm:px-8">
        <section className="mx-auto flex min-h-[80vh] w-full max-w-4xl items-center justify-center">
          <div className="w-full rounded-lg border border-yellow-300/30 bg-black/50 p-6 shadow-2xl shadow-black/50 sm:p-8">
            <p className="text-sm font-black uppercase tracking-[0.32em] text-yellow-300">
              Database setup needed
            </p>
            <h1 className="mt-4 text-4xl font-black uppercase leading-none text-white sm:text-6xl">
              Create the Shorts tables first
            </h1>
            <p className="mt-4 text-base font-semibold leading-7 text-zinc-300">
              The app connected to Neon, but this project does not have the
              <span className="font-black text-cyan-200"> videos </span>
              table yet. Run the SQL in
              <span className="font-black text-cyan-200"> db/schema.sql </span>
              from your Neon SQL editor, then reload this {categoryTitle} feed.
            </p>
            <div className="mt-6 rounded-lg border border-white/10 bg-white/[0.04] p-4">
              <p className="text-xs font-black uppercase tracking-[0.22em] text-cyan-200">
                Local file
              </p>
              <code className="mt-2 block break-all text-sm font-bold text-white">
                C:\Users\SAMIR\Desktop\AUTO\meow\db\schema.sql
              </code>
            </div>
          </div>
        </section>
      </main>
    );
  }

  if (error) {
    throw new Error(`Unable to load ${slug} videos: ${error.message}`);
  }

  const videos = (data ?? []).map(mapVideo);
  const categoryTitle = titleCaseSlug(slug);

  return (
    <main className="min-h-screen px-4 py-6 sm:px-8">
      <section className="mx-auto flex w-full max-w-7xl flex-col gap-7">
        <header className="flex flex-col gap-4 border-b border-white/10 pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-2">
            <p className="text-sm font-black uppercase tracking-[0.32em] text-cyan-300">
              Ranked Feed
            </p>
            <h1 className="text-4xl font-black uppercase leading-none text-white sm:text-6xl">
              {categoryTitle} Shorts
            </h1>
          </div>
          <div className="flex flex-col items-end gap-3 sm:items-end">
            <div className="rounded-lg border border-yellow-300/30 bg-yellow-300/10 px-4 py-3">
              <p className="text-sm font-black uppercase tracking-[0.2em] text-yellow-200">
                {videos.length} active cuts
              </p>
            </div>
            <IngestButton category={slug} categoryTitle={categoryTitle} variant="primary" />
          </div>
        </header>

        {videos.length > 0 ? (
          <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 xl:grid-cols-3">
            {videos.map((video, index) => (
              <DynamicShortPlayer
                key={video.id}
                video={video}
                autoPlay={index === 0}
                muted
                loop
              />
            ))}
          </div>
        ) : (
          <div className="flex min-h-[55vh] items-center justify-center rounded-lg border border-dashed border-white/15 bg-white/[0.03] px-6 text-center">
            <div className="max-w-xl space-y-6">
              <p className="text-sm font-black uppercase tracking-[0.32em] text-yellow-300">
                No timeline cuts yet
              </p>
              <h2 className="text-3xl font-black uppercase text-white">
                Generate overlays for {categoryTitle}
              </h2>
              <p className="text-base font-semibold leading-7 text-zinc-300">
                Click below to fetch the top {categoryTitle} Shorts from YouTube,
                run them through Gemini to generate timestamped rank overlays,
                and store everything in your database — this page will reload automatically.
              </p>
              <IngestButton category={slug} categoryTitle={categoryTitle} variant="ghost" />
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
