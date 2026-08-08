import { currentUser } from '@clerk/nextjs/server'
import {
  insertTargetPurchaseItems,
  matchUnmatchedItems,
  getMatchedTransactionIds,
  getItemsForTransaction,
} from '@/lib/targetPurchaseStorage'

// GET /api/target-purchases           — { matchedTransactionIds } for badges
// GET /api/target-purchases?transactionId=xxx — { items } for one transaction
export async function GET(request) {
  try {
    const user = await currentUser()
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const transactionId = searchParams.get('transactionId')

    if (transactionId) {
      const items = await getItemsForTransaction(user.id, transactionId)
      return Response.json({ items })
    }

    const matchedTransactionIds = await getMatchedTransactionIds(user.id)
    return Response.json({ matchedTransactionIds })
  } catch (error) {
    console.error('Error fetching Target purchases:', error)
    return Response.json({ error: 'Failed to load Target purchases' }, { status: 500 })
  }
}

// POST /api/target-purchases — import a batch of parsed CSV rows and
// (re)run matching against the user's existing transactions.
// Body: { items: [{ date, orderRef, itemName, itemPrice, qty, lineTotal, imageUrl, tripTotal, fulfillment }] }
export async function POST(request) {
  try {
    const user = await currentUser()
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

    const { items } = await request.json()
    if (!Array.isArray(items) || items.length === 0) {
      return Response.json({ error: 'No items provided' }, { status: 400 })
    }
    if (items.length > 5000) {
      return Response.json({ error: 'Too many rows in one import' }, { status: 400 })
    }

    const imported = await insertTargetPurchaseItems(user.id, items)
    const matched = await matchUnmatchedItems(user.id)

    return Response.json({ imported, matched })
  } catch (error) {
    console.error('Error importing Target purchases:', error)
    return Response.json({ error: 'Failed to import Target purchases' }, { status: 500 })
  }
}
