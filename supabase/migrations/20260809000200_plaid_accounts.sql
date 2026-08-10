-- Plaid Accounts: one row per bank account under a linked Item.
--
-- A single Item (one bank login) can cover multiple accounts — a checking
-- and a savings account at the same bank, for example. This table lets the
-- UI show "Chase •••• 4821" per account and lets a future per-account filter
-- work the same way it already does for uploaded files.
--
-- mask is the last 2-4 digits Plaid returns (never the full account number —
-- Plaid doesn't return that either). Storing it as a structured column,
-- rather than letting it appear in free text, keeps it out of the PII
-- redaction concerns that apply to descriptions (lib/pii.js).
--
-- Same security model as every other table here: RLS is ON with NO policy.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.plaid_accounts (
  id             uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id        text NOT NULL,
  item_id        uuid NOT NULL REFERENCES public.plaid_items(id) ON DELETE CASCADE,
  account_id     text NOT NULL,   -- Plaid's account_id
  name           text,
  official_name  text,
  mask           text,            -- last 2-4 digits only
  type           text,            -- depository | credit | loan | investment | other
  subtype        text,
  created_at     timestamptz DEFAULT now(),
  UNIQUE (user_id, account_id)
);

CREATE INDEX IF NOT EXISTS plaid_accounts_item_idx ON public.plaid_accounts (item_id);

ALTER TABLE public.plaid_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plaid_accounts FORCE ROW LEVEL SECURITY;

-- Intentionally NO `CREATE POLICY`: the service-role key bypasses RLS and is
-- the only path that should ever read/write this data.
-- ============================================================================
