import { sql } from "@/lib/db/neon";
import CompilationPlayer from "./CompilationPlayer";
import type { ClipData } from "@/remotion/types";

export default async function CompilationPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  const compilations = await sql`SELECT * FROM compilations WHERE id = ${resolvedParams.id}`;
  
  if (compilations.length === 0) {
    return <div className="text-white text-center mt-20 text-2xl">Compilation not found</div>;
  }
  
  const compilation = compilations[0];

  const rawClips = await sql`
    SELECT c.*, v.youtube_id, v.duration_seconds
    FROM compilation_clips c
    JOIN videos v ON c.video_id = v.id
    WHERE c.compilation_id = ${resolvedParams.id}
    ORDER BY c.rank_number DESC
  `;

  const clips: ClipData[] = rawClips.map(c => ({
    videoId: c.video_id,
    youtubeId: c.youtube_id,
    startTime: c.start_time,
    endTime: c.end_time,
    rankNumber: c.rank_number,
    overlayText: c.overlay_text,
    durationSeconds: c.duration_seconds ?? (c.end_time - c.start_time),
  }));

  if (clips.length === 0) {
    return <div className="text-white text-center mt-20 text-2xl">No clips found for this compilation.</div>;
  }

  return (
    <main className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-6">
      <h1 className="text-4xl font-extrabold mb-8 text-center bg-gradient-to-r from-purple-400 to-pink-600 bg-clip-text text-transparent">
        {compilation.topic}
      </h1>
      
      <CompilationPlayer topic={compilation.topic} clips={clips} compilationId={resolvedParams.id} />
      
      <div className="mt-8 text-zinc-500 text-sm max-w-md text-center">
        This compilation was dynamically sequenced using Remotion and React Player.
      </div>
    </main>
  );
}
