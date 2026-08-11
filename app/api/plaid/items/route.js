import { currentUser } from '@clerk/nextjs/server'
import { plaidEnabled } from '@/lib/plaid'
import { getPlan } from '@/lib/subscriptionStorage'
import { getPlaidItems } from '@/lib/plaidItemStorage'
import { getEarliestSyncedDate } from '@/lib/transactionStorage'

// GET /api/plaid/items — the signed-in user's bank connections, with
// accounts nested. Deliberately NOT Pro-gated (unlike link-token/exchange/
// sync): a free user whose Pro lapsed still needs to see their paused
// connections and the "resubscribe to resume" banner, not a blank section.
export async function GET() {
  try {
    const user = await currentUser()
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

    if (!plaidEnabled) {
      return Response.json({ enabled: false, plan: 'free', items: [] })
    }

    const [plan, items] = await Promise.all([
      getPlan(user.id),
      getPlaidItems(user.id),
    ])

    // "How far back" each connection's synced history goes, next to "Last
    // synced" in the UI — one query per item (never more than a handful per
    // user), not fetched inside getPlaidItems since most callers of that
    // function (sync, disconnect) don't need it.
    const withDates = await Promise.all(
      items.map(async item => ({
        ...item,
        earliestTransactionDate: await getEarliestSyncedDate(user.id, item.id),
      }))
    )

    return Response.json({ enabled: true, plan, items: withDates })
  } catch (error) {
    console.error('Error fetching Plaid items:', error)
    return Response.json({ error: 'Failed to fetch bank connections' }, { status: 500 })
  }
}
