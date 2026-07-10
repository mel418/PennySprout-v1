import { currentUser } from '@clerk/nextjs/server'
import { stripe, billingEnabled } from '@/lib/stripe'
import { getSubscription } from '@/lib/subscriptionStorage'

// POST /api/billing/portal — open the Stripe customer portal, where the user
// updates their card, downloads invoices, or cancels. Stripe hosts all of it;
// the webhook keeps our subscriptions table in sync with whatever they do.
export async function POST(request) {
  try {
    const user = await currentUser()
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

    if (!billingEnabled) {
      return Response.json({ error: 'Billing is not configured' }, { status: 503 })
    }

    const sub = await getSubscription(user.id)
    if (!sub) {
      return Response.json({ error: 'No subscription found' }, { status: 404 })
    }

    const origin = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin
    const session = await stripe.billingPortal.sessions.create({
      customer: sub.stripe_customer_id,
      return_url: `${origin}/pricing`,
    })

    return Response.json({ url: session.url })
  } catch (error) {
    console.error('Error creating portal session:', error)
    return Response.json({ error: 'Failed to open billing portal' }, { status: 500 })
  }
}
