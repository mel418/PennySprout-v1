import { stripe } from '@/lib/stripe'
import { upsertSubscription, getUserIdByCustomerId } from '@/lib/subscriptionStorage'

// POST /api/billing/webhook — Stripe calls this; it is the ONLY writer of the
// subscriptions table. Exempted from the Clerk middleware gate (Stripe has no
// session) — authentication is the signature check below, which proves the
// payload was signed by Stripe with our webhook secret.
//
// Local dev: stripe listen --forward-to localhost:3000/api/billing/webhook
// (the printed whsec_... goes in STRIPE_WEBHOOK_SECRET).

// Newer Stripe API versions moved current_period_end onto subscription items.
function periodEnd(sub) {
  const ts = sub.current_period_end ?? sub.items?.data?.[0]?.current_period_end
  return ts ? new Date(ts * 1000).toISOString() : null
}

async function syncSubscription(sub, knownUserId = null) {
  const userId = knownUserId
    || sub.metadata?.clerk_user_id
    || await getUserIdByCustomerId(sub.customer)

  if (!userId) {
    // A subscription we can't attribute — log loudly rather than guessing.
    console.error(`Webhook: subscription ${sub.id} has no clerk_user_id metadata and unknown customer ${sub.customer}`)
    return
  }

  await upsertSubscription({
    userId,
    stripeCustomerId: sub.customer,
    stripeSubscriptionId: sub.id,
    status: sub.status,
    priceId: sub.items?.data?.[0]?.price?.id || null,
    cancelAtPeriodEnd: Boolean(sub.cancel_at_period_end),
    currentPeriodEnd: periodEnd(sub),
  })
}

export async function POST(request) {
  if (!stripe || !process.env.STRIPE_WEBHOOK_SECRET) {
    return Response.json({ error: 'Billing is not configured' }, { status: 503 })
  }

  // Signature verification needs the exact raw bytes Stripe signed — read the
  // body as text, never as parsed JSON.
  const payload = await request.text()
  const signature = request.headers.get('stripe-signature')

  let event
  try {
    event = stripe.webhooks.constructEvent(payload, signature, process.env.STRIPE_WEBHOOK_SECRET)
  } catch (error) {
    console.error('Webhook signature verification failed:', error.message)
    return Response.json({ error: 'Invalid signature' }, { status: 400 })
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object
        if (session.mode !== 'subscription' || !session.subscription) break
        const sub = await stripe.subscriptions.retrieve(session.subscription)
        // client_reference_id is the Clerk user id we set at checkout — the
        // one moment we can attribute a brand-new customer to a user.
        await syncSubscription(sub, session.client_reference_id)
        break
      }
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        await syncSubscription(event.data.object)
        break
      }
      default:
        // Unhandled event types are fine — Stripe sends many we don't need.
        break
    }
    return Response.json({ received: true })
  } catch (error) {
    // Non-2xx makes Stripe retry with backoff — correct for transient DB
    // failures, since the retry will land once Supabase is reachable again.
    console.error(`Webhook handler failed for ${event.type}:`, error)
    return Response.json({ error: 'Webhook handler failed' }, { status: 500 })
  }
}
