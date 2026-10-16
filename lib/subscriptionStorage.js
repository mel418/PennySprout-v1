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

// Admin-set plan ('free' | 'pro') for a user, or null when none is set. An
// override beats Stripe in either direction, and lives in its own table so
// the webhook (the only writer of `subscriptions`) can never clobber it.
export async function getPlanOverride(userId) {
  const { data, error } = await supabase
    .from('plan_overrides')
    .select('plan')
    .eq('user_id', userId)
    .maybeSingle()

  if (error) {
    console.error('Error fetching plan override:', error)
    throw new Error('Failed to fetch plan override')
  }
  return data?.plan || null
}

// Overrides for many users at once, as a Map of userId -> plan.
export async function listPlanOverrides(userIds) {
  if (userIds.length === 0) return new Map()
  const { data, error } = await supabase
    .from('plan_overrides')
    .select('user_id, plan')
    .in('user_id', userIds)

  if (error) {
    console.error('Error listing plan overrides:', error)
    throw new Error('Failed to list plan overrides')
  }
  return new Map(data.map(row => [row.user_id, row.plan]))
}

// plan: 'free' | 'pro' sets the override; null removes it.
export async function setPlanOverride({ userId, plan, grantedBy }) {
  if (plan === null) {
    const { error } = await supabase.from('plan_overrides').delete().eq('user_id', userId)
    if (error) {
      console.error('Error clearing plan override:', error)
      throw new Error('Failed to clear plan override')
    }
    return
  }

  const { error } = await supabase
    .from('plan_overrides')
    .upsert(
      { user_id: userId, plan, granted_by: grantedBy, updated_at: new Date().toISOString() },
      { onConflict: 'user_id' }
    )
  if (error) {
    console.error('Error saving plan override:', error)
    throw new Error('Failed to save plan override')
  }
}

// 'free' | 'pro'. Fails CLOSED to free: if the subscriptions table is missing
// or unreadable, users keep the free tier rather than getting paid features.
export async function getPlan(userId) {
  try {
    const override = await getPlanOverride(userId)
    if (override) return override
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
