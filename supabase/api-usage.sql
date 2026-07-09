-- ============================================================================
-- Per-user daily API usage counters: api_usage table + increment function
-- ============================================================================
-- Run this ONCE in the Supabase dashboard:
--   Dashboard → SQL Editor → New query → paste this → Run
--
-- WHY THIS EXISTS
-- ---------------
-- /api/analyze and /api/parse-pdf call the Anthropic API, which costs real
-- money per request. Authentication alone doesn't cap spend — one compromised
-- session or a buggy client retry loop could run up unbounded charges. This
-- table counts each user's calls per route per day; lib/rateLimit.js checks
-- the count against a daily limit and the routes return 429 when it's hit.
--
-- Counters live in Postgres (not in-process memory) because the app runs on
-- serverless — each request may hit a fresh instance, so memory counters
-- would silently reset.
--
-- Same security model as the other tables: RLS ON with NO policy, so the
-- public anon key can read nothing. Only the server's service-role key
-- (which bypasses RLS) touches this table.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.api_usage (
  user_id text NOT NULL,
  day     date NOT NULL,
  route   text NOT NULL,
  count   integer NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, day, route)
);

ALTER TABLE public.api_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_usage FORCE ROW LEVEL SECURITY;

-- Atomically bump today's counter for (user, route) and return the new count.
-- Doing insert-or-increment in one statement avoids the read-then-write race
-- two concurrent requests would otherwise have.
CREATE OR REPLACE FUNCTION public.increment_api_usage(p_user_id text, p_route text)
RETURNS integer
LANGUAGE sql
AS $$
  INSERT INTO public.api_usage (user_id, day, route, count)
  VALUES (p_user_id, current_date, p_route, 1)
  ON CONFLICT (user_id, day, route)
  DO UPDATE SET count = api_usage.count + 1
  RETURNING count;
$$;

-- Optional housekeeping: old rows are tiny and harmless, but you can clear
-- anything older than 60 days occasionally:
--   DELETE FROM public.api_usage WHERE day < current_date - 60;
-- ============================================================================
