'use client'
import { useState, useEffect, useMemo, useCallback } from 'react'
import { Target, PiggyBank, Plus, Pencil, Trash2, X, Check } from 'lucide-react'
import { normalizeCategory, STANDARD_CATEGORIES, EXCLUDED_FROM_TOTALS } from '@/lib/categories'
import { parseDate, MONTHS } from '@/lib/date'
import { money, moneyExact } from '@/lib/format'
import { useTransactions } from './useTransactions'
import LoadError from './LoadError'
import { BudgetsSkeleton } from './ui/Skeletons'
import Card, { CARD_BODY } from './ui/Card'
import Button, { IconButton } from './ui/Button'
import Doodle from './ui/Doodle'
import ProgressBar, { GrowthTrail, budgetTone } from './ui/Progress'
import GrowthPlant, { stageForRatio } from './ui/GrowthPlant'
import { CategoryChip } from './ui/Chip'
import Field, { inputClass, selectClass, labelClass, Banner } from './ui/Field'
import { PageHeader } from './ui/SectionHeader'

// Budgets & Goals is the app's most expressive financial screen: budgets read
// like a planner's habit tracker, and each savings goal is a plant the user is
// nurturing. The figures stay clean and tabular throughout — the growth
// imagery sits beside them, never on top of them.
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
      if (!EXCLUDED_FROM_TOTALS.has(cat)) present.add(cat)
    })
    const anchor = latest || new Date()
    const y = anchor.getFullYear(), m = anchor.getMonth()
    const spend = {}
    transactions.forEach(t => {
      const d = parseDate(t)
      if (!d || d.getFullYear() !== y || d.getMonth() !== m) return
      const cat = normalizeCategory(t.Category, t.Amount)
      if (EXCLUDED_FROM_TOTALS.has(cat)) return
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
    <div className="space-y-5">

      <PageHeader
        title="Budgets & Goals"
        subtitle={`${monthLabel} · limits you set, progress from your real spending`}
        doodle="tulip"
      />

      {saveError && <Banner tone="error" role="alert">{saveError}</Banner>}

      {/* ── Category budgets ── */}
      <Card
        title="Monthly budgets"
        hint={budgets.length > 0 ? `${budgets.length} set` : undefined}
        icon={Target}
        action={
          !budgetForm && availableCategories.length > 0 && (
            <Button
              size="sm"
              variant="soft"
              onClick={() => setBudgetForm({ category: availableCategories[0], limit: '' })}
            >
              <Plus className="h-4 w-4" aria-hidden="true" /> Add budget
            </Button>
          )
        }
      >
        <div className={`${CARD_BODY} space-y-5`}>

          {budgetForm && (
            <div className="well-soft flex flex-wrap items-end gap-3 p-4">
              <Field label="Category" htmlFor="budget-category" className="min-w-[9rem] flex-1">
                <select
                  id="budget-category"
                  value={budgetForm.category}
                  onChange={e => setBudgetForm(f => ({ ...f, category: e.target.value }))}
                  disabled={budgetForm.editing}
                  className={selectClass()}
                >
                  {budgetForm.editing
                    ? <option>{budgetForm.category}</option>
                    : availableCategories.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </Field>
              <Field label="Monthly limit ($)" htmlFor="budget-limit" className="w-36">
                <input
                  id="budget-limit"
                  type="number" min="1" step="1" placeholder="300" inputMode="decimal"
                  value={budgetForm.limit}
                  onChange={e => setBudgetForm(f => ({ ...f, limit: e.target.value }))}
                  onKeyDown={e => { if (e.key === 'Enter') saveBudget() }}
                  className={inputClass('tnum')}
                  autoFocus
                />
              </Field>
              <div className="flex gap-2">
                <Button onClick={saveBudget}>
                  <Check className="h-4 w-4" aria-hidden="true" /> Save
                </Button>
                <IconButton label="Cancel" onClick={() => setBudgetForm(null)} className="border border-line">
                  <X className="h-4 w-4" />
                </IconButton>
              </div>
            </div>
          )}

          {budgets.length === 0 && !budgetForm ? (
            <div className="py-8 text-center">
              <Doodle name="flower" className="mx-auto mb-3 h-10 w-10 text-sage-300" strokeWidth={1.4} />
              <p className="text-base font-semibold text-ink">No budgets yet</p>
              <p className="mx-auto mt-1 max-w-sm text-sm text-ink-soft">
                Set a monthly limit for a category and we&apos;ll track your real spending against it.
              </p>
            </div>
          ) : (
            <ul className="space-y-6">
              {budgets.map(b => {
                const spent = monthSpendByCategory[b.category] || 0
                const ratio = spent / b.monthlyLimit
                const pct = Math.round(ratio * 100)
                const tone = budgetTone(ratio)
                const remaining = b.monthlyLimit - spent
                return (
                  <li key={b.category}>
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
                      <div className="flex min-w-0 items-center gap-2">
                        <CategoryChip category={b.category} />
                        {/* Status in words as well as color — never color alone */}
                        <span className={`text-xs font-semibold ${tone.text}`}>{tone.label}</span>
                      </div>
                      <div className="flex flex-shrink-0 items-center gap-1">
                        <span className="text-sm tnum text-ink-soft">
                          <span className="font-bold text-ink">{money(spent)}</span> / {money(b.monthlyLimit)}
                        </span>
                        <span className="ml-1.5 text-sm font-semibold tnum text-ink-faint">{pct}%</span>
                        <IconButton
                          label={`Edit ${b.category} budget`}
                          tone="sage"
                          onClick={() => setBudgetForm({ category: b.category, limit: String(b.monthlyLimit), editing: true })}
                        >
                          <Pencil className="h-4 w-4" />
                        </IconButton>
                        <IconButton
                          label={`Remove ${b.category} budget`}
                          tone="danger"
                          onClick={() => removeBudget(b.category)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </IconButton>
                      </div>
                    </div>
                    <ProgressBar
                      value={spent}
                      max={b.monthlyLimit}
                      tone={tone.tone}
                      label={`${b.category}: ${money(spent)} of ${money(b.monthlyLimit)} spent, ${pct} percent, ${tone.label}`}
                    />
                    <p className="mt-2 flex items-center gap-1.5 text-sm text-ink-soft">
                      {remaining >= 0 ? (
                        <>
                          <Doodle name="leaf" className="h-3.5 w-3.5 flex-shrink-0 text-sage-400" />
                          <span className="tnum">{money(remaining)}</span> left this month
                        </>
                      ) : (
                        <>
                          <Doodle name="sprout" className="h-3.5 w-3.5 flex-shrink-0 text-sage-400" />
                          <span className="tnum">{money(-remaining)}</span> over — it happens; next month is a fresh start
                        </>
                      )}
                    </p>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </Card>

      {/* ── Savings goals — the most expressive part of the app ── */}
      <Card
        title="Savings goals"
        hint={goals.length > 0 ? `${goals.length} active` : undefined}
        icon={PiggyBank}
        accent="butter"
        action={
          !goalForm && (
            <Button size="sm" variant="soft" onClick={() => setGoalForm({ name: '', target: '', saved: '', date: '' })}>
              <Plus className="h-4 w-4" aria-hidden="true" /> Add goal
            </Button>
          )
        }
      >
        <div className={`${CARD_BODY} space-y-4`}>

          {goalForm && (
            <div className="well-soft space-y-4 p-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Goal name" htmlFor="goal-name">
                  <input id="goal-name" type="text" placeholder="Japan trip" maxLength={80}
                    value={goalForm.name}
                    onChange={e => setGoalForm(f => ({ ...f, name: e.target.value }))}
                    className={inputClass()}
                    autoFocus />
                </Field>
                <Field label="Target ($)" htmlFor="goal-target">
                  <input id="goal-target" type="number" min="1" step="1" placeholder="2000" inputMode="decimal"
                    value={goalForm.target}
                    onChange={e => setGoalForm(f => ({ ...f, target: e.target.value }))}
                    className={inputClass('tnum')} />
                </Field>
                <Field label="Already saved ($, optional)" htmlFor="goal-saved">
                  <input id="goal-saved" type="number" min="0" step="1" placeholder="0" inputMode="decimal"
                    value={goalForm.saved}
                    onChange={e => setGoalForm(f => ({ ...f, saved: e.target.value }))}
                    className={inputClass('tnum')} />
                </Field>
                <Field label="Target date (optional)" htmlFor="goal-date">
                  <input id="goal-date" type="date"
                    value={goalForm.date}
                    onChange={e => setGoalForm(f => ({ ...f, date: e.target.value }))}
                    className={inputClass()} />
                </Field>
              </div>
              <div className="flex gap-2">
                <Button onClick={saveGoal}>
                  <Check className="h-4 w-4" aria-hidden="true" /> Create goal
                </Button>
                <IconButton label="Cancel" onClick={() => setGoalForm(null)} className="border border-line">
                  <X className="h-4 w-4" />
                </IconButton>
              </div>
            </div>
          )}

          {goals.length === 0 && !goalForm ? (
            <div className="py-8 text-center">
              <Doodle name="tulip" className="mx-auto mb-3 h-10 w-10 text-sage-300" strokeWidth={1.4} />
              <p className="text-base font-semibold text-ink">Nothing growing yet</p>
              <p className="mx-auto mt-1 max-w-sm text-sm text-ink-soft">
                Name something you&apos;re saving toward, set a target, and log contributions as you go.
              </p>
            </div>
          ) : (
            <ul className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {goals.map(g => {
                const ratio = g.targetAmount > 0 ? g.savedAmount / g.targetAmount : 0
                const pct = Math.min(100, Math.round(ratio * 100))
                const done = g.savedAmount >= g.targetAmount
                const remaining = Math.max(0, g.targetAmount - g.savedAmount)
                const stage = stageForRatio(ratio)
                return (
                  <li
                    key={g.id}
                    className={`relative rounded-[var(--radius-lg)] border p-4 sm:p-5 ${
                      done ? 'border-sage-300 bg-sage-50' : 'border-line bg-surface'
                    }`}
                  >
                    <div className="flex items-start gap-4">
                      <GrowthPlant
                        stage={stage}
                        className="h-14 w-14 flex-shrink-0"
                        label={`${g.name}: ${pct}% saved`}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <p className="truncate text-base font-semibold text-ink">{g.name}</p>
                          <IconButton label={`Delete goal ${g.name}`} tone="danger" onClick={() => removeGoal(g.id)}>
                            <Trash2 className="h-4 w-4" />
                          </IconButton>
                        </div>
                        <p className="text-lg font-bold tnum text-ink">
                          {moneyExact(g.savedAmount)}
                          <span className="text-sm font-medium text-ink-soft"> / {money(g.targetAmount)}</span>
                        </p>
                        {g.targetDate && (
                          <p className="mt-0.5 text-xs text-ink-faint">by {g.targetDate}</p>
                        )}
                      </div>
                    </div>

                    <div className="mt-4 flex items-center gap-3">
                      <ProgressBar
                        value={g.savedAmount}
                        max={g.targetAmount}
                        tone={done ? 'deep' : 'butter'}
                        className="flex-1"
                        label={`${g.name}: ${pct} percent saved`}
                      />
                      <span className={`text-sm font-bold tnum ${done ? 'text-sage-600' : 'text-ink-soft'}`}>{pct}%</span>
                    </div>

                    <div className="mt-3 flex items-center justify-between gap-2">
                      <GrowthTrail stage={stage} />
                      {!done && (
                        <span className="text-sm tnum text-ink-soft">{money(remaining)} to go</span>
                      )}
                    </div>

                    {done ? (
                      <p className="animate-bloom mt-3 flex items-center gap-1.5 text-sm font-semibold text-sage-700">
                        <Doodle name="flower" className="h-4 w-4 flex-shrink-0" /> Goal reached — lovely work.
                      </p>
                    ) : (
                      <div className="mt-3 flex gap-2">
                        <input
                          type="number" step="1" placeholder="Add amount" inputMode="decimal"
                          aria-label={`Add contribution to ${g.name}`}
                          value={contributions[g.id] || ''}
                          onChange={e => setContributions(c => ({ ...c, [g.id]: e.target.value }))}
                          onKeyDown={e => { if (e.key === 'Enter') addContribution(g) }}
                          className={inputClass('min-w-0 flex-1 tnum')}
                        />
                        <Button onClick={() => addContribution(g)} className="flex-shrink-0">Log</Button>
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </Card>
    </div>
  )
}
