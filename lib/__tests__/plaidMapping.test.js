import { describe, it, expect } from 'vitest'
import { mapPfcToCategory, toAppAmount, plaidTxnToRow, plaidTxnToClientShape, PFC_TO_CATEGORY } from '../plaidMapping'
import { normalizeCategory, calcSpending, calcIncome, categoryTotals, categoryColor, SEMANTIC_COLORS, STANDARD_CATEGORIES } from '../categories'
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

describe('mapPfcToCategory — internal (own-account) transfers vs. genuine P2P transfers', () => {
  const INTERNAL_CASES = [
    'TRANSFER_IN_ACCOUNT_TRANSFER',
    'TRANSFER_IN_SAVINGS',
    'TRANSFER_IN_INVESTMENT_AND_RETIREMENT_FUNDS',
    'TRANSFER_OUT_ACCOUNT_TRANSFER',
    'TRANSFER_OUT_SAVINGS',
    'TRANSFER_OUT_INVESTMENT_AND_RETIREMENT_FUNDS',
  ]

  it.each(INTERNAL_CASES)('detailed %s -> Account Transfer, not Transfer', (detailed) => {
    const primary = detailed.startsWith('TRANSFER_IN') ? 'TRANSFER_IN' : 'TRANSFER_OUT'
    expect(mapPfcToCategory({ primary, detailed })).toBe('Account Transfer')
  })

  it('a positive-amount internal transfer is NOT counted as income (the reported bug)', () => {
    // "Deposit Home Banking Transfer From Share 0040" — money moved from
    // one of the user's own sub-accounts at the same institution, not
    // income from someone else.
    const row = plaidTxnToClientShape({
      amount: -536, // Plaid: negative = money in -> app: positive
      name: 'Deposit Home Banking Transfer From Share 0040 REF #1',
      date: '2026-08-06',
      personal_finance_category: { primary: 'TRANSFER_IN', detailed: 'TRANSFER_IN_ACCOUNT_TRANSFER' },
    })
    expect(row.Category).toBe('Account Transfer')
    expect(calcIncome([row])).toBe(0)
    expect(calcSpending([row])).toBe(0)
    expect(categoryTotals([row])).toEqual([])
  })

  it('a negative-amount internal transfer is NOT counted as spending', () => {
    const row = plaidTxnToClientShape({
      amount: 536, // Plaid: positive = money out -> app: negative
      name: 'Withdrawal Transfer To Share 0040',
      date: '2026-08-06',
      personal_finance_category: { primary: 'TRANSFER_OUT', detailed: 'TRANSFER_OUT_ACCOUNT_TRANSFER' },
    })
    expect(row.Category).toBe('Account Transfer')
    expect(calcSpending([row])).toBe(0)
  })

  it('TRANSFER_IN_DEPOSIT and TRANSFER_IN_OTHER_TRANSFER_IN still map to plain Transfer (genuine P2P, e.g. Zelle)', () => {
    expect(mapPfcToCategory({ primary: 'TRANSFER_IN', detailed: 'TRANSFER_IN_DEPOSIT' })).toBe('Transfer')
    expect(mapPfcToCategory({ primary: 'TRANSFER_IN', detailed: 'TRANSFER_IN_OTHER_TRANSFER_IN' })).toBe('Transfer')
    expect(mapPfcToCategory({ primary: 'TRANSFER_IN', detailed: 'TRANSFER_IN_CASH_ADVANCES_AND_LOANS' })).toBe('Transfer')
  })

  it('falls back to the primary-level Transfer mapping when detailed is absent or unrecognized', () => {
    expect(mapPfcToCategory({ primary: 'TRANSFER_IN' })).toBe('Transfer')
    expect(mapPfcToCategory({ primary: 'TRANSFER_IN', detailed: 'SOMETHING_NEW_PLAID_ADDED' })).toBe('Transfer')
  })
})

