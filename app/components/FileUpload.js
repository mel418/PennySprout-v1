'use client'
import { useState } from 'react'
import { Upload, FileText } from 'lucide-react'

// userId: the logged-in user's Clerk ID (passed down from page.js)
// onDataLoaded: callback that tells page.js to switch to the dashboard view
export default function FileUpload({ userId, onDataLoaded }) {
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

  // parseCSV converts raw CSV text into an array of objects.
  // "Trans. Date,Amount\n01/01/26,-50" → [{ "Trans. Date": "01/01/26", Amount: "-50" }]
  const parseCSV = (text) => {
    const lines = text.split('\n').filter(line => line.trim())

    // First line is always the header row
    const headers = lines[0].split(',').map(h => h.replace(/"/g, '').trim())

    const data = lines.slice(1).map(line => {
      const values = line.split(',')

      // headers.reduce zips the two arrays together into one object.
      // On each iteration, obj[header] = value builds up the row object.
      return headers.reduce((obj, header, index) => {
        obj[header] = (values[index] || '').replace(/"/g, '').trim()
        return obj
      }, {})
    }).filter(row =>
      // Drop rows where every single value is empty (trailing blank lines)
      Object.values(row).some(v => v)
    )

    return { headers, data }
  }

  return (
    <div className="space-y-4">
      <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-blue-400 transition-colors">
        <Upload className="mx-auto h-12 w-12 text-gray-400 mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-1">Upload Bank Statements</h3>
        <p className="text-sm text-gray-500 mb-4">
          Accepts CSV (credit cards) and PDF (bank statements) — select multiple files at once
        </p>

        <input
          type="file"
          accept=".csv,.pdf"  // limits the file picker to only show CSV and PDF files
          multiple            // allows selecting more than one file at a time
          onChange={handleFileUpload}
          disabled={isLoading}
          className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 disabled:opacity-50"
        />
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
                  <span className="text-blue-600 flex items-center gap-1">
                    <span className="animate-spin inline-block w-3 h-3 border border-blue-600 border-t-transparent rounded-full" />
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
