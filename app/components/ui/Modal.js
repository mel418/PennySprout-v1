'use client'
import { X } from 'lucide-react'
import { useDialog } from '../useDialog'

// Shared modal shell: dimmed overlay (click to close), centered panel capped
// at 80vh, header with title/subtitle and a close button. Accessibility
// (focus trap, Escape, scroll lock, focus restore) comes from useDialog.
// `onClose` must be referentially stable (useCallback) — see useDialog.
export default function Modal({ isOpen, onClose, title, subtitle, ariaLabel, children }) {
  const dialogRef = useDialog(isOpen, onClose)
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-overlay z-50 flex items-center justify-center p-4 animate-overlay-in" onClick={onClose}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel || title}
        className="bg-surface rounded-2xl shadow-sm border border-line w-full max-w-lg flex flex-col animate-modal-in"
        style={{ maxHeight: '80vh' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex justify-between items-start p-6 border-b border-line">
          <div className="min-w-0 mr-4">
            <h3 className="text-xl font-semibold text-ink truncate">{title}</h3>
            {subtitle && <p className="text-sm text-ink-soft mt-1">{subtitle}</p>}
          </div>
          <button onClick={onClose} aria-label="Close" className="text-ink-faint hover:text-ink flex-shrink-0 p-1">
            <X className="h-6 w-6" />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
