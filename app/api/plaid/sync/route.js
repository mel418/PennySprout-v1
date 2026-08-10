import { currentUser } from '@clerk/nextjs/server'
import { plaidEnabled } from '@/lib/plaid'
import { requirePro } from '@/lib/planGate'
import { checkRateLimit, checkWriteLimit } from '@/lib/rateLimit'
import { getPlan } from '@/lib/subscriptionStorage'
import { getPlaidItemWithToken } from '@/lib/plaidItemStorage'
import { syncItem, syncAllItemsForUser } from '@/lib/plaidSyncEngine'

// POST /api/plaid/sync — the manual "Sync now" path (there's also a daily
// cron, app/api/cron/plaid-sync). Body `{ itemId }` syncs one connection;
// an empty body syncs every connection the user has.
//
// syncItem never throws — a failure updates the item's own status
// (login_required / error) and comes back as { ok: false }, which this
// route surfaces as a 502 rather than crashing into the generic 500 below.
export async function POST(request) {
  try {
    const user = await currentUser()
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

    if (!plaidEnabled) {
      return Response.json({ error: 'Bank connections are not configured' }, { status: 503 })
    }

    const gate = await requirePro(user.id)
    if (gate) return gate

    // A sync writes to the transactions table, same as any other mutating
    // route — the feature-specific plaid-sync cap below is the tighter,
    // more relevant limit in practice, but this is the same generic backstop
    // every other write path in the app has.
    const blocked = await checkWriteLimit(user.id)
    if (blocked) return blocked

    const plan = await getPlan(user.id)
    const { allowed, infraError } = await checkRateLimit(user.id, 'plaid-sync', plan)
    if (!allowed) {
      if (infraError) {
        return Response.json(
          { error: 'Something went wrong on our end — please try again in a moment.' },
          { status: 503 }
        )
      }
      return Response.json(
        { error: "You've hit today's sync limit. Try again tomorrow." },
        { status: 429 }
      )
    }

    const { itemId } = await request.json().catch(() => ({}))
    const email = user.emailAddresses[0]?.emailAddress

    if (itemId) {
      const item = await getPlaidItemWithToken(user.id, itemId)
      if (!item) return Response.json({ error: 'Bank connection not found' }, { status: 404 })

      const result = await syncItem(user.id, item, { email })
      if (!result.ok) {
        return Response.json({ error: 'Sync failed', code: result.error }, { status: 502 })
      }
      return Response.json(result)
    }

    const results = await syncAllItemsForUser(user.id, { email })
    return Response.json({ results })
  } catch (error) {
    console.error('Error syncing Plaid transactions:', error)
    return Response.json({ error: 'Failed to sync transactions' }, { status: 500 })
  }
}
