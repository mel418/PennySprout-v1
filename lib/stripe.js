// Server-only Stripe client, env-gated like Sentry: with no STRIPE_SECRET_KEY
// set, billing is a silent no-op (the pricing page says "not configured" and
// every billing route 503s) instead of crashing the app. Full billing needs:
//   STRIPE_SECRET_KEY      — sk_test_... / sk_live_...
//   STRIPE_WEBHOOK_SECRET  — whsec_... (from `stripe listen` or the dashboard)
//   STRIPE_PRICE_ID        — price_... for the Pro monthly subscription
import 'server-only'
import Stripe from 'stripe'

export const billingEnabled = Boolean(
  process.env.STRIPE_SECRET_KEY && process.env.STRIPE_PRICE_ID
)

export const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY)
  : null
