-- Lets a transaction row come from a live Plaid sync instead of an uploaded
-- file (roadmap: Plaid bank connections, Pro feature).
--
-- file_id has been NOT NULL since the transactions table was created,
-- because every row used to come from a user-uploaded statement. A synced
-- Plaid transaction has no file — inventing a synthetic user_files row per
-- bank connection was considered and rejected: every file-card affordance
-- (rename, the two-step delete, content-hash dedup, "Review" modal) would be
-- semantically wrong for a live feed, and worst of all, deleting that
-- synthetic file would CASCADE-delete years of synced history that Plaid's
-- cursor has already advanced past and will never redeliver. So instead
-- file_id becomes nullable, and `source` distinguishes the two origins.
--
-- plaid_item_id uses ON DELETE SET NULL, not CASCADE: disconnecting a bank
-- (or Pro lapsing and the item eventually being reaped) must NOT delete the
-- user's transaction history. It's their financial history; only the live
-- connection goes away.
--
-- plaid_transaction_id is the idempotency anchor for /transactions/sync,
-- whose added/modified/removed arrays can redeliver the same transaction
-- across cursor pages or after a retry. The UNIQUE constraint below is what
-- makes `.upsert(rows, { onConflict: 'user_id,plaid_transaction_id' })` in
-- lib/plaidSync.js safe to call repeatedly. Postgres treats NULLs as
-- distinct in a UNIQUE constraint, so the existing upload rows (which have
-- no plaid_transaction_id) are completely unaffected.
-- ============================================================================

ALTER TABLE public.transactions ALTER COLUMN file_id DROP NOT NULL;

ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS source               text NOT NULL DEFAULT 'upload',  -- 'upload' | 'plaid'
  ADD COLUMN IF NOT EXISTS plaid_item_id        uuid REFERENCES public.plaid_items(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS plaid_account_id     text,
  ADD COLUMN IF NOT EXISTS plaid_transaction_id text,
  ADD COLUMN IF NOT EXISTS pending              boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS iso_currency_code    text;

-- ADD CONSTRAINT has no IF NOT EXISTS, so guard it explicitly (same idiom as
-- 20260807181853_target_purchase_items_dedup_key.sql) to keep this migration
-- safe to re-run.
DO $$
BEGIN
  ALTER TABLE public.transactions
    ADD CONSTRAINT transactions_user_plaid_txn_key UNIQUE (user_id, plaid_transaction_id);
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;

CREATE INDEX IF NOT EXISTS transactions_plaid_item_idx ON public.transactions (plaid_item_id);
-- ============================================================================
