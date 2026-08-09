'use client'
import { useState, useRef, useEffect, useCallback } from 'react'
import { Search, X, Sparkles } from 'lucide-react'
import AllTransactions from './AllTransactions'
import TransactionsChat from './TransactionsChat'

const TABS = [
  { id: 'search', label: 'Search',    Icon: Search   },
  { id: 'ask',    label: 'Ask Penny', Icon: Sparkles },
]

// A small always-available window, docked in the bottom corner — rather than
// a full tab, so "find that one transaction" or "ask about my spending"
// never requires leaving whatever you're looking at (Overview, Calendar,
// Analysis…). Collapsed it's just a round launcher button; expanded it's a
// floating panel anchored above that same button, with two tabs: the
// search/filter list (AllTransactions) and an AI chat scoped to every
// transaction the user has ever uploaded (TransactionsChat).
export default function TransactionSearchWidget() {
  const [isOpen, setIsOpen] = useState(false)
  const [tab, setTab] = useState('search')
  const rootRef = useRef(null)

  const close = useCallback(() => setIsOpen(false), [])

  useEffect(() => {
    if (!isOpen) return
    const onKey = (e) => { if (e.key === 'Escape') close() }
    const onPointerDown = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) close()
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('mousedown', onPointerDown)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('mousedown', onPointerDown)
    }
  }, [isOpen, close])

  return (
    // bottom-20 clears the mobile bottom-nav bar (h-14 + safe-area inset);
    // from sm up that nav disappears, so the widget can sit lower still.
    <div ref={rootRef} className="fixed bottom-20 right-4 z-50 sm:bottom-4 sm:right-6">
      {isOpen && (
        <div
          role="dialog"
          aria-label="Search and ask about your transactions"
          className="mb-3 flex h-[min(70vh,34rem)] w-[calc(100vw-2rem)] max-w-sm flex-col
            overflow-hidden rounded-[var(--radius-xl)] border border-line bg-surface
            shadow-lift animate-modal-in"
        >
          <div className="flex flex-shrink-0 items-center border-b border-line bg-sage-50 px-2.5 py-2">
            <div className="inline-flex items-center gap-0.5 rounded-full bg-surface p-1">
              {TABS.map(({ id, label, Icon }) => (
                <button
                  key={id}
                  onClick={() => setTab(id)}
                  aria-pressed={tab === id}
                  className={`inline-flex min-h-8 items-center gap-1.5 rounded-full px-3 text-xs font-semibold transition-colors ${
                    tab === id ? 'bg-sage-600 text-white' : 'text-ink-faint hover:text-ink-soft'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                  {label}
                </button>
              ))}
            </div>
          </div>

          {tab === 'search' ? (
            <div className="min-h-0 flex-1 overflow-y-auto p-3">
              <AllTransactions />
            </div>
          ) : (
            <TransactionsChat />
          )}
        </div>
      )}

      <button
        onClick={() => setIsOpen(o => !o)}
        aria-label={isOpen ? 'Close transaction search' : 'Search transactions'}
        aria-expanded={isOpen}
        className="flex h-11 w-11 items-center justify-center rounded-full bg-sage-600 text-white
          shadow-lift transition-all hover:bg-sage-700 hover:-translate-y-0.5 active:translate-y-0"
      >
        {isOpen ? <X className="h-4 w-4" aria-hidden="true" /> : <Search className="h-4 w-4" aria-hidden="true" />}
      </button>
    </div>
  )
}
