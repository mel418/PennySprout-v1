import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'

// Default-deny for the API: every /api/* route requires a signed-in session
// at the middleware layer, so a future route can't ship unauthenticated by
// forgetting its own check. Routes still call currentUser() for the user id —
// that's data access, this is the gate.
const isApiRoute = createRouteMatcher(['/api(.*)'])

// Stripe webhooks and the cron scheduler call these server-to-server with no
// Clerk session; each route authenticates itself instead (Stripe signature
// check / CRON_SECRET bearer token).
const isWebhookRoute = createRouteMatcher(['/api/billing/webhook', '/api/cron(.*)'])

export default clerkMiddleware(async (auth, req) => {
  if (isApiRoute(req) && !isWebhookRoute(req)) {
    const { userId } = await auth()
    if (!userId) {
      // Explicit JSON 401 (auth.protect() would redirect/404 here) — the
      // client fetch handlers key off this status to show "session expired".
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }
})

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
}
