// Shared category normalization logic used by both the dashboard and file list.
// Kept here so both components always apply the same rules.

// The canonical category set (matches what the PDF-extraction prompt asks
// Claude to use). The category-correction dropdown offers these plus any
// bank-specific categories already present in the user's data.
export const STANDARD_CATEGORIES = [
  'Food', 'Shopping', 'Entertainment', 'Subscriptions', 'Bills',
  'Fitness', 'Travel', 'Transfer', 'Income', 'Other',
]

export function normalizeCategory(category, amount = null) {
  if (!category) return 'Other'
  const lower = category.toLowerCase()
  if (lower.includes('payment') || lower.includes('credit') || lower === 'bills') {
    return 'Bills & Payments'
  }
  // Positive transfers (Zelle received) count as income, negative (Zelle sent) as spending
  if (lower === 'transfer' && amount !== null && parseFloat(amount) > 0) {
    return 'Income'
  }
  return category
}

// ─── Semantic category colors ────────────────────────────────────────────────
//
// One meaning, one color, everywhere: dashboard, charts, calendar, transaction
// lists, budgets, goals, and AI insights all read from this map, so a category
// never changes color between screens.
//
// The palette is a clear, mid-saturation fintech set, tuned
// so each swatch stays legible as a dot, a chart fill, and a chip wash in BOTH
// light and dark themes (these are plain hex, not theme variables, because
// they're handed to Recharts fills and inline styles).
//
// Color is never the only signal — CategoryChip always prints the name too.
const SEMANTIC = {
  income:        '#2BA864',  // fresh green     — money in
  savings:       '#178A5A',  // deep green      — money kept
  spending:      '#F07A62',  // coral           — money out
  bills:         '#F4A23E',  // amber           — obligations
  goals:         '#E9C230',  // yellow          — things being saved toward
  transfers:     '#4D8BE6',  // blue            — money moved, not spent
  subscriptions: '#8C78EF',  // violet          — recurring
  neutral:       '#94A39A',  // slate green     — uncategorized
}

// Semantic roles, exported so non-category surfaces (goal cards, savings
// summaries, legends) can reuse the exact same values.
export const SEMANTIC_COLORS = SEMANTIC

// Fixed assignments, keyed by lowercased name. The seven semantic roles above
// are pinned to the exact colors the design system specifies; the rest are
// distinct, well-separated hues from the same pastel family.
//
// Synonyms matter here: banks label the same concept a dozen ways ("Dining",
// "Restaurants", "Food & Dining"), and without aliasing they'd each fall
// through to the hash and pick an unrelated color. Aliasing keeps one concept
// = one color no matter which bank the statement came from.
const FIXED_CATEGORY_COLORS = {
  // ── The seven semantic roles ──
  'income':            SEMANTIC.income,
  'savings':           SEMANTIC.savings,
  'bills & payments':  SEMANTIC.bills,
  'bills':             SEMANTIC.bills,
  'payments and credits': SEMANTIC.bills,
  'transfer':          SEMANTIC.transfers,
  'transfers':         SEMANTIC.transfers,
  'account transfer':  SEMANTIC.transfers,
  'refund':            SEMANTIC.transfers,
  'subscriptions':     SEMANTIC.subscriptions,
  'subscription':      SEMANTIC.subscriptions,
  'shopping':          SEMANTIC.spending,

  // ── Common real-world categories ──
  'food':            '#FF6F91',  // rose
  'dining':          '#FF6F91',
  'restaurants':     '#FF6F91',
  'food & dining':   '#FF6F91',
  'merchandise':     '#D65DB1',  // magenta — a shopping cousin
  'entertainment':   '#B36BE0',  // orchid
  'fitness':         '#5CC48A',  // mint
  'health':          '#E5897A',  // clay
  'medical':         '#E5897A',
  'groceries':       '#9CC53A',  // lime green
  'supermarkets':    '#9CC53A',
  'travel':          '#38B6E0',  // sky blue
  'gas/automotive':  '#22B3A6',  // teal
  'gas':             '#22B3A6',
  'automotive':      '#22B3A6',
  'transport':       '#22B3A6',
  'transportation':  '#22B3A6',
  'home':            '#C9945C',  // caramel
  'education':       '#6C7FE8',  // periwinkle
  'services':        '#8E9AA6',  // slate
  'other services':  '#8E9AA6',
  'other':           SEMANTIC.neutral,
}

