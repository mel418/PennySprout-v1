-- Budgets + savings goals.
--
-- Budgets are per-category monthly spending limits. One row per user+category
-- (hence the UNIQUE constraint); the limit applies to every calendar month —
-- progress is computed in the app from the transactions table, so there is no
-- per-month budget row to maintain.
--
-- Goals are savings targets ("Emergency fund", "Japan trip") with a manually
-- tracked saved_amount — PennySprout has no bank connection by design, so the
-- user logs contributions themselves.
--
-- Same security model as the other tables: RLS is ON with NO policy, so the
-- public anon key can read nothing. All access goes through the service-role
-- key on the server (lib/budgetStorage.js), filtered by the Clerk user_id.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.budgets (
  id             uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id        text NOT NULL,
  category       text NOT NULL,
  monthly_limit  numeric NOT NULL CHECK (monthly_limit > 0),
  created_at     timestamptz DEFAULT now(),
  updated_at     timestamptz DEFAULT now(),
  UNIQUE (user_id, category)                 -- one budget per user+category
);

CREATE INDEX IF NOT EXISTS budgets_user_idx ON public.budgets (user_id);

ALTER TABLE public.budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.budgets FORCE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.goals (
  id             uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id        text NOT NULL,
  name           text NOT NULL,
  target_amount  numeric NOT NULL CHECK (target_amount > 0),
  saved_amount   numeric NOT NULL DEFAULT 0 CHECK (saved_amount >= 0),
  target_date    date,                       -- optional deadline
  created_at     timestamptz DEFAULT now(),
  updated_at     timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS goals_user_idx ON public.goals (user_id);

ALTER TABLE public.goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.goals FORCE ROW LEVEL SECURITY;

-- Intentionally NO `CREATE POLICY`: the service-role key bypasses RLS and is
-- the only path that should ever read/write this data.
-- ============================================================================
