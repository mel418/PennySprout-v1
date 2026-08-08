'use client'

// ─── Progress indicators ─────────────────────────────────────────────────────
//
// One bar shape for budgets, savings goals, spending pace, and category share.
// Soft pastel fill in a recessed ivory track — a planner tracker, not a
// loading bar.
//
// Accessibility: the bar carries role="progressbar" with real min/max/now
// values and a text label, so the state is available without seeing the color.
// Callers must still print the numbers ("$420 / $500", "62%") next to it —
// color and width are never the only indicator.

export const PROGRESS_TONES = {
  sage:     'var(--sage-500)',
  deep:     'var(--sage-600)',
  blush:    'var(--spend-500)',
  peach:    'var(--peach-500)',
  butter:   'var(--butter-500)',
  blue:     'var(--blue-500)',
  lavender: 'var(--lavender-500)',
}

// Budget state → tone + non-color label + text class. Deliberately gentle:
// crossing a budget is "a little over", styled blush, not an alarm-red error.
export function budgetTone(ratio) {
  if (ratio >= 1)   return { tone: 'blush',  label: 'a little over', text: 'text-spend-600' }
  if (ratio >= 0.8) return { tone: 'butter', label: 'getting close', text: 'text-butter-600' }
  return { tone: 'sage', label: 'on track', text: 'text-sage-600' }
}

const SIZES = { sm: 'h-1.5', md: 'h-2.5', lg: 'h-3.5' }

export default function ProgressBar({
  value = 0,
  max = 100,
  tone = 'sage',
  size = 'md',
  label,
  // 0–1 position of a hairline reference mark (e.g. "typical pace by today")
  markerAt = null,
  markerLabel,
  animate = true,
  className = '',
}) {
  const safeMax = max > 0 ? max : 1
  const ratio = Math.max(0, Math.min(1, value / safeMax))
  const pct = Math.round(ratio * 100)
  const color = PROGRESS_TONES[tone] || tone

  return (
    <div
      className={`relative w-full rounded-full overflow-visible ${SIZES[size] || SIZES.md} ${className}`}
      style={{ backgroundColor: 'var(--surface-2)', boxShadow: 'var(--shadow-inset-well)' }}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={pct}
      aria-label={label}
    >
      <div className="absolute inset-0 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-[width] duration-500 ease-out ${animate ? 'animate-grow-x' : ''}`}
          style={{ width: `${Math.max(ratio > 0 ? 3 : 0, pct)}%`, backgroundColor: color }}
        />
      </div>
      {markerAt !== null && Number.isFinite(markerAt) && (
        <span
          aria-hidden="true"
          title={markerLabel}
          className="absolute -top-1 -bottom-1 w-px rounded-full"
          style={{ left: `${Math.max(0, Math.min(100, markerAt * 100))}%`, backgroundColor: 'var(--ink-faint)' }}
        />
      )}
    </div>
  )
}

// A goal's progress as a row of growth glyphs: 🌱 → 🌿 → 🌷. Decorative
// reinforcement of the percentage, so it's aria-hidden — the caller always
// shows the real numbers alongside.
export function GrowthTrail({ stage = 0, className = '' }) {
  const marks = ['🌱', '🌿', '🌷']
  return (
    <span aria-hidden="true" className={`inline-flex items-center gap-1 text-sm ${className}`}>
      {marks.map((m, i) => (
        <span key={m} className="contents">
          {i > 0 && <span className="text-ink-faint text-xs">→</span>}
          <span className={i < stage ? 'opacity-100' : 'opacity-30 grayscale'}>{m}</span>
        </span>
      ))}
    </span>
  )
}
