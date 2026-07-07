# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-07-06

### Added
- Custom Error classes (`AppError`, `ValidationError`, `AuthenticationError`, `AuthorizationError`, `NotFoundError`, `DatabaseError`, `RateLimitError`, `CsrfError`) in `src/lib/errors.ts`.
- Global Error Handler Service in `src/lib/error-handler.ts` to cleanly log and sanitize responses.
- Wrapper AuthService for Supabase Auth session validation and refresh in `src/lib/auth-service.ts`.
- Structured Security Event Logger in `src/lib/security-logger.ts` for tracking authentication, rate limits, and inputs.
- Row-Level Security (RLS) SQL policies migration script for all 24 database tables in `supabase/migrations/20260706100000_rls_policies.sql`.
- Repository Pattern implementation with generic `SupabaseRepository` base class and specific repositories (`TransactionRepository`, `AccountRepository`, `BudgetRepository`, `InvestmentRepository`).
- Dependency Injection (DI) Container in `src/lib/container.ts` to manage instance lifetimes.
- Service Layer separation with `TransactionService`, `AccountService`, and `BudgetService`.
- Redis-backed sliding window `RateLimiter` in `src/lib/rate-limiter.ts`.
- Redis-backed `CacheService` with support for pattern deletion and TTL configurations in `src/lib/cache-service.ts`.
- Custom hooks `useDebounce` and `useDebouncedCallback` in `src/hooks/useDebounce.ts`.
- Automated Environment validation script in `scripts/validate-env.ts` checking required variables at startup.
- Production deployment workflow configuration in `.github/workflows/deploy.yml`.

### Changed
- Integrated Rate Limiting and CSRF protection validation checks into Next.js edge middleware `src/middleware.ts`.
- Enhanced GitHub Actions CI workflow (`.github/workflows/main.yml`) with node caching, dependency audits, and build validation steps.
- Configured ESLint with strict quality rules (`eslint.config.mjs`) including unused variable errors, console warnings, and eqeqeq checks.
- Switched default test runner configuration to Vitest for speed and compatibility with ES modules.
- Refactored `AccountsClient.tsx` history cut-off calculation to be a pure function, resolving React Compiler purity issues.

### Security
- Enabled RLS across all tables in PostgreSQL.
- CSRF Double-submit cookie validation enforced on state-changing API endpoints.
- Rate limiting active on API, Auth, and sync routes.
- Security event logging enabled for all authentication and validation failures.
