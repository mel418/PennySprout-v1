'use client'
import { categoryColor } from '@/lib/categories'
import { money } from '@/lib/format'

// Category breakdown card grid, shared by Overview and the Analysis dashboard.
// `total` drives the percentage share; the widest bar is the largest category.
// Pass `onSelect` to make the cards clickable (Analysis drills into a modal).
export default function CategoryCards({ categories, total, onSelect }) {
  if (categories.length === 0) return null
  const max = categories[0]?.amount || 1

  return (
    <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
      {categories.map(({ category, amount }) => {
        const color = categoryColor(category)
        const share = total > 0 ? Math.round((amount / total) * 100) : 0
        const inner = (
          <>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2 min-w-0">
                <span className="h-2.5 w-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                <span className="text-sm font-medium text-ink truncate">{category}</span>
              </div>
              <span className="text-xs text-ink-faint flex-shrink-0">{share}%</span>
            </div>
            <p className="text-lg font-bold text-ink">{money(amount)}</p>
            <div className="mt-2 h-1.5 rounded-full bg-surface-2 overflow-hidden">
              <div className="h-full rounded-full animate-grow-x" style={{ width: `${Math.max(4, (amount / max) * 100)}%`, backgroundColor: color }} />
            </div>
          </>
        )
        const base = 'bg-surface border border-line rounded-xl shadow-sm p-4 text-left'
        return onSelect ? (
          <button key={category} type="button" onClick={() => onSelect(category)}
            className={`${base} hover:border-sage-300 hover-lift transition-all`}>
            {inner}
          </button>
        ) : (
          <div key={category} className={base}>{inner}</div>
        )
      })}
    </div>
  )
}
