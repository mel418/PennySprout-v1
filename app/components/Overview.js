'use client'
import { useState, useEffect, useMemo } from 'react'
import { AreaChart, Area, XAxis, ResponsiveContainer, Tooltip } from 'recharts'
import {
  CalendarDays, ArrowUpRight, ArrowDownRight, TrendingUp, Receipt,
  Flame, Sparkles, ChevronRight, Wallet,
} from 'lucide-react'
import { normalizeCategory, categoryColor, calcSpending, calcIncome, categoryTotals } from '@/lib/categories'
import { detectRecurring } from '@/lib/recurring'
import { parseDate, toKey, MONTHS, MONTHS_SHORT } from '@/lib/date'

const money = (n) => `$${Math.abs(n).toLocaleString('en-US', { maximumFractionDigits: 0 })}`
const moneyExact = (n) => `$${Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

// Small reusable modular card.
function Card({ children, className = '', title, hint, icon: Icon }) {
  return (
    <div className={`bg-surface border border-line rounded-2xl shadow-sm ${className}`}>
      {title && (
        <div className="flex items-center justify-between px-5 pt-4 pb-3">
          <div className="flex items-center gap-2">
            {Icon && <Icon className="h-4 w-4 text-sage-500" />}
            <h3 className="text-sm font-semibold text-ink">{title}</h3>
          </div>
          {hint && <span className="text-xs text-ink-faint">{hint}</span>}
        </div>
      )}
      {children}
    </div>
  )
}

export default function Overview({ onOpenCalendar, onOpenUpload }) {
  const [allTransactions, setAllTransactions] = useState([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    fetch('/api/files')
      .then(r => r.json())
      .then(data => setAllTransactions((data.files || []).flatMap(f => f.transactions || [])))
      .catch(() => setAllTransactions([]))
      .finally(() => setIsLoading(false))
  }, [])

  // Daily aggregates keyed by YYYY-MM-DD, plus the latest active date.
  const { byDate, latest } = useMemo(() => {
    const map = {}
    let latest = null
    allTransactions.forEach(t => {
      const d = parseDate(t)
      if (!d) return
      if (!latest || d > latest) latest = d
      const key = toKey(d)
      if (!map[key]) map[key] = { spending: 0, income: 0, txns: [] }
      const cat = normalizeCategory(t.Category, t.Amount)
      const amt = Math.abs(parseFloat(t.Amount) || 0)
      if (cat === 'Income') map[key].income += amt
      else if (cat !== 'Bills & Payments') map[key].spending += amt
      map[key].txns.push(t)
    })
    return { byDate: map, latest }
  }, [allTransactions])

  // Anchor month = most recent month with activity.
  const anchor = latest || new Date()
  const year = anchor.getFullYear()
  const month = anchor.getMonth()

  const monthTxns = useMemo(
    () => allTransactions.filter(t => {
      const d = parseDate(t)
      return d && d.getFullYear() === year && d.getMonth() === month
    }),
    [allTransactions, year, month]
  )

  const income = calcIncome(monthTxns)
  const spending = calcSpending(monthTxns)
  const billsTotal = monthTxns.reduce((s, t) =>
    normalizeCategory(t.Category, t.Amount) === 'Bills & Payments' ? s + Math.abs(parseFloat(t.Amount) || 0) : s, 0)
  const net = income - spending - billsTotal
  const savingsRate = income > 0 ? Math.max(0, Math.round((net / income) * 100)) : null

  const cats = useMemo(() => categoryTotals(monthTxns).slice(0, 6), [monthTxns])
  const catMax = cats[0]?.amount || 1

  const recurring = useMemo(
    () => detectRecurring(allTransactions, { today: latest || new Date() }).slice(0, 5),
    [allTransactions, latest]
  )

  // ── Cash-flow heatmap: last 16 weeks ending at the latest active week ──
  const heatmap = useMemo(() => {
    if (!latest) return { weeks: [], max: 0 }
    const end = new Date(latest.getFullYear(), latest.getMonth(), latest.getDate())
    end.setDate(end.getDate() + (6 - end.getDay())) // end of that week (Sat)
    const start = new Date(end)
    start.setDate(start.getDate() - (16 * 7 - 1))
    const weeks = []
    let max = 0
    let cursor = new Date(start)
    while (cursor <= end) {
      const week = []
      for (let i = 0; i < 7; i++) {
        const key = toKey(cursor)
        const d = byDate[key]
        const netDay = d ? d.income - d.spending : 0
        max = Math.max(max, Math.abs(netDay))
        week.push({ key, date: new Date(cursor), net: netDay, has: !!d })
        cursor.setDate(cursor.getDate() + 1)
      }
      weeks.push(week)
    }
    return { weeks, max }
  }, [byDate, latest])

  // ── Monthly net trend sparkline across available history ──
  const monthlyTrend = useMemo(() => {
    const m = {}
    allTransactions.forEach(t => {
      const d = parseDate(t)
      if (!d) return
      const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      if (!m[k]) m[k] = { spending: 0, income: 0 }
      const cat = normalizeCategory(t.Category, t.Amount)
      const amt = Math.abs(parseFloat(t.Amount) || 0)
      if (cat === 'Income') m[k].income += amt
      else if (cat !== 'Bills & Payments') m[k].spending += amt
    })
    return Object.entries(m).sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => ({ month: k, net: v.income - v.spending }))
  }, [allTransactions])

  // ── Gentle activity indicators ──
  const streaks = useMemo(() => {
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    const lastDay = (latest && latest.getMonth() === month && latest.getFullYear() === year) ? latest.getDate() : daysInMonth
    let active = 0, noSpend = 0, totalSpend = 0
    for (let day = 1; day <= lastDay; day++) {
      const key = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
      const d = byDate[key]
      if (d && (d.spending > 0 || d.income > 0)) active++
      if (!d || d.spending === 0) noSpend++
      if (d) totalSpend += d.spending
    }
    const avgDaily = active > 0 ? spending / active : 0
    let underAvg = 0
    for (let day = 1; day <= lastDay; day++) {
      const key = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
      const d = byDate[key]
      if (d && d.spending > 0 && d.spending <= avgDaily) underAvg++
    }
    return { noSpend, underAvg, avgDaily }
  }, [byDate, year, month, latest, spending])

  if (isLoading) {
    return (
      <div className="flex justify-center p-12">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-sage-500 border-t-transparent" />
      </div>
    )
  }

  if (allTransactions.length === 0) {
    return (
      <div className="bg-surface border border-line rounded-2xl shadow-sm text-center p-12">
        <Wallet className="mx-auto h-12 w-12 text-sage-300 mb-4" />
        <h3 className="text-base font-semibold text-ink mb-1">Welcome to your command center</h3>
        <p className="text-sm text-ink-soft mb-5 max-w-sm mx-auto">
          Upload a bank or card statement and your finances will appear here — laid out calmly across time.
        </p>
        <button onClick={onOpenUpload}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-sage-600 hover:bg-sage-700 text-white text-sm font-semibold rounded-xl transition-colors">
          Upload a statement <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    )
  }

  // Mini month calendar cells
  const firstDow = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const cells = [...Array(firstDow).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)]
  const dayMax = Math.max(1, ...cells.filter(Boolean).map(day => {
    const key = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    return byDate[key]?.spending || 0
  }))

  return (
    <div className="space-y-4">

      {/* Greeting */}
      <div className="flex items-end justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-ink tracking-tight">Overview</h1>
          <p className="text-sm text-ink-soft mt-0.5">{MONTHS[month]} {year} · your money at a glance</p>
        </div>
        <button onClick={onOpenCalendar}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-sage-700 hover:text-sage-800 transition-colors">
          <CalendarDays className="h-4 w-4" /> Open calendar
        </button>
      </div>

      {/* ── Budget health strip ── */}
      <Card>
        <div className="grid grid-cols-2 lg:grid-cols-4 divide-y divide-line lg:divide-y-0 lg:divide-x">
          <div className="p-5">
            <div className="flex items-center gap-1.5 text-xs font-medium text-ink-faint uppercase tracking-wide">
              <ArrowUpRight className="h-3.5 w-3.5 text-sage-500" /> Income
            </div>
            <p className="text-2xl font-bold text-sage-600 mt-1">{money(income)}</p>
          </div>
          <div className="p-5">
            <div className="flex items-center gap-1.5 text-xs font-medium text-ink-faint uppercase tracking-wide">
              <ArrowDownRight className="h-3.5 w-3.5 text-peach-600" /> Spending
            </div>
            <p className="text-2xl font-bold text-ink mt-1">{money(spending)}</p>
            <p className="text-xs text-ink-faint mt-1">+ {money(billsTotal)} bills</p>
          </div>
          <div className="p-5">
            <div className="flex items-center gap-1.5 text-xs font-medium text-ink-faint uppercase tracking-wide">
              <Wallet className="h-3.5 w-3.5 text-blue-500" /> Net flow
            </div>
            <p className={`text-2xl font-bold mt-1 ${net >= 0 ? 'text-sage-600' : 'text-peach-600'}`}>
              {net >= 0 ? '+' : '−'}{money(net)}
            </p>
          </div>
          <div className="p-5">
            <div className="flex items-center gap-1.5 text-xs font-medium text-ink-faint uppercase tracking-wide">
              <TrendingUp className="h-3.5 w-3.5 text-sage-500" /> Saved
            </div>
            <p className="text-2xl font-bold text-ink mt-1">{savingsRate !== null ? `${savingsRate}%` : '—'}</p>
            {savingsRate !== null && (
              <div className="mt-2 h-1.5 rounded-full bg-surface-2 overflow-hidden">
                <div className="h-full rounded-full bg-sage-500" style={{ width: `${Math.min(100, savingsRate)}%` }} />
              </div>
            )}
          </div>
        </div>
        {savingsRate !== null && (
          <div className="px-5 pb-4 -mt-1">
            <p className="text-xs text-ink-soft">
              {net >= 0
                ? `Nice — you kept ${money(net)} this month. Every bit of breathing room counts.`
                : `You spent a little more than came in this month. A small adjustment next month can rebalance it.`}
            </p>
          </div>
        )}
      </Card>

      {/* ── Mini calendar + Recurring bills ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Mini calendar */}
        <Card title={`${MONTHS[month]} activity`} hint="tap to open" icon={CalendarDays}>
          <button onClick={onOpenCalendar} className="block w-full text-left px-3 pb-4">
            <div className="grid grid-cols-7 mb-1">
              {['S','M','T','W','T','F','S'].map((d, i) => (
                <div key={i} className="text-center text-[10px] font-medium text-ink-faint py-1">{d}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {cells.map((day, i) => {
                if (!day) return <div key={`b-${i}`} className="aspect-square" />
                const key = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
                const d = byDate[key]
                const intensity = d ? Math.min(1, d.spending / dayMax) : 0
                const bg = d && d.spending > 0
                  ? `rgba(232,168,124,${0.15 + intensity * 0.6})` // peach by spend intensity
                  : d && d.income > 0 ? 'rgba(92,122,85,0.18)' : 'transparent'
                return (
                  <div key={key}
                    className="aspect-square rounded-lg flex items-center justify-center text-[11px] font-medium text-ink-soft relative"
                    style={{ backgroundColor: bg }}>
                    {day}
                    {d && d.income > 0 && (
                      <span className="absolute bottom-0.5 h-1 w-1 rounded-full bg-sage-500" />
                    )}
                  </div>
                )
              })}
            </div>
            <div className="flex items-center gap-3 mt-3 text-[10px] text-ink-faint">
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-peach-400" />spend</span>
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-sage-500" />income</span>
            </div>
          </button>
        </Card>

        {/* Recurring bills timeline */}
        <Card title="Upcoming bills" hint={`${recurring.length} recurring`} icon={Receipt}>
          <div className="px-5 pb-4">
            {recurring.length === 0 ? (
              <p className="text-sm text-ink-soft py-6 text-center">
                No recurring charges detected yet. They’ll appear as your history grows.
              </p>
            ) : (
              <ol className="relative border-l border-line ml-2 space-y-4 pt-1">
                {recurring.map(r => (
                  <li key={r.key} className="ml-4">
                    <span className="absolute -left-[5px] mt-1.5 h-2.5 w-2.5 rounded-full bg-blue-500 border-2 border-surface" />
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-ink truncate">{r.label}</p>
                        <p className="text-xs text-ink-faint">
                          {r.frequency} · next {MONTHS_SHORT[r.nextDate.getMonth()]} {r.nextDate.getDate()}
                        </p>
                      </div>
                      <span className="text-sm font-semibold text-ink flex-shrink-0">{money(r.amount)}</span>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </Card>
      </div>

      {/* ── Cash-flow heatmap ── */}
      <Card title="Cash-flow heatmap" hint="last 16 weeks" icon={Flame}>
        <div className="px-5 pb-4 overflow-x-auto">
          <div className="flex gap-1 min-w-fit">
            {heatmap.weeks.map((week, wi) => (
              <div key={wi} className="flex flex-col gap-1">
                {week.map(cell => {
                  const mag = heatmap.max > 0 ? Math.min(1, Math.abs(cell.net) / heatmap.max) : 0
                  let bg = '#F2F1EC'
                  if (cell.has && cell.net > 0) bg = `rgba(92,122,85,${0.2 + mag * 0.65})`
                  else if (cell.has && cell.net < 0) bg = `rgba(209,138,91,${0.2 + mag * 0.65})`
                  return (
                    <div key={cell.key}
                      title={`${cell.date.toLocaleDateString()} · net ${cell.net >= 0 ? '+' : '−'}${moneyExact(cell.net)}`}
                      className="h-3 w-3 rounded-sm"
                      style={{ backgroundColor: bg }} />
                  )
                })}
              </div>
            ))}
          </div>
          <div className="flex items-center gap-3 mt-3 text-[10px] text-ink-faint">
            <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm bg-sage-500" />net positive</span>
            <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm bg-peach-600" />net negative</span>
            <span>· darker = larger</span>
          </div>
        </div>
      </Card>

      {/* ── Category breakdown cards ── */}
      <div>
        <h3 className="text-sm font-semibold text-ink mb-3 px-1">Where it went</h3>
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
          {cats.map(({ category, amount }) => {
            const color = categoryColor(category)
            const share = spending > 0 ? Math.round((amount / spending) * 100) : 0
            return (
              <div key={category} className="bg-surface border border-line rounded-xl shadow-sm p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="h-2.5 w-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                    <span className="text-sm font-medium text-ink truncate">{category}</span>
                  </div>
                  <span className="text-xs text-ink-faint flex-shrink-0">{share}%</span>
                </div>
                <p className="text-lg font-bold text-ink">{money(amount)}</p>
                <div className="mt-2 h-1.5 rounded-full bg-surface-2 overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${Math.max(4, (amount / catMax) * 100)}%`, backgroundColor: color }} />
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* ── Streaks + monthly trend ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card title="Gentle wins" icon={Sparkles} className="lg:col-span-1">
          <div className="px-5 pb-4 space-y-3">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-xl bg-sage-50 flex items-center justify-center flex-shrink-0">
                <Flame className="h-4 w-4 text-sage-600" />
              </div>
              <div>
                <p className="text-sm font-semibold text-ink">{streaks.noSpend} no-spend days</p>
                <p className="text-xs text-ink-faint">days you didn’t spend this month</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">
                <TrendingUp className="h-4 w-4 text-blue-600" />
              </div>
              <div>
                <p className="text-sm font-semibold text-ink">{streaks.underAvg} calm days</p>
                <p className="text-xs text-ink-faint">spending stayed under {money(streaks.avgDaily)}/day</p>
              </div>
            </div>
          </div>
        </Card>

        <Card title="Net trend" hint="by month" icon={TrendingUp} className="lg:col-span-2">
          <div className="px-3 pb-4">
            {monthlyTrend.length > 1 ? (
              <ResponsiveContainer width="100%" height={120}>
                <AreaChart data={monthlyTrend} margin={{ top: 6, right: 8, left: 8, bottom: 0 }}>
                  <defs>
                    <linearGradient id="netFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#5c7a55" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="#5c7a55" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  {/* hidden axis so the tooltip label is the "YYYY-MM" month, not the row index */}
                  <XAxis dataKey="month" hide />
                  <Tooltip
                    contentStyle={{ borderRadius: '10px', border: '1px solid #EAE8E1', boxShadow: '0 1px 2px rgb(0 0 0 / 0.05)', fontSize: '12px' }}
                    formatter={(v) => [`${v >= 0 ? '+' : '−'}${moneyExact(v)}`, 'Net']}
                    labelFormatter={(l) => {
                      const [y, m] = String(l).split('-')
                      return m ? `${MONTHS_SHORT[+m - 1]} ${y}` : String(l)
                    }}
                  />
                  <Area type="monotone" dataKey="net" stroke="#5c7a55" strokeWidth={2} fill="url(#netFill)" dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-ink-soft py-8 text-center">More months of history will reveal your trend.</p>
            )}
          </div>
        </Card>
      </div>
    </div>
  )
}
