# 🌱 Penny Sprout

An AI-powered personal finance analyzer that helps you understand your spending habits and make smarter financial decisions.

## Features

- **Multi-format Upload**: Upload CSV files (credit cards) and PDF bank statements — select multiple files at once to combine accounts
- **AI Chat**: Ask questions about any month's spending ("where did most of my money go?") and get streamed answers grounded in your real transactions, categories, and budgets — powered by Claude
- **Interactive Dashboard**: Clickable charts showing spending by category and distribution — tap any category to see individual transactions
- **Spending Calendar**: Month-by-month calendar view across all saved files showing daily spending and income at a glance, with color-coded categories in the daily breakdown
- **Cash Flow Trends**: A collapsible, mobile-optimized chart on the calendar plots daily income/spending and a cumulative net-balance line for the selected month
- **Income & Bills Separation**: Income and Bills & Payments are tracked separately and excluded from your spending total for an accurate picture
- **Zelle / Transfer Detection**: Automatically distinguishes received transfers (income) from sent transfers (spending)
- **Budgets & Goals**: Per-category monthly spending limits with progress tracking, plus savings goals with logged contributions
- **Subscriptions (Stripe)**: Free tier + $5/mo Pro tier (higher daily AI caps) via Stripe Checkout, customer portal, and webhook-synced plan state
- **Email Nudges**: Budget-exceeded alerts on upload and a monthly "upload your statement" reminder (Resend, env-gated)
- **Data Export & Account Deletion**: Self-serve CSV export of all transactions and immediate, complete account deletion from the Settings page
- **File Management**: Save, rename, and manage multiple statement files with persistent analysis history
- **Privacy by Design**: Statements are de-identified before storage — only merchant, date, amount, and category are kept (no names, account numbers, or other PII)
- **Secure Data Access**: Clerk-authenticated sessions, server-only database access via the service-role key, and Row Level Security on the data table
- **Keyboard Shortcuts**: the calendar supports `←/→` (move), `W`/`M`/`Y` (scale), `T` (today), and `Esc` (deselect)
- **Mobile Friendly**: Responsive layout with a bottom navigation bar on mobile

## Tech Stack

- **Frontend**: Next.js 15, React 19, Tailwind CSS v4
- **Charts**: Recharts
- **Authentication**: Clerk
- **AI**: Anthropic Claude API (analysis + native PDF parsing)
- **Database**: Supabase (PostgreSQL)
- **Icons**: Lucide React

## Getting Started

### Prerequisites

- Node.js 18+
- npm
- Anthropic API key
- Clerk account and API keys
- Supabase project

### Installation

1. Clone the repository:
```bash
git clone <your-repo-url>
cd spending-analyzer
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env.local` file in the root directory:
```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

ANTHROPIC_API_KEY=your_anthropic_api_key

NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=your_clerk_publishable_key
CLERK_SECRET_KEY=your_clerk_secret_key
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL=/
NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL=/

# Optional — error monitoring (create a free project at sentry.io).
# Leave unset and Sentry is a silent no-op.
SENTRY_DSN=your_sentry_dsn
NEXT_PUBLIC_SENTRY_DSN=your_sentry_dsn

# Optional — billing (Stripe). Leave all three unset and billing is a silent
# no-op (the pricing page shows "not configured"). Set all three or none:
# create a $5/mo recurring Price in the Stripe dashboard for STRIPE_PRICE_ID;
# STRIPE_WEBHOOK_SECRET comes from `stripe listen` (dev) or the dashboard
# webhook endpoint (prod, pointing at /api/billing/webhook).
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PRICE_ID=price_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Optional — email nudges (Resend free tier). Leave unset and emails no-op.
RESEND_API_KEY=re_...
EMAIL_FROM="Penny Sprout <hello@yourdomain.com>"

# Optional — protects /api/cron/* (Vercel cron sends it automatically).
CRON_SECRET=any_long_random_string
```

