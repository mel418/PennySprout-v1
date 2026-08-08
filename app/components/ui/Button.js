'use client'

// ─── The one button ──────────────────────────────────────────────────────────
//
// Every clickable action in the app should use `Button`, or `buttonClass()`
// when the element has to be an <a>, <label> (file inputs), or next/link.
// That keeps radius, padding, touch target, focus ring, and disabled behaviour
// identical everywhere instead of drifting per screen.
//
// Touch targets: `md` is 44px tall and `sm` is 36px with generous horizontal
// padding — comfortable one-handed on a phone. Icon-only buttons should use
// IconButton, which guarantees a 44px hit area even around a 16px glyph.

const VARIANTS = {
  // Deep Sprout fill — the single primary action on a screen
  primary:   'bg-sage-600 hover:bg-sage-700 active:bg-sage-800 text-white shadow-xs',
  // Outlined — secondary actions that still deserve a border
  secondary: 'bg-surface border border-sage-300 text-sage-700 hover:bg-sage-50',
  // Pastel wash — tertiary actions inside cards
  soft:      'bg-sage-50 text-sage-700 hover:bg-sage-100',
  // No chrome until hover — dense toolbars, inline links
  ghost:     'text-ink-soft hover:text-ink hover:bg-surface-hover',
  // Gentle heads-up (over budget, duplicate found) — butter, never alarm red
  caution:   'bg-butter-500 hover:bg-butter-600 text-ink shadow-xs',
  // Genuinely destructive only: delete account, delete file, delete row
  danger:    'bg-danger-600 hover:opacity-90 text-white shadow-xs',
}

const SIZES = {
  sm: 'text-sm px-3.5 py-2 min-h-9 gap-1.5 rounded-[var(--radius-sm)]',
  md: 'text-sm px-5 py-2.5 min-h-11 gap-2 rounded-[var(--radius-md)]',
  lg: 'text-base px-6 py-3 min-h-12 gap-2 rounded-[var(--radius-md)]',
}

export function buttonClass({ variant = 'primary', size = 'md', full = false, className = '' } = {}) {
  return [
    'inline-flex items-center justify-center font-semibold whitespace-nowrap',
    'transition-all duration-200 cursor-pointer select-none',
    'disabled:opacity-45 disabled:cursor-not-allowed disabled:pointer-events-none',
    SIZES[size] || SIZES.md,
    VARIANTS[variant] || VARIANTS.primary,
    full ? 'w-full' : '',
    className,
  ].filter(Boolean).join(' ')
}

export default function Button({
  variant = 'primary',
  size = 'md',
  full = false,
  className = '',
  type = 'button',
  children,
  ...props
}) {
  return (
    <button type={type} className={buttonClass({ variant, size, full, className })} {...props}>
      {children}
    </button>
  )
}

// Icon-only control. `label` is required — an icon is never the only signal,
// so it always carries an accessible name and a tooltip.
export function IconButton({ label, tone = 'default', className = '', children, ...props }) {
  const TONES = {
    default: 'text-ink-faint hover:text-ink hover:bg-surface-hover',
    sage:    'text-ink-faint hover:text-sage-700 hover:bg-sage-50',
    danger:  'text-ink-faint hover:text-danger-600 hover:bg-danger-50',
  }
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={`inline-flex items-center justify-center h-11 w-11 sm:h-9 sm:w-9 flex-shrink-0
        rounded-[var(--radius-sm)] transition-colors ${TONES[tone] || TONES.default} ${className}`}
      {...props}
    >
      {children}
    </button>
  )
}
