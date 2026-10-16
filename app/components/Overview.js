'use client'
import { useMemo } from 'react'
import { AreaChart, Area, XAxis, ResponsiveContainer, Tooltip } from 'recharts'
import { CalendarDays, ChevronRight, Receipt, Wallet, TrendingUp, TrendingDown } from 'lucide-react'
import { normalizeCategory, spendAmount, categoryTotals, SEMANTIC_COLORS, EXCLUDED_FROM_TOTALS } from '@/lib/categories'
import { detectRecurring } from '@/lib/recurring'
import { parseDate, MONTHS_SHORT, monthKey, monthKeyLabel } from '@/lib/date'
import { money, moneyExact } from '@/lib/format'
import { useTransactions } from './useTransactions'
import LoadError from './LoadError'
import CategoryCards from './CategoryCards'
import Card, { CARD_BODY } from './ui/Card'
import { DashboardSkeleton } from './ui/Skeletons'
import EmptyState from './ui/EmptyState'
import Button from './ui/Button'
import Doodle from './ui/Doodle'
import ProgressBar from './ui/Progress'
import { PageHeader, SectionHeader } from './ui/SectionHeader'
import { TOOLTIP_PROPS } from './ui/chartTheme'

// Overview is deliberately narrow in scope: net flow (the headline), spending
// pace against a typical month (soft budgeting), and where this month's money
// went. Deeper history lives on Calendar; per-month analysis on Analysis.
//
// Layout: one dark hero card carries the headline number (the only lime on the
// screen), then plain white cards carry pace, bills, and categories.
export default function Overview({ onOpenCalendar, onOpenUpload, onOpenAnalysis, onOpenBudgets }) {
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
      else if (!EXCLUDED_FROM_TOTALS.has(cat)) monthly[k].spending += spendAmount(t, cat)
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
        illustration="sprout"
        title="Nothing planted yet"
        description="Upload your first statement and we'll start growing your financial picture."
        action={
          <Button onClick={onOpenUpload}>
            Upload a statement <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </Button>
        }
      />
    )
  }

  // One warm line of framing above the numbers — encouraging, never shaming,
  // and always backed by the figure printed right beneath it.
  const headline = net >= 0
    ? { doodle: 'sprout', text: 'Your money is growing this month.' }
    : { doodle: 'leaf',   text: 'You spent more than came in this month — worth a look.' }

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
  const priorMonthCount = monthsSorted.filter(k => k < currentKey).length

  return (
    <div className="space-y-5">

      <PageHeader
        title="Overview"
        subtitle={`${monthKeyLabel(currentKey)} · your money at a glance`}
        action={
          <Button variant="secondary" size="sm" onClick={onOpenCalendar}>
            <CalendarDays className="h-4 w-4" aria-hidden="true" /> Open calendar
          </Button>
        }
      />

      {/* ── Net flow hero: the dark balance card. The number, its history, and
             the month's breakdown — the one place the lime accent leads. ── */}
      <section aria-label="Net flow" className="hero-card">
        <div className="lg:grid lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
          <div className="p-6 sm:p-7">
            <p className="flex items-center gap-1.5 text-sm font-medium text-hero-soft">
              <Doodle name={headline.doodle} className="h-4 w-4 flex-shrink-0 text-lime" />
              {headline.text}
            </p>

            <p className="mt-5 text-sm font-medium text-hero-soft">
              Net flow · {monthKeyLabel(currentKey)}
            </p>
            <p className="mt-1 font-display text-5xl sm:text-6xl font-bold tnum text-hero">
              {net >= 0 ? '+' : '−'}{money(net)}
            </p>
            {delta !== null && (
              <p className="mt-3 flex flex-wrap items-center gap-2 text-sm">
                <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 font-bold ${
                  delta >= 0 ? 'bg-lime text-lime-ink' : 'bg-spend-200 text-spend-600'
                }`}>
                  {delta >= 0
                    ? <TrendingUp className="h-4 w-4" aria-hidden="true" />
                    : <TrendingDown className="h-4 w-4" aria-hidden="true" />}
                  <span className="tnum">{delta >= 0 ? '+' : '−'}{money(delta)}</span>
                </span>
                <span className="text-hero-soft">vs {monthKeyLabel(prevKey)}</span>
              </p>
            )}

            <dl className="mt-7 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-2">
              <div className="rounded-[var(--radius-md)] bg-hero-tile px-4 py-3">
                <dt className="text-xs font-medium text-hero-soft">Income</dt>
                <dd className="mt-0.5 text-base font-bold tnum text-hero">+{money(cur.income)}</dd>
              </div>
              <div className="rounded-[var(--radius-md)] bg-hero-tile px-4 py-3">
                <dt className="text-xs font-medium text-hero-soft">Spending</dt>
                <dd className="mt-0.5 text-base font-bold tnum text-hero">−{money(cur.spending)}</dd>
              </div>
              <div className="rounded-[var(--radius-md)] bg-hero-tile px-4 py-3">
                <dt className="text-xs font-medium text-hero-soft">Bills</dt>
                <dd className="mt-0.5 text-base font-bold tnum text-hero">−{money(cur.bills)}</dd>
              </div>
              {savingsRate !== null && (
                <div className="rounded-[var(--radius-md)] bg-hero-tile px-4 py-3">
                  <dt className="text-xs font-medium text-hero-soft">Saved</dt>
                  <dd className="mt-0.5 text-base font-bold tnum text-lime">{savingsRate}%</dd>
                </div>
              )}
            </dl>
          </div>

          <div className="flex flex-col border-t border-hero px-2 pb-3 pt-5 lg:border-l lg:border-t-0 lg:p-7">
            <p className="mb-1 px-4 text-sm font-medium text-hero-soft lg:px-0">
              Net flow by month
            </p>
            {trendData.length > 1 ? (
              // Fixed height below lg: the collapsed (non-grid) parent has no
              // definite height, so the chart's height="100%" resolves to 0
              // and it silently renders nothing. On lg+ the grid stretches
              // the column, so flex-1 gives a real height to fill.
              <div className="h-[170px] lg:h-auto lg:min-h-[190px] lg:flex-1">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={trendData} margin={{ top: 8, right: 8, left: 8, bottom: 4 }}>
                    <defs>
                      <linearGradient id="netFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--lime)" stopOpacity={0.35} />
                        <stop offset="100%" stopColor="var(--lime)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    {/* hidden axis so the tooltip label is the month, not the row index */}
                    <XAxis dataKey="month" hide />
                    <Tooltip
                      {...TOOLTIP_PROPS}
                      cursor={{ stroke: 'var(--hero-line)', strokeWidth: 1 }}
                      formatter={(v) => [`${v >= 0 ? '+' : '−'}${moneyExact(v)}`, 'Net']}
                      labelFormatter={(l) => {
                        const [y, m] = String(l).split('-')
                        return m ? `${MONTHS_SHORT[+m - 1]} ${y}` : String(l)
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="net"
                      baseValue="dataMin"
                      stroke="var(--lime)"
                      strokeWidth={2.5}
                      fill="url(#netFill)"
                      dot={false}
                      activeDot={{ r: 5, fill: 'var(--lime)', stroke: 'var(--hero-bg)', strokeWidth: 2 }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="flex flex-1 items-center justify-center px-4 py-10 text-center text-sm text-hero-soft">
                More months of history will reveal your trend.
              </p>
            )}
          </div>
        </div>
      </section>

      {/* ── Spending pace (soft budget) + upcoming bills ── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">

        <Card
          title="This month's spending"
          doodle="flower"
          hint={`day ${pace.dayOfMonth} of ${pace.daysInMonth}`}
        >
          <div className={CARD_BODY}>
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
              <p className="font-display text-4xl font-bold tnum text-ink">{money(cur.spending)}</p>
              {pace.typical !== null && (
                <span className="text-sm text-ink-soft">of {money(pace.typical)} in a typical month</span>
              )}
            </div>

            {pace.typical !== null ? (
              <>
                <ProgressBar
                  className="mt-4"
                  value={cur.spending}
                  max={pace.typical}
                  tone={cur.spending > pace.typical ? 'blush' : 'sage'}
                  markerAt={pace.expected / pace.typical}
                  markerLabel="Typical pace by today"
                  label={`${money(cur.spending)} spent of a typical ${money(pace.typical)} month`}
                />
                <p className="mt-3 text-sm leading-relaxed text-ink-soft">{paceMessage}</p>
                <p className="mt-1.5 text-xs text-ink-faint">
                  Typical = your average over the last {Math.min(3, priorMonthCount)} month{priorMonthCount === 1 ? '' : 's'} · the tick marks today&apos;s expected pace
                </p>
                {onOpenBudgets && (
                  <button
                    onClick={onOpenBudgets}
                    className="mt-3 inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-sage-700 transition-colors hover:text-sage-800"
                  >
                    Set category budgets <ChevronRight className="h-4 w-4" aria-hidden="true" />
                  </button>
                )}
              </>
            ) : (
              <p className="mt-3 text-sm leading-relaxed text-ink-soft">
                About {money(pace.dayOfMonth > 0 ? cur.spending / pace.dayOfMonth : 0)} a day so far.
                Pace comparisons appear once you have a previous month of history.
              </p>
            )}
          </div>
        </Card>

        <Card title="Upcoming bills" icon={Receipt} hint={`${recurring.length} recurring`}>
          <div className={CARD_BODY}>
            {recurring.length === 0 ? (
              <p className="py-8 text-center text-sm text-ink-soft">
                No recurring charges spotted yet — they&apos;ll appear as your history grows.
              </p>
            ) : (
              <ol className="ml-2 space-y-4 border-l border-line pt-1">
                {recurring.map(r => (
                  <li key={r.key} className="relative ml-4">
                    <span
                      aria-hidden="true"
                      className="absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-surface"
                      style={{ backgroundColor: SEMANTIC_COLORS.bills }}
                    />
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-ink">{r.label}</p>
                        <p className="text-xs text-ink-faint">
                          {r.frequency} · next {MONTHS_SHORT[r.nextDate.getMonth()]} {r.nextDate.getDate()}
                        </p>
                      </div>
                      <span className="flex-shrink-0 text-sm font-bold tnum text-ink">{money(r.amount)}</span>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </Card>
      </div>

      {/* ── Where it went ── */}
      <div className="space-y-3">
        <SectionHeader
          title="Where it went"
          doodle="dots"
          action={onOpenAnalysis && (
            <button
              onClick={onOpenAnalysis}
              className="inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-sage-700 transition-colors hover:text-sage-800"
            >
              Full analysis <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </button>
          )}
        />
        <CategoryCards categories={cats} total={cur.spending} />
      </div>
    </div>
  )
}
