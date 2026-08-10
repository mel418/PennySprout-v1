import { currentUser } from '@clerk/nextjs/server'
import { Products, CountryCode } from 'plaid'
import { plaid, plaidEnabled } from '@/lib/plaid'
import { requirePro } from '@/lib/planGate'
import { checkRateLimit } from '@/lib/rateLimit'
import { getPlan } from '@/lib/subscriptionStorage'
import { getPlaidItemWithToken } from '@/lib/plaidItemStorage'

// POST /api/plaid/link-token — creates a Link token for the client to open
// Plaid Link with. Two modes:
//   {}            normal mode — links a brand-new bank connection
//   { itemId }    update mode — re-authenticates an existing connection
//                 (e.g. after ITEM_LOGIN_REQUIRED); Link reopens without
//                 asking the user to pick their bank again
//
// days_requested is only meaningful for normal mode: Plaid fixes it for the
// life of the Item, so this is the one and only place it's ever set.
export async function POST(request) {
  try {
    const user = await currentUser()
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

    if (!plaidEnabled) {
      return Response.json({ error: 'Bank connections are not configured' }, { status: 503 })
    }

    const gate = await requirePro(user.id)
    if (gate) return gate

    const plan = await getPlan(user.id)
    const { allowed, infraError } = await checkRateLimit(user.id, 'plaid-link', plan)
    if (!allowed) {
      if (infraError) {
        return Response.json(
          { error: 'Something went wrong on our end — please try again in a moment.' },
          { status: 503 }
        )
      }
      return Response.json(
        { error: "You've hit today's limit for connecting/reconnecting banks. Try again tomorrow." },
        { status: 429 }
      )
    }

    const { itemId } = await request.json().catch(() => ({}))

    const baseRequest = {
      user: { client_user_id: user.id },
      client_name: 'Penny Sprout',
      language: 'en',
      country_codes: [CountryCode.Us],
    }

    let linkRequest
    if (itemId) {
      // Update mode: re-authenticate an existing Item. No `products` — Link
      // already knows what this Item is for — and access_token identifies
      // which connection is being repaired.
      const item = await getPlaidItemWithToken(user.id, itemId)
      if (!item) return Response.json({ error: 'Bank connection not found' }, { status: 404 })
      linkRequest = { ...baseRequest, access_token: item.accessToken }
    } else {
      linkRequest = {
        ...baseRequest,
        products: [Products.Transactions],
        // Max allowed (730 days). This is fixed for the Item's whole
        // lifetime — changing it later means deleting and relinking — so a
        // new connection backfills the Analysis/Calendar tabs immediately
        // rather than starting with Plaid's 90-day default.
        transactions: { days_requested: 730 },
      }
    }

    const { data } = await plaid.linkTokenCreate(linkRequest)
    return Response.json({ linkToken: data.link_token })
  } catch (error) {
    console.error('Error creating Plaid link token:', error?.response?.data || error)
    return Response.json({ error: 'Failed to start bank connection' }, { status: 500 })
  }
}
