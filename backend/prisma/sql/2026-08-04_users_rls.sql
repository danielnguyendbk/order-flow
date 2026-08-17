-- The users table contains password hashes and must never be readable through
-- Supabase's public Data API. The backend database role must own the table or
-- have BYPASSRLS.

alter table public.users enable row level security;