// Anything still unrecognized gets hashed into this set — same family, so an
// unfamiliar bank category still looks like it belongs.
const CATEGORY_PALETTE = [
  '#FF6F91', '#5CC48A', '#38B6E0', '#D65DB1', '#E9C230',
  '#8C78EF', '#F4A23E', '#22B3A6', '#9CC53A', '#D98A5E',
  '#6C7FE8', '#7FB85A',
]

export function categoryColor(category) {
  if (!category) return SEMANTIC.neutral
  const fixed = FIXED_CATEGORY_COLORS[String(category).toLowerCase()]
  if (fixed) return fixed
  let hash = 0
  for (let i = 0; i < category.length; i++) {
    hash = (hash * 31 + category.charCodeAt(i)) >>> 0
  }
  return CATEGORY_PALETTE[hash % CATEGORY_PALETTE.length]
}

// A translucent wash of the category's color, for chip and event-block
// backgrounds. Returns an rgba() string so it composites correctly over both
// the cream and charcoal surfaces (a fixed hex tint would only work in one).
export function categoryTint(category, alpha = 0.16) {
  const hex = categoryColor(category)
  const n = parseInt(hex.slice(1), 16)
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`
}

// Categories that are never discretionary spending, regardless of amount
// sign: Income and Bills & Payments are self-explanatory; Transfer and
// Account Transfer are both "money moved, not spent" (see normalizeCategory
// and lib/plaidMapping.js) — a sent Zelle/account transfer isn't a
// purchase, so it's excluded here rather than counted as spending. Refund
// (a merchant reversing a prior card charge, mapped in lib/plaidMapping.js)
// is excluded the same way: it isn't new income, and since calcSpending
// takes Math.abs() of every non-excluded category regardless of sign, an
// unexcluded refund would otherwise be counted as MORE spending, not less.
//
// Exported deliberately: this list has drifted before. calcSpending/
// categoryTotals below always used it, but several components
// (SpendingDashboard's "All spending" modal, Budgets, Overview,
// SpendingCalendar) each hardcoded their OWN inline copy of the same three
// original categories and were never updated when Account Transfer and
// Refund were added here — Account Transfer and cash-back-style credits
// kept showing up as spending in those specific views even after
// calcSpending itself was already correct. Every one of those now imports
// this constant instead of maintaining its own list, so there's exactly one
// place left to update the next time a category needs excluding.
export const EXCLUDED_FROM_TOTALS = new Set(['Income', 'Bills & Payments', 'Transfer', 'Account Transfer', 'Refund'])

// A transaction's contribution to spending. Normally the absolute amount —
// CSV/PDF imports aren't consistent about sign (some issuers record purchases
// as positive), so sign can't be trusted there. Plaid rows are: toAppAmount
// guarantees negative = money out, so a POSITIVE amount in a spending category
// (e.g. a Target return filed under Shopping) is a credit and reduces spending
// instead of adding to it.
export function spendAmount(t, cat = normalizeCategory(t.Category, t.Amount)) {
  const n = parseFloat(t.Amount) || 0
  if (t.Source === 'plaid' && n > 0 && !EXCLUDED_FROM_TOTALS.has(cat) && cat !== 'Bills & Payments') return -n
  return Math.abs(n)
}

// Sums only real discretionary spending — excludes Income, Bills & Payments,
// and both Transfer categories (moving money between accounts isn't a purchase).
export function calcSpending(transactions) {
  return Math.max(0, transactions.reduce((sum, t) => {
    const cat = normalizeCategory(t.Category, t.Amount)
    if (EXCLUDED_FROM_TOTALS.has(cat)) return sum
    return sum + spendAmount(t, cat)
  }, 0))
}

// Sums income transactions. Account Transfer is never promoted to 'Income'
// by normalizeCategory (unlike plain 'Transfer' on a positive amount), so it
// falls out of this naturally — moving your own money between accounts
// isn't income.
export function calcIncome(transactions) {
  return transactions.reduce((sum, t) => {
    if (normalizeCategory(t.Category, t.Amount) !== 'Income') return sum
    return sum + Math.abs(parseFloat(t.Amount) || 0)
  }, 0)
}

// Per-category discretionary totals, largest first (excludes Income, Bills & both Transfer categories).
export function categoryTotals(transactions) {
  const totals = {}
  transactions.forEach(t => {
    const cat = normalizeCategory(t.Category, t.Amount)
    if (EXCLUDED_FROM_TOTALS.has(cat)) return
    totals[cat] = (totals[cat] || 0) + spendAmount(t, cat)
  })
  return Object.entries(totals)
    .filter(([, amount]) => amount > 0)
    .map(([category, amount]) => ({ category, amount }))
    .sort((a, b) => b.amount - a.amount)
}
