'use client'
import { useState, useEffect, useMemo, useCallback } from 'react'
import { ChevronLeft, ChevronRight, ChevronDown, ChevronRight as ChevronRightSm, CalendarDays } from 'lucide-react'
import { ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'
import { normalizeCategory, categoryColor } from '@/lib/categories'
import {
  parseDate, toKey, fromKey, MONTHS_SHORT,
  periodRange, periodLabel, stepPeriod, startOfWeek, addDays,
} from '@/lib/date'
import { useTransactions } from './useTransactions'
import LoadError from './LoadError'

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
  const [chartOpen, setChartOpen]   = useState(true)

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

  // Daily cash-flow rows for the active month/week (drives the trend chart)
  const trend = useMemo(() => {
    if (!anchor || scale === 'year') return []
    const [start, end] = periodRange(scale, anchor)
    let running = 0
    const rows = []
    for (let d = new Date(start); d <= end; d = addDays(d, 1)) {
      const { spending, income } = dayTotals(byDate[toKey(d)] || [])
      running += income - spending
      rows.push({ label: scale === 'week' ? DAYS[d.getDay()] : d.getDate(), spending, income, cumulative: running })
    }
    return rows
  }, [anchor, scale, byDate, dayTotals])

  const hasActivity = useMemo(() => trend.some(r => r.spending > 0 || r.income > 0), [trend])

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

  const go = useCallback((dir) => {
    setAnchor(a => stepPeriod(scale, a, dir))
    setSelectedDate(null)
    setExpandedCategory(null)
  }, [scale])

  const jumpToLatest = useCallback(() => {
    if (latest) setAnchor(new Date(latest.getFullYear(), latest.getMonth(), latest.getDate()))
    setSelectedDate(null)
  }, [latest])

  // Keyboard shortcuts: ←/→ change period, T jumps to latest activity
  useEffect(() => {
    const onKey = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return
      if (e.key === 'ArrowLeft') { e.preventDefault(); go(-1) }
      else if (e.key === 'ArrowRight') { e.preventDefault(); go(1) }
      else if (e.key === 't' || e.key === 'T') { e.preventDefault(); jumpToLatest() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [go, jumpToLatest])

  if (error) return <LoadError error={error} onRetry={retry} />

  if (isLoading || !anchor) {
    return (
      <div className="flex justify-center p-12">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-sage-500 border-t-transparent" />
      </div>
    )
  }

  if (allTransactions.length === 0) {
    return (
      <div className="bg-surface border border-line rounded-2xl shadow-sm text-center p-12">
        <CalendarDays className="mx-auto h-12 w-12 text-sage-300 mb-4" />
        <h3 className="text-base font-semibold text-ink mb-1">No transaction history yet</h3>
        <p className="text-sm text-ink-soft">Upload statements to see your spending calendar.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">

      {/* ── Header: scale toggle + period nav ── */}
      <div className="bg-surface rounded-2xl border border-line shadow-sm p-4 sm:p-5">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          {/* Scale segmented control */}
          <div className="inline-flex bg-surface-2 rounded-xl p-1">
            {SCALES.map(s => (
              <button
                key={s.id}
                onClick={() => { setScale(s.id); setSelectedDate(null); setExpandedCategory(null) }}
                className={`px-3.5 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                  scale === s.id ? 'bg-surface text-ink shadow-sm' : 'text-ink-faint hover:text-ink'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>

          {/* Period nav */}
          <div className="flex items-center gap-1">
            <button onClick={() => go(-1)} className="p-2 rounded-lg hover:bg-surface-hover text-ink-faint hover:text-sage-700 transition-colors">
              <ChevronLeft className="h-5 w-5" />
            </button>
            <h2 className="text-sm sm:text-base font-semibold text-ink min-w-[150px] text-center">
              {periodLabel(scale, anchor)}
            </h2>
            <button onClick={() => go(1)} className="p-2 rounded-lg hover:bg-surface-hover text-ink-faint hover:text-sage-700 transition-colors">
              <ChevronRight className="h-5 w-5" />
            </button>
            <button onClick={jumpToLatest} className="ml-1 px-2.5 py-1.5 text-xs font-medium text-sage-700 hover:bg-surface-hover rounded-lg transition-colors">
              Today
            </button>
          </div>
        </div>
        <p className="hidden sm:block text-[11px] text-ink-faint mt-2.5">
          Tip: use <kbd className="px-1 py-0.5 rounded bg-surface-2 font-sans">←</kbd>{' '}
          <kbd className="px-1 py-0.5 rounded bg-surface-2 font-sans">→</kbd> to move ·{' '}
          <kbd className="px-1 py-0.5 rounded bg-surface-2 font-sans">T</kbd> for latest
        </p>
      </div>

      {/* ── Active scale view ── */}
      {scale === 'month' && (
        <MonthView {...{ anchor, byDate, dayTotals, selectedDate, setSelectedDate, setExpandedCategory }} />
      )}
      {scale === 'week' && (
        <WeekView {...{ anchor, byDate, dayTotals, selectedDate, setSelectedDate, setExpandedCategory }} />
      )}
      {scale === 'year' && (
        <YearView {...{ anchor, byDate, dayTotals, selectedDate, setSelectedDate, setExpandedCategory }} />
      )}

      {/* ── Selected date breakdown ── */}
      {selectedDate && selectedDateData && (
        <div className="bg-surface rounded-2xl border border-line shadow-sm overflow-hidden animate-expand">
          <div className="px-5 py-4 border-b border-line">
            <h3 className="font-semibold text-ink">
              {fromKey(selectedDate).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
            </h3>
            <p className="text-xs text-ink-faint mt-0.5">
              {(byDate[selectedDate] || []).length} transaction{(byDate[selectedDate] || []).length !== 1 ? 's' : ''}
            </p>
          </div>
          <div className="divide-y divide-line">
            {selectedDateData.map(({ category, transactions, total }) => {
              const isOpen = expandedCategory === category
              const color = categoryColor(category)
              return (
                <div key={category} style={{ borderLeft: `3px solid ${color}` }}>
                  <button
                    onClick={() => setExpandedCategory(isOpen ? null : category)}
                    className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-surface-hover transition-colors text-left"
                  >
                    <div className="flex items-center gap-2.5">
                      {isOpen ? <ChevronDown className="h-4 w-4 text-sage-500" /> : <ChevronRightSm className="h-4 w-4 text-ink-faint" />}
                      <span className="h-2.5 w-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                      <span className="text-sm font-medium text-ink">{category}</span>
                      <span className="text-xs text-ink-faint">{transactions.length} txn{transactions.length !== 1 ? 's' : ''}</span>
                    </div>
                    <span className="text-sm font-semibold text-ink flex-shrink-0">${total.toFixed(2)}</span>
                  </button>
                  {isOpen && (
                    <div className="px-4 pb-3 pt-1 space-y-1.5 bg-surface-2 animate-expand">
                      {transactions.map((t, i) => {
                        const desc = t['Description'] || '—'
                        const amount = Math.abs(parseFloat(t.Amount) || 0)
                        return (
                          <div key={i} className="flex justify-between items-center px-3 py-2 bg-surface rounded-lg border border-line">
                            <p className="text-sm text-ink-soft truncate mr-4">{desc}</p>
                            <span className="text-sm font-medium text-ink flex-shrink-0">${amount.toFixed(2)}</span>
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
      )}

      {/* ── Cash-flow trend (month / week only) ── */}
      {scale !== 'year' && (
        <div className="bg-surface rounded-2xl border border-line shadow-sm overflow-hidden">
          <button
            onClick={() => setChartOpen(o => !o)}
            aria-expanded={chartOpen}
            className="w-full flex items-center justify-between gap-2 px-4 sm:px-6 py-4 hover:bg-surface-hover transition-colors text-left"
          >
            <span className="flex items-center gap-2 min-w-0">
              <ChevronDown className={`h-4 w-4 text-sage-500 flex-shrink-0 transition-transform ${chartOpen ? '' : '-rotate-90'}`} />
              <span className="text-sm font-semibold text-ink truncate">Cash Flow — {periodLabel(scale, anchor)}</span>
            </span>
            <div className="hidden md:flex items-center gap-3 text-xs text-ink-faint flex-shrink-0">
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-sage-500" />Income</span>
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-peach-400" />Spending</span>
              <span className="flex items-center gap-1.5"><span className="h-0.5 w-3.5 bg-sage-700" />Net balance</span>
            </div>
          </button>

          {chartOpen && (
            <div className="px-1 sm:px-4 pb-4">
              {hasActivity ? (
                <div className="h-[220px] sm:h-[260px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={trend} margin={{ top: 10, right: 4, left: -12, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#EFEDE6" />
                      <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#9A968C' }} axisLine={false} tickLine={false} minTickGap={8} interval="preserveStartEnd" />
                      <YAxis tick={{ fontSize: 10, fill: '#9A968C' }} axisLine={false} tickLine={false} width={44}
                        tickFormatter={v => `$${Math.abs(v) >= 1000 ? `${(v / 1000).toFixed(1)}k` : v}`} />
                      <Tooltip contentStyle={{ borderRadius: '10px', border: '1px solid #EAE8E1', boxShadow: '0 1px 2px rgb(0 0 0 / 0.05)', fontSize: '12px' }}
                        formatter={(value, name) => [`$${Number(value).toFixed(2)}`, name]} />
                      <ReferenceLine y={0} stroke="#d1d5db" strokeWidth={1} />
                      <Bar dataKey="income"   name="Income"      fill="#88a892" radius={[3, 3, 0, 0]} maxBarSize={14} />
                      <Bar dataKey="spending" name="Spending"    fill="#e8a87c" radius={[3, 3, 0, 0]} maxBarSize={14} />
                      <Line type="monotone" dataKey="cumulative" name="Net balance" stroke="#3f6650" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="flex items-center justify-center h-[160px] text-sm text-ink-faint">No activity this {scale}.</div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Month grid ──────────────────────────────────────────────────────────────
function MonthView({ anchor, byDate, dayTotals, selectedDate, setSelectedDate, setExpandedCategory }) {
  const year = anchor.getFullYear()
  const month = anchor.getMonth()
  const firstDow = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const cells = [...Array(firstDow).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)]

  return (
    <div className="bg-surface rounded-2xl border border-line shadow-sm p-4 sm:p-6">
      <div className="grid grid-cols-7 mb-1">
        {DAYS.map(d => <div key={d} className="text-center text-xs sm:text-sm font-medium text-ink-faint py-1">{d}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-0.5">
        {cells.map((day, i) => {
          if (!day) return <div key={`b-${i}`} />
          const key = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
          const txns = byDate[key] || []
          const hasData = txns.length > 0
          const isSelected = selectedDate === key
          const { spending, income } = dayTotals(txns)
          return (
            <button
              key={key}
              onClick={() => { if (!hasData) return; setSelectedDate(isSelected ? null : key); setExpandedCategory(null) }}
              disabled={!hasData}
              className={`relative flex flex-col items-center justify-start rounded-xl p-1 pt-2 min-h-[54px] sm:min-h-[68px] transition-all
                ${isSelected ? 'bg-sage-600 shadow-sm' : ''}
                ${hasData && !isSelected ? 'hover:bg-surface-hover cursor-pointer' : ''}
                ${!hasData ? 'cursor-default' : ''}`}
            >
              <span className={`text-sm sm:text-base font-semibold leading-none ${isSelected ? 'text-white' : hasData ? 'text-ink' : 'text-ink-faint/50'}`}>{day}</span>
              {hasData && (
                <div className="mt-1 flex flex-col gap-0.5 w-full px-0.5">
                  {spending > 0 && (
                    <span className={`text-[10px] sm:text-xs font-medium rounded px-1 text-center leading-tight ${isSelected ? 'bg-white/20 text-white' : 'bg-peach-50 text-peach-600'}`}>
                      −{money0(spending)}
                    </span>
                  )}
                  {income > 0 && (
                    <span className={`text-[10px] sm:text-xs font-medium rounded px-1 text-center leading-tight ${isSelected ? 'bg-white/20 text-white' : 'bg-sage-50 text-sage-600'}`}>
                      +{money0(income)}
                    </span>
                  )}
                </div>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ── Week strip (Google-Calendar style event chips) ──────────────────────────
function WeekView({ anchor, byDate, dayTotals, selectedDate, setSelectedDate, setExpandedCategory }) {
  const start = startOfWeek(anchor)
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i))

  return (
    <div className="bg-surface rounded-2xl border border-line shadow-sm p-3 sm:p-4">
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
              onClick={() => { if (!txns.length) return; setSelectedDate(isSelected ? null : key); setExpandedCategory(null) }}
              disabled={!txns.length}
              className={`flex flex-col text-left rounded-xl border p-2.5 min-h-[120px] transition-all
                ${isSelected ? 'border-sage-400 bg-sage-50' : 'border-line hover:bg-surface-hover'}
                ${!txns.length ? 'opacity-60 cursor-default hover:bg-transparent' : 'cursor-pointer'}`}
            >
              <div className="flex items-baseline justify-between mb-1.5">
                <span className="text-xs font-medium text-ink-faint">{DAYS[d.getDay()]}</span>
                <span className="text-sm font-semibold text-ink">{d.getDate()}</span>
              </div>
              <div className="flex flex-col gap-1 flex-1">
                {events.map(([cat, amt]) => (
                  <span key={cat} className="text-[10px] leading-tight rounded px-1.5 py-0.5 truncate"
                    style={{ backgroundColor: `${categoryColor(cat)}22`, color: '#33322E' }}>
                    <span className="font-medium">{cat}</span> {money0(amt)}
                  </span>
                ))}
              </div>
              {(spending > 0 || income > 0) && (
                <div className="mt-1.5 pt-1.5 border-t border-line flex items-center justify-between text-[10px]">
                  {spending > 0 && <span className="text-peach-600 font-medium">−{money0(spending)}</span>}
                  {income > 0 && <span className="text-sage-600 font-medium">+{money0(income)}</span>}
                </div>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ── Year heatmap (GitHub-style daily net intensity) ─────────────────────────
function YearView({ anchor, byDate, dayTotals, selectedDate, setSelectedDate, setExpandedCategory }) {
  const year = anchor.getFullYear()
  const { weeks, max, monthCols } = useMemo(() => {
    const start = startOfWeek(new Date(year, 0, 1))
    const end = new Date(year, 11, 31)
    const weeks = []
    const monthCols = []
    let max = 0
    let lastMonth = -1
    let cursor = new Date(start)
    let col = 0
    while (cursor <= end) {
      const week = []
      for (let i = 0; i < 7; i++) {
        const inYear = cursor.getFullYear() === year
        const { net } = dayTotals(byDate[toKey(cursor)] || [])
        if (inYear) max = Math.max(max, Math.abs(net))
        week.push({ key: toKey(cursor), date: new Date(cursor), net, inYear, has: !!byDate[toKey(cursor)] })
        if (inYear && cursor.getMonth() !== lastMonth && cursor.getDate() <= 7) {
          monthCols.push({ col, month: cursor.getMonth() })
          lastMonth = cursor.getMonth()
        }
        cursor.setDate(cursor.getDate() + 1)
      }
      weeks.push(week)
      col++
    }
    return { weeks, max, monthCols }
  }, [year, byDate, dayTotals])

  return (
    <div className="bg-surface rounded-2xl border border-line shadow-sm p-4 sm:p-5">
      <div className="overflow-x-auto">
        <div className="min-w-fit">
          {/* Month labels */}
          <div className="flex gap-1 mb-1 ml-0">
            {weeks.map((_, wi) => {
              const m = monthCols.find(mc => mc.col === wi)
              return <div key={wi} className="w-5 sm:w-3 text-[9px] text-ink-faint">{m ? MONTHS_SHORT[m.month] : ''}</div>
            })}
          </div>
          <div className="flex gap-1">
            {weeks.map((week, wi) => (
              <div key={wi} className="flex flex-col gap-1">
                {week.map(cell => {
                  const mag = max > 0 ? Math.min(1, Math.abs(cell.net) / max) : 0
                  let bg = cell.inYear ? '#F2F1EC' : 'transparent'
                  if (cell.inYear && cell.has && cell.net > 0) bg = `rgba(92,122,85,${0.2 + mag * 0.65})`
                  else if (cell.inYear && cell.has && cell.net < 0) bg = `rgba(209,138,91,${0.2 + mag * 0.65})`
                  const isSelected = selectedDate === cell.key
                  return (
                    <button
                      key={cell.key}
                      onClick={() => { if (!cell.has) return; setSelectedDate(isSelected ? null : cell.key); setExpandedCategory(null) }}
                      disabled={!cell.has}
                      title={cell.inYear ? `${cell.date.toLocaleDateString()} · net ${cell.net >= 0 ? '+' : '−'}${money0(cell.net)}` : ''}
                      aria-label={cell.inYear ? `${cell.date.toLocaleDateString()}, net ${cell.net >= 0 ? 'positive' : 'negative'} ${money0(cell.net)}` : undefined}
                      aria-pressed={isSelected}
                      // 20px cells on touch screens (the grid scrolls), 12px on desktop
                      className={`h-5 w-5 sm:h-3 sm:w-3 rounded-sm ${cell.has ? 'cursor-pointer hover:ring-2 hover:ring-sage-300' : 'cursor-default'} ${isSelected ? 'ring-2 ring-sage-600' : ''}`}
                      style={{ backgroundColor: bg }}
                    />
                  )
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-3 mt-4 text-[10px] text-ink-faint">
        <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm bg-sage-500" />net positive</span>
        <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm bg-peach-600" />net negative</span>
        <span>· darker = larger · click a day for detail</span>
      </div>
    </div>
  )
}
