'use client'
import { useState, useEffect, useMemo } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, PieChart, Pie, Cell, ResponsiveContainer } from 'recharts'
import { Lightbulb, X } from 'lucide-react'
import { normalizeCategory, categoryColor, calcSpending, calcIncome, categoryTotals } from '@/lib/categories'
import { parseDate } from '@/lib/date'

// The model returns insights as either plain strings or structured objects
// (e.g. { action, detail, priority, estimatedImpact }). Coerce both into a
// { title, detail } pair so we never try to render a raw object as a child.
function toInsight(item) {
  if (item == null) return { title: '', detail: null }
  if (typeof item === 'string') return { title: item, detail: null }
  if (typeof item !== 'object') return { title: String(item), detail: null }
  const title = item.action || item.title || item.insight || item.pattern ||
                item.recommendation || item.text || item.description || ''
  const detailParts = [item.detail, item.description, item.estimatedImpact, item.impact]
    .filter(v => typeof v === 'string' && v && v !== title)
  return { title: title || JSON.stringify(item), detail: detailParts[0] || null }
}

export default function SpendingDashboard({ data, analysis, onAnalysisComplete }) {
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [analysisError, setAnalysisError] = useState(null)

  // null = modal closed. A category name string = modal open showing that category's transactions.
  const [selectedCategory, setSelectedCategory] = useState(null)

  useEffect(() => {
    if (data && !analysis) analyzeSpending()
  }, [data, analysis])

  const analyzeSpending = async () => {
    setIsAnalyzing(true)
    setAnalysisError(null)
    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transactions: data.data })
      })
      if (!response.ok) throw new Error('Analysis request failed')
      const result = await response.json()
      if (result.error) throw new Error(result.error)
      onAnalysisComplete(result.analysis)
      if (data.fileId) {
        await fetch('/api/files/analysis', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fileId: data.fileId, analysis: result.analysis })
        })
      }
    } catch (error) {
      console.error('Analysis failed:', error)
      setAnalysisError('Analysis failed. Please try again.')
    } finally {
      setIsAnalyzing(false)
    }
  }

  // Returns transactions for a category, newest first.
  // The special value '__spending__' returns all discretionary spending transactions.
  const getCategoryTransactions = (categoryName) => {
    const byDateDesc = (arr) => arr.slice().sort((a, b) => (parseDate(b)?.getTime() || 0) - (parseDate(a)?.getTime() || 0))
    if (categoryName === '__spending__') {
      return byDateDesc(data.data.filter(t => {
        const cat = normalizeCategory(t.Category, t.Amount)
        return cat !== 'Income' && cat !== 'Bills & Payments'
      }))
    }
    return byDateDesc(data.data.filter(t => normalizeCategory(t.Category, t.Amount) === categoryName))
  }

  const chartData = useMemo(() => categoryTotals(data.data).slice(0, 10), [data])
  const pieColors = chartData.slice(0, 5).map(d => categoryColor(d.category))

  const totalSpending = calcSpending(data.data)
  const totalIncome = calcIncome(data.data)
  const billsTransactions = data.data.filter(t => normalizeCategory(t.Category, t.Amount) === 'Bills & Payments')
  const billsTotal = billsTransactions.reduce((sum, t) => sum + Math.abs(parseFloat(t.Amount) || 0), 0)
  const catMax = chartData[0]?.amount || 1

  return (
    <div className="space-y-6">

      {/* Summary cards — 2 columns on mobile, 4 on desktop */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <button
          onClick={() => setSelectedCategory('__spending__')}
          className="bg-surface rounded-xl p-5 border border-line shadow-sm text-left hover:border-sage-300 transition-all"
        >
          <p className="text-xs font-medium text-ink-faint uppercase tracking-wide">Spending</p>
          <p className="text-2xl font-bold text-ink mt-1">${totalSpending.toFixed(2)}</p>
          <p className="text-xs text-ink-faint mt-1">excl. bills & income · click to view</p>
        </button>

        <button
          onClick={() => setSelectedCategory('Income')}
          className="bg-surface rounded-xl p-5 border border-line shadow-sm text-left hover:border-sage-300 transition-all"
        >
          <p className="text-xs font-medium text-ink-faint uppercase tracking-wide">Income</p>
          <p className="text-2xl font-bold text-sage-600 mt-1">${totalIncome.toFixed(2)}</p>
          <p className="text-xs text-ink-faint mt-1">click to view</p>
        </button>

        <div className="bg-surface rounded-xl p-5 border border-line shadow-sm">
          <p className="text-xs font-medium text-ink-faint uppercase tracking-wide">Transactions</p>
          <p className="text-2xl font-bold text-ink mt-1">{data.data.length}</p>
        </div>

        <div className="bg-surface rounded-xl p-5 border border-line shadow-sm">
          <p className="text-xs font-medium text-ink-faint uppercase tracking-wide">Health Score</p>
          <p className="text-2xl font-bold text-ink mt-1">{analysis ? `${analysis.healthScore}/10` : '—'}</p>
          {isAnalyzing && <p className="text-xs text-sage-500 mt-1">analyzing...</p>}
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-surface rounded-xl p-6 border border-line shadow-sm">
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-sm font-semibold text-ink">Spending by Category</h3>
            <span className="text-xs text-ink-faint">click to explore</span>
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={chartData} margin={{ bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#EFEDE6" />
              <XAxis dataKey="category" angle={-35} textAnchor="end" height={80} tick={{ fontSize: 11, fill: '#9A968C' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#9A968C' }} axisLine={false} tickLine={false} tickFormatter={v => `$${v}`} />
              <Tooltip
                contentStyle={{ borderRadius: '10px', border: '1px solid #EAE8E1', boxShadow: '0 1px 2px rgb(0 0 0 / 0.05)' }}
                formatter={(value) => [`$${value.toFixed(2)}`, 'Amount']}
              />
              <Bar dataKey="amount" radius={[4, 4, 0, 0]} cursor="pointer" onClick={(entry) => setSelectedCategory(entry.category)}>
                {chartData.map((d) => <Cell key={d.category} fill={categoryColor(d.category)} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-surface rounded-xl p-6 border border-line shadow-sm">
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-sm font-semibold text-ink">Category Distribution</h3>
            <span className="text-xs text-ink-faint">click to explore</span>
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie
                data={chartData.slice(0, 5)}
                cx="50%" cy="50%" outerRadius={90} dataKey="amount"
                label={({ category }) => category}
                cursor="pointer"
                onClick={(entry) => setSelectedCategory(entry.category)}
              >
                {chartData.slice(0, 5).map((_, index) => <Cell key={`cell-${index}`} fill={pieColors[index]} />)}
              </Pie>
              <Tooltip
                contentStyle={{ borderRadius: '10px', border: '1px solid #EAE8E1', boxShadow: '0 1px 2px rgb(0 0 0 / 0.05)' }}
                formatter={(value) => [`$${value.toFixed(2)}`, 'Amount']}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Category breakdown cards — compact progress bars, scannable */}
      {chartData.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-ink mb-3 px-1">Category breakdown</h3>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
            {chartData.slice(0, 6).map(({ category, amount }) => {
              const color = categoryColor(category)
              const share = totalSpending > 0 ? Math.round((amount / totalSpending) * 100) : 0
              return (
                <button
                  key={category}
                  onClick={() => setSelectedCategory(category)}
                  className="bg-surface border border-line rounded-xl shadow-sm p-4 text-left hover:border-sage-300 transition-all"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="h-2.5 w-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                      <span className="text-sm font-medium text-ink truncate">{category}</span>
                    </div>
                    <span className="text-xs text-ink-faint flex-shrink-0">{share}%</span>
                  </div>
                  <p className="text-lg font-bold text-ink">${amount.toFixed(2)}</p>
                  <div className="mt-2 h-1.5 rounded-full bg-surface-2 overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${Math.max(4, (amount / catMax) * 100)}%`, backgroundColor: color }} />
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Bills & Payments — excluded from spending total, shown as its own clickable row */}
      {billsTransactions.length > 0 && (
        <button
          onClick={() => setSelectedCategory('Bills & Payments')}
          className="w-full text-left bg-surface border border-line rounded-xl p-5 shadow-sm hover:border-sage-300 transition-all group"
        >
          <div className="flex justify-between items-center">
            <div>
              <p className="text-xs font-medium text-ink-faint uppercase tracking-wide mb-1">Bills & Payments</p>
              <p className="text-xl font-bold text-ink">${billsTotal.toFixed(2)}</p>
              <p className="text-xs text-ink-faint mt-1">{billsTransactions.length} transaction{billsTransactions.length !== 1 ? 's' : ''} · excluded from spending total</p>
            </div>
            <span className="text-ink-faint group-hover:text-sage-500 transition-colors text-xl">›</span>
          </div>
        </button>
      )}

      {/* Analyzing state */}
      {isAnalyzing && (
        <div className="bg-sage-50 border border-sage-200 rounded-xl p-5 flex items-center gap-3">
          <div className="animate-spin rounded-full h-4 w-4 border-2 border-sage-500 border-t-transparent flex-shrink-0" />
          <p className="text-sm text-sage-700">Analyzing your spending patterns...</p>
        </div>
      )}

      {analysisError && (
        <div className="bg-peach-50 border border-peach-200 rounded-xl p-5">
          <p className="text-sm text-peach-600">{analysisError}</p>
        </div>
      )}

      {/* AI Insights */}
      {analysis && (
        <div className="bg-surface rounded-xl border border-line shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-line flex items-center gap-2">
            <Lightbulb className="h-4 w-4 text-peach-400" />
            <h3 className="text-sm font-semibold text-ink">AI Insights</h3>
          </div>

          <div className="p-6 space-y-6">
            <div className="bg-surface-2 rounded-lg p-4">
              <p className="text-sm text-ink-soft leading-relaxed">{analysis.summary}</p>
            </div>

            <div>
              <h4 className="text-xs font-semibold text-ink-faint uppercase tracking-wide mb-3">Recommendations</h4>
              <ul className="space-y-3">
                {analysis.recommendations?.map((rec, index) => {
                  const { title, detail } = toInsight(rec)
                  return (
                    <li key={index} className="flex items-start gap-3">
                      <span className="flex-shrink-0 w-5 h-5 rounded-full bg-sage-100 text-sage-700 text-xs flex items-center justify-center font-semibold mt-0.5">{index + 1}</span>
                      <div>
                        <p className="text-sm text-ink leading-relaxed">{title}</p>
                        {detail && <p className="text-xs text-ink-soft leading-relaxed mt-0.5">{detail}</p>}
                      </div>
                    </li>
                  )
                })}
              </ul>
            </div>

            <div>
              <h4 className="text-xs font-semibold text-ink-faint uppercase tracking-wide mb-3">Spending Patterns</h4>
              <ul className="space-y-2">
                {analysis.patterns?.map((pattern, index) => {
                  const { title, detail } = toInsight(pattern)
                  return (
                    <li key={index} className="flex items-start gap-2 text-sm text-ink-soft">
                      <span className="text-sage-400 mt-1 flex-shrink-0">–</span>
                      <span className="leading-relaxed">{title}{detail ? ` — ${detail}` : ''}</span>
                    </li>
                  )
                })}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Category transaction modal */}
      {selectedCategory && (() => {
        const transactions = getCategoryTransactions(selectedCategory)
        const total = transactions.reduce((sum, t) => sum + Math.abs(parseFloat(t.Amount) || 0), 0)

        return (
          <div
            className="fixed inset-0 bg-ink/40 z-50 flex items-center justify-center p-4"
            onClick={() => setSelectedCategory(null)}
          >
            <div
              className="bg-surface rounded-2xl shadow-sm border border-line w-full max-w-lg flex flex-col"
              style={{ maxHeight: '80vh' }}
              onClick={e => e.stopPropagation()}
            >
              <div className="flex justify-between items-start p-6 border-b border-line">
                <div>
                  <h3 className="text-xl font-semibold text-ink">
                    {selectedCategory === '__spending__' ? 'All Spending' : selectedCategory}
                  </h3>
                  <p className="text-sm text-ink-soft mt-1">
                    {transactions.length} transaction{transactions.length !== 1 ? 's' : ''} &nbsp;·&nbsp; ${total.toFixed(2)} total
                  </p>
                </div>
                <button onClick={() => setSelectedCategory(null)} className="text-ink-faint hover:text-ink ml-4 flex-shrink-0">
                  <X className="h-6 w-6" />
                </button>
              </div>

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
                        <span className="text-sm font-semibold text-ink flex-shrink-0">${amount.toFixed(2)}</span>
                      </div>
                    )
                  })
                )}
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}
