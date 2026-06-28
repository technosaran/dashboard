import { test, expect } from '@playwright/test';

test.describe('Family Management E2E', () => {
  test('redirects to login when unauthenticated', async ({ page }) => {
    await page.goto('/dashboard/family');
    await expect(page).toHaveURL(/.*\/login/);
  });

  test('login page elements are visible', async ({ page }) => {
    await page.goto('/login');
    const emailInput = page.getByPlaceholder("you@example.com");
    const passwordInput = page.getByPlaceholder("••••••••");
    const submitButton = page.getByRole('button', { name: /sign in/i });

    await expect(emailInput).toBeVisible();
    await expect(passwordInput).toBeVisible();
    await expect(submitButton).toBeVisible();
  });
});
