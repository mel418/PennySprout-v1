'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useUser, SignInButton, UserButton } from '@clerk/nextjs'
import { Upload, FolderOpen, BarChart2, CalendarDays, LayoutGrid, Sparkles, TrendingUp, ArrowRight } from 'lucide-react'
import FileUpload from './components/FileUpload'
import SpendingDashboard from './components/SpendingDashboard'
import UserFiles from './components/UserFiles'
import SpendingCalendar from './components/SpendingCalendar'
import Overview from './components/Overview'

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
      <img src="/sprout-svgrepo-com.svg" alt="" className="absolute top-0 right-0 w-36 h-36 opacity-25 pointer-events-none"
           style={{ transform: 'rotate(15deg) translate(8px, -8px)' }} />

      {/* ── Hero content ── */}
      <div className="relative z-10 flex flex-col items-center justify-center flex-1 px-6 pt-16 pb-16 text-center">

        <div className="mb-5 animate-float">
          <img src="/sprout-svgrepo-com.svg" alt="Penny Sprout" className="w-20 h-20" />
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
          <Link href="/terms" className="underline decoration-sage-300 underline-offset-2 hover:text-sage-600">
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
  { id: 'files',     label: 'My Files', Icon: FolderOpen   },
  { id: 'upload',    label: 'Upload',   Icon: Upload       },
]

export default function Home() {
  const { isSignedIn, user, isLoaded } = useUser()
  const [activeView, setActiveView]       = useState('overview')

  if (!isLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-app">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-sage-500 border-t-transparent" />
      </div>
    )
  }

  if (!isSignedIn) return <LandingPage />

  // The Analysis tab is always available now — it picks a month and analyzes
  // pooled transactions itself (showing its own empty state when there's no data).
  const visibleTabs = NAV_ITEMS

  return (
    <div className="min-h-screen bg-app flex flex-col">

      {/* ── Top header ── */}
      <header className="sticky top-0 z-40 bg-surface border-b border-line">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img src="/sprout-svgrepo-com.svg" alt="" className="w-7 h-7" />
            <span className="font-bold text-ink text-base">Penny Sprout</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden sm:block text-sm text-ink-soft truncate max-w-[160px]">
              {user.firstName || user.emailAddresses[0].emailAddress}
            </span>
            <UserButton />
          </div>
        </div>

        {/* Desktop nav tabs */}
        <div className="hidden sm:flex max-w-6xl mx-auto px-6 gap-1">
          {visibleTabs.map(({ id, label, Icon }) => (
            <button
              key={id}
              onClick={() => setActiveView(id)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                activeView === id
                  ? 'border-sage-600 text-sage-700'
                  : 'border-transparent text-ink-faint hover:text-sage-700'
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </button>
          ))}
        </div>
      </header>

      {/* ── Page content ── */}
      <main className="flex-1 max-w-6xl mx-auto w-full px-4 sm:px-6 py-6 pb-24 sm:pb-8">

        {activeView === 'overview' && (
          <Overview
            onOpenCalendar={() => setActiveView('calendar')}
            onOpenUpload={() => setActiveView('upload')}
          />
        )}

        {activeView === 'upload' && (
          <FileUpload
            onDataLoaded={() => setActiveView('files')}
            userId={user.id}
          />
        )}

        {activeView === 'files' && <UserFiles userId={user.id} />}

        {activeView === 'calendar' && <SpendingCalendar />}

        {activeView === 'dashboard' && <SpendingDashboard />}
      </main>

      {/* ── Mobile bottom nav ── */}
      <nav className="sm:hidden fixed bottom-0 left-0 right-0 z-40 bg-surface border-t border-line">
        <div className="flex">
          {visibleTabs.map(({ id, label, Icon }) => (
            <button
              key={id}
              onClick={() => setActiveView(id)}
              className={`flex-1 flex flex-col items-center justify-center gap-1 py-3 text-xs font-medium transition-colors ${
                activeView === id ? 'text-sage-700' : 'text-ink-faint hover:text-sage-600'
              }`}
            >
              <Icon className={`h-5 w-5 ${activeView === id ? 'text-sage-600' : ''}`} />
              {label}
            </button>
          ))}
        </div>
      </nav>

    </div>
  )
}
