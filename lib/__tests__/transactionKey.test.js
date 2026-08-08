import { describe, it, expect } from 'vitest'
import { transactionKey, transactionKeyParts } from '../transactionKey'

describe('transactionKey', () => {
  it('normalizes date, description (trimmed/lowercased), and amount (2dp)', () => {
    const key = transactionKey({ 'Date': '2026-07-04', Description: '  STARBUCKS  ', Amount: '-4.5' })
    expect(key).toBe('2026-07-04|starbucks|-4.50')
  })

  it('treats different date formats for the same day as the same key', () => {
    const a = transactionKey({ 'Trans. Date': '07/04/2026', Description: 'Target', Amount: '-10' })
    const b = transactionKey({ 'Date': '2026-07-04', Description: 'Target', Amount: '-10' })
    expect(a).toBe(b)
  })

  it('is case-insensitive on description', () => {
    const a = transactionKey({ Date: '2026-07-04', Description: 'Chevron', Amount: '-50' })
    const b = transactionKey({ Date: '2026-07-04', Description: 'CHEVRON', Amount: '-50' })
    expect(a).toBe(b)
  })

  it('produces an empty date segment when the date is unparseable', () => {
    expect(transactionKey({ Description: 'x', Amount: '1' })).toBe('|x|1.00')
  })
})

describe('transactionKeyParts', () => {
  it('matches transactionKey for the same logical transaction (client row vs. DB row)', () => {
    const clientKey = transactionKey({ Date: '2026-07-04', Description: 'Target', Amount: '-3.03' })
    const dbKey = transactionKeyParts('2026-07-04', 'Target', -3.03)
    expect(dbKey).toBe(clientKey)
  })
})
