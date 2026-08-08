'use client'
import { useState, useEffect, useMemo, useCallback } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, PieChart, Pie, Cell, ResponsiveContainer } from 'recharts'
import { Sparkles } from 'lucide-react'
import { normalizeCategory, categoryColor, calcSpending, calcIncome, categoryTotals } from '@/lib/categories'
import { parseDate, periodRange, monthKey, monthKeyLabel, monthKeyToDate } from '@/lib/date'
import { moneyExact } from '@/lib/format'
import { useTransactions } from './useTransactions'
import { useTargetPurchaseMatches } from './useTargetPurchaseMatches'
import { TargetItemsToggle, TargetItemsList } from './TargetItemsList'
import LoadError from './LoadError'
import CategoryCards from './CategoryCards'
import MonthChat from './MonthChat'
import { DashboardSkeleton } from './ui/Skeletons'
import EmptyState from './ui/EmptyState'
import Modal from './ui/Modal'
import Card, { CARD_BODY, CARD_PAD } from './ui/Card'
import { PageHeader, SectionHeader, StatTile } from './ui/SectionHeader'
import GrowthPlant, { STAGES, stageForScore } from './ui/GrowthPlant'
import { selectClass } from './ui/Field'
import { TOOLTIP_PROPS, AXIS_TICK, GRID_STROKE } from './ui/chartTheme'

// Health score, computed deterministically from the savings rate — no AI call,
// so it's instant, free, and the same every time. (AI insight now lives in the
// chat below, where the user asks their own questions.)
function healthScore(income, spending, bills) {
  if (income <= 0) return null // no income data → no meaningful rate
  const rate = (income - spending - bills) / income
  if (rate >= 0.25) return 9
  if (rate >= 0.15) return 8
  if (rate >= 0.05) return 7
  if (rate >= 0) return 6
  if (rate >= -0.1) return 4
  return 3
}

