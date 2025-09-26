import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

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

export async function updateFileAnalysis(userId, fileId, analysis) {
  const { error } = await supabase
    .from('user_files')
    .update({ analysis })
    .eq('id', fileId)
    .eq('user_id', userId)

  if (error) {
    console.error('Error updating analysis:', error)
    throw new Error('Failed to update analysis')
  }
}