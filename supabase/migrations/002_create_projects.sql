-- Project hierarchy for Meeting Whisper.
-- This migration is additive: existing meetings and meeting data are preserved.
create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  name text not null,
  description text,
  icon text default 'folder',
  color text default 'gray',
  default_provider text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  sort_order integer not null default 0,
  archived boolean not null default false,
  constraint projects_provider_check check (default_provider is null or default_provider in ('openai', 'gemini', 'anthropic'))
);

alter table public.meetings add column if not exists project_id uuid;
create index if not exists projects_user_id_idx on public.projects(user_id);
create index if not exists projects_user_sort_idx on public.projects(user_id, sort_order);
create index if not exists projects_user_archived_idx on public.projects(user_id, archived);
create index if not exists meetings_project_id_idx on public.meetings(project_id);
create index if not exists meetings_project_created_idx on public.meetings(project_id, created_at);

alter table public.meetings drop constraint if exists meetings_project_id_fkey;
alter table public.meetings add constraint meetings_project_id_fkey foreign key (project_id) references public.projects(id) on delete set null;

insert into public.projects (name, description, icon, color)
select '미분류', '프로젝트가 지정되지 않은 회의', 'folder', 'gray'
where not exists (select 1 from public.projects where user_id is null and name = '미분류');

update public.meetings
set project_id = (select id from public.projects where user_id is null and name = '미분류' order by created_at asc limit 1)
where project_id is null;

drop trigger if exists projects_set_updated_at on public.projects;
create trigger projects_set_updated_at before update on public.projects for each row execute function public.set_updated_at();

alter table public.projects enable row level security;
-- The app accesses Supabase only through server Route Handlers. The service_role key bypasses RLS.
-- When Supabase Auth is enabled, these policies protect direct authenticated access by owner.
drop policy if exists projects_authenticated_select on public.projects;
drop policy if exists projects_authenticated_insert on public.projects;
drop policy if exists projects_authenticated_update on public.projects;
drop policy if exists projects_authenticated_delete on public.projects;
create policy projects_authenticated_select on public.projects for select to authenticated using (auth.uid() = user_id);
create policy projects_authenticated_insert on public.projects for insert to authenticated with check (auth.uid() = user_id);
create policy projects_authenticated_update on public.projects for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy projects_authenticated_delete on public.projects for delete to authenticated using (auth.uid() = user_id);
