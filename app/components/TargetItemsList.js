'use client'
import { ShoppingBag, ChevronDown, Check } from 'lucide-react'
import { moneyExact } from '@/lib/format'

// Small icon+chevron button that toggles a matched Target transaction's
// item list. Only rendered when the caller already knows the transaction
// has matched items (via useTargetPurchaseMatches().matchedIds).
export function TargetItemsToggle({ description, isOpen, onClick, className = '' }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-expanded={isOpen}
      aria-label={isOpen ? `Hide items for ${description}` : `View items for ${description}`}
      title="View what you bought"
      className={`flex h-11 w-11 flex-shrink-0 items-center justify-center gap-0.5 rounded-[var(--radius-sm)]
        transition-colors hover:bg-sage-50 sm:h-9 sm:w-9
        ${isOpen ? 'text-sage-700' : 'text-sage-600 hover:text-sage-700'} ${className}`}
    >
      <ShoppingBag className="h-4 w-4" />
      <ChevronDown className={`h-3 w-3 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
    </button>
  )
}

// Thumbnails come straight from Target's own public CDN (target.scene7.com)
// — nothing is hosted by this app.
//
// `date` and `matched` are optional per item: the transaction-scoped lists
// (Files/Analysis/Calendar "view items" toggles) omit them since the date
// is implied by the transaction they're attached to; the import review
// modal (one CSV spanning many days) sets both.
export function TargetItemsList({ items, isLoading }) {
  if (isLoading) return <p className="text-sm text-ink-faint">Loading items…</p>
  if (!items || items.length === 0) return <p className="text-sm text-ink-faint">No items found.</p>

  return (
    <ul className="space-y-2.5">
      {items.map(item => {
        const meta = [item.date, item.qty > 1 ? `Qty ${item.qty}` : null].filter(Boolean).join(' · ')
        return (
          <li key={item.id} className="flex items-center gap-3">
            {item.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={item.imageUrl}
                alt=""
                className="h-11 w-11 flex-shrink-0 rounded-[var(--radius-sm)] bg-surface object-cover"
                loading="lazy"
              />
            ) : (
              <div className="h-11 w-11 flex-shrink-0 rounded-[var(--radius-sm)] bg-surface" aria-hidden="true" />
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm text-ink">{item.itemName}</p>
              {meta && <p className="text-xs tnum text-ink-faint">{meta}</p>}
            </div>
            <div className="flex flex-shrink-0 items-center gap-1.5">
              {item.matched && (
                <span title="Linked to a transaction" className="text-sage-600">
                  <Check className="h-3.5 w-3.5" aria-hidden="true" />
                  <span className="sr-only">Linked to a transaction</span>
                </span>
              )}
              <span className="text-sm font-medium tnum text-ink-soft">{moneyExact(item.lineTotal)}</span>
            </div>
          </li>
        )
      })}
    </ul>
  )
}
