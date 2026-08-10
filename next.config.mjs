// Derives the Clerk Frontend API host from the publishable key so the CSP
// below tracks whichever Clerk instance is actually configured (dev vs
// live) instead of a hardcoded domain that breaks the day the key rotates.
// Publishable keys are meant to be public — decoding one is not a secret
// operation. Format: pk_(test|live)_<base64(host + '$')>
function clerkFrontendApiHost(publishableKey) {
  if (!publishableKey) return null
  try {
    const encoded = publishableKey.replace(/^pk_(test|live)_/, '')
    return Buffer.from(encoded, 'base64').toString('utf8').replace(/\$$/, '')
  } catch {
    return null
  }
}

function sentryIngestHost(dsn) {
  if (!dsn) return null
  try {
    return new URL(dsn).host
  } catch {
    return null
  }
}

const clerkHost = clerkFrontendApiHost(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY)
const sentryHost = sentryIngestHost(process.env.NEXT_PUBLIC_SENTRY_DSN)
// Same env-gating every optional integration in this app follows (see
// lib/plaid.js plaidEnabled): only widen the CSP for Plaid when it's
// actually configured, so a deployment that never sets these vars doesn't
// carry a third-party allowance it has no use for.
const plaidConfigured = Boolean(process.env.PLAID_CLIENT_ID && process.env.PLAID_SECRET)

// Report-Only, not enforced: Clerk's login flow (its script, XHR calls, and
// the Cloudflare Turnstile bot-check frame it embeds), the Target
// purchase-item thumbnails, and Plaid Link (its script + the modal it opens,
// used by the optional bank-sync feature) are the parts most likely to break
// from a wrong directive, and there's no way to click through the real,
// signed-in app in this environment to confirm the allowlist is complete
// before it ships. Report-Only logs violations to the browser console
// without blocking anything, so it's safe to ship now. Once you've used the
// app for a few days (sign-in, billing redirect, Target item thumbnails, PDF
// upload, and — if Plaid is configured — connecting a bank) with DevTools
// open and see no CSP violations logged, flip the header name below from
// Content-Security-Policy-Report-Only to Content-Security-Policy to actually
// enforce it.
const cspDirectives = [
  `default-src 'self'`,
  `base-uri 'self'`,
  `object-src 'none'`,
  `frame-ancestors 'none'`,
  `form-action 'self'`,
  `worker-src 'self' blob:`,
  `img-src 'self' data: https://img.clerk.com https://target.scene7.com https://*.scene7.com`,
  `font-src 'self' data:`,
  `style-src 'self' 'unsafe-inline'`,
  [`frame-src https://challenges.cloudflare.com`, plaidConfigured && `https://cdn.plaid.com`]
    .filter(Boolean).join(' '),
  [`script-src 'self' 'unsafe-inline'`, clerkHost && `https://${clerkHost}`, `https://challenges.cloudflare.com`, plaidConfigured && `https://cdn.plaid.com`]
    .filter(Boolean).join(' '),
  [
    `connect-src 'self'`, clerkHost && `https://${clerkHost}`, clerkHost && `wss://${clerkHost}`,
    sentryHost && `https://${sentryHost}`,
    // Link itself (loaded from cdn.plaid.com) talks to Plaid's API hosts
    // directly from the browser during the connect flow — the access
    // token exchange still only ever happens server-side (lib/plaid.js).
    plaidConfigured && `https://cdn.plaid.com https://production.plaid.com https://sandbox.plaid.com`,
  ].filter(Boolean).join(' '),
].join('; ')

/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          // Force HTTPS on every future visit, including subdomains.
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
          // Stop the browser from guessing content types (e.g. treating an
          // uploaded file as executable script).
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          // This app is never meant to be framed by another site.
          { key: 'X-Frame-Options', value: 'DENY' },
          // Send the origin (not the full path/query) on cross-site
          // navigations — plenty for analytics, nothing sensitive leaked.
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          // No camera, mic, or location access anywhere in the app.
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          { key: 'Content-Security-Policy-Report-Only', value: cspDirectives },
        ],
      },
    ]
  },
}

export default nextConfig