describe('mapPfcToCategory — text-pattern fallback for TRANSFER_IN_OTHER_TRANSFER_IN / TRANSFER_IN_DEPOSIT', () => {
  // Verified against a real connection: this detailed bucket mixes internal
  // transfers described only by an account number (not caught by the
  // detailed-level check, which only recognizes the ACCOUNT_TRANSFER/
  // SAVINGS/INVESTMENT detailed values), merchant debit-card refunds posted
  // as ACH credits, and genuine P2P transfers, all under the same
  // low-signal detailed value. Numbers below are fabricated, not a real
  // account.
  const AMBIGUOUS_PFC = { primary: 'TRANSFER_IN', detailed: 'TRANSFER_IN_OTHER_TRANSFER_IN' }

  it('an internal transfer named only by an account number -> Account Transfer', () => {
    expect(mapPfcToCategory(AMBIGUOUS_PFC, 'Deposit Home Banking From 0012345678-0040')).toBe('Account Transfer')
    expect(mapPfcToCategory(AMBIGUOUS_PFC, 'Deposit Home Banking Transfer From Share 0040 REF #1171745')).toBe('Account Transfer')
  })

  it('a merchant debit-card refund posted via ACH -> Refund, not Income (the reported bug)', () => {
    const row = plaidTxnToClientShape({
      amount: -18.29, // Plaid: negative = money in -> app: positive
      name: 'Deposit ACH SUPERSTORE DEBIT CRD Location - SUPERSTORE 0289 ANYTOWN CA TYPE: ACH TRAN CO: SUPERSTORE DEBIT CRD',
      date: '2026-07-30',
      personal_finance_category: AMBIGUOUS_PFC,
    })
    expect(row.Category).toBe('Refund')
    expect(calcIncome([row])).toBe(0)
    expect(calcSpending([row])).toBe(0)
  })

  it('a genuine P2P transfer naming a person is left as Transfer -> still promotes to Income', () => {
    const row = plaidTxnToClientShape({
      amount: -40, // Plaid: negative = money in -> app: positive
      name: 'Deposit Faster Payments zel* JaneDoe AB12CD34EF56',
      date: '2026-07-30',
      personal_finance_category: AMBIGUOUS_PFC,
    })
    expect(row.Category).toBe('Transfer')
    expect(normalizeCategory(row.Category, row.Amount)).toBe('Income')
    expect(calcIncome([row])).toBeCloseTo(40)
  })

  it('the heuristic only refines an already-ambiguous Transfer result — never overrides a specific category', () => {
    // A "debit card" mention on a transaction Plaid already confidently
    // categorized as real income (e.g. a paycheck memo) must not be
    // reclassified.
    expect(mapPfcToCategory({ primary: 'INCOME' }, 'Payroll debit card advance')).toBe('Income')
  })
})

describe('mapPfcToCategory — transaction_code, checked before the text heuristics', () => {
  // Verified against a real credit card connection: transaction_code is
  // reliably populated there (unlike the credit union connection, where it
  // was always null for every transaction) — when it's present it's a
  // structured Plaid field, not a text guess, so it's checked first.
  const AMBIGUOUS_PFC = { primary: 'TRANSFER_IN', detailed: 'TRANSFER_IN_OTHER_TRANSFER_IN' }

  it("transaction_code 'payment' -> Bills, not Income (the reported bug: a credit card bill payment)", () => {
    // The exact real case: paying a Capital One card from a checking
    // account showed up as $1,229.15 of "income."
    const row = plaidTxnToClientShape({
      amount: -1229.15, // Plaid: negative = money in -> app: positive
      name: 'INTERNET PAYMENT - THANKYOU',
      date: '2026-07-09',
      transaction_code: 'payment',
      personal_finance_category: AMBIGUOUS_PFC,
    })
    expect(row.Category).toBe('Bills')
    expect(normalizeCategory(row.Category, row.Amount)).toBe('Bills & Payments')
    expect(calcIncome([row])).toBe(0)
    expect(calcSpending([row])).toBe(0)
  })

  it.each(['bill payment', 'direct debit', 'standing order'])("transaction_code '%s' -> Bills", (code) => {
    expect(mapPfcToCategory(AMBIGUOUS_PFC, 'some description', code)).toBe('Bills')
  })

  it("transaction_code 'refund' -> Refund, taking priority over a non-matching description", () => {
    // No "debit card" wording here at all — transaction_code alone is
    // enough, which is the point: it doesn't depend on guessing bank phrasing.
    expect(mapPfcToCategory(AMBIGUOUS_PFC, 'MERCHANT CREDIT ADJUSTMENT', 'refund')).toBe('Refund')
  })

  it('transaction_code null falls through to the text heuristics unchanged', () => {
    expect(mapPfcToCategory(AMBIGUOUS_PFC, 'Deposit Home Banking From 0012345678-0040', null)).toBe('Account Transfer')
  })

  it('an unrecognized transaction_code is ignored, not treated as a match', () => {
    expect(mapPfcToCategory(AMBIGUOUS_PFC, 'no matching text either', 'atm')).toBe('Transfer')
  })

  it('never overrides an already-specific category, same as the text heuristics', () => {
    expect(mapPfcToCategory({ primary: 'INCOME' }, 'irrelevant', 'payment')).toBe('Income')
  })
})

