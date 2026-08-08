'use client'

// The single loading spinner: a sage ring on an ivory track, so even the wait
// state stays on-palette. Centered by default; pass className to adjust the
// surrounding padding (e.g. "min-h-screen" for full-page).
export default function Spinner({ className = 'p-12', size = 'md' }) {
  const dim = size === 'sm' ? 'h-4 w-4 border-2' : size === 'lg' ? 'h-10 w-10 border-[3px]' : 'h-8 w-8 border-2'
  return (
    <div className={`flex justify-center items-center ${className}`} role="status" aria-label="Loading">
      <div
        className={`animate-spin rounded-full ${dim} border-t-transparent`}
        style={{ borderColor: 'var(--sage-400)', borderTopColor: 'transparent' }}
      />
    </div>
  )
}
