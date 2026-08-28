-- Adds live balance data to plaid_accounts, so ConnectedAccounts.js can show
-- each connected account's current balance next to its name/mask.
--
-- Nullable, and deliberately not backfilled: an account only gets a balance
-- once something actually fetches one (the initial Link exchange, or the
-- next sync — see lib/plaidItemStorage.js plaidAccountsToRows and its two
-- callers). Older connections just show no balance until their next sync
-- refreshes it, rather than this migration guessing at a value.
--
-- current_balance follows Plaid's own sign convention: for depository
-- accounts it's what's in the account; for credit accounts it's the amount
-- owed (a positive number) — the UI is responsible for labeling that
-- distinction, this column just stores what Plaid reports.
ALTER TABLE public.plaid_accounts
  ADD COLUMN IF NOT EXISTS current_balance    numeric,
  ADD COLUMN IF NOT EXISTS available_balance  numeric,
  ADD COLUMN IF NOT EXISTS iso_currency_code  text,
  ADD COLUMN IF NOT EXISTS balance_updated_at timestamptz;
