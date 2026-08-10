import { describe, it, expect } from 'vitest'
import { mapPfcToCategory, toAppAmount, plaidTxnToRow, plaidTxnToClientShape, PFC_TO_CATEGORY } from '../plaidMapping'
import { normalizeCategory, calcSpending, calcIncome, STANDARD_CATEGORIES } from '../categories'
import { parseDate, toKey } from '../date'

const CTX = { userId: 'user_1', itemRowId: 'item-row-uuid' }

describe('toAppAmount — sign inversion', () => {
  it('inverts a Plaid purchase (positive) to an app charge (negative)', () => {
    expect(toAppAmount(12.34)).toBe(-12.34)
  })

  it('inverts a Plaid refund/deposit (negative) to an app credit (positive)', () => {
    expect(toAppAmount(-500)).toBe(500)
  })

  it('never emits -0', () => {
    expect(Object.is(toAppAmount(0), -0)).toBe(false)
    expect(toAppAmount(0)).toBe(0)
  })
})

describe('toAppAmount round-tripped through the app\'s own spending/income logic', () => {
  it('a mapped purchase is counted by calcSpending', () => {
    const row = plaidTxnToClientShape({
      amount: 12.34, // Plaid: positive = money out
      merchant_name: 'Coffee Shop',
      date: '2026-03-01',
      personal_finance_category: { primary: 'FOOD_AND_DRINK' },
    })
    expect(calcSpending([row])).toBeCloseTo(12.34)
    expect(calcIncome([row])).toBe(0)
  })

  it('a mapped INCOME deposit is counted by calcIncome, not calcSpending', () => {
    const row = plaidTxnToClientShape({
      amount: -2500, // Plaid: negative = money in
      name: 'ACME CORP PAYROLL',
      date: '2026-03-01',
      personal_finance_category: { primary: 'INCOME' },
    })
    expect(calcIncome([row])).toBeCloseTo(2500)
    expect(calcSpending([row])).toBe(0)
  })
})

describe('mapPfcToCategory — every known PFC primary', () => {
  const CASES = [
    ['INCOME', 'Income'],
    ['TRANSFER_IN', 'Transfer'],
    ['TRANSFER_OUT', 'Transfer'],
    ['LOAN_PAYMENTS', 'Bills'],
    ['RENT_AND_UTILITIES', 'Bills'],
    ['BANK_FEES', 'Other'],
    ['FOOD_AND_DRINK', 'Food'],
    ['GENERAL_MERCHANDISE', 'Shopping'],
    ['HOME_IMPROVEMENT', 'Shopping'],
    ['ENTERTAINMENT', 'Entertainment'],
    ['TRAVEL', 'Travel'],
    ['TRANSPORTATION', 'Transportation'],
    ['MEDICAL', 'Medical'],
    ['PERSONAL_CARE', 'Other'],
    ['GENERAL_SERVICES', 'Other'],
    ['GOVERNMENT_AND_NON_PROFIT', 'Other'],
  ]

  it.each(CASES)('%s -> %s', (primary, expected) => {
    expect(mapPfcToCategory({ primary })).toBe(expected)
  })

  it('covers every key in PFC_TO_CATEGORY (table stays in sync with the test)', () => {
    const covered = new Set(CASES.map(([primary]) => primary))
    for (const primary of Object.keys(PFC_TO_CATEGORY)) {
      expect(covered.has(primary)).toBe(true)
    }
  })

  it('falls back to Other for null, missing, and unrecognized categories', () => {
    expect(mapPfcToCategory(null)).toBe('Other')
    expect(mapPfcToCategory(undefined)).toBe('Other')
    expect(mapPfcToCategory({})).toBe('Other')
    expect(mapPfcToCategory({ primary: 'NOT_A_REAL_THING' })).toBe('Other')
  })
})

