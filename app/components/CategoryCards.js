'use client'
import { categoryColor, categoryTint } from '@/lib/categories'
import { money } from '@/lib/format'

// Category breakdown card grid, shared by Overview and the Analysis dashboard.
// `total` drives the percentage share; the widest bar is the largest category.
// Pass `onSelect` to make the cards clickable (Analysis drills into a modal).
//
// Restrained by design: this sits next to real spending figures, so the only
// decoration is the category's semantic color — as a dot, a bar, and a faint
// wash behind the dot. The name and the amount carry the meaning.
export default function CategoryCards({ categories, total, onSelect }) {
  if (categories.length === 0) return null
  const max = categories[0]?.amount || 1

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
      {categories.map(({ category, amount }) => {
        const color = categoryColor(category)
        const share = total > 0 ? Math.round((amount / total) * 100) : 0
        const inner = (
          <>
            <div className="mb-2.5 flex items-center justify-between gap-2">
              <span
                className="flex min-w-0 items-center gap-2 rounded-full px-2 py-1"
                style={{ backgroundColor: categoryTint(category, 0.14) }}
              >
                <span
                  className="h-2.5 w-2.5 flex-shrink-0 rounded-full"
                  style={{ backgroundColor: color }}
                  aria-hidden="true"
                />
                <span className="truncate text-sm font-medium text-ink">{category}</span>
              </span>
              <span className="flex-shrink-0 text-xs font-semibold tnum text-ink-faint">{share}%</span>
            </div>
            <p className="text-xl font-bold tnum text-ink">{money(amount)}</p>
            <div
              className="mt-2.5 h-1.5 overflow-hidden rounded-full"
              style={{ backgroundColor: 'var(--surface-2)' }}
            >
              <div
                className="animate-grow-x h-full rounded-full"
                style={{ width: `${Math.max(4, (amount / max) * 100)}%`, backgroundColor: color }}
              />
            </div>
          </>
        )
        const base = 'card-soft p-4 text-left'
        return onSelect ? (
          <button
            key={category}
            type="button"
            onClick={() => onSelect(category)}
            className={`${base} hover-lift transition-all hover:border-sage-300`}
          >
            {inner}
          </button>
        ) : (
          <div key={category} className={base}>{inner}</div>
        )
      })}
    </div>
  )
}
