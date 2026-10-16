'use client'
import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useUser, SignInButton, UserButton } from '@clerk/nextjs'
import {
  FolderOpen, BarChart2, CalendarDays, LayoutGrid, Sparkles, ArrowRight, Target, Settings,
  Sprout, ShieldCheck, TrendingUp, ShoppingBag, Coffee, Zap,
} from 'lucide-react'
import FileUpload from './components/FileUpload'
import ConnectedAccounts from './components/ConnectedAccounts'
import SpendingDashboard from './components/SpendingDashboard'
import UserFiles from './components/UserFiles'
import SpendingCalendar from './components/SpendingCalendar'
import Overview from './components/Overview'
import Budgets from './components/Budgets'
import TransactionSearchWidget from './components/TransactionSearchWidget'
import Spinner from './components/ui/Spinner'
import ThemeToggle from './components/ui/ThemeToggle'
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
            <SignInButton mode="modal">
              <button className={buttonClass({ variant: 'primary', size: 'lg', className: 'group' })}>
                Start free
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" aria-hidden="true" />
              </button>
            </SignInButton>
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

// ─── Main app ─────────────────────────────────────────────────────────────────

const NAV_ITEMS = [
  { id: 'overview',  label: 'Overview', Icon: LayoutGrid   },
  { id: 'calendar',  label: 'Calendar', Icon: CalendarDays },
  { id: 'dashboard', label: 'Analysis', Icon: BarChart2    },
  { id: 'budgets',   label: 'Budgets',  Icon: Target       },
  { id: 'files',     label: 'Files',    Icon: FolderOpen   },
]

const VALID_VIEWS = NAV_ITEMS.map(i => i.id)
const viewFromUrl = () => {
  const params = new URLSearchParams(window.location.search)
  // Plaid's OAuth redirect (see app/components/usePlaidLinkFlow.js) lands
  // the whole page back at the registered redirect_uri — the site root,
  // with no ?tab= of its own — carrying ?oauth_state_id=... instead. The
  // Connect-a-bank UI that needs to catch that and resume Link lives on the
  // Files tab, so force it here regardless of any other tab param.
  if (params.has('oauth_state_id')) return 'files'
  const tab = params.get('tab')
  if (tab === 'upload') return 'files' // upload merged into Files; keep old links working
  return VALID_VIEWS.includes(tab) ? tab : 'overview'
}

function Brand() {
  return (
    <div className="flex min-w-0 items-center gap-2">
      <Image src="/sprout-svgrepo-com.svg" alt="" width={30} height={30} className="h-8 w-8 flex-shrink-0" />
      <span className="truncate font-display text-xl font-bold text-ink">Penny Sprout</span>
    </div>
  )
}

function ProLink({ className = '' }) {
  if (billingHidden) return null
  return (
    <Link
      href="/pricing"
      className={`inline-flex min-h-11 items-center gap-1.5 rounded-full bg-lime px-4 text-sm font-bold text-lime-ink transition hover:brightness-95 ${className}`}
    >
      <Sparkles className="h-4 w-4" aria-hidden="true" /> Go Pro
    </Link>
  )
}

const SettingsLink = () => (
  <Link
    href="/settings"
    aria-label="Settings"
    title="Settings"
    className="flex h-11 w-11 items-center justify-center rounded-full text-ink-faint transition-colors hover:bg-surface-hover hover:text-ink"
  >
    <Settings className="h-5 w-5" />
  </Link>
)

