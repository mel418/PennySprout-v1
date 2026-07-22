import { currentUser } from '@clerk/nextjs/server'
import { getUserFiles, saveUserFile, deleteUserFile, findFileByHash } from '@/lib/fileStorage'
import { insertTransactions } from '@/lib/transactionStorage'
import { checkBudgetAlerts } from '@/lib/budgetAlerts'

// GET /api/files — file METADATA only (name, dates, counts). Transaction data
// comes from /api/transactions now; this route used to ship every JSONB blob
// on every dashboard load.
export async function GET() {
  try {
    const user = await currentUser()

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const files = await getUserFiles(user.id)
    return Response.json({ files })
  } catch (error) {
    console.error('Error fetching files:', error)
    return Response.json({ error: 'Failed to fetch files' }, { status: 500 })
  }
}

// POST /api/files — save an uploaded statement: one metadata row in
// user_files plus one row per transaction in the transactions table.
export async function POST(request) {
  try {
    const user = await currentUser()

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const fileData = await request.json()
    if (!Array.isArray(fileData.transactions) || fileData.transactions.length === 0) {
      return Response.json({ error: 'No transactions provided' }, { status: 400 })
    }

    // Same file bytes already uploaded by this user? Block unless they've
    // explicitly confirmed via `force` (e.g. a corrected re-export that
    // happens to hash the same, or they just want the duplicate).
    if (fileData.contentHash && !fileData.force) {
      const existing = await findFileByHash(user.id, fileData.contentHash)
      if (existing) {
        return Response.json({ error: 'duplicate', existingFile: existing }, { status: 409 })
      }
    }

    const savedFile = await saveUserFile(user.id, fileData)

    try {
      await insertTransactions(user.id, savedFile.id, fileData.transactions)
    } catch (error) {
      // Don't leave a file row with no transactions behind — remove it so the
      // user can simply retry the upload.
      await deleteUserFile(user.id, savedFile.id).catch(() => {})
      throw error
    }

    // New data may have pushed a budget over its limit — email the user if so.
    // Awaited (serverless may freeze after the response) but never throws, so
    // a mail hiccup can't fail a successful upload.
    await checkBudgetAlerts(
      user.id,
      user.emailAddresses[0]?.emailAddress,
      fileData.transactions
    )

    return Response.json({ file: savedFile })
  } catch (error) {
    console.error('Error saving file:', error)
    return Response.json({ error: 'Failed to save file' }, { status: 500 })
  }
}
