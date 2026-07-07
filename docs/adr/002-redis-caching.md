# Architectural Decision Record (ADR) 002: Redis Caching Strategy

## Status
Approved

## Context
The FinanceOS dashboard handles a high volume of transactions, accounts, and budgets. Loading these details on every route hit causes redundant database roundtrips, increasing database CPU load and introducing noticeable user latencies.

We need a distributed caching layer that:
- Accelerates response times for read-heavy operations (e.g. transaction summaries, monthly utilization statistics).
- Integrates gracefully into our serverless Next.js API routes.
- Supports a local in-memory fallback to avoid application failures if Redis goes offline.

## Decision
We decided to implement a Cache-aside caching layer backed by Redis using `ioredis`.
- We created a centralized `CacheService` in `src/lib/cache-service.ts`.
- It implements the cache-aside pattern where reads attempt to load from Redis first, and write queries invalidate target keys immediately.
- To prevent deployment failures in local development or if Redis is unreachable, we wrap the raw Redis connection with error boundaries and fall back to in-memory key storage gracefully.
- Specific TTL parameters are configured based on data updates:
  - User profiles: 1 hour
  - Account summaries: 5 minutes
  - Transaction statistics: 2 minutes
  - Budget monthly summaries: 5 minutes

## Consequences
- **Performance Improvements**: Frequently accessed database query payloads are resolved from memory in sub-10ms times.
- **Improved Database Efficiency**: Avoids repetitive aggregations (e.g. SUMs over transaction history) on every dashboard render.
- **Failover Security**: The client falls back to memory safely without throwing raw network exceptions or blocking request execution.
