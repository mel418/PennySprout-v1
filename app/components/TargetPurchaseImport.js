'use client'
import { useState } from 'react'
import { ShoppingBag, Upload } from 'lucide-react'
import { parseTargetPurchasesCsv } from '@/lib/targetCsv'
import { buttonClass } from './ui/Button'

// Imports the item-level CSV produced by the user's own Target purchase
// history export (see the browser-extension prompt discussed with the
// user — it scrapes their already-logged-in target.com session, nothing
// here ever touches Target credentials). Items are matched server-side to
// existing "Target" transactions by amount + nearby date, so this can be
// uploaded any time — before or after the matching bank statement.
export default function TargetPurchaseImport({ onImported }) {
  const [status, setStatus] = useState('idle') // idle | loading | done | error
  const [message, setMessage] = useState('')

  const handleFile = async (event) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    setStatus('loading')
    setMessage('')
    try {
      const text = await file.text()
      const { items, error } = parseTargetPurchasesCsv(text)
      if (error) throw new Error(error)
      if (items.length === 0) throw new Error('No purchases found in this file')

      const response = await fetch('/api/target-purchases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items, fileName: file.name }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Import failed')

      setStatus('done')
      setMessage(`Imported ${result.imported} item${result.imported === 1 ? '' : 's'} · matched ${result.matched} trip${result.matched === 1 ? '' : 's'} to your transactions`)
      if (result.importId) onImported?.()
    } catch (err) {
      setStatus('error')
      setMessage(err.message || 'Something went wrong')
    }
  }

  return (
    <div className="card-soft p-4 sm:p-5">
      {/* Stacks on phones (icon + copy, then a full-width button) and becomes a
          single row from sm up — squeezing all three into one row at 375px
          crushed the description into a 3-word column. */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-peach-50">
            <ShoppingBag className="h-5 w-5 text-peach-600" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-ink">Target purchase items</h3>
            <p className="mt-0.5 text-sm leading-relaxed text-ink-soft">
              Import your exported Target order history to see what you bought on each Target transaction.
            </p>
          </div>
        </div>
        <label className={buttonClass({
          size: 'sm',
          variant: 'secondary',
          className: `w-full flex-shrink-0 sm:w-auto ${status === 'loading' ? 'pointer-events-none opacity-45' : ''}`,
        })}>
          <Upload className="h-3.5 w-3.5" aria-hidden="true" />
          {status === 'loading' ? 'Importing…' : 'Import CSV'}
          <input
            type="file"
            accept=".csv"
            onChange={handleFile}
            disabled={status === 'loading'}
            className="sr-only"
          />
        </label>
      </div>

      {message && (
        <p
          className={`mt-3 text-sm ${status === 'error' ? 'text-danger-600' : 'text-ink-soft'}`}
          role={status === 'error' ? 'alert' : 'status'}
        >
          {message}
        </p>
      )}
    </div>
  )
}
