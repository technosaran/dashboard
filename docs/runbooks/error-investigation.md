# Runbook: Production Error Investigation

This runbook guides developers on how to investigate and diagnose errors reported in the FinanceOS production environment.

## 1. Sentry Dashboard Triage
Most runtime errors and unhandled exceptions are caught by Sentry.
- **Access Sentry**: Log into your Sentry organization dashboard and select the `finance-dashboard` project.
- **Filter Parameters**: Filter by environment (`production`) and sort by the latest occurrence or total frequency.
- **Trace Analysis**: Verify the exception trace and find the specific line of code that threw the error. Check the associated request context (IP, route path, browser, request ID).

## 2. Check Structured Logs (Pino)
Our system logs structured Pino messages.
- **Locate logs**: Access Vercel logs or your external log aggregator (e.g. Logflare, Papertrail).
- **Find by Request ID**: If a user reports a failed request, extract their `requestId` from the error boundary message on their client UI. Search for this ID in your logs to trace the entire database and API sequence.
- **Security Events**: Filter for logs tagged with `category: "security"` to analyze rate limit violations, invalid CSRF tokens, or brute-force logins.

## 3. Common Errors and Resolution

### a. `DATABASE_ERROR` / Database connection timeouts
- **Cause**: Supabase connection pool is saturated, or SQL connection strings are expired.
- **Fix**: Check Supabase dashboard database load. Verify that Drizzle connects using the correct connection pool string rather than direct connection urls.

### b. `RATE_LIMIT_EXCEEDED` (HTTP 429)
- **Cause**: Client IP is exceeding limit slots (e.g. syncing market prices or logging in too fast).
- **Fix**: Verify if it is a malicious scraper or automated request loop. If legitimate, request limits can be adjusted in preset values inside `src/lib/rate-limiter.ts`.
