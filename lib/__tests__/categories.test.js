import { describe, it, expect } from 'vitest'
import {
  normalizeCategory,
  categoryColor,
  calcSpending,
  calcIncome,
  categoryTotals,
} from '../categories'

describe('normalizeCategory', () => {
  it('maps payment/credit/bills categories to Bills & Payments', () => {
    expect(normalizeCategory('Payments and Credits')).toBe('Bills & Payments')
    expect(normalizeCategory('Awards and Rebate Credits')).toBe('Bills & Payments')
    expect(normalizeCategory('Bills')).toBe('Bills & Payments')
    expect(normalizeCategory('bills')).toBe('Bills & Payments')
  })

  it('treats positive transfers as Income (Zelle received)', () => {
    expect(normalizeCategory('Transfer', '250.00')).toBe('Income')
    expect(normalizeCategory('Transfer', 250)).toBe('Income')
  })

  it('leaves negative transfers as Transfer (Zelle sent = spending)', () => {
    expect(normalizeCategory('Transfer', '-40.00')).toBe('Transfer')
  })

  it('leaves transfers with no amount context as Transfer', () => {
    expect(normalizeCategory('Transfer')).toBe('Transfer')
  })

  it('defaults missing category to Other and passes others through', () => {
    expect(normalizeCategory(null)).toBe('Other')
    expect(normalizeCategory('')).toBe('Other')
    expect(normalizeCategory('Restaurants')).toBe('Restaurants')
  })
})

describe('categoryColor', () => {
  it('is deterministic — same category always gets the same color', () => {
    expect(categoryColor('Restaurants')).toBe(categoryColor('Restaurants'))
  })

  it('uses fixed colors for the well-known categories', () => {
    expect(categoryColor('Income')).toBe('#5C7A55')
    expect(categoryColor('Bills & Payments')).toBe('#6F8CAB')
    expect(categoryColor(null)).toBe('#9A968C') // falls back to Other
  })
})

const TXNS = [
  { Description: 'COFFEE', Amount: '-4.50', Category: 'Restaurants' },
  { Description: 'GROCERIES', Amount: '30.00', Category: 'Supermarkets' }, // Discover-style positive purchase
  { Description: 'PAYROLL', Amount: '2500.00', Category: 'Income' },
  { Description: 'CARD PAYMENT', Amount: '-500.00', Category: 'Payments and Credits' },
  { Description: 'ZELLE FROM MOM', Amount: '100.00', Category: 'Transfer' },
  { Description: 'ZELLE TO FRIEND', Amount: '-25.00', Category: 'Transfer' },
]

describe('calcSpending', () => {
  it('sums absolute spending, excluding Income and Bills & Payments', () => {
    // 4.50 coffee + 30 groceries + 25 zelle sent = 59.50
    expect(calcSpending(TXNS)).toBeCloseTo(59.5)
  })

  it('ignores unparseable amounts instead of producing NaN', () => {
    expect(calcSpending([{ Amount: 'oops', Category: 'Restaurants' }])).toBe(0)
  })

  it('returns 0 for an empty list', () => {
    expect(calcSpending([])).toBe(0)
  })
})

describe('calcIncome', () => {
  it('sums payroll and received transfers only', () => {
    expect(calcIncome(TXNS)).toBeCloseTo(2600) // 2500 payroll + 100 zelle received
  })
})

describe('categoryTotals', () => {
  it('groups discretionary spending by category, largest first', () => {
    const totals = categoryTotals(TXNS)
    expect(totals).toEqual([
      { category: 'Supermarkets', amount: 30 },
      { category: 'Transfer', amount: 25 },
      { category: 'Restaurants', amount: 4.5 },
    ])
  })
})
