'use client'
import { useState } from 'react'
import { Upload, FileText } from 'lucide-react'
import { parseTransactionsCsv } from '@/lib/csv'

// userId: the logged-in user's Clerk ID (passed down from page.js)
// onDataLoaded: callback that tells page.js to switch to the dashboard view
export default function FileUpload({ onDataLoaded }) {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  // fileStatuses tracks the processing state of EACH file individually.
  // Each entry looks like: { name: 'statement.pdf', status: 'processing' | 'done' | 'error', count: 42 }
  // This lets us show per-file progress in the UI while the loop runs.
  const [fileStatuses, setFileStatuses] = useState([])

  const handleFileUpload = async (event) => {
    // event.target.files is a FileList (not a real array) — Array.from converts it
    // so we can use .map, .filter, etc.
    const files = Array.from(event.target.files)
    if (files.length === 0) return

    setIsLoading(true)
    setError('')

    // Set every file to 'pending' immediately so the UI shows all of them right away
    setFileStatuses(files.map(f => ({ name: f.name, status: 'pending' })))

    // Track how many files actually saved, so we know whether to navigate away.
    let savedCount = 0

    // Process files one at a time (not in parallel) so the status updates
    // appear in order and we don't overwhelm the API with simultaneous requests.
    // Each file is saved as its OWN record — no more combining — so the My Files
    // list reflects exactly what was uploaded.
    for (let i = 0; i < files.length; i++) {
      const file = files[i]

      // Mark this specific file as 'processing' while keeping all other files unchanged.
      // prev => [...] is the "updater function" form of setState — React guarantees
      // it receives the most recent state, avoiding stale-state bugs in loops.
      setFileStatuses(prev =>
        prev.map((f, index) => index === i ? { ...f, status: 'processing' } : f)
      )

      try {
        let transactions = []

        if (file.name.toLowerCase().endsWith('.csv')) {
          // CSV files are plain text — we can read and parse them entirely in the
          // browser. Parsing lives in lib/csv.js (proper quoted-field handling +
          // the PII column allowlist) so it's shared with the test suite.
          const text = await file.text()  // reads the file as a UTF-8 string
          const parsed = parseTransactionsCsv(text)
          transactions = parsed.data

        } else if (file.name.toLowerCase().endsWith('.pdf')) {
          // PDFs are binary — we can't parse them in the browser.
          // We send the raw file to /api/parse-pdf, which forwards it to Claude.

          // FormData is how browsers send file uploads — it's a key/value container
          // where values can be files (binary), not just text like JSON
          const formData = new FormData()
          formData.append('file', file)  // 'file' matches what formData.get('file') reads on the server

          const response = await fetch('/api/parse-pdf', {
            method: 'POST',
            body: formData
            // Important: do NOT set Content-Type here. When body is FormData,
            // the browser sets it automatically to 'multipart/form-data' with
            // the correct boundary string. Setting it manually breaks the upload.
          })

          if (!response.ok) throw new Error('PDF parsing failed')
          const result = await response.json()
          if (result.error) throw new Error(result.error)
          transactions = result.transactions
        }

        if (transactions.length === 0) {
          throw new Error('No transactions found')
        }

        // Sum up this file's transaction amounts (absolute value) for its total.
        // Math.abs() converts negative withdrawals to positive before summing.
        const totalAmount = transactions.reduce(
          (sum, t) => sum + Math.abs(parseFloat(t.Amount) || 0),
          0
        )

        // Save THIS file as its own record via the existing /api/files endpoint.
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
        if (!saveResponse.ok) throw new Error('Save failed')
        savedCount++

        // Mark this file done, showing how many transactions were found
        setFileStatuses(prev =>
          prev.map((f, index) => index === i
            ? { ...f, status: 'done', count: transactions.length }
            : f
          )
        )
      } catch (err) {
        // If one file fails, mark it as errored and keep going to the next file
        setFileStatuses(prev =>
          prev.map((f, index) => index === i ? { ...f, status: 'error' } : f)
        )
      }
    }

    setIsLoading(false)

    if (savedCount === 0) {
      setError('No transactions could be extracted from the uploaded files.')
      return
    }

    // Hand control back to page.js, which sends the user to My Files so they can
    // see exactly what landed (analysis now lives on its own month-based tab).
    onDataLoaded()
  }

  return (
    <div className="space-y-4">
      <div className="bg-surface border-2 border-dashed border-sage-200 rounded-2xl p-8 sm:p-12 text-center hover:border-sage-400 hover:bg-surface-hover transition-all">
        <div className="w-14 h-14 bg-sage-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <Upload className="h-6 w-6 text-sage-600" />
        </div>
        <h3 className="text-base font-semibold text-ink mb-1">Upload Bank Statements</h3>
        <p className="text-sm text-ink-soft mb-6 max-w-xs mx-auto">
          Accepts CSV (credit cards) and PDF (bank statements) — select multiple files at once
        </p>

        <label className={`inline-flex items-center gap-2 px-5 py-3 rounded-xl font-medium text-sm cursor-pointer transition-colors ${isLoading ? 'bg-surface-2 text-ink-faint cursor-not-allowed' : 'bg-sage-600 hover:bg-sage-700 active:bg-sage-800 text-white'}`}>
          <Upload className="h-4 w-4" />
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
        <div className="space-y-2">
          {fileStatuses.map((f, i) => (
            <div key={i} className="flex items-center justify-between p-3 bg-surface border border-line rounded-lg text-sm">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-ink-faint flex-shrink-0" />
                <span className="text-ink-soft truncate">{f.name}</span>
              </div>
              <div className="ml-4 flex-shrink-0">
                {f.status === 'pending' && (
                  <span className="text-ink-faint">Waiting...</span>
                )}
                {f.status === 'processing' && (
                  <span className="text-sage-600 flex items-center gap-1">
                    <span className="animate-spin inline-block w-3 h-3 border border-sage-500 border-t-transparent rounded-full" />
                    Processing...
                  </span>
                )}
                {f.status === 'done' && (
                  <span className="text-sage-600 font-medium">✓ {f.count} transactions</span>
                )}
                {f.status === 'error' && (
                  <span className="text-peach-600">Failed to parse</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {error && (
        <div className="bg-peach-50 border border-peach-200 p-4 rounded-lg">
          <p className="text-peach-600 text-sm">{error}</p>
        </div>
      )}
    </div>
  )
}
