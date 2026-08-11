import { currentUser } from '@clerk/nextjs/server'
import { requirePro } from '@/lib/planGate'
import { getHiddenTransactions } from '@/lib/transactionStorage'

// GET /api/transactions/hidden — lists transactions currently hidden as
// duplicate imports, for the "Hidden imports" management panel where a hide
// can be reviewed and undone (POST /api/transactions/hide with
// hidden: false).
export async function GET() {
  try {
    const user = await currentUser()
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

    const gate = await requirePro(user.id)
    if (gate) return gate

    const transactions = await getHiddenTransactions(user.id)
    return Response.json({ transactions })
  } catch (error) {
    console.error('Error fetching hidden transactions:', error)
    return Response.json({ error: 'Failed to fetch hidden transactions' }, { status: 500 })
  }
}
