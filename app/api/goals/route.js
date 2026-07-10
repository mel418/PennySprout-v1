import { currentUser } from '@clerk/nextjs/server'
import { getGoals, createGoal } from '@/lib/budgetStorage'

// GET /api/goals — all of the user's savings goals.
export async function GET() {
  try {
    const user = await currentUser()
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

    const goals = await getGoals(user.id)
    return Response.json({ goals })
  } catch (error) {
    console.error('Error fetching goals:', error)
    return Response.json({ error: 'Failed to fetch goals' }, { status: 500 })
  }
}

// POST /api/goals — create a savings goal.
// Body: { name: string, targetAmount: number, savedAmount?: number, targetDate?: 'YYYY-MM-DD' }
export async function POST(request) {
  try {
    const user = await currentUser()
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

    const { name, targetAmount, savedAmount, targetDate } = await request.json()

    const trimmedName = typeof name === 'string' ? name.trim() : ''
    if (!trimmedName || trimmedName.length > 80) {
      return Response.json({ error: 'Invalid name' }, { status: 400 })
    }

    const target = parseFloat(targetAmount)
    if (!Number.isFinite(target) || target <= 0 || target > 100_000_000) {
      return Response.json({ error: 'Invalid target amount' }, { status: 400 })
    }

    const saved = savedAmount === undefined ? 0 : parseFloat(savedAmount)
    if (!Number.isFinite(saved) || saved < 0) {
      return Response.json({ error: 'Invalid saved amount' }, { status: 400 })
    }

    let date = null
    if (targetDate) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(String(targetDate))) {
        return Response.json({ error: 'Invalid target date' }, { status: 400 })
      }
      date = targetDate
    }

    const goal = await createGoal(user.id, {
      name: trimmedName,
      targetAmount: target,
      savedAmount: saved,
      targetDate: date,
    })
    return Response.json({ goal })
  } catch (error) {
    console.error('Error creating goal:', error)
    return Response.json({ error: 'Failed to create goal' }, { status: 500 })
  }
}
