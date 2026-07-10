-- user_files: one row per uploaded statement file (metadata + legacy JSONB
-- transactions column, superseded by the transactions table in a later
-- migration but kept as a rollback net).
--
-- Security model used by EVERY table in this schema: RLS is ON with NO
-- policy, so the public anon key (which ships in the browser bundle) can read
-- nothing. All access goes through the server's service-role key — which
-- bypasses RLS — filtered by the Clerk user_id. The app authenticates with
-- Clerk, not Supabase Auth, so there is no Supabase JWT to write
-- "auth.uid() = user_id" policies against.

CREATE TABLE IF NOT EXISTS public.user_files (
  id                 uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id            text NOT NULL,
  file_name          text NOT NULL,
  transactions       jsonb NOT NULL,
  analysis           jsonb,
  total_amount       numeric,
  transaction_count  integer,
  created_at         timestamptz DEFAULT now()
);

ALTER TABLE public.user_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_files FORCE ROW LEVEL SECURITY;

-- Intentionally NO `CREATE POLICY`: the service-role key bypasses RLS and is
-- the only path that should ever read/write this data.
