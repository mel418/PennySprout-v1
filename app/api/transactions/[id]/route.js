import { currentUser } from '@clerk/nextjs/server'
import { updateTransactionById } from '@/lib/transactionStorage'

// PATCH /api/transactions/:id — edit one transaction by its stable row id.
// Body: { category?: string, note?: string }. Replaces the old
// /api/files/:fileId/transactions endpoint, which addressed transactions by
// array index into a JSONB blob — fragile the moment anything reordered.
//
//   - category: AI categorization is sometimes wrong, and every chart is
//     built on these categories — users need a way to fix mistakes.
//   - note: a personal annotation ("split with roommate", "reimbursed by
//     work"). An empty string clears the note.
export async function PATCH(request, { params }) {
  try {
    const user = await currentUser()
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const { category, note } = await request.json()

    const patch = {}

    if (category !== undefined) {
      const trimmed = typeof category === 'string' ? category.trim() : ''
      if (!trimmed || trimmed.length > 40) {
        return Response.json({ error: 'Invalid category' }, { status: 400 })
      }
      patch.category = trimmed
    }

    if (note !== undefined) {
      if (typeof note !== 'string' || note.length > 500) {
        return Response.json({ error: 'Invalid note' }, { status: 400 })
      }
      patch.note = note.trim() // empty string clears the note
    }

    if (Object.keys(patch).length === 0) {
      return Response.json({ error: 'Nothing to update' }, { status: 400 })
    }

    await updateTransactionById(user.id, id, patch)
    return Response.json({ success: true })
  } catch (error) {
    console.error('Error updating transaction:', error)
    const status = error.message === 'Transaction not found' ? 404 : 500
    return Response.json({ error: 'Failed to update transaction' }, { status })
  }
}
