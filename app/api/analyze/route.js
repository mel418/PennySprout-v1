import { currentUser } from '@clerk/nextjs/server'
import Anthropic from '@anthropic-ai/sdk'
import { extractJson } from '@/lib/aiJson'
import { checkRateLimit } from '@/lib/rateLimit'
import { getPlan } from '@/lib/subscriptionStorage'
import { calcSpending, calcIncome, categoryTotals } from '@/lib/categories'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

export async function POST(request) {
  try {
    // Require a signed-in user. Without this, anyone could POST to this route and
    // run up Anthropic API charges on your account.
    const user = await currentUser()
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Auth alone doesn't cap Anthropic spend — enforce a per-user daily limit
    // (Pro subscribers get a higher ceiling).
    const plan = await getPlan(user.id)
    const { allowed, limit } = await checkRateLimit(user.id, 'analyze', plan)
    if (!allowed) {
      const upsell = plan === 'free' ? ' Upgrade to Pro for a higher daily limit.' : ''
      return Response.json(
        { error: `Daily analysis limit reached (${limit}/day). Try again tomorrow.${upsell}` },
        { status: 429 }
      )
    }

    // includeNotes: user-written transaction notes are PRIVATE by default and
    // only leave our server when the user explicitly opts in per analysis
    // (checkbox in the dashboard). Must be literally true, not merely truthy.
    const { transactions, includeNotes } = await request.json()
    const withNotes = includeNotes === true

    // The model doesn't need every raw transaction to give good insights, but
    // it DOES need accurate totals. So: compute the real aggregates in code
    // over ALL transactions, and send the model those plus the largest
    // individual transactions for texture. Previously this route silently
    // sliced to the first 50 rows — busy months got insights computed on a
    // truncated, unlabeled sample with wrong totals.
    const SAMPLE_SIZE = 80
    const sample = [...transactions]
      .sort((a, b) => Math.abs(parseFloat(b['Amount']) || 0) - Math.abs(parseFloat(a['Amount']) || 0))
      .slice(0, SAMPLE_SIZE)
      .map(t => ({
        date: t['Trans. Date'] || t['Date'],
        description: t['Description'],
        amount: parseFloat(t['Amount']) || 0,
        category: t['Category'] || 'Unknown',
        ...(withNotes && t['Note'] ? { note: String(t['Note']).slice(0, 500) } : {}),
      }))

    const aggregates = {
      transactionCount: transactions.length,
      totalSpending: Math.round(calcSpending(transactions) * 100) / 100,
      totalIncome: Math.round(calcIncome(transactions) * 100) / 100,
      spendingByCategory: categoryTotals(transactions).map(({ category, amount }) => ({
        category,
        amount: Math.round(amount * 100) / 100,
      })),
    }

    const sampleNote = transactions.length > SAMPLE_SIZE
      ? `The transaction list below is a SAMPLE: the ${SAMPLE_SIZE} largest of ${transactions.length} total transactions. The aggregates above cover ALL transactions — use them for any totals, percentages, and the health score.`
      : `The transaction list below is complete (${transactions.length} transactions).`

    // Only added when the user opted in — tells the model how to use the notes.
    const notesGuidance = withNotes
      ? `\nSome transactions include a user-written "note". Treat notes as authoritative context about that transaction: for example, "reimbursed by work" means the expense doesn't really burden the user, "split with roommate" means their true share is roughly half, and a note explaining a one-off event means the charge is not a recurring habit. Weigh insights and recommendations accordingly, and never quote a note verbatim in your output.\n`
      : ''

    const prompt = `Analyze this spending data and provide insights.

Exact aggregates computed over the full dataset (authoritative — use these for all numbers):
${JSON.stringify(aggregates, null, 2)}

${sampleNote}
${notesGuidance}
${JSON.stringify(sample, null, 2)}

Please provide:
1. Top spending categories and patterns
2. Unusual or concerning spending habits
3. Money-saving opportunities
4. Budget recommendations
5. Overall financial health assessment

Format your response as JSON with these keys:
- topCategories: array of {category, amount, percentage}
- patterns: array of insights
- recommendations: array of actionable advice
- healthScore: number 1-10
- summary: brief overview`

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      messages: [{
        role: 'user',
        content: prompt
      }]
    })

    // If the model ran out of tokens the JSON is truncated and unparseable —
    // report that clearly instead of a confusing parse error.
    if (message.stop_reason === 'max_tokens') {
      throw new Error('Response was truncated (max_tokens). Try fewer transactions.')
    }

    const responseText = message.content.find(b => b.type === 'text')?.text || ''
    const analysis = extractJson(responseText)

    return Response.json({ analysis })
  } catch (error) {
    console.error('Analysis error:', error)
    // Surface the real reason so the UI can show something actionable.
    return Response.json({ error: `Analysis failed: ${error.message}` }, { status: 500 })
  }
}