export default function Home() {
  const { isSignedIn, user, isLoaded } = useUser()

  // The active tab lives in the URL (?tab=calendar) so refresh, back/forward,
  // and shared links all land on the right view. State mirrors the URL; it's
  // read in an effect (not the initializer) so server and client first-render
  // the same markup.
  const [activeView, setActiveViewState] = useState('overview')
  // Bumped after each successful upload batch to remount (and so refetch) the
  // file list that sits below the dropzone on the Files tab.
  const [filesRefresh, setFilesRefresh] = useState(0)

  useEffect(() => {
    setActiveViewState(viewFromUrl())
    const onPop = () => setActiveViewState(viewFromUrl())
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  const setActiveView = useCallback((id) => {
    setActiveViewState(id)
    const url = id === 'overview'
      ? window.location.pathname
      : `${window.location.pathname}?tab=${id}`
    window.history.pushState(null, '', url)
  }, [])

  if (!isLoaded) return <Spinner className="min-h-screen bg-app" />

  if (!isSignedIn) return <LandingPage />

  const displayName = user.firstName || user.emailAddresses[0].emailAddress

  return (
    <div className="min-h-screen bg-app lg:pl-64">

      {/* ── Desktop sidebar (lg+) ──
           Predictable app layout: brand, primary nav, then account controls
           pinned to the bottom. The active item is the dark forest pill with
           a lime icon — the same pairing as the Overview hero card. */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-line bg-surface px-4 py-5 lg:flex">
        <div className="px-2"><Brand /></div>

        <nav aria-label="Primary" className="mt-8 flex flex-col gap-1">
          {NAV_ITEMS.map(({ id, label, Icon }) => {
            const active = activeView === id
            return (
              <button
                key={id}
                onClick={() => setActiveView(id)}
                aria-current={active ? 'page' : undefined}
                className={`flex min-h-12 items-center gap-3 rounded-full px-4 text-[15px] font-semibold transition-colors ${
                  active
                    ? 'hero-card !rounded-full !shadow-none text-hero'
                    : 'text-ink-soft hover:bg-surface-hover hover:text-ink'
                }`}
              >
                <Icon className={`h-5 w-5 ${active ? 'text-lime' : ''}`} aria-hidden="true" />
                {label}
              </button>
            )
          })}
        </nav>

        <div className="mt-auto space-y-3">
          <ProLink className="w-full justify-center" />
          <div className="flex items-center gap-2 rounded-full bg-surface-2 p-1.5 pl-2">
            <UserButton />
            <span className="min-w-0 flex-1 truncate text-sm font-semibold text-ink">{displayName}</span>
            <SettingsLink />
            <ThemeToggle />
          </div>
        </div>
      </aside>

      {/* ── Top bar (below lg) ── */}
      <header className="sticky top-0 z-40 border-b border-line bg-surface/90 backdrop-blur-md lg:hidden">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-2 px-4 sm:px-6">
          <Brand />
          <div className="flex flex-shrink-0 items-center gap-1">
            <ProLink className="hidden sm:inline-flex" />
            <SettingsLink />
            <ThemeToggle />
            <div className="pl-1"><UserButton /></div>
          </div>
        </div>

        {/* Tablet nav — a segmented pill control */}
        <nav aria-label="Primary" className="mx-auto hidden max-w-6xl px-4 pb-3 sm:block sm:px-6">
          <div className="inline-flex gap-1 rounded-full bg-surface-2 p-1">
            {NAV_ITEMS.map(({ id, label, Icon }) => {
              const active = activeView === id
              return (
                <button
                  key={id}
                  onClick={() => setActiveView(id)}
                  aria-current={active ? 'page' : undefined}
                  className={`inline-flex min-h-11 items-center gap-2 rounded-full px-4 text-sm font-semibold transition-colors ${
                    active ? 'bg-surface text-ink shadow-soft' : 'text-ink-faint hover:text-ink'
                  }`}
                >
                  <Icon className={`h-4 w-4 ${active ? 'text-sage-600' : ''}`} aria-hidden="true" />
                  {label}
                </button>
              )
            })}
          </div>
        </nav>
      </header>

      {/* ── Page content ── */}
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 pb-32 sm:px-6 sm:py-8 sm:pb-10 lg:px-10 lg:py-10">
        {/* key remounts the wrapper per tab so each switch gets a soft entrance */}
        <div key={activeView} className="animate-page-in">

          {activeView === 'overview' && (
            <Overview
              onOpenCalendar={() => setActiveView('calendar')}
              onOpenUpload={() => setActiveView('files')}
              onOpenAnalysis={() => setActiveView('dashboard')}
              onOpenBudgets={() => setActiveView('budgets')}
            />
          )}

          {/* Upload lives at the top of Files — one tab for bringing data in
              and managing it. Remounting UserFiles via key refreshes the list
              after each successful upload batch. */}
          {activeView === 'files' && (
            <div className="space-y-6">
              <ConnectedAccounts />
              <FileUpload onDataLoaded={() => setFilesRefresh(k => k + 1)} userId={user.id} />
              <UserFiles key={filesRefresh} userId={user.id} />
            </div>
          )}

          {activeView === 'calendar' && <SpendingCalendar />}

          {activeView === 'dashboard' && <SpendingDashboard />}

          {activeView === 'budgets' && <Budgets />}
        </div>
      </main>

      {/* Floating search widget — docked bottom-right, available from every
          tab so finding a transaction never requires navigating away first. */}
      <TransactionSearchWidget />

      {/* ── Mobile bottom nav ──
           A floating dark dock: 5 targets, each at least 56px tall, active tab
           marked by a lime pill *and* a bolder label (never color alone).
           Lifted above the home-indicator inset on modern phones. */}
      <nav
        aria-label="Primary"
        className="fixed inset-x-3 z-40 sm:hidden"
        style={{ bottom: 'calc(env(safe-area-inset-bottom) + 0.75rem)' }}
      >
        <div className="hero-card flex !rounded-full border border-hero p-1.5">
          {NAV_ITEMS.map(({ id, label, Icon }) => {
            const active = activeView === id
            return (
              <button
                key={id}
                onClick={() => setActiveView(id)}
                aria-current={active ? 'page' : undefined}
                className={`flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 rounded-full transition-colors ${
                  active ? 'bg-lime text-lime-ink' : 'text-hero-soft'
                }`}
              >
                <Icon className="h-5 w-5" aria-hidden="true" />
                <span className={`text-xs ${active ? 'font-bold' : 'font-medium'}`}>{label}</span>
              </button>
            )
          })}
        </div>
      </nav>

    </div>
  )
}
