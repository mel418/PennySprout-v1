'use client'
import { useState, useRef, useEffect } from 'react'
import { Upload, FileText, CheckCircle2, ShieldCheck } from 'lucide-react'
import { parseTransactionsCsv } from '@/lib/csv'
import { transactionKey as txnKey } from '@/lib/transactionKey'
import { moneyExact } from '@/lib/format'
import Button, { buttonClass } from './ui/Button'
import Doodle from './ui/Doodle'
import Field, { inputClass, Banner } from './ui/Field'
import Spinner from './ui/Spinner'

const ACCOUNT_HISTORY_KEY = 'spending-analyzer:accountNames'
const BATCH_STORAGE_KEY = 'spending-analyzer:uploadBatch'

// Dedupes the server's returned `duplicates` list for display — the server
// can return the same (date, description, amount) more than once if
// several incoming rows matched it.
function dedupeByKey(transactions) {
  const seen = new Set()
  return transactions.filter(t => {
    const key = txnKey(t)
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function loadAccountHistory() {
  try {
    return JSON.parse(localStorage.getItem(ACCOUNT_HISTORY_KEY) || '[]')
  } catch {
    return []
  }
}

function rememberAccountName(name) {
  if (!name) return
  const history = loadAccountHistory().filter(n => n !== name)
  history.unshift(name)
  localStorage.setItem(ACCOUNT_HISTORY_KEY, JSON.stringify(history.slice(0, 10)))
}

// sessionStorage (not localStorage) so an in-progress/just-finished batch
// survives a page refresh but doesn't linger forever once the tab closes —
// it's tied to "this visit," not a permanent record.
function loadPersistedBatch() {
  try {
    const raw = sessionStorage.getItem(BATCH_STORAGE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

// Only rows awaiting a follow-up action ('duplicate' → Upload anyway,
// 'transaction-duplicates' → Continue import) carry their payload forward.
// 'done'/'error' rows are just a record of what happened.
function persistBatch(fileStatuses, pendingUploads, accountName) {
  try {
    const relevantUploads = {}
    fileStatuses.forEach((f, i) => {
      if ((f.status === 'duplicate' || f.status === 'transaction-duplicates') && pendingUploads[i]) {
        relevantUploads[i] = pendingUploads[i]
      }
    })
    sessionStorage.setItem(BATCH_STORAGE_KEY, JSON.stringify({
      fileStatuses,
      pendingUploads: relevantUploads,
      accountName
    }))
  } catch {
    // Storage full/unavailable — the batch just won't survive a refresh; the
    // upload itself already succeeded or failed independently of this.
  }
}

// userId: the logged-in user's Clerk ID (passed down from page.js)
// onDataLoaded: callback that refreshes the file list rendered below the
// dropzone (upload and file management share the Files tab)
export default function FileUpload({ onDataLoaded }) {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [isDragging, setIsDragging] = useState(false)
  const [accountName, setAccountName] = useState('')
  const [accountHistory, setAccountHistory] = useState([])

  // fileStatuses tracks the processing state of EACH file individually.
  // Each entry: { name, status: 'pending' | 'processing' | 'done' | 'error'
  //   | 'duplicate' | 'transaction-duplicates', count?, message?,
  //   existingFile?, duplicates?, keepKeys? }
  // 'duplicate' = the whole file's content matches one already uploaded.
  // 'transaction-duplicates' = only some rows overlap existing data;
  //   `duplicates` is the matched subset, `keepKeys` are the ones the user
  //   has chosen to keep despite the match (see txnKey/continueImport).
  const [fileStatuses, setFileStatuses] = useState([])

  // Parsed payload for each file index, kept around so "Upload anyway" on a
  // duplicate can re-POST without re-parsing the file (a PDF re-parse would
  // re-spend the Claude call).
  const pendingUploadsRef = useRef({})

  // savedCount > 0 after a batch finishes = show the success summary. The
  // per-file status list stays visible (including any failures); the file
  // list below refreshes in place via onDataLoaded — no navigation.
  const [savedCount, setSavedCount] = useState(0)

  useEffect(() => {
    setAccountHistory(loadAccountHistory())

    // Restore whatever batch was in flight (or just finished) before a page
    // refresh. Anything still 'pending'/'processing' can't be resumed — the
    // File object and its in-flight request are both gone — so it's marked
    // interrupted instead of silently vanishing.
    const persisted = loadPersistedBatch()
    if (persisted) {
      const restored = (persisted.fileStatuses || []).map(f =>
        (f.status === 'pending' || f.status === 'processing')
          ? { ...f, status: 'error', message: 'Interrupted by a page refresh — please re-upload this file' }
          : f
      )
      pendingUploadsRef.current = persisted.pendingUploads || {}
      setFileStatuses(restored)
      setSavedCount(restored.filter(f => f.status === 'done').length)
      if (persisted.accountName) setAccountName(persisted.accountName)
    }
  }, [])

  // Applies a fileStatuses update and immediately persists the result, so
  // every transition (processing → done/duplicate/error) survives a refresh
  // without relying on a reactive effect that could race the hydration above.
  const updateFileStatuses = (updater, { account = accountName } = {}) => {
    setFileStatuses(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater
      persistBatch(next, pendingUploadsRef.current, account)
      return next
    })
  }

  // POSTs one already-parsed file. Shared by the initial pass and the
  // "Upload anyway" retry so duplicate-override doesn't re-parse anything.
  const saveFile = async (index, payload, { force = false } = {}) => {
    const response = await fetch('/api/files', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...payload, force })
    })

    if (response.status === 409) {
      const body = await response.json().catch(() => ({}))

      if (body.error === 'transaction-duplicates') {
        // Partial overlap with existing data (not a re-upload of the whole
        // statement) — surface the matched rows so the user decides which,
        // if any, are actually separate purchases to keep.
        const duplicates = dedupeByKey(body.duplicates || [])
        updateFileStatuses(prev =>
          prev.map((f, i) => i === index ? { ...f, status: 'transaction-duplicates', duplicates, keepKeys: [] } : f)
        )
        return false
      }

      updateFileStatuses(prev =>
        prev.map((f, i) => i === index ? { ...f, status: 'duplicate', existingFile: body.existingFile } : f)
      )
      return false
    }
    if (!response.ok) throw new Error("Parsed, but couldn't save — try again")

    if (payload.accountName) rememberAccountName(payload.accountName)
    updateFileStatuses(prev =>
      prev.map((f, i) => i === index
        ? { ...f, status: 'done', count: payload.transactions.length }
        : f
      )
    )
    return true
  }

  const processFiles = async (fileList) => {
    const files = Array.from(fileList)
    if (files.length === 0) return

    const accountForBatch = accountName.trim()

    setIsLoading(true)
    setError('')
    setSavedCount(0)
    pendingUploadsRef.current = {}

    // Set every file to 'pending' immediately so the UI shows all of them right away
    updateFileStatuses(files.map(f => ({ name: f.name, status: 'pending' })), { account: accountForBatch })

    let saved = 0
    let duplicates = 0

    // Process files one at a time (not in parallel) so the status updates
    // appear in order and we don't overwhelm the API with simultaneous requests.
    // Each file is saved as its own record, so My Files reflects exactly what
    // was uploaded.
    for (let i = 0; i < files.length; i++) {
      const file = files[i]

      // Updater-function form of setState so loop iterations never see stale state.
      updateFileStatuses(prev =>
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

        const payload = {
          name: file.name,
          transactions,
          totalAmount,
          transactionCount: transactions.length,
          accountName: accountForBatch
        }
        pendingUploadsRef.current[i] = payload

        const wasSaved = await saveFile(i, payload)
        if (wasSaved) saved++
        else duplicates++
      } catch (err) {
        // If one file fails, record why and keep going to the next file
        updateFileStatuses(prev =>
          prev.map((f, index) => index === i
            ? { ...f, status: 'error', message: err.message || 'Failed to parse' }
            : f
          )
        )
      }
    }

    setIsLoading(false)
    setSavedCount(saved)
    if (saved > 0) {
      onDataLoaded?.() // refresh the file list below the dropzone
      setAccountHistory(loadAccountHistory())
    } else if (duplicates === 0) {
      setError('No transactions could be extracted from the uploaded files.')
    }
  }

  const uploadAnyway = async (index) => {
    const payload = pendingUploadsRef.current[index]
    if (!payload) return
    updateFileStatuses(prev =>
      prev.map((f, i) => i === index ? { ...f, status: 'processing' } : f)
    )
    try {
      const wasSaved = await saveFile(index, payload, { force: true })
      if (wasSaved) {
        setSavedCount(c => c + 1)
        onDataLoaded?.()
        setAccountHistory(loadAccountHistory())
      }
    } catch (err) {
      updateFileStatuses(prev =>
        prev.map((f, i) => i === index
          ? { ...f, status: 'error', message: err.message || 'Failed to save' }
          : f
        )
      )
    }
  }

  // Toggles one flagged duplicate row between "skip" (default) and "keep
  // anyway" (a legitimate separate purchase that happens to share date,
  // description, and amount with an existing transaction).
  const toggleKeepDuplicate = (index, key) => {
    setFileStatuses(prev => prev.map((f, i) => {
      if (i !== index) return f
      const keepKeys = (f.keepKeys || []).includes(key)
        ? f.keepKeys.filter(k => k !== key)
        : [...(f.keepKeys || []), key]
      return { ...f, keepKeys }
    }))
  }

  // Resubmits the file with flagged-and-not-kept duplicates removed from
  // the transaction list, and skipDuplicateCheck so the server doesn't just
  // hand back the same 409 for the ones the user already decided to keep.
  const continueImport = async (index) => {
    const f = fileStatuses[index]
    const payload = pendingUploadsRef.current[index]
    if (!f || !payload) return

    const keepKeys = new Set(f.keepKeys || [])
    const duplicateKeys = new Set((f.duplicates || []).map(txnKey))
    const finalTransactions = payload.transactions.filter(t => {
      const key = txnKey(t)
      return !duplicateKeys.has(key) || keepKeys.has(key)
    })

    if (finalTransactions.length === 0) {
      updateFileStatuses(prev => prev.map((s, i) => i === index
        ? { ...s, status: 'error', message: 'Every transaction in this file was a duplicate — nothing left to import.' }
        : s
      ))
      return
    }

    const totalAmount = finalTransactions.reduce((sum, t) => sum + Math.abs(parseFloat(t.Amount) || 0), 0)
    const finalPayload = {
      ...payload,
      transactions: finalTransactions,
      transactionCount: finalTransactions.length,
      totalAmount,
      skipDuplicateCheck: true,
    }
    pendingUploadsRef.current[index] = finalPayload

    updateFileStatuses(prev => prev.map((s, i) => i === index ? { ...s, status: 'processing' } : s))
    try {
      const wasSaved = await saveFile(index, finalPayload)
      if (wasSaved) {
        setSavedCount(c => c + 1)
        onDataLoaded?.()
        setAccountHistory(loadAccountHistory())
      }
    } catch (err) {
      updateFileStatuses(prev => prev.map((s, i) => i === index
        ? { ...s, status: 'error', message: err.message || 'Failed to save' }
        : s
      ))
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
      <Field
        label="Account"
        htmlFor="account-name"
        hint="Optional — helps group the files listed below."
        className="max-w-sm"
      >
        <input
          id="account-name"
          list="account-name-history"
          value={accountName}
          onChange={e => {
            const value = e.target.value
            setAccountName(value)
            persistBatch(fileStatuses, pendingUploadsRef.current, value)
          }}
          placeholder="e.g. Chase Checking, Amex Gold"
          disabled={isLoading}
          className={inputClass()}
        />
        <datalist id="account-name-history">
          {accountHistory.map(name => <option key={name} value={name} />)}
        </datalist>
      </Field>

      {/* ── Stationery drop zone ──
          A sheet of dashed-edge paper rather than a SaaS upload box. The
          botanical marks sit in the corners; the instructions and the button
          stay dead center and uncluttered. */}
      <div
        onDragOver={e => { e.preventDefault(); if (!isLoading) setIsDragging(true) }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        className={`relative overflow-hidden rounded-[var(--radius-xl)] border-2 border-dashed px-6 py-10 text-center transition-all sm:py-14
          ${isDragging
            ? 'border-sage-500 bg-sage-50'
            : 'border-sage-200 bg-surface hover:border-sage-400 hover:bg-sage-50/40'}`}
      >
        <span aria-hidden="true" className="pointer-events-none absolute inset-0">
          <Doodle name="sprig"   className="absolute left-6 top-6 h-7 w-7 -rotate-12 text-sage-300 opacity-70" />
          <Doodle name="sparkle" className="absolute right-8 top-8 h-5 w-5 text-butter-500 opacity-70" />
          <Doodle name="leaf"    className="absolute bottom-7 right-7 h-6 w-6 rotate-12 text-sage-300 opacity-60" />
        </span>

        <div className="relative mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-[var(--radius-lg)] bg-sage-50">
          {isLoading
            ? <Spinner className="" size="sm" />
            : <Upload className="h-7 w-7 text-sage-600" aria-hidden="true" />}
        </div>

        <h3 className="relative font-display text-lg font-bold text-ink">
          Let&apos;s grow your financial picture
        </h3>
        <p className="relative mx-auto mt-1.5 mb-6 max-w-xs text-sm leading-relaxed text-ink-soft">
          Drop your CSV or PDF statements here, or choose them below.
        </p>

        <label className={buttonClass({
          size: 'lg',
          className: `relative ${isLoading ? 'pointer-events-none opacity-45' : ''}`,
        })}>
          <Upload className="h-4 w-4" aria-hidden="true" />
          {isLoading ? 'Working on it…' : 'Choose files'}
          <input
            type="file"
            accept=".csv,.pdf"
            multiple
            onChange={handleFileUpload}
            disabled={isLoading}
            className="sr-only"
          />
        </label>

        <p className="relative mt-4 inline-flex items-center gap-1.5 text-xs text-ink-faint">
          <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
          CSV or PDF · multiple files · securely processed
        </p>
      </div>

      {/* Per-file status list — only appears once files are selected */}
      {fileStatuses.length > 0 && (
        <ul className="space-y-2" aria-live="polite">
          {fileStatuses.map((f, i) => (
            <li key={i} className="card-soft p-4 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5">
                <div className="flex min-w-0 items-center gap-2">
                  <FileText className="h-4 w-4 flex-shrink-0 text-ink-faint" aria-hidden="true" />
                  <span className="truncate text-ink">{f.name}</span>
                </div>
                <div className="flex-shrink-0 text-right">
                  {f.status === 'pending' && (
                    <span className="text-ink-faint">Waiting…</span>
                  )}
                  {f.status === 'processing' && (
                    <span className="flex items-center gap-1.5 font-medium text-sage-600">
                      <span className="inline-block h-3 w-3 animate-spin rounded-full border border-sage-500 border-t-transparent" />
                      Reading it…
                    </span>
                  )}
                  {f.status === 'done' && (
                    <span className="flex items-center gap-1.5 font-semibold text-sage-600">
                      <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                      <span className="tnum">{f.count}</span> transactions
                    </span>
                  )}
                  {f.status === 'error' && (
                    <span className="font-medium text-danger-600">{f.message || 'Failed to parse'}</span>
                  )}
                  {f.status === 'duplicate' && (
                    <span className="font-semibold text-butter-600">Already uploaded</span>
                  )}
                  {f.status === 'transaction-duplicates' && (
                    <span className="font-semibold text-butter-600">
                      {f.duplicates.length} possible duplicate{f.duplicates.length !== 1 ? 's' : ''}
                    </span>
                  )}
                </div>
              </div>

              {f.status === 'duplicate' && (
                <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-3">
                  <p className="text-sm text-ink-soft">
                    Matches &quot;{f.existingFile?.name || 'a file'}&quot;
                    {f.existingFile?.uploadDate && ` uploaded ${new Date(f.existingFile.uploadDate).toLocaleDateString()}`}
                  </p>
                  <Button size="sm" variant="caution" onClick={() => uploadAnyway(i)}>
                    Upload anyway
                  </Button>
                </div>
              )}

              {/* Partial overlap with existing data — not a re-upload of the
                  whole statement, just some rows in it. Skipped by default;
                  the user checks any that are actually separate purchases. */}
              {f.status === 'transaction-duplicates' && (
                <div className="mt-3 space-y-3 border-t border-line pt-3">
                  <p className="text-sm leading-relaxed text-ink-soft">
                    These match transactions you&apos;ve already uploaded (same date, description, and amount) —
                    they&apos;re skipped by default. Tick any that are actually separate purchases to keep them.
                  </p>
                  <ul className="max-h-56 space-y-0.5 overflow-y-auto">
                    {f.duplicates.map(d => {
                      const key = txnKey(d)
                      const checked = (f.keepKeys || []).includes(key)
                      const date = d['Trans. Date'] || d['Date'] || d['Transaction Date'] || ''
                      return (
                        <li key={key}>
                          <label className="flex cursor-pointer items-center justify-between gap-3 rounded-[var(--radius-xs)] px-2 py-2 text-sm hover:bg-surface-hover">
                            <span className="flex min-w-0 items-center gap-2.5">
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => toggleKeepDuplicate(i, key)}
                                className="h-4 w-4 flex-shrink-0 accent-sage-600"
                              />
                              <span className="truncate text-ink-soft">{d['Description'] || '—'}</span>
                            </span>
                            <span className="flex-shrink-0 tnum text-ink-faint">
                              {date} · {moneyExact(Math.abs(parseFloat(d.Amount) || 0))}
                            </span>
                          </label>
                        </li>
                      )
                    })}
                  </ul>
                  <Button size="sm" onClick={() => continueImport(i)}>Continue import</Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {/* Batch finished with at least one save */}
      {!isLoading && savedCount > 0 && (
        <Banner tone="success" icon={CheckCircle2} role="status">
          <span className="font-semibold">
            {savedCount} file{savedCount !== 1 ? 's' : ''} added.
          </span>{' '}
          Your list below is up to date.
        </Banner>
      )}

      {error && <Banner tone="error" role="alert">{error}</Banner>}
    </div>
  )
}
