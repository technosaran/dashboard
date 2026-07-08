# Troubleshooting Guide

Common issues encountered when developing or running the FinanceOS personal finance dashboard, along with their solutions.

## 1. Local Development Issues


### Redis Connection Error: "ECONNREFUSED"
- **Cause**: The application is trying to connect to Redis (`REDIS_URL`) but no Redis server is running at that port.
- **Fix**: Make sure your local Docker Redis container is started, or check that `REDIS_URL` in `.env.local` is correct. If Redis is unreachable, the application will automatically fall back to standard in-memory storage.

## 2. Test Execution Issues

### Vitest Fails with "Failed to resolve import '@/lib/...'"
- **Cause**: Vite path alias resolution is not matching your TypeScript compiler config.
- **Fix**: Confirm that `resolve.alias` in `vitest.config.ts` points correctly to `./src` using `path.resolve`.

### Jest Fails to Run with "Cannot use import statement outside a module"
- **Cause**: Jest runner is trying to execute ES Module tests without transpiling them correctly.
- **Fix**: We transitioned the unit testing framework to Vitest. Run your test suite using the standard command:
  ```bash
  npm test
  ```
