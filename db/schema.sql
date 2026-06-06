create extension if not exists pgcrypto;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'timeline_event_type') then
    create type timeline_event_type as enum ('title', 'rank');
  end if;
end $$;

create table if not exists public.videos (
  id uuid primary key default gen_random_uuid(),
  youtube_id text not null unique,
  category text not null,
  title text not null,
  description text,
  channel_id text,
  channel_title text,
  thumbnail_url text,
  duration_seconds double precision,
  view_count bigint not null default 0,
  like_count bigint not null default 0,
  comment_count bigint not null default 0,
  score double precision not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint videos_youtube_id_format check (youtube_id ~ '^[A-Za-z0-9_-]{6,}$'),
  constraint videos_category_slug check (category ~ '^[a-z0-9-]+$'),
  constraint videos_duration_positive check (duration_seconds is null or duration_seconds > 0)
);

create table if not exists public.timeline_events (
  id uuid primary key default gen_random_uuid(),
  video_id uuid not null references public.videos(id) on delete cascade,
  start_time double precision not null,
  end_time double precision not null,
  event_type timeline_event_type not null,
  rank_number integer,
  overlay_text text not null,
  created_at timestamptz not null default now(),
  constraint timeline_time_bounds check (start_time >= 0 and end_time > start_time),
  constraint timeline_rank_number_required check (
    (event_type = 'rank' and rank_number is not null and rank_number > 0)
    or
    (event_type = 'title' and rank_number is null)
  ),
  constraint timeline_overlay_text_length check (char_length(overlay_text) between 1 and 120)
);

create index if not exists videos_category_score_idx
  on public.videos (category, score desc, created_at desc);

create index if not exists timeline_events_video_time_idx
  on public.timeline_events (video_id, start_time, end_time);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists videos_set_updated_at on public.videos;
create trigger videos_set_updated_at
before update on public.videos
for each row
execute function public.set_updated_at();

create table if not exists public.compilations (
  id uuid primary key default gen_random_uuid(),
  topic text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.compilation_clips (
  id uuid primary key default gen_random_uuid(),
  compilation_id uuid not null references public.compilations(id) on delete cascade,
  video_id uuid not null references public.videos(id) on delete cascade,
  start_time double precision not null,
  end_time double precision not null,
  rank_number integer not null,
  overlay_text text not null,
  created_at timestamptz not null default now(),
  constraint compilation_clips_rank_positive check (rank_number > 0)
);
