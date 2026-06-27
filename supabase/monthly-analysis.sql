-- ============================================================================
-- Per-calendar-month AI analysis: monthly_analysis table
-- ============================================================================
-- Run this ONCE in the Supabase dashboard:
--   Dashboard → SQL Editor → New query → paste this → Run
--
-- The Analysis tab no longer analyzes individual files. It pools transactions
-- across all of a user's files and analyzes one calendar month at a time. Each
-- month's result is cached here (keyed by user_id + month_key like '2026-06')
-- so reopening a month is instant; a "Re-analyze" button overwrites the row via
-- upsert (hence the UNIQUE constraint below).
--
-- Same security model as user_files: RLS is ON with NO policy, so the public
-- anon key can read nothing. All access goes through the service-role key on the
-- server (lib/monthlyAnalysis.js), filtered by the Clerk user_id.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.monthly_analysis (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     text NOT NULL,
  month_key   text NOT NULL,                 -- 'YYYY-MM' (calendar month)
  analysis    jsonb NOT NULL,
  updated_at  timestamptz DEFAULT now(),
  UNIQUE (user_id, month_key)                -- one cached result per user+month
);

-- Lock the table down to the trusted server (service-role) only — same as user_files.
ALTER TABLE public.monthly_analysis ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.monthly_analysis FORCE ROW LEVEL SECURITY;

-- Intentionally NO `CREATE POLICY`: the service-role key bypasses RLS and is the
-- only path that should ever read/write this data.
-- ============================================================================
