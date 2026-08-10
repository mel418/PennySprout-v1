-- Plaid Items: one row per linked bank connection (Pro feature).
--
-- A Plaid "Item" is a login at one institution — it can cover several
-- accounts (checking + savings + credit card all show up under one Item).
-- access_token_enc is the long-lived credential Plaid uses to pull that
-- Item's data; it is NEVER stored in plaintext (see lib/plaidCrypto.js) and
-- NEVER leaves the server (lib/plaidItemStorage.js enforces an explicit
-- column allowlist so a route can't accidentally select it into a response).
--
-- cursor is /transactions/sync's pagination cursor — NULL means "never
-- synced yet." status drives both the UI (paused banner, reconnect prompt)
-- and the sync cron (only 'active' items are synced; see
-- lib/plaidItemStorage.js getSyncableItems):
--   'active'         normal, syncs on the daily cron
--   'login_required' the bank needs the user to re-authenticate via Link's
--                     update mode (ITEM_LOGIN_REQUIRED and friends)
--   'paused'         Pro lapsed; syncing stopped, history is kept
--   'error'          a sync attempt failed for a reason that isn't a login
--                     problem; last_sync_error has details
--   'removed'        /item/remove has been called at Plaid (downgrade reap
--                     or account deletion); kept as a tombstone rather than
--                     deleted so plaid_item_id on old transactions still
--                     resolves to something
--
-- Same security model as every other table here: RLS is ON with NO policy,
-- so the public anon key can read nothing. All access goes through the
-- service-role key on the server.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.plaid_items (
  id                          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id                     text NOT NULL,          -- Clerk user id
  item_id                     text NOT NULL UNIQUE,   -- Plaid's item_id
  access_token_enc            text NOT NULL,          -- AES-256-GCM ciphertext (lib/plaidCrypto.js), never plaintext
  access_token_key_ver        smallint NOT NULL DEFAULT 1,
  institution_id              text,
  institution_name            text,
  cursor                      text,                   -- /transactions/sync next_cursor; NULL = never synced
  status                      text NOT NULL DEFAULT 'active',
  status_changed_at           timestamptz DEFAULT now(),
  error_code                  text,
  last_synced_at              timestamptz,
  last_sync_error             text,
  transactions_update_status  text,                   -- NOT_READY | INITIAL_UPDATE_COMPLETE | HISTORICAL_UPDATE_COMPLETE
  created_at                  timestamptz DEFAULT now()
);

-- Every list-for-user query (the /api/plaid/items route, account deletion).
CREATE INDEX IF NOT EXISTS plaid_items_user_idx ON public.plaid_items (user_id);

-- The sync cron's candidate query: active items, oldest-synced-first.
CREATE INDEX IF NOT EXISTS plaid_items_sync_idx ON public.plaid_items (status, last_synced_at);

ALTER TABLE public.plaid_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plaid_items FORCE ROW LEVEL SECURITY;

-- Intentionally NO `CREATE POLICY`: the service-role key bypasses RLS and is
-- the only path that should ever read/write this data.
-- ============================================================================
