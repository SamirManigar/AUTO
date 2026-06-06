import type {
  DbTimelineEventRow,
  DbVideoRow,
  TimelineEvent,
  Video,
} from "@/types/video";

export function mapTimelineEvent(row: DbTimelineEventRow): TimelineEvent {
  return {
    id: row.id,
    videoId: row.video_id,
    startTime: row.start_time,
    endTime: row.end_time,
    eventType: row.event_type,
    rankNumber: row.rank_number,
    overlayText: row.overlay_text,
    createdAt: row.created_at,
  };
}

export function mapVideo(row: DbVideoRow): Video {
  return {
    id: row.id,
    youtubeId: row.youtube_id,
    category: row.category,
    title: row.title,
    description: row.description,
    channelId: row.channel_id,
    channelTitle: row.channel_title,
    thumbnailUrl: row.thumbnail_url,
    durationSeconds: row.duration_seconds,
    viewCount: row.view_count ?? 0,
    likeCount: row.like_count ?? 0,
    commentCount: row.comment_count ?? 0,
    score: row.score ?? 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    timelineEvents: (row.timeline_events ?? [])
      .map(mapTimelineEvent)
      .sort((a, b) => a.startTime - b.startTime),
  };
}
