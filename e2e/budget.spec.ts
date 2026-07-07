import { test, expect } from '@playwright/test';

test.describe('Budget Management E2E', () => {
  test('redirects to login when unauthenticated', async ({ page }) => {
    await page.goto('/dashboard/budget');
    await expect(page).toHaveURL(/.*\/login/);
  });
});
