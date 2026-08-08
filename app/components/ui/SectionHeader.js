'use client'
import Doodle from './Doodle'

// ─── Headers & stat tiles ────────────────────────────────────────────────────
//
// Consistent page and section titling. This is where the display face and the
// doodle vocabulary are allowed to show up — a small botanical mark beside a
// heading, never behind the text and never near a number.

// Top-of-tab header: big title, one line of context, optional right-hand action.
export function PageHeader({ title, subtitle, doodle = 'sprig', action, className = '' }) {
  return (
    <div className={`flex items-end justify-between gap-3 flex-wrap ${className}`}>
      <div className="min-w-0">
        <h1 className="flex items-center gap-2 text-2xl sm:text-3xl font-bold tracking-tight text-ink font-display">
          {doodle && <Doodle name={doodle} className="h-6 w-6 text-sage-400 flex-shrink-0" />}
          {title}
        </h1>
        {subtitle && <p className="mt-1 text-sm sm:text-base text-ink-soft">{subtitle}</p>}
      </div>
      {action}
    </div>
  )
}

// Header for a group of cards that sits directly on the page background.
export function SectionHeader({ title, doodle, action, className = '' }) {
  return (
    <div className={`flex items-center justify-between gap-3 ${className}`}>
      <h2 className="flex items-center gap-1.5 text-base font-semibold text-ink">
        {doodle && <Doodle name={doodle} className="h-4 w-4 text-sage-400 flex-shrink-0" />}
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
      <p className="text-xs font-semibold uppercase tracking-wide text-ink-faint">{label}</p>
      <p className={`${valueSize} font-bold tracking-tight tnum mt-1 ${STAT_TONES[tone] || STAT_TONES.ink}`}>
        {value}
      </p>
      {sub && <p className="text-xs text-ink-faint mt-1">{sub}</p>}
    </div>
  )
}

export default SectionHeader
