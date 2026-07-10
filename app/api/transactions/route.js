import { currentUser } from '@clerk/nextjs/server'
import { getTransactions } from '@/lib/transactionStorage'

// GET /api/transactions — the user's transactions from the normalized table.
// Optional query params:
//   ?fileId=<uuid>              one file's transactions (review modal)
//   ?from=YYYY-MM-DD&to=YYYY-MM-DD   inclusive date range (month scoping)
// With no params it returns full history — the calendar's year view and the
// overview's trend charts genuinely need it. Rows are lean (6 columns), so
// this is still far lighter than the old every-JSONB-blob /api/files payload.
export async function GET(request) {
  try {
    const user = await currentUser()
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const fileId = searchParams.get('fileId') || undefined
    const from = searchParams.get('from') || undefined
    const to = searchParams.get('to') || undefined

    const transactions = await getTransactions(user.id, { fileId, from, to })
    return Response.json({ transactions })
  } catch (error) {
    console.error('Error fetching transactions:', error)
    return Response.json({ error: 'Failed to fetch transactions' }, { status: 500 })
  }
}
