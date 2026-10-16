'use client'
import Link from 'next/link'
import Image from 'next/image'
import { useUser, SignInButton } from '@clerk/nextjs'
import { Sparkles, ArrowRight, Sprout, ShieldCheck, TrendingUp, Coffee, Zap, CalendarDays, Eye } from 'lucide-react'
import AppShell from './components/AppShell'
import Spinner from './components/ui/Spinner'
import { buttonClass } from './components/ui/Button'
import { billingHidden } from '@/lib/billingFlag'

// ─── Landing page ─────────────────────────────────────────────────────────────
// The marketing surface: a bold headline, ONE primary action (start free), and
// a product preview built from the same hero-card the signed-in Overview uses,
// so what people see here is what they get.

// Static preview bars for the hero mock — illustrative only, aria-hidden.
const PREVIEW_BARS = [38, 52, 44, 70, 58, 82, 64]

function ProductPreview() {
  return (
    <div aria-hidden="true" className="relative mx-auto w-full max-w-sm select-none">
      <div className="hero-card p-6">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-hero-soft">Net flow · October</span>
          <span className="rounded-full bg-lime px-2.5 py-1 text-xs font-bold text-lime-ink">+12%</span>
        </div>
        <p className="mt-2 font-display text-5xl font-bold tnum text-hero">+$1,248</p>
        <div className="mt-6 flex h-24 items-end gap-2">
          {PREVIEW_BARS.map((h, i) => (
            <span
              key={i}
              className={`flex-1 rounded-full ${i === PREVIEW_BARS.length - 2 ? 'bg-lime' : 'bg-hero-tile'}`}
              style={{ height: `${h}%` }}
            />
          ))}
        </div>
        <div className="mt-5 grid grid-cols-3 gap-2">
          {[['In', '$4,820'], ['Spent', '$2,310'], ['Bills', '$1,262']].map(([k, v]) => (
            <div key={k} className="rounded-[var(--radius-md)] bg-hero-tile px-3 py-2.5">
              <p className="text-xs text-hero-soft">{k}</p>
              <p className="text-sm font-bold tnum text-hero">{v}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Floating transaction chips */}
      <div className="card-soft absolute -left-10 bottom-28 hidden items-center gap-3 px-4 py-3 shadow-lift sm:flex animate-float">
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-spend-100">
          <Coffee className="h-4 w-4 text-spend-600" />
        </span>
        <div>
          <p className="text-xs text-ink-faint">Blue Bottle</p>
          <p className="text-sm font-bold tnum text-ink">−$6.50</p>
        </div>
      </div>
      <div className="card-soft absolute -right-8 -bottom-7 hidden items-center gap-3 px-4 py-3 shadow-lift sm:flex animate-float delay-300">
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-sage-50">
          <TrendingUp className="h-4 w-4 text-sage-600" />
        </span>
        <div>
          <p className="text-xs text-ink-faint">Savings goal</p>
          <p className="text-sm font-bold tnum text-ink">68% there</p>
        </div>
      </div>
    </div>
  )
}

function LandingPage() {
  const features = [
    { Icon: CalendarDays, title: 'Your money, on a calendar', desc: 'Bills, paychecks and spending laid across the month.' },
    { Icon: Sparkles,     title: 'Ask Penny anything',       desc: 'Plain-language answers from your real transactions.' },
    { Icon: Sprout,       title: 'Budgets that grow with you', desc: 'Gentle nudges, never a lecture about your latte.' },
  ]

  return (
    <div className="min-h-screen bg-app flex flex-col">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
        <div className="flex items-center gap-2">
          <Image src="/sprout-svgrepo-com.svg" alt="" width={32} height={32} className="h-8 w-8" />
          <span className="font-display text-xl font-bold text-ink">Penny Sprout</span>
        </div>
        <SignInButton mode="modal">
          <button className={buttonClass({ variant: 'ghost', size: 'sm' })}>Sign in</button>
        </SignInButton>
      </header>

      <main className="mx-auto grid w-full max-w-6xl flex-1 items-center gap-12 px-4 pb-16 pt-6 sm:px-6 lg:grid-cols-2 lg:gap-8 lg:pt-10">
        <div className="text-center lg:text-left">
          <span className="animate-fade-up inline-flex items-center gap-2 rounded-full bg-lime-soft px-3 py-1.5 text-xs font-semibold text-sage-700">
            <Zap className="h-3.5 w-3.5" aria-hidden="true" /> Powered by Claude AI
          </span>
          <h1 className="animate-fade-up delay-100 mt-5 font-display text-5xl font-bold leading-[1.02] text-ink sm:text-6xl lg:text-7xl">
            Watch every penny <span className="text-sage-500">grow.</span>
          </h1>
          <p className="animate-fade-up delay-200 mx-auto mt-5 max-w-md text-lg leading-relaxed text-ink-soft lg:mx-0">
            Upload a statement or connect your bank. See where your money goes, and keep more of it.
          </p>

          <div className="animate-fade-up delay-300 mt-8 flex flex-col items-center gap-3 lg:items-start">
            <div className="flex flex-wrap items-center justify-center gap-3 lg:justify-start">
              <SignInButton mode="modal">
                <button className={buttonClass({ variant: 'primary', size: 'lg', className: 'group' })}>
                  Start free
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" aria-hidden="true" />
                </button>
              </SignInButton>
              <Link href="/demo" className={buttonClass({ variant: 'secondary', size: 'lg' })}>
                <Eye className="h-4 w-4" aria-hidden="true" />
                Try the demo
              </Link>
            </div>
            <p className="flex items-center gap-1.5 text-sm text-ink-faint">
              <ShieldCheck className="h-4 w-4" aria-hidden="true" /> No credit card. No bank login required.
            </p>
          </div>
        </div>

        <div className="animate-fade-up delay-200 px-6 lg:px-10">
          <ProductPreview />
        </div>
      </main>

      <section aria-label="Features" className="mx-auto grid w-full max-w-6xl grid-cols-1 gap-4 px-4 pb-14 sm:grid-cols-3 sm:px-6">
        {features.map(({ Icon, title, desc }) => (
          <div key={title} className="card-soft p-6">
            <span className="mb-4 flex h-11 w-11 items-center justify-center rounded-[var(--radius-md)] bg-lime">
              <Icon className="h-5 w-5 text-lime-ink" aria-hidden="true" />
            </span>
            <h2 className="text-base font-bold text-ink">{title}</h2>
            <p className="mt-1 text-sm leading-relaxed text-ink-soft">{desc}</p>
          </div>
        ))}
      </section>

      <footer className="border-t border-line">
        <nav aria-label="Legal" className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-6 px-4 py-4 text-sm text-ink-faint sm:px-6">
          <Link href="/privacy" className="inline-flex min-h-11 items-center hover:text-ink">Privacy</Link>
          {!billingHidden && <Link href="/pricing" className="inline-flex min-h-11 items-center hover:text-ink">Pricing</Link>}
          <Link href="/terms" className="inline-flex min-h-11 items-center hover:text-ink">Terms</Link>
        </nav>
      </footer>
    </div>
  )
}

export default function Home() {
  const { isSignedIn, user, isLoaded } = useUser()

  if (!isLoaded) return <Spinner className="min-h-screen bg-app" />

  if (!isSignedIn) return <LandingPage />

  const displayName = user.firstName || user.emailAddresses[0].emailAddress
  return <AppShell displayName={displayName} userId={user.id} />
}
