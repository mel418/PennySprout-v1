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

// personal_finance_category.detailed values under TRANSFER_IN/TRANSFER_OUT
// that mean "moved between the user's own accounts" — a savings sweep, an
// investment/retirement contribution, or a same-institution account-to-
// account transfer — rather than money genuinely arriving from or leaving
// to someone else. These map to 'Account Transfer' instead of 'Transfer',
// which lib/categories.js excludes from BOTH calcSpending and calcIncome
// unconditionally (unlike plain 'Transfer', which normalizeCategory
// promotes to 'Income' on a positive amount for the Zelle-received case).
// Without this split, moving your own money from a linked savings account
// to checking showed up as "income."
//
// The remaining TRANSFER_IN/OUT detailed values (DEPOSIT, WITHDRAWAL,
// CASH_ADVANCES_AND_LOANS, OTHER_TRANSFER_IN/OUT) fall through to the
// primary-level 'Transfer' mapping below, since those genuinely can be
// P2P-style transfers from/to someone else.
const INTERNAL_TRANSFER_DETAILS = new Set([
  'TRANSFER_IN_ACCOUNT_TRANSFER',
  'TRANSFER_IN_SAVINGS',
  'TRANSFER_IN_INVESTMENT_AND_RETIREMENT_FUNDS',
  'TRANSFER_OUT_ACCOUNT_TRANSFER',
  'TRANSFER_OUT_SAVINGS',
  'TRANSFER_OUT_INVESTMENT_AND_RETIREMENT_FUNDS',
])

// The detailed check above doesn't catch everything. Verified against a
// real connection: TRANSFER_IN_OTHER_TRANSFER_IN and TRANSFER_IN_DEPOSIT are
// genuine catch-all buckets that mix three very different things under one
// detailed value — a same-institution transfer described in a form Plaid
// didn't recognize as ACCOUNT_TRANSFER ("Deposit Home Banking From
// 0092718872-0040" — no name, just a raw account number, structurally
// identical to the "Share 0040" case above), a merchant debit-card refund
// processed as an ACH credit ("Deposit ACH TARGET DEBIT CRD..."), and
// genuine P2P transfers (Zelle: "Faster Payments zel* AllanBallesteros").
//
// personal_finance_category.confidence_level is NOT a usable filter here:
// the exact same recurring "Home Banking From ..." transfer showed up as
// both LOW and HIGH confidence across different instances in real data, so
// it doesn't reliably separate the ambiguous cases from the genuine ones.
//
// These two text patterns do, without touching genuine P2P transfers (which
// in every observed case name a person or a payment app, never just a bare
// account number or "debit card"):
//   - "home banking ... from <digits>" — transfer named ONLY by an
//     account/share number, no person or app — routed the same as the
//     detailed-level check above: 'Account Transfer'.
//   - "... debit c(a)rd ..." on an inbound transfer — a card refund/reversal
//     posting through ACH rather than back onto the original purchase —
//     routed to 'Refund', which lib/categories.js also excludes from both
//     totals (a refund isn't new income, and since calcSpending takes
//     Math.abs() of every non-excluded category, leaving it as 'Transfer'
//     wouldn't just wrongly count it as income — an unexcluded-from-neither
//     category would double as phantom ADDITIONAL spending too).
//
// This is a heuristic, not a guarantee — it can't see every bank's phrasing
// for this. It deliberately only fires on the ambiguous 'Transfer' result
// (never overriding an already-specific category like Income or Shopping),
// and errs toward NOT reclassifying when unsure: missing an internal
// transfer just leaves it as 'Transfer' (already excluded from spending),
// whereas wrongly suppressing genuine income is the worse failure mode.
const INTERNAL_TRANSFER_TEXT = /\bhome\s*banking\b.*\bfrom\b\s+(share\s+)?\d/i
// Matches "debit card", "debit crd" (the common bank abbreviation — the one
// actually seen in real data), and "debit cd".
const CARD_REFUND_TEXT = /\bdebit\s*c(?:ar|r)?d\b/i

function inferAmbiguousTransferCategory(description) {
  if (INTERNAL_TRANSFER_TEXT.test(description)) return 'Account Transfer'
  if (CARD_REFUND_TEXT.test(description)) return 'Refund'
  return null
}

export function mapPfcToCategory(pfc, description = '') {
  if (pfc?.detailed && INTERNAL_TRANSFER_DETAILS.has(pfc.detailed)) return 'Account Transfer'
  const primary = pfc?.primary
  const base = primary ? (PFC_TO_CATEGORY[primary] || 'Other') : 'Other'
  if (base === 'Transfer') {
    const inferred = inferAmbiguousTransferCategory(description)
    if (inferred) return inferred
  }
  return base
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
    category: mapPfcToCategory(txn.personal_finance_category, rawDescription),
    pending: Boolean(txn.pending),
    iso_currency_code: txn.iso_currency_code || null,
  }
}

// Same mapping, but in the app's client shape ('Date'/'Description'/...) —
// for feeding freshly-synced transactions into lib/budgetAlerts.js
// checkBudgetAlerts, which expects the same shape useTransactions.js reads.
export function plaidTxnToClientShape(txn) {
  const date = txn.authorized_date || txn.date || null
  const rawDescription = txn.merchant_name || txn.name || ''
  return {
    'Date': date,
    'Description': redactPii(rawDescription),
    'Amount': toAppAmount(txn.amount),
    'Category': mapPfcToCategory(txn.personal_finance_category, rawDescription),
  }
}
