'use client'
import { useState } from 'react'
import { ShoppingBag, Upload } from 'lucide-react'
import { parseTargetPurchasesCsv } from '@/lib/targetCsv'

// Imports the item-level CSV produced by the user's own Target purchase
// history export (see the browser-extension prompt discussed with the
// user — it scrapes their already-logged-in target.com session, nothing
// here ever touches Target credentials). Items are matched server-side to
// existing "Target" transactions by amount + nearby date, so this can be
// uploaded any time — before or after the matching bank statement.
export default function TargetPurchaseImport() {
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
        body: JSON.stringify({ items }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Import failed')

      setStatus('done')
      setMessage(`Imported ${result.imported} item${result.imported === 1 ? '' : 's'} · matched ${result.matched} trip${result.matched === 1 ? '' : 's'} to your transactions`)
    } catch (err) {
      setStatus('error')
      setMessage(err.message || 'Something went wrong')
    }
  }

  return (
    <div className="bg-surface rounded-2xl border border-line shadow-sm p-5">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-sage-50 rounded-xl flex items-center justify-center flex-shrink-0">
          <ShoppingBag className="h-5 w-5 text-sage-600" aria-hidden="true" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-ink">Target purchase items</h3>
          <p className="text-xs text-ink-soft mt-0.5">
            Import your exported Target order history to see what you bought on each Target transaction.
          </p>
        </div>
        <label className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg font-medium text-xs cursor-pointer transition-colors flex-shrink-0 ${status === 'loading' ? 'bg-surface-2 text-ink-faint cursor-not-allowed' : 'bg-sage-600 hover:bg-sage-700 active:bg-sage-800 text-white'}`}>
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
        <p className={`text-xs mt-3 ${status === 'error' ? 'text-danger-600' : 'text-ink-soft'}`}>
          {message}
        </p>
      )}
    </div>
  )
}
