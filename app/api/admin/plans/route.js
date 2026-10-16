import { clerkClient } from '@clerk/nextjs/server'
import { requireAdmin } from '@/lib/admin'
import { listPlanOverrides, setPlanOverride } from '@/lib/subscriptionStorage'

// Admin-only plan management (see lib/admin.js). Plans set here are manual
// overrides that beat Stripe — see the plan_overrides migration.

function toRow(user, overrides) {
  const primary = user.emailAddresses.find(e => e.id === user.primaryEmailAddressId)
    || user.emailAddresses[0]
  return {
    userId: user.id,
    email: primary?.emailAddress || null,
    name: [user.firstName, user.lastName].filter(Boolean).join(' ') || null,
    override: overrides.get(user.id) || null,
  }
}

// GET /api/admin/plans?q=<text> — users matching an email/name search (all
// recent users when empty), each with their manual override if any.
export async function GET(request) {
  try {
    const { response } = await requireAdmin()
    if (response) return response

    const q = new URL(request.url).searchParams.get('q')?.trim() || undefined
    const client = await clerkClient()
    const { data: users } = await client.users.getUserList({
      query: q,
      limit: 50,
      orderBy: '-created_at',
    })

    const overrides = await listPlanOverrides(users.map(u => u.id))
    return Response.json({ users: users.map(u => toRow(u, overrides)) })
  } catch (error) {
    console.error('Error listing users for admin:', error)
    return Response.json({ error: 'Failed to load users' }, { status: 500 })
  }
}

// PUT /api/admin/plans { userId, plan: 'free' | 'pro' | null }
// null clears the override, handing the user back to their Stripe state.
export async function PUT(request) {
  try {
    const { user: admin, response } = await requireAdmin()
    if (response) return response

    const { userId, plan } = await request.json().catch(() => ({}))
    if (typeof userId !== 'string' || !userId) {
      return Response.json({ error: 'userId is required' }, { status: 400 })
    }
    if (plan !== 'free' && plan !== 'pro' && plan !== null) {
      return Response.json({ error: "plan must be 'free', 'pro', or null" }, { status: 400 })
    }

    // Guard against typos creating orphan rows for users that don't exist.
    const client = await clerkClient()
    try {
      await client.users.getUser(userId)
    } catch {
      return Response.json({ error: 'User not found' }, { status: 404 })
    }

    await setPlanOverride({ userId, plan, grantedBy: admin.id })
    return Response.json({ userId, override: plan })
  } catch (error) {
    console.error('Error setting plan override:', error)
    return Response.json({ error: 'Failed to update plan' }, { status: 500 })
  }
}
