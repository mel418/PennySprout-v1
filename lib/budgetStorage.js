// Server-only access to the budgets and goals tables (see the budgets_goals
// migration). Budgets are one row per user+category with a
// monthly limit; progress against the limit is computed in the app from the
// transactions table. Goals track a savings target with a manually updated
// saved amount (no bank connection by design).
import { supabase } from '@/lib/supabase'

// ── Budgets ──────────────────────────────────────────────────────────────────

export async function getBudgets(userId) {
  const { data, error } = await supabase
    .from('budgets')
    .select('id, category, monthly_limit')
    .eq('user_id', userId)
    .order('category')

  if (error) {
    console.error('Error fetching budgets:', error)
    throw new Error('Failed to fetch budgets')
  }
  return data.map(row => ({
    id: row.id,
    category: row.category,
    monthlyLimit: parseFloat(row.monthly_limit),
  }))
}

// Create-or-replace the budget for one category (UNIQUE user_id+category).
export async function upsertBudget(userId, category, monthlyLimit) {
  const { error } = await supabase
    .from('budgets')
    .upsert(
      { user_id: userId, category, monthly_limit: monthlyLimit, updated_at: new Date().toISOString() },
      { onConflict: 'user_id,category' }
    )

  if (error) {
    console.error('Error saving budget:', error)
    throw new Error('Failed to save budget')
  }
}

export async function deleteBudget(userId, category) {
  const { error } = await supabase
    .from('budgets')
    .delete()
    .eq('user_id', userId)
    .eq('category', category)

  if (error) {
    console.error('Error deleting budget:', error)
    throw new Error('Failed to delete budget')
  }
}

// ── Goals ────────────────────────────────────────────────────────────────────

function goalToClientShape(row) {
  return {
    id: row.id,
    name: row.name,
    targetAmount: parseFloat(row.target_amount),
    savedAmount: parseFloat(row.saved_amount),
    targetDate: row.target_date, // 'YYYY-MM-DD' or null
  }
}

export async function getGoals(userId) {
  const { data, error } = await supabase
    .from('goals')
    .select('id, name, target_amount, saved_amount, target_date')
    .eq('user_id', userId)
    .order('created_at')

  if (error) {
    console.error('Error fetching goals:', error)
    throw new Error('Failed to fetch goals')
  }
  return data.map(goalToClientShape)
}

export async function createGoal(userId, { name, targetAmount, savedAmount = 0, targetDate = null }) {
  const { data, error } = await supabase
    .from('goals')
    .insert({
      user_id: userId,
      name,
      target_amount: targetAmount,
      saved_amount: savedAmount,
      target_date: targetDate,
    })
    .select('id, name, target_amount, saved_amount, target_date')
    .single()

  if (error) {
    console.error('Error creating goal:', error)
    throw new Error('Failed to create goal')
  }
  return goalToClientShape(data)
}

// Edit one goal by id. `patch` uses client names: { name?, targetAmount?,
// savedAmount?, targetDate? }.
export async function updateGoalById(userId, goalId, patch) {
  const columns = { updated_at: new Date().toISOString() }
  if (patch.name !== undefined) columns.name = patch.name
  if (patch.targetAmount !== undefined) columns.target_amount = patch.targetAmount
  if (patch.savedAmount !== undefined) columns.saved_amount = patch.savedAmount
  if (patch.targetDate !== undefined) columns.target_date = patch.targetDate

  const { data, error } = await supabase
    .from('goals')
    .update(columns)
    .eq('id', goalId)
    .eq('user_id', userId)
    .select('id')

  if (error) {
    console.error('Error updating goal:', error)
    throw new Error('Failed to update goal')
  }
  if (!data || data.length === 0) {
    throw new Error('Goal not found')
  }
}

export async function deleteGoalById(userId, goalId) {
  const { data, error } = await supabase
    .from('goals')
    .delete()
    .eq('id', goalId)
    .eq('user_id', userId)
    .select('id')

  if (error) {
    console.error('Error deleting goal:', error)
    throw new Error('Failed to delete goal')
  }
  if (!data || data.length === 0) {
    throw new Error('Goal not found')
  }
}
