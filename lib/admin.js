// Admin role, stored in Clerk publicMetadata as { role: 'admin' }. Set it in
// the Clerk Dashboard (Users -> your user -> Public metadata). publicMetadata
// is readable by the client but writable only from the Dashboard or backend
// API, so a user cannot grant it to themselves.
import 'server-only'
import { currentUser } from '@clerk/nextjs/server'

export function isAdminUser(user) {
  return user?.publicMetadata?.role === 'admin'
}

// Resolves to { user } for an admin, or { response } with a ready-to-return
// 401/403 — same shape of use as requirePro in lib/planGate.js. 403 for a
// signed-in non-admin; routes deliberately don't hint that the endpoint exists.
export async function requireAdmin() {
  const user = await currentUser()
  if (!user) return { response: Response.json({ error: 'Unauthorized' }, { status: 401 }) }
  if (!isAdminUser(user)) return { response: Response.json({ error: 'Forbidden' }, { status: 403 }) }
  return { user }
}
