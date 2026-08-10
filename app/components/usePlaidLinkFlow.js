'use client'
import { useState, useCallback, useEffect, useRef } from 'react'
import { usePlaidLink } from 'react-plaid-link'

// Wraps the two-step Plaid Link dance (fetch a link_token, then hand it to
// usePlaidLink) behind one `open()` call.
//
// This has to be its own hook rather than inline logic in ConnectedAccounts:
// usePlaidLink can't be called conditionally (it's a hook), but the token it
// needs only exists after an async fetch — so this hook always calls
// usePlaidLink (with token: null until ready) and opens Link itself the
// moment a token arrives, via the `open` callback usePlaidLink returns.
//
// `mode`: 'new' links a brand-new bank; passing an `itemId` opens Link in
// update mode to re-authenticate an existing one (see the link-token route).
export function usePlaidLinkFlow({ onConnected, onError }) {
  const [linkToken, setLinkToken] = useState(null)
  const [pendingItemId, setPendingItemId] = useState(null)
  const [busy, setBusy] = useState(false)
  // True from the moment a fresh link_token arrives until Link has actually
  // been opened once for it — guards against re-opening on every render
  // once `ready` flips true, and against opening a stale token after Link
  // has already been closed (onSuccess/onExit reset linkToken to null,
  // which this flag tracks by construction).
  const awaitingOpen = useRef(false)

  const { open, ready } = usePlaidLink({
    token: linkToken,
    onSuccess: async (public_token, metadata) => {
      setBusy(true)
      try {
        if (pendingItemId) {
          // Update mode: Plaid already refreshed the existing Item in
          // place. Nothing to exchange — just let the caller know so it can
          // refresh the item list and offer a sync.
          onConnected?.({ itemId: pendingItemId })
        } else {
          const res = await fetch('/api/plaid/exchange', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              public_token,
              institution: metadata?.institution
                ? { institution_id: metadata.institution.institution_id, name: metadata.institution.name }
                : null,
            }),
          })
          const data = await res.json()
          if (!res.ok) throw new Error(data.error || 'exchange failed')
          onConnected?.({ itemId: data.item?.id })
        }
      } catch (error) {
        console.error('Error finishing Plaid Link:', error)
        onError?.("Couldn't finish connecting your bank. Please try again.")
      } finally {
        setBusy(false)
        setLinkToken(null)
        setPendingItemId(null)
      }
    },
    onExit: (err) => {
      setLinkToken(null)
      setPendingItemId(null)
      if (err) {
        console.error('Plaid Link exited with an error:', err)
        onError?.("Bank connection didn't complete. Please try again.")
      }
    },
  })

  // Fetches a link_token, then opens Link the moment react-plaid-link has
  // consumed it — `ready` flips true asynchronously after `token` changes,
  // so the actual open() call happens in the effect below, not here.
  const start = useCallback(async (itemId = null) => {
    setBusy(true)
    try {
      const res = await fetch('/api/plaid/link-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(itemId ? { itemId } : {}),
      })
      const data = await res.json()
      if (!res.ok || !data.linkToken) throw new Error(data.error || 'link-token failed')
      awaitingOpen.current = true
      setPendingItemId(itemId)
      setLinkToken(data.linkToken)
    } catch (error) {
      console.error('Error starting Plaid Link:', error)
      onError?.(
        error.message === 'This feature is part of Sprout Pro.'
          ? error.message
          : "Couldn't start bank connection. Please try again."
      )
      setBusy(false)
    }
  }, [onError])

  useEffect(() => {
    if (ready && linkToken && awaitingOpen.current) {
      awaitingOpen.current = false
      open()
    }
  }, [ready, linkToken, open])

  return { start, ready, busy: busy || (Boolean(linkToken) && !ready) }
}
