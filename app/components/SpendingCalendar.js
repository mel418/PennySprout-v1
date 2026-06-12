'use client'
import { useState, useEffect, useMemo } from 'react'
import { ChevronLeft, ChevronRight, ChevronDown, ChevronRight as ChevronRightSm, CalendarDays } from 'lucide-react'
import { ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'
import { normalizeCategory, categoryColor } from '@/lib/categories'

const DAYS   = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = ['January','February','March','April','May','June','July',
                'August','September','October','November','December']

// Handles MM/DD/YY, MM/DD/YYYY, and ISO YYYY-MM-DD formats
function parseDate(t) {
  const raw = t['Trans. Date'] || t['Date'] || t['Transaction Date'] || ''
  if (!raw) return null
  const slash = raw.split('/')
  if (slash.length === 3) {
    const [m, d, y] = slash
    const year = y.length === 2 ? 2000 + parseInt(y) : parseInt(y)
    const date = new Date(year, parseInt(m) - 1, parseInt(d))
    return isNaN(date.getTime()) ? null : date
  }
  const fallback = new Date(raw)
  return isNaN(fallback.getTime()) ? null : fallback
}

function toKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default function SpendingCalendar() {
  const [allTransactions, setAllTransactions] = useState([])
  const [isLoading, setIsLoading]             = useState(true)
  const [currentMonth, setCurrentMonth]       = useState(null)
  const [selectedDate, setSelectedDate]       = useState(null)
  const [expandedCategory, setExpandedCategory] = useState(null)
  const [chartOpen, setChartOpen]             = useState(true)

  useEffect(() => {
    fetch('/api/files')
      .then(r => r.json())
      .then(data => {
        const all = (data.files || []).flatMap(f => f.transactions || [])
        setAllTransactions(all)

        // Start on the most recent month that has transactions
        const dates = all.map(parseDate).filter(Boolean)
        if (dates.length > 0) {
          const latest = new Date(Math.max(...dates.map(d => d.getTime())))
          setCurrentMonth(new Date(latest.getFullYear(), latest.getMonth(), 1))
        } else {
          const now = new Date()
          setCurrentMonth(new Date(now.getFullYear(), now.getMonth(), 1))
        }
      })
      .catch(() => {
        const now = new Date()
        setCurrentMonth(new Date(now.getFullYear(), now.getMonth(), 1))
      })
      .finally(() => setIsLoading(false))
  }, [])

  // Map of dateKey → transaction array for fast lookup
  const byDate = useMemo(() => {
    const map = {}
    allTransactions.forEach(t => {
      const d = parseDate(t)
      if (!d) return
      const key = toKey(d)
      if (!map[key]) map[key] = []
      map[key].push(t)
    })
    return map
  }, [allTransactions])

  // Daily spending / income / cumulative net for the visible month → cashflow trend chart
  const monthlyTrend = useMemo(() => {
    if (!currentMonth) return []
    const y = currentMonth.getFullYear()
    const m = currentMonth.getMonth()
    const daysInMonth = new Date(y, m + 1, 0).getDate()

    let running = 0
    const rows = []
    for (let day = 1; day <= daysInMonth; day++) {
      const key  = `${y}-${String(m + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
      const txns = byDate[key] || []

      const spending = txns.reduce((s, t) => {
        const cat = normalizeCategory(t.Category, t.Amount)
        return (cat === 'Income' || cat === 'Bills & Payments') ? s : s + Math.abs(parseFloat(t.Amount) || 0)
      }, 0)
      const income = txns.reduce((s, t) =>
        normalizeCategory(t.Category, t.Amount) === 'Income'
          ? s + Math.abs(parseFloat(t.Amount) || 0)
          : s
      , 0)

      running += income - spending
      rows.push({ day, spending, income, net: income - spending, cumulative: running })
    }
    return rows
  }, [currentMonth, byDate])

  const monthHasActivity = useMemo(
    () => monthlyTrend.some(r => r.spending > 0 || r.income > 0),
    [monthlyTrend]
  )

  // Categories + transactions for the currently selected date
  const selectedDateData = useMemo(() => {
    if (!selectedDate) return null
    const txns = byDate[selectedDate] || []
    const catMap = {}
    txns.forEach(t => {
      const cat = normalizeCategory(t.Category, t.Amount)
      if (!catMap[cat]) catMap[cat] = []
      catMap[cat].push(t)
    })
    return Object.entries(catMap)
      .map(([category, transactions]) => ({
        category,
        // within each category keep the original insertion order (already date-sorted from the file)
        transactions,
        total: transactions.reduce((s, t) => s + Math.abs(parseFloat(t.Amount) || 0), 0),
      }))
      .sort((a, b) => b.total - a.total)
  }, [selectedDate, byDate])

  if (isLoading || !currentMonth) {
    return (
      <div className="flex justify-center p-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sage-500" />
      </div>
    )
  }

  if (allTransactions.length === 0) {
    return (
      <div className="text-center p-12">
        <CalendarDays className="mx-auto h-12 w-12 text-gray-300 mb-4" />
        <h3 className="text-base font-medium text-gray-900 mb-1">No transaction history yet</h3>
        <p className="text-sm text-gray-500">Upload statements to see your spending calendar.</p>
      </div>
    )
  }

  const year  = currentMonth.getFullYear()
  const month = currentMonth.getMonth()

  // Grid: leading blanks + day numbers 1..daysInMonth
  const firstDayOfWeek = new Date(year, month, 1).getDay()
  const daysInMonth    = new Date(year, month + 1, 0).getDate()
  const cells = [
    ...Array(firstDayOfWeek).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]

  const goBack = () => {
    setCurrentMonth(new Date(year, month - 1, 1))
    setSelectedDate(null)
    setExpandedCategory(null)
  }
  const goForward = () => {
    setCurrentMonth(new Date(year, month + 1, 1))
    setSelectedDate(null)
    setExpandedCategory(null)
  }

  return (
    <div className="space-y-4">

      {/* ── Calendar card ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 sm:p-6">

        {/* Month header */}
        <div className="flex items-center justify-between mb-5">
          <button
            onClick={goBack}
            className="p-2 rounded-lg hover:bg-sage-50 text-gray-400 hover:text-sage-700 transition-colors"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <h2 className="text-base font-semibold text-gray-900">{MONTHS[month]} {year}</h2>
          <button
            onClick={goForward}
            className="p-2 rounded-lg hover:bg-sage-50 text-gray-400 hover:text-sage-700 transition-colors"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>

        {/* Day-of-week headers */}
        <div className="grid grid-cols-7 mb-1">
          {DAYS.map(d => (
            <div key={d} className="text-center text-xs sm:text-sm font-medium text-gray-400 py-1">{d}</div>
          ))}
        </div>

        {/* Date cells */}
        <div className="grid grid-cols-7 gap-0.5">
          {cells.map((day, i) => {
            if (!day) return <div key={`blank-${i}`} />

            const key  = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
            const txns = byDate[key] || []
            const hasData   = txns.length > 0
            const isSelected = selectedDate === key

            const spending = txns.reduce((s, t) => {
              const cat = normalizeCategory(t.Category, t.Amount)
              return (cat === 'Income' || cat === 'Bills & Payments') ? s : s + Math.abs(parseFloat(t.Amount) || 0)
            }, 0)
            const income = txns.reduce((s, t) =>
              normalizeCategory(t.Category, t.Amount) === 'Income'
                ? s + Math.abs(parseFloat(t.Amount) || 0)
                : s
            , 0)

            return (
              <button
                key={key}
                onClick={() => {
                  if (!hasData) return
                  setSelectedDate(isSelected ? null : key)
                  setExpandedCategory(null)
                }}
                disabled={!hasData}
                className={`
                  relative flex flex-col items-center justify-start rounded-xl p-1 pt-2 min-h-[54px] sm:min-h-[68px] transition-all
                  ${isSelected  ? 'bg-sage-600 shadow-sm'              : ''}
                  ${hasData && !isSelected ? 'hover:bg-sage-50 cursor-pointer' : ''}
                  ${!hasData    ? 'cursor-default'                     : ''}
                `}
              >
                <span className={`text-sm sm:text-base font-semibold leading-none ${
                  isSelected ? 'text-white' : hasData ? 'text-gray-800' : 'text-gray-300'
                }`}>
                  {day}
                </span>

                {hasData && (
                  <div className="mt-1 flex flex-col gap-0.5 w-full px-0.5">
                    {spending > 0 && (
                      <span className={`text-[10px] sm:text-xs font-medium rounded px-1 text-center leading-tight ${
                        isSelected ? 'bg-white/20 text-white' : 'bg-orange-50 text-orange-500'
                      }`}>
                        −${spending >= 100 ? Math.round(spending) : spending.toFixed(0)}
                      </span>
                    )}
                    {income > 0 && (
                      <span className={`text-[10px] sm:text-xs font-medium rounded px-1 text-center leading-tight ${
                        isSelected ? 'bg-white/20 text-white' : 'bg-sage-50 text-sage-600'
                      }`}>
                        +${income >= 100 ? Math.round(income) : income.toFixed(0)}
                      </span>
                    )}
                  </div>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* ── Selected date breakdown ── */}
      {selectedDate && selectedDateData && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">

          {/* Header */}
          <div className="px-5 py-4 border-b border-gray-100">
            <h3 className="font-semibold text-gray-900">
              {new Date(selectedDate + 'T12:00:00').toLocaleDateString('en-US', {
                weekday: 'long', month: 'long', day: 'numeric', year: 'numeric'
              })}
            </h3>
            <p className="text-xs text-gray-400 mt-0.5">
              {(byDate[selectedDate] || []).length} transaction{(byDate[selectedDate] || []).length !== 1 ? 's' : ''}
            </p>
          </div>

          {/* Category rows */}
          <div className="divide-y divide-gray-50">
            {selectedDateData.map(({ category, transactions, total }) => {
              const isOpen = expandedCategory === category
              const color = categoryColor(category)
              return (
                <div key={category} style={{ borderLeft: `3px solid ${color}` }}>
                  {/* Category header — click to toggle transaction list */}
                  <button
                    onClick={() => setExpandedCategory(isOpen ? null : category)}
                    className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-sage-50 transition-colors text-left"
                  >
                    <div className="flex items-center gap-2.5">
                      {isOpen
                        ? <ChevronDown className="h-4 w-4 text-sage-500 flex-shrink-0" />
                        : <ChevronRightSm className="h-4 w-4 text-gray-300 flex-shrink-0" />
                      }
                      <span className="h-2.5 w-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                      <span className="text-sm font-medium text-gray-800">{category}</span>
                      <span className="text-xs text-gray-400">
                        {transactions.length} txn{transactions.length !== 1 ? 's' : ''}
                      </span>
                    </div>
                    <span className="text-sm font-semibold text-gray-700 flex-shrink-0">
                      ${total.toFixed(2)}
                    </span>
                  </button>

                  {/* Individual transactions */}
                  {isOpen && (
                    <div className="px-4 pb-3 pt-1 space-y-1.5 bg-sage-50">
                      {transactions.map((t, i) => {
                        const desc   = t['Description'] || '—'
                        const amount = Math.abs(parseFloat(t.Amount) || 0)
                        return (
                          <div
                            key={i}
                            className="flex justify-between items-center px-3 py-2 bg-white rounded-lg border border-gray-100"
                          >
                            <p className="text-sm text-gray-700 truncate mr-4">{desc}</p>
                            <span className="text-sm font-medium text-gray-800 flex-shrink-0">
                              ${amount.toFixed(2)}
                            </span>
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

      {/* ── Cashflow trend for the month ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {/* Header — tap to collapse/expand */}
        <button
          onClick={() => setChartOpen(o => !o)}
          aria-expanded={chartOpen}
          className="w-full flex items-center justify-between gap-2 px-4 sm:px-6 py-4 hover:bg-sage-50 transition-colors text-left"
        >
          <span className="flex items-center gap-2 min-w-0">
            <ChevronDown
              className={`h-4 w-4 text-sage-500 flex-shrink-0 transition-transform ${chartOpen ? '' : '-rotate-90'}`}
            />
            <span className="text-sm font-semibold text-gray-900 truncate">
              Cash Flow — {MONTHS[month]} {year}
            </span>
          </span>
          <div className="hidden md:flex items-center gap-3 text-xs text-gray-400 flex-shrink-0">
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-sage-500" />Income</span>
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-orange-400" />Spending</span>
            <span className="flex items-center gap-1.5"><span className="h-0.5 w-3.5 bg-sage-700" />Net balance</span>
          </div>
        </button>

        {chartOpen && (
          <div className="px-1 sm:px-4 pb-4">
            {/* Compact legend for small screens */}
            <div className="flex md:hidden items-center gap-3 text-xs text-gray-400 px-3 pb-2">
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-sage-500" />Income</span>
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-orange-400" />Spending</span>
              <span className="flex items-center gap-1.5"><span className="h-0.5 w-3.5 bg-sage-700" />Net</span>
            </div>

            {monthHasActivity ? (
              <div className="h-[220px] sm:h-[260px]">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={monthlyTrend} margin={{ top: 10, right: 4, left: -12, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f4ee" />
                  <XAxis
                    dataKey="day"
                    tick={{ fontSize: 10, fill: '#9ca3af' }}
                    axisLine={false}
                    tickLine={false}
                    minTickGap={8}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: '#9ca3af' }}
                    axisLine={false}
                    tickLine={false}
                    width={44}
                    tickFormatter={v => `$${Math.abs(v) >= 1000 ? `${(v / 1000).toFixed(1)}k` : v}`}
                  />
                  <Tooltip
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', fontSize: '12px' }}
                    labelFormatter={d => `${MONTHS[month]} ${d}`}
                    formatter={(value, name) => [`$${Number(value).toFixed(2)}`, name]}
                  />
                  <ReferenceLine y={0} stroke="#d1d5db" strokeWidth={1} />
                  <Bar dataKey="income"   name="Income"      fill="#88a892" radius={[3, 3, 0, 0]} maxBarSize={14} />
                  <Bar dataKey="spending" name="Spending"    fill="#fb923c" radius={[3, 3, 0, 0]} maxBarSize={14} />
                  <Line
                    type="monotone"
                    dataKey="cumulative"
                    name="Net balance"
                    stroke="#3f6650"
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4 }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
              </div>
            ) : (
              <div className="flex items-center justify-center h-[160px] text-sm text-gray-400">
                No activity this month.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
