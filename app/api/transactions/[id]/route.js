import { currentUser } from '@clerk/nextjs/server'
import { updateTransactionById, deleteTransactionById } from '@/lib/transactionStorage'
import { checkWriteLimit } from '@/lib/rateLimit'

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

    const blocked = await checkWriteLimit(user.id)
    if (blocked) return blocked

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

// DELETE /api/transactions/:id — remove one transaction. Used to clean up
// a duplicate that was already imported before the upload-time duplicate
// check existed (or any other single row the user wants gone) without
// deleting its whole source file.
export async function DELETE(request, { params }) {
  try {
    const user = await currentUser()
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

    const blocked = await checkWriteLimit(user.id)
    if (blocked) return blocked

    const { id } = await params
    await deleteTransactionById(user.id, id)
    return Response.json({ success: true })
  } catch (error) {
    console.error('Error deleting transaction:', error)
    const status = error.message === 'Transaction not found' ? 404 : 500
    return Response.json({ error: 'Failed to delete transaction' }, { status })
  }
}
