'use client'
import { RefreshCw, LogIn, CloudOff } from 'lucide-react'
import Button from './ui/Button'
import Doodle from './ui/Doodle'

// Error state for failed data loads — pairs with useTransactions.
// Distinguishes an expired session (sign back in) from a server/network
// problem (retry), instead of letting either masquerade as "no data yet."
//
// Tone: reassuring, never alarming. A load failure is a hiccup, so it gets a
// soft rose border rather than a red alert block, and the copy leads with
// "your data is safe."
export default function LoadError({ error, onRetry }) {
  const isAuth = error?.kind === 'auth'

  return (
    <div
      role="alert"
      className="relative overflow-hidden rounded-[var(--radius-lg)] border border-danger-200 bg-surface shadow-soft px-6 py-10 text-center"
    >
      <Doodle name="cloud" aria-hidden="true"
        className="absolute right-7 top-6 h-6 w-6 text-danger-400 opacity-30" />

      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-danger-50">
        <CloudOff className="h-6 w-6 text-danger-400" aria-hidden="true" />
      </div>

      <h3 className="text-lg font-semibold text-ink">
        {isAuth ? 'Your session has expired' : "We couldn't load your data"}
      </h3>
      <p className="mt-1.5 mb-6 text-sm sm:text-base text-ink-soft max-w-sm mx-auto leading-relaxed">
        {isAuth
          ? 'Sign in again to pick up where you left off — your data is safe.'
          : 'Your data is safe — this is a connection or server hiccup. Give it another try.'}
      </p>

      {isAuth ? (
        <Button onClick={() => window.location.reload()}>
          <LogIn className="h-4 w-4" aria-hidden="true" /> Sign in again
        </Button>
      ) : (
        <Button onClick={onRetry}>
          <RefreshCw className="h-4 w-4" aria-hidden="true" /> Try again
        </Button>
      )}
    </div>
  )
}
