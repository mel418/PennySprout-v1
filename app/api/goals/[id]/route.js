import { currentUser } from '@clerk/nextjs/server'
import { updateGoalById, deleteGoalById } from '@/lib/budgetStorage'

// PATCH /api/goals/:id — edit one goal.
// Body: { name?, targetAmount?, savedAmount?, targetDate? } — targetDate may be
// null to clear the deadline.
export async function PATCH(request, { params }) {
  try {
    const user = await currentUser()
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const { name, targetAmount, savedAmount, targetDate } = await request.json()

    const patch = {}

    if (name !== undefined) {
      const trimmed = typeof name === 'string' ? name.trim() : ''
      if (!trimmed || trimmed.length > 80) {
        return Response.json({ error: 'Invalid name' }, { status: 400 })
      }
      patch.name = trimmed
    }

    if (targetAmount !== undefined) {
      const target = parseFloat(targetAmount)
      if (!Number.isFinite(target) || target <= 0 || target > 100_000_000) {
        return Response.json({ error: 'Invalid target amount' }, { status: 400 })
      }
      patch.targetAmount = target
    }

    if (savedAmount !== undefined) {
      const saved = parseFloat(savedAmount)
      if (!Number.isFinite(saved) || saved < 0) {
        return Response.json({ error: 'Invalid saved amount' }, { status: 400 })
      }
      patch.savedAmount = saved
    }

    if (targetDate !== undefined) {
      if (targetDate !== null && !/^\d{4}-\d{2}-\d{2}$/.test(String(targetDate))) {
        return Response.json({ error: 'Invalid target date' }, { status: 400 })
      }
      patch.targetDate = targetDate
    }

    if (Object.keys(patch).length === 0) {
      return Response.json({ error: 'Nothing to update' }, { status: 400 })
    }

    await updateGoalById(user.id, id, patch)
    return Response.json({ success: true })
  } catch (error) {
    console.error('Error updating goal:', error)
    const status = error.message === 'Goal not found' ? 404 : 500
    return Response.json({ error: 'Failed to update goal' }, { status })
  }
}

// DELETE /api/goals/:id — remove one goal.
export async function DELETE(request, { params }) {
  try {
    const user = await currentUser()
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    await deleteGoalById(user.id, id)
    return Response.json({ success: true })
  } catch (error) {
    console.error('Error deleting goal:', error)
    const status = error.message === 'Goal not found' ? 404 : 500
    return Response.json({ error: 'Failed to delete goal' }, { status })
  }
}
