'use client'
import { useState, useEffect } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, PieChart, Pie, Cell, ResponsiveContainer } from 'recharts'
import { Lightbulb, X } from 'lucide-react'

export default function SpendingDashboard({ data, analysis, onAnalysisComplete }) {
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [analysisError, setAnalysisError] = useState(null)
  const [chartData, setChartData] = useState([])

  // null = modal closed. A category name string = modal open showing that category's transactions.
  const [selectedCategory, setSelectedCategory] = useState(null)

  useEffect(() => {
    if (data && !analysis) {
      analyzeSpending()
    }
    if (data) {
      prepareChartData()
    }
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
          body: JSON.stringify({
            fileId: data.fileId,
            analysis: result.analysis
          })
        })
      }
    } catch (error) {
      console.error('Analysis failed:', error)
      setAnalysisError('Analysis failed. Please try again.')
    } finally {
      setIsAnalyzing(false)
    }
  }

  // Normalizes category names across different bank formats.
  // Also accepts the raw amount so it can reclassify transfers by direction:
  // a positive Transfer (Zelle received) is income, a negative one (Zelle sent) is spending.
  const normalizeCategory = (category, amount = null) => {
    if (!category) return 'Other'
    const lower = category.toLowerCase()
    if (lower.includes('payment') || lower.includes('credit') || lower === 'bills') {
      return 'Bills & Payments'
    }
    if (lower === 'transfer' && amount !== null && parseFloat(amount) > 0) {
      return 'Income'
    }
    return category
  }

  // Returns transactions for a category, sorted largest first.
  // The special value '__spending__' returns all spending transactions
  // (everything except Income and Bills & Payments).
  const getCategoryTransactions = (categoryName) => {
    const sorted = (arr) => arr.sort((a, b) => Math.abs(parseFloat(b.Amount) || 0) - Math.abs(parseFloat(a.Amount) || 0))
    if (categoryName === '__spending__') {
      return sorted(data.data.filter(t => {
        const cat = normalizeCategory(t.Category, t.Amount)
        return cat !== 'Income' && cat !== 'Bills & Payments'
      }))
    }
    return sorted(data.data.filter(t => normalizeCategory(t.Category, t.Amount) === categoryName))
  }

  const prepareChartData = () => {
    const categoryTotals = {}
    data.data.forEach(transaction => {
      const category = normalizeCategory(transaction.Category, transaction.Amount)
      if (category === 'Income' || category === 'Bills & Payments') return
      const amount = Math.abs(parseFloat(transaction.Amount) || 0)
      categoryTotals[category] = (categoryTotals[category] || 0) + amount
    })

    const chartData = Object.entries(categoryTotals)
      .map(([category, amount]) => ({ category, amount }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 10)

    setChartData(chartData)
  }

  const colors = ['#6366f1', '#06b6d4', '#f59e0b', '#10b981', '#f43f5e']

  const totalSpending = data.data.reduce((sum, t) => {
    const cat = normalizeCategory(t.Category, t.Amount)
    if (cat === 'Income' || cat === 'Bills & Payments') return sum
    return sum + Math.abs(parseFloat(t.Amount) || 0)
  }, 0)

  const totalIncome = data.data.reduce((sum, t) => {
    if (normalizeCategory(t.Category, t.Amount) !== 'Income') return sum
    return sum + Math.abs(parseFloat(t.Amount) || 0)
  }, 0)

  const billsTransactions = data.data.filter(t => normalizeCategory(t.Category, t.Amount) === 'Bills & Payments')
  const billsTotal = billsTransactions.reduce((sum, t) => sum + Math.abs(parseFloat(t.Amount) || 0), 0)

  return (
    <div className="space-y-6">

      {/* Summary cards — 2 columns on mobile, 4 on desktop */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <button
          onClick={() => setSelectedCategory('__spending__')}
          className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm text-left hover:border-indigo-200 hover:shadow-md transition-all group"
        >
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">Spending</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">${totalSpending.toFixed(2)}</p>
          <p className="text-xs text-gray-400 mt-1">excl. bills & income · click to view</p>
        </button>

        <button
          onClick={() => setSelectedCategory('Income')}
          className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm text-left hover:border-emerald-200 hover:shadow-md transition-all group"
        >
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">Income</p>
          <p className="text-2xl font-bold text-emerald-600 mt-1">${totalIncome.toFixed(2)}</p>
          <p className="text-xs text-gray-400 mt-1">click to view</p>
        </button>

        <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm">
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">Transactions</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{data.data.length}</p>
        </div>

        <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm">
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">Health Score</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">
            {analysis ? `${analysis.healthScore}/10` : '—'}
          </p>
          {isAnalyzing && <p className="text-xs text-indigo-400 mt-1">analyzing...</p>}
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl p-6 border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-sm font-semibold text-gray-900">Spending by Category</h3>
            <span className="text-xs text-gray-400">click to explore</span>
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={chartData} margin={{ bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
              <XAxis dataKey="category" angle={-35} textAnchor="end" height={80} tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} tickFormatter={v => `$${v}`} />
              <Tooltip
                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                formatter={(value) => [`$${value.toFixed(2)}`, 'Amount']}
              />
              <Bar dataKey="amount" fill="#6366f1" radius={[4, 4, 0, 0]} cursor="pointer" onClick={(entry) => setSelectedCategory(entry.category)} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-xl p-6 border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-sm font-semibold text-gray-900">Category Distribution</h3>
            <span className="text-xs text-gray-400">click to explore</span>
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie
                data={chartData.slice(0, 5)}
                cx="50%"
                cy="50%"
                outerRadius={90}
                dataKey="amount"
                label={({ category }) => category}
                cursor="pointer"
                onClick={(entry) => setSelectedCategory(entry.category)}
              >
                {chartData.slice(0, 5).map((_, index) => (
                  <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                formatter={(value) => [`$${value.toFixed(2)}`, 'Amount']}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Bills & Payments — excluded from spending total, shown as its own clickable row */}
      {billsTransactions.length > 0 && (
        <button
          onClick={() => setSelectedCategory('Bills & Payments')}
          className="w-full text-left bg-white border border-gray-100 rounded-xl p-5 shadow-sm hover:border-indigo-200 hover:shadow-md transition-all group"
        >
          <div className="flex justify-between items-center">
            <div>
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">Bills & Payments</p>
              <p className="text-xl font-bold text-gray-900">${billsTotal.toFixed(2)}</p>
              <p className="text-xs text-gray-400 mt-1">{billsTransactions.length} transaction{billsTransactions.length !== 1 ? 's' : ''} · excluded from spending total</p>
            </div>
            <span className="text-gray-300 group-hover:text-indigo-400 transition-colors text-xl">›</span>
          </div>
        </button>
      )}

      {/* Analyzing state */}
      {isAnalyzing && (
        <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-5 flex items-center gap-3">
          <div className="animate-spin rounded-full h-4 w-4 border-2 border-indigo-400 border-t-transparent flex-shrink-0" />
          <p className="text-sm text-indigo-700">Analyzing your spending patterns...</p>
        </div>
      )}

      {analysisError && (
        <div className="bg-red-50 border border-red-100 rounded-xl p-5">
          <p className="text-sm text-red-700">{analysisError}</p>
        </div>
      )}

      {/* AI Insights */}
      {analysis && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
            <Lightbulb className="h-4 w-4 text-yellow-400" />
            <h3 className="text-sm font-semibold text-gray-900">AI Insights</h3>
          </div>

          <div className="p-6 space-y-6">
            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-sm text-gray-700 leading-relaxed">{analysis.summary}</p>
            </div>

            <div>
              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Recommendations</h4>
              <ul className="space-y-3">
                {analysis.recommendations?.map((rec, index) => (
                  <li key={index} className="flex items-start gap-3">
                    <span className="flex-shrink-0 w-5 h-5 rounded-full bg-indigo-100 text-indigo-600 text-xs flex items-center justify-center font-semibold mt-0.5">
                      {index + 1}
                    </span>
                    <p className="text-sm text-gray-700 leading-relaxed">{rec}</p>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Spending Patterns</h4>
              <ul className="space-y-2">
                {analysis.patterns?.map((pattern, index) => (
                  <li key={index} className="flex items-start gap-2 text-sm text-gray-700">
                    <span className="text-indigo-300 mt-1 flex-shrink-0">–</span>
                    <span className="leading-relaxed">{pattern}</span>
                  </li>
                ))}
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
          // Full-screen semi-transparent backdrop.
          // Clicking the backdrop (but not the panel) closes the modal.
          <div
            className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4"
            onClick={() => setSelectedCategory(null)}
          >
            {/* The white panel. e.stopPropagation() prevents clicks inside the panel
                from bubbling up to the backdrop and accidentally closing the modal. */}
            <div
              className="bg-white rounded-lg shadow-xl w-full max-w-lg flex flex-col"
              style={{ maxHeight: '80vh' }}
              onClick={e => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex justify-between items-start p-6 border-b">
                <div>
                  <h3 className="text-xl font-semibold text-gray-900">
                    {selectedCategory === '__spending__' ? 'All Spending' : selectedCategory}
                  </h3>
                  <p className="text-sm text-gray-500 mt-1">
                    {transactions.length} transaction{transactions.length !== 1 ? 's' : ''} &nbsp;·&nbsp; ${total.toFixed(2)} total
                  </p>
                </div>
                {/* X button closes the modal by resetting selectedCategory to null */}
                <button
                  onClick={() => setSelectedCategory(null)}
                  className="text-gray-400 hover:text-gray-600 ml-4 flex-shrink-0"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>

              {/* Scrollable transaction list */}
              <div className="overflow-y-auto p-4 space-y-2">
                {transactions.length === 0 ? (
                  <p className="text-gray-500 text-sm text-center py-4">No transactions found.</p>
                ) : (
                  transactions.map((t, i) => {
                    // Different bank formats use different date field names
                    const date = t['Trans. Date'] || t['Date'] || t['Transaction Date'] || ''
                    const description = t['Description'] || ''
                    const amount = Math.abs(parseFloat(t.Amount) || 0)

                    return (
                      <div key={i} className="flex justify-between items-start p-3 bg-gray-50 rounded-lg">
                        <div className="flex-1 min-w-0 mr-4">
                          {/* truncate cuts off long merchant names with "..." instead of wrapping */}
                          <p className="text-sm font-medium text-gray-900 truncate">{description}</p>
                          <p className="text-xs text-gray-400 mt-0.5">{date}</p>
                        </div>
                        <span className="text-sm font-semibold text-gray-800 flex-shrink-0">
                          ${amount.toFixed(2)}
                        </span>
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