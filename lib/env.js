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
}
