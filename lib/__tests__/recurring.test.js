import { describe, it, expect } from 'vitest'
import { detectRecurring } from '../recurring'

const TODAY = new Date(2026, 6, 8) // fixed "today" so projections are deterministic

function txn(date, description, amount) {
  return { 'Trans. Date': date, Description: description, Amount: String(amount) }
}

describe('detectRecurring', () => {
  it('detects a steady monthly charge across 2+ months', () => {
    const items = detectRecurring([
      txn('04/06/2026', 'NETFLIX.COM 12345', -15.49),
      txn('05/06/2026', 'NETFLIX.COM 67890', -15.49),
      txn('06/06/2026', 'NETFLIX.COM 24680', -15.49),
    ], { today: TODAY })

    expect(items).toHaveLength(1)
    expect(items[0].amount).toBeCloseTo(15.49)
    expect(items[0].occurrences).toBe(3)
    // Last charge was on the 6th; today is July 8 → next projected Aug 6
    expect(items[0].nextDate.getMonth()).toBe(7)
    expect(items[0].nextDate.getDate()).toBe(6)
  })

  it('groups the same merchant despite reference-number noise', () => {
    const items = detectRecurring([
      txn('05/01/2026', 'SPOTIFY USA 555001', -11.99),
      txn('06/01/2026', 'SPOTIFY USA 555002', -11.99),
    ], { today: TODAY })
    expect(items).toHaveLength(1)
  })

  it('ignores merchants seen in only one month', () => {
    const items = detectRecurring([
      txn('06/01/2026', 'ONE TIME STORE', -50),
      txn('06/15/2026', 'ONE TIME STORE', -50),
    ], { today: TODAY })
    expect(items).toHaveLength(0)
  })

  it('ignores income (positive amounts)', () => {
    const items = detectRecurring([
      txn('05/01/2026', 'PAYROLL DEPOSIT', 2500),
      txn('06/01/2026', 'PAYROLL DEPOSIT', 2500),
    ], { today: TODAY })
    expect(items).toHaveLength(0)
  })

  it('rejects wildly varying amounts as non-recurring', () => {
    const items = detectRecurring([
      txn('05/01/2026', 'RANDOM SHOP', -5),
      txn('06/01/2026', 'RANDOM SHOP', -95),
    ], { today: TODAY })
    expect(items).toHaveLength(0)
  })

  it('returns an empty list for no transactions', () => {
    expect(detectRecurring([], { today: TODAY })).toEqual([])
  })
})
