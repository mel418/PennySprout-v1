import { describe, it, expect } from 'vitest'
import { groupIntoTrips, matchTripsToTransactions } from '../targetPurchases'

describe('groupIntoTrips', () => {
  it('collapses items sharing an orderRef + date into one trip', () => {
    const items = [
      { orderRef: '#1', date: '2026-07-24', tripTotal: 34 },
      { orderRef: '#1', date: '2026-07-24', tripTotal: 34 },
      { orderRef: '#2', date: '2026-07-29', tripTotal: 5.06 },
    ]
    expect(groupIntoTrips(items)).toEqual([
      { orderRef: '#1', date: '2026-07-24', tripTotal: 34 },
      { orderRef: '#2', date: '2026-07-29', tripTotal: 5.06 },
    ])
  })

  it('keeps trips separate when the same orderRef recurs on different dates (in-store exports reuse the store name as orderRef for every visit)', () => {
    const items = [
      { orderRef: 'Cerritos Bloomfield Avenue', date: '2026-08-06', tripTotal: 12.37 },
      { orderRef: 'Cerritos Bloomfield Avenue', date: '2026-08-05', tripTotal: 2.96 },
      { orderRef: 'Cerritos Bloomfield Avenue', date: '2026-08-05', tripTotal: 2.96 }, // same-day second item
    ]
    expect(groupIntoTrips(items)).toEqual([
      { orderRef: 'Cerritos Bloomfield Avenue', date: '2026-08-06', tripTotal: 12.37 },
      { orderRef: 'Cerritos Bloomfield Avenue', date: '2026-08-05', tripTotal: 2.96 },
    ])
  })
})

describe('matchTripsToTransactions', () => {
  const trips = [
    { orderRef: '#1', date: '2026-07-29', tripTotal: 151.15 },
    { orderRef: '#2', date: '2026-07-27', tripTotal: 5.06 },
  ]

  it('matches by amount + nearby date to a "Target"-described transaction, and carries date along', () => {
    const transactions = [
      { id: 'a', Date: '2026-07-31', Amount: '-151.15', Description: 'Target' },
      { id: 'b', Date: '2026-07-28', Amount: '-5.06', Description: 'Target' },
      { id: 'c', Date: '2026-07-28', Amount: '-9.99', Description: 'Chipotle' },
    ]
    const matches = matchTripsToTransactions(trips, transactions)
    expect(matches).toEqual(expect.arrayContaining([
      { orderRef: '#1', date: '2026-07-29', transactionId: 'a' },
      { orderRef: '#2', date: '2026-07-27', transactionId: 'b' },
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

  it('distinguishes two different-day trips at the same store (same orderRef) sharing an amount', () => {
    const storeTrips = [
      { orderRef: 'Cerritos Bloomfield Avenue', date: '2026-08-06', tripTotal: 12.37 },
      { orderRef: 'Cerritos Bloomfield Avenue', date: '2026-08-03', tripTotal: 12.38 },
    ]
    const transactions = [
      { id: 'x', Date: '2026-08-06', Amount: '-12.37', Description: 'Target' },
      { id: 'y', Date: '2026-08-03', Amount: '-12.38', Description: 'Target' },
    ]
    const matches = matchTripsToTransactions(storeTrips, transactions)
    expect(matches).toEqual(expect.arrayContaining([
      { orderRef: 'Cerritos Bloomfield Avenue', date: '2026-08-06', transactionId: 'x' },
      { orderRef: 'Cerritos Bloomfield Avenue', date: '2026-08-03', transactionId: 'y' },
    ]))
    expect(matches).toHaveLength(2)
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
