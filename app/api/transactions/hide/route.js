import { currentUser } from '@clerk/nextjs/server'
import { requirePro } from '@/lib/planGate'
import { checkWriteLimit } from '@/lib/rateLimit'
import { setTransactionsHidden } from '@/lib/transactionStorage'

const MAX_IDS = 1000

// POST /api/transactions/hide — bulk hide or restore transactions. Body:
// { ids: string[], hidden: boolean }. Hiding is the confirmed step of the
// "review possible duplicate imports" flow (see
// GET /api/plaid/items/[id]/duplicates) — never automatic, always something
// the user reviewed a candidate list and chose. Reversible: passing
// hidden: false on the same ids restores them everywhere.
//
// Pro-gated because the whole hide/restore mechanism only exists to resolve
// duplicates a Plaid connection creates against manually uploaded data, and
// Plaid connections are themselves Pro-only.
export async function POST(request) {
  try {
    const user = await currentUser()
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

    const gate = await requirePro(user.id)
    if (gate) return gate

    const blocked = await checkWriteLimit(user.id)
    if (blocked) return blocked

    const { ids, hidden } = await request.json()
    if (!Array.isArray(ids) || ids.length === 0) {
      return Response.json({ error: 'No transaction ids provided' }, { status: 400 })
    }
    if (ids.length > MAX_IDS) {
      return Response.json({ error: `Too many transactions at once (max ${MAX_IDS})` }, { status: 400 })
    }
    if (typeof hidden !== 'boolean') {
      return Response.json({ error: 'hidden must be true or false' }, { status: 400 })
    }

    await setTransactionsHidden(user.id, ids, hidden, hidden ? 'duplicate_of_plaid' : null)
    return Response.json({ success: true, count: ids.length })
  } catch (error) {
    console.error('Error hiding/restoring transactions:', error)
    return Response.json({ error: 'Failed to update transactions' }, { status: 500 })
  }
}
