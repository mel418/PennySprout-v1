// Server-only access to the plaid_items and plaid_accounts tables (see the
// plaid_items / plaid_accounts migrations). Every query is scoped to
// user_id, same discipline as lib/fileStorage.js and lib/transactionStorage.js.
//
// getPlaidItems (the one the UI calls) uses an explicit column allowlist
// that excludes access_token_enc — the same discipline lib/fileStorage.js
// uses for file metadata — so a route can never accidentally leak an
// encrypted token blob into a client response. Only getPlaidItemWithToken
// and getAllItemsForUser decrypt, and both are for server-only callers that
// need to talk to Plaid.
import 'server-only'
import { supabase } from '@/lib/supabase'
import { encryptToken, decryptToken } from '@/lib/plaidCrypto'

const SUMMARY_COLUMNS =
  'id, item_id, institution_id, institution_name, status, status_changed_at, ' +
  'error_code, last_synced_at, last_sync_error, transactions_update_status, created_at'

function toItemSummary(row) {
  return {
    id: row.id,
    itemId: row.item_id,
    institutionId: row.institution_id,
    institutionName: row.institution_name,
    status: row.status,
    statusChangedAt: row.status_changed_at,
    errorCode: row.error_code,
    lastSyncedAt: row.last_synced_at,
    lastSyncError: row.last_sync_error,
    transactionsUpdateStatus: row.transactions_update_status,
    createdAt: row.created_at,
  }
}

function toAccount(row) {
  return {
    id: row.id,
    accountId: row.account_id,
    name: row.name,
    officialName: row.official_name,
    mask: row.mask,
    type: row.type,
    subtype: row.subtype,
  }
}

// Creates the item row with the access token encrypted. Returns the row id
// (not the summary — callers that just linked an Item usually want to
// immediately upsert accounts against it).
export async function createPlaidItem(userId, { itemId, accessToken, institutionId, institutionName }) {
  const { data, error } = await supabase
    .from('plaid_items')
    .insert({
      user_id: userId,
      item_id: itemId,
      access_token_enc: encryptToken(accessToken),
      institution_id: institutionId || null,
      institution_name: institutionName || null,
    })
    .select('id')
    .single()

  if (error) {
    console.error('Error creating Plaid item:', error)
    throw new Error('Failed to save bank connection')
  }
  return data.id
}

// Everything the "Connected accounts" UI needs, with accounts nested.
// Deliberately safe to call for a free user too, so paused connections stay
// visible (lib/planGate.js gates linking/syncing, not viewing).
export async function getPlaidItems(userId) {
  const { data: items, error } = await supabase
    .from('plaid_items')
    .select(SUMMARY_COLUMNS)
    .eq('user_id', userId)
    .neq('status', 'removed')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching Plaid items:', error)
    return []
  }
  if (items.length === 0) return []

  const { data: accounts, error: accError } = await supabase
    .from('plaid_accounts')
    .select('id, item_id, account_id, name, official_name, mask, type, subtype')
    .eq('user_id', userId)

  if (accError) {
    console.error('Error fetching Plaid accounts:', accError)
  }

  const accountsByItem = {}
  ;(accounts || []).forEach(a => {
    ;(accountsByItem[a.item_id] ||= []).push(toAccount(a))
  })

  return items.map(row => ({
    ...toItemSummary(row),
    accounts: accountsByItem[row.id] || [],
  }))
}

// Decrypts and returns one item's access token, scoped to the user — for
// routes about to call Plaid on that item's behalf (sync, update-mode link,
// disconnect).
export async function getPlaidItemWithToken(userId, id) {
  const { data, error } = await supabase
    .from('plaid_items')
    .select(`${SUMMARY_COLUMNS}, access_token_enc, cursor`)
    .eq('user_id', userId)
    .eq('id', id)
    .maybeSingle()

  if (error) {
    console.error('Error fetching Plaid item:', error)
    throw new Error('Failed to fetch bank connection')
  }
  if (!data) return null

  return {
    ...toItemSummary(data),
    cursor: data.cursor,
    accessToken: decryptToken(data.access_token_enc),
  }
}

// The sync cron's candidate list: active items, oldest-synced-first (NULLs —
// never synced — go first). Includes the decrypted token since the whole
// point of this query is to hand it to /transactions/sync.
export async function getSyncableItems({ limit = 25 } = {}) {
  const { data, error } = await supabase
    .from('plaid_items')
    .select(`id, user_id, item_id, cursor, access_token_enc`)
    .eq('status', 'active')
    .order('last_synced_at', { ascending: true, nullsFirst: true })
    .limit(limit)

  if (error) {
    console.error('Error fetching syncable Plaid items:', error)
    return []
  }

  return data.map(row => ({
    id: row.id,
    userId: row.user_id,
    itemId: row.item_id,
    cursor: row.cursor,
    accessToken: decryptToken(row.access_token_enc),
  }))
}

