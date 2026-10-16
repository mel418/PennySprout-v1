import { describe, it, expect } from 'vitest'
import { generateDemoTransactions, demoFilesFor, demoFileId } from '../demoData'
import { calcSpending, calcIncome } from '../categories'
import { toKey } from '../date'

const TODAY = new Date(2026, 9, 16) // Oct 16, 2026

describe('generateDemoTransactions', () => {
  it('is deterministic for the same day', () => {
    expect(generateDemoTransactions(TODAY)).toEqual(generateDemoTransactions(TODAY))
  })

  it('covers the current month and three before it, never the future', () => {
    const rows = generateDemoTransactions(TODAY)
    const months = new Set(rows.map(t => t.Date.slice(0, 7)))
    expect([...months].sort()).toEqual(['2026-07', '2026-08', '2026-09', '2026-10'])
    expect(rows.every(t => t.Date <= toKey(TODAY))).toBe(true)
  })

  it('uses the stored sign convention and realistic totals', () => {
    const sept = generateDemoTransactions(TODAY).filter(t => t.Date.startsWith('2026-09'))
    expect(calcIncome(sept)).toBe(4342) // two paychecks + a Zelle received
    const spent = calcSpending(sept)
    expect(spent).toBeGreaterThan(500)
    expect(spent).toBeLessThan(2000)
    expect(sept.find(t => t.Description === 'Netflix.com').Amount).toBe(-15.49)
  })

  it('gives every row a unique id and a file per month', () => {
    const rows = generateDemoTransactions(TODAY)
    expect(new Set(rows.map(t => t.id)).size).toBe(rows.length)
    const files = demoFilesFor(rows)
    expect(files.map(f => f.id)).toEqual([
      demoFileId(2026, 9), demoFileId(2026, 8), demoFileId(2026, 7), demoFileId(2026, 6),
    ])
    expect(files.reduce((n, f) => n + f.transactionCount, 0)).toBe(rows.length)
  })
})
