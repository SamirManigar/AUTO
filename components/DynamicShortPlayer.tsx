"use client";

import dynamic from "next/dynamic";
import type { ComponentType } from "react";
import { useMemo, useState } from "react";
import { twMerge } from "tailwind-merge";
import type { DynamicShortPlayerProps, TimelineEvent } from "@/types/video";

interface ReactPlayerProgress {
  played: number;
  playedSeconds: number;
  loaded: number;
  loadedSeconds: number;
}

interface YouTubeReactPlayerProps {
  url: string;
  playing?: boolean;
  muted?: boolean;
  loop?: boolean;
  controls?: boolean;
  playsinline?: boolean;
  width?: string | number;
  height?: string | number;
  progressInterval?: number;
  onProgress?: (progress: ReactPlayerProgress) => void;
  config?: {
    youtube?: {
      playerVars?: Record<string, string | number>;
    };
  };
}

const ReactPlayer = dynamic<YouTubeReactPlayerProps>(
  () =>
    import("react-player/youtube").then(
      (module) => module.default as ComponentType<YouTubeReactPlayerProps>,
    ),
  {
    ssr: false,
    loading: () => <div className="absolute inset-0 animate-pulse bg-zinc-950" />,
  },
);

function findActiveTimelineEvent(
  events: TimelineEvent[],
  playedSeconds: number,
): TimelineEvent | null {
  let low = 0;
  let high = events.length - 1;

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const event = events[mid];

    if (playedSeconds < event.startTime) {
      high = mid - 1;
      continue;
    }

    if (playedSeconds >= event.endTime) {
      low = mid + 1;
      continue;
    }

    return event;
  }

  return null;
}

function formatCount(value: number): string {
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1)}M`;
  }

  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(1)}K`;
  }

  return String(value);
}

export default function DynamicShortPlayer({
  video,
  autoPlay = false,
  muted = true,
  loop = true,
  className,
}: DynamicShortPlayerProps) {
  const [playedSeconds, setPlayedSeconds] = useState(0);

  const timelineEvents = useMemo(
    () => [...video.timelineEvents].sort((a, b) => a.startTime - b.startTime),
    [video.timelineEvents],
  );

  const activeEvent = useMemo(
    () => findActiveTimelineEvent(timelineEvents, playedSeconds),
    [timelineEvents, playedSeconds],
  );

  const videoUrl = `https://www.youtube.com/shorts/${video.youtubeId}`;

  return (
    <article className={twMerge("flex w-full flex-col items-center gap-3", className)}>
      <div className="relative aspect-[9/16] w-full max-w-sm overflow-hidden rounded-2xl bg-black shadow-2xl shadow-cyan-950/30 ring-1 ring-white/10">
        <div className="shorts-player absolute inset-0 z-0">
          <ReactPlayer
            url={videoUrl}
            playing={autoPlay}
            muted={muted}
            loop={loop}
            controls
            playsinline
            width="100%"
            height="100%"
            progressInterval={120}
            onProgress={(progress) => {
              setPlayedSeconds(progress.playedSeconds);
            }}
            config={{
              youtube: {
                playerVars: {
                  modestbranding: 1,
                  playsinline: 1,
                  rel: 0,
                },
              },
            }}
          />
        </div>

        <div className="pointer-events-none absolute inset-0 z-10 flex flex-col justify-between px-4 py-8 sm:px-5">
          <div className="flex min-h-20 items-start justify-between gap-3">
            {activeEvent?.eventType === "rank" ? (
              <div className="rounded-lg border border-yellow-300/60 bg-black/40 px-4 py-2 shadow-lg shadow-black/60 backdrop-blur-sm">
                <p className="text-xs font-black uppercase tracking-[0.24em] text-cyan-200">
                  Rank
                </p>
                <p className="text-6xl font-black uppercase leading-none text-yellow-300 drop-shadow-[0_5px_5px_rgba(0,0,0,1)]">
                  #{activeEvent.rankNumber}
                </p>
              </div>
            ) : (
              <div className="rounded-md bg-black/40 px-3 py-2 text-xs font-black uppercase tracking-[0.24em] text-cyan-200 backdrop-blur-sm">
                {video.category}
              </div>
            )}

            <div className="rounded-md bg-black/40 px-3 py-2 text-right backdrop-blur-sm">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-white drop-shadow-[0_5px_5px_rgba(0,0,0,1)]">
                {formatCount(video.viewCount)} views
              </p>
            </div>
          </div>

          {activeEvent?.eventType === "title" ? (
            <div className="flex flex-1 items-center justify-center">
              <h2 className="max-w-[92%] rounded-xl border border-cyan-300/50 bg-black/40 px-5 py-4 text-center text-4xl font-black uppercase leading-[0.95] text-white shadow-2xl shadow-black/70 drop-shadow-[0_5px_5px_rgba(0,0,0,1)] backdrop-blur-sm sm:text-5xl">
                <span className="block text-cyan-200">{activeEvent.overlayText}</span>
              </h2>
            </div>
          ) : (
            <div className="flex flex-1 items-center justify-center" aria-hidden />
          )}

          <div className="flex min-h-36 flex-col justify-end gap-3">
            {activeEvent?.eventType === "rank" ? (
              <div className="mx-auto w-full max-w-[21rem] rounded-xl border border-white/15 bg-black/40 px-4 py-3 text-center shadow-2xl shadow-black/70 backdrop-blur-sm">
                <p className="text-xs font-black uppercase tracking-[0.24em] text-cyan-200">
                  Now playing
                </p>
                <p className="mt-1 text-2xl font-black uppercase leading-tight text-white drop-shadow-[0_5px_5px_rgba(0,0,0,1)]">
                  {activeEvent.overlayText}
                </p>
              </div>
            ) : null}

            <div className="rounded-lg bg-black/40 px-3 py-2 backdrop-blur-sm">
              <p className="line-clamp-2 text-center text-sm font-black uppercase leading-tight text-zinc-100 drop-shadow-[0_5px_5px_rgba(0,0,0,1)]">
                {video.title}
              </p>
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}
