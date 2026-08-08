'use client'
import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useUser, SignInButton, UserButton } from '@clerk/nextjs'
import { FolderOpen, BarChart2, CalendarDays, LayoutGrid, Sparkles, ArrowRight, Target, Settings } from 'lucide-react'
import FileUpload from './components/FileUpload'
import SpendingDashboard from './components/SpendingDashboard'
import UserFiles from './components/UserFiles'
import SpendingCalendar from './components/SpendingCalendar'
import Overview from './components/Overview'
import Budgets from './components/Budgets'
import Spinner from './components/ui/Spinner'
import ThemeToggle from './components/ui/ThemeToggle'
import Doodle from './components/ui/Doodle'
import { buttonClass } from './components/ui/Button'

// ─── Landing page ─────────────────────────────────────────────────────────────
// The most decorated surface in the product (~90% aesthetic): this is where
// the stationery identity gets to lead. Everything past sign-in tightens up.

function LandingPage() {
  const features = [
    {
      doodle: 'flower', tint: 'bg-spend-100', title: 'Your money, on a calendar',
      desc: 'Bills, paychecks, and spending laid across the month like entries in a planner.',
    },
    {
      doodle: 'sparkle', tint: 'bg-lavender-100', title: 'Ask Penny anything',
      desc: 'A friendly companion that reads your real transactions and answers in plain language.',
    },
    {
      doodle: 'sprout', tint: 'bg-sage-100', title: 'Watch your savings grow',
      desc: 'Budgets and goals you nurture — gentle nudges, never a lecture about your latte.',
    },
  ]

  return (
    <div className="min-h-screen bg-app relative overflow-hidden flex flex-col">

      {/* ── Botanical decoration — low opacity, pinned to the margins so it
             never sits behind the headline or the call to action ── */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div className="absolute -left-24 top-[22%] h-72 w-72 rounded-full bg-sage-100 opacity-50" />
        <div className="absolute -right-20 bottom-[8%] h-64 w-64 rounded-full bg-spend-100 opacity-50" />
        <div className="absolute right-[6%] top-[6%] h-40 w-40 rounded-full bg-butter-50 opacity-70" />
        <Doodle name="sprig"   className="absolute left-[6%] top-[12%] h-10 w-10 text-sage-300 -rotate-12" />
        <Doodle name="sparkle" className="absolute right-[14%] top-[30%] h-6 w-6 text-butter-500 opacity-70" />
        <Doodle name="leaf"    className="absolute left-[16%] bottom-[16%] h-8 w-8 text-sage-300 rotate-12 opacity-70" />
        <Doodle name="cloud"   className="absolute right-[10%] bottom-[26%] h-9 w-9 text-blue-300 opacity-60" />
      </div>

      {/* ── Hero ── */}
      <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-6 pb-16 pt-14 text-center sm:pt-20">

        <div className="mb-5 animate-float">
          <Image src="/sprout-svgrepo-com.svg" alt="Penny Sprout" width={88} height={88} priority className="h-20 w-20 sm:h-22 sm:w-22" />
        </div>

        <h1 className="animate-fade-up font-display text-5xl font-bold tracking-tight text-ink sm:text-6xl">
          Penny <span className="text-sage-600">Sprout</span>
        </h1>

        <p className="animate-fade-up delay-100 mt-4 max-w-md text-base leading-relaxed text-ink-soft sm:text-lg">
          Managing your money, but it feels like opening a beautifully kept planner.
          Upload your statements and watch your financial picture grow.
        </p>

        <div className="animate-fade-up delay-200 mt-9">
          <SignInButton mode="modal">
            <button className={buttonClass({ size: 'lg', className: 'group shadow-soft hover:-translate-y-0.5 active:translate-y-0' })}>
              Start growing — free
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" aria-hidden="true" />
            </button>
          </SignInButton>
          <p className="mt-3 text-sm text-ink-faint">No credit card. No bank login. Ever.</p>
        </div>

        {/* Feature cards */}
        <div className="animate-fade-up delay-300 mt-14 grid w-full max-w-3xl grid-cols-1 gap-4 sm:grid-cols-3">
          {features.map(({ doodle, tint, title, desc }) => (
            <div key={title} className="card-soft p-5 text-left">
              <div className={`mb-3.5 flex h-11 w-11 items-center justify-center rounded-[var(--radius-md)] ${tint}`}>
                <Doodle name={doodle} className="h-5 w-5 text-sage-700" strokeWidth={1.5} />
              </div>
              <h2 className="mb-1.5 text-base font-semibold text-ink">{title}</h2>
              <p className="text-sm leading-relaxed text-ink-soft">{desc}</p>
            </div>
          ))}
        </div>

        <p className="mt-12 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-sm text-ink-faint">
          <span>Powered by Claude AI</span>
          <span aria-hidden="true">·</span>
          <Link href="/privacy" className="underline decoration-sage-300 underline-offset-4 hover:text-sage-700">
            Your data stays private
          </Link>
          <span aria-hidden="true">·</span>
          <Link href="/pricing" className="underline decoration-sage-300 underline-offset-4 hover:text-sage-700">
            Pricing
          </Link>
          <span aria-hidden="true">·</span>
          <Link href="/terms" className="underline decoration-sage-300 underline-offset-4 hover:text-sage-700">
            Terms
          </Link>
        </p>
      </div>
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
  const tab = new URLSearchParams(window.location.search).get('tab')
  if (tab === 'upload') return 'files' // upload merged into Files; keep old links working
  return VALID_VIEWS.includes(tab) ? tab : 'overview'
}

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

  return (
    <div className="min-h-screen bg-app flex flex-col">

      {/* ── Top header ── */}
      <header className="sticky top-0 z-40 border-b border-line bg-surface/95 backdrop-blur-sm">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-2 px-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-2">
            <Image src="/sprout-svgrepo-com.svg" alt="" width={30} height={30} className="h-7 w-7 flex-shrink-0" />
            <span className="truncate font-display text-lg font-bold text-ink">Penny Sprout</span>
          </div>
          <div className="flex flex-shrink-0 items-center gap-1">
            <Link
              href="/pricing"
              className="inline-flex min-h-9 items-center gap-1.5 rounded-full bg-sage-50 px-3 text-xs font-semibold text-sage-700 transition-colors hover:bg-sage-100"
            >
              <Sparkles className="h-3.5 w-3.5" aria-hidden="true" /> Pro
            </Link>
            <Link
              href="/settings"
              aria-label="Settings"
              title="Settings"
              className="flex h-10 w-10 items-center justify-center rounded-[var(--radius-sm)] text-ink-faint transition-colors hover:bg-surface-hover hover:text-sage-700"
            >
              <Settings className="h-4.5 w-4.5" />
            </Link>
            <ThemeToggle />
            <span className="hidden max-w-[150px] truncate pl-1 text-sm text-ink-soft lg:block">
              {user.firstName || user.emailAddresses[0].emailAddress}
            </span>
            <UserButton />
          </div>
        </div>

        {/* Desktop nav — soft pill tabs rather than hard underlines */}
        <nav aria-label="Primary" className="mx-auto hidden max-w-6xl gap-1 px-4 pb-2 sm:flex sm:px-6">
          {NAV_ITEMS.map(({ id, label, Icon }) => {
            const active = activeView === id
            return (
              <button
                key={id}
                onClick={() => setActiveView(id)}
                aria-current={active ? 'page' : undefined}
                className={`inline-flex min-h-10 items-center gap-2 rounded-full px-4 text-sm font-semibold transition-colors ${
                  active
                    ? 'bg-sage-100 text-sage-800'
                    : 'text-ink-faint hover:bg-surface-hover hover:text-sage-700'
                }`}
              >
                <Icon className="h-4 w-4" aria-hidden="true" />
                {label}
              </button>
            )
          })}
        </nav>
      </header>

      {/* ── Page content ── */}
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 pb-28 sm:px-6 sm:py-8 sm:pb-10">
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
              <FileUpload onDataLoaded={() => setFilesRefresh(k => k + 1)} userId={user.id} />
              <UserFiles key={filesRefresh} userId={user.id} />
            </div>
          )}

          {activeView === 'calendar' && <SpendingCalendar />}

          {activeView === 'dashboard' && <SpendingDashboard />}

          {activeView === 'budgets' && <Budgets />}
        </div>
      </main>

      {/* ── Mobile bottom nav ──
           Thumb-friendly: 5 targets across the full width, each at least 56px
           tall, with the active tab marked by a pastel pill *and* a label
           weight change (never color alone). Padded for the home-indicator
           inset so the last row isn't clipped on modern phones. */}
      <nav
        aria-label="Primary"
        className="fixed bottom-0 left-0 right-0 z-40 border-t border-line bg-surface/95 backdrop-blur-sm sm:hidden"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="flex">
          {NAV_ITEMS.map(({ id, label, Icon }) => {
            const active = activeView === id
            return (
              <button
                key={id}
                onClick={() => setActiveView(id)}
                aria-current={active ? 'page' : undefined}
                className="flex min-h-[3.5rem] flex-1 flex-col items-center justify-center gap-1 py-2 transition-colors"
              >
                <span
                  className={`flex h-7 w-12 items-center justify-center rounded-full transition-colors ${
                    active ? 'bg-sage-100 text-sage-800' : 'text-ink-faint'
                  }`}
                >
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <span className={`text-xs ${active ? 'font-semibold text-sage-800' : 'font-medium text-ink-faint'}`}>
                  {label}
                </span>
              </button>
            )
          })}
        </div>
      </nav>

    </div>
  )
}
