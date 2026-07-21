import { test, expect } from '@playwright/test';

test('visit homepage and take screenshot', async ({ page }) => {
  await page.goto('http://localhost:3000');
  await page.screenshot({ path: 'homepage.png' });
  expect(true).toBe(true);
});
