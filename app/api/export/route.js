import { currentUser } from '@clerk/nextjs/server'
import { getTransactions } from '@/lib/transactionStorage'
import { serializeCsv } from '@/lib/csv'

// GET /api/export — every transaction the user has, as a CSV download.
// Data portability is both a trust promise ("your data is yours, take it
// anytime") and a GDPR/CCPA requirement. The columns mirror what we store —
// which, by design, is already de-identified (no account numbers or names).
export async function GET() {
  try {
    const user = await currentUser()
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

    const transactions = await getTransactions(user.id)

    const rows = [
      ['Date', 'Description', 'Amount', 'Category', 'Note'],
      ...transactions.map(t => [
        t['Date'] || '',
        t['Description'] || '',
        t['Amount'] ?? '',
        t['Category'] || '',
        t['Note'] || '',
      ]),
    ]

    const today = new Date().toISOString().slice(0, 10)
    return new Response(serializeCsv(rows), {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="pennysprout-transactions-${today}.csv"`,
      },
    })
  } catch (error) {
    console.error('Error exporting transactions:', error)
    return Response.json({ error: 'Failed to export transactions' }, { status: 500 })
  }
}
