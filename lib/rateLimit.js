// Per-user daily rate limiting for the Anthropic-backed routes. Counters are
// stored in Supabase (see the api_usage migration) rather than in-process
// memory, because serverless instances don't share memory and reset on every
// cold start — a memory counter would cap almost nothing.
import 'server-only'
import { supabase } from '@/lib/supabase'

// Daily per-user caps by plan. Free is generous for real use (a person
// uploads a few statements and re-analyzes a few months) but tight enough
// that a runaway client loop or abused session can't run up a meaningful
// Anthropic bill. Pro raises the ceiling for heavy users — the paid tier's
// concrete "more of the thing you already use" benefit.
const DAILY_LIMITS = {
  free: { 'chat': 30, 'parse-pdf': 20 },
  pro:  { 'chat': 200, 'parse-pdf': 100 },
}

// Increments today's counter for (userId, route) and reports whether the
// request is still under the cap for the user's plan ('free' when omitted).
// Callers should return 429 when `allowed` is false.
//
// Fails OPEN on infrastructure errors (e.g. the SQL above hasn't been run
// yet): a broken limiter shouldn't take the whole product down. The error is
// logged loudly so it can't go unnoticed.
export async function checkRateLimit(userId, route, plan = 'free') {
  const limit = (DAILY_LIMITS[plan] || DAILY_LIMITS.free)[route]
  if (!limit) {
    console.error(`checkRateLimit: no limit configured for route "${route}"`)
    return { allowed: true, limit: null, used: null }
  }

  const { data: used, error } = await supabase.rpc('increment_api_usage', {
    p_user_id: userId,
    p_route: route,
  })

  if (error) {
    console.error(
      'Rate limiter unavailable (did you run `npm run db:push`?) — allowing request:',
      error
    )
    return { allowed: true, limit, used: null }
  }

  return { allowed: used <= limit, limit, used }
}
