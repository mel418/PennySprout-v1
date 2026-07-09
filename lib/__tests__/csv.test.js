import { describe, it, expect } from 'vitest'
import { parseCsvRows, parseTransactionsCsv, isAllowedHeader } from '../csv'

describe('parseCsvRows', () => {
  it('parses simple unquoted rows', () => {
    expect(parseCsvRows('a,b,c\n1,2,3')).toEqual([['a', 'b', 'c'], ['1', '2', '3']])
  })

  it('keeps commas inside quoted fields (the bug that motivated this module)', () => {
    const rows = parseCsvRows('Date,Description,Amount\n01/15/2026,"AMAZON.COM, SEATTLE WA",-42.00')
    expect(rows[1]).toEqual(['01/15/2026', 'AMAZON.COM, SEATTLE WA', '-42.00'])
  })

  it('unescapes doubled quotes inside quoted fields', () => {
    const rows = parseCsvRows('Description\n"JOE""S DINER"')
    expect(rows[1]).toEqual(['JOE"S DINER'])
  })

  it('handles CRLF line endings', () => {
    expect(parseCsvRows('a,b\r\n1,2\r\n')).toEqual([['a', 'b'], ['1', '2']])
  })

  it('handles newlines embedded in quoted fields', () => {
    const rows = parseCsvRows('Description,Amount\n"LINE ONE\nLINE TWO",-5.00')
    expect(rows).toHaveLength(2)
    expect(rows[1]).toEqual(['LINE ONE\nLINE TWO', '-5.00'])
  })

  it('skips blank lines', () => {
    expect(parseCsvRows('a,b\n\n1,2\n\n')).toEqual([['a', 'b'], ['1', '2']])
  })

  it('flushes a final row with no trailing newline', () => {
    expect(parseCsvRows('a,b\n1,2')).toHaveLength(2)
  })
})

describe('parseTransactionsCsv', () => {
  it('parses a Discover-style export into transaction objects', () => {
    const csv = [
      'Trans. Date,Post Date,Description,Amount,Category',
      '06/08/2025,06/08/2025,"CARLS JR, ARTESIA CA",1.51,Restaurants',
    ].join('\n')
    const { data } = parseTransactionsCsv(csv)
    expect(data).toEqual([{
      'Trans. Date': '06/08/2025',
      'Post Date': '06/08/2025',
      'Description': 'CARLS JR, ARTESIA CA',
      'Amount': '1.51',
      'Category': 'Restaurants',
    }])
  })

  it('drops non-allowlisted (PII) columns entirely', () => {
    const csv = [
      'Date,Description,Amount,Account Number,Cardholder Name',
      '01/01/2026,COFFEE,-4.50,1234567890,Jane Doe',
    ].join('\n')
    const { headers, data } = parseTransactionsCsv(csv)
    expect(headers).toEqual(['Date', 'Description', 'Amount'])
    expect(data[0]).toEqual({ Date: '01/01/2026', Description: 'COFFEE', Amount: '-4.50' })
    expect(JSON.stringify(data)).not.toContain('Jane Doe')
    expect(JSON.stringify(data)).not.toContain('1234567890')
  })

  it('returns empty results for empty input', () => {
    expect(parseTransactionsCsv('')).toEqual({ headers: [], data: [] })
  })
})

describe('isAllowedHeader', () => {
  it('accepts common transaction headers case-insensitively', () => {
    for (const h of ['Trans. Date', 'DESCRIPTION', 'amount', 'Category', 'Posting Date']) {
      expect(isAllowedHeader(h)).toBe(true)
    }
  })

  it('rejects PII-ish headers', () => {
    for (const h of ['Account Number', 'Name', 'Address', 'SSN', 'Routing Number']) {
      expect(isAllowedHeader(h)).toBe(false)
    }
  })
})
