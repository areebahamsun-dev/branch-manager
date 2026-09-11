-- Weekly checklists for the branch manager app (per branch + week)
create table if not exists weekly_checklists (
  id uuid primary key default gen_random_uuid(),
  branch text not null,
  manager text not null default '',
  week_start date not null,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (branch, week_start)
);

create index if not exists idx_weekly_checklists_branch_week
  on weekly_checklists (branch, week_start desc);

-- Updated-at trigger (function created in the initial schema migration)
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_weekly_checklists_updated_at on weekly_checklists;
create trigger trg_weekly_checklists_updated_at before update on weekly_checklists
  for each row execute function update_updated_at();

-- The app is public (no login), so anon has full access.
-- Restrict or swap for authenticated policies when you add auth.
alter table weekly_checklists enable row level security;

drop policy if exists "public select" on weekly_checklists;
create policy "public select" on weekly_checklists for select using (true);

drop policy if exists "public insert" on weekly_checklists;
create policy "public insert" on weekly_checklists for insert with check (true);

drop policy if exists "public update" on weekly_checklists;
create policy "public update" on weekly_checklists for update using (true) with check (true);

drop policy if exists "public delete" on weekly_checklists;
create policy "public delete" on weekly_checklists for delete using (true);