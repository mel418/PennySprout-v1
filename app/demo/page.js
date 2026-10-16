'use client'
import { useState, useEffect } from 'react'
import AppShell from '../components/AppShell'
import Spinner from '../components/ui/Spinner'
import { installDemoApi } from '../components/demoApi'

// GET /demo — the full app on sample data, no sign-in required. The fake API
// is installed in an effect, and the shell only mounts once it's in place:
// child effects run before parent effects, so mounting the shell first would
// let the data hooks fire real /api requests (and get 401s) before the swap.
export default function DemoPage() {
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const uninstall = installDemoApi()
    setReady(true)
    return uninstall
  }, [])

  if (!ready) return <Spinner className="min-h-screen bg-app" />

  return <AppShell displayName="Demo user" userId="demo-user" demo />
}
