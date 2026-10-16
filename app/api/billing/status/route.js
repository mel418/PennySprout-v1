import { currentUser } from '@clerk/nextjs/server'
import { billingEnabled } from '@/lib/stripe'
import { getSubscription, getPlanOverride } from '@/lib/subscriptionStorage'

// GET /api/billing/status — the signed-in user's plan, for the pricing page
// and any UI that badges Pro. Shape:
//   { enabled, plan: 'free'|'pro', granted?, status?, cancelAtPeriodEnd?, currentPeriodEnd? }
const PRO_STATUSES = new Set(['active', 'trialing', 'past_due'])

export async function GET() {
  try {
    const user = await currentUser()
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

    // An admin-set plan applies even when Stripe isn't configured. `granted`
    // lets the pricing page say so instead of offering a checkout.
    const override = await getPlanOverride(user.id).catch(() => null)
    if (override) {
      return Response.json({ enabled: billingEnabled, plan: override, granted: true })
    }

    if (!billingEnabled) {
      return Response.json({ enabled: false, plan: 'free' })
    }

    const sub = await getSubscription(user.id)
    const isPro = sub && PRO_STATUSES.has(sub.status)

    return Response.json({
      enabled: true,
      plan: isPro ? 'pro' : 'free',
      ...(sub && {
        status: sub.status,
        cancelAtPeriodEnd: sub.cancel_at_period_end,
        currentPeriodEnd: sub.current_period_end,
      }),
    })
  } catch (error) {
    console.error('Error fetching billing status:', error)
    return Response.json({ error: 'Failed to fetch billing status' }, { status: 500 })
  }
}
