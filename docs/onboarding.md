# Developer Onboarding Guide

Welcome to the FinanceOS Personal Finance Dashboard! This guide will help you set up your local development environment and understand the core architecture of the codebase.

## Prerequisites
Before you begin, ensure you have the following installed:
- **Node.js**: Version 20 or higher
- **npm**: Version 10 or higher
- **Supabase CLI**: Required for local database migrations and type generation
- **Docker**: Optional (required if running a local Redis container)

## Project Setup

1. **Clone the repository** and navigate to the project directory:
   ```bash
   git clone <repo-url>
   cd dashboard
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Configure Environment Variables**:
   Copy `.env.example` to `.env.local` and configure the values:
   ```bash
   cp .env.example .env.local
   ```
   *Note: Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` with your Supabase credentials.*

4. **Validate Environment**:
   Run the verification script to confirm your local environment is correctly configured:
   ```bash
   npm run validate-env
   ```

## Development Commands

- **Start Dev Server**:
  ```bash
  npm run dev
  ```
  Runs the application in development mode with Turbopack at [http://localhost:3000](http://localhost:3000).

- **Type Check**:
  ```bash
  npx tsc --noEmit
  ```

- **Run Linter**:
  ```bash
  npm run lint
  ```

- **Run Unit Tests (Vitest)**:
  ```bash
  npm test
  ```

- **Run E2E Tests (Playwright)**:
  ```bash
  npm run test:e2e
  ```

## Architecture Overview

- **Routing Layer**: Next.js App Router (`src/app/`). Feature pages are located under the protected `src/app/dashboard/` route group.
- **Data Access Layer**: Abstracted behind the **Repository Pattern** (`src/repositories/`). UI components must never query database instances directly.
- **Business Logic Layer**: Encapsulated in **Services** (`src/services/`) and registered via the **Dependency Injection Container** (`src/lib/container.ts`).
- **Security & Middleware**: Located in `src/middleware.ts`. Implements CSP headers, double-submit cookie CSRF checking, and sliding-window rate limiting.
- **Caching Layer**: Backed by a Redis Client wrapper (`src/lib/redis.ts`) and managed via `CacheService` (`src/lib/cache-service.ts`) with model-specific TTL parameters.
