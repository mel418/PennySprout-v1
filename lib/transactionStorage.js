// Server-only access to the normalized transactions table (see the
// transactions migration). Replaces reading/writing the JSONB blob on
// user_files: each transaction is its own row with a real date column and a
// stable id, so queries can be scoped and edits don't rewrite whole arrays.
import { supabase } from '@/lib/supabase'
import { parseDate, toKey } from '@/lib/date'
import { transactionKey, transactionKeyParts } from '@/lib/transactionKey'
import { matchDuplicateCandidates } from '@/lib/duplicateMatching'

// Map a DB row to the client shape. Legacy key casing ('Trans. Date',
// 'Description', …) is kept deliberately: every component, calc helper, and
// the AI-analysis contract already speak it, and changing the wire shape in
// the same PR as the storage migration would double the review surface.
//
// accountName is only ever set for Plaid-sourced rows (uploaded rows are
// labeled via file_id -> user_files.account_name instead, resolved
// client-side in AllTransactions.js) — see getTransactions below.
function toClientShape(row, accountName) {
  return {
    id: row.id,
    fileId: row.file_id,
    'Date': row.date,                          // 'YYYY-MM-DD' — parseDate handles it
    'Description': row.description,
    'Amount': row.amount,
    'Category': row.category || '',
    ...(row.note ? { 'Note': row.note } : {}),
    ...(accountName ? { accountName } : {}),
  }
}

// PostgREST (Supabase's query layer) caps an unbounded select at a default
// max-rows setting (1000 on this project) — a query with no .range() doesn't
// error when there's more data than that, it just silently returns the
// first page. Sorted newest-first, that meant anyone with more than 1000
// transactions had their OLDEST ones quietly vanish from every view in the
// app (Overview, Calendar, Budgets, Analysis, Files) — not a display bug,
// the data was always safe in the DB, just never fetched.
const PAGE_SIZE = 1000

// All of a user's transactions, optionally filtered. Supports:
//   { fileId }   — one file's transactions (review modal)
//   { from, to } — inclusive 'YYYY-MM-DD' date range (month scoping)
// Always excludes hidden transactions (see the transactions_hidden
// migration) — a hidden row is a confirmed duplicate of a Plaid-synced
// transaction, kept in the table but never shown in a total, list, chart, or
// AI chat context. See getHiddenTransactions below for the one place that
// deliberately reads them.
export async function getTransactions(userId, { fileId, from, to } = {}) {
  const rows = []
  for (let page = 0; ; page++) {
    let query = supabase
      .from('transactions')
      .select('id, file_id, date, description, amount, category, note, plaid_account_id')
      .eq('user_id', userId)
      .eq('hidden', false)

    if (fileId) query = query.eq('file_id', fileId)
    if (from) query = query.gte('date', from)
    if (to) query = query.lte('date', to)

    const { data, error } = await query
      .order('date', { ascending: false })
      .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1)

    if (error) {
      console.error('Error fetching transactions:', error)
      throw new Error('Failed to fetch transactions')
    }
    rows.push(...data)
    if (data.length < PAGE_SIZE) break
  }

  // Plaid-sourced rows carry an account_id but no file — resolve their
  // account label (for AllTransactions.js's account pill/filter) with one
  // extra query, only when at least one row actually needs it.
  const plaidAccountIds = [...new Set(rows.map(r => r.plaid_account_id).filter(Boolean))]
  let accountNameById = {}
  if (plaidAccountIds.length > 0) {
    const { data: accounts, error: acctError } = await supabase
      .from('plaid_accounts')
      .select('account_id, name, mask')
      .eq('user_id', userId)
      .in('account_id', plaidAccountIds)

    if (acctError) {
      console.error('Error fetching Plaid account labels:', acctError)
    } else {
      accountNameById = Object.fromEntries(
        accounts.map(a => [a.account_id, a.mask ? `${a.name} •••• ${a.mask}` : a.name])
      )
    }
  }

  return rows.map(row => toClientShape(row, accountNameById[row.plaid_account_id]))
}

// Bulk-insert a newly uploaded file's transactions. Dates arrive as the
// bank-format strings ('MM/DD/YY' etc.) — this is the single place they get
// parsed into real dates. Unparseable dates become null rather than dropping
// the row, so money totals stay right even if a date is mangled.
export async function insertTransactions(userId, fileId, transactions) {
  const rows = transactions.map(t => {
    const d = parseDate(t)
    return {
      user_id: userId,
      file_id: fileId,
      date: d ? toKey(d) : null,
      description: t['Description'] || '',
      amount: parseFloat(t['Amount']) || 0,
      category: t['Category'] || null,
      note: t['Note'] || null,
    }
  })

  const { error } = await supabase.from('transactions').insert(rows)
  if (error) {
    console.error('Error inserting transactions:', error)
    throw new Error('Failed to save transactions')
  }
}

// Edit one transaction by id (category correction or note). `patch` uses
// column names: { category?, note? }. Empty note clears (stored as null).
export async function updateTransactionById(userId, transactionId, patch) {
  const columns = {}
  if (patch.category !== undefined) columns.category = patch.category
  if (patch.note !== undefined) columns.note = patch.note || null

  const { data, error } = await supabase
    .from('transactions')
    .update(columns)
    .eq('id', transactionId)
    .eq('user_id', userId)
    .select('id')

  if (error) {
    console.error('Error updating transaction:', error)
    throw new Error('Failed to update transaction')
  }
  if (!data || data.length === 0) {
    throw new Error('Transaction not found')
  }
}

