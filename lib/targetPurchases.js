// Pure matching logic — no DB access — so it can run in tests without a
// Supabase connection. lib/targetPurchaseStorage.js wraps this with the
// actual reads/writes.
import { parseDate } from './date'

// Collapses line items into "trips" (one Target order/store visit), keyed
// by orderRef. Each trip's date is its earliest item date and its total is
// whatever TripTotal the export reported (all items in a trip share one).
export function groupIntoTrips(items) {
  const trips = new Map()
  for (const item of items) {
    if (!trips.has(item.orderRef)) {
      trips.set(item.orderRef, { orderRef: item.orderRef, date: item.date, tripTotal: item.tripTotal })
    } else {
      const trip = trips.get(item.orderRef)
      if (item.date && (!trip.date || item.date < trip.date)) trip.date = item.date
    }
  }
  return [...trips.values()]
}

// Matches trips to existing card transactions by amount (exact, to the
// cent) and proximity in time (within a few days — the charge often posts
// a day or two after the order/pickup date). Each transaction can only be
// claimed by one trip. transactions: [{ id, Date/'Trans. Date'/etc, Amount,
// Description }] — the shape returned by useTransactions.
// Returns [{ orderRef, transactionId }].
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
      matches.push({ orderRef: trip.orderRef, transactionId: best.id })
      claimed.add(best.id)
    }
  }

  return matches
}
