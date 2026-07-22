// Use the shared server-only client (service-role key). This module is imported
// exclusively from API route handlers, never from a client component, so the
// service-role key is never shipped to the browser. The public anon key is no
// longer used for data access — combined with RLS being enabled on the table
// (see the user_files migration), this closes the "public key can read every
// user's rows" hole.
import { supabase } from '@/lib/supabase'

// File METADATA only — transactions live in their own table now (see
// lib/transactionStorage.js). Selecting the old JSONB blob here would ship
// every transaction ever uploaded on every /api/files call, which is exactly
// what the normalization removed.
export async function getUserFiles(userId) {
  const { data, error } = await supabase
    .from('user_files')
    .select('id, file_name, original_file_name, created_at, total_amount, transaction_count, account_name')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching files:', error)
    return []
  }

  return data.map(file => ({
    id: file.id,
    name: file.file_name,
    originalName: file.original_file_name || file.file_name,
    uploadDate: file.created_at,
    totalAmount: file.total_amount,
    transactionCount: file.transaction_count,
    accountName: file.account_name || ''
  }))
}

// Looks up an existing file by content hash, scoped to the user, so the
// upload route can warn before creating a duplicate. Returns just enough to
// show a "you already uploaded this" message — not the full row.
export async function findFileByHash(userId, contentHash) {
  if (!contentHash) return null

  const { data, error } = await supabase
    .from('user_files')
    .select('id, file_name, created_at')
    .eq('user_id', userId)
    .eq('content_hash', contentHash)
    .limit(1)
    .maybeSingle()

  if (error) {
    console.error('Error checking for duplicate file:', error)
    return null
  }

  return data ? { id: data.id, name: data.file_name, uploadDate: data.created_at } : null
}

// Creates the file metadata row. Transactions are inserted separately into
// their own table by the route (lib/transactionStorage.js insertTransactions).
// The legacy JSONB column is still NOT NULL until it's dropped (see the
// transactions migration's cleanup note), so new rows get an empty array.
export async function saveUserFile(userId, fileData) {
  const { data, error } = await supabase
    .from('user_files')
    .insert({
      user_id: userId,
      file_name: fileData.name,
      original_file_name: fileData.name,
      transactions: [],
      analysis: fileData.analysis || null,
      total_amount: fileData.totalAmount,
      transaction_count: fileData.transactionCount,
      content_hash: fileData.contentHash || null,
      account_name: fileData.accountName || null
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
    originalName: data.original_file_name || data.file_name,
    uploadDate: data.created_at,
    totalAmount: data.total_amount,
    transactionCount: data.transaction_count,
    accountName: data.account_name || ''
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