// The Analysis tab is keyed by CALENDAR MONTH, pooled across every uploaded
// file. Charts and totals are computed locally; the AI surface is a chat
// scoped to the selected month (see MonthChat / /api/chat).
export default function SpendingDashboard() {
  // Shared hook distinguishes a failed load (expired session, server error)
  // from a genuinely empty account — see useTransactions.js.
  const { transactions: allTxns, isLoading: isLoadingFiles, error: loadError, retry } = useTransactions()

  const [selectedMonth, setSelectedMonth] = useState(null)

  // null = modal closed. A category name string = modal open showing that category's transactions.
  const [selectedCategory, setSelectedCategory] = useState(null)
  const {
    matchedIds: targetMatchedIds,
    expandedId: expandedTargetId,
    itemsById: targetItemsById,
    loadingId: targetItemsLoadingId,
    toggle: toggleTargetItems,
    close: closeTargetItems,
  } = useTargetPurchaseMatches()
  const closeCategoryModal = useCallback(() => { setSelectedCategory(null); closeTargetItems() }, [closeTargetItems])

  // Distinct calendar months that have activity, newest first ('YYYY-MM').
  const months = useMemo(() => {
    const set = new Set()
    for (const t of allTxns) {
      const d = parseDate(t)
      if (d) set.add(monthKey(d))
    }
    return [...set].sort().reverse()
  }, [allTxns])

  // Default to the most recent month once data arrives (or if the selection
  // no longer exists, e.g. after deletions).
  useEffect(() => {
    if (months.length && !months.includes(selectedMonth)) {
      setSelectedMonth(months[0])
    }
  }, [months, selectedMonth])

  // Transactions that fall inside the selected calendar month.
  const monthTxns = useMemo(() => {
    if (!selectedMonth) return []
    const [start, end] = periodRange('month', monthKeyToDate(selectedMonth))
    const startMs = start.getTime()
    const endMs = end.getTime() + 86_400_000 // include the whole last day
    return allTxns.filter(t => {
      const d = parseDate(t)
      if (!d) return false
      const ms = d.getTime()
      return ms >= startMs && ms < endMs
    })
  }, [allTxns, selectedMonth])

  // Returns transactions for a category, newest first.
  // The special value '__spending__' returns all discretionary spending transactions.
  const getCategoryTransactions = (categoryName) => {
    const byDateDesc = (arr) => arr.slice().sort((a, b) => (parseDate(b)?.getTime() || 0) - (parseDate(a)?.getTime() || 0))
    if (categoryName === '__spending__') {
      return byDateDesc(monthTxns.filter(t => {
        const cat = normalizeCategory(t.Category, t.Amount)
        return cat !== 'Income' && cat !== 'Bills & Payments' && cat !== 'Transfer'
      }))
    }
    return byDateDesc(monthTxns.filter(t => normalizeCategory(t.Category, t.Amount) === categoryName))
  }

  const chartData = useMemo(() => categoryTotals(monthTxns).slice(0, 10), [monthTxns])
  const pieData = chartData.slice(0, 5)

  const totalSpending = calcSpending(monthTxns)
  const totalIncome = calcIncome(monthTxns)
  const billsTransactions = monthTxns.filter(t => normalizeCategory(t.Category, t.Amount) === 'Bills & Payments')
  const billsTotal = billsTransactions.reduce((sum, t) => sum + Math.abs(parseFloat(t.Amount) || 0), 0)
  const score = healthScore(totalIncome, totalSpending, billsTotal)
  const stage = stageForScore(score)

  if (isLoadingFiles) return <DashboardSkeleton />

  if (loadError) return <LoadError error={loadError} onRetry={retry} />

  if (months.length === 0) {
    return (
      <EmptyState
        icon={Sparkles}
        title="Nothing to analyze yet"
        description="Upload a statement, then pick a month and we'll break it down for you."
      />
    )
  }

  return (
    <div className="space-y-5">

      <PageHeader
        title="Analysis"
        subtitle="One month at a time — the numbers, the shape, and anything you want to ask."
        doodle="sparkle"
      />

      {/* ── Month picker ── */}
      <Card className={CARD_PAD}>
        <label htmlFor="analysis-month" className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-ink-faint">
          Analyzing month
        </label>
        <select
          id="analysis-month"
          value={selectedMonth || ''}
          onChange={e => setSelectedMonth(e.target.value)}
          className={selectClass('max-w-xs text-base font-semibold sm:text-base')}
        >
          {months.map(m => (
            <option key={m} value={m}>{monthKeyLabel(m)}</option>
          ))}
        </select>
        <p className="mt-2 text-sm text-ink-faint tnum">
          {monthTxns.length} transaction{monthTxns.length !== 1 ? 's' : ''} this month
        </p>
      </Card>

      {/* ── Financial health — the plant supports the score, never replaces it ── */}
      <Card className="overflow-hidden" accent="sage" title="Financial health" doodle="sprout"
        hint="from your savings rate">
        <div className={`${CARD_BODY} flex flex-wrap items-center gap-x-6 gap-y-4 pt-1`}>
          <GrowthPlant stage={stage} className="h-20 w-20 flex-shrink-0" label={
            score !== null ? `Financial health: ${STAGES[stage].label}` : 'Financial health: not enough income data'
          } />
          <div className="min-w-0 flex-1">
            <p className="text-4xl font-bold tracking-tight tnum text-ink">
              {score !== null ? <>{score}<span className="text-2xl text-ink-faint">/10</span></> : '—'}
            </p>
            <p className="mt-1 text-base font-semibold text-sage-700">
              {score !== null ? STAGES[stage].label : 'Waiting on income data'}
            </p>
            <p className="mt-1 text-sm leading-relaxed text-ink-soft">
              {score !== null
                ? 'Based on how much of your income stayed with you this month.'
                : 'Add a statement that includes your income and this will fill in.'}
            </p>
          </div>
        </div>
      </Card>

      {/* ── Summary tiles — 2 up on mobile, 4 across from lg ── */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <button
          onClick={() => setSelectedCategory('__spending__')}
          className={`card-soft ${CARD_PAD} hover-lift text-left transition-all hover:border-sage-300`}
        >
          <StatTile label="Spending" value={moneyExact(totalSpending)} tone="spend" sub="excl. bills · tap to view" />
        </button>

        <button
          onClick={() => setSelectedCategory('Income')}
          className={`card-soft ${CARD_PAD} hover-lift text-left transition-all hover:border-sage-300`}
        >
          <StatTile label="Income" value={moneyExact(totalIncome)} tone="income" sub="tap to view" />
        </button>

        <div className={`card-soft ${CARD_PAD}`}>
          <StatTile label="Transactions" value={monthTxns.length} />
        </div>

        <div className={`card-soft ${CARD_PAD}`}>
          <StatTile
            label="Bills"
            value={moneyExact(billsTotal)}
            tone="bills"
            sub={`${billsTransactions.length} charge${billsTransactions.length !== 1 ? 's' : ''}`}
          />
        </div>
      </div>

      {/* ── Charts ── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card title="Spending by category" doodle="dots" hint="tap a bar to explore">
          <div className={CARD_BODY}>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 20 }}>
                <CartesianGrid strokeDasharray="4 4" vertical={false} stroke={GRID_STROKE} />
                <XAxis dataKey="category" angle={-35} textAnchor="end" height={86} tick={AXIS_TICK} axisLine={false} tickLine={false} interval={0} />
                <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} width={54} tickFormatter={v => `$${v}`} />
                <Tooltip
                  {...TOOLTIP_PROPS}
                  formatter={(value) => [moneyExact(value), 'Amount']}
                />
                <Bar dataKey="amount" radius={[8, 8, 0, 0]} cursor="pointer" onClick={(entry) => setSelectedCategory(entry.category)}>
                  {chartData.map((d) => <Cell key={d.category} fill={categoryColor(d.category)} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card title="Category distribution" doodle="flower" hint="tap a slice to explore">
          <div className={CARD_BODY}>
            {/* Donut, not labeled pie: outside labels overflowed on narrow
                screens. The legend below is clickable, same as the slices,
                and doubles as the accessible text summary of the chart. */}
            <ResponsiveContainer width="100%" height={230}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%" cy="50%" innerRadius={56} outerRadius={90}
                  paddingAngle={2} dataKey="amount"
                  cursor="pointer"
                  onClick={(entry) => setSelectedCategory(entry.category)}
                >
                  {pieData.map((d) => <Cell key={d.category} fill={categoryColor(d.category)} stroke="var(--surface)" strokeWidth={2} />)}
                </Pie>
                <Tooltip
                  {...TOOLTIP_PROPS}
                  cursor={false}
                  formatter={(value) => [moneyExact(value), 'Amount']}
                />
              </PieChart>
            </ResponsiveContainer>
            <ul className="mt-4 flex flex-wrap justify-center gap-2">
              {pieData.map((d) => (
                <li key={d.category}>
                  <button
                    onClick={() => setSelectedCategory(d.category)}
                    className="inline-flex min-h-9 items-center gap-2 rounded-full px-3 text-sm text-ink-soft transition-colors hover:bg-surface-hover hover:text-ink"
                  >
                    <span
                      className="h-2.5 w-2.5 flex-shrink-0 rounded-full"
                      style={{ backgroundColor: categoryColor(d.category) }}
                      aria-hidden="true"
                    />
                    {d.category}
                    <span className="tnum text-ink-faint">{moneyExact(d.amount)}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </Card>
      </div>

      {/* Category breakdown cards — compact progress bars, scannable */}
      {chartData.length > 0 && (
        <div className="space-y-3">
          <SectionHeader title="Category breakdown" doodle="leaf" />
          <CategoryCards categories={chartData.slice(0, 6)} total={totalSpending} onSelect={setSelectedCategory} />
        </div>
      )}

      {/* Bills & Payments — excluded from spending total, shown as its own clickable row */}
      {billsTransactions.length > 0 && (
        <button
          onClick={() => setSelectedCategory('Bills & Payments')}
          className={`card-soft ${CARD_PAD} hover-lift group w-full text-left transition-all hover:border-sage-300`}
        >
          <div className="flex items-center justify-between gap-4">
            <StatTile
              label="Bills & payments"
              value={moneyExact(billsTotal)}
              tone="bills"
              sub={`${billsTransactions.length} transaction${billsTransactions.length !== 1 ? 's' : ''} · excluded from the spending total`}
            />
            <span className="flex-shrink-0 text-2xl text-ink-faint transition-colors group-hover:text-sage-600" aria-hidden="true">›</span>
          </div>
        </button>
      )}

      {/* AI chat — the user asks their own questions about this month */}
      {selectedMonth && monthTxns.length > 0 && (
        <MonthChat month={selectedMonth} monthLabel={monthKeyLabel(selectedMonth)} />
      )}

      {/* Category transaction modal */}
      {selectedCategory && (() => {
        const transactions = getCategoryTransactions(selectedCategory)
        const total = transactions.reduce((sum, t) => sum + Math.abs(parseFloat(t.Amount) || 0), 0)

        return (
          <Modal
            isOpen
            onClose={closeCategoryModal}
            title={selectedCategory === '__spending__' ? 'All spending' : selectedCategory}
            subtitle={`${transactions.length} transaction${transactions.length !== 1 ? 's' : ''} · ${moneyExact(total)} total`}
            ariaLabel={selectedCategory === '__spending__' ? 'All spending transactions' : `${selectedCategory} transactions`}
          >
            <div className="space-y-2 overflow-y-auto p-4">
              {transactions.length === 0 ? (
                <p className="py-6 text-center text-sm text-ink-soft">No transactions found.</p>
              ) : (
                transactions.map((t, i) => {
                  const date = t['Trans. Date'] || t['Date'] || t['Transaction Date'] || ''
                  const description = t['Description'] || ''
                  const amount = Math.abs(parseFloat(t.Amount) || 0)
                  const hasItems = targetMatchedIds.has(t.id)
                  return (
                    <div key={t.id ?? i} className="well-soft p-3.5">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-ink">{description}</p>
                          <p className="mt-0.5 text-xs tnum text-ink-faint">{date}</p>
                        </div>
                        <div className="flex flex-shrink-0 items-center gap-1">
                          {hasItems && (
                            <TargetItemsToggle
                              description={description}
                              isOpen={expandedTargetId === t.id}
                              onClick={() => toggleTargetItems(t.id)}
                            />
                          )}
                          <span className="text-sm font-bold tnum text-ink">{moneyExact(amount)}</span>
                        </div>
                      </div>
                      {expandedTargetId === t.id && (
                        <div className="mt-3 border-t border-line pt-3">
                          <TargetItemsList items={targetItemsById[t.id]} isLoading={targetItemsLoadingId === t.id} />
                        </div>
                      )}
                    </div>
                  )
                })
              )}
            </div>
          </Modal>
        )
      })()}
    </div>
  )
}
