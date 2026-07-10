import { currentUser } from '@clerk/nextjs/server'
import Anthropic from '@anthropic-ai/sdk'
import { checkRateLimit } from '@/lib/rateLimit'
import { getPlan } from '@/lib/subscriptionStorage'
import { getTransactions } from '@/lib/transactionStorage'
import { getBudgets } from '@/lib/budgetStorage'
import { normalizeCategory } from '@/lib/categories'
import { monthKeyLabel } from '@/lib/date'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// POST /api/chat — conversational insights about one calendar month, streamed
// as plain text. Replaces the old one-shot /api/analyze report: instead of a
// canned summary, the user asks their own questions.
//
// Body: { month: 'YYYY-MM', messages: [{ role: 'user'|'assistant', content }] }
//
// The client sends ONLY the conversation. All financial context (totals,
// categories, transactions, budgets) is loaded server-side from the database,
// so a tampered request can't feed the model fake numbers or another user's
// data. Notes are deliberately never included — they're the user's private
// annotations (the old analyze flow required an explicit per-run opt-in).
const MAX_MESSAGES = 20
const MAX_MESSAGE_LENGTH = 2000

export async function POST(request) {
  try {
    const user = await currentUser()
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

    // Each chat message is one model call — same cost profile as the old
    // per-month analysis, so it shares that daily cap (higher on Pro).
    const plan = await getPlan(user.id)
    const { allowed, limit } = await checkRateLimit(user.id, 'chat', plan)
    if (!allowed) {
      const upsell = plan === 'free' ? ' Upgrade to Pro for a higher daily limit.' : ''
      return Response.json(
        { error: `Daily chat limit reached (${limit}/day). Try again tomorrow.${upsell}` },
        { status: 429 }
      )
    }

    const { month, messages } = await request.json()

    if (!/^\d{4}-\d{2}$/.test(String(month))) {
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

    // ── Build the month's financial context server-side ──
    const [y, mo] = month.split('-').map(Number)
    const lastDay = new Date(y, mo, 0).getDate()
    const transactions = await getTransactions(user.id, {
      from: `${month}-01`,
      to: `${month}-${String(lastDay).padStart(2, '0')}`,
    })

    if (transactions.length === 0) {
      return Response.json({ error: 'No transactions in this month' }, { status: 400 })
    }

    let income = 0, spending = 0, bills = 0
    const byCategory = {}
    for (const t of transactions) {
      const cat = normalizeCategory(t.Category, t.Amount)
      const amt = Math.abs(parseFloat(t.Amount) || 0)
      if (cat === 'Income') income += amt
      else if (cat === 'Bills & Payments') bills += amt
      else {
        spending += amt
        byCategory[cat] = (byCategory[cat] || 0) + amt
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
      .slice(0, 60)
      .map(t => `  ${t.Date || '?'} | ${t.Description || '—'} | $${Math.abs(parseFloat(t.Amount) || 0).toFixed(2)} | ${normalizeCategory(t.Category, t.Amount)}`)
      .join('\n')

    const budgets = await getBudgets(user.id).catch(() => [])
    const budgetLines = budgets.length
      ? budgets.map(b => {
          const spent = byCategory[b.category] || 0
          return `  ${b.category}: $${spent.toFixed(2)} spent of $${b.monthlyLimit.toFixed(2)} limit`
        }).join('\n')
      : '  (no budgets set)'

    const system = `You are Penny Sprout's financial companion — calm, encouraging, and never judgmental about spending. You answer questions about the user's ${monthKeyLabel(month)} finances using ONLY the data below.

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

LARGEST TRANSACTIONS (top ${Math.min(60, transactions.length)} of ${transactions.length} by amount):
${topTxns}

Rules:
- Use the exact totals above; never recompute or invent figures.
- If asked about something not in this data (other months, account balances, investments), say you can only see ${monthKeyLabel(month)}'s transactions and suggest switching months.
- Keep answers short and conversational — 2-5 sentences unless a breakdown is asked for. Plain text, no markdown headers or tables.
- You may offer gentle, practical suggestions, but you are not a licensed financial advisor and must not give investment advice.`

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
