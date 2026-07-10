# PennySprout Roadmap

Ordered by impact — highest-leverage work first. Compiled from a full-codebase technical audit (2026-07-08).

## Phase 0 — Launch blockers

Must land before any public or paid launch.

1. ~~**Fix privacy policy self-contradiction on MFA**~~ ✅ **Done (2026-07-08)** — removed the "optional multi-factor authentication" claim from the Clerk bullet in `app/privacy/page.js`; the policy now consistently says MFA is on the roadmap. (Enabling actual MFA moved to Phase 2 — it requires Clerk Pro.)
2. ~~**Add rate limiting / usage caps on Anthropic-backed routes**~~ ✅ **Done (2026-07-08)** — per-user daily caps stored in Supabase (`supabase/api-usage.sql` + `lib/rateLimit.js`); `/api/analyze` (30/day) and `/api/parse-pdf` (20/day) return 429 over the cap. **Requires running `supabase/api-usage.sql` in the Supabase SQL Editor** (fails open with a loud log until then).
3. ~~**Fix the CSV parser's quoted-comma bug**~~ ✅ **Done (2026-07-08)** — parsing moved to `lib/csv.js` with proper RFC-4180 handling (quoted commas, escaped quotes, CRLF, embedded newlines); PII header allowlist preserved.
4. ~~**Add automated tests for the money-math functions**~~ ✅ **Done (2026-07-08)** — vitest added (`npm test`), 50 tests across `lib/__tests__/` covering categories, csv, aiJson, date, and recurring. Testing exposed and fixed a real bug: two-charge merchant groups always passed `detectRecurring`'s steady-amount check.
5. ~~**Add production error monitoring**~~ ✅ **Done (2026-07-08)** — Sentry scaffolded (`instrumentation.js`, server/edge/client configs, `app/global-error.js`), inert until `SENTRY_DSN` / `NEXT_PUBLIC_SENTRY_DSN` are set. **Requires creating a free sentry.io project and pasting the DSN into `.env.local`.**
6. ~~**Write a Terms of Service**~~ ✅ **Done (2026-07-08)** — `/terms` page added (not-financial-advice + AI-accuracy disclaimers, acceptable use, liability limits), linked from the landing footer. **Have a lawyer review before charging money.**

## Phase 1 — Trust & scale foundations

7. ~~**Normalize transactions into their own table.**~~ ✅ **Done (2026-07-09)** — new `transactions` table (real date column, stable row ids, indexes on user/date and file), backfilled from the JSONB blobs by `supabase/transactions.sql`. `GET /api/transactions` supports `fileId`/`from`/`to` scoping; edits go to `PATCH /api/transactions/:id` instead of JSONB array indexes; `GET /api/files` returns metadata only. **Requires running `supabase/transactions.sql` in the Supabase SQL Editor before deploying this version.** The old JSONB column is kept as a rollback net; drop it after a stable stretch.
8. ~~**Distinguish "session expired" from "no data yet."**~~ ✅ **Done (2026-07-09)** — shared `useTransactions` hook checks `res.ok`/401 and all three components render a `LoadError` state ("session expired → sign in again" vs "server hiccup → retry") instead of a false empty state.
9. ~~**Let users correct AI-assigned categories.**~~ ✅ **Done (2026-07-09)** — the review modal now has a per-transaction category dropdown (standard set + any bank-specific categories already present), saved via `PATCH /api/files/:id/transactions` with optimistic update and rollback on failure.
10. ~~**Centralize auth enforcement.**~~ ✅ **Done (2026-07-09)** — `middleware.js` now default-denies `/api/*` with a JSON 401 for signed-out requests; per-route `currentUser()` checks remain for user-scoped data access.
11. ~~**Validate/scrub PII after PDF extraction.**~~ ✅ **Done (2026-07-09)** — `lib/pii.js` enforces the transaction shape (drops unexpected keys) and redacts SSN/phone/email/account-number patterns from descriptions after every extraction; covered by tests.
12. ~~**Fix the silent 50-transaction cap in `/api/analyze`.**~~ ✅ **Done (2026-07-09)** — exact totals and per-category aggregates are now computed in code over ALL transactions and sent as authoritative; the model sees the 80 largest transactions with the sampling explicitly disclosed.
13. ~~**Accessibility pass.**~~ ✅ **Done (2026-07-09)** — both modals get `role="dialog"`/`aria-modal`, focus trap, Escape-to-close, and focus restore (shared `useDialog` hook); `prefers-reduced-motion` stills decorative animations; year-heatmap cells are 20px on touch screens with `aria-label`/`aria-pressed`.
14. ~~**Validate required env vars at boot.**~~ ✅ **Done (2026-07-09)** — `lib/env.js` runs from `instrumentation.js` at startup and names exactly which required var is missing.

## Phase 2 — Monetization readiness

> **Strategy note (2026-07-10):** Plaid/bank connections are deliberately DEFERRED.
> "No bank login required" is the product's one real differentiator; the retention
> loop is built instead around budgets, goals, and monthly upload-reminder emails.
> Revisit only if month-2 retention flatlines despite those.

