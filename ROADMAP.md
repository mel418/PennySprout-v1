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

7. **Normalize transactions into their own table** (or at minimum scope every query by month). Today `GET /api/files` pulls every JSONB blob for every file on every Calendar/Overview load — fine at demo scale, won't survive real usage growth or multi-year histories.
8. **Distinguish "session expired" from "no data yet."** All three dashboard components swallow fetch errors into an empty state (`SpendingDashboard.js`, `SpendingCalendar.js`, `Overview.js`) — a 401 looks identical to a new user with no spending. Unacceptable ambiguity for a finance app.
9. **Let users correct AI-assigned categories.** The file review modal (`UserFiles.js`) is read-only. If Claude mis-tags a transaction, there's no way to fix it, which undermines every chart built from that category.
10. **Centralize auth enforcement.** Every route currently opts in via its own `currentUser()` check — consistent today, but nothing stops a future route from shipping without it. Move to default-deny via `auth.protect()` in `middleware.js` for `/api/*`.
11. **Validate/scrub PII after PDF extraction**, not just via prompt instruction. The "no PII" guarantee in `parse-pdf/route.js` is entirely LLM-compliance-based with no code-level check afterward.
12. **Fix the silent 50-transaction cap in `/api/analyze`** (`route.js:21`) — months with more transactions get insights computed on a truncated, unlabeled sample.
13. **Accessibility pass**: modal dialog semantics + focus traps + Escape-to-close (`SpendingDashboard.js` category modal, `UserFiles.js` review modal), `prefers-reduced-motion` support, larger touch targets on the year heatmap (currently 12px).
14. **Validate required env vars at boot** instead of failing deep inside a request handler.

## Phase 2 — Monetization readiness

14a. **Enable Clerk MFA** — requires Clerk Pro (~$25/mo), so treat it as a first-revenue purchase: turn it on once the product charges money and a handful of subscribers cover the cost. The privacy policy already honestly states MFA is on the roadmap.
15. Memoize dashboard/calendar aggregate computations (`useMemo`) — currently recomputed on every render.
16. Split `SpendingDashboard.js` (481 lines) and `SpendingCalendar.js` (476 lines) into hooks + presentational components.
17. Consolidate duplicated spending/date logic back into `lib/categories.js` and `lib/date.js` — currently reimplemented inline in 3 components.
18. Fix `WeekView`'s mobile layout (`grid-cols-2 sm:grid-cols-7` stacks 7 days into 2 columns on phones instead of scrolling horizontally).
19. Add scroll affordance to horizontally-scrolling heatmaps on mobile.
20. Introduce schema migration tooling (or at least a single versioned schema file) — SQL is currently hand-run through the Supabase dashboard.
21. Purge `data/users.json` from git history before the repo is made public (it was committed with real transaction data in early commits, later removed — commit `5f6c44f`).
22. Add basic usage metering per user ahead of any billing decision.
23. Introduce a plan/seat model (Clerk supports it; unused today) and a billing integration.
24. Build minimal admin/support tooling — no way today to look up an account, re-run a stuck analysis, or issue a credit without going into Supabase directly.

## Phase 3 — Delight & growth

25. Dark mode.
26. CSV/PDF export of transactions and AI analysis.
27. Budgets and savings goals.
28. Multi-account / household support.
29. Self-serve account deletion (currently manual, email-based only).
30. Stream AI responses instead of a blocking spinner during parse/analyze.
31. Search and filter across all transactions, not just per-file or per-month.

---
*See the full audit for architecture, database, security, and code-quality detail behind each item.*
