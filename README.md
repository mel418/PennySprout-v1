# 🌱 Penny Sprout

An AI-powered personal finance analyzer that helps you understand your spending habits and make smarter financial decisions.

## Features

- **Multi-format Upload**: Upload CSV files (credit cards) and PDF bank statements — select multiple files at once to combine accounts
- **AI-Powered Insights**: Get personalized spending analysis, recommendations, and a financial health score powered by Claude AI
- **Interactive Dashboard**: Clickable charts showing spending by category and distribution — tap any category to see individual transactions
- **Spending Calendar**: Month-by-month calendar view across all saved files showing daily spending and income at a glance
- **Income & Bills Separation**: Income and Bills & Payments are tracked separately and excluded from your spending total for an accurate picture
- **Zelle / Transfer Detection**: Automatically distinguishes received transfers (income) from sent transfers (spending)
- **File Management**: Save, rename, and manage multiple statement files with persistent analysis history
- **User Authentication**: Secure login with Clerk
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
```

4. Run the development server:
```bash
npm run dev
```

5. Open [http://localhost:3000](http://localhost:3000) in your browser.

### Supabase Setup

Create a `user_files` table in your Supabase project:

```sql
create table user_files (
  id uuid default gen_random_uuid() primary key,
  user_id text not null,
  file_name text not null,
  transactions jsonb not null,
  analysis jsonb,
  total_amount numeric,
  transaction_count integer,
  created_at timestamp with time zone default now()
);
```

## Usage

### 1. Sign In
Click **Get Started Free** on the landing page and authenticate with Clerk.

### 2. Upload Statements
- Go to **Upload** and select one or more CSV or PDF files
- CSV files (e.g. Discover, Chase) are parsed in the browser
- PDF bank statements are sent to Claude for extraction
- Multiple files are combined into one saved record

### 3. View Your Dashboard
After upload the AI analyzes your transactions and shows:
- Total spending (excluding income and bills)
- Income total
- Financial health score (1–10)
- Spending by category (bar chart) and distribution (pie chart)
- Click any chart bar or category to see individual transactions
- Bills & Payments shown separately below the charts

### 4. Spending Calendar
The **Calendar** tab shows every month covered by your saved files. Each date shows daily spending (orange) and income (green). Click a date to see transactions grouped by category, then click a category to expand individual transactions.

### 5. My Files
- See all saved statement files with spending totals that match the dashboard
- Click the pencil icon on any file name to rename it
- Click **Analyze** to reload a file into the dashboard
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
│   │   ├── analyze/          # Claude AI analysis endpoint
│   │   ├── files/            # File CRUD endpoints
│   │   │   ├── [fileId]/     # DELETE (delete) + PATCH (rename)
│   │   │   └── analysis/     # Save analysis results
│   │   └── parse-pdf/        # PDF → transactions via Claude
│   ├── components/
│   │   ├── FileUpload.js     # Multi-file CSV + PDF upload
│   │   ├── SpendingCalendar.js # Month calendar view
│   │   ├── SpendingDashboard.js # Charts, cards, AI insights
│   │   └── UserFiles.js      # Saved files list with rename
│   ├── globals.css           # Sage color palette + animations
│   ├── layout.js             # Root layout with Clerk + metadata
│   └── page.js               # App shell + botanical landing page
├── lib/
│   ├── categories.js         # Shared normalizeCategory + calcSpending
│   ├── fileStorage.js        # Supabase CRUD helpers
│   └── supabase.js           # Supabase client (service role)
└── public/
    └── sprout-svgrepo-com.svg # App logo / favicon
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/analyze` | Analyze transactions with Claude AI |
| `GET` | `/api/files` | List user's saved files |
| `POST` | `/api/files` | Save a new file |
| `DELETE` | `/api/files/[fileId]` | Delete a file |
| `PATCH` | `/api/files/[fileId]` | Rename a file |
| `POST` | `/api/files/analysis` | Persist analysis result to a file |
| `POST` | `/api/parse-pdf` | Extract transactions from a PDF |

## Category Logic

All category normalization lives in `lib/categories.js` and is shared between the dashboard and file list:

- `"Payments and Credits"`, `"Bills"` → **Bills & Payments** (excluded from spending total)
- `"Transfer"` with a positive amount → **Income** (Zelle received)
- `"Transfer"` with a negative amount → counted as spending (Zelle sent)
- Everything else is shown as-is in the charts

## License

This project is licensed under the MIT License — see the LICENSE file for details.

---

Made with ❤️ for better financial wellness
