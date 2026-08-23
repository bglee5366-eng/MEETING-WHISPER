create table if not exists public.project_contexts (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null unique references public.projects(id) on delete cascade,
  description text,
  objective text,
  background text,
  current_status text,
  key_issues text,
  key_terms text,
  ai_instructions text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.project_knowledge (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  title text not null,
  content text not null,
  knowledge_type text not null default 'manual',
  source_type text not null default 'manual',
  source_reference text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  sort_order integer not null default 0,
  archived boolean not null default false
);

create index if not exists project_contexts_project_id_idx on public.project_contexts(project_id);
create index if not exists project_knowledge_project_id_idx on public.project_knowledge(project_id);
create index if not exists project_knowledge_project_created_idx on public.project_knowledge(project_id, created_at desc);

drop trigger if exists project_contexts_set_updated_at on public.project_contexts;
create trigger project_contexts_set_updated_at before update on public.project_contexts for each row execute function public.set_updated_at();
drop trigger if exists project_knowledge_set_updated_at on public.project_knowledge;
create trigger project_knowledge_set_updated_at before update on public.project_knowledge for each row execute function public.set_updated_at();

insert into public.project_contexts (project_id)
select id from public.projects p where not exists (select 1 from public.project_contexts c where c.project_id = p.id);

alter table public.project_contexts enable row level security;
alter table public.project_knowledge enable row level security;
drop policy if exists project_contexts_owner_all on public.project_contexts;
drop policy if exists project_knowledge_owner_all on public.project_knowledge;
create policy project_contexts_owner_all on public.project_contexts for all to authenticated using (exists (select 1 from public.projects p where p.id = project_id and p.user_id = auth.uid())) with check (exists (select 1 from public.projects p where p.id = project_id and p.user_id = auth.uid()));
create policy project_knowledge_owner_all on public.project_knowledge for all to authenticated using (exists (select 1 from public.projects p where p.id = project_id and p.user_id = auth.uid())) with check (exists (select 1 from public.projects p where p.id = project_id and p.user_id = auth.uid()));
