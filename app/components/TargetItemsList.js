'use client'
import { ShoppingBag, ChevronDown } from 'lucide-react'
import { moneyExact } from '@/lib/format'

// Small icon+chevron button that toggles a matched Target transaction's
// item list. Only rendered when the caller already knows the transaction
// has matched items (via useTargetPurchaseMatches().matchedIds).
export function TargetItemsToggle({ description, isOpen, onClick, className = '' }) {
  return (
    <button
      onClick={onClick}
      aria-label={isOpen ? `Hide items for ${description}` : `View items for ${description}`}
      title="View what you bought"
      className={`p-1 flex-shrink-0 flex items-center gap-0.5 transition-colors ${isOpen ? 'text-sage-700' : 'text-sage-600 hover:text-sage-700'} ${className}`}
    >
      <ShoppingBag className="h-4 w-4" />
      <ChevronDown className={`h-3 w-3 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
    </button>
  )
}

// Thumbnails come straight from Target's own public CDN (target.scene7.com)
// — nothing is hosted by this app.
export function TargetItemsList({ items, isLoading }) {
  if (isLoading) return <p className="text-xs text-ink-faint">Loading items…</p>
  if (!items || items.length === 0) return <p className="text-xs text-ink-faint">No items found for this trip.</p>

  return (
    <div className="space-y-2">
      {items.map(item => (
        <div key={item.id} className="flex items-center gap-2.5">
          {item.imageUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={item.imageUrl}
              alt=""
              className="w-10 h-10 rounded-lg object-cover bg-surface flex-shrink-0"
              loading="lazy"
            />
          )}
          <div className="flex-1 min-w-0">
            <p className="text-xs text-ink truncate">{item.itemName}</p>
            {item.qty > 1 && <p className="text-[11px] text-ink-faint">Qty {item.qty}</p>}
          </div>
          <span className="text-xs text-ink-soft flex-shrink-0">{moneyExact(item.lineTotal)}</span>
        </div>
      ))}
    </div>
  )
}
