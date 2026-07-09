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
      <body style={{
        margin: 0, minHeight: '100vh', display: 'flex', alignItems: 'center',
        justifyContent: 'center', background: '#F6F5F0', color: '#2F3A33',
        fontFamily: 'system-ui, sans-serif', textAlign: 'center', padding: 24,
      }}>
        <div>
          <p style={{ fontSize: 40, margin: 0 }}>🌱</p>
          <h1 style={{ fontSize: 20, margin: '12px 0 8px' }}>Something went wrong</h1>
          <p style={{ fontSize: 14, color: '#6B7A70', margin: '0 0 20px' }}>
            The error has been reported. Your data is safe.
          </p>
          <button
            onClick={() => reset()}
            style={{
              padding: '10px 24px', borderRadius: 12, border: 'none', cursor: 'pointer',
              background: '#5C7A55', color: '#fff', fontSize: 14, fontWeight: 600,
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  )
}
