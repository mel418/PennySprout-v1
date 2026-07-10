-- ============================================================================
-- Normalize transactions into their own table (roadmap item 7)
-- ============================================================================
-- Run this ONCE in the Supabase dashboard:
--   Dashboard → SQL Editor → New query → paste this → Run
--
-- WHY THIS EXISTS
-- ---------------
-- Until now every transaction lived inside user_files.transactions as one big
-- JSONB array. That meant GET /api/files shipped every transaction ever
-- uploaded on every page load, dates were stored as unparsed strings in three
-- different formats, and editing one transaction required rewriting the whole
-- blob by array index. This table gives each transaction its own row with a
-- real date column, so queries can be scoped (by month, by file) and edits
-- target a stable id.
--
-- Same security model as the other tables: RLS ON with NO policy, so the
-- public anon key can read nothing. Only the server's service-role key
-- (which bypasses RLS) touches this table. ON DELETE CASCADE keeps the
-- existing "delete a file removes its transactions" behavior.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.transactions (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     text NOT NULL,
  file_id     uuid NOT NULL REFERENCES public.user_files(id) ON DELETE CASCADE,
  date        date,                       -- null when the source string was unparseable
  description text NOT NULL DEFAULT '',
  amount      numeric NOT NULL DEFAULT 0, -- negative = charge, positive = deposit (bank convention preserved)
  category    text,
  note        text,                       -- user's personal annotation, absent unless they add one
  created_at  timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS transactions_user_date_idx ON public.transactions (user_id, date);
CREATE INDEX IF NOT EXISTS transactions_file_idx      ON public.transactions (file_id);

ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions FORCE ROW LEVEL SECURITY;

-- ─── Backfill helpers ────────────────────────────────────────────────────────
-- The JSONB stored dates as strings in three formats (MM/DD/YY, MM/DD/YYYY,
-- ISO) and amounts occasionally with $ or commas. These parsers mirror
-- lib/date.js parseDate: anything unrecognizable becomes NULL/0 instead of
-- aborting the whole migration.

CREATE OR REPLACE FUNCTION public.parse_txn_date(raw text) RETURNS date
LANGUAGE plpgsql IMMUTABLE AS $$
BEGIN
  IF raw IS NULL OR raw = '' THEN RETURN NULL; END IF;
  IF raw ~ '^\d{1,2}/\d{1,2}/\d{4}' THEN RETURN to_date(raw, 'MM/DD/YYYY'); END IF;
  IF raw ~ '^\d{1,2}/\d{1,2}/\d{2}$' THEN RETURN to_date(raw, 'MM/DD/YY'); END IF;
  IF raw ~ '^\d{4}-\d{2}-\d{2}'      THEN RETURN substring(raw from 1 for 10)::date; END IF;
  RETURN NULL;
EXCEPTION WHEN others THEN
  RETURN NULL;
END $$;

CREATE OR REPLACE FUNCTION public.parse_txn_amount(raw text) RETURNS numeric
LANGUAGE plpgsql IMMUTABLE AS $$
BEGIN
  RETURN COALESCE(NULLIF(regexp_replace(COALESCE(raw, ''), '[$,]', '', 'g'), '')::numeric, 0);
EXCEPTION WHEN others THEN
  RETURN 0;
END $$;

-- ─── Backfill ────────────────────────────────────────────────────────────────
-- Idempotent: only migrates files that have no rows in transactions yet, so
-- re-running this script is safe.

INSERT INTO public.transactions (user_id, file_id, date, description, amount, category, note)
SELECT
  f.user_id,
  f.id,
  public.parse_txn_date(COALESCE(t->>'Trans. Date', t->>'Date', t->>'Transaction Date')),
  COALESCE(t->>'Description', ''),
  public.parse_txn_amount(t->>'Amount'),
  t->>'Category',
  NULLIF(t->>'Note', '')
FROM public.user_files f
CROSS JOIN LATERAL jsonb_array_elements(f.transactions) AS t
WHERE jsonb_typeof(f.transactions) = 'array'
  AND NOT EXISTS (SELECT 1 FROM public.transactions x WHERE x.file_id = f.id);

-- ─── Verify ──────────────────────────────────────────────────────────────────
-- Every file's migrated count should equal its transaction_count. A small
-- shortfall means some rows had no parseable content at all.

SELECT
  f.file_name,
  f.transaction_count AS expected,
  count(x.id)         AS migrated,
  count(x.date)       AS with_valid_date
FROM public.user_files f
LEFT JOIN public.transactions x ON x.file_id = f.id
GROUP BY f.id, f.file_name, f.transaction_count
ORDER BY f.created_at;

-- ─── Later cleanup (do NOT run now) ─────────────────────────────────────────
-- The old JSONB column stays as a rollback safety net. Once the app has run
-- happily on this table for a while, reclaim the space with:
--   ALTER TABLE public.user_files DROP COLUMN transactions;
-- (The app writes '[]' to it for new files until then, since it's NOT NULL.)
-- ============================================================================
