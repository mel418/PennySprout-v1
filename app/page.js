'use client'
import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useUser, SignInButton, UserButton } from '@clerk/nextjs'
import { FolderOpen, BarChart2, CalendarDays, LayoutGrid, Sparkles, TrendingUp, ArrowRight, Target, Settings, Keyboard } from 'lucide-react'
import FileUpload from './components/FileUpload'
import SpendingDashboard from './components/SpendingDashboard'
import UserFiles from './components/UserFiles'
import SpendingCalendar from './components/SpendingCalendar'
import Overview from './components/Overview'
import Budgets from './components/Budgets'
import Spinner from './components/ui/Spinner'
import ThemeToggle from './components/ui/ThemeToggle'
import Modal from './components/ui/Modal'

// ─── Landing page ─────────────────────────────────────────────────────────────

function LandingPage() {
  const features = [
    { icon: CalendarDays, title: 'Your money on a calendar', desc: 'Bills, paychecks, and spending mapped across time — week, month, and year.' },
    { icon: Sparkles,     title: 'AI-powered analysis',      desc: 'Claude reads your transactions and surfaces calm, personalized insights.' },
    { icon: TrendingUp,   title: 'See the full picture',     desc: 'Heatmaps, trends, and category cards keep you informed — never punished.' },
  ]

  return (
    <div className="min-h-screen bg-app relative overflow-hidden flex flex-col">

      {/* ── Soft decorative elements — calm, low-opacity, no glassmorphism ── */}
      <div className="absolute top-0 left-0 w-44 h-40 bg-sage-200 opacity-30 pointer-events-none"
           style={{ borderRadius: '0 0 80% 0' }} />
      <div className="absolute top-[28%] -left-24 w-80 h-80 bg-sage-100 rounded-full opacity-40 pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-52 h-52 bg-blue-100 rounded-full opacity-40 pointer-events-none"
           style={{ transform: 'translate(30%, 30%)' }} />
      <Image src="/sprout-svgrepo-com.svg" alt="" width={144} height={144}
           className="absolute top-0 right-0 w-36 h-36 opacity-25 pointer-events-none"
           style={{ transform: 'rotate(15deg) translate(8px, -8px)' }} />

      {/* ── Hero content ── */}
      <div className="relative z-10 flex flex-col items-center justify-center flex-1 px-6 pt-16 pb-16 text-center">

        <div className="mb-5 animate-float">
          <Image src="/sprout-svgrepo-com.svg" alt="Penny Sprout" width={80} height={80} priority className="w-20 h-20" />
        </div>

        <h1 className="text-5xl sm:text-6xl font-bold text-ink mb-4 tracking-tight animate-fade-up">
          Penny <span className="text-sage-600">Sprout</span>
        </h1>

        <p className="text-base sm:text-lg text-ink-soft mb-10 max-w-md leading-relaxed animate-fade-up delay-100">
          A calm command center for your money. Upload your statements and see your finances
          laid out like a calendar — organized, informed, and in control.
        </p>

        <div className="animate-fade-up delay-200">
          <SignInButton mode="modal">
            <button className="group inline-flex items-center gap-2 px-8 py-3.5 bg-sage-600 hover:bg-sage-700 active:bg-sage-800 text-white font-semibold rounded-2xl text-base shadow-sm transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0">
              Get Started Free
              <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
            </button>
          </SignInButton>
          <p className="text-xs text-ink-faint mt-3">No credit card required</p>
        </div>

        {/* Feature cards */}
        <div className="mt-14 grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-2xl w-full animate-fade-up delay-300">
          {features.map(({ icon: Icon, title, desc }) => (
            <div key={title} className="bg-surface border border-line rounded-2xl p-5 text-left shadow-sm">
              <div className="w-9 h-9 rounded-xl bg-sage-50 flex items-center justify-center mb-3">
                <Icon className="h-4 w-4 text-sage-600" />
              </div>
              <h3 className="text-sm font-semibold text-ink mb-1">{title}</h3>
              <p className="text-xs text-ink-soft leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>

        <p className="mt-10 text-xs text-ink-faint animate-fade-up delay-300">
          Powered by Claude AI ·{' '}
          <Link href="/privacy" className="underline decoration-sage-300 underline-offset-2 hover:text-sage-600">
            Your data stays private
          </Link>
          {' '}·{' '}
          <Link href="/pricing" className="underline decoration-sage-300 underline-offset-2 hover:text-sage-600">
            Pricing
          </Link>
          {' '}·{' '}
          <Link href="/terms" className="underline decoration-sage-300 underline-offset-2 hover:text-sage-600">
            Terms
          </Link>
        </p>
      </div>
    </div>
  )
}

// ─── Keyboard shortcuts reference ────────────────────────────────────────────

function ShortcutGroup({ heading, rows }) {
  return (
    <div>
      <h4 className="text-xs font-semibold text-ink-faint uppercase tracking-wide mb-2">{heading}</h4>
      <div className="space-y-1.5">
        {rows.map(([keys, label]) => (
          <div key={label} className="flex items-center justify-between gap-4 text-sm">
            <span className="text-ink-soft">{label}</span>
            <kbd className="px-2 py-0.5 rounded-md bg-surface-2 border border-line text-xs font-sans font-medium text-ink flex-shrink-0">
              {keys}
            </kbd>
          </div>
        ))}
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

  // ── Keyboard shortcuts ──
  // 1–5 switch tabs, ? opens the reference. Only plain keypresses count:
  // anything typed into a field, or chorded with a modifier, passes through.
  // (The Calendar adds its own ←/→/T/Esc handling while it's mounted.)
  const [showShortcuts, setShowShortcuts] = useState(false)
  const closeShortcuts = useCallback(() => setShowShortcuts(false), [])

  useEffect(() => {
    const onKey = (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return
      const t = e.target
      if (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable) return

      if (e.key === '?') {
        e.preventDefault()
        setShowShortcuts(s => !s)
        return
      }
      const index = ['1', '2', '3', '4', '5'].indexOf(e.key)
      if (index !== -1 && NAV_ITEMS[index]) {
        e.preventDefault()
        setActiveView(NAV_ITEMS[index].id)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [setActiveView])

  if (!isLoaded) return <Spinner className="min-h-screen bg-app" />

  if (!isSignedIn) return <LandingPage />

  return (
    <div className="min-h-screen bg-app flex flex-col">

      {/* ── Top header ── */}
      <header className="sticky top-0 z-40 bg-surface border-b border-line">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Image src="/sprout-svgrepo-com.svg" alt="" width={28} height={28} className="w-7 h-7" />
            <span className="font-bold text-ink text-base">Penny Sprout</span>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/pricing"
              className="inline-flex items-center gap-1 text-xs font-semibold text-sage-700 hover:text-sage-800 bg-sage-50 hover:bg-sage-100 px-2.5 py-1.5 rounded-lg transition-colors">
              <Sparkles className="h-3.5 w-3.5" /> Pro
            </Link>
            <Link href="/settings" aria-label="Settings"
              className="p-1.5 text-ink-faint hover:text-sage-700 transition-colors">
              <Settings className="h-4 w-4" />
            </Link>
            <button onClick={() => setShowShortcuts(true)} aria-label="Keyboard shortcuts" title="Keyboard shortcuts (?)"
              className="hidden sm:block p-1.5 text-ink-faint hover:text-sage-700 transition-colors">
              <Keyboard className="h-4 w-4" />
            </button>
            <ThemeToggle />
            <span className="hidden sm:block text-sm text-ink-soft truncate max-w-[160px]">
              {user.firstName || user.emailAddresses[0].emailAddress}
            </span>
            <UserButton />
          </div>
        </div>

        {/* Desktop nav tabs */}
        <nav aria-label="Primary" className="hidden sm:flex max-w-6xl mx-auto px-6 gap-1">
          {NAV_ITEMS.map(({ id, label, Icon }) => (
            <button
              key={id}
              onClick={() => setActiveView(id)}
              aria-current={activeView === id ? 'page' : undefined}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                activeView === id
                  ? 'border-sage-600 text-sage-700'
                  : 'border-transparent text-ink-faint hover:text-sage-700'
              }`}
            >
              <Icon className="h-3.5 w-3.5" aria-hidden="true" />
              {label}
            </button>
          ))}
        </nav>
      </header>

      {/* ── Page content ── */}
      <main className="flex-1 max-w-6xl mx-auto w-full px-4 sm:px-6 py-6 pb-24 sm:pb-8">
        {/* key remounts the wrapper per tab so each switch gets a soft entrance */}
        <div key={activeView} className="animate-page-in">

          {activeView === 'overview' && (
            <Overview
              onOpenCalendar={() => setActiveView('calendar')}
              onOpenUpload={() => setActiveView('files')}
              onOpenAnalysis={() => setActiveView('dashboard')}
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

      {/* ── Keyboard shortcuts reference ── */}
      <Modal isOpen={showShortcuts} onClose={closeShortcuts} title="Keyboard shortcuts" subtitle="Available anywhere except while typing">
        <div className="p-6 space-y-5 overflow-y-auto">
          <ShortcutGroup
            heading="Navigate"
            rows={NAV_ITEMS.map((item, i) => [String(i + 1), `Go to ${item.label}`])}
          />
          <ShortcutGroup
            heading="Calendar"
            rows={[
              ['←  →', 'Previous / next period'],
              ['T', 'Jump to latest activity'],
              ['Esc', 'Deselect day'],
            ]}
          />
          <ShortcutGroup
            heading="Anywhere"
            rows={[
              ['?', 'Show or hide this reference'],
              ['Esc', 'Close dialogs'],
            ]}
          />
        </div>
      </Modal>

      {/* ── Mobile bottom nav ── */}
      <nav aria-label="Primary" className="sm:hidden fixed bottom-0 left-0 right-0 z-40 bg-surface border-t border-line">
        <div className="flex">
          {NAV_ITEMS.map(({ id, label, Icon }) => (
            <button
              key={id}
              onClick={() => setActiveView(id)}
              aria-current={activeView === id ? 'page' : undefined}
              className={`flex-1 flex flex-col items-center justify-center gap-1 py-3 text-xs font-medium transition-colors ${
                activeView === id ? 'text-sage-700' : 'text-ink-faint hover:text-sage-600'
              }`}
            >
              <Icon className={`h-5 w-5 ${activeView === id ? 'text-sage-600' : ''}`} aria-hidden="true" />
              {label}
            </button>
          ))}
        </div>
      </nav>

    </div>
  )
}
