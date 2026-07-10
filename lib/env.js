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
}
