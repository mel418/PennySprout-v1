'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useUser, SignInButton, UserButton } from '@clerk/nextjs'
import { Upload, FolderOpen, BarChart2, CalendarDays, Sparkles, TrendingUp, ArrowRight } from 'lucide-react'
import FileUpload from './components/FileUpload'
import SpendingDashboard from './components/SpendingDashboard'
import UserFiles from './components/UserFiles'
import SpendingCalendar from './components/SpendingCalendar'

// ─── Landing page ─────────────────────────────────────────────────────────────

function LandingPage() {
  const features = [
    { icon: Upload,    title: 'Upload Any Statement', desc: 'CSV from credit cards or PDF bank statements — both formats supported.' },
    { icon: Sparkles,  title: 'AI-Powered Analysis',  desc: 'Claude reads your transactions and surfaces personalized spending insights.' },
    { icon: TrendingUp,title: 'See the Full Picture',  desc: 'Interactive charts break down spending by category so nothing gets missed.' },
  ]

  return (
    <div className="min-h-screen bg-sage-100 relative overflow-hidden flex flex-col">

      {/* ── Decorative botanical elements (match the reference image) ── */}

      {/* Top-left dark olive wedge */}
      <div
        className="absolute top-0 left-0 w-44 h-40 bg-[#6b7c52] opacity-75 pointer-events-none"
        style={{ borderRadius: '0 0 80% 0' }}
      />

      {/* Top squiggly outline line */}
      <svg className="absolute top-[13%] left-[8%] w-72 opacity-20 pointer-events-none" viewBox="0 0 300 60" fill="none">
        <path d="M0,30 C50,5 100,55 150,30 S250,5 300,30" stroke="#3a5232" strokeWidth="1.5" />
      </svg>

      {/* Large sage circle — left middle */}
      <div className="absolute top-[28%] -left-24 w-80 h-80 bg-sage-400 rounded-full opacity-35 pointer-events-none" />

      {/* Top-right botanical — sprout SVG rotated like the leaf in the image */}
      <img
        src="/sprout-svgrepo-com.svg"
        alt=""
        className="absolute top-0 right-0 w-36 h-36 opacity-40 pointer-events-none"
        style={{ transform: 'rotate(15deg) translate(8px, -8px)' }}
      />

      {/* Bottom-right partial circle */}
      <div
        className="absolute bottom-0 right-0 w-52 h-52 bg-[#507c5c] rounded-full opacity-35 pointer-events-none"
        style={{ transform: 'translate(30%, 30%)' }}
      />

      {/* Bottom-right small botanical */}
      <img
        src="/sprout-svgrepo-com.svg"
        alt=""
        className="absolute bottom-12 right-20 w-14 h-14 opacity-25 pointer-events-none"
        style={{ transform: 'rotate(-10deg)' }}
      />

      {/* Bottom squiggly line */}
      <svg className="absolute bottom-[18%] left-[15%] w-56 opacity-15 pointer-events-none" viewBox="0 0 250 60" fill="none">
        <path d="M0,30 C40,5 80,55 125,30 S210,5 250,30" stroke="#507c5c" strokeWidth="1.5" />
      </svg>

      {/* ── Hero content ── */}
      <div className="relative z-10 flex flex-col items-center justify-center flex-1 px-6 pt-16 pb-16 text-center">

        <div className="mb-5 animate-float">
          <img src="/sprout-svgrepo-com.svg" alt="Penny Sprout" className="w-20 h-20 drop-shadow" />
        </div>

        <h1 className="text-5xl sm:text-6xl font-bold text-sage-800 mb-4 tracking-tight animate-fade-up">
          Penny <span className="text-sage-600">Sprout</span>
        </h1>

        <p className="text-base sm:text-lg text-sage-600 mb-10 max-w-sm leading-relaxed animate-fade-up delay-100">
          Upload your bank statements and let AI turn your spending data into clear, actionable insights.
        </p>

        <div className="animate-fade-up delay-200">
          <SignInButton mode="modal">
            <button className="group inline-flex items-center gap-2 px-8 py-3.5 bg-sage-600 hover:bg-sage-700 active:bg-sage-800 text-white font-semibold rounded-2xl text-base shadow-lg transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0">
              Get Started Free
              <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
            </button>
          </SignInButton>
          <p className="text-xs text-sage-500 mt-3">No credit card required</p>
        </div>

        {/* Feature cards */}
        <div className="mt-14 grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-2xl w-full animate-fade-up delay-300">
          {features.map(({ icon: Icon, title, desc }) => (
            <div
              key={title}
              className="bg-white/70 backdrop-blur-sm border border-sage-200 rounded-2xl p-5 text-left hover:bg-white/90 transition-colors"
            >
              <div className="w-9 h-9 rounded-xl bg-sage-100 flex items-center justify-center mb-3">
                <Icon className="h-4 w-4 text-sage-600" />
              </div>
              <h3 className="text-sm font-semibold text-sage-800 mb-1">{title}</h3>
              <p className="text-xs text-sage-500 leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>

        <p className="mt-10 text-xs text-sage-400 animate-fade-up delay-300">
          Powered by Claude AI ·{' '}
          <Link href="/privacy" className="underline decoration-sage-300 underline-offset-2 hover:text-sage-600">
            Your data stays private
          </Link>
        </p>
      </div>
    </div>
  )
}

// ─── Main app ─────────────────────────────────────────────────────────────────

const NAV_ITEMS = [
  { id: 'upload',    label: 'Upload',   Icon: Upload       },
  { id: 'files',     label: 'My Files', Icon: FolderOpen   },
  { id: 'calendar',  label: 'Calendar', Icon: CalendarDays },
  { id: 'dashboard', label: 'Analysis', Icon: BarChart2    },
]

export default function Home() {
  const { isSignedIn, user, isLoaded } = useUser()
  const [spendingData, setSpendingData]   = useState(null)
  const [analysis, setAnalysis]           = useState(null)
  const [activeView, setActiveView]       = useState('upload')

  if (!isLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-sage-100">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-sage-500 border-t-transparent" />
      </div>
    )
  }

  if (!isSignedIn) return <LandingPage />

  const visibleTabs = NAV_ITEMS.filter(t => t.id !== 'dashboard' || spendingData)

  return (
    <div className="min-h-screen bg-sage-50 flex flex-col">

      {/* ── Top header ── */}
      <header className="sticky top-0 z-40 bg-white border-b border-sage-100 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img src="/sprout-svgrepo-com.svg" alt="" className="w-7 h-7" />
            <span className="font-bold text-sage-800 text-base">Penny Sprout</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden sm:block text-sm text-sage-500 truncate max-w-[160px]">
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
                  : 'border-transparent text-gray-400 hover:text-sage-700'
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

        {activeView === 'upload' && (
          <FileUpload
            onDataLoaded={(data) => {
              setSpendingData(data)
              setAnalysis(null)
              setActiveView('dashboard')
            }}
            userId={user.id}
          />
        )}

        {activeView === 'files' && (
          <UserFiles
            userId={user.id}
            onFileSelected={(data) => {
              setSpendingData(data)
              setAnalysis(data.analysis || null)
              setActiveView('dashboard')
            }}
          />
        )}

        {activeView === 'calendar' && <SpendingCalendar />}

        {/* SpendingDashboard stays mounted once data exists — CSS-hidden not unmounted.
            Unmounting on tab switch re-triggers useEffect and re-analyzes every time. */}
        {spendingData && (
          <div style={{ display: activeView === 'dashboard' ? 'block' : 'none' }}>
            <SpendingDashboard
              data={spendingData}
              analysis={analysis}
              onAnalysisComplete={setAnalysis}
              userId={user.id}
            />
          </div>
        )}
      </main>

      {/* ── Mobile bottom nav ── */}
      <nav className="sm:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-sage-100">
        <div className="flex">
          {visibleTabs.map(({ id, label, Icon }) => (
            <button
              key={id}
              onClick={() => setActiveView(id)}
              className={`flex-1 flex flex-col items-center justify-center gap-1 py-3 text-xs font-medium transition-colors ${
                activeView === id ? 'text-sage-700' : 'text-gray-400 hover:text-sage-600'
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
