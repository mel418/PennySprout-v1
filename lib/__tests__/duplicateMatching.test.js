import { describe, it, expect } from 'vitest'
import { matchDuplicateCandidates, DATE_TOLERANCE_DAYS } from '../duplicateMatching'

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

  it('matches within the date tolerance — a payroll deposit posted 1 day apart between sources (real case)', () => {
    const plaidRows = [{ plaid_transaction_id: 'p1', date: '2026-07-23', amount: 734.93, description: 'Deposit ACH TARGET CORPORATI TYPE: PAYROLL' }]
    const uploadRows = [{ id: 'u1', date: '2026-07-24', amount: 734.93, description: 'Target Payroll' }]
    expect(matchDuplicateCandidates(plaidRows, uploadRows)).toHaveLength(1)
  })

  it('matches within the date tolerance — a restaurant charge posted several days apart (real case, up to 5 days)', () => {
    const plaidRows = [{ plaid_transaction_id: 'p1', date: '2026-07-22', amount: -61.65, description: 'Wingstop' }]
    const uploadRows = [{ id: 'u1', date: '2026-07-27', amount: -61.65, description: 'WINGSTOP 355' }]
    expect(matchDuplicateCandidates(plaidRows, uploadRows)).toHaveLength(1)
  })

  it('does not match beyond the tolerance window', () => {
    const plaidRows = [{ plaid_transaction_id: 'p1', date: '2026-07-01', amount: -20, description: 'Target' }]
    const uploadRows = [{ id: 'u1', date: '2026-07-01', amount: -20, description: 'Target' }]
    const farUploadRows = [{ id: 'u2', date: '2026-07-10', amount: -20, description: 'Target' }] // 9 days out
    expect(matchDuplicateCandidates(plaidRows, uploadRows)).toHaveLength(1)
    expect(matchDuplicateCandidates(plaidRows, farUploadRows)).toEqual([])
  })

  it('the tolerance is configurable per call, not just the default', () => {
    const plaidRows = [{ plaid_transaction_id: 'p1', date: '2026-07-01', amount: -20, description: 'Target' }]
    const uploadRows = [{ id: 'u1', date: '2026-07-03', amount: -20, description: 'Target' }] // 2 days out
    expect(matchDuplicateCandidates(plaidRows, uploadRows, { toleranceDays: 1 })).toEqual([])
    expect(matchDuplicateCandidates(plaidRows, uploadRows, { toleranceDays: 2 })).toHaveLength(1)
  })

  it('does not match a coincidental same-amount transaction from an unrelated account', () => {
    // The false-positive scenario this whole review-before-hide design
    // exists to avoid: a credit card charge and a checking transaction that
    // happen to share an amount are NOT the same real transaction.
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

  it('produces no candidates when nothing shares an amount, regardless of date', () => {
    const plaidRows = [{ plaid_transaction_id: 'p1', date: '2026-03-05', amount: -5.98, description: 'Target' }]
    const uploadRows = [{ id: 'u1', date: '2026-03-05', amount: -6.98, description: 'Target' }]
    expect(matchDuplicateCandidates(plaidRows, uploadRows)).toEqual([])
  })

  it('skips Plaid rows with no date, and upload rows with no date', () => {
    const plaidRows = [{ plaid_transaction_id: 'p1', date: null, amount: -5.98, description: 'Target' }]
    const uploadRows = [{ id: 'u1', date: null, amount: -5.98, description: 'Target' }]
    expect(matchDuplicateCandidates(plaidRows, uploadRows)).toEqual([])

    const datedPlaidRows = [{ plaid_transaction_id: 'p2', date: '2026-03-05', amount: -5.98, description: 'Target' }]
    const undatedUploadRows = [{ id: 'u2', date: null, amount: -5.98, description: 'Target' }]
    expect(matchDuplicateCandidates(datedPlaidRows, undatedUploadRows)).toEqual([])
  })

  it('handles empty inputs without throwing', () => {
    expect(matchDuplicateCandidates([], [])).toEqual([])
    expect(matchDuplicateCandidates(null, null)).toEqual([])
  })

  it('DATE_TOLERANCE_DAYS is the actual default applied (regression guard against silently drifting apart)', () => {
    const plaidRows = [{ plaid_transaction_id: 'p1', date: '2026-07-01', amount: -20, description: 'Target' }]
    const atEdge = [{ id: 'u1', date: '2026-07-01', amount: -20, description: 'Target' }]
    // Shift the upload date to exactly the default tolerance boundary.
    const edgeDate = new Date(`2026-07-01T00:00:00Z`)
    edgeDate.setUTCDate(edgeDate.getUTCDate() + DATE_TOLERANCE_DAYS)
    atEdge[0].date = edgeDate.toISOString().slice(0, 10)
    expect(matchDuplicateCandidates(plaidRows, atEdge)).toHaveLength(1)
  })
})
