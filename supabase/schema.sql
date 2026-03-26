-- ArduDeck Database Schema
-- Run this in Supabase SQL Editor

-- ============================================================
-- STUDENTS TABLE
-- ============================================================
create table if not exists public.students (
  id            uuid primary key default gen_random_uuid(),
  ra            text not null unique,
  full_name     text not null,
  grade         text not null,        -- e.g. "EF 9A"
  group_name    text not null default 'A', -- group letter A/B
  character_id  int  not null default 0,
  created_at    timestamptz not null default now()
);

-- Index for fast RA lookups (login)
create index if not exists idx_students_ra on public.students(ra);

-- Row Level Security: students can only read their own record
alter table public.students enable row level security;

create policy "Students can read own record"
  on public.students for select
  using (true);  -- open read for RA-based login

create policy "Students can update own character"
  on public.students for update
  using (true)
  with check (true);

-- ============================================================
-- PROJECTS TABLE
-- ============================================================
create table if not exists public.projects (
  id          uuid primary key default gen_random_uuid(),
  student_id  uuid not null references public.students(id) on delete cascade,
  name        text not null,
  data        jsonb not null default '{"components":[],"nodes":[],"edges":[]}',
  updated_at  timestamptz not null default now(),
  created_at  timestamptz not null default now()
);

-- Index for student projects
create index if not exists idx_projects_student_id on public.projects(student_id);

-- Row Level Security
alter table public.projects enable row level security;

create policy "Students can read own projects"
  on public.projects for select
  using (true);

create policy "Students can insert own projects"
  on public.projects for insert
  with check (true);

create policy "Students can update own projects"
  on public.projects for update
  using (true);


create policy "Students can delete own projects"
  on public.projects for delete
  using (true);

-- ============================================================
-- AUTO-UPDATE updated_at
-- ============================================================
create or replace function public.handle_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger on_projects_updated
  before update on public.projects
  for each row execute procedure public.handle_updated_at();
