import { currentUser } from '@clerk/nextjs/server'
import { getUserFiles, saveUserFile, deleteUserFile, findFileByHash } from '@/lib/fileStorage'
import { insertTransactions, findDuplicateTransactions } from '@/lib/transactionStorage'
import { checkBudgetAlerts } from '@/lib/budgetAlerts'
import { hashTransactionSet } from '@/lib/transactionHash'
import { matchUnmatchedItems } from '@/lib/targetPurchaseStorage'

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

    // Same transaction content already uploaded by this user? Computed from
    // the transactions themselves (not the raw file) so a CSV and a PDF of
    // the same statement — or the same statement re-exported — still match.
    // Blocked unless they've explicitly confirmed via `force`.
    const contentHash = hashTransactionSet(fileData.transactions)
    if (!fileData.force) {
      const existing = await findFileByHash(user.id, contentHash)
      if (existing) {
        return Response.json({ error: 'duplicate', existingFile: existing }, { status: 409 })
      }
    }

    // Catches PARTIAL overlap with existing data — e.g. two statements whose
    // billing cycles overlap by a few days, or the same account exported
    // twice with different date ranges. The whole-file hash above only
    // catches an exact re-upload of an IDENTICAL set of transactions; two
    // files that share just some rows hash differently and sail right past
    // it. Skipped once the client has already reviewed the matches and
    // resubmitted with its own decision about which rows to keep.
    if (!fileData.skipDuplicateCheck) {
      const duplicates = await findDuplicateTransactions(user.id, fileData.transactions)
      if (duplicates.length > 0) {
        return Response.json({ error: 'transaction-duplicates', duplicates }, { status: 409 })
      }
    }

    const savedFile = await saveUserFile(user.id, { ...fileData, contentHash })

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

    // This statement may contain "Target" charges that a previously-imported
    // purchase-item export couldn't match yet (no transaction existed for
    // them at import time). Re-run matching now that new transactions exist.
    // Never fails the upload — matching can always retry on the next import.
    await matchUnmatchedItems(user.id).catch(error => {
      console.error('Error matching Target purchases on upload:', error)
    })

    return Response.json({ file: savedFile })
  } catch (error) {
    console.error('Error saving file:', error)
    return Response.json({ error: 'Failed to save file' }, { status: 500 })
  }
}
