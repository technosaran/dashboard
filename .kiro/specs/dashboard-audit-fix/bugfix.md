# Bugfix Requirements Document

## Introduction

A comprehensive audit of the FinanceOS Next.js + Supabase personal finance dashboard identified 12 confirmed bugs spanning security vulnerabilities, data-loss logic errors, incorrect chart computations, and UX defects. These bugs affect the `/api/sync` cron endpoint, browser Supabase singleton lifecycle, dashboard trend calculations, investment update actions, settings API health check, and password policy enforcement. Left unfixed, the most critical issues allow unauthenticated callers to trigger balance mutations for any user in the database.

---

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN `CRON_SECRET` is absent from the environment THEN the `/api/sync` auth guard short-circuits on `&&` and the 401 response is never returned, allowing unauthenticated access

1.2 WHEN an unauthenticated caller hits `/api/sync` THEN the route executes cross-user balance mutations via a raw Drizzle `pg.Pool` connection that bypasses Supabase RLS

1.3 WHEN the Next.js middleware evaluates a request to `/api/sync` THEN it skips the session check entirely because the route is listed in `PUBLIC_ROUTES`

1.4 WHEN a user signs out in one browser tab THEN the browser Supabase singleton is set to `null`, causing any subsequent `createClient()` call in another tab to create and store a fresh unauthenticated client as the singleton

1.5 WHEN the `onAuthStateChange` subscription is set up in `supabase-browser.ts` THEN `subscription.unsubscribe()` is called inside the callback before `subscription` is assigned, creating a fragile closure timing dependency

1.6 WHEN the dashboard six-month net-worth backward walk executes THEN the current month's income-minus-expense delta is subtracted from `netWorthINR` a second time, producing incorrect historical chart values because `netWorthINR` already incorporates the current month

1.7 WHEN `runningInvestments` is computed in the backward walk THEN the heuristic `income * 0.3 - expense * 0.1` produces a negative investment delta when expenses exceed 3× income, resulting in meaningless chart data (masked by `Math.max(0, ...)`)

1.8 WHEN the `transactions` array is iterated for `expenseTrend` collection THEN the first 15 expense-type transactions encountered are collected without sorting by date descending, so if the RPC returns data in ascending order the 15 oldest expenses are shown instead of the 15 most recent

1.9 WHEN `updateInvestment` is called with a partial data object THEN all undefined fields are spread directly into `.update({...})`, causing Supabase to serialize `undefined` as `null` and overwrite existing database column values with NULL

1.10 WHEN `checkApiHealth` is called THEN it fires eight outbound HTTP requests to external financial APIs with no authentication check, making the action callable by any unauthenticated request

1.11 WHEN a user resets their password THEN `updatePassword` previously enforced only a 6-character minimum, insufficient for a financial application (this has since been corrected to 8 in source; requirement retained for regression prevention)

1.12 WHEN the portfolio allocation pie chart is rendered in USD mode THEN Mutual Funds, Bonds, and Alt Assets are excluded from the USD breakdown, understating the total portfolio and rendering the pie chart incomplete

---

### Expected Behavior (Correct)

2.1 WHEN `CRON_SECRET` is absent from the environment THEN the system SHALL return a 401 Unauthorized response and deny access to `/api/sync` by default

2.2 WHEN an authenticated cron caller hits `/api/sync` THEN the system SHALL only execute mutations for users whose recurring expenses are being processed, with no cross-user data access outside the per-user loop

2.3 WHEN the Next.js middleware evaluates a request to `/api/sync` THEN the system SHALL run the session check against the route (it SHALL NOT be listed in `PUBLIC_ROUTES`)

2.4 WHEN a user signs out THEN the system SHALL NOT null the browser Supabase singleton; the existing client instance SHALL manage its own session state, preventing cross-tab race conditions

2.5 WHEN the `onAuthStateChange` subscription callback runs THEN the system SHALL invoke `unsubscribe()` on a reference captured outside the callback, or the self-unsubscribe pattern SHALL be removed entirely

2.6 WHEN the dashboard six-month net-worth backward walk executes THEN the system SHALL assign `netWorthINR` to the current month before the loop begins and use the loop only for the five prior months, preventing double-application of the current month's delta

2.7 WHEN the investment backward walk computes `runningInvestments` THEN the system SHALL use only `Math.max(0, runningInvestments)` without a heuristic that can go negative, or SHALL use actual investment data to drive the chart

2.8 WHEN `expenseTrend` is collected THEN the system SHALL iterate over `transactions` sorted by `date` descending so that the 15 most recent expenses are captured

2.9 WHEN `updateInvestment` (and `updateMFHolding`) is called with partial data THEN the system SHALL build the update payload by including only keys whose values are explicitly defined (not `undefined`), preventing unintended NULL overwrites

2.10 WHEN `checkApiHealth` is called THEN the system SHALL verify the caller is an authenticated user via `getUser()` before issuing any outbound requests

2.11 WHEN `updatePassword` is called THEN the system SHALL enforce a minimum password length of 8 characters

2.12 WHEN the portfolio allocation pie chart is rendered in USD mode THEN the system SHALL include all asset classes that have a USD-equivalent value (or mark non-USD assets as INR-only), ensuring the chart accurately represents the full portfolio

---

### Unchanged Behavior (Regression Prevention)

3.1 WHEN `CRON_SECRET` is set and the correct `Authorization: Bearer <secret>` header is provided THEN the system SHALL CONTINUE TO execute the sync route normally (price updates + recurring expenses)

3.2 WHEN a valid authenticated user signs in THEN the system SHALL CONTINUE TO create and cache a single browser Supabase client that serves all tabs without triggering additional WebSocket connections

3.3 WHEN the dashboard six-month trend chart is in "Cash Flow" mode THEN the system SHALL CONTINUE TO render income and expense area charts using the same `trendMap` data structure

3.4 WHEN `expenseTrend` contains data THEN the system SHALL CONTINUE TO display it in the dashboard's recent expense section with the same UI structure

3.5 WHEN `updateInvestment` is called with all fields explicitly provided THEN the system SHALL CONTINUE TO update all provided fields in the database

3.6 WHEN `updateMFHolding` is called with all fields explicitly provided THEN the system SHALL CONTINUE TO update all provided fields in the `mutual_funds` table

3.7 WHEN `updateBond` is called with partial data THEN the system SHALL CONTINUE TO use the selective payload builder (already correct) — no regression allowed

3.8 WHEN `updateAlternativeAsset` is called with partial data THEN the system SHALL CONTINUE TO use the selective payload builder (already correct) — no regression allowed

3.9 WHEN an unauthenticated user accesses any `/dashboard/*` route THEN the system SHALL CONTINUE TO redirect them to `/login` via the middleware

3.10 WHEN the portfolio pie chart is rendered in INR mode THEN the system SHALL CONTINUE TO show all six asset classes (Cash, Stocks, Mutual Funds, Assets, Bonds, Forex) filtered to those with a positive value

3.11 WHEN `checkApiHealth` is called by an authenticated user THEN the system SHALL CONTINUE TO return health status and latency for all configured external APIs

3.12 WHEN a user resets their password with a valid password of 8+ characters THEN the system SHALL CONTINUE TO update the password via Supabase Auth without error
