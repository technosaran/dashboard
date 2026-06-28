import { test, expect } from '@playwright/test';

test('homepage has correct title and redirects to login', async ({ page }) => {
  await page.goto('/');

  // Expect a title "to contain" a substring.
  await expect(page).toHaveTitle(/Login/);
});

test('login page is accessible', async ({ page }) => {
  await page.goto('/login');

  // Verify that the login form is present
  const emailInput = page.getByPlaceholder("you@example.com");
  await expect(emailInput).toBeVisible();
});
