// Pure matching core for lib/transactionStorage.js findDuplicateCandidates
// / findDuplicateCandidatesForItem — split out (same reasoning as
// lib/plaidSync.js vs lib/plaidSyncEngine.js) so it's importable from vitest
// without pulling in lib/supabase.js, which imports 'server-only' and can't
// be loaded outside a Next server context.
//
// Matches on (date, amount) only, deliberately not description — the same
// real-world transaction is often worded completely differently between an
// uploaded statement and Plaid ("Target" vs. "Deposit ACH TARGET DEBIT CRD
// Location - TARGET 0289 CERRITOS CA..."). This returns candidate PAIRS for
// a human to review, not a decision to act on — an unscoped date+amount
// match can just as easily pair an unrelated credit-card charge with a
// checking-account transaction that happens to share a date and amount, so
// the caller (lib/transactionStorage.js) only ever compares Plaid rows
// against a SPECIFIC connection's own data, and nothing here hides anything
// automatically.
export function matchDuplicateCandidates(plaidRows, uploadRows) {
  const dated = (plaidRows || []).filter(r => r.date)
  if (dated.length === 0) return []

  const uploadByKey = {}
  for (const row of uploadRows || []) {
    const key = `${row.date}|${row.amount}`
    ;(uploadByKey[key] = uploadByKey[key] || []).push(row)
  }

  const matches = []
  for (const p of dated) {
    const candidates = uploadByKey[`${p.date}|${p.amount}`]
    if (!candidates) continue
    for (const c of candidates) {
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
