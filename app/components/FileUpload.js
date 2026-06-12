'use client'
import { useState } from 'react'
import { Upload, FileText } from 'lucide-react'

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

    // allTransactions will hold every transaction from every file combined
    const allTransactions = []

    // Process files one at a time (not in parallel) so the status updates
    // appear in order and we don't overwhelm the API with simultaneous requests
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
          // CSV files are plain text — we can read and parse them entirely in the browser
          const text = await file.text()  // reads the file as a UTF-8 string
          const parsed = parseCSV(text)
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

        // Spread operator (...) pushes all items from this file's array
        // into the combined array, instead of creating a nested array-of-arrays
        allTransactions.push(...transactions)

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

    if (allTransactions.length === 0) {
      setError('No transactions could be extracted from the uploaded files.')
      setIsLoading(false)
      return
    }

    // Build a descriptive name for what gets saved.
    // Single file → use its filename. Multiple files → describe the combination.
    const combinedName = files.length === 1
      ? files[0].name
      : `Combined Statement (${files.length} files)`

    // Sum up all transaction amounts (absolute value) for the total spending figure.
    // Math.abs() converts negative withdrawals to positive before summing.
    const totalAmount = allTransactions.reduce(
      (sum, t) => sum + Math.abs(parseFloat(t.Amount) || 0),
      0
    )

    try {
      // Save the combined transaction set to Supabase via the existing /api/files endpoint
      const response = await fetch('/api/files', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: combinedName,
          transactions: allTransactions,
          totalAmount,
          transactionCount: allTransactions.length
        })
      })
      const result = await response.json()

      // Extract column names from the first transaction's keys so the dashboard
      // knows what fields exist: e.g. ['Trans. Date', 'Description', 'Amount', 'Category']
      const headers = allTransactions.length > 0 ? Object.keys(allTransactions[0]) : []

      // Tell page.js we're done — this triggers the switch to the dashboard view
      onDataLoaded({
        headers,
        data: allTransactions,
        fileId: result.file?.id  // ?. (optional chaining) safely handles if saving failed
      })
    } catch (err) {
      setError('Transactions parsed but failed to save. Please try again.')
    }

    setIsLoading(false)
  }

  // Columns we keep from CSVs — anything not matching is silently dropped.
  // This acts as a privacy filter: account numbers, holder names, addresses,
  // routing numbers, and any other PII columns never get stored.
  const ALLOWED_HEADERS = [
    /^trans\.?\s*date$/i,
    /^post\.?\s*date$/i,
    /^transaction\s*date$/i,
    /^date$/i,
    /^posting\s*date$/i,
    /^description$/i,
    /^desc$/i,
    /^memo$/i,
    /^payee$/i,
    /^merchant$/i,
    /^narrative$/i,
    /^details$/i,
    /^amount$/i,
    /^debit$/i,
    /^credit$/i,
    /^transaction\s*amount$/i,
    /^category$/i,
    /^type$/i,
    /^transaction\s*type$/i,
  ]

  const isAllowedHeader = (h) => ALLOWED_HEADERS.some(pattern => pattern.test(h.trim()))

  // parseCSV converts raw CSV text into an array of objects,
  // keeping only transaction-relevant columns.
  const parseCSV = (text) => {
    const lines = text.split('\n').filter(line => line.trim())

    const allHeaders = lines[0].split(',').map(h => h.replace(/"/g, '').trim())

    // Only keep indices whose header is in our allowlist
    const allowedIndices = allHeaders
      .map((h, i) => ({ h, i }))
      .filter(({ h }) => isAllowedHeader(h))

    const headers = allowedIndices.map(({ h }) => h)

    const data = lines.slice(1).map(line => {
      const values = line.split(',')
      return allowedIndices.reduce((obj, { h, i }) => {
        obj[h] = (values[i] || '').replace(/"/g, '').trim()
        return obj
      }, {})
    }).filter(row => Object.values(row).some(v => v))

    return { headers, data }
  }

  return (
    <div className="space-y-4">
      <div className="border-2 border-dashed border-sage-200 rounded-2xl p-8 sm:p-12 text-center hover:border-sage-400 hover:bg-sage-50 transition-all">
        <div className="w-14 h-14 bg-sage-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <Upload className="h-6 w-6 text-sage-600" />
        </div>
        <h3 className="text-base font-semibold text-gray-900 mb-1">Upload Bank Statements</h3>
        <p className="text-sm text-gray-500 mb-6 max-w-xs mx-auto">
          Accepts CSV (credit cards) and PDF (bank statements) — select multiple files at once
        </p>

        <label className={`inline-flex items-center gap-2 px-5 py-3 rounded-xl font-medium text-sm cursor-pointer transition-colors ${isLoading ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-sage-600 hover:bg-sage-700 active:bg-sage-800 text-white'}`}>
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
        <p className="text-xs text-gray-400 mt-3">CSV or PDF · Multiple files supported</p>
      </div>

      {/* Per-file status list — only appears once files are selected */}
      {fileStatuses.length > 0 && (
        <div className="space-y-2">
          {fileStatuses.map((f, i) => (
            <div key={i} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg text-sm">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-gray-400 flex-shrink-0" />
                <span className="text-gray-700 truncate">{f.name}</span>
              </div>
              <div className="ml-4 flex-shrink-0">
                {f.status === 'pending' && (
                  <span className="text-gray-400">Waiting...</span>
                )}
                {f.status === 'processing' && (
                  <span className="text-sage-600 flex items-center gap-1">
                    <span className="animate-spin inline-block w-3 h-3 border border-sage-500 border-t-transparent rounded-full" />
                    Processing...
                  </span>
                )}
                {f.status === 'done' && (
                  <span className="text-green-600">✓ {f.count} transactions</span>
                )}
                {f.status === 'error' && (
                  <span className="text-red-500">Failed to parse</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 p-4 rounded-lg">
          <p className="text-red-800 text-sm">{error}</p>
        </div>
      )}
    </div>
  )
}
