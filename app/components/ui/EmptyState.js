'use client'
import Doodle from './Doodle'

// ─── Empty states ────────────────────────────────────────────────────────────
//
// One of the two places the aesthetic is allowed to lead (the other is the
// landing page). A small botanical illustration, a short encouraging line, and
// exactly ONE clear action. No long explanations.
//
// `illustration` picks the botanical mark; `icon` is still accepted so existing
// lucide-based callers keep working unchanged.
export default function EmptyState({
  icon: Icon,
  illustration = 'sprout',
  title,
  description,
  action,
  className = '',
}) {
  return (
    <div className={`card-soft relative overflow-hidden text-center px-6 py-12 sm:py-14 ${className}`}>
      {/* Decorative marks, kept to the margins so they never sit behind text */}
      <span aria-hidden="true" className="pointer-events-none absolute inset-0">
        <Doodle name="sparkle" className="absolute left-6 top-7 h-4 w-4 text-sage-300 opacity-60" />
        <Doodle name="leaf" className="absolute right-7 top-10 h-5 w-5 text-sage-300 opacity-50 -rotate-12" />
        <Doodle name="dots" className="absolute bottom-6 left-1/2 -translate-x-1/2 h-4 w-8 text-sage-300 opacity-40" />
      </span>

      <div className="relative mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-[var(--radius-md)] bg-lime">
        {Icon
          ? <Icon className="h-7 w-7 text-lime-ink" aria-hidden="true" />
          : <Doodle name={illustration} className="h-8 w-8 text-lime-ink" strokeWidth={1.7} />}
      </div>

      <h3 className="relative text-xl font-bold text-ink font-display">{title}</h3>
      {description && (
        <p className="relative mt-1.5 text-sm sm:text-base text-ink-soft max-w-sm mx-auto leading-relaxed">
          {description}
        </p>
      )}
      {action && <div className="relative mt-6">{action}</div>}
    </div>
  )
}
