import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  enabled: Boolean(process.env.SENTRY_DSN), // silent no-op until a DSN is configured

  // Error monitoring is the goal here; keep performance tracing off to stay
  // well inside Sentry's free tier.
  tracesSampleRate: 0,

  // NEVER attach request bodies/PII — this app handles financial data.
  sendDefaultPii: false,
})
