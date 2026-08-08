'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useUser, SignInButton } from '@clerk/nextjs'
import { Check, Sparkles, ArrowLeft, CreditCard } from 'lucide-react'
import Button, { buttonClass } from '../components/ui/Button'
import Doodle from '../components/ui/Doodle'
import { Banner } from '../components/ui/Field'

// Pricing page: free vs Pro. The Pro price here is display copy — the amount
// actually charged is the Stripe Price (STRIPE_PRICE_ID); keep the two in sync.
const FREE_FEATURES = [
  'Unlimited statement uploads (CSV)',
  '20 PDF statement extractions per day',
  '30 AI chat questions per day',
  'Budgets & savings goals',
  'Spending calendar & insights dashboard',
  'Privacy-first: no bank login required, ever',
]

const PRO_FEATURES = [
  'Everything in Free',
  '100 PDF statement extractions per day',
  '200 AI chat questions per day',
  'Priority support',
  'Early access to new features',
]

export default function PricingPage() {
  const { isSignedIn, isLoaded } = useUser()
  const [billing, setBilling] = useState(null) // { enabled, plan, ... }
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [justUpgraded, setJustUpgraded] = useState(false)

  useEffect(() => {
    setJustUpgraded(new URLSearchParams(window.location.search).get('upgraded') === '1')
  }, [])

  useEffect(() => {
    if (!isSignedIn) return
    fetch('/api/billing/status')
      .then(res => (res.ok ? res.json() : null))
      .then(data => setBilling(data))
      .catch(() => setBilling(null))
  }, [isSignedIn])

  const startCheckout = async () => {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/billing/checkout', { method: 'POST' })
      const data = await res.json()
      if (!res.ok || !data.url) throw new Error(data.error || 'checkout failed')
      window.location.assign(data.url)
    } catch (e) {
      setError(
        e.message === 'Billing is not configured'
          ? 'Billing is not set up on this deployment yet.'
          : "Couldn't start checkout — try again in a moment."
      )
      setBusy(false)
    }
  }

  const openPortal = async () => {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/billing/portal', { method: 'POST' })
      const data = await res.json()
      if (!res.ok || !data.url) throw new Error(data.error || 'portal failed')
      window.location.assign(data.url)
    } catch {
      setError("Couldn't open the billing portal — try again in a moment.")
      setBusy(false)
    }
  }

  const isPro = billing?.plan === 'pro'

  return (
    <div className="relative min-h-screen overflow-hidden bg-app">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div className="absolute -left-24 top-24 h-64 w-64 rounded-full bg-sage-100 opacity-40" />
        <div className="absolute -right-20 bottom-16 h-56 w-56 rounded-full bg-spend-100 opacity-40" />
      </div>

      <div className="relative mx-auto max-w-3xl px-4 py-10 sm:px-6">

        <Link
          href="/"
          className="mb-8 inline-flex min-h-10 items-center gap-1.5 text-sm font-medium text-ink-soft transition-colors hover:text-sage-700"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Back to Penny Sprout
        </Link>

        <div className="mb-10 text-center">
          <Image src="/sprout-svgrepo-com.svg" alt="" width={56} height={56} className="mx-auto mb-4 h-13 w-13" />
          <h1 className="mb-2 font-display text-3xl font-bold tracking-tight text-ink sm:text-4xl">Simple pricing</h1>
          <p className="mx-auto max-w-md text-base leading-relaxed text-ink-soft">
            Start free. Upgrade when you want more room to grow — either way, your bank login stays yours.
          </p>
        </div>

        {justUpgraded && (
          <Banner tone="success" role="status" className="mb-6">
            <span className="font-semibold">Welcome to Pro! 🌱</span> Your upgrade is processing —
            it may take a few seconds to show up.
          </Banner>
        )}

        {error && <Banner tone="error" role="alert" className="mb-6">{error}</Banner>}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">

          {/* Free */}
          <div className="card-soft flex flex-col p-6">
            <div className="mb-1 flex items-center gap-2">
              <Doodle name="sprout" className="h-5 w-5 text-sage-500" />
              <h2 className="text-lg font-bold text-ink">Sprout</h2>
            </div>
            <p className="mb-4 text-sm text-ink-soft">Everything you need to see your money clearly.</p>
            <p className="mb-6">
              <span className="text-4xl font-bold tnum text-ink">$0</span>
              <span className="text-sm text-ink-faint"> / forever</span>
            </p>
            <ul className="mb-6 flex-1 space-y-3">
              {FREE_FEATURES.map(f => (
                <li key={f} className="flex items-start gap-2.5 text-sm leading-relaxed text-ink-soft">
                  <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-sage-500" aria-hidden="true" /> {f}
                </li>
              ))}
            </ul>
            {isLoaded && !isSignedIn ? (
              <SignInButton mode="modal">
                <button className={buttonClass({ variant: 'secondary', full: true })}>Get started free</button>
              </SignInButton>
            ) : (
              <p className="py-2.5 text-center text-sm font-medium text-ink-faint">
                {isPro ? 'Included in your plan' : 'Your current plan'}
              </p>
            )}
          </div>

          {/* Pro */}
          <div className="relative flex flex-col rounded-[var(--radius-lg)] border-2 border-sage-400 bg-surface p-6 shadow-soft">
            <span className="absolute -top-3 left-1/2 inline-flex -translate-x-1/2 items-center gap-1 rounded-full bg-sage-600 px-3 py-1 text-xs font-semibold text-white">
              <Sparkles className="h-3 w-3" aria-hidden="true" /> Pro
            </span>
            <div className="mb-1 flex items-center gap-2">
              <Doodle name="tulip" className="h-5 w-5 text-sage-500" />
              <h2 className="text-lg font-bold text-ink">Sprout Pro</h2>
            </div>
            <p className="mb-4 text-sm text-ink-soft">More headroom for power users and heavy months.</p>
            <p className="mb-6">
              <span className="text-4xl font-bold tnum text-ink">$5</span>
              <span className="text-sm text-ink-faint"> / month</span>
            </p>
            <ul className="mb-6 flex-1 space-y-3">
              {PRO_FEATURES.map(f => (
                <li key={f} className="flex items-start gap-2.5 text-sm leading-relaxed text-ink-soft">
                  <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-sage-500" aria-hidden="true" /> {f}
                </li>
              ))}
            </ul>
            {isLoaded && !isSignedIn ? (
              <SignInButton mode="modal">
                <button className={buttonClass({ full: true })}>Sign in to upgrade</button>
              </SignInButton>
            ) : isPro ? (
              <Button variant="secondary" full onClick={openPortal} disabled={busy}>
                <CreditCard className="h-4 w-4" aria-hidden="true" /> Manage billing
              </Button>
            ) : (
              <Button full onClick={startCheckout} disabled={busy || billing?.enabled === false}>
                {busy ? 'Opening checkout…' : 'Upgrade to Pro'}
              </Button>
            )}
            {billing?.enabled === false && (
              <p className="mt-2 text-center text-xs text-ink-faint">Billing isn&apos;t configured on this deployment yet.</p>
            )}
            {isPro && billing?.cancelAtPeriodEnd && (
              <p className="mt-2 text-center text-xs text-ink-faint">
                Your plan ends {billing.currentPeriodEnd ? new Date(billing.currentPeriodEnd).toLocaleDateString() : 'at the end of the period'}.
              </p>
            )}
          </div>
        </div>

        <p className="mt-8 text-center text-sm leading-relaxed text-ink-faint">
          Cancel anytime from the billing portal. Payments handled by Stripe — card details never touch our servers.
        </p>
      </div>
    </div>
  )
}
