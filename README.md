# 🌱 Penny Sprout

An AI-powered personal finance analyzer: upload statements (or connect a bank on Pro) and see your spending laid out on a calendar, with an AI chat that answers questions grounded in your real transactions.

## Features

- **Multi-format upload**: CSV (parsed in the browser) and PDF bank statements (extracted by Claude) — select multiple files at once
- **Bank sync (Sprout Pro)**: optionally connect a bank via Plaid for automatic daily transaction syncing — uploads are never required, this is purely additive
- **Spending calendar & dashboard**: month-by-month calendar of daily spending/income, plus a category breakdown with clickable drill-down to individual transactions
- **AI chat**: ask questions about any month's spending, grounded in your real transactions, categories, and budgets
- **Budgets & goals**: per-category monthly limits with progress tracking, plus savings goals with logged contributions
- **Income/Bills/Transfer handling**: income and bill payments are excluded from the spending total; Zelle-style transfers are split into received (income) vs. sent (spending)
- **Privacy by design**: statements are de-identified before storage (merchant, date, amount, category only — no names or account numbers); all data access is server-only through Row Level Security
- **Self-serve data control**: CSV export and immediate account deletion from Settings
- **Subscriptions**: free tier + Pro (Stripe) for higher AI rate limits and bank sync

See the in-app [privacy policy](app/privacy/page.js) (`/privacy`) for full detail on data handling.

## Tech Stack

Next.js 15 (App Router) · React 19 · Tailwind CSS v4 · Recharts · Clerk (auth) · Supabase/Postgres (data) · Anthropic Claude (AI analysis + PDF parsing) · Plaid (optional bank sync) · Stripe (billing)

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- Accounts/API keys for: Anthropic, Clerk, Supabase — required
- Accounts/API keys for: Stripe, Resend, Plaid — optional, each is env-gated to a silent no-op when unset

### Installation

```bash
git clone <your-repo-url>
cd spending-analyzer
npm install
```

Create `.env.local` in the root directory:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

ANTHROPIC_API_KEY=your_anthropic_api_key

NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=your_clerk_publishable_key
CLERK_SECRET_KEY=your_clerk_secret_key
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL=/
NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL=/

# The deployed origin — used to build Stripe redirect and email links.
# Defaults to the request's own origin if unset, but set it explicitly in
# production so those links are never wrong.
NEXT_PUBLIC_APP_URL=https://your-deployed-domain.com

# Optional — error monitoring (create a free project at sentry.io).
# Leave unset and Sentry is a silent no-op.
SENTRY_DSN=your_sentry_dsn
NEXT_PUBLIC_SENTRY_DSN=your_sentry_dsn

# Optional — billing (Stripe). Set all three or none. Create a $5/mo
# recurring Price in the Stripe dashboard for STRIPE_PRICE_ID.
# STRIPE_WEBHOOK_SECRET comes from the Stripe CLI's `stripe listen` command
# in dev, or the dashboard's webhook endpoint config in production (pointing
# at /api/billing/webhook). The Stripe CLI is not a project dependency —
# install it separately if you want to test webhooks locally.
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PRICE_ID=price_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Optional — bank connections via Plaid (Sprout Pro feature). Set all four
# or none. PLAID_ENCRYPTION_KEY encrypts stored access tokens — generate
# with `openssl rand -base64 32` and back it up: losing it means every
# connection must be relinked, and orphaned Plaid Items keep billing.
PLAID_CLIENT_ID=your_plaid_client_id
PLAID_SECRET=your_plaid_sandbox_or_production_secret
PLAID_ENV=sandbox
PLAID_ENCRYPTION_KEY=base64_32_byte_key

# Optional — email nudges (Resend free tier). Leave unset and emails no-op.
RESEND_API_KEY=re_...
EMAIL_FROM="Penny Sprout <hello@yourdomain.com>"

