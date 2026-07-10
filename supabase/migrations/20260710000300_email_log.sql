-- Email de-duplication log.
--
-- Every notification email is recorded here BEFORE it is sent, keyed by
-- (user_id, kind, dedupe_key). The UNIQUE constraint is the guarantee that a
-- user gets each alert at most once per key — e.g. one "Food budget exceeded"
-- email per month ('budget-exceeded' + '2026-07:Food'), one upload reminder
-- per month ('upload-reminder' + '2026-07') — no matter how many uploads or
-- cron runs happen.
--
-- Same security model as the other tables: RLS is ON with NO policy; all
-- access goes through the service-role key on the server (lib/email.js).
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.email_log (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     text NOT NULL,
  kind        text NOT NULL,                 -- 'budget-exceeded' | 'upload-reminder' | ...
  dedupe_key  text NOT NULL,                 -- e.g. '2026-07:Food' or '2026-07'
  sent_at     timestamptz DEFAULT now(),
  UNIQUE (user_id, kind, dedupe_key)
);

ALTER TABLE public.email_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_log FORCE ROW LEVEL SECURITY;

-- Intentionally NO `CREATE POLICY`: the service-role key bypasses RLS and is
-- the only path that should ever read/write this data.
-- ============================================================================
