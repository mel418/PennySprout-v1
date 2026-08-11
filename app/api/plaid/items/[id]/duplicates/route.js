import { currentUser } from '@clerk/nextjs/server'
import { plaidEnabled } from '@/lib/plaid'
import { requirePro } from '@/lib/planGate'
import { getPlaidItems } from '@/lib/plaidItemStorage'
import { findDuplicateCandidatesForItem } from '@/lib/transactionStorage'

// GET /api/plaid/items/[id]/duplicates — scans this connection's ENTIRE
// synced history against manually uploaded transactions for likely
// duplicates (same date + amount). A regular sync only auto-hides matches
// against transactions newly added by THAT sync (see
// lib/plaidSyncEngine.js syncItem) — this full-history scan is the catch-all
// for anything that predates that (an old backfill from before auto-hide
// existed, or an upload added after the last sync). Returns candidate pairs
// only; nothing is hidden here — the client immediately follows up with
// POST /api/transactions/hide for every candidate found.
export async function GET(request, { params }) {
  try {
    const user = await currentUser()
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

    if (!plaidEnabled) {
      return Response.json({ error: 'Bank connections are not configured' }, { status: 503 })
    }

    const gate = await requirePro(user.id)
    if (gate) return gate

    const { id } = await params

    // Ownership check — findDuplicateCandidatesForItem itself scopes to
    // (user_id, plaid_item_id), so a foreign id just returns [], but a 404
    // here is a clearer signal than a silently-empty result.
    const items = await getPlaidItems(user.id)
    if (!items.some(item => item.id === id)) {
      return Response.json({ error: 'Bank connection not found' }, { status: 404 })
    }

    const candidates = await findDuplicateCandidatesForItem(user.id, id)
    return Response.json({ candidates })
  } catch (error) {
    console.error('Error scanning for duplicate transactions:', error)
    return Response.json({ error: 'Failed to scan for duplicates' }, { status: 500 })
  }
}
