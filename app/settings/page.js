'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useUser, useClerk } from '@clerk/nextjs'
import { ArrowLeft, Download, CreditCard, Trash2, AlertTriangle } from 'lucide-react'
import Spinner from '../components/ui/Spinner'
import Button, { buttonClass } from '../components/ui/Button'
import { inputClass, Banner } from '../components/ui/Field'

// Settings: data export, billing shortcut, and account deletion. Deletion is
// self-serve and immediate — the privacy policy's erasure promise, in-product
// instead of over email.
//
// This is the app's most restrained screen (~95% fintech): no doodles, no
// display face, no pastel accents beyond the palette's own surfaces. When a
// page can permanently delete someone's data, decoration is a liability.
export default function SettingsPage() {
  const { isSignedIn, isLoaded, user } = useUser()
  const { signOut } = useClerk()

  const [confirmText, setConfirmText] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState(null)

  if (!isLoaded) return <Spinner className="min-h-screen bg-app" />

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
      <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">

        <Link
          href="/"
          className="mb-8 inline-flex min-h-10 items-center gap-1.5 text-sm font-medium text-ink-soft transition-colors hover:text-sage-700"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Back to Penny Sprout
        </Link>

        <h1 className="mb-1 text-2xl font-bold tracking-tight text-ink sm:text-3xl">Settings</h1>
        <p className="mb-8 text-sm text-ink-soft">
          Signed in as {user.emailAddresses[0]?.emailAddress}
        </p>

        <div className="space-y-4">

          {/* Export */}
          <section className="card-soft p-5 sm:p-6">
            <div className="mb-1.5 flex items-center gap-2">
              <Download className="h-4 w-4 text-sage-500" aria-hidden="true" />
              <h2 className="text-base font-semibold text-ink">Export your data</h2>
            </div>
            <p className="mb-5 text-sm leading-relaxed text-ink-soft">
              Download every transaction as a CSV — dates, descriptions, amounts, categories, and your notes.
              Your data is yours; take it anytime.
            </p>
            <a href="/api/export" download className={buttonClass()}>
              <Download className="h-4 w-4" aria-hidden="true" /> Download CSV
            </a>
          </section>

          {/* Billing */}
          <section className="card-soft p-5 sm:p-6">
            <div className="mb-1.5 flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-sage-500" aria-hidden="true" />
              <h2 className="text-base font-semibold text-ink">Plan &amp; billing</h2>
            </div>
            <p className="mb-5 text-sm leading-relaxed text-ink-soft">
              View plans, upgrade, or manage your subscription and invoices.
            </p>
            <Link href="/pricing" className={buttonClass({ variant: 'secondary' })}>
              Open pricing &amp; billing
            </Link>
          </section>

          {/* Danger zone */}
          <section className="rounded-[var(--radius-lg)] border border-danger-200 bg-surface p-5 shadow-soft sm:p-6">
            <div className="mb-1.5 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-danger-600" aria-hidden="true" />
              <h2 className="text-base font-semibold text-ink">Delete account</h2>
            </div>
            <p className="mb-5 text-sm leading-relaxed text-ink-soft">
              Permanently deletes your login and every transaction, file, budget, goal, and analysis —
              immediately, with no recovery. Any active subscription is canceled and any connected
              bank is disconnected first. Consider downloading your CSV export before you do this.
            </p>

            {error && <Banner tone="error" role="alert" className="mb-5">{error}</Banner>}

            <label htmlFor="confirm-delete" className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-ink-faint">
              Type <span className="font-mono font-bold text-ink">DELETE</span> to confirm
            </label>
            <div className="flex flex-wrap gap-2">
              <input
                id="confirm-delete"
                type="text"
                value={confirmText}
                onChange={e => setConfirmText(e.target.value)}
                placeholder="DELETE"
                className={inputClass('w-40 font-mono')}
                autoComplete="off"
              />
              <Button
                variant="danger"
                onClick={deleteAccount}
                disabled={confirmText !== 'DELETE' || deleting}
              >
                <Trash2 className="h-4 w-4" aria-hidden="true" />
                {deleting ? 'Deleting…' : 'Delete my account'}
              </Button>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
