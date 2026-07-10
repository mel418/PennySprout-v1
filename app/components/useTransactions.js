'use client'
import { useState, useEffect, useCallback } from 'react'

// Shared data hook: pulls the user's transactions from the normalized
// /api/transactions endpoint (their own table — no more JSONB blobs riding
// along with file metadata). Rows keep the legacy key shape ('Trans. Date',
// 'Description', …) plus `id` and `fileId`, so every component and calc
// helper works unchanged.
//
// Loading and failure are tracked separately: an expired session must never
// masquerade as "you have no spending." error is null on success, or
// { kind: 'auth' | 'server' | 'network' } — render
// <LoadError error={error} onRetry={retry} /> when it's set.
export function useTransactions() {
  const [transactions, setTransactions] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let cancelled = false
    setIsLoading(true)
    setError(null)
    fetch('/api/transactions')
      .then(res => {
        if (res.status === 401) throw { kind: 'auth' }
        if (!res.ok) throw { kind: 'server' }
        return res.json()
      })
      .then(data => {
        if (cancelled) return
        setTransactions(data.transactions || [])
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

  // Merge fields into one row locally (optimistic updates after a PATCH).
  // A falsy Note is removed entirely, matching the "empty clears" semantics.
  const patchLocal = useCallback((id, fields) => {
    setTransactions(prev => prev.map(t => {
      if (t.id !== id) return t
      const next = { ...t, ...fields }
      if ('Note' in fields && !fields.Note) delete next.Note
      return next
    }))
  }, [])

  return { transactions, isLoading, error, retry, patchLocal }
}
