import { clerkClient } from '@clerk/nextjs/server'
import { plaid, plaidEnabled, plaidErrorCode } from '@/lib/plaid'
import { getPlan } from '@/lib/subscriptionStorage'
import { sendOnce, emailEnabled } from '@/lib/email'
import {
  getSyncableItems,
  getAllNonRemovedItems,
  markItemStatus,
} from '@/lib/plaidItemStorage'
import { syncItem } from '@/lib/plaidSyncEngine'

// A cron function, not a request handler — give it real headroom for
// paging through /transactions/sync for up to 25 items plus the plan-check
// pass, well under Vercel's platform ceiling.
export const maxDuration = 60

// How long a connection can sit 'paused' (Pro lapsed) before it's removed
// at Plaid entirely. Paused connections cost nothing at Plaid — only
// 'active' Items are billed — so this exists purely to avoid an unbounded
// pile of dead Items sitting in a user's Plaid Dashboard forever, and to
// stop counting toward institution-side connection limits. Transactions are
// NEVER deleted by this — only the live connection goes away.
const REAP_AFTER_DAYS = 60
const WARN_AFTER_DAYS = 45

function daysSince(iso) {
  if (!iso) return Infinity
  return (Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24)
}

// GET /api/cron/plaid-sync — daily. Two passes:
//   1. Plan check: pause any 'active' item whose owner isn't Pro anymore,
//      reactivate any 'paused' item whose owner is Pro again, and reap
//      (remove at Plaid) anything paused past REAP_AFTER_DAYS.
//   2. Sync: page through /transactions/sync for a batch of 'active' items,
//      oldest-synced-first, so no single connection starves under the cap.
//
// Called by Vercel's scheduler (vercel.json), NOT a browser — exempted from
// the Clerk middleware gate (see middleware.js isWebhookRoute) and
// authenticated by CRON_SECRET instead, same pattern as
// app/api/cron/upload-reminder.
export async function GET(request) {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    return Response.json({ error: 'Cron is not configured' }, { status: 503 })
  }
  if (request.headers.get('authorization') !== `Bearer ${secret}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (!plaidEnabled) {
    return Response.json({ skipped: 'Plaid not configured' })
  }

  const clerk = await clerkClient()
  // One Clerk lookup per user per cron run, however many items they have.
  const emailCache = new Map()
  async function emailFor(userId) {
    if (emailCache.has(userId)) return emailCache.get(userId)
    let email = null
    try {
      const clerkUser = await clerk.users.getUser(userId)
      email = clerkUser.emailAddresses[0]?.emailAddress || null
    } catch {
      // Deleted Clerk account with an orphaned Plaid item — account
      // deletion should have removed it, but don't let this crash the run.
    }
    emailCache.set(userId, email)
    return email
  }

  let paused = 0
  let reactivated = 0
  let reaped = 0
  let warned = 0

  try {
    const items = await getAllNonRemovedItems()
    for (const item of items) {
      const plan = await getPlan(item.userId)

      if (plan === 'pro') {
        if (item.status === 'paused') {
          await markItemStatus(item.userId, item.id, 'active')
          reactivated++
        }
        continue
      }

      // Not Pro.
      if (item.status !== 'paused') {
        await markItemStatus(item.userId, item.id, 'paused')
        paused++
        continue
      }

      const days = daysSince(item.statusChangedAt)

      if (days >= REAP_AFTER_DAYS) {
        try {
          await plaid.itemRemove({ access_token: item.accessToken })
        } catch (error) {
          // Already removed at Plaid, or a transient error — either way,
          // stop billing/counting it locally rather than retry forever.
          console.error('Plaid /item/remove failed during reap:', plaidErrorCode(error) || error)
        }
        await markItemStatus(item.userId, item.id, 'removed')
        reaped++
      } else if (emailEnabled && days >= WARN_AFTER_DAYS) {
        const email = await emailFor(item.userId)
        if (email) {
          const sent = await sendOnce(item.userId, 'plaid-paused-expiring', item.id, {
            to: email,
            subject: 'A connected bank will be disconnected soon',
            html: `
              <p style="font-size:15px;color:#2E3830;margin:0 0 12px;">
                One of your connected banks has been paused since your Sprout Pro
                subscription lapsed. If you don't resubscribe, we'll disconnect it
                in about ${Math.max(0, Math.round(REAP_AFTER_DAYS - days))} days.
              </p>
              <p style="font-size:14px;color:#5B6159;margin:0;">
                Your synced transaction history is never deleted by this — only the
                live connection goes away, and you can always reconnect later.
              </p>`,
          })
          if (sent) warned++
        }
      }
    }
  } catch (error) {
    console.error('Plaid plan-check pass failed:', error)
  }

  let synced = 0
  let failed = 0
  try {
    const syncable = await getSyncableItems({ limit: 25 })
    for (const item of syncable) {
      const email = await emailFor(item.userId)
      const result = await syncItem(item.userId, item, { email })
      if (result.ok) synced++
      else failed++
    }
  } catch (error) {
    console.error('Plaid sync pass failed:', error)
  }

  return Response.json({ paused, reactivated, reaped, warned, synced, failed })
}
