"use server";

import { generateTimelineFromYouTubeData, type RawYouTubeVideoData } from "@/lib/ai/timeline-generator";
import { sql } from "@/lib/db/neon";

export interface IngestYouTubeVideoResult {
  videoId: string;
  category: string;
  timelineEventCount: number;
}

export async function ingestYouTubeVideo(
  rawVideo: RawYouTubeVideoData,
  category: string, // always use the URL slug, not the AI-generated category
): Promise<IngestYouTubeVideoResult> {
  const generated = await generateTimelineFromYouTubeData(rawVideo);

  let video: { id: string; category: string };
  try {
    const result = await sql`
      INSERT INTO videos (
        youtube_id, category, title, description, channel_id, channel_title,
        thumbnail_url, duration_seconds, view_count, like_count, comment_count, score
      ) VALUES (
        ${rawVideo.youtubeId}, ${category}, ${rawVideo.title}, ${rawVideo.description},
        ${rawVideo.channelId}, ${rawVideo.channelTitle}, ${rawVideo.thumbnailUrl ?? null},
        ${rawVideo.durationSeconds}, ${rawVideo.viewCount}, ${rawVideo.likeCount},
        ${rawVideo.commentCount}, ${generated.score}
      )
      ON CONFLICT (youtube_id) DO UPDATE SET
        category = EXCLUDED.category,
        title = EXCLUDED.title,
        description = EXCLUDED.description,
        channel_id = EXCLUDED.channel_id,
        channel_title = EXCLUDED.channel_title,
        thumbnail_url = EXCLUDED.thumbnail_url,
        duration_seconds = EXCLUDED.duration_seconds,
        view_count = EXCLUDED.view_count,
        like_count = EXCLUDED.like_count,
        comment_count = EXCLUDED.comment_count,
        score = EXCLUDED.score,
        updated_at = now()
      RETURNING id, category;
    `;
    video = result[0] as { id: string; category: string };
  } catch (err: any) {
    throw new Error(`Unable to upsert video: ${err.message}`);
  }

  try {
    await sql`DELETE FROM timeline_events WHERE video_id = ${video.id}`;
  } catch (err: any) {
    throw new Error(`Unable to replace old timeline events: ${err.message}`);
  }

  try {
    if (generated.timeline_events.length > 0) {
      await Promise.all(
        generated.timeline_events.map((event) =>
          sql`
            INSERT INTO timeline_events (
              video_id, start_time, end_time, event_type, rank_number, overlay_text
            ) VALUES (
              ${video.id}, ${event.start_time}, ${event.end_time}, ${event.event_type},
              ${event.rank_number}, ${event.overlay_text}
            )
          `
        )
      );
    }
  } catch (err: any) {
    throw new Error(`Unable to insert timeline events: ${err.message}`);
  }

  return {
    videoId: video.id,
    category: video.category,
    timelineEventCount: generated.timeline_events.length,
  };
}
