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

// Sums only real discretionary spending — excludes Income and Bills & Payments.
export function calcSpending(transactions) {
  return transactions.reduce((sum, t) => {
    const cat = normalizeCategory(t.Category, t.Amount)
    if (cat === 'Income' || cat === 'Bills & Payments') return sum
    return sum + Math.abs(parseFloat(t.Amount) || 0)
  }, 0)
}
