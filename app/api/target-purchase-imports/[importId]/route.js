import { currentUser } from '@clerk/nextjs/server'
import { getItemsForImport, deleteImport } from '@/lib/targetPurchaseStorage'

// GET /api/target-purchase-imports/:id — every item from one import, for
// the review modal (thumbnail, name, qty, price, date, matched status).
export async function GET(request, { params }) {
  try {
    const user = await currentUser()
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

    const { importId } = await params
    const items = await getItemsForImport(user.id, importId)
    return Response.json({ items })
  } catch (error) {
    console.error('Error fetching Target import items:', error)
    return Response.json({ error: 'Failed to load Target import items' }, { status: 500 })
  }
}

// DELETE /api/target-purchase-imports/:id — remove an import and its items
// (items cascade-delete via the import_id foreign key).
export async function DELETE(request, { params }) {
  try {
    const user = await currentUser()
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

    const { importId } = await params
    await deleteImport(user.id, importId)
    return Response.json({ success: true })
  } catch (error) {
    console.error('Error deleting Target import:', error)
    return Response.json({ error: 'Failed to delete Target import' }, { status: 500 })
  }
}