// Delete one transaction by id — e.g. cleaning up a duplicate that was
// already imported before the upload-time duplicate check existed.
export async function deleteTransactionById(userId, transactionId) {
  const { data, error } = await supabase
    .from('transactions')
    .delete()
    .eq('id', transactionId)
    .eq('user_id', userId)
    .select('id')

  if (error) {
    console.error('Error deleting transaction:', error)
    throw new Error('Failed to delete transaction')
  }
  if (!data || data.length === 0) {
    throw new Error('Transaction not found')
  }
}

// Returns the subset of `transactions` that already match an existing
// transaction for this user (regardless of which file it came from). Scoped
// to the incoming rows' dates so this stays cheap even for a user with years
// of history — a batch of transactions can only overlap existing rows on
// the same handful of dates.
export async function findDuplicateTransactions(userId, transactions) {
  const dated = transactions
    .map(t => ({ t, d: parseDate(t) }))
    .filter(x => x.d)
  if (dated.length === 0) return []

  const dateKeys = [...new Set(dated.map(x => toKey(x.d)))]

  const { data, error } = await supabase
    .from('transactions')
    .select('date, description, amount')
    .eq('user_id', userId)
    .in('date', dateKeys)

  if (error) {
    // Fail open — a lookup hiccup shouldn't block an upload the user is
    // actively trying to complete; worst case, this specific check is
    // skipped for this attempt.
    console.error('Error checking for duplicate transactions:', error)
    return []
  }

  const existingKeys = new Set(data.map(r => transactionKeyParts(r.date, r.description, r.amount)))

  return dated
    .filter(({ t }) => existingKeys.has(transactionKey(t)))
    .map(({ t }) => t)
}

// The one place hidden rows are deliberately read — the "Hidden imports"
// management panel, so a hide can be reviewed and undone. Lean shape (no
// legacy key casing, no account resolution) since this isn't feeding any of
// the calc/chart helpers that expect the client shape.
export async function getHiddenTransactions(userId) {
  const { data, error } = await supabase
    .from('transactions')
    .select('id, date, description, amount, category, source, hidden_reason, hidden_at')
    .eq('user_id', userId)
    .eq('hidden', true)
    .order('hidden_at', { ascending: false })

  if (error) {
    console.error('Error fetching hidden transactions:', error)
    throw new Error('Failed to fetch hidden transactions')
  }
  return data
}

// Toggle the hidden flag on a batch of transactions the caller already owns
// (every id must belong to userId — enforced by the .eq/.in combination
// below, not just trusted from the caller). Un-hiding (hidden: false) clears
// hidden_reason/hidden_at rather than leaving stale metadata behind.
export async function setTransactionsHidden(userId, ids, hidden, reason = null) {
  if (!ids || ids.length === 0) return
  const columns = hidden
    ? { hidden: true, hidden_reason: reason, hidden_at: new Date().toISOString() }
    : { hidden: false, hidden_reason: null, hidden_at: null }

  const { error } = await supabase
    .from('transactions')
    .update(columns)
    .eq('user_id', userId)
    .in('id', ids)

  if (error) {
    console.error('Error updating hidden transactions:', error)
    throw new Error('Failed to update transactions')
  }
}

// Finds uploaded transactions that look like duplicates of a batch of
// freshly-synced Plaid transactions — same real-world event recorded twice,
// once from a manually uploaded statement and once from the bank
// connection. Matched on (date, amount) only, the same identity pair
// findDuplicateTransactions uses, deliberately not description (upload and
// Plaid descriptions for the same transaction are often worded completely
// differently — "Target" vs "Deposit ACH TARGET DEBIT CRD Location -
// TARGET 0289...").
//
// This does NOT hide anything itself and does not try to guess which
// uploaded file belongs to which real-world account — it returns candidate
// PAIRS for the caller to show the user side-by-side (Plaid description vs.
// upload description) and confirm before calling setTransactionsHidden.
// That review step matters: an unscoped date+amount match across a user's
// ENTIRE upload history can just as easily pair an unrelated credit-card
// charge with a checking-account Plaid transaction that happens to share a
// date and amount — a real false positive hit during this feature's
// development, on real data.
export async function findDuplicateCandidates(userId, plaidRows) {
  const dated = (plaidRows || []).filter(r => r.date)
  if (dated.length === 0) return []

  const dateKeys = [...new Set(dated.map(r => r.date))]

  const { data, error } = await supabase
    .from('transactions')
    .select('id, date, description, amount')
    .eq('user_id', userId)
    .eq('source', 'upload')
    .eq('hidden', false)
    .in('date', dateKeys)

  if (error) {
    console.error('Error finding duplicate candidates:', error)
    return []
  }

  return matchDuplicateCandidates(dated, data)
}

// On-demand version of the above for a connection's ENTIRE synced history,
// not just what one incremental sync just added — needed the first time a
// user runs a scan against a connection that already finished its initial
// (potentially 730-day) backfill before this feature existed. Pulls the
// item's already-stored transactions straight from our own table (they're
// already in app shape — date/amount/description/plaid_transaction_id line
// up with what findDuplicateCandidates expects) rather than re-fetching from
// Plaid, since nothing here needs data Plaid has that we don't already have.
export async function findDuplicateCandidatesForItem(userId, plaidItemRowId) {
  const rows = []
  for (let page = 0; ; page++) {
    const { data, error } = await supabase
      .from('transactions')
      .select('plaid_transaction_id, date, amount, description')
      .eq('user_id', userId)
      .eq('plaid_item_id', plaidItemRowId)
      .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1)

    if (error) {
      console.error('Error loading item transactions for duplicate scan:', error)
      return []
    }
    rows.push(...data)
    if (data.length < PAGE_SIZE) break
  }
  return findDuplicateCandidates(userId, rows)
}
