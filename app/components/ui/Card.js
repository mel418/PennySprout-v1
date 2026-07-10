'use client'

// Top-level surface card: white, 1px line border, 16px radius, soft shadow.
// Optional header row with icon, title, a right-aligned hint, and an optional
// action (e.g. an "Add" button) at the far right.
export default function Card({ children, className = '', title, hint, icon: Icon, action }) {
  return (
    <div className={`bg-surface border border-line rounded-2xl shadow-sm ${className}`}>
      {title && (
        <div className="flex items-center justify-between px-5 pt-4 pb-3">
          <div className="flex items-center gap-2">
            {Icon && <Icon className="h-4 w-4 text-sage-500" aria-hidden="true" />}
            <h3 className="text-sm font-semibold text-ink">{title}</h3>
          </div>
          {(hint || action) && (
            <div className="flex items-center gap-3">
              {hint && <span className="text-xs text-ink-faint">{hint}</span>}
              {action}
            </div>
          )}
        </div>
      )}
      {children}
    </div>
  )
}
