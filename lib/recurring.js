// Detects recurring bills / charges from transaction history and projects the
// next expected occurrence. Used by the Overview "upcoming bills" timeline.
//
// Heuristic: group outflows by a normalized merchant key, then treat a merchant
// as recurring when it appears in 2+ distinct months with a roughly steady
// amount. The next date is projected from the most recent occurrence's day-of-
// month, advanced to the first such date in the future.

import { parseDate } from './date'

// Collapse a description to a stable merchant key: lowercase, strip digits,
// card/ref noise, and extra whitespace so "NETFLIX.COM 12/04" ≈ "NETFLIX.COM".
function merchantKey(desc) {
  return String(desc || '')
    .toLowerCase()
    .replace(/[0-9]+/g, ' ')
    .replace(/[^a-z\s]/g, ' ')
    .replace(/\b(payment|autopay|recurring|ach|pos|debit|purchase|web|id|ref)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function titleCase(s) {
  return s.replace(/\b\w/g, c => c.toUpperCase())
}

// Returns recurring items sorted by soonest projected next date.
// Each: { label, key, amount, frequency, lastDate, nextDate, occurrences }
export function detectRecurring(transactions, { today = new Date() } = {}) {
  const groups = {}

  transactions.forEach(t => {
    const amount = parseFloat(t.Amount)
    if (!amount || amount >= 0) return // outflows only (negative)
    const key = merchantKey(t.Description)
    if (key.length < 3) return
    const date = parseDate(t)
    if (!date) return
    if (!groups[key]) groups[key] = []
    groups[key].push({ amount: Math.abs(amount), date, raw: t.Description })
  })

  const items = []

  for (const [key, txns] of Object.entries(groups)) {
    if (txns.length < 2) continue

    // Require activity in 2+ distinct months — a hallmark of recurring billing.
    const months = new Set(txns.map(x => `${x.date.getFullYear()}-${x.date.getMonth()}`))
    if (months.size < 2) continue

    // Steady amount check: median, and most charges within 25% of it.
    // Floor of 2: the median always matches itself, so without it any
    // two-charge group would pass regardless of how different the amounts are.
    const amounts = txns.map(x => x.amount).sort((a, b) => a - b)
    const median = amounts[Math.floor(amounts.length / 2)]
    const steady = amounts.filter(a => Math.abs(a - median) <= median * 0.25).length
    if (steady < Math.max(2, Math.ceil(txns.length * 0.5))) continue

    const sorted = txns.slice().sort((a, b) => b.date - a.date)
    const lastDate = sorted[0].date

    // Project the next occurrence from the typical day-of-month.
    const dom = lastDate.getDate()
    let next = new Date(today.getFullYear(), today.getMonth(), dom)
    if (next < today) next = new Date(today.getFullYear(), today.getMonth() + 1, dom)

    items.push({
      key,
      label: titleCase(key).slice(0, 28),
      amount: median,
      frequency: 'Monthly',
      lastDate,
      nextDate: next,
      occurrences: txns.length,
    })
  }

  return items.sort((a, b) => a.nextDate - b.nextDate)
}
