'use client'
import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useUser } from '@clerk/nextjs'
import { ArrowLeft } from 'lucide-react'
import Spinner from '../../components/ui/Spinner'
import { inputClass, selectClass, Banner } from '../../components/ui/Field'

// Admin: set any user's plan by hand (family and friends, no Stripe). The
// page is only a convenience — /api/admin/plans enforces the admin role, so a
// non-admin who finds this URL just sees a "not available" message.
const OVERRIDE_LABELS = { '': 'Standard (Free)', pro: 'Pro (granted)', free: 'Free (forced)' }

export default function AdminPlansPage() {
  const { isSignedIn, isLoaded } = useUser()
  const [query, setQuery] = useState('')
  const [users, setUsers] = useState(null)
  const [error, setError] = useState(null)
  const [forbidden, setForbidden] = useState(false)
  const [savingId, setSavingId] = useState(null)

  const load = useCallback(async q => {
    setError(null)
    try {
      const res = await fetch(`/api/admin/plans?q=${encodeURIComponent(q)}`)
      if (res.status === 403) return setForbidden(true)
      if (!res.ok) throw new Error()
      setUsers((await res.json()).users)
    } catch {
      setError("Couldn't load users — try again.")
    }
  }, [])

  // Debounced search; also the initial load (empty query = newest users).
  useEffect(() => {
    if (!isSignedIn) return
    const t = setTimeout(() => load(query), 300)
    return () => clearTimeout(t)
  }, [isSignedIn, query, load])

  const setOverride = async (userId, value) => {
    setSavingId(userId)
    setError(null)
    try {
      const res = await fetch('/api/admin/plans', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, plan: value || null }),
      })
      if (!res.ok) throw new Error()
      const { override } = await res.json()
      setUsers(list => list.map(u => (u.userId === userId ? { ...u, override } : u)))
    } catch {
      setError("Couldn't update that plan — try again.")
    } finally {
      setSavingId(null)
    }
  }

  if (!isLoaded) return <Spinner className="min-h-screen bg-app" />

  if (!isSignedIn) {
    if (typeof window !== 'undefined') window.location.assign('/')
    return null
  }

  return (
    <div className="min-h-screen bg-app">
      <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
        <Link
          href="/settings"
          className="mb-8 inline-flex min-h-10 items-center gap-1.5 text-sm font-medium text-ink-soft transition-colors hover:text-sage-700"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Back to settings
        </Link>

        <h1 className="mb-1 text-2xl font-bold tracking-tight text-ink sm:text-3xl">Manage plans</h1>

        {forbidden ? (
          <p className="mt-4 text-sm text-ink-soft">This page isn&apos;t available for your account.</p>
        ) : (
          <>
            <p className="mb-6 text-sm text-ink-soft">
              &ldquo;Standard&rdquo; means no override: the user is Free unless they have a paid
              Stripe subscription. &ldquo;Pro (granted)&rdquo; gives Pro for free;
              &ldquo;Free (forced)&rdquo; blocks Pro even for a paying subscriber.
            </p>

            <label htmlFor="user-search" className="sr-only">Search users</label>
            <input
              id="user-search"
              type="search"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search by email or name"
              className={inputClass('mb-4')}
              autoComplete="off"
            />

            {error && <Banner tone="error" role="alert" className="mb-4">{error}</Banner>}

            {users === null && !error ? (
              <Spinner />
            ) : (
              <ul className="space-y-2">
                {(users || []).map(u => (
                  <li key={u.userId} className="card-soft flex flex-wrap items-center justify-between gap-3 p-4">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-ink">{u.email || u.userId}</p>
                      {u.name && <p className="truncate text-xs text-ink-faint">{u.name}</p>}
                    </div>
                    <select
                      aria-label={`Plan for ${u.email || u.userId}`}
                      value={u.override || ''}
                      disabled={savingId === u.userId}
                      onChange={e => setOverride(u.userId, e.target.value)}
                      className={selectClass('w-44')}
                    >
                      {Object.entries(OVERRIDE_LABELS).map(([value, label]) => (
                        <option key={value} value={value}>{label}</option>
                      ))}
                    </select>
                  </li>
                ))}
                {users?.length === 0 && <li className="text-sm text-ink-soft">No users found.</li>}
              </ul>
            )}
          </>
        )}
      </div>
    </div>
  )
}
