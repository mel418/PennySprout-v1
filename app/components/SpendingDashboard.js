'use client'
import { useState, useEffect, useMemo, useCallback } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, PieChart, Pie, Cell, ResponsiveContainer } from 'recharts'
import { Sparkles } from 'lucide-react'
import { normalizeCategory, categoryColor, calcSpending, calcIncome, categoryTotals } from '@/lib/categories'
import { parseDate, periodRange, monthKey, monthKeyLabel, monthKeyToDate } from '@/lib/date'
import { moneyExact } from '@/lib/format'
import { useTransactions } from './useTransactions'
import LoadError from './LoadError'
import CategoryCards from './CategoryCards'
import MonthChat from './MonthChat'
import { DashboardSkeleton } from './ui/Skeletons'
import EmptyState from './ui/EmptyState'
import Modal from './ui/Modal'
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
  const closeCategoryModal = useCallback(() => setSelectedCategory(null), [])

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
        return cat !== 'Income' && cat !== 'Bills & Payments'
      }))
    }
    return byDateDesc(monthTxns.filter(t => normalizeCategory(t.Category, t.Amount) === categoryName))
  }

  const chartData = useMemo(() => categoryTotals(monthTxns).slice(0, 10), [monthTxns])
  const pieColors = chartData.slice(0, 5).map(d => categoryColor(d.category))

  const totalSpending = calcSpending(monthTxns)
  const totalIncome = calcIncome(monthTxns)
  const billsTransactions = monthTxns.filter(t => normalizeCategory(t.Category, t.Amount) === 'Bills & Payments')
  const billsTotal = billsTransactions.reduce((sum, t) => sum + Math.abs(parseFloat(t.Amount) || 0), 0)
  const score = healthScore(totalIncome, totalSpending, billsTotal)

  if (isLoadingFiles) return <DashboardSkeleton />

  if (loadError) return <LoadError error={loadError} onRetry={retry} />

  if (months.length === 0) {
    return (
      <EmptyState
        icon={Sparkles}
        title="Nothing to analyze yet"
        description="Upload a statement, then pick a month to explore it."
      />
    )
  }

  return (
    <div className="space-y-6">

      {/* Month picker */}
      <div className="bg-surface rounded-2xl border border-line shadow-sm p-5">
        <label htmlFor="analysis-month" className="block text-xs font-medium text-ink-faint uppercase tracking-wide mb-1.5">
          Analyzing month
        </label>
        <select
          id="analysis-month"
          value={selectedMonth || ''}
          onChange={e => setSelectedMonth(e.target.value)}
          className="text-lg font-semibold text-ink bg-transparent border-b-2 border-sage-300 outline-none focus:border-sage-500 transition-colors pr-2"
        >
          {months.map(m => (
            <option key={m} value={m}>{monthKeyLabel(m)}</option>
          ))}
        </select>
        <p className="text-xs text-ink-faint mt-1.5">{monthTxns.length} transaction{monthTxns.length !== 1 ? 's' : ''} this month</p>
      </div>

      {/* Summary cards — 2 columns on mobile, 4 on desktop */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <button
          onClick={() => setSelectedCategory('__spending__')}
          className="bg-surface rounded-2xl p-5 border border-line shadow-sm text-left hover:border-sage-300 hover-lift transition-all"
        >
          <p className="text-xs font-medium text-ink-faint uppercase tracking-wide">Spending</p>
          <p className="text-2xl font-bold text-ink mt-1">{moneyExact(totalSpending)}</p>
          <p className="text-xs text-ink-faint mt-1">excl. bills & income · click to view</p>
        </button>

        <button
          onClick={() => setSelectedCategory('Income')}
          className="bg-surface rounded-2xl p-5 border border-line shadow-sm text-left hover:border-sage-300 hover-lift transition-all"
        >
          <p className="text-xs font-medium text-ink-faint uppercase tracking-wide">Income</p>
          <p className="text-2xl font-bold text-sage-600 mt-1">{moneyExact(totalIncome)}</p>
          <p className="text-xs text-ink-faint mt-1">click to view</p>
        </button>

        <div className="bg-surface rounded-2xl p-5 border border-line shadow-sm">
          <p className="text-xs font-medium text-ink-faint uppercase tracking-wide">Transactions</p>
          <p className="text-2xl font-bold text-ink mt-1">{monthTxns.length}</p>
        </div>

        <div className="bg-surface rounded-2xl p-5 border border-line shadow-sm">
          <p className="text-xs font-medium text-ink-faint uppercase tracking-wide">Health Score</p>
          <p className="text-2xl font-bold text-ink mt-1">{score !== null ? `${score}/10` : '—'}</p>
          <p className="text-xs text-ink-faint mt-1">{score !== null ? 'based on savings rate' : 'needs income data'}</p>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-surface rounded-2xl p-6 border border-line shadow-sm">
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-sm font-semibold text-ink">Spending by Category</h3>
            <span className="text-xs text-ink-faint">click to explore</span>
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={chartData} margin={{ bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={GRID_STROKE} />
              <XAxis dataKey="category" angle={-35} textAnchor="end" height={80} tick={AXIS_TICK} axisLine={false} tickLine={false} />
              <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} tickFormatter={v => `$${v}`} />
              <Tooltip
                {...TOOLTIP_PROPS}
                formatter={(value) => [moneyExact(value), 'Amount']}
              />
              <Bar dataKey="amount" radius={[4, 4, 0, 0]} cursor="pointer" onClick={(entry) => setSelectedCategory(entry.category)}>
                {chartData.map((d) => <Cell key={d.category} fill={categoryColor(d.category)} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-surface rounded-2xl p-6 border border-line shadow-sm">
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-sm font-semibold text-ink">Category Distribution</h3>
            <span className="text-xs text-ink-faint">click to explore</span>
          </div>
          {/* Donut, not labeled pie: outside labels overflowed on narrow
              screens. The legend below is clickable, same as the slices. */}
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie
                data={chartData.slice(0, 5)}
                cx="50%" cy="50%" innerRadius={58} outerRadius={88}
                paddingAngle={2} dataKey="amount"
                cursor="pointer"
                onClick={(entry) => setSelectedCategory(entry.category)}
              >
                {chartData.slice(0, 5).map((_, index) => <Cell key={`cell-${index}`} fill={pieColors[index]} stroke="var(--surface)" />)}
              </Pie>
              <Tooltip
                {...TOOLTIP_PROPS}
                formatter={(value) => [moneyExact(value), 'Amount']}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex flex-wrap justify-center gap-x-4 gap-y-1.5 mt-3">
            {chartData.slice(0, 5).map((d, index) => (
              <button
                key={d.category}
                onClick={() => setSelectedCategory(d.category)}
                className="flex items-center gap-1.5 text-xs text-ink-soft hover:text-ink transition-colors"
              >
                <span className="h-2.5 w-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: pieColors[index] }} />
                {d.category}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Category breakdown cards — compact progress bars, scannable */}
      {chartData.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-ink mb-3 px-1">Category breakdown</h3>
          <CategoryCards categories={chartData.slice(0, 6)} total={totalSpending} onSelect={setSelectedCategory} />
        </div>
      )}

      {/* Bills & Payments — excluded from spending total, shown as its own clickable row */}
      {billsTransactions.length > 0 && (
        <button
          onClick={() => setSelectedCategory('Bills & Payments')}
          className="w-full text-left bg-surface border border-line rounded-2xl p-5 shadow-sm hover:border-sage-300 hover-lift transition-all group"
        >
          <div className="flex justify-between items-center">
            <div>
              <p className="text-xs font-medium text-ink-faint uppercase tracking-wide mb-1">Bills & Payments</p>
              <p className="text-xl font-bold text-ink">{moneyExact(billsTotal)}</p>
              <p className="text-xs text-ink-faint mt-1">{billsTransactions.length} transaction{billsTransactions.length !== 1 ? 's' : ''} · excluded from spending total</p>
            </div>
            <span className="text-ink-faint group-hover:text-sage-500 transition-colors text-xl">›</span>
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
            title={selectedCategory === '__spending__' ? 'All Spending' : selectedCategory}
            subtitle={`${transactions.length} transaction${transactions.length !== 1 ? 's' : ''} · ${moneyExact(total)} total`}
            ariaLabel={selectedCategory === '__spending__' ? 'All spending transactions' : `${selectedCategory} transactions`}
          >
            <div className="overflow-y-auto p-4 space-y-2">
              {transactions.length === 0 ? (
                <p className="text-ink-soft text-sm text-center py-4">No transactions found.</p>
              ) : (
                transactions.map((t, i) => {
                  const date = t['Trans. Date'] || t['Date'] || t['Transaction Date'] || ''
                  const description = t['Description'] || ''
                  const amount = Math.abs(parseFloat(t.Amount) || 0)
                  return (
                    <div key={i} className="flex justify-between items-start p-3 bg-surface-2 rounded-lg">
                      <div className="flex-1 min-w-0 mr-4">
                        <p className="text-sm font-medium text-ink truncate">{description}</p>
                        <p className="text-xs text-ink-faint mt-0.5">{date}</p>
                      </div>
                      <span className="text-sm font-semibold text-ink flex-shrink-0">{moneyExact(amount)}</span>
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
