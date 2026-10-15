-- Stet schema. Lives in its own schema so Supabase's public REST API (which exposes
-- "public") cannot reach it; the app connects as the database owner from the server only.

create schema if not exists stet;

create table if not exists stet.users (
  id uuid primary key default gen_random_uuid(),
  email text unique,             -- null for guest accounts
  password_hash text,
  created_at timestamptz not null default now()
);

create table if not exists stet.sessions (
  token_hash text primary key,   -- sha256 of the cookie token; the token itself is never stored
  user_id uuid not null references stet.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);
create index if not exists sessions_user on stet.sessions(user_id);

create table if not exists stet.essays (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references stet.users(id) on delete cascade,
  title text not null default 'Untitled essay',
  essay_type text not null default 'personal_statement',
  prompt_id text,
  prompt_text text,
  word_limit int,
  min_words int,
  char_limit int,
  college text,
  cycle text,
  intent text,
  content text not null default '',
  rev int not null default 0,
  is_sample boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists essays_user on stet.essays(user_id, updated_at desc);

create table if not exists stet.versions (
  id uuid primary key default gen_random_uuid(),
  essay_id uuid not null references stet.essays(id) on delete cascade,
  content text not null,
  word_count int not null,
  kind text not null check (kind in ('manual', 'review', 'auto', 'restore')),
  label text,
  created_at timestamptz not null default now()
);
create index if not exists versions_essay on stet.versions(essay_id, created_at desc);

create table if not exists stet.reviews (
  id uuid primary key default gen_random_uuid(),
  essay_id uuid not null references stet.essays(id) on delete cascade,
  version_id uuid not null references stet.versions(id) on delete cascade,
  result jsonb not null,
  item_status jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists reviews_essay on stet.reviews(essay_id, created_at desc);

create table if not exists stet.rate_limits (
  key text not null,
  window_start timestamptz not null,
  count int not null default 0,
  primary key (key, window_start)
);

-- Defense in depth for the Supabase-hosted copy: no grants for API roles.
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on schema stet from anon, authenticated';
    execute 'revoke all on all tables in schema stet from anon, authenticated';
  end if;
end $$;
