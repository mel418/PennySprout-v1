// Shared money formatters. Card-level numbers are rounded to whole dollars for
// scannability; drill-down views (modals, tooltips) keep exact cents.
export const money = (n) =>
  `$${Math.abs(n).toLocaleString('en-US', { maximumFractionDigits: 0 })}`

export const moneyExact = (n) =>
  `$${Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

// Signed rounded amount using a true minus sign (−, not hyphen).
export const moneySigned = (n) => `${n >= 0 ? '+' : '−'}${money(n)}`

// Abbreviated amount for genuinely tight cells — calendar day squares, where
// seven columns share a phone's width. Abbreviating ($1.2k) is what buys the
// text back up to a legible 12px; the exact figure is always one tap away in
// the day inspector, and every other surface uses money/moneyExact.
export const moneyCompact = (n) => {
  const abs = Math.abs(n)
  if (abs >= 10_000) return `$${Math.round(abs / 1000)}k`
  if (abs >= 1_000) return `$${(abs / 1000).toFixed(1).replace(/\.0$/, '')}k`
  return `$${Math.round(abs).toLocaleString('en-US')}`
}
