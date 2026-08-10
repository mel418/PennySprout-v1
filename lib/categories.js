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
// The palette is the app's pastel stationery set, held at mid-tone saturation
// so each swatch stays legible as a dot, a chart fill, and a chip wash in BOTH
// light and dark themes (these are plain hex, not theme variables, because
// they're handed to Recharts fills and inline styles).
//
// Color is never the only signal — CategoryChip always prints the name too.
const SEMANTIC = {
  income:        '#7C9A74',  // sage green      — money in
  savings:       '#5F8B6A',  // botanical green — money kept
  spending:      '#DFA3A8',  // blush pink      — money out
  bills:         '#E4A97C',  // warm peach      — obligations
  goals:         '#D9BE6D',  // buttery yellow  — things being saved toward
  transfers:     '#9DC3D2',  // powder blue     — money moved, not spent
  subscriptions: '#B0A2D3',  // muted lavender  — recurring
  neutral:       '#B5A79A',  // warm beige      — uncategorized
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
  'subscriptions':     SEMANTIC.subscriptions,
  'subscription':      SEMANTIC.subscriptions,
  'shopping':          SEMANTIC.spending,

  // ── Common real-world categories ──
  'food':            '#E09B8C',  // soft coral
  'dining':          '#E09B8C',
  'restaurants':     '#E09B8C',
  'food & dining':   '#E09B8C',
  'merchandise':     '#C98FA9',  // dusty rose — a shopping cousin
  'entertainment':   '#C08FC4',  // orchid
  'fitness':         '#9BBE9A',  // soft sage
  'health':          '#D4A59A',  // clay
  'medical':         '#D4A59A',
  'groceries':       '#C3BE7E',  // olive
  'supermarkets':    '#C3BE7E',
  'travel':          '#8FB6D6',  // sky blue
  'gas/automotive':  '#7FB3AA',  // muted teal
  'gas':             '#7FB3AA',
  'automotive':      '#7FB3AA',
  'transport':       '#7FB3AA',
  'transportation':  '#7FB3AA',
  'home':            '#C7A98C',  // warm sand
  'education':       '#9FAED6',  // periwinkle
  'services':        '#A9A296',  // warm taupe
  'other services':  '#A9A296',
  'other':           SEMANTIC.neutral,
}

// Anything still unrecognized gets hashed into this set — same family, so an
// unfamiliar bank category still looks like it belongs.
const CATEGORY_PALETTE = [
  '#E09B8C', '#9BBE9A', '#8FB6D6', '#C98FA9', '#D9BE6D',
  '#B0A2D3', '#E4A97C', '#7FB3AA', '#C3BE7E', '#CFA391',
  '#9FAED6', '#AFC08D',
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
// purchase, so it's excluded here rather than counted as spending.
const EXCLUDED_FROM_TOTALS = new Set(['Income', 'Bills & Payments', 'Transfer', 'Account Transfer'])

// Sums only real discretionary spending — excludes Income, Bills & Payments,
// and both Transfer categories (moving money between accounts isn't a purchase).
export function calcSpending(transactions) {
  return transactions.reduce((sum, t) => {
    const cat = normalizeCategory(t.Category, t.Amount)
    if (EXCLUDED_FROM_TOTALS.has(cat)) return sum
    return sum + Math.abs(parseFloat(t.Amount) || 0)
  }, 0)
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
    totals[cat] = (totals[cat] || 0) + Math.abs(parseFloat(t.Amount) || 0)
  })
  return Object.entries(totals)
    .map(([category, amount]) => ({ category, amount }))
    .sort((a, b) => b.amount - a.amount)
}
