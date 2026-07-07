# Runbook: Database Migrations Management

This runbook guides developers on how to safely generate, test, and execute PostgreSQL database migrations.

## 1. Creating Migrations (Local)
We use Drizzle Kit to model schema changes and Supabase CLI to generate SQL migration scripts.

1. Modify database tables in `src/db/schema.ts`.
2. Generate the migration files locally:
   ```bash
   npx drizzle-kit generate
   ```
3. This creates a new SQL script in `supabase/migrations/`. Rename it if necessary to add context (e.g. `YYYYMMDDHHMMSS_add_table_xyz.sql`).

## 2. Testing Migrations Locally
1. Run a local Supabase database instance:
   ```bash
   supabase start
   ```
2. Apply migrations to the local test database:
   ```bash
   supabase db reset
   ```
3. Verify that all 147+ migrations compile and apply without SQL runtime errors.

## 3. Deploying to Production
Migrations are automatically deployed on commits to `main`:
- The GitHub Action workflow `deploy-migrations.yml` deploys all pending SQL scripts to your production Supabase database.
- Database changes should be designed to be backwards-compatible so that the application build can run during the migration window.
