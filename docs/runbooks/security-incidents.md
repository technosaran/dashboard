# Runbook: Security Incident Response

This runbook guides engineers on identifying, containing, and recovering from security incidents in the FinanceOS application.

## 1. Identification
Common indicators of compromise:
- **DDoS/Auth Brute-forcing**: High frequency of 429 RateLimit responses logged by the security logger.
- **CSRF anomalies**: Spike in `csrf_validation_failure` logs.
- **Data access violations**: SQL execution failures or access violations on RLS policies.

## 2. Containment

### Step A: Block Attacking IPs
- Log into Vercel and set up firewall block rules to intercept attacking IP networks.

### Step B: Revoke Sessions
- If a user token is compromised, trigger a global sign-out via the Supabase client admin panel, invalidating all outstanding refresh tokens.

### Step C: Enable Maintenance Mode
- In case of a major data breach, set Vercel redirects to root to a maintenance static page.

## 3. Eradication & Recovery
- Patches for vulnerabilities must be merged to `main` to trigger the CI/CD build.
- Perform a complete database validation scan to verify data integrity.
- Check security logger audits.
- Notify affected users if sensitive parameters were exposed.
