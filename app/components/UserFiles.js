'use client'
import { useState, useEffect } from 'react'
import { Trash2, FileText, Calendar, Pencil, Check, X } from 'lucide-react'
import { calcSpending } from '@/lib/categories'
import { parseDate } from '@/lib/date'

export default function UserFiles({ userId }) {
  const [files, setFiles] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [deleteError, setDeleteError] = useState(null)

  // editingId: which file's title is currently being edited (null = none)
  // editingName: the live value of the input while editing
  const [editingId, setEditingId] = useState(null)
  const [editingName, setEditingName] = useState('')

  // reviewFile: the file whose transactions are shown in the read-only modal (null = closed)
  const [reviewFile, setReviewFile] = useState(null)

  useEffect(() => {
    fetchFiles()
  }, [])

  const fetchFiles = async () => {
    try {
      const response = await fetch('/api/files')
      const data = await response.json()
      setFiles(data.files || [])
    } catch (error) {
      console.error('Error fetching files:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const deleteFile = async (fileId) => {
    if (!confirm('Are you sure you want to delete this file?')) return
    setDeleteError(null)
    try {
      const response = await fetch(`/api/files/${fileId}`, { method: 'DELETE' })
      if (!response.ok) throw new Error('Delete failed')
      setFiles(files.filter(f => f.id !== fileId))
    } catch (error) {
      console.error('Error deleting file:', error)
      setDeleteError('Failed to delete file. Please try again.')
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

  const saveTitle = async (fileId) => {
    const trimmed = editingName.trim()
    if (!trimmed) return cancelEditing()

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
    }
  }

  if (isLoading) {
    return (
      <div className="flex justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sage-500"></div>
      </div>
    )
  }

  if (files.length === 0) {
    return (
      <div className="bg-surface border border-line rounded-2xl shadow-sm text-center p-12">
        <FileText className="mx-auto h-12 w-12 text-sage-300 mb-4" />
        <h3 className="text-base font-semibold text-ink mb-1">No files uploaded yet</h3>
        <p className="text-sm text-ink-soft">Upload a CSV or PDF statement to get started.</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <h2 className="text-lg font-semibold text-ink mb-4">Your Uploaded Files</h2>

      {deleteError && (
        <div className="bg-peach-50 border border-peach-200 p-3 rounded-lg">
          <p className="text-peach-600 text-sm">{deleteError}</p>
        </div>
      )}

      {files.map((file) => {
        // Recalculate spending using the same logic as the dashboard:
        // excludes Income and Bills & Payments so the number matches.
        const spending = calcSpending(file.transactions || [])
        const isEditing = editingId === file.id

        return (
          <div key={file.id} className="bg-surface rounded-xl border border-line shadow-sm p-5 hover:border-sage-300 transition-colors">
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
                    <button onClick={() => saveTitle(file.id)} className="text-sage-600 hover:text-sage-800 flex-shrink-0">
                      <Check className="h-4 w-4" />
                    </button>
                    <button onClick={cancelEditing} className="text-ink-faint hover:text-ink flex-shrink-0">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  // group + group-hover makes the pencil icon only visible on hover
                  <div className="flex items-center gap-2 mb-3 group">
                    <h3 className="text-base font-semibold text-ink truncate">{file.name}</h3>
                    <button
                      onClick={() => startEditing(file)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity text-ink-faint hover:text-ink-soft flex-shrink-0"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
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
                    ${spending.toFixed(2)} spending
                  </span>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  onClick={() => setReviewFile(file)}
                  className="px-3 py-1.5 bg-sage-600 text-white text-sm rounded-lg hover:bg-sage-700 transition-colors"
                >
                  Review
                </button>
                <button
                  onClick={() => deleteFile(file.id)}
                  className="p-1.5 text-ink-faint hover:text-peach-600 hover:bg-peach-50 rounded-lg transition-colors"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        )
      })}

      {/* Read-only review modal — lists the transactions in the selected file */}
      {reviewFile && (() => {
        const transactions = (reviewFile.transactions || [])
          .slice()
          .sort((a, b) => (parseDate(b)?.getTime() || 0) - (parseDate(a)?.getTime() || 0))

        return (
          <div
            className="fixed inset-0 bg-ink/40 z-50 flex items-center justify-center p-4"
            onClick={() => setReviewFile(null)}
          >
            <div
              className="bg-surface rounded-2xl shadow-sm border border-line w-full max-w-lg flex flex-col"
              style={{ maxHeight: '80vh' }}
              onClick={e => e.stopPropagation()}
            >
              <div className="flex justify-between items-start p-6 border-b border-line">
                <div className="min-w-0 mr-4">
                  <h3 className="text-xl font-semibold text-ink truncate">{reviewFile.name}</h3>
                  <p className="text-sm text-ink-soft mt-1">
                    {transactions.length} transaction{transactions.length !== 1 ? 's' : ''}
                  </p>
                </div>
                <button onClick={() => setReviewFile(null)} className="text-ink-faint hover:text-ink flex-shrink-0">
                  <X className="h-6 w-6" />
                </button>
              </div>

              <div className="overflow-y-auto p-4 space-y-2">
                {transactions.length === 0 ? (
                  <p className="text-ink-soft text-sm text-center py-4">No transactions found.</p>
                ) : (
                  transactions.map((t, i) => {
                    const date = t['Trans. Date'] || t['Date'] || t['Transaction Date'] || ''
                    const description = t['Description'] || ''
                    const category = t['Category'] || ''
                    const amount = Math.abs(parseFloat(t.Amount) || 0)
                    return (
                      <div key={i} className="flex justify-between items-start p-3 bg-surface-2 rounded-lg">
                        <div className="flex-1 min-w-0 mr-4">
                          <p className="text-sm font-medium text-ink truncate">{description}</p>
                          <p className="text-xs text-ink-faint mt-0.5">
                            {date}{category ? ` · ${category}` : ''}
                          </p>
                        </div>
                        <span className="text-sm font-semibold text-ink flex-shrink-0">${amount.toFixed(2)}</span>
                      </div>
                    )
                  })
                )}
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}
