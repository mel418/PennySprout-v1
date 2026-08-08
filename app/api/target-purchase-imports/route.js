import { currentUser } from '@clerk/nextjs/server'
import { getImports } from '@/lib/targetPurchaseStorage'

// GET /api/target-purchase-imports — every Target CSV the user has
// imported, newest first. Drives the "Target Purchase Imports" list in the
// Files tab (mirrors /api/files for bank statements).
export async function GET() {
  try {
    const user = await currentUser()
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

    const imports = await getImports(user.id)
    return Response.json({ imports })
  } catch (error) {
    console.error('Error fetching Target imports:', error)
    return Response.json({ error: 'Failed to load Target imports' }, { status: 500 })
  }
}
