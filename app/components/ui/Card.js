'use client'
import Doodle from './Doodle'

// ─── The surface card ────────────────────────────────────────────────────────
//
// A borderless white card floating on a diffuse shadow, 24px radius (all from
// the .card-soft token in globals.css). Optional header row with an icon (or
// doodle) in a tinted badge, title, right-aligned hint, and an action.
//
// `tape` is accepted for backwards compatibility but no longer rendered — the
// washi-tape accent belonged to the retired stationery theme.
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
  tape,          // retired; accepted so old callers don't leak it onto the DOM
  as: Tag = 'div',
  ...props
}) {
  const hasHeader = Boolean(title)
  return (
    <Tag className={`card-soft relative ${className}`} {...props}>

      {hasHeader && (
        <div className={`flex items-center justify-between gap-3 px-5 sm:px-6 pt-5 pb-3
          ${accent !== 'none' ? `${ACCENTS[accent]} rounded-t-[var(--radius-lg)]` : ''}`}>
          <div className="flex items-center gap-2.5 min-w-0">
            {(doodle || Icon) && (
              <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-sage-50">
                {doodle
                  ? <Doodle name={doodle} className="h-4 w-4 text-sage-600" />
                  : <Icon className="h-4 w-4 text-sage-600" aria-hidden="true" />}
              </span>
            )}
            <h3 className="text-[15px] font-semibold tracking-tight text-ink truncate">{title}</h3>
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
