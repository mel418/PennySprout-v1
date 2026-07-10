// Server-only access to the subscriptions table (see the subscriptions
// migration). Stripe is the source of truth; this table is a
// webhook-maintained cache so plan checks are one indexed Supabase read, not a
// Stripe API call on every request.
import 'server-only'
import { supabase } from '@/lib/supabase'

// Statuses that grant paid features. past_due is deliberately included: Stripe
// retries failed payments for days, and yanking features during a card hiccup
// is how you churn a recoverable customer.
const PRO_STATUSES = new Set(['active', 'trialing', 'past_due'])

export async function getSubscription(userId) {
  const { data, error } = await supabase
    .from('subscriptions')
    .select('user_id, stripe_customer_id, stripe_subscription_id, status, price_id, cancel_at_period_end, current_period_end')
    .eq('user_id', userId)
    .maybeSingle()

  if (error) {
    console.error('Error fetching subscription:', error)
    throw new Error('Failed to fetch subscription')
  }
  return data
}

// 'free' | 'pro'. Fails CLOSED to free: if the subscriptions table is missing
// or unreadable, users keep the free tier rather than getting paid features.
export async function getPlan(userId) {
  try {
    const sub = await getSubscription(userId)
    return sub && PRO_STATUSES.has(sub.status) ? 'pro' : 'free'
  } catch {
    return 'free'
  }
}

// Upsert from webhook events, keyed by user_id (one subscription per user).
export async function upsertSubscription({
  userId,
  stripeCustomerId,
  stripeSubscriptionId,
  status,
  priceId,
  cancelAtPeriodEnd,
  currentPeriodEnd,
}) {
  const { error } = await supabase
    .from('subscriptions')
    .upsert(
      {
        user_id: userId,
        stripe_customer_id: stripeCustomerId,
        stripe_subscription_id: stripeSubscriptionId,
        status,
        price_id: priceId,
        cancel_at_period_end: cancelAtPeriodEnd,
        current_period_end: currentPeriodEnd,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' }
    )

  if (error) {
    console.error('Error upserting subscription:', error)
    throw new Error('Failed to save subscription')
  }
}

// Webhook subscription.* events only carry the Stripe customer id — map it
// back to our user. Returns null when no row exists yet.
export async function getUserIdByCustomerId(stripeCustomerId) {
  const { data, error } = await supabase
    .from('subscriptions')
    .select('user_id')
    .eq('stripe_customer_id', stripeCustomerId)
    .maybeSingle()

  if (error) {
    console.error('Error looking up customer:', error)
    throw new Error('Failed to look up customer')
  }
  return data?.user_id || null
}
