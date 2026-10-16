'use client'
import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { UserButton } from '@clerk/nextjs'
import {
  FolderOpen, BarChart2, CalendarDays, LayoutGrid, Sparkles, Target, Settings, ArrowRight, Eye,
} from 'lucide-react'
import FileUpload from './FileUpload'
import ConnectedAccounts from './ConnectedAccounts'
import SpendingDashboard from './SpendingDashboard'
import UserFiles from './UserFiles'
import SpendingCalendar from './SpendingCalendar'
import Overview from './Overview'
import Budgets from './Budgets'
import TransactionSearchWidget from './TransactionSearchWidget'
import ThemeToggle from './ui/ThemeToggle'
import { buttonClass } from './ui/Button'
import { billingHidden } from '@/lib/billingFlag'

// The signed-in app: sidebar / top bar / mobile dock around the five tabs.
// Shared by the real app (app/page.js) and the public demo (app/demo/page.js).
// With `demo`, account controls become a "Sign up free" link, a banner
// explains the sample data, and the upload / bank-connect panels are replaced
// with a note — the demo's fake API (demoApi.js) refuses those anyway.

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

// Links out of the demo are plain <a>, not <Link>: leaving must be a full
// page load so the fake fetch and its cached sample transactions (the
// module-level store in useTransactions) are gone for good.
/* eslint-disable @next/next/no-html-link-for-pages */
function SignUpLink({ className = '' }) {
  return (
    <a
      href="/"
      className={`inline-flex min-h-11 items-center gap-1.5 rounded-full bg-lime px-4 text-sm font-bold text-lime-ink transition hover:brightness-95 ${className}`}
    >
      Sign up free <ArrowRight className="h-4 w-4" aria-hidden="true" />
    </a>
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

function DemoBanner() {
  return (
    <div className="border-b border-line bg-lime-soft">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-2 text-sm text-sage-700 sm:px-6 lg:px-10">
        <p className="flex items-center gap-2 font-semibold">
          <Eye className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
          You&apos;re viewing a demo with sample data. Changes reset when you reload.
        </p>
        <a href="/" className="inline-flex min-h-11 items-center font-bold underline underline-offset-2 hover:text-ink">
          Use your own statements
        </a>
      </div>
    </div>
  )
}

function DemoUploadNotice() {
  return (
    <div className="card-soft p-6">
      <h2 className="font-display text-lg font-bold text-ink">Bring your own data</h2>
      <p className="mt-1 max-w-xl text-sm leading-relaxed text-ink-soft">
        In the real app you can upload CSV or PDF bank statements, or connect a bank for automatic
        syncing. The demo uses the sample statements listed below.
      </p>
      <a href="/" className={buttonClass({ variant: 'primary', size: 'sm', className: 'mt-4' })}>
        Sign up free <ArrowRight className="h-4 w-4" aria-hidden="true" />
      </a>
    </div>
  )
}

/* eslint-enable @next/next/no-html-link-for-pages */

export default function AppShell({ displayName, userId, demo = false }) {
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
          {demo ? <SignUpLink className="w-full justify-center" /> : <ProLink className="w-full justify-center" />}
          <div className="flex items-center gap-2 rounded-full bg-surface-2 p-1.5 pl-2">
            {!demo && <UserButton />}
            <span className={`min-w-0 flex-1 truncate text-sm font-semibold text-ink ${demo ? 'pl-2' : ''}`}>{displayName}</span>
            {!demo && <SettingsLink />}
            <ThemeToggle />
          </div>
        </div>
      </aside>

      {/* ── Top bar (below lg) ── */}
      <header className="sticky top-0 z-40 border-b border-line bg-surface/90 backdrop-blur-md lg:hidden">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-2 px-4 sm:px-6">
          <Brand />
          <div className="flex flex-shrink-0 items-center gap-1">
            {demo ? (
              <SignUpLink />
            ) : (
              <>
                <ProLink className="hidden sm:inline-flex" />
                <SettingsLink />
              </>
            )}
            <ThemeToggle />
            {!demo && <div className="pl-1"><UserButton /></div>}
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

      {demo && <DemoBanner />}

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
              {demo ? (
                <DemoUploadNotice />
              ) : (
                <>
                  <ConnectedAccounts />
                  <FileUpload onDataLoaded={() => setFilesRefresh(k => k + 1)} userId={userId} />
                </>
              )}
              <UserFiles key={filesRefresh} userId={userId} />
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
