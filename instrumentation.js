// Next.js instrumentation hook — runs once per server instance at startup.
// Loads the right Sentry config for the runtime, and forwards request errors
// (API routes, server components) to Sentry via onRequestError.
//
// Sentry is a no-op until SENTRY_DSN / NEXT_PUBLIC_SENTRY_DSN are set in
// .env.local — create a free project at sentry.io and paste the DSN in.
import * as Sentry from '@sentry/nextjs'

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./sentry.server.config')
  }
  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('./sentry.edge.config')
  }
}

export const onRequestError = Sentry.captureRequestError
