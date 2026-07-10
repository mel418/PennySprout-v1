'use client'
import { useEffect, useRef } from 'react'

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])'

// Accessibility plumbing for modal dialogs: Escape closes, focus moves into
// the dialog on open, Tab is trapped inside while open, focus returns to the
// opener on close, and background scroll is locked. Attach the returned ref
// to the dialog panel and give it role="dialog" aria-modal="true".
//
// `onClose` must be referentially stable (useCallback) — it's an effect
// dependency, and an inline arrow would re-run the setup on every render.
export function useDialog(isOpen, onClose) {
  const ref = useRef(null)

  useEffect(() => {
    if (!isOpen) return
    const node = ref.current
    const previouslyFocused = document.activeElement

    const focusables = node ? node.querySelectorAll(FOCUSABLE) : []
    if (focusables.length) focusables[0].focus()

    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
      } else if (e.key === 'Tab' && node) {
        // Cycle focus within the dialog (offsetParent filters hidden elements).
        const els = [...node.querySelectorAll(FOCUSABLE)].filter(el => el.offsetParent !== null)
        if (!els.length) return
        const first = els[0]
        const last = els[els.length - 1]
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault()
          last.focus()
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault()
          first.focus()
        }
      }
    }

    document.addEventListener('keydown', onKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
      previouslyFocused?.focus?.()
    }
  }, [isOpen, onClose])

  return ref
}
