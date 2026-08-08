'use client'
import { useState, useEffect, useCallback } from 'react'

// Shared across every view that lists transactions (Files review, Analysis
// category modal, Calendar day panel) so a Target purchase's item list can
// be shown wherever that transaction appears, without each view re-fetching
// or re-implementing the same lazy-load-on-expand logic.
export function useTargetPurchaseMatches() {
  const [matchedIds, setMatchedIds] = useState(new Set())
  const [expandedId, setExpandedId] = useState(null)
  const [itemsById, setItemsById] = useState({})
  const [loadingId, setLoadingId] = useState(null)

  useEffect(() => {
    fetch('/api/target-purchases')
      .then(r => r.ok ? r.json() : { matchedTransactionIds: [] })
      .then(({ matchedTransactionIds }) => setMatchedIds(new Set(matchedTransactionIds || [])))
      .catch(() => {})
  }, [])

  const toggle = useCallback(async (transactionId) => {
    setExpandedId(prev => {
      if (prev === transactionId) return null
      return transactionId
    })
    if (itemsById[transactionId]) return
    setLoadingId(transactionId)
    try {
      const res = await fetch(`/api/target-purchases?transactionId=${transactionId}`)
      const { items } = await res.json()
      setItemsById(prev => ({ ...prev, [transactionId]: items || [] }))
    } catch {
      setItemsById(prev => ({ ...prev, [transactionId]: [] }))
    } finally {
      setLoadingId(null)
    }
  }, [itemsById])

  const close = useCallback(() => setExpandedId(null), [])

  return { matchedIds, expandedId, itemsById, loadingId, toggle, close }
}
