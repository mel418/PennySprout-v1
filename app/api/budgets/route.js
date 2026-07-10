import { currentUser } from '@clerk/nextjs/server'
import { getBudgets, upsertBudget, deleteBudget } from '@/lib/budgetStorage'

// Budget categories can be anything present in the user's data, but Income and
// Bills & Payments are excluded from the spending total everywhere else, so a
// budget on them would never show progress — reject early instead.
const UNBUDGETABLE = new Set(['income', 'bills & payments'])

// GET /api/budgets — all of the user's category budgets.
export async function GET() {
  try {
    const user = await currentUser()
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

    const budgets = await getBudgets(user.id)
    return Response.json({ budgets })
  } catch (error) {
    console.error('Error fetching budgets:', error)
    return Response.json({ error: 'Failed to fetch budgets' }, { status: 500 })
  }
}

// PUT /api/budgets — create or replace one category's monthly limit.
// Body: { category: string, monthlyLimit: number }
export async function PUT(request) {
  try {
    const user = await currentUser()
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

    const { category, monthlyLimit } = await request.json()

    const trimmed = typeof category === 'string' ? category.trim() : ''
    if (!trimmed || trimmed.length > 40 || UNBUDGETABLE.has(trimmed.toLowerCase())) {
      return Response.json({ error: 'Invalid category' }, { status: 400 })
    }

    const limit = parseFloat(monthlyLimit)
    if (!Number.isFinite(limit) || limit <= 0 || limit > 1_000_000) {
      return Response.json({ error: 'Invalid limit' }, { status: 400 })
    }

    await upsertBudget(user.id, trimmed, limit)
    return Response.json({ success: true })
  } catch (error) {
    console.error('Error saving budget:', error)
    return Response.json({ error: 'Failed to save budget' }, { status: 500 })
  }
}

// DELETE /api/budgets?category=Food — remove one category's budget.
export async function DELETE(request) {
  try {
    const user = await currentUser()
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const category = (searchParams.get('category') || '').trim()
    if (!category) return Response.json({ error: 'Invalid category' }, { status: 400 })

    await deleteBudget(user.id, category)
    return Response.json({ success: true })
  } catch (error) {
    console.error('Error deleting budget:', error)
    return Response.json({ error: 'Failed to delete budget' }, { status: 500 })
  }
}
