'use client'
import { AlertTriangle, RefreshCw, LogIn } from 'lucide-react'

// Error state for failed data loads — pairs with useTransactions.
// Distinguishes an expired session (sign back in) from a server/network
// problem (retry), instead of letting either masquerade as "no data yet."
export default function LoadError({ error, onRetry }) {
  const isAuth = error?.kind === 'auth'

  return (
    <div
      role="alert"
      className="bg-surface border border-amber-200 rounded-2xl shadow-sm p-8 text-center"
    >
      <AlertTriangle className="mx-auto h-10 w-10 text-amber-400 mb-3" aria-hidden="true" />
      <h3 className="text-base font-semibold text-ink mb-1">
        {isAuth ? 'Your session has expired' : "Couldn't load your data"}
      </h3>
      <p className="text-sm text-ink-soft mb-5 max-w-sm mx-auto">
        {isAuth
          ? 'Sign in again to keep going — your data is safe.'
          : 'Something went wrong loading your transactions. Your data is safe — this is a connection or server hiccup.'}
      </p>
      {isAuth ? (
        <button
          onClick={() => window.location.reload()}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-sage-600 hover:bg-sage-700 text-white text-sm font-semibold rounded-xl transition-colors"
        >
          <LogIn className="h-4 w-4" aria-hidden="true" />
          Sign in again
        </button>
      ) : (
        <button
          onClick={onRetry}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-sage-600 hover:bg-sage-700 text-white text-sm font-semibold rounded-xl transition-colors"
        >
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
          Try again
        </button>
      )}
    </div>
  )
}
