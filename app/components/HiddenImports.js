'use client'
import { useState, useEffect, useCallback, useMemo } from 'react'
import { EyeOff, RotateCcw, ChevronDown, ChevronRight } from 'lucide-react'
import Button from './ui/Button'
import { Banner } from './ui/Field'
import { moneyExact } from '@/lib/format'

// Management panel for transactions hidden as duplicate imports (see
// ConnectedAccounts.js "Hide duplicate imports", UserFiles.js "Hide all
// transactions", and POST /api/transactions/hide). Renders nothing when
// there's nothing hidden or Plaid/Pro isn't in play — same silent-no-op
// posture as ConnectedAccounts itself, so a free or non-Plaid user's
// Settings page is unchanged.
export default function HiddenImports() {
  const [transactions, setTransactions] = useState(null) // null while loading
  const [error, setError] = useState(null)
  const [restoringId, setRestoringId] = useState(null)
  const [restoringAll, setRestoringAll] = useState(false)
  const [restoringGroupKey, setRestoringGroupKey] = useState(null)
  // Groups start collapsed — with auto-hide now running on every sync, a
  // group can easily hold hundreds of rows, and most of the time what
  // someone wants is "restore this whole file back," not a wall of
  // individual transactions to scan through first.
  const [expandedKeys, setExpandedKeys] = useState(() => new Set())

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/transactions/hidden')
      if (!res.ok) { setTransactions([]); return } // 402 (free) or any error — nothing to show
      const data = await res.json()
      setTransactions(data.transactions || [])
    } catch {
      setTransactions([])
    }
  }, [])

  useEffect(() => { load() }, [load])

  // Grouped by source file — the natural unit for "restore a whole
  // statement," since UserFiles.js's "Hide all transactions" and the
  // duplicate-matching auto-hide both only ever hide upload rows, which
  // always carry a fileId. A row without one (shouldn't happen today, but
  // stays defensive) falls into its own "Other hidden transactions" bucket.
  const groups = useMemo(() => {
    if (!transactions) return []
    const map = new Map()
    transactions.forEach(t => {
      const key = t.file_id || 'unknown'
      if (!map.has(key)) map.set(key, { key, label: t.fileName || 'Other hidden transactions', transactions: [] })
      map.get(key).transactions.push(t)
    })
    return [...map.values()]
  }, [transactions])

  const toggleExpanded = (key) => {
    setExpandedKeys(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  // Chunked well under POST /api/transactions/hide's own MAX_IDS (1000) —
  // "Restore all" (whole panel or one file) can easily exceed that in one go
  // now that auto-hide runs on every sync, and sending it in pieces also
  // means an error partway through leaves the earlier chunks restored
  // rather than failing the whole batch atomically.
  const RESTORE_CHUNK_SIZE = 500

  const restore = async (ids) => {
    setError(null)
    try {
      for (let i = 0; i < ids.length; i += RESTORE_CHUNK_SIZE) {
        const chunk = ids.slice(i, i + RESTORE_CHUNK_SIZE)
        const res = await fetch('/api/transactions/hide', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ids: chunk, hidden: false }),
        })
        if (!res.ok) throw new Error('restore failed')
        const restoredSet = new Set(chunk)
        setTransactions(prev => prev.filter(t => !restoredSet.has(t.id)))
      }
    } catch (err) {
      console.error('Error restoring hidden transactions:', err)
      setError("Couldn't restore that. Please try again.")
    }
  }

  const restoreOne = async (id) => {
    setRestoringId(id)
    await restore([id])
    setRestoringId(null)
  }

  const restoreGroup = async (group) => {
    setRestoringGroupKey(group.key)
    await restore(group.transactions.map(t => t.id))
    setRestoringGroupKey(null)
  }

  const restoreAll = async () => {
    setRestoringAll(true)
    await restore(transactions.map(t => t.id))
    setRestoringAll(false)
  }

  if (!transactions || transactions.length === 0) return null

  const total = transactions.reduce((sum, t) => sum + Math.abs(parseFloat(t.amount) || 0), 0)
  const anyBusy = restoringAll || restoringGroupKey !== null || restoringId !== null

  return (
    <section className="card-soft p-5 sm:p-6">
      <div className="mb-1.5 flex items-center gap-2">
        <EyeOff className="h-4 w-4 text-sage-500" aria-hidden="true" />
        <h2 className="text-base font-semibold text-ink">Hidden imports</h2>
      </div>
      <p className="mb-5 text-sm leading-relaxed text-ink-soft">
        {transactions.length} transaction{transactions.length === 1 ? '' : 's'} ({moneyExact(total)} total) hidden as
        duplicates of a connected bank&apos;s synced data — kept, not deleted, and left out of every total and chart.
        Restore a whole file at once below, or expand it to restore individual transactions.
      </p>

      {error && <Banner tone="error" role="alert" className="mb-4">{error}</Banner>}

      <div className="mb-4 max-h-96 space-y-2 overflow-y-auto pr-1">
        {groups.map(group => {
          const isExpanded = expandedKeys.has(group.key)
          const isRestoringGroup = restoringGroupKey === group.key
          const groupTotal = group.transactions.reduce((sum, t) => sum + Math.abs(parseFloat(t.amount) || 0), 0)
          return (
            <div key={group.key} className="rounded-[var(--radius-md)] border border-line overflow-hidden">
              <div className="flex items-center justify-between gap-2 bg-surface-2 py-1.5 pl-1.5 pr-2">
                <button
                  type="button"
                  onClick={() => toggleExpanded(group.key)}
                  aria-expanded={isExpanded}
                  className="flex min-w-0 flex-1 items-center gap-1.5 rounded-[var(--radius-xs)] px-1.5 py-1 text-left hover:bg-surface-hover"
                >
                  {isExpanded
                    ? <ChevronDown className="h-4 w-4 flex-shrink-0 text-ink-faint" aria-hidden="true" />
                    : <ChevronRight className="h-4 w-4 flex-shrink-0 text-ink-faint" aria-hidden="true" />}
                  <span className="min-w-0 truncate text-sm font-semibold text-ink">{group.label}</span>
                  <span className="flex-shrink-0 text-xs tnum text-ink-faint">
                    {group.transactions.length} · {moneyExact(groupTotal)}
                  </span>
                </button>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={anyBusy}
                  onClick={() => restoreGroup(group)}
                >
                  <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                  {isRestoringGroup ? 'Restoring…' : 'Restore file'}
                </Button>
              </div>

              {isExpanded && (
                <ul className="space-y-0.5 p-2">
                  {group.transactions.map(t => (
                    <li key={t.id} className="flex items-center justify-between gap-3 rounded-[var(--radius-xs)] px-2 py-2 text-sm hover:bg-surface-hover">
                      <span className="min-w-0">
                        <span className="block truncate text-ink-soft">{t.description || '—'}</span>
                        <span className="block text-xs tnum text-ink-faint">{t.date} · {moneyExact(Math.abs(parseFloat(t.amount) || 0))}</span>
                      </span>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={anyBusy}
                        onClick={() => restoreOne(t.id)}
                      >
                        <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                        {restoringId === t.id ? 'Restoring…' : 'Restore'}
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )
        })}
      </div>

      <Button variant="ghost" size="sm" disabled={anyBusy} onClick={restoreAll}>
        {restoringAll ? 'Restoring all…' : `Restore all ${transactions.length}`}
      </Button>
    </section>
  )
}