14a. **Enable Clerk MFA** — requires Clerk Pro (~$25/mo), so treat it as a first-revenue purchase: turn it on once the product charges money and a handful of subscribers cover the cost. The privacy policy already honestly states MFA is on the roadmap.
15. Memoize dashboard/calendar aggregate computations (`useMemo`) — currently recomputed on every render.
16. Split `SpendingDashboard.js` (481 lines) and `SpendingCalendar.js` (476 lines) into hooks + presentational components.
17. Consolidate duplicated spending/date logic back into `lib/categories.js` and `lib/date.js` — currently reimplemented inline in 3 components.
18. Fix `WeekView`'s mobile layout (`grid-cols-2 sm:grid-cols-7` stacks 7 days into 2 columns on phones instead of scrolling horizontally).
19. Add scroll affordance to horizontally-scrolling heatmaps on mobile.
20. ~~Introduce schema migration tooling.~~ ✅ **Done (2026-07-10)** — Supabase CLI added as a dev dependency; the whole schema now lives in idempotent, timestamped migrations under `supabase/migrations/` (the old hand-run `.sql` files are deleted). `npm run db:push` applies pending migrations; `npm run db:new <name>` starts a new one. One-time setup: `npx supabase login` + `npx supabase link --project-ref <ref>`.
21. Purge `data/users.json` from git history before the repo is made public (it was committed with real transaction data in early commits, later removed — commit `5f6c44f`).
22. ~~Add basic usage metering per user ahead of any billing decision.~~ ✅ **Done (2026-07-10)** — the api_usage counters now feed plan-aware daily caps (free: 30 analyses / 20 PDFs; Pro: 200 / 100) via `checkRateLimit(userId, route, plan)`.
23. ~~Introduce a plan/seat model and a billing integration.~~ ✅ **Done (2026-07-10)** — Stripe Checkout + customer portal + webhook (`/api/billing/*`), `subscriptions` table (`supabase/subscriptions.sql`), free/Pro plan gating, and a `/pricing` page. Env-gated: inert until `STRIPE_SECRET_KEY`, `STRIPE_PRICE_ID`, and `STRIPE_WEBHOOK_SECRET` are set. **Requires `npm run db:push` (subscriptions migration) and creating a $5/mo Price in Stripe.**
24. Build minimal admin/support tooling — no way today to look up an account, re-run a stuck analysis, or issue a credit without going into Supabase directly.

## Phase 3 — Delight & growth

25. Dark mode.
26. ~~CSV export of transactions~~ ✅ **Done (2026-07-10)** — `GET /api/export` downloads all transactions as RFC-4180 CSV from the Settings page. (PDF/analysis export still open.)
27. ~~Budgets and savings goals.~~ ✅ **Done (2026-07-10)** — per-category monthly limits with progress bars + savings goals with logged contributions, in a new Budgets tab (`/api/budgets`, `/api/goals`). **Requires `npm run db:push` (budgets_goals migration).**
28. Multi-account / household support.
29. ~~Self-serve account deletion.~~ ✅ **Done (2026-07-10)** — `/settings` page with type-DELETE confirmation; `DELETE /api/account` cancels any Stripe subscription, purges every Supabase table, then deletes the Clerk user (in that order, so a partial failure never locks the user out with data left behind).
30. Stream AI responses instead of a blocking spinner during parse/analyze.
31. Search and filter across all transactions, not just per-file or per-month.

## Phase A/B additions (2026-07-10)

32. ~~Email nudges & alerts.~~ ✅ **Done (2026-07-10)** — Resend-backed (`lib/email.js`, env-gated on `RESEND_API_KEY`): budget-exceeded alerts fire on upload, and a monthly upload-reminder cron (`/api/cron/upload-reminder`, guarded by `CRON_SECRET`, scheduled in `vercel.json`) nudges users with no upload in 30 days. Deduped via `email_log` (**apply with `npm run db:push`**) — at most one email per alert per month.
33. Referral mechanic + shareable insight cards (the growth loop from the investor memo).
36. ~~Replace the orange/peach accent with dusty blue.~~ ✅ **Done (2026-07-10)** — spending/negative accents now use the theme-aware `blue-*` scale; a new muted-rose `danger-*` scale covers errors and destructive actions (delete buttons, alerts). Peach removed entirely.
37. ~~Condense the nav.~~ ✅ **Done (2026-07-10)** — Upload merged into Files (dropzone at the top, list below, auto-refresh after each batch); 5 tabs. Old `?tab=upload` links map to Files.
38. ~~AI chat replaces the one-shot analysis.~~ ✅ **Done (2026-07-10)** — `/api/chat` streams month-scoped answers (context built server-side: totals, categories, top transactions, budgets; notes never sent). `/api/analyze` and `/api/monthly-analysis` deleted; health score is now computed deterministically from savings rate. Partially closes item 30 (chat streams; PDF parse still doesn't). The `monthly_analysis` table is now unused — drop it in a future migration.
34. Guided onboarding with a sample dataset so new users see value before uploading.
35. PWA manifest + installability for home-screen return visits.

---
*See the full audit for architecture, database, security, and code-quality detail behind each item.*
