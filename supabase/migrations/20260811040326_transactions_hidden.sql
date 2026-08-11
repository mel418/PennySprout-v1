-- Lets a transaction be hidden from every total and view without deleting
-- it -- for the common case of the same real-world transaction existing
-- twice: once from a manually uploaded statement, once from a later Plaid
-- bank connection backfilling the same period. Deleting the upload copy is
-- irreversible and, as a live cleanup on this feature proved, risky to get
-- right automatically (a naive date+amount match across ALL uploads
-- wrongly caught unrelated credit-card transactions that happened to share
-- a date and amount with an unrelated checking-account transaction). A
-- reversible hide, applied only after the user reviews and confirms a
-- specific connection's candidate matches, is safer.
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS hidden        boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS hidden_reason text,          -- e.g. 'duplicate_of_plaid'
  ADD COLUMN IF NOT EXISTS hidden_at     timestamptz;

-- Every list/total read filters on (user_id, hidden) together, so index the
-- pair rather than hidden alone.
CREATE INDEX IF NOT EXISTS transactions_user_hidden_idx ON public.transactions (user_id, hidden);
