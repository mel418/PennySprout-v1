'use client'
import { useState, useEffect, useMemo } from 'react'
import { Search, X } from 'lucide-react'
import { normalizeCategory } from '@/lib/categories'
import { parseDate } from '@/lib/date'
import { moneyExact } from '@/lib/format'
import { useTransactions } from './useTransactions'
import LoadError from './LoadError'
import { ListSkeleton } from './ui/Skeletons'
import EmptyState from './ui/EmptyState'
import Card from './ui/Card'
import { CategoryChip, Pill } from './ui/Chip'
import Button from './ui/Button'
import { inputClass, selectClass, labelClass } from './ui/Field'

const PAGE_SIZE = 50

// Global search + filter across every transaction the user has ever uploaded
// — unlike the Analysis tab (one calendar month) or a file's Review modal
// (one statement), this pools everything from useTransactions with no
// server-side scoping, so it's the one place to find "that Target charge
// from sometime last spring" without knowing which file or month it's in.
//
// Lives inside TransactionSearchWidget's floating panel, which is a fixed
// narrow width regardless of viewport — so layout below uses fixed column
// counts rather than Tailwind's viewport-based sm:/lg: breakpoints, which
// would key off the *window* size, not this panel's actual rendered width.
export default function AllTransactions() {
  const { transactions: allTxns, isLoading, error, retry } = useTransactions()

  // File metadata is only needed for the account name filter/badge — a
  // lightweight side-fetch, not routed through useTransactions.
  const [files, setFiles] = useState([])
  useEffect(() => {
    let cancelled = false
    fetch('/api/files')
      .then(res => res.ok ? res.json() : { files: [] })
      .then(data => { if (!cancelled) setFiles(data.files || []) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [])

  const accountByFileId = useMemo(() => {
    const map = {}
    files.forEach(f => { map[f.id] = f.accountName || '' })
    return map
  }, [files])

  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('all')
  const [account, setAccount] = useState('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [amountMin, setAmountMin] = useState('')
  const [amountMax, setAmountMax] = useState('')
  const [sort, setSort] = useState('date-desc')
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)

  const categoryOptions = useMemo(() => {
    const set = new Set()
    allTxns.forEach(t => set.add(normalizeCategory(t.Category, t.Amount)))
    return [...set].sort()
  }, [allTxns])

  const accountOptions = useMemo(() => {
    const set = new Set()
    files.forEach(f => { if (f.accountName) set.add(f.accountName) })
    return [...set].sort()
  }, [files])

  const hasActiveFilters = Boolean(
    search || category !== 'all' || account !== 'all' || dateFrom || dateTo || amountMin || amountMax
  )

  const clearFilters = () => {
    setSearch('')
    setCategory('all')
    setAccount('all')
    setDateFrom('')
    setDateTo('')
    setAmountMin('')
    setAmountMax('')
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    const min = amountMin !== '' ? parseFloat(amountMin) : null
    const max = amountMax !== '' ? parseFloat(amountMax) : null
    // Local-midnight boundaries (not UTC) so "From 8/1" includes all of 8/1
    // regardless of the user's timezone — same reasoning as parseDate's ISO case.
    const fromDate = dateFrom ? new Date(`${dateFrom}T00:00:00`) : null
    const toDate = dateTo ? new Date(`${dateTo}T23:59:59.999`) : null

    const rows = allTxns.filter(t => {
      if (q) {
        const haystack = `${t.Description || ''} ${t.Category || ''} ${t.Note || ''}`.toLowerCase()
        if (!haystack.includes(q)) return false
      }
      if (category !== 'all' && normalizeCategory(t.Category, t.Amount) !== category) return false
      if (account !== 'all' && accountByFileId[t.fileId] !== account) return false

      const d = parseDate(t)
      if (fromDate && (!d || d < fromDate)) return false
      if (toDate && (!d || d > toDate)) return false

      const amt = Math.abs(parseFloat(t.Amount) || 0)
      if (min !== null && amt < min) return false
      if (max !== null && amt > max) return false

      return true
    })

    rows.sort((a, b) => {
      if (sort === 'amount-desc') return Math.abs(parseFloat(b.Amount) || 0) - Math.abs(parseFloat(a.Amount) || 0)
      if (sort === 'amount-asc') return Math.abs(parseFloat(a.Amount) || 0) - Math.abs(parseFloat(b.Amount) || 0)
      const da = parseDate(a)?.getTime() || 0
      const db = parseDate(b)?.getTime() || 0
      return sort === 'date-asc' ? da - db : db - da
    })

    return rows
  }, [allTxns, search, category, account, accountByFileId, dateFrom, dateTo, amountMin, amountMax, sort])

  // Reset how many rows are shown whenever the result set changes underneath it.
  useEffect(() => { setVisibleCount(PAGE_SIZE) }, [search, category, account, dateFrom, dateTo, amountMin, amountMax, sort])

  const visible = filtered.slice(0, visibleCount)
  const totalAmount = filtered.reduce((sum, t) => sum + Math.abs(parseFloat(t.Amount) || 0), 0)

  if (isLoading) return <ListSkeleton />

  if (error) return <LoadError error={error} onRetry={retry} />

  if (allTxns.length === 0) {
    return (
      <EmptyState
        icon={Search}
        title="Nothing to search yet"
        description="Upload a statement and every transaction lands here — searchable across all your files and months."
      />
    )
  }

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" aria-hidden="true" />
          <input
            type="search"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search description, category, note…"
            aria-label="Search transactions"
            className={inputClass('pl-9 text-sm')}
          />
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2.5">
          <div>
            <label htmlFor="txn-category" className={labelClass}>Category</label>
            <select id="txn-category" value={category} onChange={e => setCategory(e.target.value)} className={selectClass('min-h-9 py-1.5 text-sm')}>
              <option value="all">All categories</option>
              {categoryOptions.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          {accountOptions.length > 0 && (
            <div>
              <label htmlFor="txn-account" className={labelClass}>Account</label>
              <select id="txn-account" value={account} onChange={e => setAccount(e.target.value)} className={selectClass('min-h-9 py-1.5 text-sm')}>
                <option value="all">All accounts</option>
                {accountOptions.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
          )}

          <div>
            <label htmlFor="txn-from" className={labelClass}>From</label>
            <input id="txn-from" type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className={inputClass('min-h-9 py-1.5 text-sm')} />
          </div>

          <div>
            <label htmlFor="txn-to" className={labelClass}>To</label>
            <input id="txn-to" type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className={inputClass('min-h-9 py-1.5 text-sm')} />
          </div>

          <div>
            <label htmlFor="txn-min" className={labelClass}>Min $</label>
            <input
              id="txn-min" type="number" min="0" step="0.01" inputMode="decimal"
              value={amountMin} onChange={e => setAmountMin(e.target.value)}
              placeholder="0" className={inputClass('min-h-9 py-1.5 text-sm')}
            />
          </div>

          <div>
            <label htmlFor="txn-max" className={labelClass}>Max $</label>
            <input
              id="txn-max" type="number" min="0" step="0.01" inputMode="decimal"
              value={amountMax} onChange={e => setAmountMax(e.target.value)}
              placeholder="Any" className={inputClass('min-h-9 py-1.5 text-sm')}
            />
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3">
          <select
            id="txn-sort" value={sort} onChange={e => setSort(e.target.value)}
            aria-label="Sort transactions"
            className={selectClass('min-h-9 max-w-[10rem] py-1.5 text-xs')}
          >
            <option value="date-desc">Newest first</option>
            <option value="date-asc">Oldest first</option>
            <option value="amount-desc">Amount: high–low</option>
            <option value="amount-asc">Amount: low–high</option>
          </select>
          {hasActiveFilters && (
            <Button size="sm" variant="ghost" onClick={clearFilters}>
              <X className="h-3.5 w-3.5" aria-hidden="true" /> Clear
            </Button>
          )}
        </div>
      </Card>

      <p className="px-1 text-sm text-ink-soft tnum">
        {filtered.length} transaction{filtered.length !== 1 ? 's' : ''} · {moneyExact(totalAmount)} total
      </p>

      {filtered.length === 0 ? (
        <EmptyState
          icon={Search}
          title="No matches"
          description="Try a different search term, or clear a filter to widen the results."
          action={hasActiveFilters ? <Button size="sm" variant="secondary" onClick={clearFilters}>Clear filters</Button> : undefined}
        />
      ) : (
        <div className="space-y-2">
          {visible.map(t => {
            const date = parseDate(t)?.toLocaleDateString() || ''
            const amount = Math.abs(parseFloat(t.Amount) || 0)
            const cat = normalizeCategory(t.Category, t.Amount)
            const acct = accountByFileId[t.fileId]
            return (
              <div key={t.id} className="well-soft p-3.5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-ink">{t.Description || ''}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      <span className="text-xs tnum text-ink-faint">{date}</span>
                      {acct && <Pill tone="sage" className="px-2 py-0.5 text-[11px]">{acct}</Pill>}
                    </div>
                  </div>
                  <div className="flex flex-shrink-0 flex-col items-end gap-1.5">
                    <span className="text-sm font-bold tnum text-ink">{moneyExact(amount)}</span>
                    <CategoryChip category={cat} size="sm" />
                  </div>
                </div>
                {t.Note && <p className="mt-2.5 text-xs italic text-ink-soft">{t.Note}</p>}
              </div>
            )
          })}

          {visibleCount < filtered.length && (
            <div className="pt-2 text-center">
              <Button variant="secondary" size="sm" onClick={() => setVisibleCount(c => c + PAGE_SIZE)}>
                Show more ({filtered.length - visibleCount} remaining)
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
