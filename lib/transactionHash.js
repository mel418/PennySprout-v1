// Fingerprints a file by the CONTENT of its transactions, not its raw bytes.
// This runs server-side (Node's crypto, not Web Crypto) so it works
// identically whether the transactions came from a freshly parsed upload or
// were re-read out of the transactions table for a backfill — a CSV and a
// PDF of the same statement, or the same statement re-exported with
// different file metadata, all hash the same because what actually matters
// (date, description, amount) is unchanged.
import { createHash } from 'crypto'
import { parseDate, toKey } from '@/lib/date'

export function hashTransactionSet(transactions) {
  const rows = transactions
    .map(t => {
      const d = parseDate(t)
      const dateKey = d ? toKey(d) : ''
      const description = String(t['Description'] || '').trim().toLowerCase()
      const amount = (parseFloat(t['Amount']) || 0).toFixed(2)
      return `${dateKey}|${description}|${amount}`
    })
    .sort()
    .join('\n')

  return createHash('sha256').update(rows).digest('hex')
}
