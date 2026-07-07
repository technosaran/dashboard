/**
 * Sentry Edge Configuration for Next.js.
 * Handles Vercel edge middleware/functions error reporting.
 */

import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN || process.env.SENTRY_DSN,
  
  // Adjust this value in production, or use Sentry's dynamic sampling
  tracesSampleRate: 1.0,

  // Setting this option to true will print useful information to the console while you're setting up Sentry.
  debug: false,
});
