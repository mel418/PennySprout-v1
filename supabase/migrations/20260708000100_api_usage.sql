-- Per-user daily API usage counters. /api/analyze and /api/parse-pdf call the
-- Anthropic API, which costs real money per request — this table counts each
-- user's calls per route per day, and lib/rateLimit.js returns 429 over the
-- plan's cap. Counters live in Postgres (not process memory) because the app
-- runs serverless: each request may hit a fresh instance.

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
-- Insert-or-increment in one statement avoids the read-then-write race two
-- concurrent requests would otherwise have.
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

-- Optional housekeeping (not run automatically): rows are tiny, but anything
-- older than 60 days can be cleared with
--   DELETE FROM public.api_usage WHERE day < current_date - 60;
