'use client'

// The single loading spinner. Centered by default; pass className to adjust
// the surrounding padding (e.g. "min-h-screen items-center" for full-page).
export default function Spinner({ className = 'p-12' }) {
  return (
    <div className={`flex justify-center items-center ${className}`} role="status" aria-label="Loading">
      <div className="animate-spin rounded-full h-8 w-8 border-2 border-sage-500 border-t-transparent" />
    </div>
  )
}
