'use client'
import { useState, useEffect, useCallback } from 'react'
import { Landmark, RefreshCw, Trash2, AlertTriangle, Sparkles, Copy } from 'lucide-react'
import Link from 'next/link'
import { usePlaidLinkFlow } from './usePlaidLinkFlow'
import { ListSkeleton } from './ui/Skeletons'
import EmptyState from './ui/EmptyState'
import Modal from './ui/Modal'
import Button, { IconButton } from './ui/Button'
import { Pill } from './ui/Chip'
import { Banner } from './ui/Field'
import { SectionHeader } from './ui/SectionHeader'
import Doodle from './ui/Doodle'
import { moneyExact } from '@/lib/format'

// "2 hours ago" / "3 days ago" / "just now" — coarse on purpose, this is a
// status hint, not a precise timestamp (which is available on hover via title).
function timeAgo(iso) {
  if (!iso) return 'never'
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000))
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes} min${minutes === 1 ? '' : 's'} ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`
  const days = Math.floor(hours / 24)
  return `${days} day${days === 1 ? '' : 's'} ago`
}

// "Connected accounts": lives at the top of the Files tab (the "data comes
// in here" tab) rather than a dedicated nav item — a 6th mobile bottom-nav
// target would crush all five below a comfortable touch size (see
// app/page.js NAV_ITEMS). Renders nothing at all when Plaid isn't
// configured, matching every other optional-service's silent no-op.
export default function ConnectedAccounts() {
  const [state, setState] = useState(null) // { enabled, plan, items } | null while loading
  const [loadError, setLoadError] = useState(null)
  const [actionError, setActionError] = useState(null)
  const [syncingId, setSyncingId] = useState(null)
  const [confirmingDeleteId, setConfirmingDeleteId] = useState(null)
  const [deleteAlsoTransactions, setDeleteAlsoTransactions] = useState(false)
  const [deletingId, setDeletingId] = useState(null)

  // "Find duplicate imports" review flow — see GET /api/plaid/items/[id]/duplicates.
  const [scanningId, setScanningId] = useState(null)
  const [duplicateReviewItem, setDuplicateReviewItem] = useState(null) // the item being reviewed, or null
  const [candidates, setCandidates] = useState([])
  const [selectedIds, setSelectedIds] = useState(() => new Set())
  const [hidingBusy, setHidingBusy] = useState(false)

  const fetchItems = useCallback(async () => {
    setLoadError(null)
    try {
      const res = await fetch('/api/plaid/items')
      if (!res.ok) throw new Error('failed')
      setState(await res.json())
    } catch (error) {
      console.error('Error fetching Plaid items:', error)
      setLoadError('failed')
    }
  }, [])

  useEffect(() => { fetchItems() }, [fetchItems])

  const { start, busy: linkBusy } = usePlaidLinkFlow({
    onConnected: () => fetchItems(),
    onError: (message) => setActionError(message),
  })

  const syncItem = async (itemId) => {
    setSyncingId(itemId)
    setActionError(null)
    try {
      const res = await fetch('/api/plaid/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'sync failed')
      await fetchItems()
    } catch (error) {
      console.error('Error syncing Plaid item:', error)
      setActionError("Couldn't sync that connection. Please try again.")
    } finally {
      setSyncingId(null)
    }
  }

  const disconnectItem = async (itemId) => {
    setDeletingId(itemId)
    setActionError(null)
    try {
      const res = await fetch(`/api/plaid/items/${itemId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deleteTransactions: deleteAlsoTransactions }),
      })
      if (!res.ok) throw new Error('delete failed')
      setConfirmingDeleteId(null)
      setDeleteAlsoTransactions(false)
      await fetchItems()
    } catch (error) {
      console.error('Error disconnecting Plaid item:', error)
      setActionError("Couldn't disconnect that bank. Please try again.")
    } finally {
      setDeletingId(null)
    }
  }

  // Scans this connection's whole synced history for likely duplicates of
  // manually uploaded transactions — nothing is hidden yet, just found.
  const scanForDuplicates = async (item) => {
    setScanningId(item.id)
    setActionError(null)
    try {
      const res = await fetch(`/api/plaid/items/${item.id}/duplicates`)
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'scan failed')
      setCandidates(data.candidates || [])
      setSelectedIds(new Set((data.candidates || []).map(c => c.uploadTransactionId)))
      setDuplicateReviewItem(item)
    } catch (error) {
      console.error('Error scanning for duplicate transactions:', error)
      setActionError("Couldn't check for duplicate imports. Please try again.")
    } finally {
      setScanningId(null)
    }
  }

  const toggleCandidate = (uploadTransactionId) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(uploadTransactionId)) next.delete(uploadTransactionId)
      else next.add(uploadTransactionId)
      return next
    })
  }

  const closeDuplicateReview = () => {
    setDuplicateReviewItem(null)
    setCandidates([])
    setSelectedIds(new Set())
  }

  // Confirms the hide — the only place setTransactionsHidden(hidden: true)
  // gets called from the UI. Reversible: hidden transactions can be
  // restored from the "Hidden imports" panel in Settings.
  const confirmHide = async () => {
    if (selectedIds.size === 0) return
    setHidingBusy(true)
    setActionError(null)
    try {
      const res = await fetch('/api/transactions/hide', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: [...selectedIds], hidden: true }),
      })
      if (!res.ok) throw new Error('hide failed')
      closeDuplicateReview()
    } catch (error) {
      console.error('Error hiding duplicate transactions:', error)
      setActionError("Couldn't hide those transactions. Please try again.")
    } finally {
      setHidingBusy(false)
    }
  }

  if (state === null && !loadError) return <ListSkeleton rows={1} />
  // A fetch failure here shouldn't block the rest of the Files tab (upload
  // still works) — fail silent rather than blocking with a LoadError screen.
  if (loadError) return null
  if (!state.enabled) return null

  const { plan, items } = state
  const isPro = plan === 'pro'
  const confirmingItem = items.find(i => i.id === confirmingDeleteId)

  return (
    <div className="space-y-3">
      <SectionHeader title="Connected banks" doodle="dots" />

      {actionError && <Banner tone="error" role="alert">{actionError}</Banner>}

      {/* Free, no connections yet — a calm upsell, not a nag. First Pro-gated
          surface in the app, so it sets the tone for the rest of them. */}
      {!isPro && items.length === 0 && (
        <div className="card-soft flex flex-col items-start gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-lavender-100">
              <Doodle name="tulip" className="h-5 w-5 text-sage-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-ink">Connect your bank</p>
              <p className="text-sm text-ink-soft">
                Sprout Pro syncs transactions automatically — no more manual uploads.
              </p>
            </div>
          </div>
          <Link href="/pricing" className="flex-shrink-0">
            <Button variant="secondary" size="sm">
              <Sparkles className="h-4 w-4" aria-hidden="true" /> See Pro
            </Button>
          </Link>
        </div>
      )}

      {/* Free, but has connections from a lapsed subscription — syncing is
          paused, history stays visible everywhere else in the app. */}
      {!isPro && items.length > 0 && (
        <Banner tone="warning" icon={AlertTriangle}>
          Syncing is paused — your transactions are safe. <Link href="/pricing" className="font-semibold underline underline-offset-2">Resubscribe</Link> to resume.
        </Banner>
      )}

      {/* Pro, nothing connected yet */}
      {isPro && items.length === 0 && (
        <EmptyState
          illustration="tulip"
          title="No banks connected"
          description="Connect a bank and Sprout keeps your transactions up to date automatically."
          action={
            <Button onClick={() => start()} disabled={linkBusy}>
              <Landmark className="h-4 w-4" aria-hidden="true" />
              {linkBusy ? 'Connecting…' : 'Connect a bank'}
            </Button>
          }
        />
      )}

      {items.length > 0 && (
        <div className="space-y-3">
          {items.map(item => {
            const needsReauth = item.status === 'login_required'
            const isSyncing = syncingId === item.id
            const isDeleting = deletingId === item.id
            const isScanning = scanningId === item.id
            return (
              <div
                key={item.id}
                className={`card-soft p-4 sm:p-5 ${!isPro ? 'opacity-70' : ''}`}
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Landmark className="h-4 w-4 flex-shrink-0 text-sage-500" aria-hidden="true" />
                      <h4 className="text-base font-semibold text-ink">
                        {item.institutionName || 'Connected bank'}
                      </h4>
                    </div>

                    {item.accounts?.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {item.accounts.map(a => (
                          <Pill key={a.id} tone="sage">
                            {a.name}{a.mask ? ` •••• ${a.mask}` : ''}
                          </Pill>
                        ))}
                      </div>
                    )}

                    <p className="mt-2 text-sm text-ink-faint" title={item.lastSyncedAt || ''}>
                      {isPro ? `Last synced ${timeAgo(item.lastSyncedAt)}` : 'Syncing paused'}
                    </p>
                  </div>

                  <div className="flex flex-shrink-0 flex-wrap items-center gap-2">
                    {confirmingDeleteId === item.id ? (
                      <>
                        <span className="text-sm text-ink-soft">Disconnect?</span>
                        <Button size="sm" variant="danger" disabled={isDeleting} onClick={() => disconnectItem(item.id)}>
                          {isDeleting ? 'Disconnecting…' : 'Disconnect'}
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => { setConfirmingDeleteId(null); setDeleteAlsoTransactions(false) }}>
                          Cancel
                        </Button>
                      </>
                    ) : (
                      <>
                        {isPro && !needsReauth && (
                          <Button size="sm" variant="secondary" disabled={isSyncing} onClick={() => syncItem(item.id)}>
                            <RefreshCw className={`h-3.5 w-3.5 ${isSyncing ? 'animate-spin' : ''}`} aria-hidden="true" />
                            {isSyncing ? 'Syncing…' : 'Sync now'}
                          </Button>
                        )}
                        {isPro && !needsReauth && (
                          <Button size="sm" variant="secondary" disabled={isScanning} onClick={() => scanForDuplicates(item)}>
                            <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                            {isScanning ? 'Checking…' : 'Find duplicate imports'}
                          </Button>
                        )}
                        <IconButton label={`Disconnect ${item.institutionName || 'bank'}`} tone="danger" onClick={() => setConfirmingDeleteId(item.id)}>
                          <Trash2 className="h-4 w-4" aria-hidden="true" />
                        </IconButton>
                      </>
                    )}
                  </div>
                </div>

                {needsReauth && (
                  <Banner tone="error" icon={AlertTriangle} className="mt-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span>Your bank needs you to sign in again to keep syncing.</span>
                      <Button size="sm" variant="secondary" disabled={linkBusy} onClick={() => start(item.id)}>
                        {linkBusy ? 'Opening…' : 'Reconnect'}
                      </Button>
                    </div>
                  </Banner>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Disconnect confirmation carries an explicit opt-in for also
          deleting the synced history — the default keeps it, since it's the
          user's financial history and Plaid's cursor won't redeliver it once
          gone. */}
      {confirmingItem && (
        <Modal
          isOpen
          onClose={() => { setConfirmingDeleteId(null); setDeleteAlsoTransactions(false) }}
          title={`Disconnect ${confirmingItem.institutionName || 'this bank'}?`}
          ariaLabel="Disconnect bank confirmation"
        >
          <div className="space-y-4 p-4 sm:p-5">
            <p className="text-sm text-ink-soft">
              Sprout will stop syncing new transactions from this bank. Your synced transaction history
              can be kept or removed.
            </p>
            <label className="flex items-start gap-2.5 text-sm text-ink-soft">
              <input
                type="checkbox"
                checked={deleteAlsoTransactions}
                onChange={e => setDeleteAlsoTransactions(e.target.checked)}
                className="mt-0.5 h-4 w-4 flex-shrink-0 rounded border-line text-sage-600 focus:ring-sage-400"
              />
              Also delete the transactions already synced from this bank
            </label>
            <div className="flex justify-end gap-2 border-t border-line pt-4">
              <Button variant="ghost" onClick={() => { setConfirmingDeleteId(null); setDeleteAlsoTransactions(false) }}>
                Cancel
              </Button>
              <Button variant="danger" disabled={deletingId === confirmingItem.id} onClick={() => disconnectItem(confirmingItem.id)}>
                {deletingId === confirmingItem.id ? 'Disconnecting…' : 'Disconnect'}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Duplicate-import review — never hides anything until the user
          confirms. Matches are (date, amount) only, since Plaid and upload
          descriptions for the same real transaction are usually worded
          completely differently. */}
      {duplicateReviewItem && (
        <Modal
          isOpen
          onClose={closeDuplicateReview}
          title="Possible duplicate imports"
          subtitle={`${duplicateReviewItem.institutionName || 'This bank'} — ${candidates.length} match${candidates.length === 1 ? '' : 'es'} found`}
          ariaLabel="Review possible duplicate imports"
        >
          <div className="flex flex-col">
            {candidates.length === 0 ? (
              <p className="p-4 text-sm text-ink-soft sm:p-5">
                No matches found — nothing you&apos;ve uploaded looks like it overlaps with this connection&apos;s synced transactions.
              </p>
            ) : (
              <>
                <p className="px-4 pt-4 text-sm leading-relaxed text-ink-soft sm:px-5 sm:pt-5">
                  These uploaded transactions match a synced transaction from {duplicateReviewItem.institutionName || 'this bank'}
                  {' '}on the same date for the same amount — almost certainly the same real transaction, counted twice.
                  Checked ones will be hidden everywhere (charts, totals, search) but not deleted — you can restore them
                  anytime from Settings.
                </p>
                <ul className="max-h-72 space-y-0.5 overflow-y-auto px-2 py-3 sm:px-3">
                  {candidates.map(c => {
                    const checked = selectedIds.has(c.uploadTransactionId)
                    return (
                      <li key={c.uploadTransactionId}>
                        <label className="flex cursor-pointer items-start justify-between gap-3 rounded-[var(--radius-xs)] px-2 py-2 text-sm hover:bg-surface-hover">
                          <span className="flex min-w-0 items-start gap-2.5">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleCandidate(c.uploadTransactionId)}
                              className="mt-0.5 h-4 w-4 flex-shrink-0 accent-sage-600"
                            />
                            <span className="min-w-0">
                              <span className="block truncate text-ink-soft">
                                <span className="text-ink-faint">Uploaded:</span> {c.uploadDescription || '—'}
                              </span>
                              <span className="block truncate text-xs text-ink-faint">
                                <span className="text-ink-faint">Synced:</span> {c.plaidDescription || '—'}
                              </span>
                            </span>
                          </span>
                          <span className="flex-shrink-0 whitespace-nowrap tnum text-ink-faint">
                            {c.date} · {moneyExact(Math.abs(parseFloat(c.amount) || 0))}
                          </span>
                        </label>
                      </li>
                    )
                  })}
                </ul>
                <div className="flex justify-end gap-2 border-t border-line p-4 sm:p-5">
                  <Button variant="ghost" onClick={closeDuplicateReview}>Cancel</Button>
                  <Button disabled={selectedIds.size === 0 || hidingBusy} onClick={confirmHide}>
                    {hidingBusy ? 'Hiding…' : `Hide ${selectedIds.size} transaction${selectedIds.size === 1 ? '' : 's'}`}
                  </Button>
                </div>
              </>
            )}
          </div>
        </Modal>
      )}
    </div>
  )
}
