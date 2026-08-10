// The impure half of Plaid syncing: applies a planSyncWrites plan against
// Supabase, and drives the /transactions/sync pagination loop for one item.
// Split out of lib/plaidSync.js so that file's pure planSyncWrites stays
// importable from vitest — see the comment at the top of lib/plaidSync.js
// for why. This module is only ever imported by the two Plaid server routes
// (app/api/plaid/sync, app/api/cron/plaid-sync), never a client component,
// so it's safe even without a hard 'server-only' guard (which would also
// break testing planSyncWrites, since both files would then be entangled).
import { planSyncWrites } from './plaidSync'
import { plaidTxnToClientShape } from './plaidMapping'
import { supabase } from '@/lib/supabase'
import { plaid, plaidErrorCode, isReauthRequired } from '@/lib/plaid'
import { updateItemCursor, markItemStatus, getUserItemsForSync } from '@/lib/plaidItemStorage'
import { checkBudgetAlerts } from '@/lib/budgetAlerts'

// Applies one plan from planSyncWrites against the transactions table.
// Order is load-bearing (see planSyncWrites' comment): deletes, then
// inserts, then updates — never re-order this without re-reading why.
export async function applySyncWrites(userId, plan) {
  const { inserts, updates, deleteIds } = plan

  if (deleteIds.length > 0) {
    const { error } = await supabase
      .from('transactions')
      .delete()
      .eq('user_id', userId)
      .in('plaid_transaction_id', deleteIds)
    if (error) {
      console.error('Error deleting reconciled Plaid transactions:', error)
      throw new Error('Failed to apply sync deletes')
    }
  }

  if (inserts.length > 0) {
    // ignoreDuplicates: re-delivery of an already-applied page (e.g. after a
    // TRANSACTIONS_SYNC_MUTATION_DURING_PAGINATION retry restarts from the
    // original cursor) is a no-op, not an error and not a duplicate row —
    // the transactions_user_plaid_txn_key unique constraint is what makes
    // this safe to call repeatedly.
    const { error } = await supabase
      .from('transactions')
      .upsert(inserts, { onConflict: 'user_id,plaid_transaction_id', ignoreDuplicates: true })
    if (error) {
      console.error('Error inserting synced Plaid transactions:', error)
      throw new Error('Failed to apply sync inserts')
    }
  }

  // One request per modified transaction: each carries different column
  // values, and modified[] is typically far smaller than added[] — Plaid
  // only re-sends a transaction when something about it actually changed.
  for (const { plaid_transaction_id, columns } of updates) {
    const { error } = await supabase
      .from('transactions')
      .update(columns)
      .eq('user_id', userId)
      .eq('plaid_transaction_id', plaid_transaction_id)
    if (error) {
      console.error('Error updating synced Plaid transaction:', error)
      throw new Error('Failed to apply sync updates')
    }
  }
}

// Bounded retries for TRANSACTIONS_SYNC_MUTATION_DURING_PAGINATION — Plaid's
// documented signal that data changed mid-pagination and the whole update
// must restart from the FIRST page's cursor, not the page that failed.
const MAX_MUTATION_RETRIES = 2

// Pages through /transactions/sync for one item until has_more is false,
// applying and persisting each page as it arrives. `item` is the shape
// lib/plaidItemStorage.js getPlaidItemWithToken / getSyncableItems /
// getUserItemsForSync return: { id, cursor, accessToken, ... }.
//
// Never throws — a sync failure for one item must not take down a batch of
// many (the cron) or surface as a 500 for an otherwise-fine request (the
// route). Instead it updates the item's own status/error_code and returns
// { ok: false, error }; callers decide what to do with that.
export async function syncItem(userId, item, { email } = {}) {
  const originalCursor = item.cursor || null
  let cursor = originalCursor
  let hasMore = true
  let updateStatus = null
  const totals = { added: 0, modified: 0, removed: 0 }
  const addedForAlerts = []
  let retriesAtOriginal = 0

  try {
    while (hasMore) {
      let data
      try {
        const res = await plaid.transactionsSync({
          access_token: item.accessToken,
          cursor: cursor || undefined,
          count: 500,
        })
        data = res.data
      } catch (error) {
        const code = plaidErrorCode(error)
        if (code === 'TRANSACTIONS_SYNC_MUTATION_DURING_PAGINATION' && retriesAtOriginal < MAX_MUTATION_RETRIES) {
          retriesAtOriginal++
          cursor = originalCursor
          hasMore = true
          continue
        }
        throw error
      }

      const plan = planSyncWrites(data, { userId, itemRowId: item.id })
      await applySyncWrites(userId, plan)

      totals.added += data.added.length
      totals.modified += data.modified.length
      totals.removed += data.removed.length
      addedForAlerts.push(...data.added)

      cursor = data.next_cursor
      hasMore = data.has_more
      updateStatus = data.transactions_update_status || updateStatus
    }

    // The cursor is only persisted once every page in this batch has been
    // successfully applied. If the process dies mid-loop, the next attempt
    // resumes from the last persisted cursor and replays the whole batch —
    // harmlessly, since every write above is idempotent. This also resets
    // the item's status to 'active' (see updateItemCursor's comment).
    await updateItemCursor(userId, item.id, cursor, { updateStatus })

    if (addedForAlerts.length > 0 && email) {
      await checkBudgetAlerts(userId, email, addedForAlerts.map(plaidTxnToClientShape)).catch(error => {
        console.error('Budget alert check failed after Plaid sync:', error)
      })
    }

    return { ok: true, ...totals }
  } catch (error) {
    const code = plaidErrorCode(error)
    const message = error?.response?.data?.error_message || error?.message || String(error)
    const nextStatus = isReauthRequired(code) ? 'login_required' : 'error'
    await markItemStatus(userId, item.id, nextStatus, { errorCode: code, lastSyncError: message }).catch(statusError => {
      console.error('Failed to record Plaid sync failure status:', statusError)
    })
    console.error(`Plaid sync failed for item ${item.id}:`, code || message)
    return { ok: false, error: code || 'sync_failed' }
  }
}

// Syncs every one of a user's own connections (POST /api/plaid/sync with no
// itemId) — sequential, not parallel, so a burst of manual "sync all" clicks
// can't fan out into a pile of concurrent Plaid calls for one user.
export async function syncAllItemsForUser(userId, { email } = {}) {
  const items = await getUserItemsForSync(userId)
  const results = []
  for (const item of items) {
    results.push({ itemId: item.id, ...(await syncItem(userId, item, { email })) })
  }
  return results
}
