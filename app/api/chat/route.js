import { currentUser } from '@clerk/nextjs/server'
import Anthropic from '@anthropic-ai/sdk'
import { checkRateLimit } from '@/lib/rateLimit'
import { getPlan } from '@/lib/subscriptionStorage'
import { getTransactions } from '@/lib/transactionStorage'
import { getBudgets } from '@/lib/budgetStorage'
import { normalizeCategory, EXCLUDED_FROM_TOTALS } from '@/lib/categories'
import { parseDate, monthKey, monthKeyLabel } from '@/lib/date'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// POST /api/chat — conversational insights, streamed as plain text. Replaces
// the old one-shot /api/analyze report: instead of a canned summary, the
// user asks their own questions.
//
// Body: { month: 'YYYY-MM', messages } — one calendar month's finances, or
//       { scope: 'all', messages } — everything the user has ever uploaded
//       (the Ask Penny tab in the floating search widget).
//
// The client sends ONLY the conversation. All financial context (totals,
// categories, transactions, budgets) is loaded server-side from the database,
// so a tampered request can't feed the model fake numbers or another user's
// data. Notes are deliberately never included — they're the user's private
// annotations (the old analyze flow required an explicit per-run opt-in).
const MAX_MESSAGES = 20
const MAX_MESSAGE_LENGTH = 2000
const MAX_TOP_TXNS = 60
const MAX_MONTH_ROWS = 24

