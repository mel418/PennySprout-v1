'use client'
import { useState, useEffect } from 'react'
import { Trash2, FileText, Calendar, Pencil, Check, X } from 'lucide-react'
import { calcSpending } from '@/lib/categories'

export default function UserFiles({ userId, onFileSelected }) {
  const [files, setFiles] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [deleteError, setDeleteError] = useState(null)

  // editingId: which file's title is currently being edited (null = none)
  // editingName: the live value of the input while editing
  const [editingId, setEditingId] = useState(null)
  const [editingName, setEditingName] = useState('')

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

  const selectFile = (file) => {
    onFileSelected({
      headers: Object.keys(file.transactions[0] || {}),
      data: file.transactions,
      fileId: file.id,
      analysis: file.analysis
    })
  }

  if (isLoading) {
    return (
      <div className="flex justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-400"></div>
      </div>
    )
  }

  if (files.length === 0) {
    return (
      <div className="text-center p-12">
        <FileText className="mx-auto h-12 w-12 text-gray-300 mb-4" />
        <h3 className="text-base font-medium text-gray-900 mb-1">No files uploaded yet</h3>
        <p className="text-sm text-gray-500">Upload a CSV or PDF statement to get started.</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Your Uploaded Files</h2>

      {deleteError && (
        <div className="bg-red-50 border border-red-100 p-3 rounded-lg">
          <p className="text-red-700 text-sm">{deleteError}</p>
        </div>
      )}

      {files.map((file) => {
        // Recalculate spending using the same logic as the dashboard:
        // excludes Income and Bills & Payments so the number matches.
        const spending = calcSpending(file.transactions || [])
        const isEditing = editingId === file.id

        return (
          <div key={file.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
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
                      className="text-base font-semibold border-b-2 border-indigo-400 outline-none flex-1 bg-transparent text-gray-900"
                    />
                    {/* Check saves, X cancels */}
                    <button onClick={() => saveTitle(file.id)} className="text-green-500 hover:text-green-700 flex-shrink-0">
                      <Check className="h-4 w-4" />
                    </button>
                    <button onClick={cancelEditing} className="text-gray-400 hover:text-gray-600 flex-shrink-0">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  // group + group-hover makes the pencil icon only visible on hover
                  <div className="flex items-center gap-2 mb-3 group">
                    <h3 className="text-base font-semibold text-gray-900 truncate">{file.name}</h3>
                    <button
                      onClick={() => startEditing(file)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-300 hover:text-gray-500 flex-shrink-0"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}

                {/* Metadata row */}
                <div className="flex flex-wrap gap-4 text-xs text-gray-400 mb-3">
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3.5 w-3.5" />
                    {new Date(file.uploadDate).toLocaleDateString()}
                  </span>
                  <span className="flex items-center gap-1">
                    <FileText className="h-3.5 w-3.5" />
                    {file.transactionCount} transactions
                  </span>
                  <span className="flex items-center gap-1 font-medium text-gray-600">
                    ${spending.toFixed(2)} spending
                  </span>
                </div>

                {file.analysis && (
                  <div className="bg-emerald-50 border border-emerald-100 px-3 py-2 rounded-lg">
                    <p className="text-xs text-emerald-700">
                      Analysis complete · Health Score: {file.analysis.healthScore}/10
                    </p>
                  </div>
                )}
              </div>

              {/* Action buttons */}
              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  onClick={() => selectFile(file)}
                  className="px-3 py-1.5 bg-indigo-500 text-white text-sm rounded-lg hover:bg-indigo-600 transition-colors"
                >
                  Analyze
                </button>
                <button
                  onClick={() => deleteFile(file.id)}
                  className="p-1.5 text-gray-300 hover:text-red-400 hover:bg-red-50 rounded-lg transition-colors"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
