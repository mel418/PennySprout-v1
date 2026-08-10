// Boot-time environment validation. Called once from instrumentation.js
// register(), so a missing secret fails loudly at server startup with a
// clear name — instead of surfacing deep inside a request handler as a
// cryptic "Invalid API key" or empty Supabase client hours later.

const REQUIRED = [
  'ANTHROPIC_API_KEY',
  'CLERK_SECRET_KEY',
  'NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY',
  'NEXT_PUBLIC_SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
]

// Optional but recommended — warn, don't crash.
const RECOMMENDED = ['SENTRY_DSN', 'NEXT_PUBLIC_SENTRY_DSN']

// Billing is env-gated: with none of these set, Stripe features no-op cleanly.
// Warn only on a PARTIAL configuration, which is almost certainly a mistake
// (e.g. checkout works but the webhook can't verify, so plans never activate).
const BILLING = ['STRIPE_SECRET_KEY', 'STRIPE_PRICE_ID', 'STRIPE_WEBHOOK_SECRET']

// Bank connections (Plaid) are env-gated the same way. PLAID_ENV is
// deliberately excluded — it has a safe 'sandbox' default (see lib/plaid.js)
// — so a partial-config warning here means the other three.
const PLAID = ['PLAID_CLIENT_ID', 'PLAID_SECRET', 'PLAID_ENCRYPTION_KEY']

export function validateEnv() {
  const missing = REQUIRED.filter(name => !process.env[name])
  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variable(s): ${missing.join(', ')}. ` +
      'Copy the .env.local template from README.md and fill these in.'
    )
  }

  const unset = RECOMMENDED.filter(name => !process.env[name])
  if (unset.length > 0) {
    console.warn(
      `Env warning: ${unset.join(', ')} not set — error monitoring is disabled.`
    )
  }

  const billingSet = BILLING.filter(name => process.env[name])
  if (billingSet.length > 0 && billingSet.length < BILLING.length) {
    const billingMissing = BILLING.filter(name => !process.env[name])
    console.warn(
      `Env warning: partial Stripe config — ${billingMissing.join(', ')} not set. ` +
      'Billing will not work correctly until all three are present.'
    )
  }

  const plaidSet = PLAID.filter(name => process.env[name])
  if (plaidSet.length > 0 && plaidSet.length < PLAID.length) {
    const plaidMissing = PLAID.filter(name => !process.env[name])
    console.warn(
      `Env warning: partial Plaid config — ${plaidMissing.join(', ')} not set. ` +
      'Bank connections will not work correctly until all three are present.'
    )
  }

  // A wrong-length key would fail inside createCipheriv on every single
  // request forever (silent per-request breakage) rather than at boot —
  // this check turns that into a loud, immediate failure instead.
  if (process.env.PLAID_ENCRYPTION_KEY) {
    let keyLength = 0
    try {
      keyLength = Buffer.from(process.env.PLAID_ENCRYPTION_KEY, 'base64').length
    } catch {
      keyLength = 0
    }
    if (keyLength !== 32) {
      throw new Error(
        'PLAID_ENCRYPTION_KEY must be exactly 32 bytes, base64-encoded ' +
        '(generate one with `openssl rand -base64 32`).'
      )
    }
  }

  // Real bank connections that silently never sync is an expensive failure
  // mode to discover late — warn loudly rather than let it happen quietly.
  if (process.env.PLAID_ENV === 'production' && !process.env.CRON_SECRET) {
    console.warn(
      'Env warning: PLAID_ENV is "production" but CRON_SECRET is not set — ' +
      'the Plaid sync cron is unauthenticated and Vercel cannot call it, so ' +
      'connected banks will never sync automatically.'
    )
  }
}
