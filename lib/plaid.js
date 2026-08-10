// Server-only Plaid client, env-gated exactly like lib/stripe.js: with any
// of the required vars missing, Plaid is a silent no-op — the "Connected
// accounts" section doesn't render and every /api/plaid/* route 503s —
// instead of crashing the app. Full Plaid integration needs:
//   PLAID_CLIENT_ID       — from the Plaid Dashboard
//   PLAID_SECRET          — the Sandbox or Production secret (matches PLAID_ENV)
//   PLAID_ENV             — 'sandbox' | 'production' (defaults to 'sandbox')
//   PLAID_ENCRYPTION_KEY  — encrypts stored access tokens, see lib/plaidCrypto.js
//
// encryptionReady is folded into the gate deliberately: a misconfigured or
// missing encryption key must disable Plaid entirely, not fall back to
// storing access tokens in plaintext.
import 'server-only'
import { Configuration, PlaidApi, PlaidEnvironments } from 'plaid'
import { encryptionReady } from '@/lib/plaidCrypto'

export const PLAID_ENV = process.env.PLAID_ENV === 'production' ? 'production' : 'sandbox'

export const plaidEnabled = Boolean(
  process.env.PLAID_CLIENT_ID && process.env.PLAID_SECRET && encryptionReady
)

export const plaid = plaidEnabled
  ? new PlaidApi(
      new Configuration({
        basePath: PlaidEnvironments[PLAID_ENV],
        baseOptions: {
          headers: {
            'PLAID-CLIENT-ID': process.env.PLAID_CLIENT_ID,
            'PLAID-SECRET': process.env.PLAID_SECRET,
          },
        },
      })
    )
  : null

// Plaid API errors arrive as an axios error with the real error_code nested
// in response.data — this is the one place that reaches in for it, so
// callers never have to know the shape.
export function plaidErrorCode(error) {
  return error?.response?.data?.error_code ?? null
}

// Error codes that mean "the bank needs the user to sign back in" — the
// item should move to 'login_required' and the UI should offer Link's
// update mode rather than treating this as a transient sync failure.
const REAUTH_CODES = new Set(['ITEM_LOGIN_REQUIRED', 'ITEM_LOCKED', 'PENDING_EXPIRATION'])

export function isReauthRequired(code) {
  return REAUTH_CODES.has(code)
}
