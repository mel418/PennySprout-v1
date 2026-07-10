// Server-only access to the normalized transactions table (see the
// transactions migration). Replaces reading/writing the JSONB blob on
// user_files: each transaction is its own row with a real date column and a
// stable id, so queries can be scoped and edits don't rewrite whole arrays.
import { supabase } from '@/lib/supabase'
import { parseDate, toKey } from '@/lib/date'

// Map a DB row to the client shape. Legacy key casing ('Trans. Date',
// 'Description', …) is kept deliberately: every component, calc helper, and
// the AI-analysis contract already speak it, and changing the wire shape in
// the same PR as the storage migration would double the review surface.
function toClientShape(row) {
  return {
    id: row.id,
    fileId: row.file_id,
    'Date': row.date,                          // 'YYYY-MM-DD' — parseDate handles it
    'Description': row.description,
    'Amount': row.amount,
    'Category': row.category || '',
    ...(row.note ? { 'Note': row.note } : {}),
  }
}

// All of a user's transactions, optionally filtered. Supports:
//   { fileId }   — one file's transactions (review modal)
//   { from, to } — inclusive 'YYYY-MM-DD' date range (month scoping)
export async function getTransactions(userId, { fileId, from, to } = {}) {
  let query = supabase
    .from('transactions')
    .select('id, file_id, date, description, amount, category, note')
    .eq('user_id', userId)

  if (fileId) query = query.eq('file_id', fileId)
  if (from) query = query.gte('date', from)
  if (to) query = query.lte('date', to)

  const { data, error } = await query.order('date', { ascending: false })

  if (error) {
    console.error('Error fetching transactions:', error)
    throw new Error('Failed to fetch transactions')
  }
  return data.map(toClientShape)
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