# Optional — protects /api/cron/* (Vercel cron sends it automatically).
CRON_SECRET=any_long_random_string
```

`lib/env.js` is the authoritative list of what's required vs. optional — it validates at boot (`instrumentation.js`) and throws with the exact missing var name if something required is absent.

Then:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Supabase Setup

Schema lives in versioned migrations under [`supabase/migrations/`](supabase/migrations), applied with the Supabase CLI (a dev dependency — no global install needed):

```bash
npx supabase login
npx supabase link --project-ref <your-project-ref>   # ref is in your project's dashboard URL
npm run db:push
```

`db:push` is idempotent and safe to run repeatedly — it only applies migrations that haven't run yet. To make a schema change, never edit the database by hand: `npm run db:new <name>` scaffolds a new migration file, then `npm run db:push` applies it.

**Why RLS everywhere:** every table has Row Level Security enabled with **no policies**, so the public anon key (which ships in the browser bundle) reads zero rows. The app reaches every table only through the server-side service-role key (`lib/supabase.js`, `server-only`), which bypasses RLS by design and scopes every query by the Clerk `user_id` itself.

## Usage

- **Overview** — an at-a-glance summary with shortcuts into the other tabs
- **Calendar** — every month covered by your data, daily spending (blue) and income (green); click a date for a category breakdown, click a category to expand individual transactions
- **Analysis** — pick a calendar month to see total spending/income, a financial health score, category charts, and an AI chat scoped to that month
- **Budgets** — per-category monthly limits with progress bars, plus savings goals
- **Files** — connect a bank (Pro) at the top, upload CSV/PDF statements below, and manage saved files (rename, review, delete)

## Supported File Formats

**CSV** — any file with `Trans. Date, Description, Amount, Category` columns (exact names vary by bank); both positive- and negative-purchase sign conventions are handled automatically.

**PDF** — standard bank statement PDFs; Claude reads them natively, no OCR required.

## Project Structure

```
spending-analyzer/
├── app/
│   ├── api/            # Route handlers — transactions, files, budgets, goals,
│   │                    #   billing, Plaid, chat, export, account deletion, cron
│   ├── components/      # App components; components/ui/ is the shared design system
│   ├── pricing/ settings/ privacy/ terms/   # Standalone pages
│   └── page.js          # App shell (tabbed nav) + landing page
├── lib/                 # All business logic (storage, mapping, categories, PII,
│                         #   rate limiting, email) + __tests__/ (vitest)
├── supabase/migrations/ # Versioned, idempotent schema migrations
└── public/
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/chat` | Month-scoped AI chat (streams plain text) |
| `GET`/`POST` | `/api/files` | List / save statement files |
| `PATCH`/`DELETE` | `/api/files/[fileId]` | Rename / delete a file |
| `GET`/`PATCH`/`DELETE` | `/api/transactions`, `/api/transactions/[id]` | List transactions; correct category/note or delete one |
| `POST` | `/api/parse-pdf` | Extract transactions from a PDF |
| `GET`/`PUT`/`DELETE` | `/api/budgets` | Category budgets |
| `GET`/`POST`/`PATCH`/`DELETE` | `/api/goals`, `/api/goals/[id]` | Savings goals |
| `GET`/`POST` | `/api/target-purchases`, `/api/target-purchase-imports` | Target.com purchase-history import + line-item matching |
| `POST` | `/api/plaid/link-token` | Start a Plaid Link session (Pro) |
| `POST` | `/api/plaid/exchange` | Finish linking a bank connection (Pro) |
| `GET` | `/api/plaid/items` | List connected banks |
| `DELETE` | `/api/plaid/items/[id]` | Disconnect a bank |
| `POST` | `/api/plaid/sync` | Sync one or all connected banks now (Pro) |
| `POST`/`GET` | `/api/billing/checkout`, `/api/billing/portal`, `/api/billing/status` | Stripe Checkout, customer portal, current plan |
| `POST` | `/api/billing/webhook` | Stripe webhook (signature-authenticated) |
| `GET` | `/api/export` | Download all transactions as CSV |
| `DELETE` | `/api/account` | Self-serve account deletion (requires `{ confirm: "DELETE" }`) |
| `GET` | `/api/cron/upload-reminder`, `/api/cron/plaid-sync` | Scheduled jobs (require `CRON_SECRET` bearer) |

## Category Logic

Category normalization lives in `lib/categories.js`, shared by every view:
- `"Bills"` / `"Payments and Credits"` → **Bills & Payments**, excluded from the spending total
- `"Transfer"` with a positive amount → **Income** (Zelle received); negative → counted as spending (Zelle sent)
- Everything else is shown as-is

## Development

```bash
npm test          # run the vitest suite (lib/__tests__/ — pure logic, no route/component tests)
npm run test:watch
npm run lint
npm run build
```

## Privacy & Security

- Statements are de-identified before storage — only merchant, date, amount, and category are kept
- All database access is server-only via the service-role key; RLS blocks the public anon key entirely (see "Why RLS everywhere" above)
- Every API route requires a signed-in Clerk session
- Data is encrypted in transit (TLS) and at rest (AES-256); Plaid access tokens get an additional application-level encryption layer (`lib/plaidCrypto.js`) since they're long-lived bank credentials, not just data
- Not end-to-end encrypted — the server reads transactions to generate charts and AI insights
- MFA is not enabled yet (gated behind Clerk's paid plan)

Full detail in the in-app [privacy policy](app/privacy/page.js) at `/privacy`.

## License

MIT — see [LICENSE](LICENSE).

---

Made with ❤️ for better financial wellness
