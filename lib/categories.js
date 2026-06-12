// Shared category normalization logic used by both the dashboard and file list.
// Kept here so both components always apply the same rules.

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
// hashed deterministically into a palette.
const CATEGORY_PALETTE = [
  '#6366f1', '#06b6d4', '#f59e0b', '#10b981', '#f43f5e',
  '#8b5cf6', '#ec4899', '#14b8a6', '#f97316', '#0ea5e9',
  '#84cc16', '#a855f7',
]

const FIXED_CATEGORY_COLORS = {
  'Income': '#507c5c',           // sage — matches the app theme
  'Bills & Payments': '#64748b', // slate
  'Other': '#9ca3af',            // gray
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
