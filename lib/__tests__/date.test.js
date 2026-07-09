import { describe, it, expect } from 'vitest'
import {
  parseDate, toKey, fromKey, monthKey, monthKeyLabel, monthKeyToDate,
  periodRange, startOfWeek, stepPeriod,
} from '../date'

describe('parseDate', () => {
  it('parses MM/DD/YYYY from Trans. Date', () => {
    const d = parseDate({ 'Trans. Date': '06/08/2025' })
    expect(toKey(d)).toBe('2025-06-08')
  })

  it('parses two-digit years as 20xx', () => {
    const d = parseDate({ 'Trans. Date': '01/15/26' })
    expect(toKey(d)).toBe('2026-01-15')
  })

  it('falls back to Date and Transaction Date columns', () => {
    expect(toKey(parseDate({ 'Date': '03/01/2026' }))).toBe('2026-03-01')
    expect(toKey(parseDate({ 'Transaction Date': '03/02/2026' }))).toBe('2026-03-02')
  })

  it('parses ISO dates via fallback', () => {
    const d = parseDate({ 'Date': '2026-07-04T12:00:00' })
    expect(d.getFullYear()).toBe(2026)
  })

  it('returns null for missing or garbage dates', () => {
    expect(parseDate({})).toBeNull()
    expect(parseDate({ 'Date': 'not a date' })).toBeNull()
  })
})

describe('toKey / fromKey', () => {
  it('round-trips without UTC off-by-one', () => {
    const d = new Date(2026, 0, 1) // Jan 1 local
    expect(toKey(d)).toBe('2026-01-01')
    expect(toKey(fromKey('2026-01-01'))).toBe('2026-01-01')
  })
})

describe('month keys', () => {
  it('formats and labels YYYY-MM keys', () => {
    expect(monthKey(new Date(2026, 5, 15))).toBe('2026-06')
    expect(monthKeyLabel('2026-06')).toBe('June 2026')
    expect(monthKeyToDate('2026-06').getMonth()).toBe(5)
  })
})

describe('periodRange', () => {
  it('month range spans first to last day (handles leap February)', () => {
    const [start, end] = periodRange('month', new Date(2024, 1, 10))
    expect(toKey(start)).toBe('2024-02-01')
    expect(toKey(end)).toBe('2024-02-29')
  })

  it('week range is Sunday-anchored and 7 days long', () => {
    // 2026-07-08 is a Wednesday; its week starts Sunday 2026-07-05
    const [start, end] = periodRange('week', new Date(2026, 6, 8))
    expect(toKey(start)).toBe('2026-07-05')
    expect(toKey(end)).toBe('2026-07-11')
    expect(start.getDay()).toBe(0)
  })

  it('year range spans Jan 1 to Dec 31', () => {
    const [start, end] = periodRange('year', new Date(2026, 6, 8))
    expect(toKey(start)).toBe('2026-01-01')
    expect(toKey(end)).toBe('2026-12-31')
  })
})

describe('stepPeriod', () => {
  it('steps months across year boundaries', () => {
    const next = stepPeriod('month', new Date(2025, 11, 15), 1)
    expect(monthKey(next)).toBe('2026-01')
  })

  it('steps weeks by 7 days', () => {
    const next = stepPeriod('week', new Date(2026, 6, 8), 1)
    expect(toKey(startOfWeek(next))).toBe('2026-07-12')
  })
})
