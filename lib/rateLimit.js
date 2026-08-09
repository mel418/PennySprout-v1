// Per-user daily rate limiting. Counters are stored in Supabase (see the
// api_usage migration) rather than in-process memory, because serverless
// instances don't share memory and reset on every cold start — a memory
// counter would cap almost nothing.
import 'server-only'
import { supabase } from '@/lib/supabase'

// Daily per-user caps by plan.
//   chat / parse-pdf — call the Anthropic API, which costs real money per
//     request. Free is generous for real use (a person uploads a few
//     statements and re-analyzes a few months) but tight enough that a
//     runaway client loop or abused session can't run up a meaningful bill.
//     Pro raises the ceiling — the paid tier's concrete benefit.
//   write — PATCH/PUT/POST/DELETE on transactions, budgets, and goals. Not a
//     cost concern like the AI routes, just a backstop against a scripted or
//     compromised-session loop hammering the database. Same cap on every
//     plan since it isn't a paid perk, just abuse protection; 500/day is far
//     above anything a person doing real editing would hit.
const DAILY_LIMITS = {
  free: { 'chat': 30, 'parse-pdf': 20, 'write': 500 },
  pro:  { 'chat': 200, 'parse-pdf': 100, 'write': 500 },
}

// Increments today's counter for (userId, route) and reports whether the
// request is still under the cap for the user's plan ('free' when omitted).
// Callers should return 429 when `allowed` is false and `infraError` is
// falsy, or a 503 when `infraError` is true (see checkWriteLimit below for
// the shared pattern).
//
// Fails CLOSED on infrastructure errors (e.g. the SQL migration hasn't been
// run yet): a rate limiter that's down is indistinguishable from "no cap at
// all," and every route gated on this either costs real money per request
// (chat, parse-pdf) or writes to the database (write) — silently letting
// those through during an outage is worse than a visible, self-correcting
// block. The error is logged loudly so it can't go unnoticed.
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
      'Rate limiter unavailable (did you run `npm run db:push`?) — blocking request:',
      error
    )
    return { allowed: false, limit, used: null, infraError: true }
  }

  return { allowed: used <= limit, limit, used }
}

// Shared guard for mutating endpoints (transaction edits/deletes, budget and
// goal writes, …). Returns a Response to return immediately if the request
// should be blocked, or null if it may proceed — so callers just do:
//   const blocked = await checkWriteLimit(user.id)
//   if (blocked) return blocked
export async function checkWriteLimit(userId) {
  const { allowed, limit, infraError } = await checkRateLimit(userId, 'write')
  if (allowed) return null

  if (infraError) {
    return Response.json(
      { error: 'Something went wrong on our end — please try again in a moment.' },
      { status: 503 }
    )
  }
  return Response.json(
    { error: `Daily edit limit reached (${limit}/day). Try again tomorrow.` },
    { status: 429 }
  )
}
