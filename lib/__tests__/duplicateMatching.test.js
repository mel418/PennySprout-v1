import { describe, it, expect } from 'vitest'
import { matchDuplicateCandidates } from '../duplicateMatching'

describe('matchDuplicateCandidates', () => {
  it('pairs a Plaid transaction with an uploaded one sharing the same date and amount', () => {
    const plaidRows = [{ plaid_transaction_id: 'p1', date: '2026-08-06', amount: -9.13, description: 'Target' }]
    const uploadRows = [{ id: 'u1', date: '2026-08-06', amount: -9.13, description: 'Target' }]
    expect(matchDuplicateCandidates(plaidRows, uploadRows)).toEqual([
      { plaidTransactionId: 'p1', plaidDescription: 'Target', uploadTransactionId: 'u1', uploadDescription: 'Target', date: '2026-08-06', amount: -9.13 },
    ])
  })

  it('matches even when descriptions are worded completely differently — the actual real-world case', () => {
    const plaidRows = [{
      plaid_transaction_id: 'p1', date: '2026-02-17', amount: 4.88,
      description: 'Deposit ACH TARGET DEBIT CRD Location - TARGET 0289 CERRITOS CA / Terminal ID: 6N0676 TYPE: ACH TRAN CO: TARGET DEBIT CRD',
    }]
    const uploadRows = [{ id: 'u1', date: '2026-02-17', amount: 4.88, description: 'Target' }]
    const matches = matchDuplicateCandidates(plaidRows, uploadRows)
    expect(matches).toHaveLength(1)
    expect(matches[0].uploadTransactionId).toBe('u1')
  })

  it('does not match a coincidental same-date-and-amount transaction from an unrelated account', () => {
    // The false-positive scenario this whole review-before-hide design
    // exists to avoid: a credit card charge and a checking transaction that
    // happen to share a date and amount are NOT the same real transaction.
    // matchDuplicateCandidates can't know that on its own — this test just
    // documents that it WILL still produce a (correct-shaped) candidate
    // pair here, which is exactly why the caller always shows candidates
    // for human review rather than hiding them automatically.
    const plaidRows = [{ plaid_transaction_id: 'p1', date: '2026-05-15', amount: -25.77, description: 'Target' }]
    const uploadRows = [{ id: 'u1', date: '2026-05-15', amount: -25.77, description: 'CAPITAL ONE MOBILE PYMT' }]
    expect(matchDuplicateCandidates(plaidRows, uploadRows)).toHaveLength(1)
  })

  it('produces multiple candidates when several uploads match one Plaid transaction (the double-upload case)', () => {
    const plaidRows = [{ plaid_transaction_id: 'p1', date: '2026-03-05', amount: -5.98, description: 'Target' }]
    const uploadRows = [
      { id: 'u1', date: '2026-03-05', amount: -5.98, description: 'Target' },
      { id: 'u2', date: '2026-03-05', amount: -5.98, description: 'Target' },
    ]
    expect(matchDuplicateCandidates(plaidRows, uploadRows).map(m => m.uploadTransactionId)).toEqual(['u1', 'u2'])
  })

  it('produces no candidates when nothing shares a date and amount', () => {
    const plaidRows = [{ plaid_transaction_id: 'p1', date: '2026-03-05', amount: -5.98, description: 'Target' }]
    const uploadRows = [{ id: 'u1', date: '2026-03-06', amount: -5.98, description: 'Target' }]
    expect(matchDuplicateCandidates(plaidRows, uploadRows)).toEqual([])
  })

  it('skips Plaid rows with no date', () => {
    const plaidRows = [{ plaid_transaction_id: 'p1', date: null, amount: -5.98, description: 'Target' }]
    const uploadRows = [{ id: 'u1', date: null, amount: -5.98, description: 'Target' }]
    expect(matchDuplicateCandidates(plaidRows, uploadRows)).toEqual([])
  })

  it('handles empty inputs without throwing', () => {
    expect(matchDuplicateCandidates([], [])).toEqual([])
    expect(matchDuplicateCandidates(null, null)).toEqual([])
  })
})