export async function POST(request) {
  try {
    const user = await currentUser()
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

    // Each chat message is one model call — same cost profile as the old
    // per-month analysis, so it shares that daily cap (higher on Pro).
    const plan = await getPlan(user.id)
    const { allowed, limit, infraError } = await checkRateLimit(user.id, 'chat', plan)
    if (!allowed) {
      if (infraError) {
        return Response.json(
          { error: 'Something went wrong on our end — please try again in a moment.' },
          { status: 503 }
        )
      }
      const upsell = plan === 'free' ? ' Upgrade to Pro for a higher daily limit.' : ''
      return Response.json(
        { error: `Daily chat limit reached (${limit}/day). Try again tomorrow.${upsell}` },
        { status: 429 }
      )
    }

    const { month, scope, messages } = await request.json()
    const isAllScope = scope === 'all'

    if (!isAllScope && !/^\d{4}-\d{2}$/.test(String(month))) {
      return Response.json({ error: 'Invalid month' }, { status: 400 })
    }
    if (!Array.isArray(messages) || messages.length === 0 || messages.length > MAX_MESSAGES) {
      return Response.json({ error: 'Invalid messages' }, { status: 400 })
    }
    for (const m of messages) {
      if (!m || (m.role !== 'user' && m.role !== 'assistant') ||
          typeof m.content !== 'string' || !m.content.trim() ||
          m.content.length > MAX_MESSAGE_LENGTH) {
        return Response.json({ error: 'Invalid messages' }, { status: 400 })
      }
    }

    // ── Build the financial context server-side ──
    let transactions
    if (isAllScope) {
      transactions = await getTransactions(user.id)
    } else {
      const [y, mo] = month.split('-').map(Number)
      const lastDay = new Date(y, mo, 0).getDate()
      transactions = await getTransactions(user.id, {
        from: `${month}-01`,
        to: `${month}-${String(lastDay).padStart(2, '0')}`,
      })
    }

    if (transactions.length === 0) {
      return Response.json({ error: isAllScope ? 'No transactions yet' : 'No transactions in this month' }, { status: 400 })
    }

    let income = 0, spending = 0, bills = 0
    const byCategory = {}
    const byMonth = {}
    for (const t of transactions) {
      const cat = normalizeCategory(t.Category, t.Amount)
      const amt = Math.abs(parseFloat(t.Amount) || 0)
      const d = isAllScope ? parseDate(t) : null
      const mKey = d ? monthKey(d) : null
      if (mKey) byMonth[mKey] ||= { income: 0, spending: 0, bills: 0 }

      if (cat === 'Income') {
        income += amt
        if (byMonth[mKey]) byMonth[mKey].income += amt
      } else if (cat === 'Bills & Payments') {
        bills += amt
        if (byMonth[mKey]) byMonth[mKey].bills += amt
      } else if (!EXCLUDED_FROM_TOTALS.has(cat)) {
        spending += amt
        byCategory[cat] = (byCategory[cat] || 0) + amt
        if (byMonth[mKey]) byMonth[mKey].spending += amt
      }
    }
    const categoryLines = Object.entries(byCategory)
      .sort(([, a], [, b]) => b - a)
      .map(([c, v]) => `  ${c}: $${v.toFixed(2)}`)
      .join('\n')

    // Largest transactions for texture; totals above are authoritative.
    const topTxns = transactions
      .slice()
      .sort((a, b) => Math.abs(parseFloat(b.Amount) || 0) - Math.abs(parseFloat(a.Amount) || 0))
      .slice(0, MAX_TOP_TXNS)
      .map(t => `  ${t.Date || '?'} | ${t.Description || '—'} | $${Math.abs(parseFloat(t.Amount) || 0).toFixed(2)} | ${normalizeCategory(t.Category, t.Amount)}`)
      .join('\n')

    let system
    if (isAllScope) {
      const dates = transactions.map(parseDate).filter(Boolean).map(d => d.getTime())
      const earliest = dates.length ? new Date(Math.min(...dates)).toLocaleDateString() : '?'
      const latest = dates.length ? new Date(Math.max(...dates)).toLocaleDateString() : '?'
      const monthEntries = Object.entries(byMonth).sort(([a], [b]) => b.localeCompare(a)).slice(0, MAX_MONTH_ROWS)
      const monthLines = monthEntries
        .map(([k, v]) => `  ${monthKeyLabel(k)}: income $${v.income.toFixed(2)}, spending $${v.spending.toFixed(2)}, bills $${v.bills.toFixed(2)}, net $${(v.income - v.spending - v.bills).toFixed(2)}`)
        .join('\n')

      system = `You are Penny Sprout's financial companion — calm, encouraging, and never judgmental about spending. You answer questions about the user's ENTIRE transaction history using ONLY the data below.

DATA COVERS: ${earliest} through ${latest} (${transactions.length} transactions total)

EXACT ALL-TIME TOTALS (computed in code — authoritative):
  Income: $${income.toFixed(2)}
  Spending (excl. bills): $${spending.toFixed(2)}
  Bills & Payments: $${bills.toFixed(2)}
  Net: $${(income - spending - bills).toFixed(2)}

SPENDING BY CATEGORY (all-time):
${categoryLines || '  (none)'}

BY MONTH (most recent ${monthEntries.length} of ${Object.keys(byMonth).length}):
${monthLines || '  (none)'}

LARGEST TRANSACTIONS (top ${Math.min(MAX_TOP_TXNS, transactions.length)} of ${transactions.length} by amount):
${topTxns}

Rules:
- Use the exact totals above; never recompute or invent figures.
- If a question needs a specific transaction not listed above, answer from the aggregates rather than guessing at details you can't see.
- Keep answers short and conversational — 2-5 sentences unless a breakdown is asked for. Plain text, no markdown headers or tables.
- You may offer gentle, practical suggestions, but you are not a licensed financial advisor and must not give investment advice.`
    } else {
      const budgets = await getBudgets(user.id).catch(() => [])
      const budgetLines = budgets.length
        ? budgets.map(b => {
            const spent = byCategory[b.category] || 0
            return `  ${b.category}: $${spent.toFixed(2)} spent of $${b.monthlyLimit.toFixed(2)} limit`
          }).join('\n')
        : '  (no budgets set)'

      system = `You are Penny Sprout's financial companion — calm, encouraging, and never judgmental about spending. You answer questions about the user's ${monthKeyLabel(month)} finances using ONLY the data below.

EXACT TOTALS for ${monthKeyLabel(month)} (computed in code — authoritative):
  Income: $${income.toFixed(2)}
  Spending (excl. bills): $${spending.toFixed(2)}
  Bills & Payments: $${bills.toFixed(2)}
  Net: $${(income - spending - bills).toFixed(2)}
  Transaction count: ${transactions.length}

SPENDING BY CATEGORY:
${categoryLines || '  (none)'}

MONTHLY BUDGETS:
${budgetLines}

LARGEST TRANSACTIONS (top ${Math.min(MAX_TOP_TXNS, transactions.length)} of ${transactions.length} by amount):
${topTxns}

Rules:
- Use the exact totals above; never recompute or invent figures.
- If asked about something not in this data (other months, account balances, investments), say you can only see ${monthKeyLabel(month)}'s transactions and suggest switching months.
- Keep answers short and conversational — 2-5 sentences unless a breakdown is asked for. Plain text, no markdown headers or tables.
- You may offer gentle, practical suggestions, but you are not a licensed financial advisor and must not give investment advice.`
    }

    const stream = anthropic.messages.stream({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system,
      messages: messages.map(m => ({ role: m.role, content: m.content })),
    })

    // Stream raw text deltas to the client as they arrive.
    const encoder = new TextEncoder()
    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const event of stream) {
            if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta') {
              controller.enqueue(encoder.encode(event.delta.text))
            }
          }
          controller.close()
        } catch (error) {
          console.error('Chat stream failed:', error)
          controller.error(error)
        }
      },
    })

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-store',
      },
    })
  } catch (error) {
    console.error('Error in chat:', error)
    return Response.json({ error: 'Chat failed' }, { status: 500 })
  }
}
