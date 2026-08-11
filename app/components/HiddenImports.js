'use client'
import { useState, useEffect, useCallback } from 'react'
import { EyeOff, RotateCcw } from 'lucide-react'
import Button from './ui/Button'
import { Banner } from './ui/Field'
import { moneyExact } from '@/lib/format'

// Management panel for transactions hidden as duplicate imports (see
// ConnectedAccounts.js "Find duplicate imports" and
// POST /api/transactions/hide). Renders nothing when there's nothing hidden
// or Plaid/Pro isn't in play — same silent-no-op posture as
// ConnectedAccounts itself, so a free or non-Plaid user's Settings page is
// unchanged.
export default function HiddenImports() {
  const [transactions, setTransactions] = useState(null) // null while loading
  const [error, setError] = useState(null)
  const [restoringId, setRestoringId] = useState(null)
  const [restoringAll, setRestoringAll] = useState(false)

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

  // Chunked well under POST /api/transactions/hide's own MAX_IDS (1000) —
  // "Restore all" can easily be restoring more than that in one go now that
  // auto-hide runs on every sync, and sending it in pieces also means an
  // error partway through leaves the earlier chunks restored rather than
  // failing the whole batch atomically.
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

  const restoreAll = async () => {
    setRestoringAll(true)
    await restore(transactions.map(t => t.id))
    setRestoringAll(false)
  }

  if (!transactions || transactions.length === 0) return null

  const total = transactions.reduce((sum, t) => sum + Math.abs(parseFloat(t.amount) || 0), 0)

  return (
    <section className="card-soft p-5 sm:p-6">
      <div className="mb-1.5 flex items-center gap-2">
        <EyeOff className="h-4 w-4 text-sage-500" aria-hidden="true" />
        <h2 className="text-base font-semibold text-ink">Hidden imports</h2>
      </div>
      <p className="mb-5 text-sm leading-relaxed text-ink-soft">
        {transactions.length} transaction{transactions.length === 1 ? '' : 's'} ({moneyExact(total)} total) hidden as
        duplicates of a connected bank&apos;s synced data — kept, not deleted, and left out of every total and chart.
        Restore any that shouldn&apos;t have been hidden.
      </p>

      {error && <Banner tone="error" role="alert" className="mb-4">{error}</Banner>}

      <ul className="mb-4 max-h-72 space-y-0.5 overflow-y-auto">
        {transactions.map(t => (
          <li key={t.id} className="flex items-center justify-between gap-3 rounded-[var(--radius-xs)] px-2 py-2 text-sm hover:bg-surface-hover">
            <span className="min-w-0">
              <span className="block truncate text-ink-soft">{t.description || '—'}</span>
              <span className="block text-xs tnum text-ink-faint">{t.date} · {moneyExact(Math.abs(parseFloat(t.amount) || 0))}</span>
            </span>
            <Button
              size="sm"
              variant="secondary"
              disabled={restoringId === t.id || restoringAll}
              onClick={() => restoreOne(t.id)}
            >
              <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
              {restoringId === t.id ? 'Restoring…' : 'Restore'}
            </Button>
          </li>
        ))}
      </ul>

      <Button variant="ghost" size="sm" disabled={restoringAll} onClick={restoreAll}>
        {restoringAll ? 'Restoring all…' : 'Restore all'}
      </Button>
    </section>
  )
}
