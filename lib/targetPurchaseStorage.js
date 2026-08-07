// Server-only access to target_purchase_items (see the migration). Matching
// logic itself is pure/testable — lib/targetPurchases.js — this module just
// wires it up to Supabase.
import { supabase } from '@/lib/supabase'
import { groupIntoTrips, matchTripsToTransactions } from '@/lib/targetPurchases'

function toClientShape(row) {
  return {
    id: row.id,
    itemName: row.item_name,
    itemPrice: row.item_price,
    qty: row.qty,
    lineTotal: row.line_total,
    imageUrl: row.image_url,
    fulfillment: row.fulfillment,
  }
}

// Bulk-insert parsed CSV rows, skipping ones already imported (same order +
// item + price). Returns how many new rows were actually written.
export async function insertTargetPurchaseItems(userId, items) {
  if (items.length === 0) return 0

  const rows = items.map(item => ({
    user_id: userId,
    order_ref: item.orderRef,
    date: item.date || null,
    item_name: item.itemName,
    item_price: item.itemPrice,
    qty: item.qty,
    line_total: item.lineTotal,
    image_url: item.imageUrl || null,
    trip_total: item.tripTotal,
    fulfillment: item.fulfillment || null,
  }))

  const { data, error } = await supabase
    .from('target_purchase_items')
    .upsert(rows, { onConflict: 'user_id,order_ref,item_name,item_price', ignoreDuplicates: true })
    .select('id')

  if (error) {
    console.error('Error inserting target purchase items:', error)
    throw new Error('Failed to save Target purchase items')
  }
  return data?.length || 0
}

// Links unmatched trips (order groups) to the user's existing "Target"
// transactions by amount + nearby date. Safe to re-run — only touches items
// that don't already have a transaction_id, so already-matched trips are
// left alone and a fresh transaction upload can pick up prior orders.
export async function matchUnmatchedItems(userId) {
  const [{ data: unmatchedItems, error: itemsError }, { data: transactions, error: txnError }] = await Promise.all([
    supabase
      .from('target_purchase_items')
      .select('order_ref, date, trip_total')
      .eq('user_id', userId)
      .is('transaction_id', null),
    supabase
      .from('transactions')
      .select('id, date, amount, description')
      .eq('user_id', userId)
      .ilike('description', '%target%'),
  ])

  if (itemsError || txnError) {
    console.error('Error loading data for Target matching:', itemsError || txnError)
    throw new Error('Failed to match Target purchases')
  }
  if (!unmatchedItems.length || !transactions.length) return 0

  const trips = groupIntoTrips(unmatchedItems.map(r => ({ orderRef: r.order_ref, date: r.date, tripTotal: r.trip_total })))
  const txnsForMatching = transactions.map(t => ({ id: t.id, Date: t.date, Amount: t.amount, Description: t.description }))
  const matches = matchTripsToTransactions(trips, txnsForMatching)

  for (const { orderRef, transactionId } of matches) {
    const { error } = await supabase
      .from('target_purchase_items')
      .update({ transaction_id: transactionId })
      .eq('user_id', userId)
      .eq('order_ref', orderRef)
      .is('transaction_id', null)
    if (error) console.error('Error linking Target trip to transaction:', error)
  }

  return matches.length
}

// Every transaction id that has at least one matched item — cheap enough to
// fetch up front so the Files review modal knows which rows get a
// "view items" affordance, without a per-row round trip.
export async function getMatchedTransactionIds(userId) {
  const { data, error } = await supabase
    .from('target_purchase_items')
    .select('transaction_id')
    .eq('user_id', userId)
    .not('transaction_id', 'is', null)

  if (error) {
    console.error('Error fetching matched Target transaction ids:', error)
    return []
  }
  return [...new Set(data.map(r => r.transaction_id))]
}

export async function getItemsForTransaction(userId, transactionId) {
  const { data, error } = await supabase
    .from('target_purchase_items')
    .select('id, item_name, item_price, qty, line_total, image_url, fulfillment')
    .eq('user_id', userId)
    .eq('transaction_id', transactionId)
    .order('item_name')

  if (error) {
    console.error('Error fetching Target purchase items:', error)
    throw new Error('Failed to load Target purchase items')
  }
  return data.map(toClientShape)
}
