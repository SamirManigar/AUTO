import type { RawYouTubeVideoData } from "@/lib/ai/timeline-generator";

interface YouTubeSearchItem {
  id?: {
    videoId?: string;
  };
}

interface YouTubeVideoItem {
  id: string;
  snippet: {
    title: string;
    description?: string;
    tags?: string[];
    channelId: string;
    channelTitle: string;
    thumbnails?: {
      maxres?: { url: string };
      high?: { url: string };
      medium?: { url: string };
      default?: { url: string };
    };
  };
  contentDetails: {
    duration: string;
  };
  statistics?: {
    viewCount?: string;
    likeCount?: string;
    commentCount?: string;
  };
}

interface YouTubeSearchResponse {
  items?: YouTubeSearchItem[];
  nextPageToken?: string;
}

interface YouTubeVideosResponse {
  items?: YouTubeVideoItem[];
}

export interface FetchShortCandidatesOptions {
  category: string;
  maxResults?: number;
  pageToken?: string;
}

export interface FetchShortCandidatesResult {
  videos: RawYouTubeVideoData[];
  nextPageToken: string | null;
}

function requireEnv(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function parseNumber(value: string | undefined): number {
  if (!value) {
    return 0;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseIsoDuration(duration: string): number {
  const match = duration.match(
    /^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/,
  );

  if (!match) {
    return 0;
  }

  const [, days = "0", hours = "0", minutes = "0", seconds = "0"] = match;

  return (
    Number(days) * 86_400 +
    Number(hours) * 3_600 +
    Number(minutes) * 60 +
    Number(seconds)
  );
}

function pickThumbnail(item: YouTubeVideoItem): string | null {
  return (
    item.snippet.thumbnails?.maxres?.url ??
    item.snippet.thumbnails?.high?.url ??
    item.snippet.thumbnails?.medium?.url ??
    item.snippet.thumbnails?.default?.url ??
    null
  );
}

async function youtubeGet<T>(
  pathname: "search" | "videos",
  params: Record<string, string>,
): Promise<T> {
  const url = new URL(`https://www.googleapis.com/youtube/v3/${pathname}`);

  Object.entries({
    ...params,
    key: requireEnv("YOUTUBE_DATA_API_KEY"),
  }).forEach(([key, value]) => {
    url.searchParams.set(key, value);
  });

  const response = await fetch(url, {
    next: {
      revalidate: 300,
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`YouTube Data API request failed: ${body}`);
  }

  return (await response.json()) as T;
}

export async function fetchShortCandidates({
  category,
  maxResults = 10,
  pageToken,
}: FetchShortCandidatesOptions): Promise<FetchShortCandidatesResult> {
  const search = await youtubeGet<YouTubeSearchResponse>("search", {
    part: "snippet",
    q: `${category} #shorts`,
    type: "video",
    order: "viewCount",
    videoDuration: "short",
    maxResults: String(Math.min(Math.max(maxResults, 1), 25)),
    ...(pageToken ? { pageToken } : {}),
  });

  const ids = (search.items ?? [])
    .map((item) => item.id?.videoId)
    .filter((id): id is string => Boolean(id));

  if (ids.length === 0) {
    return {
      videos: [],
      nextPageToken: search.nextPageToken ?? null,
    };
  }

  const videosResponse = await youtubeGet<YouTubeVideosResponse>("videos", {
    part: "snippet,contentDetails,statistics",
    id: ids.join(","),
    maxResults: String(ids.length),
  });

  const videos = (videosResponse.items ?? [])
    .map((item): RawYouTubeVideoData => {
      const durationSeconds = parseIsoDuration(item.contentDetails.duration);

      return {
        youtubeId: item.id,
        title: item.snippet.title,
        description: item.snippet.description ?? "",
        tags: item.snippet.tags ?? [],
        channelId: item.snippet.channelId,
        channelTitle: item.snippet.channelTitle,
        thumbnailUrl: pickThumbnail(item),
        durationSeconds,
        viewCount: parseNumber(item.statistics?.viewCount),
        likeCount: parseNumber(item.statistics?.likeCount),
        commentCount: parseNumber(item.statistics?.commentCount),
      };
    })
    .filter((video) => video.durationSeconds > 0 && video.durationSeconds <= 75);

  return {
    videos,
    nextPageToken: search.nextPageToken ?? null,
  };
}

export interface SearchYouTubeVideosOptions {
  query: string;
  maxResults?: number;
  pageToken?: string;
}

export async function searchYouTubeVideos({
  query,
  maxResults = 10,
  pageToken,
}: SearchYouTubeVideosOptions): Promise<FetchShortCandidatesResult> {
  const search = await youtubeGet<YouTubeSearchResponse>("search", {
    part: "snippet",
    q: query,
    type: "video",
    order: "relevance",
    maxResults: String(Math.min(Math.max(maxResults, 1), 50)),
    ...(pageToken ? { pageToken } : {}),
  });

  const ids = (search.items ?? [])
    .map((item) => item.id?.videoId)
    .filter((id): id is string => Boolean(id));

  if (ids.length === 0) {
    return {
      videos: [],
      nextPageToken: search.nextPageToken ?? null,
    };
  }

  const videosResponse = await youtubeGet<YouTubeVideosResponse>("videos", {
    part: "snippet,contentDetails,statistics",
    id: ids.join(","),
    maxResults: String(ids.length),
  });

  const videos = (videosResponse.items ?? [])
    .map((item): RawYouTubeVideoData => {
      const durationSeconds = parseIsoDuration(item.contentDetails.duration);

      return {
        youtubeId: item.id,
        title: item.snippet.title,
        description: item.snippet.description ?? "",
        tags: item.snippet.tags ?? [],
        channelId: item.snippet.channelId,
        channelTitle: item.snippet.channelTitle,
        thumbnailUrl: pickThumbnail(item),
        durationSeconds,
        viewCount: parseNumber(item.statistics?.viewCount),
        likeCount: parseNumber(item.statistics?.likeCount),
        commentCount: parseNumber(item.statistics?.commentCount),
      };
    })
    .filter((video) => video.durationSeconds > 0 && video.durationSeconds <= 600);

  return {
    videos,
    nextPageToken: search.nextPageToken ?? null,
  };
}

export async function fetchTrendingVideos(maxResults = 25): Promise<RawYouTubeVideoData[]> {
  const videosResponse = await youtubeGet<YouTubeVideosResponse>("videos", {
    part: "snippet,contentDetails,statistics",
    chart: "mostPopular",
    regionCode: "US",
    maxResults: String(Math.min(Math.max(maxResults, 1), 50)),
  });

  const videos = (videosResponse.items ?? [])
    .map((item): RawYouTubeVideoData => {
      const durationSeconds = parseIsoDuration(item.contentDetails.duration);

      return {
        youtubeId: item.id,
        title: item.snippet.title,
        description: item.snippet.description ?? "",
        tags: item.snippet.tags ?? [],
        channelId: item.snippet.channelId,
        channelTitle: item.snippet.channelTitle,
        thumbnailUrl: pickThumbnail(item),
        durationSeconds,
        viewCount: parseNumber(item.statistics?.viewCount),
        likeCount: parseNumber(item.statistics?.likeCount),
        commentCount: parseNumber(item.statistics?.commentCount),
      };
    });

  return videos;
}
