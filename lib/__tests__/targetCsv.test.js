import { describe, it, expect } from 'vitest'
import { parseTargetPurchasesCsv } from '../targetCsv'

const HEADER = 'Date,Store/Order,ItemName,ItemPrice,Qty,LineTotal,ImageURL,TripTotal,Fulfillment'

describe('parseTargetPurchasesCsv', () => {
  it('parses rows into item objects', () => {
    const csv = [
      HEADER,
      '2026-07-28,#912003626909689,Strong-Strips Flexible Fabric Bandages - 60ct,5.39,1,5.39,https://target.scene7.com/x.jpg,5.06,Picked up',
    ].join('\n')
    const { items, error } = parseTargetPurchasesCsv(csv)
    expect(error).toBeNull()
    expect(items).toEqual([{
      date: '2026-07-28',
      orderRef: '#912003626909689',
      itemName: 'Strong-Strips Flexible Fabric Bandages - 60ct',
      itemPrice: 5.39,
      qty: 1,
      lineTotal: 5.39,
      imageUrl: 'https://target.scene7.com/x.jpg',
      tripTotal: 5.06,
      fulfillment: 'Picked up',
    }])
  })

  it('redacts an email address embedded in an item name (e.g. eGift cards)', () => {
    const csv = [
      HEADER,
      '2026-08-01,#1,Disney Gift Card eGift to Jane jane@example.com,50,1,50,,50,Picked up',
    ].join('\n')
    const { items } = parseTargetPurchasesCsv(csv)
    expect(items[0].itemName).not.toContain('jane@example.com')
    expect(items[0].itemName).toContain('[REDACTED-EMAIL]')
  })

  it('errors on a file missing required columns', () => {
    const { items, error } = parseTargetPurchasesCsv('Foo,Bar\n1,2')
    expect(items).toEqual([])
    expect(error).toMatch(/doesn't look like a Target purchase export/)
  })

  it('returns empty results for empty input', () => {
    expect(parseTargetPurchasesCsv('')).toEqual({ items: [], error: null })
  })
})
