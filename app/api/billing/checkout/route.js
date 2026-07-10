import { currentUser } from '@clerk/nextjs/server'
import { stripe, billingEnabled } from '@/lib/stripe'
import { getSubscription } from '@/lib/subscriptionStorage'

// POST /api/billing/checkout — start a Stripe Checkout session for the Pro
// subscription and return its URL for the client to redirect to.
//
// The Clerk user id rides along as client_reference_id AND subscription
// metadata, so the webhook can attribute the subscription to a user without
// trusting anything the client sent.
export async function POST(request) {
  try {
    const user = await currentUser()
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

    if (!billingEnabled) {
      return Response.json({ error: 'Billing is not configured' }, { status: 503 })
    }

    // Someone already subscribed shouldn't buy a second subscription — send
    // them to the portal (via the pricing page) instead.
    const existing = await getSubscription(user.id)
    if (existing && ['active', 'trialing', 'past_due'].includes(existing.status)) {
      return Response.json({ error: 'Already subscribed' }, { status: 409 })
    }

    const origin = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: process.env.STRIPE_PRICE_ID, quantity: 1 }],
      client_reference_id: user.id,
      // Reuse the Stripe customer if one exists from a lapsed subscription;
      // otherwise let Checkout create one keyed to the account email.
      ...(existing
        ? { customer: existing.stripe_customer_id }
        : { customer_email: user.emailAddresses[0]?.emailAddress }),
      subscription_data: { metadata: { clerk_user_id: user.id } },
      success_url: `${origin}/pricing?upgraded=1`,
      cancel_url: `${origin}/pricing`,
      allow_promotion_codes: true,
    })

    return Response.json({ url: session.url })
  } catch (error) {
    console.error('Error creating checkout session:', error)
    return Response.json({ error: 'Failed to start checkout' }, { status: 500 })
  }
}
