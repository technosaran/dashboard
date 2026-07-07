# Runbook: Production Deployment and Rollbacks

This runbook outlines how to deploy changes to the production environment and perform a safe rollback in case of issues.

## 1. Automated Deployment Pipeline
We utilize GitHub Actions integrated with Vercel for CD:
- Merging a PR into the `main` branch triggers the CI pipeline.
- If all lint, unit tests, and build verification checks pass, the deployment workflow (`.github/workflows/deploy.yml`) compiles the code and deploys it to the production environment on Vercel.

## 2. Manual Deployment
If you need to trigger a manual release:
1. Ensure your local branch is synchronized with `main`.
2. Run the deployment script via Vercel CLI:
   ```bash
   vercel --prod
   ```
3. Verify build health by checking the deployment log in the Vercel Dashboard.

## 3. Rollback Procedures
If a release causes critical errors or breaks production:

### Option A: Vercel Rollback (Instant)
1. Go to the Vercel Dashboard -> Deployments tab.
2. Select the last stable deployment before the current release.
3. Click the options menu (three dots) and select **Instant Rollback**.
4. Confirm the operation. Traffic will instantly route to the previous stable build.

### Option B: Git Revert (Standard)
1. Revert the commit on the `main` branch:
   ```bash
   git revert <commit-hash>
   git push origin main
   ```
2. The CI/CD pipeline will automatically build and deploy the reverted code.
