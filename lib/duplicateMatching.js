// Pure matching core for lib/transactionStorage.js findDuplicateCandidates
// / findDuplicateCandidatesForItem — split out (same reasoning as
// lib/plaidSync.js vs lib/plaidSyncEngine.js) so it's importable from vitest
// without pulling in lib/supabase.js, which imports 'server-only' and can't
// be loaded outside a Next server context.
//
// Matches on amount (exact) + date (within a tolerance window), deliberately
// not description — the same real-world transaction is often worded
// completely differently between an uploaded statement and Plaid ("Target"
// vs. "Deposit ACH TARGET DEBIT CRD Location - TARGET 0289 CERRITOS CA...").
//
// The date tolerance exists because an uploaded statement's date and Plaid's
// date for the SAME real transaction routinely disagree by a day or two —
// verified on a real connection: a payroll deposit was 1 day off (upload =
// statement/settlement date, Plaid = authorized_date). Matching on exact
// date alone silently missed it. 2 days covers that normal case; a
// same-amount pair further apart than that on this connection turned out to
// be a one-off artifact of migrating from one card issuer to another mid-
// month, not a pattern worth designing the default around — toleranceDays
// is still a parameter, so a caller can widen it for a specific scan
// (e.g. right after a bank migration) without changing the app-wide default.
//
// This returns candidate PAIRS for a human to review, not a decision to act
// on — an unscoped amount+date-window match can just as easily pair an
// unrelated credit-card charge with a checking-account transaction that
// happens to share an amount within the window, so the caller
// (lib/transactionStorage.js) only ever compares Plaid rows against a
// SPECIFIC connection's own data, and nothing here hides anything
// automatically.
export const DATE_TOLERANCE_DAYS = 2

const DAY_MS = 24 * 60 * 60 * 1000

function daysApart(dateA, dateB) {
  const a = new Date(`${dateA}T00:00:00Z`).getTime()
  const b = new Date(`${dateB}T00:00:00Z`).getTime()
  return Math.abs(a - b) / DAY_MS
}

export function matchDuplicateCandidates(plaidRows, uploadRows, { toleranceDays = DATE_TOLERANCE_DAYS } = {}) {
  const dated = (plaidRows || []).filter(r => r.date)
  if (dated.length === 0) return []

  const uploadByAmount = {}
  for (const row of uploadRows || []) {
    if (!row.date) continue
    ;(uploadByAmount[row.amount] = uploadByAmount[row.amount] || []).push(row)
  }

  const matches = []
  for (const p of dated) {
    const candidates = uploadByAmount[p.amount]
    if (!candidates) continue
    for (const c of candidates) {
      if (daysApart(p.date, c.date) > toleranceDays) continue
      matches.push({
        plaidTransactionId: p.plaid_transaction_id,
        plaidDescription: p.description,
        uploadTransactionId: c.id,
        uploadDescription: c.description,
        date: p.date,
        amount: p.amount,
      })
    }
  }
  return matches
}
