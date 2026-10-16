'use client'

// ─── Headers & stat tiles ────────────────────────────────────────────────────
//
// Consistent page and section titling. Page titles use the display face; the
// `doodle` props are still accepted but no longer drawn — headers stay clean.

// Top-of-tab header: big title, one line of context, optional right-hand action.
export function PageHeader({ title, subtitle, doodle, action, className = '' }) {
  return (
    <div className={`flex items-end justify-between gap-3 flex-wrap ${className}`}>
      <div className="min-w-0">
        {subtitle && <p className="mb-1 text-sm font-medium text-ink-faint">{subtitle}</p>}
        <h1 className="text-3xl sm:text-4xl font-bold text-ink font-display">
          {title}
        </h1>
      </div>
      {action}
    </div>
  )
}

// Header for a group of cards that sits directly on the page background.
export function SectionHeader({ title, doodle, action, className = '' }) {
  return (
    <div className={`flex items-center justify-between gap-3 ${className}`}>
      <h2 className="text-lg font-bold tracking-tight text-ink">
        {title}
      </h2>
      {action}
    </div>
  )
}

// A single figure with its label. The number is the loud part: clean sans,
// tabular numerals, strong weight. `tone` colors only the value.
const STAT_TONES = {
  ink:    'text-ink',
  income: 'text-sage-600',
  spend:  'text-spend-600',
  bills:  'text-peach-600',
  blue:   'text-blue-600',
}

export function StatTile({ label, value, sub, tone = 'ink', size = 'md', className = '' }) {
  const valueSize = size === 'lg'
    ? 'text-3xl sm:text-4xl'
    : size === 'sm' ? 'text-lg' : 'text-2xl'
  return (
    <div className={`min-w-0 ${className}`}>
      <p className="text-xs font-medium text-ink-faint">{label}</p>
      <p className={`${valueSize} font-bold tracking-tight tnum mt-1 ${STAT_TONES[tone] || STAT_TONES.ink}`}>
        {value}
      </p>
      {sub && <p className="text-xs text-ink-faint mt-1">{sub}</p>}
    </div>
  )
}

export default SectionHeader
