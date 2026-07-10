'use client'
import { useState, useEffect, useMemo, useCallback } from 'react'
import { Target, PiggyBank, Plus, Pencil, Trash2, X, Check, TrendingUp } from 'lucide-react'
import { normalizeCategory, categoryColor, STANDARD_CATEGORIES } from '@/lib/categories'
import { parseDate, MONTHS } from '@/lib/date'
import { useTransactions } from './useTransactions'
import LoadError from './LoadError'
import { BudgetsSkeleton } from './ui/Skeletons'
import Card from './ui/Card'

const money = (n) => `$${Math.abs(n).toLocaleString('en-US', { maximumFractionDigits: 0 })}`
const moneyExact = (n) => `$${Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

// Budget progress states: calm green while comfortably under, gold as the
// limit approaches, dusty blue once it's crossed — informed, never punished.
function progressTone(ratio) {
  if (ratio >= 1) return { bar: 'var(--blue-600)', label: 'over budget', text: 'text-blue-600' }
  if (ratio >= 0.8) return { bar: '#C2A06B', label: 'getting close', text: 'text-amber-600' }
  return { bar: 'var(--sage-500)', label: 'on track', text: 'text-sage-600' }
}

export default function Budgets() {
  const { transactions, isLoading: txLoading, error: txError, retry } = useTransactions()

  const [budgets, setBudgets] = useState([])
  const [goals, setGoals] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)
  const [attempt, setAttempt] = useState(0)
  const [saveError, setSaveError] = useState(null)

  // Budget add/edit form: null = closed, { category, limit } = open.
  const [budgetForm, setBudgetForm] = useState(null)
  // Goal add form
  const [goalForm, setGoalForm] = useState(null)
  // Per-goal contribution input values, keyed by goal id.
  const [contributions, setContributions] = useState({})

  useEffect(() => {
    let cancelled = false
    setIsLoading(true)
    setLoadError(null)
    Promise.all([fetch('/api/budgets'), fetch('/api/goals')])
      .then(([bRes, gRes]) => {
        if (bRes.status === 401 || gRes.status === 401) throw { kind: 'auth' }
        if (!bRes.ok || !gRes.ok) throw { kind: 'server' }
        return Promise.all([bRes.json(), gRes.json()])
      })
      .then(([b, g]) => {
        if (cancelled) return
        setBudgets(b.budgets || [])
        setGoals(g.goals || [])
      })
      .catch(err => {
        if (cancelled) return
        setLoadError({ kind: err.kind || 'network' })
      })
      .finally(() => { if (!cancelled) setIsLoading(false) })
    return () => { cancelled = true }
  }, [attempt])

  const retryAll = useCallback(() => { setAttempt(a => a + 1); retry() }, [retry])

  // Anchor month = most recent month with activity (matches Overview).
  const { anchor, monthSpendByCategory, presentCategories } = useMemo(() => {
    let latest = null
    const present = new Set()
    transactions.forEach(t => {
      const d = parseDate(t)
      if (d && (!latest || d > latest)) latest = d
      const cat = normalizeCategory(t.Category, t.Amount)
      if (cat !== 'Income' && cat !== 'Bills & Payments') present.add(cat)
    })
    const anchor = latest || new Date()
    const y = anchor.getFullYear(), m = anchor.getMonth()
    const spend = {}
    transactions.forEach(t => {
      const d = parseDate(t)
      if (!d || d.getFullYear() !== y || d.getMonth() !== m) return
      const cat = normalizeCategory(t.Category, t.Amount)
      if (cat === 'Income' || cat === 'Bills & Payments') return
      spend[cat] = (spend[cat] || 0) + Math.abs(parseFloat(t.Amount) || 0)
    })
    return { anchor, monthSpendByCategory: spend, presentCategories: present }
  }, [transactions])

  // Categories offered when adding a budget: the standard set plus anything in
  // the user's data, minus Income/Bills and minus already-budgeted ones.
  const availableCategories = useMemo(() => {
    const budgeted = new Set(budgets.map(b => b.category))
    const all = new Set([
      ...STANDARD_CATEGORIES.filter(c => c !== 'Income' && c !== 'Transfer' && c !== 'Bills'),
      ...presentCategories,
    ])
    return [...all].filter(c => !budgeted.has(c)).sort()
  }, [budgets, presentCategories])

  const flashError = (msg) => {
    setSaveError(msg)
    setTimeout(() => setSaveError(null), 4000)
  }

  // ── Budget actions ──────────────────────────────────────────────────────────

  const saveBudget = async () => {
    const limit = parseFloat(budgetForm.limit)
    if (!budgetForm.category || !Number.isFinite(limit) || limit <= 0) {
      flashError('Pick a category and enter a limit above zero.')
      return
    }
    const res = await fetch('/api/budgets', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ category: budgetForm.category, monthlyLimit: limit }),
    })
    if (!res.ok) { flashError("Couldn't save that budget — try again."); return }
    setBudgets(prev => {
      const rest = prev.filter(b => b.category !== budgetForm.category)
      return [...rest, { category: budgetForm.category, monthlyLimit: limit }]
        .sort((a, b) => a.category.localeCompare(b.category))
    })
    setBudgetForm(null)
  }

  const removeBudget = async (category) => {
    const prev = budgets
    setBudgets(bs => bs.filter(b => b.category !== category))
    const res = await fetch(`/api/budgets?category=${encodeURIComponent(category)}`, { method: 'DELETE' })
    if (!res.ok) { setBudgets(prev); flashError("Couldn't remove that budget — try again.") }
  }

  // ── Goal actions ────────────────────────────────────────────────────────────

  const saveGoal = async () => {
    const target = parseFloat(goalForm.target)
    const saved = goalForm.saved ? parseFloat(goalForm.saved) : 0
    if (!goalForm.name?.trim() || !Number.isFinite(target) || target <= 0) {
      flashError('Give the goal a name and a target above zero.')
      return
    }
    const res = await fetch('/api/goals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: goalForm.name.trim(),
        targetAmount: target,
        savedAmount: Number.isFinite(saved) && saved > 0 ? saved : 0,
        targetDate: goalForm.date || null,
      }),
    })
    if (!res.ok) { flashError("Couldn't create that goal — try again."); return }
    const { goal } = await res.json()
    setGoals(prev => [...prev, goal])
    setGoalForm(null)
  }

  const addContribution = async (goal) => {
    const amount = parseFloat(contributions[goal.id])
    if (!Number.isFinite(amount) || amount === 0) return
    const newSaved = Math.max(0, goal.savedAmount + amount)
    const prev = goals
    setGoals(gs => gs.map(g => g.id === goal.id ? { ...g, savedAmount: newSaved } : g))
    setContributions(c => ({ ...c, [goal.id]: '' }))
    const res = await fetch(`/api/goals/${goal.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ savedAmount: newSaved }),
    })
    if (!res.ok) { setGoals(prev); flashError("Couldn't update that goal — try again.") }
  }

  const removeGoal = async (goalId) => {
    const prev = goals
    setGoals(gs => gs.filter(g => g.id !== goalId))
    const res = await fetch(`/api/goals/${goalId}`, { method: 'DELETE' })
    if (!res.ok) { setGoals(prev); flashError("Couldn't delete that goal — try again.") }
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  if (txLoading || isLoading) return <BudgetsSkeleton />

  const error = txError || loadError
  if (error) return <LoadError error={error} onRetry={retryAll} />

  const monthLabel = `${MONTHS[anchor.getMonth()]} ${anchor.getFullYear()}`

  return (
    <div className="space-y-4">

      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-ink tracking-tight">Budgets & Goals</h1>
        <p className="text-sm text-ink-soft mt-0.5">{monthLabel} · limits you set, progress from your real spending</p>
      </div>

      {saveError && (
        <div role="alert" className="bg-danger-50 border border-danger-200 text-danger-600 text-sm rounded-xl px-4 py-3">
          {saveError}
        </div>
      )}

      {/* ── Category budgets ── */}
      <Card
        title="Monthly budgets"
        hint={budgets.length > 0 ? `${budgets.length} set` : undefined}
        icon={Target}
        action={
          !budgetForm && availableCategories.length > 0 && (
            <button
              onClick={() => setBudgetForm({ category: availableCategories[0], limit: '' })}
              className="inline-flex items-center gap-1 text-sm font-medium text-sage-700 hover:text-sage-800 transition-colors">
              <Plus className="h-4 w-4" /> Add budget
            </button>
          )
        }
      >
        <div className="px-5 pb-5 space-y-4">

          {budgetForm && (
            <div className="flex flex-wrap items-end gap-3 bg-surface-2 rounded-xl p-4">
              <div className="flex-1 min-w-[140px]">
                <label htmlFor="budget-category" className="block text-xs font-medium text-ink-faint mb-1">Category</label>
                <select
                  id="budget-category"
                  value={budgetForm.category}
                  onChange={e => setBudgetForm(f => ({ ...f, category: e.target.value }))}
                  disabled={budgetForm.editing}
                  className="w-full text-sm border border-line rounded-lg px-3 py-2 bg-surface text-ink disabled:opacity-60">
                  {budgetForm.editing
                    ? <option>{budgetForm.category}</option>
                    : availableCategories.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="w-36">
                <label htmlFor="budget-limit" className="block text-xs font-medium text-ink-faint mb-1">Monthly limit ($)</label>
                <input
                  id="budget-limit"
                  type="number" min="1" step="1" placeholder="300"
                  value={budgetForm.limit}
                  onChange={e => setBudgetForm(f => ({ ...f, limit: e.target.value }))}
                  onKeyDown={e => { if (e.key === 'Enter') saveBudget() }}
                  className="w-full text-sm border border-line rounded-lg px-3 py-2 bg-surface text-ink"
                  autoFocus
                />
              </div>
              <div className="flex gap-2">
                <button onClick={saveBudget}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-sage-600 hover:bg-sage-700 text-white text-sm font-semibold rounded-lg transition-colors">
                  <Check className="h-4 w-4" /> Save
                </button>
                <button onClick={() => setBudgetForm(null)} aria-label="Cancel"
                  className="inline-flex items-center px-2.5 py-2 text-ink-faint hover:text-ink border border-line rounded-lg transition-colors">
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}

          {budgets.length === 0 && !budgetForm ? (
            <div className="text-center py-8">
              <Target className="mx-auto h-10 w-10 text-sage-300 mb-3" />
              <p className="text-sm font-medium text-ink mb-1">No budgets yet</p>
              <p className="text-sm text-ink-soft max-w-sm mx-auto">
                Set a monthly limit for a category and PennySprout will track your real spending against it.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {budgets.map(b => {
                const spent = monthSpendByCategory[b.category] || 0
                const ratio = spent / b.monthlyLimit
                const tone = progressTone(ratio)
                const remaining = b.monthlyLimit - spent
                return (
                  <div key={b.category}>
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="h-2.5 w-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: categoryColor(b.category) }} />
                        <span className="text-sm font-medium text-ink truncate">{b.category}</span>
                        <span className={`text-xs font-medium ${tone.text}`}>{tone.label}</span>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="text-sm text-ink-soft">
                          <span className="font-semibold text-ink">{money(spent)}</span> of {money(b.monthlyLimit)}
                        </span>
                        <button onClick={() => setBudgetForm({ category: b.category, limit: String(b.monthlyLimit), editing: true })}
                          aria-label={`Edit ${b.category} budget`}
                          className="p-1 text-ink-faint hover:text-sage-700 transition-colors">
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button onClick={() => removeBudget(b.category)}
                          aria-label={`Remove ${b.category} budget`}
                          className="p-1 text-ink-faint hover:text-danger-600 transition-colors">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                    <div className="h-2 rounded-full bg-surface-2 overflow-hidden">
                      <div className="h-full rounded-full transition-all"
                        style={{ width: `${Math.min(100, ratio * 100)}%`, backgroundColor: tone.bar }} />
                    </div>
                    <p className="text-xs text-ink-faint mt-1">
                      {remaining >= 0
                        ? `${money(remaining)} left this month`
                        : `${money(-remaining)} over — it happens; next month is a fresh start`}
                    </p>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </Card>

      {/* ── Savings goals ── */}
      <Card
        title="Savings goals"
        hint={goals.length > 0 ? `${goals.length} active` : undefined}
        icon={PiggyBank}
        action={
          !goalForm && (
            <button
              onClick={() => setGoalForm({ name: '', target: '', saved: '', date: '' })}
              className="inline-flex items-center gap-1 text-sm font-medium text-sage-700 hover:text-sage-800 transition-colors">
              <Plus className="h-4 w-4" /> Add goal
            </button>
          )
        }
      >
        <div className="px-5 pb-5 space-y-4">

          {goalForm && (
            <div className="bg-surface-2 rounded-xl p-4 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="goal-name" className="block text-xs font-medium text-ink-faint mb-1">Goal name</label>
                  <input id="goal-name" type="text" placeholder="Emergency fund" maxLength={80}
                    value={goalForm.name}
                    onChange={e => setGoalForm(f => ({ ...f, name: e.target.value }))}
                    className="w-full text-sm border border-line rounded-lg px-3 py-2 bg-surface text-ink"
                    autoFocus />
                </div>
                <div>
                  <label htmlFor="goal-target" className="block text-xs font-medium text-ink-faint mb-1">Target ($)</label>
                  <input id="goal-target" type="number" min="1" step="1" placeholder="1000"
                    value={goalForm.target}
                    onChange={e => setGoalForm(f => ({ ...f, target: e.target.value }))}
                    className="w-full text-sm border border-line rounded-lg px-3 py-2 bg-surface text-ink" />
                </div>
                <div>
                  <label htmlFor="goal-saved" className="block text-xs font-medium text-ink-faint mb-1">Already saved ($, optional)</label>
                  <input id="goal-saved" type="number" min="0" step="1" placeholder="0"
                    value={goalForm.saved}
                    onChange={e => setGoalForm(f => ({ ...f, saved: e.target.value }))}
                    className="w-full text-sm border border-line rounded-lg px-3 py-2 bg-surface text-ink" />
                </div>
                <div>
                  <label htmlFor="goal-date" className="block text-xs font-medium text-ink-faint mb-1">Target date (optional)</label>
                  <input id="goal-date" type="date"
                    value={goalForm.date}
                    onChange={e => setGoalForm(f => ({ ...f, date: e.target.value }))}
                    className="w-full text-sm border border-line rounded-lg px-3 py-2 bg-surface text-ink" />
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={saveGoal}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-sage-600 hover:bg-sage-700 text-white text-sm font-semibold rounded-lg transition-colors">
                  <Check className="h-4 w-4" /> Create goal
                </button>
                <button onClick={() => setGoalForm(null)} aria-label="Cancel"
                  className="inline-flex items-center px-2.5 py-2 text-ink-faint hover:text-ink border border-line rounded-lg transition-colors">
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}

          {goals.length === 0 && !goalForm ? (
            <div className="text-center py-8">
              <PiggyBank className="mx-auto h-10 w-10 text-sage-300 mb-3" />
              <p className="text-sm font-medium text-ink mb-1">No goals yet</p>
              <p className="text-sm text-ink-soft max-w-sm mx-auto">
                Name something you&apos;re saving toward, set a target, and log contributions as you go.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              {goals.map(g => {
                const ratio = g.targetAmount > 0 ? g.savedAmount / g.targetAmount : 0
                const pct = Math.min(100, Math.round(ratio * 100))
                const done = g.savedAmount >= g.targetAmount
                return (
                  <div key={g.id} className="border border-line rounded-xl p-4">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-ink truncate">{g.name}</p>
                        <p className="text-xs text-ink-faint">
                          {moneyExact(g.savedAmount)} of {money(g.targetAmount)}
                          {g.targetDate ? ` · by ${g.targetDate}` : ''}
                        </p>
                      </div>
                      <button onClick={() => removeGoal(g.id)} aria-label={`Delete goal ${g.name}`}
                        className="p-1 text-ink-faint hover:text-danger-600 transition-colors flex-shrink-0">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <div className="flex items-center gap-2 mb-3">
                      <div className="flex-1 h-2 rounded-full bg-surface-2 overflow-hidden">
                        <div className={`h-full rounded-full transition-all ${done ? 'bg-sage-500' : 'bg-blue-500'}`}
                          style={{ width: `${Math.max(2, pct)}%` }} />
                      </div>
                      <span className={`text-xs font-semibold ${done ? 'text-sage-600' : 'text-ink-soft'}`}>{pct}%</span>
                    </div>
                    {done ? (
                      <p className="text-xs font-medium text-sage-600 flex items-center gap-1">
                        <TrendingUp className="h-3.5 w-3.5" /> Goal reached — well done!
                      </p>
                    ) : (
                      <div className="flex gap-2">
                        <input
                          type="number" step="1" placeholder="Add amount"
                          aria-label={`Add contribution to ${g.name}`}
                          value={contributions[g.id] || ''}
                          onChange={e => setContributions(c => ({ ...c, [g.id]: e.target.value }))}
                          onKeyDown={e => { if (e.key === 'Enter') addContribution(g) }}
                          className="flex-1 min-w-0 text-sm border border-line rounded-lg px-3 py-1.5 bg-surface text-ink"
                        />
                        <button onClick={() => addContribution(g)}
                          className="px-3 py-1.5 bg-sage-600 hover:bg-sage-700 text-white text-sm font-semibold rounded-lg transition-colors flex-shrink-0">
                          Log
                        </button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </Card>
    </div>
  )
}
