'use client'
import { useState, useEffect, useMemo, useCallback } from 'react'
import { Trash2, FileText, Calendar, Pencil, Check, X, StickyNote, RotateCcw } from 'lucide-react'
import { calcSpending, STANDARD_CATEGORIES } from '@/lib/categories'
import { parseDate, monthKey, monthKeyLabel } from '@/lib/date'
import { moneyExact } from '@/lib/format'
import { useTransactions } from './useTransactions'
import { useTargetPurchaseMatches } from './useTargetPurchaseMatches'
import { TargetItemsToggle, TargetItemsList } from './TargetItemsList'
import LoadError from './LoadError'
import { ListSkeleton } from './ui/Skeletons'
import EmptyState from './ui/EmptyState'
import Modal from './ui/Modal'
import Button, { IconButton } from './ui/Button'
import { Pill } from './ui/Chip'
import { inputClass, selectClass, Banner } from './ui/Field'
import { SectionHeader } from './ui/SectionHeader'
import TargetPurchaseImport from './TargetPurchaseImport'
import TargetImportsList from './TargetImportsList'

export default function UserFiles({ userId }) {
  // File METADATA from /api/files; transaction rows come from the shared
  // hook (normalized table) and are grouped by fileId below.
  const [files, setFiles] = useState([])
  const [isLoadingFiles, setIsLoadingFiles] = useState(true)
  // metaError: the /api/files metadata fetch failed — never disguise it as
  // "no files yet." actionError: a later delete/rename failed (banner).
  const [metaError, setMetaError] = useState(null)
  const [actionError, setActionError] = useState(null)
  // Two-step delete: first click arms this file's row, second click deletes.
  const [confirmingDeleteId, setConfirmingDeleteId] = useState(null)

  // Bumped after a successful Target CSV import to remount (and refetch)
  // TargetImportsList — same key-remount pattern page.js uses for this list.
  const [targetImportsRefresh, setTargetImportsRefresh] = useState(0)

  // 'month' groups by statement period (derived from transaction dates);
  // 'account' groups by the account name assigned at upload.
  const [groupBy, setGroupBy] = useState('month')

  const {
    transactions: allTransactions,
    isLoading: isLoadingTxns,
    error: txnError,
    retry,
    patchLocal,
    removeLocal,
  } = useTransactions()

  // editingId: which file's title is currently being edited (null = none)
  // editingName: the live value of the input while editing
  const [editingId, setEditingId] = useState(null)
  const [editingName, setEditingName] = useState('')

  // reviewFile: the file whose transactions are shown in the review modal (null = closed)
  const [reviewFile, setReviewFile] = useState(null)
  const [editError, setEditError] = useState(null)

  // Note editing: which transaction's note is open (row id), and the draft text.
  const [noteEditId, setNoteEditId] = useState(null)
  const [noteDraft, setNoteDraft] = useState('')

  // Two-step delete for a single transaction, same pattern as file delete.
  const [confirmingTxnDeleteId, setConfirmingTxnDeleteId] = useState(null)

  // Matched Target purchase items — drives the "view items" icon and its
  // expandable item list in the review modal (see useTargetPurchaseMatches).
  const {
    matchedIds: targetMatchedIds,
    expandedId: expandedTargetId,
    itemsById: targetItemsById,
    loadingId: targetItemsLoadingId,
    toggle: toggleTargetItems,
    close: closeTargetItems,
  } = useTargetPurchaseMatches()

  // Stable close handler — Modal's useDialog takes it as an effect dependency.
  const closeReview = useCallback(() => {
    setReviewFile(null); setNoteEditId(null); setConfirmingTxnDeleteId(null); closeTargetItems()
  }, [closeTargetItems])

  const fetchFiles = useCallback(async () => {
    setIsLoadingFiles(true)
    setMetaError(null)
    try {
      const response = await fetch('/api/files')
      if (response.status === 401) throw { kind: 'auth' }
      if (!response.ok) throw { kind: 'server' }
      const data = await response.json()
      setFiles(data.files || [])
    } catch (error) {
      console.error('Error fetching files:', error)
      setMetaError({ kind: error.kind || 'network' })
    } finally {
      setIsLoadingFiles(false)
    }
  }, [])

  useEffect(() => {
    fetchFiles()
  }, [fetchFiles])

  // fileId → its transaction rows.
  const byFile = useMemo(() => {
    const map = {}
    allTransactions.forEach(t => {
      ;(map[t.fileId] ||= []).push(t)
    })
    return map
  }, [allTransactions])

  // A file's "statement period" is whichever calendar month has the most of
  // its transactions. Card statement cycles commonly span two months (e.g.
  // Apr 15–May 14), so picking the single latest transaction's month tended
  // to bucket an "April" statement under May just because it closed a few
  // days into May — the majority-month better matches how people actually
  // name/think about a statement. Falls back to the upload date when a file
  // has no parseable transaction dates (e.g. all rows failed to parse).
  const filePeriodKey = useCallback((file) => {
    const dates = (byFile[file.id] || []).map(parseDate).filter(Boolean)
    if (dates.length === 0) return monthKey(new Date(file.uploadDate))

    const counts = new Map()
    dates.forEach(d => {
      const key = monthKey(d)
      counts.set(key, (counts.get(key) || 0) + 1)
    })

    let bestKey = null
    let bestCount = -1
    for (const [key, count] of counts) {
      if (count > bestCount) {
        bestKey = key
        bestCount = count
      }
    }
    return bestKey
  }, [byFile])

  // Files grouped into sections per the active groupBy mode, most-relevant
  // group first (newest month, or alphabetical account name).
  const groupedFiles = useMemo(() => {
    const map = new Map()
    files.forEach(file => {
      const key = groupBy === 'account' ? (file.accountName || '') : filePeriodKey(file)
      if (!map.has(key)) map.set(key, [])
      map.get(key).push(file)
    })

    const entries = [...map.entries()]
    if (groupBy === 'account') {
      // Alphabetical, with the unlabeled bucket pushed to the end.
      entries.sort((a, b) => {
        if (!a[0]) return 1
        if (!b[0]) return -1
        return a[0].localeCompare(b[0])
      })
      return entries.map(([key, groupFiles]) => ({
        key: key || 'unlabeled',
        label: key || 'No account set',
        files: groupFiles
      }))
    }

    entries.sort((a, b) => b[0].localeCompare(a[0]))
    return entries.map(([key, groupFiles]) => ({
      key,
      label: monthKeyLabel(key),
      files: groupFiles
    }))
  }, [files, groupBy, filePeriodKey])

  const deleteFile = async (fileId) => {
    setConfirmingDeleteId(null)
    setActionError(null)
    try {
      const response = await fetch(`/api/files/${fileId}`, { method: 'DELETE' })
      if (!response.ok) throw new Error('Delete failed')
      setFiles(files.filter(f => f.id !== fileId))
    } catch (error) {
      console.error('Error deleting file:', error)
      setActionError('Failed to delete file. Please try again.')
    }
  }

  const startEditing = (file) => {
    setEditingId(file.id)
    setEditingName(file.name)
  }

  const cancelEditing = () => {
    setEditingId(null)
    setEditingName('')
  }

  const revertName = async (file) => {
    setActionError(null)
    try {
      const response = await fetch(`/api/files/${file.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: file.originalName })
      })
      if (!response.ok) throw new Error('Revert failed')
      setFiles(files.map(f => f.id === file.id ? { ...f, name: file.originalName } : f))
    } catch (error) {
      console.error('Error reverting file name:', error)
      setActionError("Couldn't revert the file name. Please try again.")
    }
  }

  const saveTitle = async (fileId) => {
    const trimmed = editingName.trim()
    if (!trimmed) return cancelEditing()

    setActionError(null)
    try {
      const response = await fetch(`/api/files/${fileId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmed })
      })
      if (!response.ok) throw new Error('Rename failed')

      // Update the name in local state so the UI reflects it immediately
      // without needing a full refetch
      setFiles(files.map(f => f.id === fileId ? { ...f, name: trimmed } : f))
      cancelEditing()
    } catch (error) {
      console.error('Error renaming file:', error)
      setActionError("Couldn't rename the file. Please try again.")
    }
  }

  // Edit one transaction (category correction or note) by its row id.
  // Optimistic: the UI updates immediately via patchLocal and rolls back if
  // the save fails. `fields` uses the client key shape, e.g.
  // { Category: 'Food' } or { Note: 'split with roommate' }.
  const updateTransaction = async (txn, fields) => {
    setEditError(null)
    const previous = { Category: txn.Category, Note: txn.Note }
    patchLocal(txn.id, fields)
    try {
      const res = await fetch(`/api/transactions/${txn.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...(fields.Category !== undefined && { category: fields.Category }),
          ...(fields.Note !== undefined && { note: fields.Note }),
        }),
      })
      if (!res.ok) throw new Error('save failed')
    } catch (error) {
      console.error('Error updating transaction:', error)
      patchLocal(txn.id, previous)
      setEditError("Couldn't save the change. Please try again.")
    }
  }

  const saveNote = (txn) => {
    updateTransaction(txn, { Note: noteDraft.trim() })
    setNoteEditId(null)
  }

  // Deletes a single transaction — e.g. a duplicate from an overlapping
  // statement that was already imported before the upload-time duplicate
  // check existed. Removes it from local state immediately; the file's
  // displayed transaction count is computed live from byFile so it stays
  // correct without a separate metadata update.
  const deleteTransaction = async (txn) => {
    setConfirmingTxnDeleteId(null)
    setEditError(null)
    try {
      const res = await fetch(`/api/transactions/${txn.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('delete failed')
      removeLocal(txn.id)
    } catch (error) {
      console.error('Error deleting transaction:', error)
      setEditError("Couldn't delete the transaction. Please try again.")
    }
  }

  if (isLoadingFiles || isLoadingTxns) return <ListSkeleton />

  if (txnError) return <LoadError error={txnError} onRetry={retry} />
  if (metaError) return <LoadError error={metaError} onRetry={fetchFiles} />

  // Target imports render regardless of whether any bank statement exists
  // yet — they're an independent data source, not something that should
  // hide behind "no files uploaded."
  if (files.length === 0) {
    return (
      <div className="space-y-6">
        <div className="space-y-3">
          <TargetPurchaseImport onImported={() => setTargetImportsRefresh(k => k + 1)} />
          <TargetImportsList key={targetImportsRefresh} />
        </div>
        <EmptyState
          illustration="cloud"
          title="Nothing here yet"
          description="Upload a CSV or PDF statement above and it'll show up here, ready to review."
        />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <TargetPurchaseImport onImported={() => setTargetImportsRefresh(k => k + 1)} />
        <TargetImportsList key={targetImportsRefresh} />
      </div>

      <div className="space-y-3">
      <SectionHeader
        title="Your uploaded files"
        doodle="dots"
        className="mb-4"
        action={
          /* Group-by toggle */
          <div className="inline-flex items-center rounded-full bg-surface-2 p-1 text-xs">
            {[['month', 'By month'], ['account', 'By account']].map(([value, label]) => (
              <button
                key={value}
                onClick={() => setGroupBy(value)}
                aria-pressed={groupBy === value}
                className={`min-h-8 rounded-full px-3 font-semibold transition-colors ${
                  groupBy === value ? 'bg-surface text-ink shadow-xs' : 'text-ink-faint hover:text-ink-soft'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        }
      />

      {actionError && <Banner tone="error" role="alert">{actionError}</Banner>}

      {groupedFiles.map(group => (
        <div key={group.key} className="space-y-3">
          <h3 className="text-xs font-semibold text-ink-faint uppercase tracking-wide pt-2 first:pt-0">
            {group.label}
          </h3>

          {group.files.map((file) => {
            // Recalculate spending using the same logic as the dashboard:
            // excludes Income and Bills & Payments so the number matches.
            const fileTxns = byFile[file.id] || []
            const spending = calcSpending(fileTxns)
            const isEditing = editingId === file.id

            return (
              <div key={file.id} className="card-soft p-4 transition-colors hover:border-sage-300 sm:p-5">
                {/* Stacks on phones, sits side-by-side from sm up — the action
                    row never gets squeezed into an unreadable column. */}
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                  <div className="min-w-0 flex-1">

                    {/* Title row — shows input when editing, plain text otherwise */}
                    {isEditing ? (
                      <div className="mb-3 flex items-center gap-2">
                        <input
                          autoFocus
                          value={editingName}
                          onChange={e => setEditingName(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') saveTitle(file.id)
                            if (e.key === 'Escape') cancelEditing()
                          }}
                          aria-label={`Rename ${file.name}`}
                          className={inputClass('flex-1 font-semibold')}
                        />
                        {/* Check saves, X cancels */}
                        <IconButton label="Save name" tone="sage" onClick={() => saveTitle(file.id)}>
                          <Check className="h-4 w-4" aria-hidden="true" />
                        </IconButton>
                        <IconButton label="Cancel rename" onClick={cancelEditing}>
                          <X className="h-4 w-4" aria-hidden="true" />
                        </IconButton>
                      </div>
                    ) : (
                      // group + group-hover reveals the edit affordances on
                      // pointer devices; they stay permanently visible on
                      // touch, where there is no hover state to discover.
                      <div className="group mb-2 flex flex-wrap items-center gap-1">
                        <h4 className="mr-1 min-w-0 flex-shrink truncate text-base font-semibold text-ink">{file.name}</h4>
                        <IconButton
                          label={`Rename ${file.name}`}
                          tone="sage"
                          onClick={() => startEditing(file)}
                          className="transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100"
                        >
                          <Pencil className="h-4 w-4" aria-hidden="true" />
                        </IconButton>
                        {file.originalName && file.name !== file.originalName && (
                          <IconButton
                            label={`Revert to original name: ${file.originalName}`}
                            tone="sage"
                            onClick={() => revertName(file)}
                            className="transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100"
                          >
                            <RotateCcw className="h-4 w-4" aria-hidden="true" />
                          </IconButton>
                        )}
                        {file.accountName && <Pill tone="sage" className="ml-1">{file.accountName}</Pill>}
                      </div>
                    )}

                    {/* Metadata row */}
                    <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-sm text-ink-faint">
                      <span className="flex items-center gap-1.5">
                        <Calendar className="h-3.5 w-3.5" aria-hidden="true" />
                        <span className="tnum">{new Date(file.uploadDate).toLocaleDateString()}</span>
                      </span>
                      <span className="flex items-center gap-1.5">
                        <FileText className="h-3.5 w-3.5" aria-hidden="true" />
                        {/* Live count from actual rows, not the stored metadata —
                            stays correct after deleting an individual transaction. */}
                        <span className="tnum">{fileTxns.length}</span> transaction{fileTxns.length === 1 ? '' : 's'}
                      </span>
                      <span className="font-semibold tnum text-ink-soft">
                        {moneyExact(spending)} spending
                      </span>
                    </div>
                  </div>

                  {/* Action buttons — delete is two-step: arm, then confirm inline */}
                  <div className="flex flex-shrink-0 flex-wrap items-center gap-2">
                    {confirmingDeleteId === file.id ? (
                      <>
                        <span className="text-sm text-ink-soft">Delete this file?</span>
                        <Button size="sm" variant="danger" onClick={() => deleteFile(file.id)}>Delete</Button>
                        <Button size="sm" variant="ghost" onClick={() => setConfirmingDeleteId(null)}>Cancel</Button>
                      </>
                    ) : (
                      <>
                        <Button size="sm" onClick={() => setReviewFile(file)}>Review</Button>
                        <IconButton label={`Delete ${file.name}`} tone="danger" onClick={() => setConfirmingDeleteId(file.id)}>
                          <Trash2 className="h-4 w-4" aria-hidden="true" />
                        </IconButton>
                      </>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      ))}

      {/* Review modal — lists the file's transactions with editable categories
          and notes. Rows come from the normalized table and carry stable ids,
          so edits target /api/transactions/:id directly. */}
      {reviewFile && (() => {
        const transactions = (byFile[reviewFile.id] || [])
          .slice()
          .sort((a, b) => (parseDate(b)?.getTime() || 0) - (parseDate(a)?.getTime() || 0))

        // Offer the standard set plus any bank-specific categories already in
        // this file, so changing one transaction never loses a custom category.
        const categoryOptions = [...new Set([
          ...STANDARD_CATEGORIES,
          ...transactions.map(t => t.Category).filter(Boolean),
        ])].sort()

        return (
          <Modal
            isOpen
            onClose={closeReview}
            title={reviewFile.name}
            subtitle={`${transactions.length} transaction${transactions.length !== 1 ? 's' : ''} · fix categories or add notes`}
            ariaLabel={`Transactions in ${reviewFile.name}`}
          >
              {editError && (
                <div className="mx-4 mt-3 sm:mx-5">
                  <Banner tone="error" role="alert">{editError}</Banner>
                </div>
              )}

              {/* Transaction rows are the least decorated surface in the app:
                  clarity over charm. Each row is a two-line block — the facts
                  on top, the controls underneath — so nothing has to be
                  squeezed onto one line on a phone. */}
              <ul className="space-y-2 overflow-y-auto p-4 sm:p-5">
                {transactions.length === 0 ? (
                  <li className="py-6 text-center text-sm text-ink-soft">No transactions found.</li>
                ) : (
                  transactions.map((t) => {
                    const date = parseDate(t)?.toLocaleDateString() || ''
                    const description = t.Description || ''
                    const category = t.Category || ''
                    const note = t.Note || ''
                    const amount = Math.abs(parseFloat(t.Amount) || 0)
                    const isEditingNote = noteEditId === t.id
                    return (
                      <li key={t.id} className="well-soft p-3.5">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium text-ink">{description}</p>
                            <p className="mt-0.5 text-xs tnum text-ink-faint">{date}</p>
                          </div>
                          <span className="flex-shrink-0 text-sm font-bold tnum text-ink">{moneyExact(amount)}</span>
                        </div>

                        <div className="mt-2.5 flex items-center gap-1.5">
                          <select
                            value={category}
                            onChange={e => updateTransaction(t, { Category: e.target.value })}
                            aria-label={`Category for ${description}`}
                            className={selectClass('min-h-9 max-w-[9.5rem] flex-shrink py-1.5 text-sm')}
                          >
                            {/* Keep an unlabeled option when the transaction has no category yet */}
                            {!category && <option value="">—</option>}
                            {categoryOptions.map(c => <option key={c} value={c}>{c}</option>)}
                          </select>

                          <div className="ml-auto flex flex-shrink-0 items-center gap-0.5">
                            <IconButton
                              label={note ? `Edit note for ${description}` : `Add note to ${description}`}
                              tone="sage"
                              className={note ? 'text-sage-600' : ''}
                              onClick={() => {
                                if (isEditingNote) { setNoteEditId(null); return }
                                setNoteDraft(note)
                                setNoteEditId(t.id)
                              }}
                            >
                              <StickyNote className="h-4 w-4" />
                            </IconButton>
                            {targetMatchedIds.has(t.id) && (
                              <TargetItemsToggle
                                description={description}
                                isOpen={expandedTargetId === t.id}
                                onClick={() => toggleTargetItems(t.id)}
                              />
                            )}
                            <IconButton
                              label={`Delete ${description}`}
                              tone="danger"
                              onClick={() => setConfirmingTxnDeleteId(t.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </IconButton>
                          </div>
                        </div>

                        {/* Two-step delete confirm, e.g. for a duplicate transaction
                            from an overlapping statement */}
                        {confirmingTxnDeleteId === t.id && (
                          <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-2.5">
                            <span className="text-sm text-ink-soft">Delete this transaction?</span>
                            <div className="flex flex-shrink-0 items-center gap-2">
                              <Button size="sm" variant="danger" onClick={() => deleteTransaction(t)}>Delete</Button>
                              <Button size="sm" variant="ghost" onClick={() => setConfirmingTxnDeleteId(null)}>Cancel</Button>
                            </div>
                          </div>
                        )}

                        {/* Saved note (when not editing) */}
                        {note && !isEditingNote && (
                          <p className="mt-2.5 flex items-start gap-1.5 text-sm italic text-ink-soft">
                            <StickyNote className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-sage-500" aria-hidden="true" />
                            {note}
                          </p>
                        )}

                        {/* Inline note editor */}
                        {isEditingNote && (
                          <div className="mt-2.5 flex items-center gap-1.5">
                            <input
                              autoFocus
                              value={noteDraft}
                              maxLength={500}
                              onChange={e => setNoteDraft(e.target.value)}
                              onKeyDown={e => {
                                if (e.key === 'Enter') saveNote(t)
                                if (e.key === 'Escape') {
                                  // Don't let Escape bubble to the dialog handler and close the whole modal
                                  e.stopPropagation()
                                  setNoteEditId(null)
                                }
                              }}
                              placeholder="e.g. split with roommate, reimbursed by work"
                              aria-label={`Note for ${description}`}
                              className={inputClass('min-h-9 flex-1 py-1.5 text-sm')}
                            />
                            <IconButton label="Save note" tone="sage" onClick={() => saveNote(t)}>
                              <Check className="h-4 w-4" />
                            </IconButton>
                            <IconButton label="Cancel note edit" onClick={() => setNoteEditId(null)}>
                              <X className="h-4 w-4" />
                            </IconButton>
                          </div>
                        )}

                        {/* Matched Target purchase items — thumbnails from Target's own
                            public CDN (target.scene7.com), nothing hosted by us. */}
                        {expandedTargetId === t.id && (
                          <div className="mt-3 border-t border-line pt-3">
                            <TargetItemsList items={targetItemsById[t.id]} isLoading={targetItemsLoadingId === t.id} />
                          </div>
                        )}
                      </li>
                    )
                  })
                )}
              </ul>
          </Modal>
        )
      })()}
      </div>
    </div>
  )
}
