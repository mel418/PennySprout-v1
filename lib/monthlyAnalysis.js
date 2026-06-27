// Per-calendar-month AI analysis storage. Mirrors lib/fileStorage.js but keys
// results by (user_id, month_key) instead of by file — analysis is now about a
// real calendar month pooled across all files, not about an individual upload.
import { supabase } from '@/lib/supabase'

export async function getMonthlyAnalysis(userId, monthKey) {
  const { data, error } = await supabase
    .from('monthly_analysis')
    .select('*')
    .eq('user_id', userId)
    .eq('month_key', monthKey)
    .maybeSingle()

  if (error) {
    console.error('Error fetching monthly analysis:', error)
    return null
  }

  if (!data) return null

  return {
    monthKey: data.month_key,
    analysis: data.analysis,
    updatedAt: data.updated_at
  }
}

export async function saveMonthlyAnalysis(userId, monthKey, analysis) {
  const { data, error } = await supabase
    .from('monthly_analysis')
    .upsert(
      { user_id: userId, month_key: monthKey, analysis, updated_at: new Date().toISOString() },
      { onConflict: 'user_id,month_key' }
    )
    .select()
    .single()

  if (error) {
    console.error('Error saving monthly analysis:', error)
    throw new Error('Failed to save monthly analysis')
  }

  return {
    monthKey: data.month_key,
    analysis: data.analysis,
    updatedAt: data.updated_at
  }
}
