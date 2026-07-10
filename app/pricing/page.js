'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useUser, SignInButton } from '@clerk/nextjs'
import { Check, Sparkles, ArrowLeft, CreditCard } from 'lucide-react'

// Pricing page: free vs Pro. The Pro price here is display copy — the amount
// actually charged is the Stripe Price (STRIPE_PRICE_ID); keep the two in sync.
const FREE_FEATURES = [
  'Unlimited statement uploads (CSV)',
  '20 PDF statement extractions per day',
  '30 AI analyses per day',
  'Budgets & savings goals',
  'Spending calendar & insights dashboard',
  'Privacy-first: no bank login required, ever',
]

const PRO_FEATURES = [
  'Everything in Free',
  '100 PDF statement extractions per day',
  '200 AI analyses per day',
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
    <div className="min-h-screen bg-app">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10">

        <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-ink-soft hover:text-sage-700 transition-colors mb-8">
          <ArrowLeft className="h-4 w-4" /> Back to Penny Sprout
        </Link>

        <div className="text-center mb-10">
          <Image src="/sprout-svgrepo-com.svg" alt="" width={48} height={48} className="w-12 h-12 mx-auto mb-3" />
          <h1 className="text-3xl sm:text-4xl font-bold text-ink tracking-tight mb-2">Simple pricing</h1>
          <p className="text-sm sm:text-base text-ink-soft max-w-md mx-auto">
            Start free. Upgrade if you want more room to grow — either way, your bank login stays yours.
          </p>
        </div>

        {justUpgraded && (
          <div role="status" className="mb-6 bg-sage-50 border border-sage-200 text-sage-800 text-sm rounded-xl px-4 py-3 text-center">
            🌱 Welcome to Pro! Your upgrade is processing — it may take a few seconds to show up.
          </div>
        )}

        {error && (
          <div role="alert" className="mb-6 bg-peach-50 border border-peach-200 text-peach-600 text-sm rounded-xl px-4 py-3 text-center">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

          {/* Free */}
          <div className="bg-surface border border-line rounded-2xl shadow-sm p-6 flex flex-col">
            <h2 className="text-lg font-bold text-ink">Sprout</h2>
            <p className="text-sm text-ink-soft mb-4">Everything you need to see your money clearly.</p>
            <p className="mb-5"><span className="text-3xl font-bold text-ink">$0</span><span className="text-sm text-ink-faint"> / forever</span></p>
            <ul className="space-y-2.5 mb-6 flex-1">
              {FREE_FEATURES.map(f => (
                <li key={f} className="flex items-start gap-2 text-sm text-ink-soft">
                  <Check className="h-4 w-4 text-sage-500 mt-0.5 flex-shrink-0" /> {f}
                </li>
              ))}
            </ul>
            {isLoaded && !isSignedIn ? (
              <SignInButton mode="modal">
                <button className="w-full px-5 py-2.5 border border-sage-300 text-sage-700 hover:bg-sage-50 text-sm font-semibold rounded-xl transition-colors">
                  Get started free
                </button>
              </SignInButton>
            ) : (
              <p className="text-center text-sm font-medium text-ink-faint py-2.5">
                {isPro ? 'Included in your plan' : 'Your current plan'}
              </p>
            )}
          </div>

          {/* Pro */}
          <div className="bg-surface border-2 border-sage-400 rounded-2xl shadow-sm p-6 flex flex-col relative">
            <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-sage-600 text-white text-xs font-semibold px-3 py-1 rounded-full inline-flex items-center gap-1">
              <Sparkles className="h-3 w-3" /> Pro
            </span>
            <h2 className="text-lg font-bold text-ink">Sprout Pro</h2>
            <p className="text-sm text-ink-soft mb-4">More headroom for power users and heavy months.</p>
            <p className="mb-5"><span className="text-3xl font-bold text-ink">$5</span><span className="text-sm text-ink-faint"> / month</span></p>
            <ul className="space-y-2.5 mb-6 flex-1">
              {PRO_FEATURES.map(f => (
                <li key={f} className="flex items-start gap-2 text-sm text-ink-soft">
                  <Check className="h-4 w-4 text-sage-500 mt-0.5 flex-shrink-0" /> {f}
                </li>
              ))}
            </ul>
            {isLoaded && !isSignedIn ? (
              <SignInButton mode="modal">
                <button className="w-full px-5 py-2.5 bg-sage-600 hover:bg-sage-700 text-white text-sm font-semibold rounded-xl transition-colors">
                  Sign in to upgrade
                </button>
              </SignInButton>
            ) : isPro ? (
              <button onClick={openPortal} disabled={busy}
                className="w-full inline-flex items-center justify-center gap-2 px-5 py-2.5 border border-sage-300 text-sage-700 hover:bg-sage-50 text-sm font-semibold rounded-xl transition-colors disabled:opacity-60">
                <CreditCard className="h-4 w-4" /> Manage billing
              </button>
            ) : (
              <button onClick={startCheckout} disabled={busy || billing?.enabled === false}
                className="w-full px-5 py-2.5 bg-sage-600 hover:bg-sage-700 text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-60">
                {busy ? 'Opening checkout…' : 'Upgrade to Pro'}
              </button>
            )}
            {billing?.enabled === false && (
              <p className="text-xs text-ink-faint text-center mt-2">Billing isn&apos;t configured on this deployment yet.</p>
            )}
            {isPro && billing?.cancelAtPeriodEnd && (
              <p className="text-xs text-ink-faint text-center mt-2">
                Your plan ends {billing.currentPeriodEnd ? new Date(billing.currentPeriodEnd).toLocaleDateString() : 'at the end of the period'}.
              </p>
            )}
          </div>
        </div>

        <p className="text-center text-xs text-ink-faint mt-8">
          Cancel anytime from the billing portal. Payments handled by Stripe — card details never touch our servers.
        </p>
      </div>
    </div>
  )
}
