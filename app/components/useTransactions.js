'use client'
import { useEffect, useCallback, useSyncExternalStore } from 'react'

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
//
// The data lives in one module-level store shared by every component that
// calls this hook. Previously each of the ~6 mounted components fetched (and
// the server paged through) the user's ENTIRE history on its own; now they
// share one request, later mounts render the cached rows instantly while a
// background refresh runs, and an optimistic edit in one view (patchLocal /
// removeLocal) shows up in all of them.

let state = { transactions: [], isLoading: true, error: null }
let loaded = false // true once a fetch has succeeded
let inFlight = null
const listeners = new Set()

function setState(next) {
  state = { ...state, ...next }
  listeners.forEach(l => l())
}

function subscribe(listener) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

const getSnapshot = () => state
const getServerSnapshot = () => state

// Concurrent callers share one request. Every mount still revalidates in the
// background (uploads, Plaid syncs and hide/restore all rely on a remount
// picking up fresh rows), but the cached rows render immediately meanwhile.
function fetchTransactions() {
  if (inFlight) return inFlight

  // Only show the loading state when there's nothing cached to display.
  if (!loaded) setState({ isLoading: true, error: null })

  inFlight = fetch('/api/transactions')
    .then(res => {
      if (res.status === 401) throw { kind: 'auth' }
      if (!res.ok) throw { kind: 'server' }
      return res.json()
    })
    .then(data => {
      loaded = true
      setState({ transactions: data.transactions || [], isLoading: false, error: null })
    })
    .catch(err => {
      const kind = err?.kind || 'network'
      // A failed background refresh keeps the rows already on screen; a
      // failed first load (or a dead session) surfaces the error instead.
      if (loaded && kind !== 'auth') return setState({ isLoading: false })
      loaded = false
      setState({ transactions: [], isLoading: false, error: { kind } })
    })
    .finally(() => { inFlight = null })

  return inFlight
}

export function useTransactions() {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)

  useEffect(() => { fetchTransactions() }, [])

  const retry = useCallback(() => fetchTransactions(), [])

  // Merge fields into one row locally (optimistic updates after a PATCH).
  // A falsy Note is removed entirely, matching the "empty clears" semantics.
  const patchLocal = useCallback((id, fields) => {
    setState({
      transactions: state.transactions.map(t => {
        if (t.id !== id) return t
        const next = { ...t, ...fields }
        if ('Note' in fields && !fields.Note) delete next.Note
        return next
      }),
    })
  }, [])

  // Drop one row locally (optimistic update after a DELETE).
  const removeLocal = useCallback((id) => {
    setState({ transactions: state.transactions.filter(t => t.id !== id) })
  }, [])

  return {
    transactions: snapshot.transactions,
    isLoading: snapshot.isLoading,
    error: snapshot.error,
    retry,
    patchLocal,
    removeLocal,
  }
}
