// Pure matching logic — no DB access — so it can run in tests without a
// Supabase connection. lib/targetPurchaseStorage.js wraps this with the
// actual reads/writes.
import { parseDate } from './date'

// Collapses line items into "trips" (one Target order/store visit), keyed
// by orderRef + date — NOT orderRef alone. Online orders get a unique
// orderRef per order, but in-store exports reuse the store's name as
// "orderRef" for every visit ("Cerritos Bloomfield Avenue" appears on
// dozens of different dates), so orderRef alone would collapse a month of
// separate store trips into one. date disambiguates: each trip is exactly
// one order or one calendar-day visit to one store.
export function groupIntoTrips(items) {
  const trips = new Map()
  for (const item of items) {
    const key = `${item.orderRef}::${item.date}`
    if (!trips.has(key)) {
      trips.set(key, { orderRef: item.orderRef, date: item.date, tripTotal: item.tripTotal })
    }
  }
  return [...trips.values()]
}

// Matches trips to existing card transactions by amount (exact, to the
// cent) and proximity in time (within a few days — the charge often posts
// a day or two after the order/pickup date). Each transaction can only be
// claimed by one trip. transactions: [{ id, Date/'Trans. Date'/etc, Amount,
// Description }] — the shape returned by useTransactions.
// Returns [{ orderRef, date, transactionId }] — date is part of the trip's
// identity (see groupIntoTrips) and must travel with the match so the
// storage layer updates only that one trip's rows, not every row sharing
// the same orderRef/store-name across other dates.
const MAX_DAY_GAP = 5

export function matchTripsToTransactions(trips, transactions) {
  const candidates = transactions.filter(t => /target/i.test(t.Description || ''))
  const claimed = new Set()
  const matches = []

  for (const trip of trips) {
    // $0 trips are cancellations/returns with nothing actually charged —
    // there's no transaction to find.
    if (trip.tripTotal <= 0 || !trip.date) continue
    const tripDate = new Date(trip.date)
    if (isNaN(tripDate.getTime())) continue

    let best = null
    let bestGap = Infinity
    for (const t of candidates) {
      if (claimed.has(t.id)) continue
      const amt = Math.abs(parseFloat(t.Amount) || 0)
      if (Math.abs(amt - trip.tripTotal) > 0.01) continue
      const tDate = parseDate(t)
      if (!tDate) continue
      const gapDays = Math.abs((tDate.getTime() - tripDate.getTime()) / 86_400_000)
      if (gapDays > MAX_DAY_GAP) continue
      if (gapDays < bestGap) { bestGap = gapDays; best = t }
    }

    if (best) {
      matches.push({ orderRef: trip.orderRef, date: trip.date, transactionId: best.id })
      claimed.add(best.id)
    }
  }

  return matches
}
