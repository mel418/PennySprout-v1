// Turns one page of a /transactions/sync response into a plan of writes
// against the transactions table. PURE — a plain function of its arguments,
// no Supabase or Plaid client involved — so the tricky part (reconciling
// pending transactions, never clobbering a user's category correction,
// staying idempotent across retries) can be unit tested with plain objects
// and no mocking. See lib/__tests__/plaidSync.test.js.
//
// The impure half that actually applies a plan and drives the
// /transactions/sync pagination loop lives in lib/plaidSyncEngine.js, kept
// in a separate file on purpose: that module needs '@/lib/supabase' and
// '@/lib/plaid', both of which import 'server-only', and 'server-only'
// throws unconditionally when loaded outside Next's build (see
// lib/plaidCrypto.js's identical note) — bundling it into this file would
// make planSyncWrites impossible to import from vitest.
import { plaidTxnToRow } from './plaidMapping'

// Columns modified[] is allowed to touch. Deliberately excludes `category`
// and `note`: Plaid re-categorizes transactions constantly as it refines its
// model, and modified[] fires on nearly every sync. A naive
// upsert-everything would silently revert a user's manual correction the
// next time Plaid nudges its own categorization — this allowlist is the
// regression guard against that (see plaidSync.test.js).
const MODIFIED_COLUMNS = ['date', 'description', 'amount', 'pending', 'plaid_account_id', 'iso_currency_code']

function pickModifiedColumns(row) {
  const out = {}
  for (const key of MODIFIED_COLUMNS) out[key] = row[key]
  return out
}

// { added, modified, removed } as returned by /transactions/sync -> a plan
// of { inserts, updates, deleteIds }. `ctx` is { userId, itemRowId } (see
// lib/plaidMapping.js plaidTxnToRow).
//
// Two things fold into deleteIds beyond Plaid's own removed[]:
//   - every added/modified transaction's pending_transaction_id: when a
//     pending charge posts, Plaid gives the POSTED transaction a brand-new
//     transaction_id and (usually) lists the old pending one in removed[].
//     "Usually" isn't "always", so this app doesn't rely on removed[] alone
//     — pending_transaction_id is the reliable signal, and reading it off
//     the posted transaction means the pending row is always cleaned up in
//     the exact same sync page that supersedes it.
//
// Ordering of the returned plan matters to the caller (applySyncWrites in
// lib/plaidSyncEngine.js): deletes must run before inserts, then updates.
// If a single page contains both a pending removal and its posted
// replacement, deleting after inserting could remove the row that was just
// written.
export function planSyncWrites({ added = [], modified = [], removed = [] }, ctx) {
  const deleteIds = new Set(removed.map(r => r.transaction_id))

  const inserts = []
  for (const txn of added) {
    if (txn.pending_transaction_id) deleteIds.add(txn.pending_transaction_id)
    inserts.push(plaidTxnToRow(txn, ctx))
  }

  const updates = []
  for (const txn of modified) {
    if (txn.pending_transaction_id) deleteIds.add(txn.pending_transaction_id)
    const row = plaidTxnToRow(txn, ctx)
    updates.push({ plaid_transaction_id: txn.transaction_id, columns: pickModifiedColumns(row) })
  }

  return { inserts, updates, deleteIds: [...deleteIds] }
}
