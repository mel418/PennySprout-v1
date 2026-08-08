'use client'
import { X } from 'lucide-react'
import { useDialog } from '../useDialog'

// Shared modal shell. Accessibility (focus trap, Escape, scroll lock, focus
// restore) comes from useDialog; `onClose` must be referentially stable.
//
// Mobile-first shape: on phones the panel is a bottom sheet — full width,
// pinned to the bottom edge, rounded on top only, and capped at 88vh so the
// close button and the first rows are both within thumb reach. From `sm` up it
// becomes a centered dialog. A drag-handle bar marks the sheet affordance.
export default function Modal({ isOpen, onClose, title, subtitle, ariaLabel, children }) {
  const dialogRef = useDialog(isOpen, onClose)
  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 bg-overlay z-50 flex items-end sm:items-center justify-center sm:p-4 animate-overlay-in"
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel || title}
        className="bg-surface w-full sm:max-w-lg flex flex-col animate-modal-in shadow-lift
          border border-line border-b-0 sm:border-b
          rounded-t-[var(--radius-xl)] sm:rounded-[var(--radius-xl)]
          max-h-[88vh] sm:max-h-[80vh]"
        onClick={e => e.stopPropagation()}
      >
        {/* Sheet grab handle — phones only */}
        <span aria-hidden="true" className="sm:hidden mx-auto mt-2.5 h-1 w-10 rounded-full bg-line" />

        <div className="flex justify-between items-start gap-3 p-5 sm:p-6 border-b border-line">
          <div className="min-w-0">
            <h3 className="text-lg sm:text-xl font-semibold text-ink truncate">{title}</h3>
            {subtitle && <p className="text-sm text-ink-soft mt-1">{subtitle}</p>}
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="flex h-11 w-11 -mr-2 -mt-1 flex-shrink-0 items-center justify-center rounded-[var(--radius-sm)]
              text-ink-faint hover:text-ink hover:bg-surface-hover transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
