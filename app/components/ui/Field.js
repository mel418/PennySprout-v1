'use client'

// ─── Form primitives ─────────────────────────────────────────────────────────
//
// Shared input styling so every form in the app has the same height, radius,
// focus ring, and disabled treatment. Forms are the least decorated surface in
// the product: clarity first, no doodles, no display font.
//
// Heights are 44px on touch (`min-h-11`) so fields and their buttons are
// comfortable one-handed, and the base font-size is 16px on mobile — anything
// smaller makes iOS Safari zoom the viewport on focus.

export const inputClass = (className = '') =>
  [
    'w-full min-h-11 rounded-[var(--radius-sm)] border border-line bg-surface',
    'px-3.5 py-2.5 text-base sm:text-sm text-ink placeholder:text-ink-faint',
    'transition-colors hover:border-sage-300 focus:border-sage-500 focus:outline-none',
    'disabled:opacity-60 disabled:cursor-not-allowed',
    className,
  ].filter(Boolean).join(' ')

export const selectClass = (className = '') =>
  [
    'w-full min-h-11 rounded-[var(--radius-sm)] border border-line bg-surface',
    'px-3 py-2.5 text-base sm:text-sm text-ink cursor-pointer',
    'transition-colors hover:border-sage-300 focus:border-sage-500 focus:outline-none',
    'disabled:opacity-60 disabled:cursor-not-allowed',
    className,
  ].filter(Boolean).join(' ')

export const labelClass = 'block text-xs font-semibold uppercase tracking-wide text-ink-faint mb-1.5'

// Label + control + optional hint, wired together. `htmlFor` is required so
// the label is always programmatically associated with its input.
export default function Field({ label, htmlFor, hint, className = '', children }) {
  return (
    <div className={className}>
      <label htmlFor={htmlFor} className={labelClass}>{label}</label>
      {children}
      {hint && <p className="mt-1.5 text-xs text-ink-faint">{hint}</p>}
    </div>
  )
}

// Inline status banner. `tone` maps to the semantic palette; `error` and
// `warning` also get role="alert" from the caller where appropriate.
const BANNER_TONES = {
  success: 'bg-sage-50 border-sage-200 text-sage-800',
  info:    'bg-blue-50 border-blue-200 text-blue-600',
  warning: 'bg-butter-50 border-butter-300 text-butter-600',
  error:   'bg-danger-50 border-danger-200 text-danger-600',
}

export function Banner({ tone = 'info', icon: Icon, className = '', children, ...props }) {
  return (
    <div
      className={`flex items-start gap-2.5 rounded-[var(--radius-md)] border px-4 py-3 text-sm
        ${BANNER_TONES[tone] || BANNER_TONES.info} ${className}`}
      {...props}
    >
      {Icon && <Icon className="h-4 w-4 mt-0.5 flex-shrink-0" aria-hidden="true" />}
      <div className="min-w-0">{children}</div>
    </div>
  )
}