4. Run the development server:
```bash
npm run dev
```

5. Open [http://localhost:3000](http://localhost:3000) in your browser.

### Supabase Setup

The database schema lives in versioned migrations under [`supabase/migrations/`](supabase/migrations) and is applied with the Supabase CLI (installed as a dev dependency — no global install needed):

```bash
# One-time: authenticate and link your Supabase project
npx supabase login
npx supabase link --project-ref <your-project-ref>   # ref is in your project's dashboard URL

# Apply all pending migrations
npm run db:push
```

`db:push` creates every table (`user_files`, `monthly_analysis`, `api_usage`, `transactions`, `budgets`, `goals`, `subscriptions`, `email_log`), enables Row Level Security on each, and records which migrations have run — so it's safe to run repeatedly and it never double-applies. The migrations are also idempotent, so a database that predates this tooling (tables created by hand) adopts cleanly: the first push just fills in whatever's missing.

To make a future schema change, never edit the database by hand — add a migration instead:

```bash
npm run db:new my_change_name    # creates supabase/migrations/<timestamp>_my_change_name.sql
# ...write the SQL in the new file, then:
npm run db:push
```

**Why RLS everywhere:** the anon key is public (it ships in the browser bundle), so every table has RLS enabled with **no** policies — the anon key reads zero rows. The app reaches the tables only through the server-side service-role key (which bypasses RLS by design) and filters every query by the Clerk `user_id`.

## Usage

### 1. Sign In
Click **Get Started Free** on the landing page and authenticate with Clerk.

### 2. Upload Statements
- Go to **Files** and drop one or more CSV or PDF files into the upload zone at the top
- CSV files (e.g. Discover, Chase) are parsed in the browser
- PDF bank statements are sent to Claude for extraction
- Each file is saved as its own record, listed right below the dropzone

### 3. View Your Dashboard
The **Analysis** tab works by **calendar month** — pick a month and it pools every transaction from that month across all your files (not per file). Statements that close mid-month no longer skew the numbers. For the selected month it shows:
- Total spending (excluding income and bills) and income total
- Financial health score (1–10), computed from your savings rate
- Spending by category (bar chart) and distribution (pie chart)
- Click any chart bar or category to see individual transactions
- Bills & Payments shown separately below the charts
- An **AI chat** at the bottom: ask anything about the month ("what subscriptions am I paying for?") and answers stream in, grounded in your real transactions and budgets

### 4. Spending Calendar
The **Calendar** tab shows every month covered by your saved files. Each date shows daily spending (blue) and income (green). Click a date to see transactions grouped by category, then click a category to expand individual transactions.

### 5. Files
- The same tab where you upload: all saved statement files with spending totals
- Click the pencil icon on any file name to rename it
- Click **Review** to see that file's transactions
- Delete files you no longer need

## Supported File Formats

### CSV
Any CSV with these columns (exact names may vary by bank):

```
Trans. Date, Description, Amount, Category
01/15/2026, Coffee Shop, -4.50, Food & Drink
01/16/2026, Payroll, 2500.00, Income
```

Both positive-purchase (Discover) and negative-purchase (most banks) sign conventions are handled automatically.

### PDF
Standard bank statement PDFs. Claude reads the PDF natively and extracts transactions — no OCR required.

## Project Structure

```
spending-analyzer/
├── app/
│   ├── api/
│   │   ├── chat/             # Month-scoped AI chat (streams)
│   │   ├── files/            # File CRUD endpoints
│   │   │   └── [fileId]/     # DELETE (delete) + PATCH (rename)
│   │   └── parse-pdf/        # PDF → transactions via Claude
│   ├── components/
│   │   ├── FileUpload.js     # Multi-file CSV + PDF upload
│   │   ├── MonthChat.js      # AI chat panel on the Analysis tab
│   │   ├── SpendingCalendar.js # Month calendar view
│   │   ├── SpendingDashboard.js # Charts, cards, AI chat
│   │   └── UserFiles.js      # Saved files list with rename
│   ├── privacy/              # Privacy policy page (/privacy)
│   ├── globals.css           # Sage color palette + animations
│   ├── layout.js             # Root layout with Clerk + metadata
│   └── page.js               # App shell + botanical landing page
├── lib/
│   ├── categories.js         # Shared normalizeCategory, calcSpending, categoryColor
│   ├── fileStorage.js        # Supabase CRUD helpers
│   └── supabase.js           # Supabase client (service role, server-only)
├── supabase/
│   ├── config.toml           # Supabase CLI project config
│   └── migrations/           # Versioned schema migrations (npm run db:push)
└── public/
    └── sprout-svgrepo-com.svg # App logo / favicon
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/chat` | Month-scoped AI chat (streams plain text) |
| `GET` | `/api/files` | List user's saved files (metadata only) |
| `POST` | `/api/files` | Save a new file + its transaction rows |
| `DELETE` | `/api/files/[fileId]` | Delete a file (cascades to its transactions) |
| `PATCH` | `/api/files/[fileId]` | Rename a file |
| `GET` | `/api/transactions` | List transactions (`?fileId=`, `?from=`/`?to=` filters) |
| `PATCH` | `/api/transactions/[id]` | Correct a transaction's category or note |
| `POST` | `/api/parse-pdf` | Extract transactions from a PDF |
| `GET`/`PUT`/`DELETE` | `/api/budgets` | List / upsert / remove category budgets |
| `GET`/`POST` | `/api/goals` | List / create savings goals |
| `PATCH`/`DELETE` | `/api/goals/[id]` | Update / delete one goal |
| `POST` | `/api/billing/checkout` | Start Stripe Checkout for Pro |
| `POST` | `/api/billing/portal` | Open the Stripe customer portal |
| `GET` | `/api/billing/status` | Current plan (`free`/`pro`) |
| `POST` | `/api/billing/webhook` | Stripe webhook (signature-authenticated) |
| `GET` | `/api/export` | Download all transactions as CSV |
| `DELETE` | `/api/account` | Self-serve account deletion (requires `{ confirm: "DELETE" }`) |
| `GET` | `/api/cron/upload-reminder` | Monthly reminder cron (requires `CRON_SECRET` bearer) |

## Category Logic

All category normalization lives in `lib/categories.js` and is shared between the dashboard and file list:

- `"Payments and Credits"`, `"Bills"` → **Bills & Payments** (excluded from spending total)
- `"Transfer"` with a positive amount → **Income** (Zelle received)
- `"Transfer"` with a negative amount → counted as spending (Zelle sent)
- Everything else is shown as-is in the charts

## Privacy & Security

- **De-identification at the source**: When a statement is parsed, the model is instructed to drop all PII (names, addresses, account/routing numbers, SSNs). Only merchant, date, amount, and category are ever stored. The uploaded file itself is processed in memory and not retained.
- **Server-only data access**: All database access goes through the service-role key in `lib/supabase.js`, which imports `server-only` so the key can never be bundled into client code. The public anon key is not used for data access.
- **Row Level Security**: RLS is enabled on every table by the migrations in [`supabase/migrations/`](supabase/migrations); the public anon key returns zero rows.
- **Authenticated routes**: Every API route requires a signed-in Clerk user, including `/api/chat` (so the Anthropic API can't be abused anonymously).
- **Encryption**: Data is encrypted in transit (TLS) and at rest (AES-256) by Supabase. Note this is *not* end-to-end encryption — the server reads transactions to generate charts and insights.
- **MFA**: Not enabled yet (gated behind Clerk's paid plan); on the roadmap for launch. See the in-app [privacy policy](app/privacy/page.js) at `/privacy`.

## License

This project is licensed under the MIT License — see the LICENSE file for details.

---

Made with ❤️ for better financial wellness
