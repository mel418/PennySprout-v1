import { currentUser, clerkClient } from '@clerk/nextjs/server'
import { supabase } from '@/lib/supabase'
import { stripe } from '@/lib/stripe'
import { getSubscription } from '@/lib/subscriptionStorage'
import { plaid, plaidEnabled, plaidErrorCode } from '@/lib/plaid'
import { getAllItemsForUser } from '@/lib/plaidItemStorage'

// DELETE /api/account — self-serve, immediate account deletion.
// Order matters:
//   1. Cancel any active Stripe subscription (so nobody is billed for a
//      product they can no longer sign in to).
//   2. Disconnect every connected bank at Plaid (so nobody keeps paying for
//      — or Plaid keeps billing for — an Item whose access token is about
//      to be deleted and unrecoverable).
//   3. Delete every Supabase row the user owns.
//   4. Delete the Clerk user last — if an earlier step fails, the user can
//      still sign in and retry, instead of being locked out with data left
//      behind.
// The body must be { confirm: "DELETE" } — a deliberate speed bump so no
// client bug can wipe an account with a stray fetch.

// Every table that stores user data, in child-before-parent order.
const USER_TABLES = [
  'transactions',
  'budgets',
  'goals',
  'email_log',
  'api_usage',
  'subscriptions',
  'plaid_accounts',
  'plaid_items',
  'user_files',
]

export async function DELETE(request) {
  try {
    const user = await currentUser()
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

    const { confirm } = await request.json().catch(() => ({}))
    if (confirm !== 'DELETE') {
      return Response.json({ error: 'Confirmation required' }, { status: 400 })
    }

    // 1. Stop billing first.
    if (stripe) {
      try {
        const sub = await getSubscription(user.id)
        if (sub?.stripe_subscription_id && ['active', 'trialing', 'past_due'].includes(sub.status)) {
          await stripe.subscriptions.cancel(sub.stripe_subscription_id)
        }
      } catch (error) {
        // A missing/already-canceled subscription must not block deletion.
        console.error('Error canceling subscription during account deletion:', error)
      }
    }

    // 2. Disconnect every bank at Plaid BEFORE the rows go — once plaid_items
    //    is deleted below, the access tokens are gone for good and the Items
    //    would stay live (and billable) at Plaid forever with no way to
    //    remove them. Non-blocking, matching the Stripe step above: an
    //    already-removed Item or a Plaid outage must not lock a user out of
    //    deleting their own account. A failure here is a real orphan that
    //    costs money, so it's logged loudly rather than silently swallowed.
    if (plaidEnabled) {
      try {
        const items = await getAllItemsForUser(user.id)
        for (const item of items) {
          await plaid.itemRemove({ access_token: item.accessToken }).catch(error => {
            console.error(
              'Plaid /item/remove failed during account deletion (orphaned Item, will keep billing at Plaid):',
              plaidErrorCode(error) || error
            )
          })
        }
      } catch (error) {
        console.error('Error listing Plaid items during account deletion:', error)
      }
    }

    // 3. Purge all Supabase data. Any failure aborts before Clerk deletion.
    for (const table of USER_TABLES) {
      const { error } = await supabase.from(table).delete().eq('user_id', user.id)
      if (error) {
        console.error(`Error deleting from ${table} during account deletion:`, error)
        return Response.json(
          { error: 'Deletion failed partway — your login still works. Please try again or contact support.' },
          { status: 500 }
        )
      }
    }

    // 4. Remove the login itself.
    const client = await clerkClient()
    await client.users.deleteUser(user.id)

    return Response.json({ success: true })
  } catch (error) {
    console.error('Error deleting account:', error)
    return Response.json({ error: 'Failed to delete account' }, { status: 500 })
  }
}
