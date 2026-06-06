"use server";

import { ingestYouTubeVideo } from "@/app/actions/ingest-youtube-video";
import { fetchShortCandidates } from "@/lib/youtube/data-api";

export interface CurateCategoryResult {
  category: string;
  attempted: number;
  inserted: number;
  failures: Array<{
    youtubeId: string;
    reason: string;
  }>;
}

export async function curateCategory(
  category: string,
  maxResults = 8,
): Promise<CurateCategoryResult> {
  const { videos } = await fetchShortCandidates({
    category,
    maxResults,
  });

  const failures: CurateCategoryResult["failures"] = [];
  let inserted = 0;

  for (const video of videos) {
    try {
      await ingestYouTubeVideo(video, category);
      inserted += 1;
    } catch (error) {
      const reason = error instanceof Error ? error.message : "Unknown ingestion error";
      console.error(`[curate-category] Failed to ingest ${video.youtubeId}: ${reason}`);
      failures.push({
        youtubeId: video.youtubeId,
        reason,
      });
    }
  }

  return {
    category,
    attempted: videos.length,
    inserted,
    failures,
  };
}
