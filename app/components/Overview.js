'use client'
import { useMemo } from 'react'
import { AreaChart, Area, XAxis, ResponsiveContainer, Tooltip } from 'recharts'
import { CalendarDays, ChevronRight, Receipt, Wallet, TrendingUp, TrendingDown } from 'lucide-react'
import { normalizeCategory, categoryTotals } from '@/lib/categories'
import { detectRecurring } from '@/lib/recurring'
import { parseDate, MONTHS_SHORT, monthKey, monthKeyLabel } from '@/lib/date'
import { money, moneyExact } from '@/lib/format'
import { useTransactions } from './useTransactions'
import LoadError from './LoadError'
import CategoryCards from './CategoryCards'
import Card from './ui/Card'
import { DashboardSkeleton } from './ui/Skeletons'
import EmptyState from './ui/EmptyState'
import { TOOLTIP_PROPS } from './ui/chartTheme'

// Overview is deliberately narrow in scope: net flow (the headline), spending
// pace against a typical month (soft budgeting), and where this month's money
// went. Deeper history lives on Calendar; per-month analysis on Analysis.
export default function Overview({ onOpenCalendar, onOpenUpload, onOpenAnalysis }) {
  // Shared hook distinguishes a failed load (expired session, server error)
  // from a genuinely empty account — see useTransactions.js.
  const { transactions: allTransactions, isLoading, error, retry } = useTransactions()

  // Per-month aggregates keyed 'YYYY-MM', plus the most recent active date.
  const { monthly, latest } = useMemo(() => {
    const monthly = {}
    let latest = null
    allTransactions.forEach(t => {
      const d = parseDate(t)
      if (!d) return
      if (!latest || d > latest) latest = d
      const k = monthKey(d)
      if (!monthly[k]) monthly[k] = { income: 0, spending: 0, bills: 0 }
      const cat = normalizeCategory(t.Category, t.Amount)
      const amt = Math.abs(parseFloat(t.Amount) || 0)
      if (cat === 'Income') monthly[k].income += amt
      else if (cat === 'Bills & Payments') monthly[k].bills += amt
      else monthly[k].spending += amt
    })
    return { monthly, latest }
  }, [allTransactions])

  // Anchor on the most recent month with activity. Memoized because the
  // no-data fallback (new Date()) would otherwise be a fresh object every
  // render and invalidate the memos that depend on it.
  const anchor = useMemo(() => latest || new Date(), [latest])
  const currentKey = monthKey(anchor)
  const cur = monthly[currentKey] || { income: 0, spending: 0, bills: 0 }

  // Net flow = income − spending − bills: what actually stayed this month.
  const netOf = (m) => m.income - m.spending - m.bills
  const net = netOf(cur)
  const savingsRate = cur.income > 0 ? Math.max(0, Math.round((net / cur.income) * 100)) : null

  const monthsSorted = useMemo(() => Object.keys(monthly).sort(), [monthly])

  // Hero chart: net flow by month (same formula as the headline number).
  const trendData = useMemo(
    () => monthsSorted.map(k => ({ month: k, net: netOf(monthly[k]) })),
    [monthsSorted, monthly]
  )

  const prevKey = monthsSorted[monthsSorted.indexOf(currentKey) - 1] || null
  const delta = prevKey ? net - netOf(monthly[prevKey]) : null

  // Soft budget: this month's spending vs. a "typical" month (average of up
  // to 3 prior months), with an expected-by-today pace point.
  const pace = useMemo(() => {
    const prior = monthsSorted.filter(k => k < currentKey).slice(-3)
    const typical = prior.length
      ? prior.reduce((s, k) => s + monthly[k].spending, 0) / prior.length
      : null
    const daysInMonth = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0).getDate()
    const dayOfMonth = latest && monthKey(latest) === currentKey ? latest.getDate() : daysInMonth
    const expected = typical !== null ? typical * (dayOfMonth / daysInMonth) : null
    return { typical, expected, dayOfMonth, daysInMonth }
  }, [monthsSorted, currentKey, monthly, anchor, latest])

  const monthTxns = useMemo(
    () => allTransactions.filter(t => {
      const d = parseDate(t)
      return d && monthKey(d) === currentKey
    }),
    [allTransactions, currentKey]
  )

  const cats = useMemo(() => categoryTotals(monthTxns).slice(0, 6), [monthTxns])

  const recurring = useMemo(
    () => detectRecurring(allTransactions, { today: latest || new Date() }).slice(0, 5),
    [allTransactions, latest]
  )

  if (isLoading) return <DashboardSkeleton />

  if (error) return <LoadError error={error} onRetry={retry} />

  if (allTransactions.length === 0) {
    return (
      <EmptyState
        icon={Wallet}
        title="Welcome to your command center"
        description="Upload a bank or card statement and your finances will appear here — laid out calmly across time."
        action={
          <button onClick={onOpenUpload}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-sage-600 hover:bg-sage-700 text-white text-sm font-semibold rounded-xl transition-colors">
            Upload a statement <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </button>
        }
      />
    )
  }

  // Gentle pace copy — informative, never punishing.
  let paceMessage = null
  if (pace.typical !== null) {
    if (cur.spending > pace.typical) {
      paceMessage = `You've passed a typical month by ${money(cur.spending - pace.typical)} — worth a glance before the bills land.`
    } else if (cur.spending <= pace.expected) {
      paceMessage = `${money(pace.expected - cur.spending)} under your typical pace — steady as it goes.`
    } else {
      paceMessage = `A touch ahead of typical pace, with ${money(pace.typical - cur.spending)} of a typical month left.`
    }
  }

  return (
    <div className="space-y-4">

      {/* Header */}
      <div className="flex items-end justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-ink tracking-tight">Overview</h1>
          <p className="text-sm text-ink-soft mt-0.5">{monthKeyLabel(currentKey)} · your money at a glance</p>
        </div>
        <button onClick={onOpenCalendar}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-sage-700 hover:text-sage-800 transition-colors">
          <CalendarDays className="h-4 w-4" aria-hidden="true" /> Open calendar
        </button>
      </div>

      {/* ── Net flow hero: the number + its history, one card ── */}
      <Card>
        <div className="lg:grid lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
          <div className="p-5 sm:p-6">
            <p className="text-xs font-medium text-ink-faint uppercase tracking-wide">
              Net flow · {monthKeyLabel(currentKey)}
            </p>
            <p className={`text-4xl font-bold tracking-tight mt-1.5 ${net >= 0 ? 'text-sage-600' : 'text-peach-600'}`}>
              {net >= 0 ? '+' : '−'}{money(net)}
            </p>
            {delta !== null && (
              <p className={`flex items-center gap-1 text-xs font-medium mt-2 ${delta >= 0 ? 'text-sage-600' : 'text-peach-600'}`}>
                {delta >= 0
                  ? <TrendingUp className="h-3.5 w-3.5" aria-hidden="true" />
                  : <TrendingDown className="h-3.5 w-3.5" aria-hidden="true" />}
                {delta >= 0 ? '+' : '−'}{money(delta)} vs {monthKeyLabel(prevKey)}
              </p>
            )}

            <dl className="flex flex-wrap gap-x-6 gap-y-3 mt-5 pt-4 border-t border-line">
              <div>
                <dt className="text-[11px] font-medium text-ink-faint uppercase tracking-wide">Income</dt>
                <dd className="text-sm font-semibold text-sage-600 mt-0.5">+{money(cur.income)}</dd>
              </div>
              <div>
                <dt className="text-[11px] font-medium text-ink-faint uppercase tracking-wide">Spending</dt>
                <dd className="text-sm font-semibold text-ink mt-0.5">−{money(cur.spending)}</dd>
              </div>
              <div>
                <dt className="text-[11px] font-medium text-ink-faint uppercase tracking-wide">Bills</dt>
                <dd className="text-sm font-semibold text-ink mt-0.5">−{money(cur.bills)}</dd>
              </div>
              {savingsRate !== null && (
                <div>
                  <dt className="text-[11px] font-medium text-ink-faint uppercase tracking-wide">Saved</dt>
                  <dd className="text-sm font-semibold text-ink mt-0.5">{savingsRate}%</dd>
                </div>
              )}
            </dl>
          </div>

          <div className="border-t lg:border-t-0 lg:border-l border-line px-2 pt-4 pb-2 lg:p-4 flex flex-col">
            <p className="text-[11px] font-medium text-ink-faint uppercase tracking-wide px-3 lg:px-2 mb-1">
              Net flow by month
            </p>
            {trendData.length > 1 ? (
              // Fixed height below lg: the collapsed (non-grid) parent has no
              // definite height, so the chart's height="100%" resolves to 0
              // and it silently renders nothing. On lg+ the grid stretches
              // the column, so flex-1 gives a real height to fill.
              <div className="h-[150px] lg:h-auto lg:flex-1 lg:min-h-[150px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={trendData} margin={{ top: 8, right: 8, left: 8, bottom: 4 }}>
                    <defs>
                      <linearGradient id="netFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#5c7a55" stopOpacity={0.35} />
                        <stop offset="100%" stopColor="#5c7a55" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    {/* hidden axis so the tooltip label is the month, not the row index */}
                    <XAxis dataKey="month" hide />
                    <Tooltip
                      {...TOOLTIP_PROPS}
                      formatter={(v) => [`${v >= 0 ? '+' : '−'}${moneyExact(v)}`, 'Net']}
                      labelFormatter={(l) => {
                        const [y, m] = String(l).split('-')
                        return m ? `${MONTHS_SHORT[+m - 1]} ${y}` : String(l)
                      }}
                    />
                    <Area type="monotone" dataKey="net" stroke="var(--chart-net)" strokeWidth={2} fill="url(#netFill)" dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="flex-1 flex items-center justify-center text-sm text-ink-soft py-8 text-center">
                More months of history will reveal your trend.
              </p>
            )}
          </div>
        </div>
      </Card>

      {/* ── Spending pace (soft budget) + upcoming bills ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        <Card title="This month's spending" icon={Wallet} hint={`day ${pace.dayOfMonth} of ${pace.daysInMonth}`}>
          <div className="px-5 pb-5">
            <div className="flex items-baseline gap-2 flex-wrap">
              <p className="text-2xl font-bold text-ink">{money(cur.spending)}</p>
              {pace.typical !== null && (
                <span className="text-xs text-ink-faint">of {money(pace.typical)} in a typical month</span>
              )}
            </div>

            {pace.typical !== null ? (
              <>
                <div className="relative mt-3 h-2 rounded-full bg-surface-2">
                  <div
                    className={`h-full rounded-full animate-grow-x ${cur.spending > pace.typical ? 'bg-peach-400' : 'bg-sage-500'}`}
                    style={{ width: `${Math.min(100, (cur.spending / pace.typical) * 100)}%` }}
                  />
                  {/* where a typical month would be by today */}
                  <div
                    className="absolute -top-1 -bottom-1 w-px bg-ink-faint"
                    style={{ left: `${Math.min(100, (pace.expected / pace.typical) * 100)}%` }}
                    title="Typical pace by today"
                  />
                </div>
                <p className="text-xs text-ink-soft mt-2.5">{paceMessage}</p>
                <p className="text-[11px] text-ink-faint mt-1">
                  Typical = your average over the last {Math.min(3, monthsSorted.filter(k => k < currentKey).length)} month{monthsSorted.filter(k => k < currentKey).length === 1 ? '' : 's'} · the tick marks today&apos;s expected pace
                </p>
              </>
            ) : (
              <p className="text-xs text-ink-soft mt-2">
                ≈ {money(pace.dayOfMonth > 0 ? cur.spending / pace.dayOfMonth : 0)} a day so far.
                Pace comparisons appear once you have a previous month of history.
              </p>
            )}
          </div>
        </Card>

        <Card title="Upcoming bills" icon={Receipt} hint={`${recurring.length} recurring`}>
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

      {/* ── Where it went ── */}
      <div>
        <div className="flex items-center justify-between mb-3 px-1">
          <h3 className="text-sm font-semibold text-ink">Where it went</h3>
          {onOpenAnalysis && (
            <button onClick={onOpenAnalysis}
              className="inline-flex items-center gap-1 text-xs font-medium text-sage-700 hover:text-sage-800 transition-colors">
              Full analysis <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          )}
        </div>
        <CategoryCards categories={cats} total={cur.spending} />
      </div>
    </div>
  )
}
