'use client'
import { useEffect, useState } from 'react'
import { Sun, Moon } from 'lucide-react'

// Light/dark toggle. The inline script in layout.js applies the saved (or
// system) theme before first paint; this component just reflects and flips it.
// Rendered null until mounted so server and client markup can't disagree.
export default function ThemeToggle({ className = '' }) {
  const [isDark, setIsDark] = useState(null)

  useEffect(() => {
    setIsDark(document.documentElement.classList.contains('dark'))
  }, [])

  const toggle = () => {
    const next = !isDark
    setIsDark(next)
    document.documentElement.classList.toggle('dark', next)
    try { localStorage.setItem('theme', next ? 'dark' : 'light') } catch {}
  }

  if (isDark === null) return <div className="w-11 h-11" aria-hidden="true" />

  return (
    <button
      onClick={toggle}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={isDark ? 'Light mode' : 'Dark mode'}
      className={`flex h-11 w-11 items-center justify-center rounded-full text-ink-faint hover:text-ink hover:bg-surface-hover transition-colors ${className}`}
    >
      {isDark
        ? <Sun className="h-4 w-4" aria-hidden="true" />
        : <Moon className="h-4 w-4" aria-hidden="true" />}
    </button>
  )
}
