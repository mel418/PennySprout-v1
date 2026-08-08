'use client'
import { useState, useEffect, useMemo, useCallback } from 'react'
import { ChevronLeft, ChevronRight, ChevronDown, ChevronRight as ChevronRightSm, CalendarDays, X } from 'lucide-react'
import { normalizeCategory, categoryColor, categoryTint, calcSpending, calcIncome, categoryTotals } from '@/lib/categories'
import {
  parseDate, toKey, fromKey, MONTHS_SHORT,
  periodRange, periodLabel, stepPeriod, startOfWeek, addDays,
} from '@/lib/date'
import { money, moneyExact, moneyCompact } from '@/lib/format'
import { useTransactions } from './useTransactions'
import { useTargetPurchaseMatches } from './useTargetPurchaseMatches'
import { TargetItemsToggle, TargetItemsList } from './TargetItemsList'
import LoadError from './LoadError'
import { DashboardSkeleton } from './ui/Skeletons'
import EmptyState from './ui/EmptyState'
import { IconButton } from './ui/Button'
import { PageHeader } from './ui/SectionHeader'
import Doodle from './ui/Doodle'

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const SCALES = [
  { id: 'week',  label: 'Week'  },
  { id: 'month', label: 'Month' },
  { id: 'year',  label: 'Year'  },
]

