import { describe, it, expect } from 'vitest'
import { groupIntoTrips, matchTripsToTransactions } from '../targetPurchases'

describe('groupIntoTrips', () => {
  it('collapses items sharing an orderRef into one trip, using the earliest date', () => {
    const items = [
      { orderRef: '#1', date: '2026-07-28', tripTotal: 34 },
      { orderRef: '#1', date: '2026-07-24', tripTotal: 34 },
      { orderRef: '#2', date: '2026-07-29', tripTotal: 5.06 },
    ]
    expect(groupIntoTrips(items)).toEqual([
      { orderRef: '#1', date: '2026-07-24', tripTotal: 34 },
      { orderRef: '#2', date: '2026-07-29', tripTotal: 5.06 },
    ])
  })
})

describe('matchTripsToTransactions', () => {
  const trips = [
    { orderRef: '#1', date: '2026-07-29', tripTotal: 151.15 },
    { orderRef: '#2', date: '2026-07-27', tripTotal: 5.06 },
  ]

  it('matches by amount + nearby date to a "Target"-described transaction', () => {
    const transactions = [
      { id: 'a', Date: '2026-07-31', Amount: '-151.15', Description: 'Target' },
      { id: 'b', Date: '2026-07-28', Amount: '-5.06', Description: 'Target' },
      { id: 'c', Date: '2026-07-28', Amount: '-9.99', Description: 'Chipotle' },
    ]
    const matches = matchTripsToTransactions(trips, transactions)
    expect(matches).toEqual(expect.arrayContaining([
      { orderRef: '#1', transactionId: 'a' },
      { orderRef: '#2', transactionId: 'b' },
    ]))
    expect(matches).toHaveLength(2)
  })

  it('ignores non-Target transactions even with a matching amount', () => {
    const transactions = [{ id: 'x', Date: '2026-07-29', Amount: '-151.15', Description: 'Amazon' }]
    expect(matchTripsToTransactions(trips, transactions)).toEqual([])
  })

  it('never double-claims one transaction for two trips', () => {
    const sameAmountTrips = [
      { orderRef: '#1', date: '2026-07-01', tripTotal: 10 },
      { orderRef: '#2', date: '2026-07-02', tripTotal: 10 },
    ]
    const transactions = [{ id: 'only', Date: '2026-07-02', Amount: '-10', Description: 'Target' }]
    const matches = matchTripsToTransactions(sameAmountTrips, transactions)
    // Only one trip can win the single transaction — which one is first-fit
    // by trip order, but the important invariant is there's no double-claim.
    expect(matches).toHaveLength(1)
    expect(matches[0].transactionId).toBe('only')
  })

  it('skips $0 (canceled) trips', () => {
    const canceled = [{ orderRef: '#1', date: '2026-07-01', tripTotal: 0 }]
    const transactions = [{ id: 'a', Date: '2026-07-01', Amount: '0', Description: 'Target' }]
    expect(matchTripsToTransactions(canceled, transactions)).toEqual([])
  })

  it('does not match across too large a date gap', () => {
    const farTrip = [{ orderRef: '#1', date: '2026-01-01', tripTotal: 10 }]
    const transactions = [{ id: 'a', Date: '2026-07-01', Amount: '-10', Description: 'Target' }]
    expect(matchTripsToTransactions(farTrip, transactions)).toEqual([])
  })
})
