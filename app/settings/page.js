'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useUser, useClerk } from '@clerk/nextjs'
import { ArrowLeft, Download, CreditCard, Trash2, AlertTriangle } from 'lucide-react'

// Settings: data export, billing shortcut, and account deletion. Deletion is
// self-serve and immediate — the privacy policy's erasure promise, in-product
// instead of over email.
export default function SettingsPage() {
  const { isSignedIn, isLoaded, user } = useUser()
  const { signOut } = useClerk()

  const [confirmText, setConfirmText] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState(null)

  if (!isLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-app">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-sage-500 border-t-transparent" />
      </div>
    )
  }

  if (!isSignedIn) {
    if (typeof window !== 'undefined') window.location.assign('/')
    return null
  }

  const deleteAccount = async () => {
    setDeleting(true)
    setError(null)
    try {
      const res = await fetch('/api/account', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirm: 'DELETE' }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Deletion failed')
      }
      // The Clerk user is gone — end the local session and go home.
      await signOut({ redirectUrl: '/' })
    } catch (e) {
      setError(e.message)
      setDeleting(false)
    }
  }

  return (
    <div className="min-h-screen bg-app">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10">

        <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-ink-soft hover:text-sage-700 transition-colors mb-8">
          <ArrowLeft className="h-4 w-4" /> Back to Penny Sprout
        </Link>

        <h1 className="text-2xl sm:text-3xl font-bold text-ink tracking-tight mb-1">Settings</h1>
        <p className="text-sm text-ink-soft mb-8">
          Signed in as {user.emailAddresses[0]?.emailAddress}
        </p>

        <div className="space-y-4">

          {/* Export */}
          <div className="bg-surface border border-line rounded-2xl shadow-sm p-6">
            <div className="flex items-center gap-2 mb-1">
              <Download className="h-4 w-4 text-sage-500" />
              <h2 className="text-sm font-semibold text-ink">Export your data</h2>
            </div>
            <p className="text-sm text-ink-soft mb-4">
              Download every transaction as a CSV — dates, descriptions, amounts, categories, and your notes.
              Your data is yours; take it anytime.
            </p>
            <a href="/api/export" download
              className="inline-flex items-center gap-2 px-4 py-2 bg-sage-600 hover:bg-sage-700 text-white text-sm font-semibold rounded-lg transition-colors">
              <Download className="h-4 w-4" /> Download CSV
            </a>
          </div>

          {/* Billing */}
          <div className="bg-surface border border-line rounded-2xl shadow-sm p-6">
            <div className="flex items-center gap-2 mb-1">
              <CreditCard className="h-4 w-4 text-sage-500" />
              <h2 className="text-sm font-semibold text-ink">Plan & billing</h2>
            </div>
            <p className="text-sm text-ink-soft mb-4">
              View plans, upgrade, or manage your subscription and invoices.
            </p>
            <Link href="/pricing"
              className="inline-flex items-center gap-2 px-4 py-2 border border-sage-300 text-sage-700 hover:bg-sage-50 text-sm font-semibold rounded-lg transition-colors">
              Open pricing & billing
            </Link>
          </div>

          {/* Danger zone */}
          <div className="bg-surface border border-peach-200 rounded-2xl shadow-sm p-6">
            <div className="flex items-center gap-2 mb-1">
              <AlertTriangle className="h-4 w-4 text-peach-600" />
              <h2 className="text-sm font-semibold text-ink">Delete account</h2>
            </div>
            <p className="text-sm text-ink-soft mb-4">
              Permanently deletes your login and every transaction, file, budget, goal, and analysis —
              immediately, with no recovery. Any active subscription is canceled first.
              Consider downloading your CSV export before you do this.
            </p>

            {error && (
              <div role="alert" className="mb-4 bg-peach-50 border border-peach-200 text-peach-600 text-sm rounded-xl px-4 py-3">
                {error}
              </div>
            )}

            <label htmlFor="confirm-delete" className="block text-xs font-medium text-ink-faint mb-1">
              Type <span className="font-mono font-semibold text-ink">DELETE</span> to confirm
            </label>
            <div className="flex flex-wrap gap-2">
              <input
                id="confirm-delete"
                type="text"
                value={confirmText}
                onChange={e => setConfirmText(e.target.value)}
                placeholder="DELETE"
                className="w-40 text-sm border border-line rounded-lg px-3 py-2 bg-surface text-ink font-mono"
                autoComplete="off"
              />
              <button
                onClick={deleteAccount}
                disabled={confirmText !== 'DELETE' || deleting}
                className="inline-flex items-center gap-2 px-4 py-2 bg-peach-600 hover:opacity-90 text-white text-sm font-semibold rounded-lg transition-opacity disabled:opacity-40 disabled:cursor-not-allowed">
                <Trash2 className="h-4 w-4" />
                {deleting ? 'Deleting…' : 'Delete my account'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
