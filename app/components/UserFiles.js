'use client'
import { useState, useEffect, useMemo, useCallback } from 'react'
import { Trash2, FileText, Calendar, Pencil, Check, X, StickyNote, RotateCcw } from 'lucide-react'
import { calcSpending, STANDARD_CATEGORIES } from '@/lib/categories'
import { parseDate, monthKey, monthKeyLabel } from '@/lib/date'
import { moneyExact } from '@/lib/format'
import { useTransactions } from './useTransactions'
import LoadError from './LoadError'
import { ListSkeleton } from './ui/Skeletons'
import EmptyState from './ui/EmptyState'
import Modal from './ui/Modal'

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

  // 'month' groups by statement period (derived from transaction dates);
  // 'account' groups by the account name assigned at upload.
  const [groupBy, setGroupBy] = useState('month')

  const {
    transactions: allTransactions,
    isLoading: isLoadingTxns,
    error: txnError,
    retry,
    patchLocal,
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

  // Stable close handler — Modal's useDialog takes it as an effect dependency.
  const closeReview = useCallback(() => { setReviewFile(null); setNoteEditId(null) }, [])

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

  if (isLoadingFiles || isLoadingTxns) return <ListSkeleton />

  if (txnError) return <LoadError error={txnError} onRetry={retry} />
  if (metaError) return <LoadError error={metaError} onRetry={fetchFiles} />

  if (files.length === 0) {
    return (
      <EmptyState
        icon={FileText}
        title="No files uploaded yet"
        description="Upload a CSV or PDF statement to get started."
      />
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <h2 className="text-lg font-semibold text-ink">Your Uploaded Files</h2>

        {/* Group-by toggle */}
        <div className="inline-flex items-center bg-surface-2 rounded-lg p-0.5 text-xs">
          {[['month', 'By month'], ['account', 'By account']].map(([value, label]) => (
            <button
              key={value}
              onClick={() => setGroupBy(value)}
              className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                groupBy === value ? 'bg-surface text-ink shadow-sm' : 'text-ink-faint hover:text-ink-soft'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {actionError && (
        <div role="alert" className="bg-danger-50 border border-danger-200 p-3 rounded-lg">
          <p className="text-danger-600 text-sm">{actionError}</p>
        </div>
      )}

      {groupedFiles.map(group => (
        <div key={group.key} className="space-y-3">
          <h3 className="text-xs font-semibold text-ink-faint uppercase tracking-wide pt-2 first:pt-0">
            {group.label}
          </h3>

          {group.files.map((file) => {
            // Recalculate spending using the same logic as the dashboard:
            // excludes Income and Bills & Payments so the number matches.
            const spending = calcSpending(byFile[file.id] || [])
            const isEditing = editingId === file.id

            return (
              <div key={file.id} className="bg-surface rounded-2xl border border-line shadow-sm p-5 hover:border-sage-300 transition-colors">
                <div className="flex justify-between items-start gap-4">
                  <div className="flex-1 min-w-0">

                    {/* Title row — shows input when editing, plain text otherwise */}
                    {isEditing ? (
                      <div className="flex items-center gap-2 mb-3">
                        <input
                          autoFocus
                          value={editingName}
                          onChange={e => setEditingName(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') saveTitle(file.id)
                            if (e.key === 'Escape') cancelEditing()
                          }}
                          className="text-base font-semibold border-b-2 border-sage-500 outline-none flex-1 bg-transparent text-ink"
                        />
                        {/* Check saves, X cancels */}
                        <button onClick={() => saveTitle(file.id)} aria-label="Save name" className="text-sage-600 hover:text-sage-800 flex-shrink-0">
                          <Check className="h-4 w-4" aria-hidden="true" />
                        </button>
                        <button onClick={cancelEditing} aria-label="Cancel rename" className="text-ink-faint hover:text-ink flex-shrink-0">
                          <X className="h-4 w-4" aria-hidden="true" />
                        </button>
                      </div>
                    ) : (
                      // group + group-hover makes the pencil icon only visible on hover
                      <div className="flex items-center gap-2 mb-3 group">
                        <h3 className="text-base font-semibold text-ink truncate">{file.name}</h3>
                        <button
                          onClick={() => startEditing(file)}
                          aria-label={`Rename ${file.name}`}
                          className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity text-ink-faint hover:text-ink-soft flex-shrink-0"
                        >
                          <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                        </button>
                        {file.originalName && file.name !== file.originalName && (
                          <button
                            onClick={() => revertName(file)}
                            aria-label={`Revert to original name: ${file.originalName}`}
                            title={`Revert to "${file.originalName}"`}
                            className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity text-ink-faint hover:text-ink-soft flex-shrink-0"
                          >
                            <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                          </button>
                        )}
                        {file.accountName && (
                          <span className="px-2 py-0.5 rounded-full bg-sage-50 text-sage-700 text-[11px] font-medium flex-shrink-0">
                            {file.accountName}
                          </span>
                        )}
                      </div>
                    )}

                    {/* Metadata row */}
                    <div className="flex flex-wrap gap-4 text-xs text-ink-faint mb-3">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3.5 w-3.5" />
                        {new Date(file.uploadDate).toLocaleDateString()}
                      </span>
                      <span className="flex items-center gap-1">
                        <FileText className="h-3.5 w-3.5" />
                        {file.transactionCount} transactions
                      </span>
                      <span className="flex items-center gap-1 font-medium text-ink-soft">
                        {moneyExact(spending)} spending
                      </span>
                    </div>
                  </div>

                  {/* Action buttons — delete is two-step: arm, then confirm inline */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {confirmingDeleteId === file.id ? (
                      <>
                        <span className="text-xs text-ink-soft">Delete this file?</span>
                        <button
                          onClick={() => deleteFile(file.id)}
                          className="px-3 py-1.5 bg-danger-600 text-white text-sm rounded-lg hover:opacity-90 transition-opacity"
                        >
                          Delete
                        </button>
                        <button
                          onClick={() => setConfirmingDeleteId(null)}
                          className="px-3 py-1.5 text-sm rounded-lg text-ink-soft hover:bg-surface-hover transition-colors"
                        >
                          Cancel
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => setReviewFile(file)}
                          className="px-3 py-1.5 bg-sage-600 text-white text-sm rounded-lg hover:bg-sage-700 transition-colors"
                        >
                          Review
                        </button>
                        <button
                          onClick={() => setConfirmingDeleteId(file.id)}
                          aria-label={`Delete ${file.name}`}
                          className="p-1.5 text-ink-faint hover:text-danger-600 hover:bg-danger-50 rounded-lg transition-colors"
                        >
                          <Trash2 className="h-4 w-4" aria-hidden="true" />
                        </button>
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
                <div role="alert" className="mx-4 mt-3 bg-danger-50 border border-danger-200 p-3 rounded-lg">
                  <p className="text-danger-600 text-sm">{editError}</p>
                </div>
              )}

              <div className="overflow-y-auto p-4 space-y-2">
                {transactions.length === 0 ? (
                  <p className="text-ink-soft text-sm text-center py-4">No transactions found.</p>
                ) : (
                  transactions.map((t) => {
                    const date = parseDate(t)?.toLocaleDateString() || ''
                    const description = t.Description || ''
                    const category = t.Category || ''
                    const note = t.Note || ''
                    const amount = Math.abs(parseFloat(t.Amount) || 0)
                    const isEditingNote = noteEditId === t.id
                    return (
                      <div key={t.id} className="p-3 bg-surface-2 rounded-lg">
                        <div className="flex justify-between items-center gap-3">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-ink truncate">{description}</p>
                            <p className="text-xs text-ink-faint mt-0.5">{date}</p>
                          </div>
                          <button
                            onClick={() => {
                              if (isEditingNote) { setNoteEditId(null); return }
                              setNoteDraft(note)
                              setNoteEditId(t.id)
                            }}
                            aria-label={note ? `Edit note for ${description}` : `Add note to ${description}`}
                            title={note ? 'Edit note' : 'Add note'}
                            className={`p-1 flex-shrink-0 transition-colors ${note ? 'text-sage-600 hover:text-sage-700' : 'text-ink-faint hover:text-ink-soft'}`}
                          >
                            <StickyNote className="h-4 w-4" />
                          </button>
                          <select
                            value={category}
                            onChange={e => updateTransaction(t, { Category: e.target.value })}
                            aria-label={`Category for ${description}`}
                            className="text-xs text-ink-soft bg-surface border border-line rounded-lg px-2 py-1.5 max-w-[130px] cursor-pointer hover:border-sage-300 focus:border-sage-500 focus:outline-none"
                          >
                            {/* Keep an unlabeled option when the transaction has no category yet */}
                            {!category && <option value="">—</option>}
                            {categoryOptions.map(c => <option key={c} value={c}>{c}</option>)}
                          </select>
                          <span className="text-sm font-semibold text-ink flex-shrink-0">{moneyExact(amount)}</span>
                        </div>

                        {/* Saved note (when not editing) */}
                        {note && !isEditingNote && (
                          <p className="text-xs italic text-ink-soft mt-2 flex items-start gap-1.5">
                            <StickyNote className="h-3 w-3 mt-0.5 flex-shrink-0 text-sage-500" aria-hidden="true" />
                            {note}
                          </p>
                        )}

                        {/* Inline note editor */}
                        {isEditingNote && (
                          <div className="flex items-center gap-2 mt-2">
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
                              placeholder="Add a note — e.g. split with roommate, reimbursed by work"
                              aria-label={`Note for ${description}`}
                              className="flex-1 text-xs text-ink bg-surface border border-line rounded-lg px-2.5 py-1.5 focus:border-sage-500 focus:outline-none placeholder:text-ink-faint"
                            />
                            <button
                              onClick={() => saveNote(t)}
                              aria-label="Save note"
                              className="p-1 text-sage-600 hover:text-sage-800 flex-shrink-0"
                            >
                              <Check className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => setNoteEditId(null)}
                              aria-label="Cancel note edit"
                              className="p-1 text-ink-faint hover:text-ink flex-shrink-0"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                        )}
                      </div>
                    )
                  })
                )}
              </div>
          </Modal>
        )
      })()}
    </div>
  )
}
