// Encrypts Plaid access_tokens before they ever reach the database.
//
// Supabase's disk encryption only defends against physical media theft. The
// threats that actually matter for a token that reads a real bank account
// are a leaked SUPABASE_SERVICE_ROLE_KEY (the only data-access path in this
// schema — see lib/supabase.js) and a stray pg_dump landing somewhere it
// shouldn't. Neither is mitigated by at-rest disk encryption, so the token
// gets its own application-level layer: AES-256-GCM with a random 12-byte IV
// per encryption and Postgres never sees plaintext.
//
// PLAID_ENCRYPTION_KEY must be 32 raw bytes, base64-encoded (`openssl rand
// -base64 32`). Losing this key makes every stored token permanently
// unrecoverable: users must relink, and /item/remove can no longer be called
// to stop those Items from billing at Plaid. Back it up outside Vercel.
//
// Deliberately does NOT import 'server-only' (unlike lib/plaid.js and
// lib/plaidItemStorage.js, which do): this module touches no secrets beyond
// an env var and no Supabase client, and it's the one piece of the Plaid
// integration worth unit-testing directly (see
// lib/__tests__/plaidCrypto.test.js) — same reasoning as lib/pii.js.
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'

const ALGORITHM = 'aes-256-gcm'
const KEY_VERSION = 'v1'
const IV_LENGTH = 12 // bytes; the GCM-recommended nonce size

function loadKey() {
  const raw = process.env.PLAID_ENCRYPTION_KEY
  if (!raw) return null
  let key
  try {
    key = Buffer.from(raw, 'base64')
  } catch {
    return null
  }
  // A wrong-length key would otherwise fail inside createCipheriv on every
  // single request, forever — catch it once at load time instead.
  return key.length === 32 ? key : null
}

const key = loadKey()

// True only when PLAID_ENCRYPTION_KEY is set AND correctly sized. lib/plaid.js
// folds this into plaidEnabled so a misconfigured key disables Plaid entirely
// rather than silently falling back to storing plaintext.
export const encryptionReady = key !== null

export function encryptToken(plaintext) {
  if (!encryptionReady) {
    throw new Error('PLAID_ENCRYPTION_KEY is not set or is not a valid 32-byte base64 key')
  }
  const iv = randomBytes(IV_LENGTH)
  const cipher = createCipheriv(ALGORITHM, key, iv)
  const ciphertext = Buffer.concat([cipher.update(String(plaintext), 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return [
    KEY_VERSION,
    iv.toString('base64'),
    tag.toString('base64'),
    ciphertext.toString('base64'),
  ].join(':')
}

export function decryptToken(serialized) {
  if (!encryptionReady) {
    throw new Error('PLAID_ENCRYPTION_KEY is not set or is not a valid 32-byte base64 key')
  }
  const parts = String(serialized).split(':')
  if (parts.length !== 4 || parts[0] !== KEY_VERSION) {
    throw new Error('Unrecognized encrypted token format')
  }
  const [, ivB64, tagB64, ctB64] = parts
  const iv = Buffer.from(ivB64, 'base64')
  const tag = Buffer.from(tagB64, 'base64')
  const ciphertext = Buffer.from(ctB64, 'base64')

  const decipher = createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(tag)
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()])
  return plaintext.toString('utf8')
}
