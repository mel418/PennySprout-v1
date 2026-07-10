// Use the shared server-only client (service-role key). This module is imported
// exclusively from API route handlers, never from a client component, so the
// service-role key is never shipped to the browser. The public anon key is no
// longer used for data access — combined with RLS being enabled on the table
// (see supabase/enable-rls.sql), this closes the "public key can read every
// user's rows" hole.
import { supabase } from '@/lib/supabase'

export async function getUserFiles(userId) {
  const { data, error } = await supabase
    .from('user_files')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching files:', error)
    return []
  }

  return data.map(file => ({
    id: file.id,
    name: file.file_name,
    uploadDate: file.created_at,
    transactions: file.transactions,
    analysis: file.analysis,
    totalAmount: file.total_amount,
    transactionCount: file.transaction_count
  }))
}

export async function saveUserFile(userId, fileData) {
  const { data, error } = await supabase
    .from('user_files')
    .insert({
      user_id: userId,
      file_name: fileData.name,
      transactions: fileData.transactions,
      analysis: fileData.analysis || null,
      total_amount: fileData.totalAmount,
      transaction_count: fileData.transactionCount
    })
    .select()
    .single()

  if (error) {
    console.error('Error saving file:', error)
    throw new Error('Failed to save file')
  }

  return {
    id: data.id,
    name: data.file_name,
    uploadDate: data.created_at,
    transactions: data.transactions,
    analysis: data.analysis,
    totalAmount: data.total_amount,
    transactionCount: data.transaction_count
  }
}

export async function deleteUserFile(userId, fileId) {
  const { error } = await supabase
    .from('user_files')
    .delete()
    .eq('id', fileId)
    .eq('user_id', userId)

  if (error) {
    console.error('Error deleting file:', error)
    throw new Error('Failed to delete file')
  }
}

// Update one transaction inside a file's JSONB array. `index` is the position
// in the STORED array (transactions have no ids of their own), so callers must
// pass the original index, not a position in a sorted view. `patch` holds the
// fields to merge (e.g. { Category: 'Food' } or { Note: 'split with roommate' })
// — the route validates them. An empty-string Note removes the key entirely so
// cleared notes don't linger in storage.
export async function updateTransaction(userId, fileId, index, patch) {
  const { data, error } = await supabase
    .from('user_files')
    .select('transactions')
    .eq('id', fileId)
    .eq('user_id', userId)
    .single()

  if (error || !data) {
    console.error('Error loading file for transaction update:', error)
    throw new Error('File not found')
  }

  const txns = data.transactions
  if (!Array.isArray(txns) || !Number.isInteger(index) || index < 0 || index >= txns.length) {
    throw new Error('Invalid transaction index')
  }

  txns[index] = { ...txns[index], ...patch }
  if ('Note' in patch && !patch.Note) delete txns[index].Note

  const { error: updateError } = await supabase
    .from('user_files')
    .update({ transactions: txns })
    .eq('id', fileId)
    .eq('user_id', userId)

  if (updateError) {
    console.error('Error updating transaction:', updateError)
    throw new Error('Failed to update transaction')
  }
}

export async function renameUserFile(userId, fileId, name) {
  const { error } = await supabase
    .from('user_files')
    .update({ file_name: name })
    .eq('id', fileId)
    .eq('user_id', userId)

  if (error) {
    console.error('Error renaming file:', error)
    throw new Error('Failed to rename file')
  }
}