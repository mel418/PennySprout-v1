// Pure mapping from Plaid's transaction shape to this app's. No Supabase
// import, no network call — everything here is a plain function of its
// arguments, which is what makes it unit-testable (lib/__tests__/plaidMapping.test.js)
// and safe to reason about before any Sandbox credentials exist.
import { redactPii } from './pii'

// personal_finance_category.primary -> a STANDARD_CATEGORIES value (or a
// non-standard-but-recognized one — see the note below). Deliberately emits
// RAW categories only; lib/categories.js normalizeCategory stays the single
// place 'Bills' -> 'Bills & Payments' and positive-amount 'Transfer' ->
// 'Income' happen. Pre-normalizing here would split one rule across two
// files and risk double-applying it.
//
// A few entries ('Transportation', 'Medical') aren't in STANDARD_CATEGORIES
// but are legal: the category-correction dropdown merges the standard set
// with whatever's already in the user's data, and lib/categories.js
// categoryColor already has fixed aliases for both, so they render with a
// real color instead of falling through to the hash palette.
//
// BANK_FEES deliberately maps to 'Other', not 'Bills': a fee is money
// genuinely gone, and 'Bills & Payments' is excluded from the spending
// total (see calcSpending) — grouping fees there would hide them.
//
// RENT_AND_UTILITIES maps to 'Bills' and is therefore excluded from the
// spending total too. That's a known wart (rent is likely a user's largest
// outflow) but it matches how the parse-pdf AI prompt already categorizes
// bill payments from uploaded statements — consistency over correctness for
// v1. See ROADMAP for the follow-up ("split Bills & Payments into counted
// vs. excluded").
export const PFC_TO_CATEGORY = Object.freeze({
  INCOME: 'Income',
  TRANSFER_IN: 'Transfer',
  TRANSFER_OUT: 'Transfer',
  LOAN_PAYMENTS: 'Bills',
  RENT_AND_UTILITIES: 'Bills',
  BANK_FEES: 'Other',
  FOOD_AND_DRINK: 'Food',
  GENERAL_MERCHANDISE: 'Shopping',
  HOME_IMPROVEMENT: 'Shopping',
  ENTERTAINMENT: 'Entertainment',
  TRAVEL: 'Travel',
  TRANSPORTATION: 'Transportation',
  MEDICAL: 'Medical',
  PERSONAL_CARE: 'Other',
  GENERAL_SERVICES: 'Other',
  GOVERNMENT_AND_NON_PROFIT: 'Other',
})

export function mapPfcToCategory(pfc) {
  const primary = pfc?.primary
  if (!primary) return 'Other'
  return PFC_TO_CATEGORY[primary] || 'Other'
}

// Plaid's sign convention is the OPPOSITE of this app's: Plaid amount is
// POSITIVE when money leaves the account (a purchase) and NEGATIVE for
// deposits/refunds/income. This app stores negative = charge, positive =
// deposit (see the transactions table comment). This function is the single
// place that inversion happens — everything downstream (calcSpending,
// calcIncome, the calendar, budgets) just sees app-convention amounts.
export function toAppAmount(plaidAmount) {
  const n = -Number(plaidAmount)
  return n === 0 ? 0 : n // avoid emitting -0
}

// Maps one /transactions/sync transaction to a transactions-table row ready
// for insert/upsert. `ctx.itemRowId` is plaid_items.id (our uuid), not
// Plaid's item_id.
export function plaidTxnToRow(txn, { userId, itemRowId }) {
  const date = txn.authorized_date || txn.date || null
  const rawDescription = txn.merchant_name || txn.name || ''

  return {
    user_id: userId,
    file_id: null,
    source: 'plaid',
    plaid_item_id: itemRowId,
    plaid_account_id: txn.account_id,
    plaid_transaction_id: txn.transaction_id,
    date,
    description: redactPii(rawDescription),
    amount: toAppAmount(txn.amount),
    category: mapPfcToCategory(txn.personal_finance_category),
    pending: Boolean(txn.pending),
    iso_currency_code: txn.iso_currency_code || null,
  }
}

// Same mapping, but in the app's client shape ('Date'/'Description'/...) —
// for feeding freshly-synced transactions into lib/budgetAlerts.js
// checkBudgetAlerts, which expects the same shape useTransactions.js reads.
export function plaidTxnToClientShape(txn) {
  const date = txn.authorized_date || txn.date || null
  return {
    'Date': date,
    'Description': redactPii(txn.merchant_name || txn.name || ''),
    'Amount': toAppAmount(txn.amount),
    'Category': mapPfcToCategory(txn.personal_finance_category),
  }
}
