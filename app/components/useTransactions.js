'use client'
import { useState, useEffect, useCallback } from 'react'

// Shared data hook: pulls every file's transactions from /api/files and pools
// them, tracking loading and failure separately. Overview, SpendingCalendar,
// and SpendingDashboard all previously did this fetch themselves and swallowed
// errors into an empty state — so an expired session looked identical to a
// brand-new account with no data. In a finance app that ambiguity is
// unacceptable: "you have no spending" must never be a disguised error.
//
// error is null on success, or { kind: 'auth' | 'server' | 'network' } —
// render <LoadError error={error} onRetry={retry} /> when it's set.
export function useTransactions() {
  const [transactions, setTransactions] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let cancelled = false
    setIsLoading(true)
    setError(null)
    fetch('/api/files')
      .then(res => {
        if (res.status === 401) throw { kind: 'auth' }
        if (!res.ok) throw { kind: 'server' }
        return res.json()
      })
      .then(data => {
        if (cancelled) return
        setTransactions((data.files || []).flatMap(f => f.transactions || []))
      })
      .catch(err => {
        if (cancelled) return
        setTransactions([])
        setError({ kind: err.kind || 'network' })
      })
      .finally(() => { if (!cancelled) setIsLoading(false) })
    return () => { cancelled = true }
  }, [attempt])

  const retry = useCallback(() => setAttempt(a => a + 1), [])

  return { transactions, isLoading, error, retry }
}
