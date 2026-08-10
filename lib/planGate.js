// Reusable Pro-tier gate for API routes. Plaid is the first feature-level
// Pro gate in the app (Pro has so far only ever changed rate limits — see
// lib/rateLimit.js DAILY_LIMITS), so this is meant to be the pattern every
// future Pro-only route copies.
import 'server-only'
import { getPlan } from '@/lib/subscriptionStorage'

// Returns null when the user is on Pro (caller proceeds), or a ready-to-
// return Response otherwise. 402 Payment Required — not 403 — so the client
// can tell "upgrade to unlock this" apart from "you're not allowed to do
// this at all". getPlan() already fails closed to 'free' on any error, so
// an outage denies rather than silently granting the paid feature.
export async function requirePro(userId) {
  const plan = await getPlan(userId)
  if (plan === 'pro') return null
  return Response.json(
    { error: 'This feature is part of Sprout Pro.', code: 'pro_required' },
    { status: 402 }
  )
}
