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

// Stable color per category so the same category always looks the same.
// A few well-known categories get fixed, on-theme colors; everything else is
// hashed deterministically into a palette. Tones are deliberately muted and
// low-saturation to keep the interface calm (no neon).
const CATEGORY_PALETTE = [
  '#7C8DB5', '#8BAB9A', '#D9A679', '#9A8BB5', '#7FA6A6',
  '#C2A06B', '#B58B9A', '#8BA0B5', '#A8B58B', '#B59A8B',
  '#8BB5AD', '#A88BB5',
]

const FIXED_CATEGORY_COLORS = {
  'Income': '#5C7A55',           // sage — matches the app theme
  'Bills & Payments': '#6F8CAB', // dusty blue
  'Other': '#9A968C',            // warm gray
}

export function categoryColor(category) {
  if (!category) return FIXED_CATEGORY_COLORS['Other']
  if (FIXED_CATEGORY_COLORS[category]) return FIXED_CATEGORY_COLORS[category]
  let hash = 0
  for (let i = 0; i < category.length; i++) {
    hash = (hash * 31 + category.charCodeAt(i)) >>> 0
  }
  return CATEGORY_PALETTE[hash % CATEGORY_PALETTE.length]
}

// Sums only real discretionary spending — excludes Income and Bills & Payments.
export function calcSpending(transactions) {
  return transactions.reduce((sum, t) => {
    const cat = normalizeCategory(t.Category, t.Amount)
    if (cat === 'Income' || cat === 'Bills & Payments') return sum
    return sum + Math.abs(parseFloat(t.Amount) || 0)
  }, 0)
}

// Sums income transactions.
export function calcIncome(transactions) {
  return transactions.reduce((sum, t) => {
    if (normalizeCategory(t.Category, t.Amount) !== 'Income') return sum
    return sum + Math.abs(parseFloat(t.Amount) || 0)
  }, 0)
}

// Per-category discretionary totals, largest first (excludes Income & Bills).
export function categoryTotals(transactions) {
  const totals = {}
  transactions.forEach(t => {
    const cat = normalizeCategory(t.Category, t.Amount)
    if (cat === 'Income' || cat === 'Bills & Payments') return
    totals[cat] = (totals[cat] || 0) + Math.abs(parseFloat(t.Amount) || 0)
  })
  return Object.entries(totals)
    .map(([category, amount]) => ({ category, amount }))
    .sort((a, b) => b.amount - a.amount)
}
