import { describe, it, expect } from 'vitest'
import { redactPii, scrubTransactions } from '../pii'

describe('redactPii', () => {
  it('redacts SSNs', () => {
    expect(redactPii('PAYMENT SSN 123-45-6789')).toBe('PAYMENT SSN [REDACTED-SSN]')
  })

  it('redacts phone numbers in common formats', () => {
    expect(redactPii('CALL (562) 555-1234')).toContain('[REDACTED-PHONE]')
    expect(redactPii('CALL 562-555-1234')).toContain('[REDACTED-PHONE]')
    expect(redactPii('CALL 562.555.1234')).toContain('[REDACTED-PHONE]')
  })

  it('redacts email addresses', () => {
    expect(redactPii('ZELLE TO jane.doe+1@example.com')).toBe('ZELLE TO [REDACTED-EMAIL]')
  })

  it('redacts long digit runs (account/card numbers)', () => {
    expect(redactPii('ACH WITHDRAWAL 12345678901234')).toBe('ACH WITHDRAWAL [REDACTED-NUMBER]')
    expect(redactPii('CARD 4111 1111 1111 1111')).toBe('CARD [REDACTED-NUMBER]')
  })

  it('redacts bank-masked account fragments', () => {
    expect(redactPii('TRANSFER TO XXXX1234')).toBe('TRANSFER TO [REDACTED-NUMBER]')
    expect(redactPii('ACCT ****5678')).toBe('ACCT [REDACTED-NUMBER]')
  })

  it('leaves normal merchant refs and store numbers alone', () => {
    expect(redactPii('TARGET STORE 00123')).toBe('TARGET STORE 00123')
    expect(redactPii('NETFLIX.COM 4567890')).toBe('NETFLIX.COM 4567890')
    expect(redactPii('CARLS JR 7415')).toBe('CARLS JR 7415')
  })

  it('passes through non-strings untouched', () => {
    expect(redactPii(undefined)).toBeUndefined()
    expect(redactPii(42)).toBe(42)
  })
})

describe('scrubTransactions', () => {
  it('drops keys outside the expected shape', () => {
    const [t] = scrubTransactions([{
      'Trans. Date': '01/02/26',
      'Description': 'COFFEE',
      'Amount': -4.5,
      'Category': 'Food',
      'Account Number': '12345678',
      'Account Holder': 'Jane Doe',
    }])
    expect(Object.keys(t).sort()).toEqual(['Amount', 'Category', 'Description', 'Trans. Date'].sort())
    expect(JSON.stringify(t)).not.toContain('Jane Doe')
  })

  it('redacts PII inside descriptions', () => {
    const [t] = scrubTransactions([{
      'Trans. Date': '01/02/26',
      'Description': 'ZELLE TO 562-555-1234',
      'Amount': -20,
      'Category': 'Transfer',
    }])
    expect(t.Description).toBe('ZELLE TO [REDACTED-PHONE]')
  })

  it('drops non-object entries and tolerates garbage input', () => {
    expect(scrubTransactions([null, 'str', 42, []])).toEqual([])
    expect(scrubTransactions('not an array')).toEqual([])
    expect(scrubTransactions(undefined)).toEqual([])
  })
})
