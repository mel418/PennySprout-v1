// Normalizes a transaction into a (date, description, amount) identity key
// — the same normalization transactionHash.js uses, but for identifying
// ONE transaction rather than fingerprinting a whole set. Used to detect
// the same transaction showing up in different places (e.g. two statements
// whose billing cycles overlap).
//
// Shared between the server (lib/transactionStorage.js, checking incoming
// rows against what's already in the DB) and the client (FileUpload.js,
// matching the server's response back to rows in the file it just parsed,
// and deciding which to drop before resubmitting) so the two can never
// silently drift apart — a client-only or server-only copy would risk one
// side changing the normalization and duplicates slipping through unnoticed.
import { parseDate, toKey } from './date'

export function transactionKeyParts(dateKey, description, amount) {
  return `${dateKey || ''}|${String(description || '').trim().toLowerCase()}|${(parseFloat(amount) || 0).toFixed(2)}`
}

// t: a transaction object in the client shape ('Description', 'Amount', and
// a date field parseDate understands).
export function transactionKey(t) {
  const d = parseDate(t)
  return transactionKeyParts(d ? toKey(d) : '', t['Description'], t['Amount'])
}
