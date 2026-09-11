create table repositories (
  id          uuid primary key default gen_random_uuid(),
  github_id   text unique not null,
  full_name   text not null,
  owner       text not null,
  name        text not null,
  default_branch text not null default 'main',
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table branches (
  id              uuid primary key default gen_random_uuid(),
  repository_id   uuid not null references repositories(id) on delete cascade,
  name            text not null,
  sha             text not null,
  is_protected    boolean not null default false,
  last_commit_at  timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (repository_id, name)
);

create table pull_requests (
  id              uuid primary key default gen_random_uuid(),
  repository_id   uuid not null references repositories(id) on delete cascade,
  github_pr_id    text unique not null,
  number          integer not null,
  title           text not null,
  state           text not null check (state in ('open', 'closed', 'merged')),
  author          text not null,
  head_branch     text not null,
  base_branch     text not null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create table comments (
  id              uuid primary key default gen_random_uuid(),
  pull_request_id uuid not null references pull_requests(id) on delete cascade,
  github_comment_id text unique not null,
  author          text not null,
  body            text not null,
  created_at      timestamptz not null default now()
);

-- Indexes
create index idx_branches_repo       on branches (repository_id);
create index idx_prs_repo            on pull_requests (repository_id);
create index idx_prs_state           on pull_requests (state);
create index idx_comments_pr         on comments (pull_request_id);

-- RLS (locked down; service role bypasses)
alter table repositories   enable row level security;
alter table branches       enable row level security;
alter table pull_requests  enable row level security;
alter table comments       enable row level security;

-- Updated-at trigger
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger trg_repositories_updated_at before update on repositories
  for each row execute function update_updated_at();
create trigger trg_branches_updated_at before update on branches
  for each row execute function update_updated_at();
create trigger trg_pull_requests_updated_at before update on pull_requests
  for each row execute function update_updated_at();
