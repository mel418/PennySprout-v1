-- ============================================================================
-- Enable Row Level Security (RLS) on user_files
-- ============================================================================
-- Run this ONCE in the Supabase dashboard:
--   Dashboard → SQL Editor → New query → paste this → Run
--
-- WHY THIS MATTERS
-- ----------------
-- The NEXT_PUBLIC_SUPABASE_ANON_KEY is, by design, public — it ships in the
-- browser bundle. Without RLS, anyone who copies that key out of the JS bundle
-- can query EVERY row of user_files directly against the Supabase URL, bypassing
-- the app entirely. Enabling RLS with no permissive policy makes the table
-- return ZERO rows to the anon (and authenticated) roles.
--
-- This app authenticates with Clerk, not Supabase Auth, so there is no Supabase
-- JWT to write per-user "auth.uid() = user_id" policies against. Instead, all
-- data access goes through the SERVICE-ROLE key on the server (lib/supabase.js),
-- which bypasses RLS by design, and every query is filtered by the Clerk user_id
-- in lib/fileStorage.js. So: RLS on + no policy = locked to the public, open to
-- the trusted server. That is exactly what we want.
-- ============================================================================

-- 1. Turn RLS on. With no policy defined, all access via the anon/authenticated
--    roles is denied by default.
ALTER TABLE public.user_files ENABLE ROW LEVEL SECURITY;

-- 2. Force RLS even for the table owner, so nothing slips through.
ALTER TABLE public.user_files FORCE ROW LEVEL SECURITY;

-- Intentionally NO `CREATE POLICY` statements here. The service-role key used by
-- the server bypasses RLS, which is the only path that should ever read/write
-- this data.

-- ----------------------------------------------------------------------------
-- VERIFY
-- ----------------------------------------------------------------------------
-- After running, confirm RLS is enabled:
--   select relname, relrowsecurity, relforcerowsecurity
--   from pg_class where relname = 'user_files';
-- Both boolean columns should be `true`.
--
-- Then sanity-check from the client side: with only the anon key, a
--   select * from user_files
-- should return 0 rows. The app keeps working because it uses the service-role
-- key on the server.
-- ============================================================================
