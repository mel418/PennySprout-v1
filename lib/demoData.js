// Sample data for the public demo (/demo). Generated, not stored: a believable
// few months of one person's checking account, anchored to "today" so the
// current month always has data. A seeded PRNG keeps it identical across
// reloads (and across visitors) — a demo that reshuffles on every refresh
// looks broken.
//
// Rows use the exact client shape /api/transactions returns (see
// toClientShape in lib/transactionStorage.js): negative = money out.
import { toKey, MONTHS_SHORT } from './date'

const ACCOUNT = 'Demo Checking'
const MONTHS_OF_HISTORY = 4 // the current month plus three full months before it

// mulberry32 — tiny, fast, good enough for fake coffee purchases.
function rng(seed) {
  return () => {
    seed |= 0
    seed = (seed + 0x6D2B79F5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// Fixed monthly items: [day of month, description, amount, category]
const MONTHLY = [
  [1,  'Rent - Parkside Apartments', -1450,  'Bills'],
  [1,  'Payroll - Acme Corp',         2150,  'Income'],
  [3,  'Planet Fitness',              -24.99, 'Fitness'],
  [5,  'Netflix.com',                 -15.49, 'Subscriptions'],
  [12, 'Spotify USA',                 -11.99, 'Subscriptions'],
  [15, 'Payroll - Acme Corp',         2150,  'Income'],
  [16, 'PG&E Utilities',              -84,   'Bills'],
  [20, 'Apple iCloud',                -2.99, 'Subscriptions'],
  [22, 'Verizon Wireless',            -65,   'Bills'],
]

// Variable spending: [description, category, min, max, expected uses per month]
const VARIABLE = [
  ['Blue Bottle Coffee', 'Food',          4.5,  7.5, 10],
  ["Trader Joe's",       'Food',          38,   115, 4],
  ['Chipotle',           'Food',          11,   17,  3],
  ['DoorDash',           'Food',          24,   48,  2],
  ['Target',             'Shopping',      18,   95,  2],
  ['Amazon.com',         'Shopping',      12,   70,  3],
  ['AMC Theatres',       'Entertainment', 18,   34,  1],
  ['Steam Games',        'Entertainment', 10,   45,  0.6],
  ['Uber',               'Travel',        11,   29,  2],
  ['Shell Gas',          'Travel',        38,   56,  1.5],
  ['Zelle to Sam',       'Transfer',      20,   80,  0.7],
]

const round2 = n => Math.round(n * 100) / 100

export function demoFileId(year, month) {
  return `demo-file-${year}-${String(month + 1).padStart(2, '0')}`
}

export function generateDemoTransactions(today = new Date()) {
  const rand = rng(418)
  const rows = []
  const add = (date, description, amount, category) => {
    if (date > today) return // never show the future
    rows.push({
      id: `demo-txn-${rows.length + 1}`,
      fileId: demoFileId(date.getFullYear(), date.getMonth()),
      Date: toKey(date),
      Description: description,
      Amount: round2(amount),
      Category: category,
      accountName: ACCOUNT,
    })
  }

  for (let back = MONTHS_OF_HISTORY - 1; back >= 0; back--) {
    const first = new Date(today.getFullYear(), today.getMonth() - back, 1)
    const y = first.getFullYear()
    const m = first.getMonth()
    const daysInMonth = new Date(y, m + 1, 0).getDate()

    for (const [day, desc, amount, cat] of MONTHLY) add(new Date(y, m, day), desc, amount, cat)

    for (const [desc, cat, min, max, perMonth] of VARIABLE) {
      // Whole uses, plus a chance of one more for the fractional part.
      const uses = Math.floor(perMonth) + (rand() < perMonth % 1 ? 1 : 0)
      for (let i = 0; i < uses; i++) {
        const day = 1 + Math.floor(rand() * daysInMonth)
        add(new Date(y, m, day), desc, -(min + rand() * (max - min)), cat)
      }
    }

    // A friend paying back their share of dinner, every other month.
    if (m % 2 === 0) add(new Date(y, m, 9), 'Zelle from Jordan', 42, 'Transfer')
  }

  return rows.sort((a, b) => b.Date.localeCompare(a.Date))
}

// One "uploaded statement" per month, matching what /api/files returns.
export function demoFilesFor(transactions) {
  const byFile = new Map()
  for (const t of transactions) {
    const f = byFile.get(t.fileId) || { total: 0, count: 0, date: t.Date }
    f.total += t.Amount
    f.count += 1
    byFile.set(t.fileId, f)
  }
  return [...byFile.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([id, f]) => {
      const [y, m] = f.date.split('-').map(Number)
      const name = `Checking statement - ${MONTHS_SHORT[m - 1]} ${y}.csv`
      return {
        id,
        name,
        originalName: name,
        uploadDate: new Date(y, m, 2).toISOString(), // "uploaded" just after month end
        totalAmount: round2(f.total),
        transactionCount: f.count,
        accountName: ACCOUNT,
      }
    })
}

export const DEMO_BUDGETS = [
  { id: 'demo-budget-1', category: 'Entertainment', monthlyLimit: 75 },
  { id: 'demo-budget-2', category: 'Food',          monthlyLimit: 450 },
  { id: 'demo-budget-3', category: 'Shopping',      monthlyLimit: 200 },
  { id: 'demo-budget-4', category: 'Subscriptions', monthlyLimit: 35 },
]

export function demoGoals(today = new Date()) {
  const inMonths = n => toKey(new Date(today.getFullYear(), today.getMonth() + n, 1))
  return [
    { id: 'demo-goal-1', name: 'Emergency fund', targetAmount: 5000, savedAmount: 3400, targetDate: inMonths(8) },
    { id: 'demo-goal-2', name: 'Trip to Japan',  targetAmount: 3000, savedAmount: 900,  targetDate: inMonths(12) },
  ]
}
