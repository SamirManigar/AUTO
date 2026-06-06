export type TimelineEventType = "title" | "rank";

export interface TimelineEvent {
  id: string;
  videoId: string;
  startTime: number;
  endTime: number;
  eventType: TimelineEventType;
  rankNumber: number | null;
  overlayText: string;
  createdAt?: string;
}

export interface Video {
  id: string;
  youtubeId: string;
  category: string;
  title: string;
  description: string | null;
  channelId: string | null;
  channelTitle: string | null;
  thumbnailUrl: string | null;
  durationSeconds: number | null;
  viewCount: number;
  likeCount: number;
  commentCount: number;
  score: number;
  createdAt: string;
  updatedAt: string;
  timelineEvents: TimelineEvent[];
}

export interface DynamicShortPlayerProps {
  video: Video;
  autoPlay?: boolean;
  muted?: boolean;
  loop?: boolean;
  className?: string;
}

export interface CategoryFeedProps {
  category: string;
  videos: Video[];
}

export interface DbTimelineEventRow {
  id: string;
  video_id: string;
  start_time: number;
  end_time: number;
  event_type: TimelineEventType;
  rank_number: number | null;
  overlay_text: string;
  created_at: string;
}

export interface DbVideoRow {
  id: string;
  youtube_id: string;
  category: string;
  title: string;
  description: string | null;
  channel_id: string | null;
  channel_title: string | null;
  thumbnail_url: string | null;
  duration_seconds: number | null;
  view_count: number | null;
  like_count: number | null;
  comment_count: number | null;
  score: number | null;
  created_at: string;
  updated_at: string;
  timeline_events: DbTimelineEventRow[] | null;
}

export interface GeneratedTimelineEvent {
  start_time: number;
  end_time: number;
  event_type: TimelineEventType;
  rank_number: number | null;
  overlay_text: string;
}

export interface GeneratedTimelinePayload {
  category: string;
  overall_title: string;
  score: number;
  timeline_events: GeneratedTimelineEvent[];
}
