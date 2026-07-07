# Architectural Decision Record (ADR) 003: Core Security Architecture

## Status
Approved

## Context
As a personal finance application, maintaining state-of-the-art security boundaries is critical. The application handles highly sensitive transaction details, bank account credentials, and balance statistics.

The application must be hardened against standard OWASP vulnerabilities, including:
- Cross-Site Request Forgery (CSRF)
- Cross-Site Scripting (XSS)
- Denial of Service (DoS) and Brute-force attacks
- Unauthorized data access (data leakage between user accounts)

## Decision
We implemented a multi-layered security architecture:
1. **CSRF Double-Submit Cookie**: Edge middleware validates that state-changing API methods (POST, PUT, DELETE, PATCH) have a matching CSRF header and cookie token payload.
2. **Content Security Policy (CSP)**: Generates random base64 nonces on every page request to strictly lock down script injection vectors.
3. **Sliding Window Rate Limiting**: Intercepts request flows before authentication to check request counts by client IP. Limits are enforced depending on route sensitivity (e.g. 5 requests/min for Auth, 100/min for general API).
4. **Row-Level Security (RLS)**: Enforces access controls directly inside the PostgreSQL database. Every user table has RLS active (`ALTER TABLE ENABLE ROW LEVEL SECURITY`) with policies ensuring `user_id = auth.uid()`.
5. **Security Audits**: Integrated dependency security scans in the CI/CD pipeline to catch high-severity vulnerabilities before code merge.

## Consequences
- The application meets industry compliance standards for personal data protection.
- Database compromises or application vulnerabilities are mitigated by fallback database policies (RLS).
- API routes are protected from brute force and scraper sweeps.
