import * as Sentry from '@sentry/nextjs'

// Covers the edge runtime (clerkMiddleware in middleware.js runs here).
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  enabled: Boolean(process.env.SENTRY_DSN),
  tracesSampleRate: 0,
  sendDefaultPii: false,
})