describe("mapPfcToCategory — transaction_code 'adjustment' credits, regardless of PFC primary", () => {
  // Verified against a real connection: 'adjustment' showed up on BOTH a
  // GENERAL_MERCHANDISE-categorized clothing return credit and an
  // OTHER-categorized cash-back reward credit -- neither is the ambiguous
  // Transfer bucket, so this has to be checked independently of it.

  it("a cash-back reward credit ('adjustment', OTHER primary) -> Refund, not spending (the reported bug)", () => {
    const row = plaidTxnToClientShape({
      amount: -64, // Plaid: negative = money in -> app: positive
      name: 'CREDIT-CASH BACK REWARD',
      date: '2026-08-07',
      transaction_code: 'adjustment',
      personal_finance_category: { primary: 'OTHER', detailed: 'OTHER_OTHER' },
    })
    expect(row.Category).toBe('Refund')
    expect(calcIncome([row])).toBe(0)
    expect(calcSpending([row])).toBe(0)
  })

  it("a return credit ('adjustment', GENERAL_MERCHANDISE primary) -> Refund, not Shopping spend", () => {
    const row = plaidTxnToClientShape({
      amount: -35.67, // Plaid: negative = money in -> app: positive
      name: 'SP SOME CLOTHING STORE',
      date: '2026-08-01',
      transaction_code: 'adjustment',
      personal_finance_category: { primary: 'GENERAL_MERCHANDISE', detailed: 'GENERAL_MERCHANDISE_CLOTHING_AND_ACCESSORIES' },
    })
    expect(row.Category).toBe('Refund')
    expect(calcSpending([row])).toBe(0)
  })

  it("a DEBIT 'adjustment' (money leaving) is left alone -- still counted as real spending", () => {
    const row = plaidTxnToClientShape({
      amount: 12.5, // Plaid: positive = money out -> app: negative
      name: 'Some fee correction',
      date: '2026-08-01',
      transaction_code: 'adjustment',
      personal_finance_category: { primary: 'BANK_FEES' },
    })
    expect(row.Category).toBe('Other')
    expect(calcSpending([row])).toBeCloseTo(12.5)
  })

  it("'adjustment' with a missing/non-numeric amount is not treated as a credit", () => {
    expect(mapPfcToCategory({ primary: 'OTHER' }, 'x', 'adjustment', null)).toBe('Other')
    expect(mapPfcToCategory({ primary: 'OTHER' }, 'x', 'adjustment', undefined)).toBe('Other')
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
    // intentional — see the comment in plaidMapping.js. Account Transfer
    // (returned via the detailed-level check, not this table) is checked
    // separately below.
    const EXTRA_ALLOWED = new Set(['Transportation', 'Medical'])
    for (const category of Object.values(PFC_TO_CATEGORY)) {
      const ok = STANDARD_CATEGORIES.includes(category) || EXTRA_ALLOWED.has(category)
      expect(ok, `unexpected mapped category: ${category}`).toBe(true)
    }
  })

  it('Account Transfer has a real categoryColor alias, not just the hash fallback', () => {
    expect(categoryColor('Account Transfer')).toBe(SEMANTIC_COLORS.transfers)
  })

  it('Refund has a real categoryColor alias, not just the hash fallback', () => {
    expect(categoryColor('Refund')).toBe(SEMANTIC_COLORS.transfers)
  })
})
