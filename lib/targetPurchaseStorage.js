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

// One row per CSV upload — lets the Files tab list "every Target export
// you've imported" the same way it lists bank statements, with a Review
// modal per import. Returns the new row's id.
export async function createImport(userId, fileName) {
  const { data, error } = await supabase
    .from('target_purchase_imports')
    .insert({ user_id: userId, file_name: fileName || 'Target purchase history' })
    .select('id')
    .single()

  if (error) {
    console.error('Error creating Target import:', error)
    throw new Error('Failed to save Target import')
  }
  return data.id
}

// Sets the import's final item_count once insertion is done, or removes it
// entirely if nothing new was written (a re-upload of already-imported
// data) — no point cluttering the import list with a 0-item entry.
export async function finalizeImport(userId, importId, itemCount) {
  if (itemCount === 0) {
    await supabase.from('target_purchase_imports').delete().eq('id', importId).eq('user_id', userId)
    return
  }
  const { error } = await supabase
    .from('target_purchase_imports')
    .update({ item_count: itemCount })
    .eq('id', importId)
    .eq('user_id', userId)
  if (error) console.error('Error finalizing Target import:', error)
}

// Bulk-insert parsed CSV rows, skipping ones already imported (same order +
// date + item + price). date is part of the dedup key, not just order_ref:
// in-store exports reuse the store's name as "order_ref" for every visit,
// so without date, buying the same item at the same store on two different
// days would collide and silently drop the second purchase. Rows that
// collide with an earlier import keep their original import_id — only
// genuinely new rows get attributed to `importId`.
export async function insertTargetPurchaseItems(userId, items, importId) {
  if (items.length === 0) return 0

  const rows = items.map(item => ({
    user_id: userId,
    import_id: importId,
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
    .upsert(rows, { onConflict: 'user_id,order_ref,date,item_name,item_price', ignoreDuplicates: true })
    .select('id')

  if (error) {
    console.error('Error inserting target purchase items:', error)
    throw new Error('Failed to save Target purchase items')
  }
  return data?.length || 0
}

// Every import (CSV upload), newest first — drives the "Target Purchase
// Imports" section in the Files tab.
export async function getImports(userId) {
  const { data, error } = await supabase
    .from('target_purchase_imports')
    .select('id, file_name, item_count, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching Target imports:', error)
    return []
  }
  return data.map(row => ({
    id: row.id,
    fileName: row.file_name,
    itemCount: row.item_count,
    importedAt: row.created_at,
  }))
}

export async function deleteImport(userId, importId) {
  // Items cascade-delete via the import_id foreign key.
  const { error } = await supabase
    .from('target_purchase_imports')
    .delete()
    .eq('id', importId)
    .eq('user_id', userId)

  if (error) {
    console.error('Error deleting Target import:', error)
    throw new Error('Failed to delete Target import')
  }
}

// Every item from one import, newest purchase first — for the import
// review modal. Includes date (spans many days, unlike the
// transaction-scoped list) and whether it's linked to a card transaction.
export async function getItemsForImport(userId, importId) {
  const { data, error } = await supabase
    .from('target_purchase_items')
    .select('id, date, item_name, item_price, qty, line_total, image_url, fulfillment, transaction_id')
    .eq('user_id', userId)
    .eq('import_id', importId)
    .order('date', { ascending: false })

  if (error) {
    console.error('Error fetching items for Target import:', error)
    throw new Error('Failed to load Target import items')
  }
  return data.map(row => ({ ...toClientShape(row), date: row.date, matched: row.transaction_id != null }))
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

  for (const { orderRef, date, transactionId } of matches) {
    // date must be part of this filter — order_ref alone is a store name
    // for in-store trips and matches every visit to that store, not just
    // this one.
    const { error } = await supabase
      .from('target_purchase_items')
      .update({ transaction_id: transactionId })
      .eq('user_id', userId)
      .eq('order_ref', orderRef)
      .eq('date', date)
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
