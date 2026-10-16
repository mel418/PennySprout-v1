'use client'
// Demo mode's fake backend. installDemoApi() swaps window.fetch for a version
// that answers every same-origin /api/* request from in-memory sample data
// (lib/demoData.js), so /demo renders the REAL app components unchanged —
// no demo-only copies of the dashboard to drift out of sync — while nothing
// reaches the server: no auth needed, no database rows, no Claude spend.
//
// Reads return sample data; edits (budgets, goals, categories, notes)
// apply in memory so the app feels live, and reset on reload. Uploads and
// bank connections are refused with a "sign up" message, and the AI chat
// streams a canned summary computed from the sample data.
import { generateDemoTransactions, demoFilesFor, DEMO_BUDGETS, demoGoals } from '@/lib/demoData'
import { calcSpending, calcIncome, categoryTotals } from '@/lib/categories'
import { monthKeyLabel } from '@/lib/date'
import { money } from '@/lib/format'

const SIGN_UP_MESSAGE = "This is a demo with sample data. Sign up free to use your own statements."

const json = (body, status = 200) => Response.json(body, { status })

function createStore() {
  const transactions = generateDemoTransactions()
  return {
    transactions,
    files: demoFilesFor(transactions),
    budgets: DEMO_BUDGETS.map(b => ({ ...b })),
    goals: demoGoals(),
    nextId: 1,
  }
}

// Streams text in small chunks so the chat UI types it out like the real one.
function streamText(text) {
  const encoder = new TextEncoder()
  const chunks = text.match(/.{1,12}/gs) || []
  return new Response(new ReadableStream({
    async start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(chunk))
        await new Promise(r => setTimeout(r, 15))
      }
      controller.close()
    },
  }), { headers: { 'Content-Type': 'text/plain; charset=utf-8' } })
}

function demoChatAnswer(store, { month }) {
  const rows = month ? store.transactions.filter(t => t.Date.startsWith(month)) : store.transactions
  const label = month ? monthKeyLabel(month) : 'your sample history'
  const spent = calcSpending(rows)
  const income = calcIncome(rows)
  const top = categoryTotals(rows).slice(0, 3)
  const topText = top.map(c => `${c.category} (${money(c.amount)})`).join(', ')
  return [
    `Here's a quick look at ${label}: you spent ${money(spent)} and brought in ${money(income)}.`,
    top.length ? ` Your biggest categories were ${topText}.` : '',
    `\n\nThis is a demo, so I'm giving a preview summary instead of a real answer. `,
    `Sign up free and I'll answer any question about your own transactions.`,
  ].join('')
}

async function readJson(body) {
  try { return typeof body === 'string' ? JSON.parse(body) : {} } catch { return {} }
}

async function handle(store, url, method, body) {
  const path = url.pathname
  const q = url.searchParams

  if (path === '/api/transactions' && method === 'GET') {
    const fileId = q.get('fileId')
    const from = q.get('from')
    const to = q.get('to')
    return json({
      transactions: store.transactions.filter(t =>
        (!fileId || t.fileId === fileId) && (!from || t.Date >= from) && (!to || t.Date <= to)),
    })
  }

  const txnMatch = path.match(/^\/api\/transactions\/([^/]+)$/)
  if (txnMatch && txnMatch[1] !== 'hidden' && txnMatch[1] !== 'hide') {
    const id = decodeURIComponent(txnMatch[1])
    if (method === 'PATCH') {
      const fields = await readJson(body)
      store.transactions = store.transactions.map(t => {
        if (t.id !== id) return t
        const next = { ...t }
        if ('category' in fields) next.Category = fields.category
        if ('note' in fields) {
          if (fields.note) next.Note = fields.note
          else delete next.Note
        }
        return next
      })
      return json({ success: true })
    }
    if (method === 'DELETE') {
      store.transactions = store.transactions.filter(t => t.id !== id)
      return json({ success: true })
    }
  }

  if (path === '/api/files') {
    if (method === 'GET') return json({ files: store.files })
    return json({ error: SIGN_UP_MESSAGE }, 403)
  }
  const fileMatch = path.match(/^\/api\/files\/([^/]+)$/)
  if (fileMatch) {
    const id = decodeURIComponent(fileMatch[1])
    if (method === 'PATCH') {
      const { name } = await readJson(body)
      if (name) store.files = store.files.map(f => f.id === id ? { ...f, name } : f)
      return json({ success: true })
    }
    if (method === 'DELETE') {
      store.files = store.files.filter(f => f.id !== id)
      store.transactions = store.transactions.filter(t => t.fileId !== id)
      return json({ success: true })
    }
  }

  if (path === '/api/budgets') {
    if (method === 'GET') return json({ budgets: store.budgets })
    if (method === 'PUT') {
      const { category, monthlyLimit } = await readJson(body)
      store.budgets = [
        ...store.budgets.filter(b => b.category !== category),
        { id: `demo-budget-new-${store.nextId++}`, category, monthlyLimit },
      ]
      return json({ success: true })
    }
    if (method === 'DELETE') {
      store.budgets = store.budgets.filter(b => b.category !== q.get('category'))
      return json({ success: true })
    }
  }

  if (path === '/api/goals') {
    if (method === 'GET') return json({ goals: store.goals })
    if (method === 'POST') {
      const { name, targetAmount, savedAmount = 0, targetDate = null } = await readJson(body)
      const goal = { id: `demo-goal-new-${store.nextId++}`, name, targetAmount, savedAmount, targetDate }
      store.goals = [...store.goals, goal]
      return json({ goal })
    }
  }
  const goalMatch = path.match(/^\/api\/goals\/([^/]+)$/)
  if (goalMatch) {
    const id = decodeURIComponent(goalMatch[1])
    if (method === 'PATCH') {
      const fields = await readJson(body)
      store.goals = store.goals.map(g => g.id === id ? { ...g, ...fields } : g)
      return json({ success: true })
    }
    if (method === 'DELETE') {
      store.goals = store.goals.filter(g => g.id !== id)
      return json({ success: true })
    }
  }

  if (path === '/api/chat' && method === 'POST') {
    return streamText(demoChatAnswer(store, await readJson(body)))
  }

  // Bank sync is a Pro feature that needs a real account. Report it as
  // unavailable so the Files tab shows its normal "not set up" state.
  if (path === '/api/plaid/items' && method === 'GET') return json({ enabled: false, plan: 'free', items: [] })
  if (path === '/api/transactions/hidden' && method === 'GET') return json({ transactions: [] })
  if (path === '/api/target-purchases' && method === 'GET') {
    return json(q.get('transactionId') ? { items: [] } : { matchedTransactionIds: [] })
  }
  if (path === '/api/target-purchase-imports' && method === 'GET') return json({ imports: [] })

  // Everything else (uploads, PDF parsing, Plaid linking, billing, export,
  // account deletion) needs a real account.
  return json({ error: SIGN_UP_MESSAGE }, 403)
}

// Installs the fake backend and returns a function that restores the real
// fetch. Non-API and cross-origin requests (Next.js internals, fonts,
// Sentry) pass straight through.
export function installDemoApi() {
  const realFetch = window.fetch
  const store = createStore()
  window.fetch = async (input, init = {}) => {
    const url = new URL(typeof input === 'string' || input instanceof URL ? input : input.url, window.location.origin)
    if (url.origin !== window.location.origin || !url.pathname.startsWith('/api/')) {
      return realFetch(input, init)
    }
    const method = (init.method || (input instanceof Request ? input.method : 'GET')).toUpperCase()
    return handle(store, url, method, init.body)
  }
  return () => { window.fetch = realFetch }
}
