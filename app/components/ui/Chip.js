'use client'

import { categoryColor, categoryTint } from '@/lib/categories'

// ─── Chips & pills ───────────────────────────────────────────────────────────
//
// CategoryChip is the single way a spending category is labelled anywhere in
// the app: a pastel wash of that category's semantic color, a solid dot, and
// the category NAME in ink. The name is always present — color alone never
// identifies a category, which keeps the system usable for color-blind users
// and consistent between the dashboard, calendar, budgets, and AI answers.

export function CategoryChip({ category, className = '', size = 'md' }) {
  const color = categoryColor(category)
  const pad = size === 'sm' ? 'px-2 py-0.5 text-[11px] gap-1.5' : 'px-2.5 py-1 text-xs gap-1.5'
  return (
    <span
      className={`inline-flex items-center rounded-full font-medium text-ink ${pad} ${className}`}
      style={{ backgroundColor: categoryTint(category, 0.16) }}
    >
      <span
        className="h-2 w-2 rounded-full flex-shrink-0"
        style={{ backgroundColor: color }}
        aria-hidden="true"
      />
      <span className="truncate">{category}</span>
    </span>
  )
}

// Generic tone pill for statuses and metadata (account name, plan, counts).
const PILL_TONES = {
  sage:     'bg-sage-50 text-sage-700',
  blush:    'bg-spend-100 text-spend-600',
  peach:    'bg-peach-50 text-peach-600',
  butter:   'bg-butter-50 text-butter-600',
  blue:     'bg-blue-50 text-blue-600',
  lavender: 'bg-lavender-50 text-lavender-600',
  neutral:  'bg-surface-2 text-ink-soft',
  danger:   'bg-danger-50 text-danger-600',
}

export function Pill({ tone = 'neutral', className = '', children, ...props }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium
      ${PILL_TONES[tone] || PILL_TONES.neutral} ${className}`}
      {...props}
    >
      {children}
    </span>
  )
}

// A tappable suggestion / filter chip — used by Ask Penny's prompts.
export function ActionChip({ onClick, disabled, className = '', children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center gap-1.5 rounded-full border border-sage-200 bg-surface
        px-3.5 py-2 min-h-9 text-sm text-ink-soft text-left
        hover:bg-sage-50 hover:border-sage-300 hover:text-ink
        transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
    >
      {children}
    </button>
  )
}
