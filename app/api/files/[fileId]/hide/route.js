import { currentUser } from '@clerk/nextjs/server'
import { requirePro } from '@/lib/planGate'
import { checkWriteLimit } from '@/lib/rateLimit'
import { hideTransactionsByFile } from '@/lib/transactionStorage'

// POST /api/files/:fileId/hide — hide (or restore) every transaction from
// one uploaded statement at once. Body: { hidden: boolean }. The file-level
// sibling of POST /api/transactions/hide, for when a whole statement is now
// redundant because a Plaid connection covers the same account — see
// lib/transactionStorage.js hideTransactionsByFile for why this is scoped by
// file rather than matching transactions pairwise.
//
// Pro-gated for the same reason /api/transactions/hide is: this only exists
// to resolve duplicates a Plaid connection (Pro-only) creates.
export async function POST(request, { params }) {
  try {
    const user = await currentUser()
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

    const gate = await requirePro(user.id)
    if (gate) return gate

    const blocked = await checkWriteLimit(user.id)
    if (blocked) return blocked

    const { fileId } = await params
    const { hidden } = await request.json()
    if (typeof hidden !== 'boolean') {
      return Response.json({ error: 'hidden must be true or false' }, { status: 400 })
    }

    const count = await hideTransactionsByFile(user.id, fileId, hidden)
    return Response.json({ success: true, count })
  } catch (error) {
    console.error('Error hiding file transactions:', error)
    return Response.json({ error: 'Failed to update transactions' }, { status: 500 })
  }
}
