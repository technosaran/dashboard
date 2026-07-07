# Runbook: Application Scaling Strategy

This runbook guides developers on how to scale the application to handle high volumes of users and transactions.

## 1. Frontend Scaling (Vercel)
Next.js is deployed to Vercel, which auto-scales serverless execution out of the box.
- **Edge Assets**: Static files, images, and static routes are distributed via Vercel's global CDN automatically.
- **Image Optimization**: Ensure Next.js components use `next/image` to prevent large unoptimized image loads.

## 2. Caching & Redis Scaling
- **Cache Hit Ratio**: Monitor Redis query counts. Target a >80% hit ratio for user profiles and account balances.
- **Connection Limits**: Ensure your Redis connection pool size matches serverless concurrency. If Redis reaches connections limits, the Cache Service falls back to memory safely.

## 3. Supabase & Database Scaling
- **Connection Pooling**: Always connect to Supabase using transaction mode connection strings (e.g. pgBouncer) rather than direct postgres URLs to prevent socket exhaustion.
- **Index Optimization**: Check table scan query plans. Crucial query fields (`user_id`, `date`, `category`) must remain indexed.
