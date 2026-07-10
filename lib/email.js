// Server-only email sending via Resend's REST API (no SDK dependency),
// env-gated like Sentry and Stripe: with no RESEND_API_KEY set, every send is
// a silent no-op and the product works exactly as before. To go live:
//   RESEND_API_KEY — re_... (free tier: resend.com)
//   EMAIL_FROM     — verified sender, e.g. 'Penny Sprout <hello@yourdomain.com>'
//                    (defaults to Resend's onboarding sender for dev)
import 'server-only'
import { supabase } from '@/lib/supabase'

export const emailEnabled = Boolean(process.env.RESEND_API_KEY)

const FROM = process.env.EMAIL_FROM || 'Penny Sprout <onboarding@resend.dev>'

// Shared calm-sage shell around every notification body.
export function emailLayout(bodyHtml) {
  return `
  <div style="background:#F7F6F1;padding:32px 16px;font-family:-apple-system,Segoe UI,Roboto,sans-serif;">
    <div style="max-width:520px;margin:0 auto;background:#ffffff;border:1px solid #EAE8E1;border-radius:16px;padding:32px;">
      <p style="font-size:18px;font-weight:700;color:#2E3830;margin:0 0 20px;">🌱 Penny Sprout</p>
      ${bodyHtml}
      <hr style="border:none;border-top:1px solid #EAE8E1;margin:24px 0 16px;" />
      <p style="font-size:12px;color:#9A968C;margin:0;">
        You're receiving this because you have a Penny Sprout account.
      </p>
    </div>
  </div>`
}

async function sendEmail({ to, subject, html }) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from: FROM, to, subject, html }),
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Resend ${res.status}: ${body}`)
  }
}

// Send at most once per (userId, kind, dedupeKey) — the email_log UNIQUE
// constraint is the lock. The log row is claimed BEFORE sending, so two
// concurrent requests can't both send; the loser of the insert race skips.
// Returns true if this call sent the email.
//
// Never throws: notifications ride along on user-facing requests (uploads)
// and a mail failure must not fail the upload.
export async function sendOnce(userId, kind, dedupeKey, { to, subject, html }) {
  if (!emailEnabled) return false

  try {
    const { error } = await supabase
      .from('email_log')
      .insert({ user_id: userId, kind, dedupe_key: dedupeKey })

    if (error) {
      // 23505 = unique_violation: already sent (or another request is sending).
      if (error.code !== '23505') {
        console.error('email_log insert failed (did you run `npm run db:push`?):', error)
      }
      return false
    }

    await sendEmail({ to, subject, html: emailLayout(html) })
    return true
  } catch (error) {
    console.error(`Failed to send ${kind} email:`, error)
    return false
  }
}