// Calendar cells are the one place in the app where a full figure genuinely
// doesn't fit: seven columns across a 375px phone leaves ~45px per day. Rather
// than shrink the type below 12px, the grid abbreviates ($1.2k) and the day
// inspector shows the exact amount on tap. money0 keeps the full figure for
// the roomier week cells and the year-view tooltips.
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
      else if (cat !== 'Bills & Payments' && cat !== 'Transfer') spending += amt
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

  const setScaleAndClear = useCallback((id) => {
    setScale(id)
    clearSelection()
  }, [clearSelection])

  // Keyboard: ←/→ change period, W/M/Y switch scale, T jumps to latest
  // activity, Esc deselects. Suppressed while typing or with a modifier held.
  useEffect(() => {
    const onKey = (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return
      const t = e.target
      if (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable) return
      const key = e.key.toLowerCase()
      if (e.key === 'ArrowLeft') { e.preventDefault(); go(-1) }
      else if (e.key === 'ArrowRight') { e.preventDefault(); go(1) }
      else if (key === 'w') { e.preventDefault(); setScaleAndClear('week') }
      else if (key === 'm') { e.preventDefault(); setScaleAndClear('month') }
      else if (key === 'y') { e.preventDefault(); setScaleAndClear('year') }
      else if (key === 't') { e.preventDefault(); jumpToLatest() }
      else if (e.key === 'Escape') { clearSelection() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [go, jumpToLatest, clearSelection, setScaleAndClear])

  if (error) return <LoadError error={error} onRetry={retry} />

  if (isLoading || !anchor) return <DashboardSkeleton />

  if (allTransactions.length === 0) {
    return (
      <EmptyState
        icon={CalendarDays}
        title="Your calendar is still blank"
        description="Upload a statement and your spending will fill in, day by day."
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
    <div className="space-y-5">

      <PageHeader
        title="Calendar"
        subtitle="Your money, laid out day by day — like entries in a journal."
        doodle="flower"
      />

      {/* ── Unified calendar panel: toolbar + grid + inspector ── */}
      <div className="card-soft overflow-hidden">

        {/* Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3.5 sm:px-5">
          <div className="flex min-w-0 items-center gap-2">
            <h2 className="truncate text-lg font-bold tracking-tight text-ink sm:text-xl" aria-live="polite">
              {periodLabel(scale, anchor)}
            </h2>
            <button
              onClick={jumpToLatest}
              className="min-h-9 rounded-full px-3 text-sm font-semibold text-sage-700 transition-colors hover:bg-sage-50"
            >
              Today
            </button>
          </div>

          <div className="flex items-center gap-2">
            {/* Scale segmented control */}
            <div className="inline-flex rounded-full bg-surface-2 p-1">
              {SCALES.map(s => (
                <button
                  key={s.id}
                  onClick={() => setScaleAndClear(s.id)}
                  aria-pressed={scale === s.id}
                  className={`min-h-9 rounded-full px-3.5 text-sm font-semibold transition-colors ${
                    scale === s.id ? 'bg-surface text-ink shadow-xs' : 'text-ink-faint hover:text-ink'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
            {/* Period nav */}
            <div className="inline-flex items-center overflow-hidden rounded-full border border-line">
              <IconButton label={`Previous ${scale}`} onClick={() => go(-1)} className="rounded-none">
                <ChevronLeft className="h-4 w-4" aria-hidden="true" />
              </IconButton>
              <span className="w-px self-stretch bg-line" aria-hidden="true" />
              <IconButton label={`Next ${scale}`} onClick={() => go(1)} className="rounded-none">
                <ChevronRight className="h-4 w-4" aria-hidden="true" />
              </IconButton>
            </div>
          </div>
        </div>

        {/* Grid + inspector. min-w-0 lets the grid column shrink below its
            content's natural width instead of shoving the inspector out of
            the clipped (overflow-hidden) panel. */}
        <div className="lg:grid lg:grid-cols-[1fr_320px]">
          <div className="min-w-0 p-3 sm:p-4">
            {scale === 'month' && (
              <MonthGrid {...{ anchor, byDate, dayTotals, selectedDate, selectDate, latestKey }} />
            )}
            {scale === 'week' && (
              <WeekGrid {...{ anchor, byDate, dayTotals, selectedDate, selectDate }} />
            )}
            {scale === 'year' && (
              <YearGrid {...{ anchor, byDate, dayTotals, selectedDate, selectDate, openMonth }} />
            )}
            <p className="mt-3 hidden px-1 text-xs text-ink-faint lg:block">
              <kbd className="rounded-[6px] bg-surface-2 px-1.5 py-0.5 font-sans">←</kbd>{' '}
              <kbd className="rounded-[6px] bg-surface-2 px-1.5 py-0.5 font-sans">→</kbd> move ·{' '}
              <kbd className="rounded-[6px] bg-surface-2 px-1.5 py-0.5 font-sans">W</kbd>{' '}
              <kbd className="rounded-[6px] bg-surface-2 px-1.5 py-0.5 font-sans">M</kbd>{' '}
              <kbd className="rounded-[6px] bg-surface-2 px-1.5 py-0.5 font-sans">Y</kbd> scale ·{' '}
              <kbd className="rounded-[6px] bg-surface-2 px-1.5 py-0.5 font-sans">T</kbd> today ·{' '}
              <kbd className="rounded-[6px] bg-surface-2 px-1.5 py-0.5 font-sans">Esc</kbd> deselect
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
  const {
    matchedIds: targetMatchedIds,
    expandedId: expandedTargetId,
    itemsById: targetItemsById,
    loadingId: targetItemsLoadingId,
    toggle: toggleTargetItems,
  } = useTargetPurchaseMatches()
  return (
    <div className="animate-expand">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-faint">
            {date.toLocaleDateString('en-US', { weekday: 'long' })}
          </p>
          <h3 className="text-lg font-bold tracking-tight text-ink">
            {date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
          </h3>
          <p className="mt-0.5 text-sm tnum text-ink-faint">{txCount} transaction{txCount !== 1 ? 's' : ''}</p>
        </div>
        <IconButton label="Close day details" onClick={onClose} className="-mr-2 -mt-1">
          <X className="h-4 w-4" aria-hidden="true" />
        </IconButton>
      </div>

      {(totals.spending > 0 || totals.income > 0) && (
        <div className="mt-3 flex gap-4 border-b border-line pb-3 text-base tnum">
          {totals.spending > 0 && <span className="font-bold text-spend-600">−{money(totals.spending)}</span>}
          {totals.income > 0 && <span className="font-bold text-sage-600">+{money(totals.income)}</span>}
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
                className="flex min-h-11 w-full items-center justify-between gap-2 rounded-[var(--radius-sm)] px-2 py-2 text-left transition-colors hover:bg-surface-hover"
              >
                <span className="flex min-w-0 items-center gap-2">
                  {isOpen
                    ? <ChevronDown className="h-4 w-4 flex-shrink-0 text-sage-500" aria-hidden="true" />
                    : <ChevronRightSm className="h-4 w-4 flex-shrink-0 text-ink-faint" aria-hidden="true" />}
                  <span className="h-2.5 w-2.5 flex-shrink-0 rounded-full" style={{ backgroundColor: color }} aria-hidden="true" />
                  <span className="truncate text-sm font-medium text-ink">{category}</span>
                </span>
                <span className="flex-shrink-0 text-sm font-bold tnum text-ink">{moneyExact(total)}</span>
              </button>
              {isOpen && (
                <div className="animate-expand mb-2 ml-7 mr-2 space-y-1">
                  {transactions.map((t, i) => {
                    const hasItems = targetMatchedIds.has(t.id)
                    return (
                      <div key={t.id ?? i} className="py-1">
                        <div className="flex items-center justify-between gap-3">
                          <p className="truncate text-sm text-ink-soft">{t['Description'] || '—'}</p>
                          <div className="flex flex-shrink-0 items-center gap-1">
                            {hasItems && (
                              <TargetItemsToggle
                                description={t['Description'] || ''}
                                isOpen={expandedTargetId === t.id}
                                onClick={() => toggleTargetItems(t.id)}
                              />
                            )}
                            <span className="text-sm font-semibold tnum text-ink">
                              {moneyExact(Math.abs(parseFloat(t.Amount) || 0))}
                            </span>
                          </div>
                        </div>
                        {expandedTargetId === t.id && (
                          <div className="mt-2 pl-0.5">
                            <TargetItemsList items={targetItemsById[t.id]} isLoading={targetItemsLoadingId === t.id} />
                          </div>
                        )}
                      </div>
                    )
                  })}
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
      <p className="text-xs font-semibold uppercase tracking-wide text-ink-faint">This {scale}</p>

      <dl className="mt-3 space-y-3">
        <div className="flex items-center justify-between text-sm">
          <dt className="text-ink-soft">Income</dt>
          <dd className="font-bold tnum text-sage-600">+{money(summary.income)}</dd>
        </div>
        <div className="flex items-center justify-between text-sm">
          <dt className="text-ink-soft">Spending</dt>
          <dd className="font-bold tnum text-spend-600">−{money(summary.spending)}</dd>
        </div>
        <div className="flex items-center justify-between border-t border-line pt-3 text-sm">
          <dt className="text-ink-soft">Net</dt>
          <dd className={`font-bold tnum ${net >= 0 ? 'text-sage-600' : 'text-spend-600'}`}>
            {net >= 0 ? '+' : '−'}{money(net)}
          </dd>
        </div>
      </dl>

      {summary.topCats.length > 0 && (
        <>
          <p className="mb-2.5 mt-6 text-xs font-semibold uppercase tracking-wide text-ink-faint">Top categories</p>
          <ul className="space-y-2.5">
            {summary.topCats.map(({ category, amount }) => (
              <li key={category} className="flex items-center justify-between gap-2 text-sm">
                <span className="flex min-w-0 items-center gap-2">
                  <span className="h-2.5 w-2.5 flex-shrink-0 rounded-full" style={{ backgroundColor: categoryColor(category) }} aria-hidden="true" />
                  <span className="truncate text-ink-soft">{category}</span>
                </span>
                <span className="flex-shrink-0 font-semibold tnum text-ink">{money(amount)}</span>
              </li>
            ))}
          </ul>
        </>
      )}

      <p className="mt-6 flex items-center gap-1.5 text-sm text-ink-faint">
        <Doodle name="arrow" className="h-4 w-4 flex-shrink-0 -scale-x-100 text-sage-300" />
        Pick a day to see its transactions.
      </p>
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
      <div className="mb-1 grid grid-cols-7">
        {DAYS.map(d => (
          <div key={d} className="py-1.5 text-center text-xs font-semibold uppercase tracking-wide text-ink-faint">
            {/* One letter on the narrowest phones, three from sm up */}
            <span className="sm:hidden">{d[0]}</span>
            <span className="hidden sm:inline">{d}</span>
          </div>
        ))}
      </div>
      {/* Tighter gutters and cell padding on phones: seven columns of ~47px
          have to fit an amount like −$316 on ONE line at 12px. Anything
          looser and the minus sign wraps onto its own row. */}
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
              // Selection is marked by a fill AND a 2px ring, so it survives
              // both color-blindness and a dimmed screen.
              className={`relative flex min-h-[62px] flex-col items-center rounded-[var(--radius-md)] px-0.5 pb-1.5 pt-1.5 transition-all sm:min-h-[76px] sm:px-1
                ${isSelected ? 'bg-sage-50 ring-2 ring-sage-500' : ''}
                ${hasData && !isSelected ? 'cursor-pointer hover:bg-surface-hover' : ''}
                ${!hasData ? 'cursor-default' : ''}`}
            >
              <span className={`flex items-center justify-center text-sm font-semibold leading-none
                ${isLatest ? 'h-6 w-6 rounded-full bg-sage-600 text-white' : hasData ? 'h-6 text-ink' : 'h-6 text-ink-faint'}`}>
                {day}
              </span>
              {hasData && (
                <span className="mt-auto flex flex-col items-center gap-0.5 leading-tight">
                  {spending > 0 && (
                    <span className="whitespace-nowrap text-xs font-semibold tracking-tight tnum text-spend-600">−{moneyCompact(spending)}</span>
                  )}
                  {income > 0 && (
                    <span className="whitespace-nowrap text-xs font-semibold tracking-tight tnum text-sage-600">+{moneyCompact(income)}</span>
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
            className={`flex min-h-[130px] flex-col rounded-[var(--radius-md)] border p-2.5 text-left transition-all
              ${isSelected ? 'border-sage-500 bg-sage-50 ring-2 ring-sage-500' : 'border-line hover:bg-surface-hover'}
              ${!txns.length ? 'cursor-default opacity-60 hover:bg-transparent' : 'cursor-pointer'}`}
          >
            <div className="mb-2 flex items-baseline justify-between">
              <span className="text-xs font-semibold uppercase tracking-wide text-ink-faint">{DAYS[d.getDay()]}</span>
              <span className="text-base font-bold tnum text-ink">{d.getDate()}</span>
            </div>
            <div className="flex flex-1 flex-col gap-1">
              {events.map(([cat, amt]) => (
                <span
                  key={cat}
                  className="truncate rounded-[var(--radius-xs)] px-1.5 py-1 text-xs leading-tight text-ink"
                  style={{ backgroundColor: categoryTint(cat, 0.18) }}
                >
                  <span className="font-semibold">{cat}</span>{' '}
                  <span className="tnum">{money0(amt)}</span>
                </span>
              ))}
            </div>
            {(spending > 0 || income > 0) && (
              <div className="mt-2 flex items-center justify-between border-t border-line pt-1.5 text-xs tnum">
                {spending > 0 && <span className="font-semibold text-spend-600">−{money0(spending)}</span>}
                {income > 0 && <span className="font-semibold text-sage-600">+{money0(income)}</span>}
              </div>
            )}
          </button>
        )
      })}
    </div>
  )
}

// ── Year view: twelve mini month calendars (Apple Calendar style) ───────────
// Each day is a heat-tinted cell — sage for net-positive days, plum for
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
      <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1.5 px-1 text-xs text-ink-faint">
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-[4px] bg-sage-500" aria-hidden="true" />money in
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-[4px] bg-spend-500" aria-hidden="true" />money out
        </span>
        <span>· darker = larger · tap a day for detail</span>
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
          if (has && net > 0) bg = `rgba(var(--sage-heat-rgb),${0.25 + mag * 0.6})`
          else if (has && net < 0) bg = `rgba(var(--spend-heat-rgb),${0.25 + mag * 0.6})`
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
