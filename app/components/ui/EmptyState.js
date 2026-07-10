'use client'

// Shared empty state: centered icon, title, supporting copy, optional action.
export default function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div className="bg-surface border border-line rounded-2xl shadow-sm text-center p-12">
      {Icon && <Icon className="mx-auto h-12 w-12 text-sage-300 mb-4" aria-hidden="true" />}
      <h3 className="text-base font-semibold text-ink mb-1">{title}</h3>
      {description && <p className="text-sm text-ink-soft max-w-sm mx-auto">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}
