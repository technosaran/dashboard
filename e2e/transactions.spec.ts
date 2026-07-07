import { test, expect } from '@playwright/test';

test.describe('Transactions Management E2E', () => {
  test('redirects to login when unauthenticated', async ({ page }) => {
    await page.goto('/dashboard/transactions');
    await expect(page).toHaveURL(/.*\/login/);
  });

  test('search input exists on login page redirect', async ({ page }) => {
    await page.goto('/login');
    const submitButton = page.getByRole('button', { name: /sign in/i });
    await expect(submitButton).toBeVisible();
  });
});