// Candidates for the cron's pause/reap pass: every item that isn't already
// 'removed', across all users — the cron itself decides pause vs. reap vs.
// leave-alone per row based on plan and status_changed_at.
export async function getAllNonRemovedItems() {
  const { data, error } = await supabase
    .from('plaid_items')
    .select('id, user_id, status, status_changed_at, access_token_enc')
    .in('status', ['active', 'paused', 'login_required', 'error'])

  if (error) {
    console.error('Error fetching Plaid items for plan check:', error)
    return []
  }
  return data.map(row => ({
    id: row.id,
    userId: row.user_id,
    status: row.status,
    statusChangedAt: row.status_changed_at,
    accessToken: decryptToken(row.access_token_enc),
  }))
}

// Called after a successful sync pass. Deliberately also resets `status` to
// 'active' and clears error_code/last_sync_error: a successful sync is proof
// the connection works again, whatever state it was in before (a fresh
// reconnect out of 'login_required', a transient 'error' that cleared
// itself, or a resubscribed user's item that was 'paused' and got synced
// via the manual "Sync now" button before the next cron pass reactivates it
// — see the sync route). Only reachable for items whose accessToken still
// works, so this can never accidentally "heal" a removed item.
export async function updateItemCursor(userId, id, cursor, { updateStatus } = {}) {
  const columns = {
    cursor,
    status: 'active',
    status_changed_at: new Date().toISOString(),
    error_code: null,
    last_synced_at: new Date().toISOString(),
    last_sync_error: null,
  }
  if (updateStatus) columns.transactions_update_status = updateStatus

  const { error } = await supabase
    .from('plaid_items')
    .update(columns)
    .eq('id', id)
    .eq('user_id', userId)

  if (error) {
    console.error('Error updating Plaid item cursor:', error)
    throw new Error('Failed to save sync progress')
  }
}

export async function markItemStatus(userId, id, status, { errorCode, lastSyncError } = {}) {
  const { error } = await supabase
    .from('plaid_items')
    .update({
      status,
      status_changed_at: new Date().toISOString(),
      error_code: errorCode ?? null,
      ...(lastSyncError !== undefined ? { last_sync_error: lastSyncError } : {}),
    })
    .eq('id', id)
    .eq('user_id', userId)

  if (error) {
    console.error('Error updating Plaid item status:', error)
    throw new Error('Failed to update bank connection status')
  }
}

export async function deletePlaidItem(userId, id) {
  const { error } = await supabase
    .from('plaid_items')
    .delete()
    .eq('id', id)
    .eq('user_id', userId)

  if (error) {
    console.error('Error deleting Plaid item:', error)
    throw new Error('Failed to remove bank connection')
  }
}

export async function upsertPlaidAccounts(userId, itemRowId, accounts) {
  if (!accounts || accounts.length === 0) return

  const rows = accounts.map(a => ({
    user_id: userId,
    item_id: itemRowId,
    account_id: a.account_id,
    name: a.name || null,
    official_name: a.official_name || null,
    mask: a.mask || null,
    type: a.type || null,
    subtype: a.subtype || null,
  }))

  const { error } = await supabase
    .from('plaid_accounts')
    .upsert(rows, { onConflict: 'user_id,account_id' })

  if (error) {
    console.error('Error saving Plaid accounts:', error)
    throw new Error('Failed to save account details')
  }
}

// One user's own items, decrypted and ready to sync — for the "sync all my
// connections" path (POST /api/plaid/sync with no itemId). Unlike
// getSyncableItems (the cron's cross-user candidate list, 'active' only),
// this includes 'paused' and 'error' items too: a Pro user manually
// triggering a sync should be able to wake a just-resubscribed paused item
// immediately rather than waiting for the next cron pass (see
// updateItemCursor's status reset). 'removed' is still excluded — its token
// is gone.
export async function getUserItemsForSync(userId) {
  const { data, error } = await supabase
    .from('plaid_items')
    .select('id, item_id, cursor, access_token_enc, status')
    .eq('user_id', userId)
    .neq('status', 'removed')

  if (error) {
    console.error('Error fetching user\'s Plaid items for sync:', error)
    return []
  }
  return data.map(row => ({
    id: row.id,
    itemId: row.item_id,
    cursor: row.cursor,
    status: row.status,
    accessToken: decryptToken(row.access_token_enc),
  }))
}

// Every item a user has ever linked, with tokens decrypted — used only by
// account deletion, which must call /item/remove at Plaid for each one
// before the rows (and the only copy of those tokens) are gone for good.
export async function getAllItemsForUser(userId) {
  const { data, error } = await supabase
    .from('plaid_items')
    .select('id, access_token_enc, status')
    .eq('user_id', userId)
    .neq('status', 'removed')

  if (error) {
    console.error('Error fetching Plaid items for deletion:', error)
    return []
  }
  return data.map(row => ({ id: row.id, accessToken: decryptToken(row.access_token_enc) }))
}
