import { currentUser } from '@clerk/nextjs/server'
import { updateTransaction } from '@/lib/fileStorage'

// PATCH /api/files/:fileId/transactions — edit one transaction.
// Body: { index: number, category?: string, note?: string }. `index` is the
// position in the file's stored transactions array.
//
// Two kinds of edits, both from the review modal:
//   - category: AI categorization is sometimes wrong, and every chart is
//     built on these categories — users need a way to fix mistakes.
//   - note: a personal annotation ("split with roommate", "reimbursed by
//     work"). An empty string clears the note.
export async function PATCH(request, { params }) {
  try {
    const user = await currentUser()
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

    const { fileId } = await params
    const { index, category, note } = await request.json()

    if (!Number.isInteger(index) || index < 0) {
      return Response.json({ error: 'Invalid transaction index' }, { status: 400 })
    }

    const patch = {}

    if (category !== undefined) {
      const trimmed = typeof category === 'string' ? category.trim() : ''
      if (!trimmed || trimmed.length > 40) {
        return Response.json({ error: 'Invalid category' }, { status: 400 })
      }
      patch.Category = trimmed
    }

    if (note !== undefined) {
      if (typeof note !== 'string' || note.length > 500) {
        return Response.json({ error: 'Invalid note' }, { status: 400 })
      }
      patch.Note = note.trim() // empty string clears the note
    }

    if (Object.keys(patch).length === 0) {
      return Response.json({ error: 'Nothing to update' }, { status: 400 })
    }

    await updateTransaction(user.id, fileId, index, patch)
    return Response.json({ success: true })
  } catch (error) {
    console.error('Error updating transaction:', error)
    return Response.json({ error: 'Failed to update transaction' }, { status: 500 })
  }
}
