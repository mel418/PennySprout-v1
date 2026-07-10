'use client'
import { useState } from 'react'
import { Upload, FileText, CheckCircle2 } from 'lucide-react'
import { parseTransactionsCsv } from '@/lib/csv'

// userId: the logged-in user's Clerk ID (passed down from page.js)
// onDataLoaded: callback that refreshes the file list rendered below the
// dropzone (upload and file management share the Files tab)
export default function FileUpload({ onDataLoaded }) {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [isDragging, setIsDragging] = useState(false)

  // fileStatuses tracks the processing state of EACH file individually.
  // Each entry: { name, status: 'pending' | 'processing' | 'done' | 'error', count?, message? }
  const [fileStatuses, setFileStatuses] = useState([])

  // savedCount > 0 after a batch finishes = show the success summary. The
  // per-file status list stays visible (including any failures); the file
  // list below refreshes in place via onDataLoaded — no navigation.
  const [savedCount, setSavedCount] = useState(0)

  const processFiles = async (fileList) => {
    const files = Array.from(fileList)
    if (files.length === 0) return

    setIsLoading(true)
    setError('')
    setSavedCount(0)

    // Set every file to 'pending' immediately so the UI shows all of them right away
    setFileStatuses(files.map(f => ({ name: f.name, status: 'pending' })))

    let saved = 0

    // Process files one at a time (not in parallel) so the status updates
    // appear in order and we don't overwhelm the API with simultaneous requests.
    // Each file is saved as its own record, so My Files reflects exactly what
    // was uploaded.
    for (let i = 0; i < files.length; i++) {
      const file = files[i]

      // Updater-function form of setState so loop iterations never see stale state.
      setFileStatuses(prev =>
        prev.map((f, index) => index === i ? { ...f, status: 'processing' } : f)
      )

      try {
        let transactions = []
        const lower = file.name.toLowerCase()

        if (lower.endsWith('.csv')) {
          // CSV files are plain text — parsed entirely in the browser.
          // Parsing lives in lib/csv.js (quoted-field handling + PII column
          // allowlist) so it's shared with the test suite.
          const text = await file.text()
          const parsed = parseTransactionsCsv(text)
          transactions = parsed.data

        } else if (lower.endsWith('.pdf')) {
          // PDFs are binary — sent to /api/parse-pdf, which forwards to Claude.
          // Note: don't set Content-Type manually; the browser sets the correct
          // multipart boundary when the body is FormData.
          const formData = new FormData()
          formData.append('file', file)
          const response = await fetch('/api/parse-pdf', { method: 'POST', body: formData })
          if (!response.ok) throw new Error("Couldn't read this PDF")
          const result = await response.json()
          if (result.error) throw new Error(result.error)
          transactions = result.transactions

        } else {
          throw new Error('Unsupported file type — upload a .csv or .pdf')
        }

        if (transactions.length === 0) {
          throw new Error('No transactions found in this file')
        }

        const totalAmount = transactions.reduce(
          (sum, t) => sum + Math.abs(parseFloat(t.Amount) || 0),
          0
        )

        const saveResponse = await fetch('/api/files', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: file.name,
            transactions,
            totalAmount,
            transactionCount: transactions.length
          })
        })
        if (!saveResponse.ok) throw new Error("Parsed, but couldn't save — try again")
        saved++

        setFileStatuses(prev =>
          prev.map((f, index) => index === i
            ? { ...f, status: 'done', count: transactions.length }
            : f
          )
        )
      } catch (err) {
        // If one file fails, record why and keep going to the next file
        setFileStatuses(prev =>
          prev.map((f, index) => index === i
            ? { ...f, status: 'error', message: err.message || 'Failed to parse' }
            : f
          )
        )
      }
    }

    setIsLoading(false)
    setSavedCount(saved)
    if (saved === 0) {
      setError('No transactions could be extracted from the uploaded files.')
    } else {
      onDataLoaded?.() // refresh the file list below the dropzone
    }
  }

  const handleFileUpload = (event) => {
    processFiles(event.target.files)
    // Reset so selecting the same file again re-triggers onChange
    event.target.value = ''
  }

  const handleDrop = (event) => {
    event.preventDefault()
    setIsDragging(false)
    if (isLoading) return
    processFiles(event.dataTransfer.files)
  }

  return (
    <div className="space-y-4">
      <div
        onDragOver={e => { e.preventDefault(); if (!isLoading) setIsDragging(true) }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        className={`bg-surface border-2 border-dashed rounded-2xl p-8 sm:p-12 text-center transition-all
          ${isDragging ? 'border-sage-500 bg-sage-50' : 'border-sage-200 hover:border-sage-400 hover:bg-surface-hover'}`}
      >
        <div className="w-14 h-14 bg-sage-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <Upload className="h-6 w-6 text-sage-600" aria-hidden="true" />
        </div>
        <h3 className="text-base font-semibold text-ink mb-1">Upload Bank Statements</h3>
        <p className="text-sm text-ink-soft mb-6 max-w-xs mx-auto">
          Drag & drop files here, or choose them below — CSV (credit cards) and PDF (bank statements)
        </p>

        <label className={`inline-flex items-center gap-2 px-5 py-3 rounded-xl font-medium text-sm cursor-pointer transition-colors ${isLoading ? 'bg-surface-2 text-ink-faint cursor-not-allowed' : 'bg-sage-600 hover:bg-sage-700 active:bg-sage-800 text-white'}`}>
          <Upload className="h-4 w-4" aria-hidden="true" />
          Choose Files
          <input
            type="file"
            accept=".csv,.pdf"
            multiple
            onChange={handleFileUpload}
            disabled={isLoading}
            className="sr-only"
          />
        </label>
        <p className="text-xs text-ink-faint mt-3">CSV or PDF · Multiple files supported</p>
      </div>

      {/* Per-file status list — only appears once files are selected */}
      {fileStatuses.length > 0 && (
        <div className="space-y-2" aria-live="polite">
          {fileStatuses.map((f, i) => (
            <div key={i} className="flex items-center justify-between p-3 bg-surface border border-line rounded-lg text-sm">
              <div className="flex items-center gap-2 min-w-0">
                <FileText className="h-4 w-4 text-ink-faint flex-shrink-0" aria-hidden="true" />
                <span className="text-ink-soft truncate">{f.name}</span>
              </div>
              <div className="ml-4 flex-shrink-0 text-right">
                {f.status === 'pending' && (
                  <span className="text-ink-faint">Waiting…</span>
                )}
                {f.status === 'processing' && (
                  <span className="text-sage-600 flex items-center gap-1">
                    <span className="animate-spin inline-block w-3 h-3 border border-sage-500 border-t-transparent rounded-full" />
                    Processing…
                  </span>
                )}
                {f.status === 'done' && (
                  <span className="text-sage-600 font-medium">✓ {f.count} transactions</span>
                )}
                {f.status === 'error' && (
                  <span className="text-danger-600">{f.message || 'Failed to parse'}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Batch finished with at least one save */}
      {!isLoading && savedCount > 0 && (
        <div role="status" className="bg-sage-50 border border-sage-200 rounded-2xl p-5 flex items-center gap-2.5">
          <CheckCircle2 className="h-5 w-5 text-sage-600 flex-shrink-0" aria-hidden="true" />
          <p className="text-sm text-sage-700 font-medium">
            {savedCount} file{savedCount !== 1 ? 's' : ''} uploaded — your list below is up to date.
          </p>
        </div>
      )}

      {error && (
        <div role="alert" className="bg-danger-50 border border-danger-200 p-4 rounded-lg">
          <p className="text-danger-600 text-sm">{error}</p>
        </div>
      )}
    </div>
  )
}