describe('mapPfcToCategory interaction with normalizeCategory', () => {
  it('TRANSFER_IN with a positive app-amount promotes to Income', () => {
    const row = plaidTxnToClientShape({
      amount: -100, // Plaid: negative = money in -> app: positive
      name: 'Zelle from Mom',
      date: '2026-03-01',
      personal_finance_category: { primary: 'TRANSFER_IN' },
    })
    expect(normalizeCategory(row.Category, row.Amount)).toBe('Income')
    expect(calcIncome([row])).toBeCloseTo(100)
  })

  it('TRANSFER_OUT stays Transfer and is excluded from spending', () => {
    const row = plaidTxnToClientShape({
      amount: 40, // Plaid: positive = money out -> app: negative
      name: 'Zelle to Friend',
      date: '2026-03-01',
      personal_finance_category: { primary: 'TRANSFER_OUT' },
    })
    expect(normalizeCategory(row.Category, row.Amount)).toBe('Transfer')
    expect(calcSpending([row])).toBe(0)
  })

  it('RENT_AND_UTILITIES normalizes to Bills & Payments and is excluded from spending', () => {
    const row = plaidTxnToClientShape({
      amount: 1800,
      name: 'PROPERTY MGMT CO',
      date: '2026-03-01',
      personal_finance_category: { primary: 'RENT_AND_UTILITIES' },
    })
    expect(normalizeCategory(row.Category, row.Amount)).toBe('Bills & Payments')
    expect(calcSpending([row])).toBe(0)
  })
})

describe('plaidTxnToRow — description, date, and PII fields', () => {
  it('prefers merchant_name over name', () => {
    const row = plaidTxnToRow({
      transaction_id: 't1', account_id: 'a1', amount: 5,
      name: 'SQ *COFFEE SHOP 4521', merchant_name: 'Coffee Shop',
      date: '2026-03-01',
    }, CTX)
    expect(row.description).toBe('Coffee Shop')
  })

  it('falls back to name when merchant_name is null', () => {
    const row = plaidTxnToRow({
      transaction_id: 't2', account_id: 'a1', amount: 5,
      name: 'ACH TRANSFER', merchant_name: null,
      date: '2026-03-01',
    }, CTX)
    expect(row.description).toBe('ACH TRANSFER')
  })

  it('redacts PII patterns found in the raw name', () => {
    const row = plaidTxnToRow({
      transaction_id: 't3', account_id: 'a1', amount: 5,
      name: 'ZELLE TO 562-555-1234', merchant_name: null,
      date: '2026-03-01',
    }, CTX)
    expect(row.description).toContain('[REDACTED-PHONE]')
  })

  it('prefers authorized_date over date', () => {
    const row = plaidTxnToRow({
      transaction_id: 't4', account_id: 'a1', amount: 5,
      name: 'x', date: '2026-03-05', authorized_date: '2026-03-03',
    }, CTX)
    expect(row.date).toBe('2026-03-03')
  })

  it('falls back to date when authorized_date is null', () => {
    const row = plaidTxnToRow({
      transaction_id: 't5', account_id: 'a1', amount: 5,
      name: 'x', date: '2026-03-05', authorized_date: null,
    }, CTX)
    expect(row.date).toBe('2026-03-05')
  })

  it('the mapped date survives a parseDate + toKey round-trip with no timezone shift', () => {
    const row = plaidTxnToRow({
      transaction_id: 't6', account_id: 'a1', amount: 5,
      name: 'x', date: '2026-07-04', authorized_date: null,
    }, CTX)
    const parsed = parseDate({ 'Date': row.date })
    expect(toKey(parsed)).toBe('2026-07-04')
  })

  it('carries pending, plaid ids, and currency onto the row', () => {
    const row = plaidTxnToRow({
      transaction_id: 't7', account_id: 'a1', amount: 5, pending: true,
      pending_transaction_id: null, iso_currency_code: 'USD',
      name: 'x', date: '2026-03-01',
    }, CTX)
    expect(row.pending).toBe(true)
    expect(row.plaid_transaction_id).toBe('t7')
    expect(row.plaid_account_id).toBe('a1')
    expect(row.plaid_item_id).toBe('item-row-uuid')
    expect(row.user_id).toBe('user_1')
    expect(row.source).toBe('plaid')
    expect(row.file_id).toBeNull()
    expect(row.iso_currency_code).toBe('USD')
  })
})

describe('all mapped categories are legal for the app', () => {
  it('every PFC_TO_CATEGORY value is either a STANDARD_CATEGORIES entry or a known categoryColor alias', () => {
    // Transportation and Medical aren't in STANDARD_CATEGORIES but are
    // intentional — see the comment in plaidMapping.js.
    const EXTRA_ALLOWED = new Set(['Transportation', 'Medical'])
    for (const category of Object.values(PFC_TO_CATEGORY)) {
      const ok = STANDARD_CATEGORIES.includes(category) || EXTRA_ALLOWED.has(category)
      expect(ok, `unexpected mapped category: ${category}`).toBe(true)
    }
  })
})
