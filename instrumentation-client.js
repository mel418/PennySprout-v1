// Client-side Sentry init (browser errors). Next.js 15.3+ loads this file
// automatically on the client. The DSN must be NEXT_PUBLIC_ to reach the
// browser bundle — DSNs are safe to expose (they can only receive events).
import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: Boolean(process.env.NEXT_PUBLIC_SENTRY_DSN),
  tracesSampleRate: 0,
  sendDefaultPii: false,
})

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart
