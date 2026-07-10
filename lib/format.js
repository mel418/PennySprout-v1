// Shared money formatters. Card-level numbers are rounded to whole dollars for
// scannability; drill-down views (modals, tooltips) keep exact cents.
export const money = (n) =>
  `$${Math.abs(n).toLocaleString('en-US', { maximumFractionDigits: 0 })}`

export const moneyExact = (n) =>
  `$${Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

// Signed rounded amount using a true minus sign (−, not hyphen).
export const moneySigned = (n) => `${n >= 0 ? '+' : '−'}${money(n)}`
