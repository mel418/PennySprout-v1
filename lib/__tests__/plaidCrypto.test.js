import { describe, it, expect, beforeEach, vi } from 'vitest'

// encryptionReady and the derived key are computed once at module load, so
// exercising different PLAID_ENCRYPTION_KEY values requires a fresh module
// instance per test via vi.resetModules() + a dynamic import — a plain
// top-level import would only ever see whichever env value was set first.
const GOOD_KEY = Buffer.alloc(32, 7).toString('base64')

async function loadWithKey(key) {
  vi.resetModules()
  if (key === undefined) delete process.env.PLAID_ENCRYPTION_KEY
  else process.env.PLAID_ENCRYPTION_KEY = key
  return import('../plaidCrypto')
}

describe('plaidCrypto', () => {
  beforeEach(() => {
    delete process.env.PLAID_ENCRYPTION_KEY
  })

  it('is ready with a valid 32-byte base64 key', async () => {
    const { encryptionReady } = await loadWithKey(GOOD_KEY)
    expect(encryptionReady).toBe(true)
  })

  it('is not ready with no key set', async () => {
    const { encryptionReady } = await loadWithKey(undefined)
    expect(encryptionReady).toBe(false)
  })

  it('rejects a key that is not 32 bytes', async () => {
    const { encryptionReady, encryptToken } = await loadWithKey(Buffer.alloc(16, 1).toString('base64'))
    expect(encryptionReady).toBe(false)
    expect(() => encryptToken('x')).toThrow()
  })

  it('round-trips a token', async () => {
    const { encryptToken, decryptToken } = await loadWithKey(GOOD_KEY)
    const token = 'access-sandbox-1234-abcd'
    expect(decryptToken(encryptToken(token))).toBe(token)
  })

  it('produces different ciphertext for the same plaintext (random IV)', async () => {
    const { encryptToken } = await loadWithKey(GOOD_KEY)
    expect(encryptToken('same-token')).not.toBe(encryptToken('same-token'))
  })

  it('prefixes output with the key version', async () => {
    const { encryptToken } = await loadWithKey(GOOD_KEY)
    expect(encryptToken('x')).toMatch(/^v1:/)
  })

  it('throws when ciphertext is tampered with', async () => {
    const { encryptToken, decryptToken } = await loadWithKey(GOOD_KEY)
    const [ver, iv, tag, ct] = encryptToken('access-sandbox-tamper-me').split(':')
    const bytes = Buffer.from(ct, 'base64')
    bytes[0] ^= 0xff // flip a bit inside the ciphertext
    const tampered = [ver, iv, tag, bytes.toString('base64')].join(':')
    expect(() => decryptToken(tampered)).toThrow()
  })

  it('throws when decrypted with a different key', async () => {
    const { encryptToken } = await loadWithKey(GOOD_KEY)
    const enc = encryptToken('access-sandbox-wrong-key')

    const { decryptToken: decryptWithOtherKey } = await loadWithKey(Buffer.alloc(32, 9).toString('base64'))
    expect(() => decryptWithOtherKey(enc)).toThrow()
  })
})
