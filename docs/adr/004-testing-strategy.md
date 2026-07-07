# Architectural Decision Record (ADR) 004: Comprehensive Testing Strategy

## Status
Approved

## Context
The application includes complex financial computations, transfer processes, and ledger-based balance adjustments. A bug in the transaction logic could corrupt user account balances or result in incorrect reports.

To guarantee correctness:
- We need to establish a clear unit testing framework.
- We need to enforce code coverage targets to prevent unchecked code regression.
- We need to align testing frameworks to prevent test setup conflicts.

## Decision
We adopted Vitest as our primary test framework for unit and integration testing.
- **Framework**: Vitest provides immediate support for ES modules, fast compilation via Vite, and compatibility with Next.js app structure.
- **Setup**: Mocks for browser layouts (`matchMedia`, `ResizeObserver`) and testing utilities are central in `src/__tests__/setup.ts`.
- **Coverage**: We set an 80% coverage threshold target (lines, functions, branches, statements). The coverage reporting tool uses the native `v8` provider.
- **End-to-End**: Playwright handles user flows (e.g. login, adding new transactions) inside `e2e/` to test UI components and Edge Middleware logic.

## Consequences
- Single test runner reduces runtime dependency overhead in the CI container.
- High test execution speeds (under 4 seconds for unit tests) encourage frequent test verification during development.
- Playwright catches integration issues and Edge Middleware failures that are out of scope for isolated unit tests.
