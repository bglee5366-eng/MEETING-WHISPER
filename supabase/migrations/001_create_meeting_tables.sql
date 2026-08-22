create extension if not exists pgcrypto;

create table if not exists public.meetings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  title text not null,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  duration_seconds integer check (duration_seconds is null or duration_seconds >= 0),
  status text not null default 'active' check (status in ('active', 'completed', 'deleted')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.transcripts (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references public.meetings(id) on delete cascade,
  text text not null,
  started_at timestamptz not null,
  ended_at timestamptz,
  is_final boolean not null default true,
  sequence integer not null check (sequence >= 0),
  client_id text,
  created_at timestamptz not null default now(),
  unique (meeting_id, sequence)
);
create unique index if not exists transcripts_meeting_client_id_idx on public.transcripts(meeting_id, client_id) where client_id is not null;
create index if not exists transcripts_meeting_sequence_idx on public.transcripts(meeting_id, sequence);

create table if not exists public.summaries (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references public.meetings(id) on delete cascade,
  core text not null,
  issues text not null,
  speaking_point text not null,
  question text,
  decision text,
  numbers jsonb default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.responses (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references public.meetings(id) on delete cascade,
  text text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.meeting_notes (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null unique references public.meetings(id) on delete cascade,
  title text not null,
  content text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.set_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;
drop trigger if exists meetings_set_updated_at on public.meetings;
create trigger meetings_set_updated_at before update on public.meetings for each row execute function public.set_updated_at();
drop trigger if exists meeting_notes_set_updated_at on public.meeting_notes;
create trigger meeting_notes_set_updated_at before update on public.meeting_notes for each row execute function public.set_updated_at();

alter table public.meetings enable row level security;
alter table public.transcripts enable row level security;
alter table public.summaries enable row level security;
alter table public.responses enable row level security;
alter table public.meeting_notes enable row level security;
-- 로그인 전 단계에서는 anon에게 무제한 정책을 만들지 않습니다. 서버의 service_role만 접근합니다.
