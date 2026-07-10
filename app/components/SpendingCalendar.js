'use client'
import { useState, useEffect, useMemo, useCallback } from 'react'
import { ChevronLeft, ChevronRight, ChevronDown, ChevronRight as ChevronRightSm, CalendarDays, X } from 'lucide-react'
import { normalizeCategory, categoryColor, calcSpending, calcIncome, categoryTotals } from '@/lib/categories'
import {
  parseDate, toKey, fromKey, MONTHS_SHORT,
  periodRange, periodLabel, stepPeriod, startOfWeek, addDays,
} from '@/lib/date'
import { money, moneyExact } from '@/lib/format'
import { useTransactions } from './useTransactions'
import LoadError from './LoadError'
import { DashboardSkeleton } from './ui/Skeletons'
import EmptyState from './ui/EmptyState'

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const SCALES = [
  { id: 'week',  label: 'Week'  },
  { id: 'month', label: 'Month' },
  { id: 'year',  label: 'Year'  },
]

const money0 = (n) => `$${Math.round(Math.abs(n)).toLocaleString('en-US')}`

export default function SpendingCalendar() {
  // Shared hook distinguishes a failed load (expired session, server error)
  // from a genuinely empty account — see useTransactions.js.
  const { transactions: allTransactions, isLoading, error, retry } = useTransactions()
  const [scale, setScale]           = useState('month')
  const [anchor, setAnchor]         = useState(null)         // any date inside the active period
  const [latest, setLatest]         = useState(null)         // most recent active date
  const [selectedDate, setSelectedDate] = useState(null)
  const [expandedCategory, setExpandedCategory] = useState(null)

  // Anchor the calendar on the most recent active date once data arrives.
  useEffect(() => {
    if (isLoading) return
    const dates = allTransactions.map(parseDate).filter(Boolean)
    const base = dates.length ? new Date(Math.max(...dates.map(d => d.getTime()))) : new Date()
    setLatest(dates.length ? base : null)
    setAnchor(new Date(base.getFullYear(), base.getMonth(), base.getDate()))
  }, [allTransactions, isLoading])

  // dateKey → transaction array
  const byDate = useMemo(() => {
    const map = {}
    allTransactions.forEach(t => {
      const d = parseDate(t)
      if (!d) return
      const key = toKey(d)
      ;(map[key] ||= []).push(t)
    })
    return map
  }, [allTransactions])

  const dayTotals = useCallback((txns) => {
    let spending = 0, income = 0
    txns.forEach(t => {
      const cat = normalizeCategory(t.Category, t.Amount)
      const amt = Math.abs(parseFloat(t.Amount) || 0)
      if (cat === 'Income') income += amt
      else if (cat !== 'Bills & Payments') spending += amt
    })
    return { spending, income, net: income - spending }
  }, [])

  // Transactions inside the active period — drives the inspector summary.
  const periodTxns = useMemo(() => {
    if (!anchor) return []
    const [start, end] = periodRange(scale, anchor)
    const endMs = end.getTime() + 86_400_000 // include the whole last day
    return allTransactions.filter(t => {
      const d = parseDate(t)
      return d && d >= start && d.getTime() < endMs
    })
  }, [allTransactions, anchor, scale])

  const periodSummary = useMemo(() => ({
    income: calcIncome(periodTxns),
    spending: calcSpending(periodTxns),
    topCats: categoryTotals(periodTxns).slice(0, 5),
  }), [periodTxns])

  // Selected date breakdown by category
  const selectedDateData = useMemo(() => {
    if (!selectedDate) return null
    const txns = byDate[selectedDate] || []
    const catMap = {}
    txns.forEach(t => { (catMap[normalizeCategory(t.Category, t.Amount)] ||= []).push(t) })
    return Object.entries(catMap)
      .map(([category, transactions]) => ({
        category, transactions,
        total: transactions.reduce((s, t) => s + Math.abs(parseFloat(t.Amount) || 0), 0),
      }))
      .sort((a, b) => b.total - a.total)
  }, [selectedDate, byDate])

  const clearSelection = useCallback(() => {
    setSelectedDate(null)
    setExpandedCategory(null)
  }, [])

  const go = useCallback((dir) => {
    setAnchor(a => stepPeriod(scale, a, dir))
    clearSelection()
  }, [scale, clearSelection])

  const jumpToLatest = useCallback(() => {
    if (latest) setAnchor(new Date(latest.getFullYear(), latest.getMonth(), latest.getDate()))
    setSelectedDate(null)
  }, [latest])

  // Keyboard: ←/→ change period, T jumps to latest activity, Esc deselects
  useEffect(() => {
    const onKey = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return
      if (e.key === 'ArrowLeft') { e.preventDefault(); go(-1) }
      else if (e.key === 'ArrowRight') { e.preventDefault(); go(1) }
      else if (e.key === 't' || e.key === 'T') { e.preventDefault(); jumpToLatest() }
      else if (e.key === 'Escape') { clearSelection() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [go, jumpToLatest, clearSelection])

  if (error) return <LoadError error={error} onRetry={retry} />

  if (isLoading || !anchor) return <DashboardSkeleton />

  if (allTransactions.length === 0) {
    return (
      <EmptyState
        icon={CalendarDays}
        title="No transaction history yet"
        description="Upload statements to see your spending calendar."
      />
    )
  }

  const selectDate = (key) => {
    setSelectedDate(prev => (prev === key ? null : key))
    setExpandedCategory(null)
  }
  const latestKey = latest ? toKey(latest) : null

  // Year view: clicking a month name drills into that month.
  const openMonth = (monthIndex) => {
    setAnchor(a => new Date(a.getFullYear(), monthIndex, 1))
    setScale('month')
    clearSelection()
  }

  return (
    <div className="space-y-4">

      {/* ── Unified calendar panel: toolbar + grid + inspector ── */}
      <div className="bg-surface rounded-2xl border border-line shadow-sm overflow-hidden">

        {/* Toolbar */}
        <div className="flex items-center justify-between gap-3 flex-wrap px-4 sm:px-5 py-3.5 border-b border-line">
          <div className="flex items-center gap-2.5 min-w-0">
            <h2 className="text-base sm:text-lg font-semibold text-ink tracking-tight truncate" aria-live="polite">
              {periodLabel(scale, anchor)}
            </h2>
            <button onClick={jumpToLatest}
              className="px-2.5 py-1 text-xs font-medium text-sage-700 hover:bg-surface-hover rounded-lg transition-colors">
              Today
            </button>
          </div>

          <div className="flex items-center gap-2">
            {/* Scale segmented control */}
            <div className="inline-flex bg-surface-2 rounded-xl p-1">
              {SCALES.map(s => (
                <button
                  key={s.id}
                  onClick={() => { setScale(s.id); clearSelection() }}
                  aria-pressed={scale === s.id}
                  className={`px-3 py-1 text-sm font-medium rounded-lg transition-colors ${
                    scale === s.id ? 'bg-surface text-ink shadow-sm' : 'text-ink-faint hover:text-ink'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
            {/* Period nav */}
            <div className="inline-flex items-center rounded-xl border border-line">
              <button onClick={() => go(-1)} aria-label={`Previous ${scale}`}
                className="p-1.5 rounded-l-xl hover:bg-surface-hover text-ink-faint hover:text-ink transition-colors">
                <ChevronLeft className="h-4 w-4" aria-hidden="true" />
              </button>
              <span className="w-px self-stretch bg-line" aria-hidden="true" />
              <button onClick={() => go(1)} aria-label={`Next ${scale}`}
                className="p-1.5 rounded-r-xl hover:bg-surface-hover text-ink-faint hover:text-ink transition-colors">
                <ChevronRight className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          </div>
        </div>

        {/* Grid + inspector. min-w-0 lets the grid column shrink below its
            content's natural width instead of shoving the inspector out of
            the clipped (overflow-hidden) panel. */}
        <div className="lg:grid lg:grid-cols-[1fr_300px]">
          <div className="p-3 sm:p-4 min-w-0">
            {scale === 'month' && (
              <MonthGrid {...{ anchor, byDate, dayTotals, selectedDate, selectDate, latestKey }} />
            )}
            {scale === 'week' && (
              <WeekGrid {...{ anchor, byDate, dayTotals, selectedDate, selectDate }} />
            )}
            {scale === 'year' && (
              <YearGrid {...{ anchor, byDate, dayTotals, selectedDate, selectDate, openMonth }} />
            )}
            <p className="hidden lg:block text-[11px] text-ink-faint mt-3 px-1">
              <kbd className="px-1 py-0.5 rounded bg-surface-2 font-sans">←</kbd>{' '}
              <kbd className="px-1 py-0.5 rounded bg-surface-2 font-sans">→</kbd> move ·{' '}
              <kbd className="px-1 py-0.5 rounded bg-surface-2 font-sans">T</kbd> latest ·{' '}
              <kbd className="px-1 py-0.5 rounded bg-surface-2 font-sans">Esc</kbd> deselect
            </p>
          </div>

          {/* Inspector: selected-day breakdown, or a summary of the period */}
          <aside className="border-t lg:border-t-0 lg:border-l border-line bg-surface p-4 sm:p-5">
            {selectedDate && selectedDateData ? (
              <DayInspector
                dateKey={selectedDate}
                data={selectedDateData}
                txCount={(byDate[selectedDate] || []).length}
                totals={dayTotals(byDate[selectedDate] || [])}
                expandedCategory={expandedCategory}
                setExpandedCategory={setExpandedCategory}
                onClose={clearSelection}
              />
            ) : (
              <PeriodInspector scale={scale} summary={periodSummary} />
            )}
          </aside>
        </div>
      </div>

    </div>
  )
}

// ── Inspector: selected-day category breakdown ──────────────────────────────
function DayInspector({ dateKey, data, txCount, totals, expandedCategory, setExpandedCategory, onClose }) {
  const date = fromKey(dateKey)
  return (
    <div className="animate-expand">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs font-medium text-ink-faint uppercase tracking-wide">
            {date.toLocaleDateString('en-US', { weekday: 'long' })}
          </p>
          <h3 className="text-lg font-semibold text-ink tracking-tight">
            {date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
          </h3>
          <p className="text-xs text-ink-faint mt-0.5">{txCount} transaction{txCount !== 1 ? 's' : ''}</p>
        </div>
        <button onClick={onClose} aria-label="Close day details"
          className="p-1.5 -mr-1 rounded-lg text-ink-faint hover:text-ink hover:bg-surface-hover transition-colors">
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      {(totals.spending > 0 || totals.income > 0) && (
        <div className="flex gap-4 mt-3 pb-3 border-b border-line text-sm">
          {totals.spending > 0 && <span className="font-semibold text-blue-600">−{money(totals.spending)}</span>}
          {totals.income > 0 && <span className="font-semibold text-sage-600">+{money(totals.income)}</span>}
        </div>
      )}

      <div className="mt-2 -mx-2">
        {data.map(({ category, transactions, total }) => {
          const isOpen = expandedCategory === category
          const color = categoryColor(category)
          return (
            <div key={category}>
              <button
                onClick={() => setExpandedCategory(isOpen ? null : category)}
                aria-expanded={isOpen}
                className="w-full flex items-center justify-between gap-2 px-2 py-2 rounded-lg hover:bg-surface-hover transition-colors text-left"
              >
                <span className="flex items-center gap-2 min-w-0">
                  {isOpen
                    ? <ChevronDown className="h-3.5 w-3.5 text-sage-500 flex-shrink-0" aria-hidden="true" />
                    : <ChevronRightSm className="h-3.5 w-3.5 text-ink-faint flex-shrink-0" aria-hidden="true" />}
                  <span className="h-2 w-2 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                  <span className="text-sm font-medium text-ink truncate">{category}</span>
                </span>
                <span className="text-sm font-semibold text-ink flex-shrink-0">{moneyExact(total)}</span>
              </button>
              {isOpen && (
                <div className="ml-7 mr-2 mb-2 space-y-1 animate-expand">
                  {transactions.map((t, i) => (
                    <div key={i} className="flex justify-between items-center gap-3 py-1">
                      <p className="text-xs text-ink-soft truncate">{t['Description'] || '—'}</p>
                      <span className="text-xs font-medium text-ink flex-shrink-0">
                        {moneyExact(Math.abs(parseFloat(t.Amount) || 0))}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Inspector: period summary (nothing selected) ────────────────────────────
function PeriodInspector({ scale, summary }) {
  const net = summary.income - summary.spending
  return (
    <div className="animate-expand">
      <p className="text-xs font-medium text-ink-faint uppercase tracking-wide">This {scale}</p>

      <div className="mt-3 space-y-2.5">
        <div className="flex items-center justify-between text-sm">
          <span className="text-ink-soft">Income</span>
          <span className="font-semibold text-sage-600">+{money(summary.income)}</span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-ink-soft">Spending</span>
          <span className="font-semibold text-blue-600">−{money(summary.spending)}</span>
        </div>
        <div className="flex items-center justify-between text-sm pt-2.5 border-t border-line">
          <span className="text-ink-soft">Net</span>
          <span className={`font-semibold ${net >= 0 ? 'text-sage-600' : 'text-blue-600'}`}>
            {net >= 0 ? '+' : '−'}{money(net)}
          </span>
        </div>
      </div>

      {summary.topCats.length > 0 && (
        <>
          <p className="text-xs font-medium text-ink-faint uppercase tracking-wide mt-6 mb-2">Top categories</p>
          <div className="space-y-2">
            {summary.topCats.map(({ category, amount }) => (
              <div key={category} className="flex items-center justify-between gap-2 text-sm">
                <span className="flex items-center gap-2 min-w-0">
                  <span className="h-2 w-2 rounded-full flex-shrink-0" style={{ backgroundColor: categoryColor(category) }} />
                  <span className="text-ink-soft truncate">{category}</span>
                </span>
                <span className="font-medium text-ink flex-shrink-0">{money(amount)}</span>
              </div>
            ))}
          </div>
        </>
      )}

      <p className="text-xs text-ink-faint mt-6">Select a day to see its transactions.</p>
    </div>
  )
}

// ── Month grid ──────────────────────────────────────────────────────────────
function MonthGrid({ anchor, byDate, dayTotals, selectedDate, selectDate, latestKey }) {
  const year = anchor.getFullYear()
  const month = anchor.getMonth()
  const firstDow = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const cells = [...Array(firstDow).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)]

  return (
    <div>
      <div className="grid grid-cols-7 mb-1">
        {DAYS.map(d => (
          <div key={d} className="text-center text-[10px] sm:text-[11px] font-medium uppercase tracking-wide text-ink-faint py-1">
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-0.5 sm:gap-1">
        {cells.map((day, i) => {
          if (!day) return <div key={`b-${i}`} />
          const key = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
          const txns = byDate[key] || []
          const hasData = txns.length > 0
          const isSelected = selectedDate === key
          const isLatest = key === latestKey
          const { spending, income } = dayTotals(txns)
          return (
            <button
              key={key}
              onClick={() => hasData && selectDate(key)}
              disabled={!hasData}
              aria-pressed={isSelected}
              className={`relative flex flex-col items-center rounded-xl px-1 pt-1.5 pb-1 min-h-[58px] sm:min-h-[72px] transition-all
                ${isSelected ? 'bg-sage-50 ring-1 ring-sage-400' : ''}
                ${hasData && !isSelected ? 'hover:bg-surface-hover cursor-pointer' : ''}
                ${!hasData ? 'cursor-default' : ''}`}
            >
              <span className={`text-xs sm:text-sm font-medium leading-none flex items-center justify-center
                ${isLatest ? 'h-5 w-5 sm:h-6 sm:w-6 rounded-full bg-sage-600 text-white' : hasData ? 'text-ink h-5 sm:h-6' : 'text-ink-faint/50 h-5 sm:h-6'}`}>
                {day}
              </span>
              {hasData && (
                <span className="mt-auto flex flex-col items-center leading-tight">
                  {spending > 0 && (
                    <span className="text-[10px] sm:text-[11px] font-medium text-blue-600">−{money0(spending)}</span>
                  )}
                  {income > 0 && (
                    <span className="text-[10px] sm:text-[11px] font-medium text-sage-600">+{money0(income)}</span>
                  )}
                </span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ── Week strip (Google-Calendar style event chips) ──────────────────────────
function WeekGrid({ anchor, byDate, dayTotals, selectedDate, selectDate }) {
  const start = startOfWeek(anchor)
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i))

  return (
    <div className="grid grid-cols-2 sm:grid-cols-7 gap-2">
      {days.map(d => {
        const key = toKey(d)
        const txns = byDate[key] || []
        const isSelected = selectedDate === key
        const { spending, income } = dayTotals(txns)
        // top category events
        const catMap = {}
        txns.forEach(t => {
          const cat = normalizeCategory(t.Category, t.Amount)
          catMap[cat] = (catMap[cat] || 0) + Math.abs(parseFloat(t.Amount) || 0)
        })
        const events = Object.entries(catMap).sort((a, b) => b[1] - a[1]).slice(0, 4)
        return (
          <button
            key={key}
            onClick={() => txns.length && selectDate(key)}
            disabled={!txns.length}
            aria-pressed={isSelected}
            className={`flex flex-col text-left rounded-xl border p-2.5 min-h-[120px] transition-all
              ${isSelected ? 'border-sage-400 bg-sage-50 ring-1 ring-sage-400' : 'border-line hover:bg-surface-hover'}
              ${!txns.length ? 'opacity-60 cursor-default hover:bg-transparent' : 'cursor-pointer'}`}
          >
            <div className="flex items-baseline justify-between mb-1.5">
              <span className="text-[10px] font-medium uppercase tracking-wide text-ink-faint">{DAYS[d.getDay()]}</span>
              <span className="text-sm font-semibold text-ink">{d.getDate()}</span>
            </div>
            <div className="flex flex-col gap-1 flex-1">
              {events.map(([cat, amt]) => (
                <span key={cat} className="text-[10px] leading-tight rounded px-1.5 py-0.5 truncate"
                  style={{ backgroundColor: `${categoryColor(cat)}22`, color: 'var(--ink)' }}>
                  <span className="font-medium">{cat}</span> {money0(amt)}
                </span>
              ))}
            </div>
            {(spending > 0 || income > 0) && (
              <div className="mt-1.5 pt-1.5 border-t border-line flex items-center justify-between text-[10px]">
                {spending > 0 && <span className="text-blue-600 font-medium">−{money0(spending)}</span>}
                {income > 0 && <span className="text-sage-600 font-medium">+{money0(income)}</span>}
              </div>
            )}
          </button>
        )
      })}
    </div>
  )
}

// ── Year view: twelve mini month calendars (Apple Calendar style) ───────────
// Each day is a heat-tinted cell — sage for net-positive days, dusty blue for
// net-negative, darker = larger. Month names drill into that month.
function YearGrid({ anchor, byDate, dayTotals, selectedDate, selectDate, openMonth }) {
  const year = anchor.getFullYear()

  // Max |net| across the year so every mini month shares one intensity scale.
  const max = useMemo(() => {
    let m = 0
    const prefix = `${year}-`
    for (const [key, txns] of Object.entries(byDate)) {
      if (key.startsWith(prefix)) m = Math.max(m, Math.abs(dayTotals(txns).net))
    }
    return m
  }, [byDate, year, dayTotals])

  return (
    <div>
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-x-5 gap-y-6 p-1">
        {Array.from({ length: 12 }, (_, month) => (
          <MiniMonth key={month} {...{ year, month, byDate, dayTotals, max, selectedDate, selectDate, openMonth }} />
        ))}
      </div>
      <div className="flex items-center gap-3 mt-4 px-1 text-[10px] text-ink-faint">
        <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm bg-sage-500" />net positive</span>
        <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm bg-blue-500" />net negative</span>
        <span>· darker = larger · click a day for detail</span>
      </div>
    </div>
  )
}

function MiniMonth({ year, month, byDate, dayTotals, max, selectedDate, selectDate, openMonth }) {
  const firstDow = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const cells = [...Array(firstDow).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)]

  return (
    <div>
      <button
        onClick={() => openMonth(month)}
        className="text-xs font-semibold text-ink hover:text-sage-700 transition-colors mb-1.5 px-0.5"
        aria-label={`Open ${MONTHS_SHORT[month]} ${year} in month view`}
      >
        {MONTHS_SHORT[month]}
      </button>
      <div className="grid grid-cols-7 gap-[3px]">
        {cells.map((day, i) => {
          if (!day) return <div key={`b-${i}`} className="aspect-square" />
          const key = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
          const txns = byDate[key] || []
          const has = txns.length > 0
          const { net } = dayTotals(txns)
          const mag = max > 0 ? Math.min(1, Math.abs(net) / max) : 0
          let bg = 'var(--surface-2)'
          if (has && net > 0) bg = `rgba(92,122,85,${0.25 + mag * 0.6})`
          else if (has && net < 0) bg = `rgba(111,140,171,${0.25 + mag * 0.6})`
          const isSelected = selectedDate === key
          return (
            <button
              key={key}
              onClick={() => has && selectDate(key)}
              disabled={!has}
              title={has ? `${MONTHS_SHORT[month]} ${day} · net ${net >= 0 ? '+' : '−'}${money0(net)}` : undefined}
              aria-label={has ? `${MONTHS_SHORT[month]} ${day}, net ${net >= 0 ? 'positive' : 'negative'} ${money0(net)}` : undefined}
              aria-pressed={isSelected}
              className={`aspect-square rounded transition-transform ${has ? 'cursor-pointer hover:scale-125' : 'cursor-default'} ${isSelected ? 'ring-2 ring-sage-600' : ''}`}
              style={{ backgroundColor: bg }}
            />
          )
        })}
      </div>
    </div>
  )
}
