'use client'
import { useState, useCallback, useEffect, useRef } from 'react'
import { usePlaidLink } from 'react-plaid-link'

// sessionStorage keys used to survive the OAuth round trip (see below) —
// sessionStorage rather than localStorage because a half-finished bank
// connection shouldn't linger past the tab closing.
const TOKEN_KEY = 'plaid_link_token'
const ITEM_ID_KEY = 'plaid_link_item_id'

// Wraps the two-step Plaid Link dance (fetch a link_token, then hand it to
// usePlaidLink) behind one `open()` call, PLUS resuming Link after an OAuth
// bank redirect.
//
// This has to be its own hook rather than inline logic in ConnectedAccounts:
// usePlaidLink can't be called conditionally (it's a hook), but the token it
// needs only exists after an async fetch — so this hook always calls
// usePlaidLink (with token: null until ready) and opens Link itself the
// moment a token arrives, via the `open` callback usePlaidLink returns.
//
// OAuth institutions (Chase and other large US banks, in Production — not
// Sandbox) don't complete inside Link's own modal. Instead Link does a full
// page navigation to the bank's login page, then the bank redirects back to
// the URI registered in the Plaid Dashboard (see app/api/plaid/link-token's
// redirect_uri) with `?oauth_state_id=...` appended. That's a real browser
// navigation, so every bit of React state from before the redirect is gone
// — the link_token (and, for a reconnect, which item it was for) has to be
// stashed in sessionStorage before leaving, and read back on the way in.
// react-plaid-link resumes the SAME flow (no re-picking the institution)
// once it's given that original token plus `receivedRedirectUri` set to the
// current (oauth_state_id-bearing) URL.
export function usePlaidLinkFlow({ onConnected, onError }) {
  const [linkToken, setLinkToken] = useState(null)
  const [pendingItemId, setPendingItemId] = useState(null)
  const [resumeRedirectUri, setResumeRedirectUri] = useState(null)
  const [busy, setBusy] = useState(false)
  // True from the moment a fresh (or resumed) link_token arrives until Link
  // has actually been opened once for it — guards against re-opening on
  // every render once `ready` flips true, and against opening a stale token
  // after Link has already been closed (onSuccess/onExit reset linkToken to
  // null, which this flag tracks by construction).
  const awaitingOpen = useRef(false)

  const cleanup = useCallback(() => {
    setLinkToken(null)
    setPendingItemId(null)
    setResumeRedirectUri(null)
    sessionStorage.removeItem(TOKEN_KEY)
    sessionStorage.removeItem(ITEM_ID_KEY)
    // Strip oauth_state_id (and Plaid's other oauth_* params) so a page
    // refresh after finishing doesn't try to resume a dead flow.
    if (window.location.search.includes('oauth_state_id')) {
      const url = new URL(window.location.href)
      ;[...url.searchParams.keys()].filter(k => k.startsWith('oauth_')).forEach(k => url.searchParams.delete(k))
      window.history.replaceState(null, '', url.pathname + url.search + url.hash)
    }
  }, [])

  const { open, ready } = usePlaidLink({
    token: linkToken,
    ...(resumeRedirectUri ? { receivedRedirectUri: resumeRedirectUri } : {}),
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
        cleanup()
      }
    },
    onExit: (err) => {
      cleanup()
      if (err) {
        console.error('Plaid Link exited with an error:', err)
        onError?.("Bank connection didn't complete. Please try again.")
      }
    },
  })

  // Fetches a link_token, stashes it (for the possible OAuth round trip),
  // then opens Link the moment react-plaid-link has consumed it — `ready`
  // flips true asynchronously after `token` changes, so the actual open()
  // call happens in the effect below, not here.
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

      sessionStorage.setItem(TOKEN_KEY, data.linkToken)
      if (itemId) sessionStorage.setItem(ITEM_ID_KEY, itemId)
      else sessionStorage.removeItem(ITEM_ID_KEY)

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

  // On mount, resume an OAuth-interrupted flow: the bank redirected the
  // whole page back here with ?oauth_state_id=... in the URL. The saved
  // token from sessionStorage plus the current URL (as receivedRedirectUri)
  // is enough for Link to pick the flow back up without the user re-picking
  // their institution or re-entering credentials.
  useEffect(() => {
    if (!window.location.search.includes('oauth_state_id')) return

    const savedToken = sessionStorage.getItem(TOKEN_KEY)
    if (!savedToken) {
      // No token to resume with — a cleared session, a different browser,
      // or a stale/duplicate redirect. Nothing to recover; just tidy the
      // URL so a refresh doesn't keep tripping this branch.
      onError?.("Your bank connection didn't finish — please try connecting again.")
      cleanup()
      return
    }

    const savedItemId = sessionStorage.getItem(ITEM_ID_KEY)
    awaitingOpen.current = true
    setPendingItemId(savedItemId || null)
    setResumeRedirectUri(window.location.href)
    setLinkToken(savedToken)
    // Mount-only: this is a one-time resumption check against the URL Link
    // navigated back to, not a value that should re-run per render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (ready && linkToken && awaitingOpen.current) {
      awaitingOpen.current = false
      open()
    }
  }, [ready, linkToken, open])

  return { start, ready, busy: busy || (Boolean(linkToken) && !ready) }
}
