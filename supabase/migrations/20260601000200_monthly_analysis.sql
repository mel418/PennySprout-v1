-- Per-calendar-month AI analysis cache. The Analysis tab pools transactions
-- across all of a user's files and analyzes one calendar month at a time;
-- each result is cached here (keyed by user_id + month_key like '2026-06') so
-- reopening a month is instant. "Re-analyze" overwrites the row via upsert —
-- hence the UNIQUE constraint.

CREATE TABLE IF NOT EXISTS public.monthly_analysis (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     text NOT NULL,
  month_key   text NOT NULL,                 -- 'YYYY-MM' (calendar month)
  analysis    jsonb NOT NULL,
  updated_at  timestamptz DEFAULT now(),
  UNIQUE (user_id, month_key)                -- one cached result per user+month
);

ALTER TABLE public.monthly_analysis ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.monthly_analysis FORCE ROW LEVEL SECURITY;
