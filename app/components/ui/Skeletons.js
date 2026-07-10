'use client'

// Shimmering placeholder blocks (see .skeleton in globals.css). Skeletons
// mirror the rough shape of the content they replace, so the page doesn't
// jump when real data arrives.
export function Skeleton({ className = '' }) {
  return <div className={`skeleton ${className}`} aria-hidden="true" />
}

// Stat strip + chart-sized card + card grid — used by Overview, Calendar,
// and Analysis while transactions load.
export function DashboardSkeleton() {
  return (
    <div className="space-y-4" role="status" aria-label="Loading">
      <div className="bg-surface border border-line rounded-2xl shadow-sm p-5">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
          {[0, 1, 2, 3].map(i => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-7 w-24" />
            </div>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-surface border border-line rounded-2xl shadow-sm p-5 space-y-3">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-40 w-full" />
        </div>
        <div className="bg-surface border border-line rounded-2xl shadow-sm p-5 space-y-3">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-40 w-full" />
        </div>
      </div>
    </div>
  )
}

// Title + budget rows (label above a progress bar) + goal-card grid — used by
// the Budgets tab while budgets, goals, and transactions load.
export function BudgetsSkeleton() {
  return (
    <div className="space-y-4" role="status" aria-label="Loading">
      <div className="space-y-2">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-3 w-64" />
      </div>
      <div className="bg-surface border border-line rounded-2xl shadow-sm p-5 space-y-5">
        <Skeleton className="h-4 w-32" />
        {[0, 1, 2].map(i => (
          <div key={i} className="space-y-2">
            <div className="flex items-center justify-between">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-4 w-20" />
            </div>
            <Skeleton className="h-2 w-full rounded-full" />
          </div>
        ))}
      </div>
      <div className="bg-surface border border-line rounded-2xl shadow-sm p-5 space-y-3">
        <Skeleton className="h-4 w-28" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {[0, 1].map(i => (
            <div key={i} className="border border-line rounded-xl p-4 space-y-3">
              <Skeleton className="h-4 w-2/5" />
              <Skeleton className="h-2 w-full rounded-full" />
              <Skeleton className="h-8 w-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// Stacked row cards — used by My Files while the list loads.
export function ListSkeleton({ rows = 3 }) {
  return (
    <div className="space-y-3" role="status" aria-label="Loading">
      <Skeleton className="h-5 w-44" />
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="bg-surface border border-line rounded-2xl shadow-sm p-5 space-y-3">
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-3 w-2/3" />
        </div>
      ))}
    </div>
  )
}
