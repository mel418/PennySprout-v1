import { clerkClient } from '@clerk/nextjs/server'
import { supabase } from '@/lib/supabase'
import { emailEnabled, sendOnce } from '@/lib/email'

// GET /api/cron/upload-reminder — monthly "your statement closed, upload it"
// nudge, the retention loop for a product with no bank connection: fresh data
// arrives only when the user brings it, so we remind them at the start of
// each month.
//
// Called by a scheduler (vercel.json cron), NOT a browser — exempted from the
// Clerk middleware gate and authenticated by CRON_SECRET instead (Vercel
// sends it as `Authorization: Bearer <CRON_SECRET>` automatically).
//
// Who gets it: users who have uploaded before (they know the ritual) but have
// no upload in the last 30 days. Dedupe key = current 'YYYY-MM', so reruns
// and manual triggers can't double-send within a month.
export async function GET(request) {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    return Response.json({ error: 'Cron is not configured' }, { status: 503 })
  }
  if (request.headers.get('authorization') !== `Bearer ${secret}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (!emailEnabled) {
    return Response.json({ skipped: 'email not configured' })
  }

  try {
    // Latest upload per user, grouped in JS (fine at current scale).
    const { data, error } = await supabase
      .from('user_files')
      .select('user_id, created_at')
    if (error) throw error

    const latestByUser = {}
    data.forEach(({ user_id, created_at }) => {
      if (!latestByUser[user_id] || created_at > latestByUser[user_id]) {
        latestByUser[user_id] = created_at
      }
    })

    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - 30)
    const staleUsers = Object.entries(latestByUser)
      .filter(([, last]) => new Date(last) < cutoff)
      .map(([userId]) => userId)

    const thisMonth = new Date().toISOString().slice(0, 7) // 'YYYY-MM'
    const client = await clerkClient()
    let sent = 0

    for (const userId of staleUsers) {
      let email
      try {
        const clerkUser = await client.users.getUser(userId)
        email = clerkUser.emailAddresses[0]?.emailAddress
      } catch {
        continue // deleted Clerk account with orphaned rows — skip
      }
      if (!email) continue

      const didSend = await sendOnce(userId, 'upload-reminder', thisMonth, {
        to: email,
        subject: 'A new month, a fresh look at your money 🌱',
        html: `
          <p style="font-size:15px;color:#2E3830;margin:0 0 12px;">
            Your latest bank statement has probably closed by now. Upload it to
            Penny Sprout and see last month laid out on your calendar —
            spending, income, and how your budgets held up.
          </p>
          <p style="font-size:14px;color:#5B6159;margin:0;">
            It takes about a minute, and your bank login never comes anywhere
            near us — that's the whole point.
          </p>`,
      })
      if (didSend) sent++
    }

    return Response.json({ candidates: staleUsers.length, sent })
  } catch (error) {
    console.error('Upload reminder cron failed:', error)
    return Response.json({ error: 'Cron failed' }, { status: 500 })
  }
}
