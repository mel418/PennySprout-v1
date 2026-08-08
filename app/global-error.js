'use client'
// App Router's last-resort error boundary — catches render crashes that the
// root layout can't recover from, reports them to Sentry, and shows a calm
// fallback instead of a white screen. This component replaces the root layout
// when it renders, so it must provide its own <html>/<body> and can't rely on
// globals.css being loaded — styles are inline.
import * as Sentry from '@sentry/nextjs'
import { useEffect } from 'react'

export default function GlobalError({ error, reset }) {
  useEffect(() => {
    Sentry.captureException(error)
  }, [error])

  return (
    <html lang="en">
      {/* Colors are literals, not tokens: this component replaces the root
          layout, so globals.css isn't guaranteed to be loaded. They mirror the
          light palette (Cream #FFF9F1, warm brown ink, Deep Sprout button). */}
      <body style={{
        margin: 0, minHeight: '100vh', display: 'flex', alignItems: 'center',
        justifyContent: 'center', background: '#FFF9F1', color: '#453931',
        fontFamily: 'system-ui, sans-serif', textAlign: 'center', padding: 24,
      }}>
        <div>
          <p style={{ fontSize: 44, margin: 0 }}>🌱</p>
          <h1 style={{ fontSize: 22, margin: '14px 0 8px' }}>Something went wrong</h1>
          <p style={{ fontSize: 15, lineHeight: 1.6, color: '#6B564A', margin: '0 0 22px' }}>
            The error has been reported. Your data is safe.
          </p>
          <button
            onClick={() => reset()}
            style={{
              padding: '12px 28px', borderRadius: 16, border: 'none', cursor: 'pointer',
              background: '#58735A', color: '#fff', fontSize: 15, fontWeight: 600,
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  )
}
