// Parses the "Target purchase history" export produced by the browser
// extension described to the user (Date, Store/Order, ItemName, ItemPrice,
// Qty, LineTotal, ImageURL, TripTotal, Fulfillment). Separate from
// lib/csv.js's bank-statement parser: different schema, different source
// (scraped from target.com by the user, not a bank), and every item needs
// its own row rather than one row per transaction.
import { parseCsvRows } from './csv'
import { redactPii } from './pii'

const REQUIRED_HEADERS = ['Date', 'Store/Order', 'ItemName', 'ItemPrice', 'TripTotal']

// Returns { items, error }. error is a user-facing string when the file
// doesn't look like a Target purchase export at all (wrong file picked).
export function parseTargetPurchasesCsv(text) {
  const rows = parseCsvRows(text)
  if (rows.length === 0) return { items: [], error: null }

  const headers = rows[0].map(h => h.trim())
  const missing = REQUIRED_HEADERS.filter(h => !headers.includes(h))
  if (missing.length > 0) {
    return { items: [], error: `This doesn't look like a Target purchase export — missing column(s): ${missing.join(', ')}` }
  }

  const idx = Object.fromEntries(headers.map((h, i) => [h, i]))
  const get = (row, key) => (row[idx[key]] || '').trim()

  const items = rows.slice(1)
    .filter(row => row.some(f => f.trim() !== ''))
    .map(row => ({
      date: get(row, 'Date'),
      orderRef: get(row, 'Store/Order'),
      // Item names can carry PII in edge cases (e.g. "eGift Card ... to
      // Jane jane@example.com") — scrub before it ever reaches storage.
      itemName: redactPii(get(row, 'ItemName')),
      itemPrice: parseFloat(get(row, 'ItemPrice')) || 0,
      qty: parseInt(get(row, 'Qty'), 10) || 1,
      lineTotal: parseFloat(get(row, 'LineTotal')) || 0,
      imageUrl: get(row, 'ImageURL'),
      tripTotal: parseFloat(get(row, 'TripTotal')) || 0,
      fulfillment: get(row, 'Fulfillment'),
    }))
    .filter(item => item.orderRef && item.itemName)

  return { items, error: null }
}
