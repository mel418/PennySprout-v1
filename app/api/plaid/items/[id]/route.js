import { currentUser } from '@clerk/nextjs/server'
import { plaid, plaidEnabled, plaidErrorCode } from '@/lib/plaid'
import { getPlaidItemWithToken, deletePlaidItem } from '@/lib/plaidItemStorage'
import { checkWriteLimit } from '@/lib/rateLimit'
import { supabase } from '@/lib/supabase'

// DELETE /api/plaid/items/[id] — disconnect a bank. Not Pro-gated: someone
// whose subscription lapsed must still be able to disconnect a paused
// connection.
//
// Body: { deleteTransactions?: boolean }. Default false — the synced
// transactions are the user's financial history and Plaid's cursor has
// already moved past them, so they can never be pulled again once deleted.
// Deleting the row here (rather than leaving a tombstone, unlike the
// pause/reap cron path) is intentional: this is a direct, user-initiated
// "remove this connection," not a background billing cleanup, so there's no
// reason to keep it around — plaid_item_id ON DELETE SET NULL on
// transactions means any kept rows just lose their live-connection link.
export async function DELETE(request, { params }) {
  try {
    const user = await currentUser()
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

    if (!plaidEnabled) {
      return Response.json({ error: 'Bank connections are not configured' }, { status: 503 })
    }

    const blocked = await checkWriteLimit(user.id)
    if (blocked) return blocked

    const { id } = await params
    const { deleteTransactions } = await request.json().catch(() => ({}))

    const item = await getPlaidItemWithToken(user.id, id)
    if (!item) return Response.json({ error: 'Bank connection not found' }, { status: 404 })

    // Remove at Plaid FIRST — if this fails, the connection stays visible
    // and the user can retry, instead of losing local state while Plaid
    // still thinks the Item (and its billing) is live.
    try {
      await plaid.itemRemove({ access_token: item.accessToken })
    } catch (error) {
      const code = plaidErrorCode(error)
      // ITEM_NOT_FOUND: already removed at Plaid (e.g. a retry after a
      // previous call succeeded but the response was lost) — fine to
      // continue and clean up locally.
      if (code !== 'ITEM_NOT_FOUND') {
        console.error('Plaid /item/remove failed:', code || error)
        return Response.json({ error: 'Failed to disconnect at Plaid. Please try again.' }, { status: 502 })
      }
    }

    if (deleteTransactions) {
      const { error } = await supabase
        .from('transactions')
        .delete()
        .eq('user_id', user.id)
        .eq('plaid_item_id', id)
      if (error) {
        console.error('Error deleting Plaid-synced transactions on disconnect:', error)
        // The connection is already gone at Plaid and locally below; don't
        // fail the whole disconnect over a cleanup step the user can retry
        // by re-deleting individual transactions if it matters to them.
      }
    }

    await deletePlaidItem(user.id, id)

    return Response.json({ success: true })
  } catch (error) {
    console.error('Error disconnecting Plaid item:', error)
    return Response.json({ error: 'Failed to disconnect bank' }, { status: 500 })
  }
}
