import { currentUser } from '@clerk/nextjs/server'
import { plaid, plaidEnabled, plaidErrorCode } from '@/lib/plaid'
import { requirePro } from '@/lib/planGate'
import { checkWriteLimit } from '@/lib/rateLimit'
import { createPlaidItem, upsertPlaidAccounts, plaidAccountsToRows } from '@/lib/plaidItemStorage'

// POST /api/plaid/exchange — exchanges a Link `public_token` (short-lived,
// safe to have touched the browser) for a long-lived `access_token` (never
// safe to have touched the browser) and saves the new connection.
//
// This route is only reached for a NEW connection. Update-mode Link
// sessions (re-authenticating an existing Item) don't produce a new
// public_token to exchange — Plaid updates the existing Item in place, and
// the client just needs to tell us syncing can resume (handled by the
// "Sync now" flow after Link's onSuccess in update mode).
export async function POST(request) {
  try {
    const user = await currentUser()
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

    if (!plaidEnabled) {
      return Response.json({ error: 'Bank connections are not configured' }, { status: 503 })
    }

    const gate = await requirePro(user.id)
    if (gate) return gate

    const blocked = await checkWriteLimit(user.id)
    if (blocked) return blocked

    const { public_token, institution } = await request.json()
    if (!public_token) {
      return Response.json({ error: 'Missing public_token' }, { status: 400 })
    }

    const { data: exchangeData } = await plaid.itemPublicTokenExchange({ public_token })
    const { access_token: accessToken, item_id: itemId } = exchangeData

    const itemRowId = await createPlaidItem(user.id, {
      itemId,
      accessToken,
      institutionId: institution?.institution_id,
      institutionName: institution?.name,
    })

    // Best-effort: the connection is already saved even if fetching account
    // details fails, since the accessToken is what matters for syncing.
    try {
      const { data: accountsData } = await plaid.accountsGet({ access_token: accessToken })
      await upsertPlaidAccounts(user.id, itemRowId, plaidAccountsToRows(accountsData.accounts))
    } catch (error) {
      console.error('Error fetching Plaid accounts after link:', plaidErrorCode(error) || error)
    }

    return Response.json({ item: { id: itemRowId, institutionName: institution?.name || null } })
  } catch (error) {
    console.error('Error exchanging Plaid public token:', plaidErrorCode(error) || error)
    return Response.json({ error: 'Failed to finish connecting your bank' }, { status: 500 })
  }
}
