// Shared date helpers. Both the calendar and dashboard previously kept their own
// copies of parseDate/toKey — this is the single source of truth, extended with
// week / quarter / year bucketing for the calendar's multi-scale time switcher.

const MONTHS = ['January','February','March','April','May','June','July',
                'August','September','October','November','December']
const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

export { MONTHS, MONTHS_SHORT }

// Handles MM/DD/YY, MM/DD/YYYY, and ISO YYYY-MM-DD formats across bank exports.
export function parseDate(t) {
  const raw = t['Trans. Date'] || t['Date'] || t['Transaction Date'] || ''
  if (!raw) return null
  const slash = String(raw).split('/')
  if (slash.length === 3) {
    const [m, d, y] = slash
    const year = y.length === 2 ? 2000 + parseInt(y) : parseInt(y)
    const date = new Date(year, parseInt(m) - 1, parseInt(d))
    return isNaN(date.getTime()) ? null : date
  }
  const fallback = new Date(raw)
  return isNaN(fallback.getTime()) ? null : fallback
}

// Local YYYY-MM-DD key (avoids UTC off-by-one from toISOString).
export function toKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function fromKey(key) {
  return new Date(key + 'T12:00:00')
}

// ── Period helpers for the Week / Month / Year time scales ──────────────────

// Sunday-anchored start of the week containing `d`.
export function startOfWeek(d) {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  x.setDate(x.getDate() - x.getDay())
  return x
}

export function addDays(d, n) {
  const x = new Date(d)
  x.setDate(x.getDate() + n)
  return x
}

export function addMonths(d, n) {
  return new Date(d.getFullYear(), d.getMonth() + n, 1)
}

export function quarterOf(d) {
  return Math.floor(d.getMonth() / 3) + 1
}

// Returns the inclusive [start, end] Date range for the active scale's period.
// scale: 'week' | 'month' | 'year'. `anchor` is any date inside the period.
export function periodRange(scale, anchor) {
  const y = anchor.getFullYear()
  if (scale === 'week') {
    const start = startOfWeek(anchor)
    return [start, addDays(start, 6)]
  }
  if (scale === 'year') {
    return [new Date(y, 0, 1), new Date(y, 11, 31)]
  }
  // month
  const m = anchor.getMonth()
  return [new Date(y, m, 1), new Date(y, m + 1, 0)]
}

export function periodLabel(scale, anchor) {
  const y = anchor.getFullYear()
  if (scale === 'week') {
    const [start, end] = periodRange('week', anchor)
    const sameMonth = start.getMonth() === end.getMonth()
    return sameMonth
      ? `${MONTHS_SHORT[start.getMonth()]} ${start.getDate()}–${end.getDate()}, ${y}`
      : `${MONTHS_SHORT[start.getMonth()]} ${start.getDate()} – ${MONTHS_SHORT[end.getMonth()]} ${end.getDate()}, ${y}`
  }
  if (scale === 'year') return `${y}`
  return `${MONTHS[anchor.getMonth()]} ${y}`
}

// ── Calendar-month keys (for the month-based Analysis tab) ──────────────────
// A "month" here is a plain calendar month — NOT the statement billing cycle.
// We pool transactions across all files and slice them by calendar month so the
// Analysis tab reflects a real month rather than a ragged per-file statement.

// 'YYYY-MM' key for the calendar month containing `d`.
export function monthKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

// 'YYYY-MM' → 'June 2026'
export function monthKeyLabel(key) {
  const [y, m] = key.split('-')
  return `${MONTHS[parseInt(m) - 1]} ${y}`
}

// First-of-month Date for a 'YYYY-MM' key — use as an anchor for periodRange.
export function monthKeyToDate(key) {
  const [y, m] = key.split('-')
  return new Date(parseInt(y), parseInt(m) - 1, 1)
}

// Step the anchor forward/backward by one unit of the active scale.
export function stepPeriod(scale, anchor, dir) {
  if (scale === 'week') return addDays(anchor, 7 * dir)
  if (scale === 'year') return new Date(anchor.getFullYear() + dir, anchor.getMonth(), 1)
  return addMonths(anchor, dir)
}
