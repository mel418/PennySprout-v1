'use client'
import Doodle, { WashiTape } from './Doodle'

// ─── The surface card ────────────────────────────────────────────────────────
//
// Warm ivory paper, a 1px line border, 20px radius, and a very soft warm
// shadow (all from the .card-soft token in globals.css). Optional header row
// with a doodle or icon, title, right-aligned hint, and an action.
//
// Decoration is OPT-IN and used sparingly — a `tape` accent or a `doodle` in
// the header, never both, and never on the cards carrying the densest
// financial data. Everything decorative here is aria-hidden.
//
// `accent` tints the header strip with a pastel from the semantic palette;
// use it to reinforce meaning that's already stated in the title (savings,
// bills, goals), not for variety.
const ACCENTS = {
  none:     '',
  sage:     'bg-sage-50',
  blush:    'bg-spend-100',
  peach:    'bg-peach-50',
  butter:   'bg-butter-50',
  blue:     'bg-blue-50',
  lavender: 'bg-lavender-50',
}

export default function Card({
  children,
  className = '',
  title,
  hint,
  icon: Icon,
  doodle,
  action,
  accent = 'none',
  tape,          // 'sage' | 'blush' | 'peach' | 'butter' | 'lavender' | 'blue'
  as: Tag = 'div',
  ...props
}) {
  const hasHeader = Boolean(title)
  return (
    <Tag className={`card-soft relative ${tape ? 'mt-3' : ''} ${className}`} {...props}>
      {tape && <WashiTape tone={tape} className="-top-2 left-6 -rotate-3" />}

      {hasHeader && (
        <div className={`flex items-center justify-between gap-3 px-5 sm:px-6 pt-4 pb-3
          ${accent !== 'none' ? `${ACCENTS[accent]} rounded-t-[var(--radius-lg)]` : ''}`}>
          <div className="flex items-center gap-2 min-w-0">
            {doodle
              ? <Doodle name={doodle} className="h-4 w-4 text-sage-500 flex-shrink-0" />
              : Icon && <Icon className="h-4 w-4 text-sage-500 flex-shrink-0" aria-hidden="true" />}
            <h3 className="text-sm font-semibold text-ink truncate">{title}</h3>
          </div>
          {(hint || action) && (
            <div className="flex items-center gap-3 flex-shrink-0">
              {hint && <span className="text-xs text-ink-faint">{hint}</span>}
              {action}
            </div>
          )}
        </div>
      )}
      {children}
    </Tag>
  )
}

// Standard inner padding for card bodies that follow a header. Exported so
// screens stop guessing at px-5 pb-5 versus p-6.
export const CARD_BODY = 'px-5 sm:px-6 pb-5 sm:pb-6'
export const CARD_PAD = 'p-5 sm:p-6'
