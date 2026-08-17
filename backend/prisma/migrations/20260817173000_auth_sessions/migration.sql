-- Shared, durable auth sessions.  Refresh-token hashes only; plaintext tokens
-- are never stored.  This migration is safe to apply to an existing database.
create table if not exists public.auth_sessions (
  id uuid primary key,
  user_id uuid not null references public.users(id) on update cascade on delete cascade,
  refresh_token_hash varchar(128) not null,
  expires_at timestamptz not null,
  ip_address inet,
  user_agent text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists auth_sessions_user_expires_idx
  on public.auth_sessions (user_id, expires_at);

create index if not exists auth_sessions_expires_idx
  on public.auth_sessions (expires_at);
