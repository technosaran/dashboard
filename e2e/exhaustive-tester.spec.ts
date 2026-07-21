import { test, expect } from '@playwright/test';

const MODULES = [
  '/dashboard',
  '/dashboard/accounts',
  '/dashboard/alternative-assets',
  '/dashboard/bonds',
  '/dashboard/budget',
  '/dashboard/crypto',
  '/dashboard/expenses',
  '/dashboard/family',
  '/dashboard/fno',
  '/dashboard/forex',
  '/dashboard/goals',
  '/dashboard/income',
  '/dashboard/investments',
  '/dashboard/ledger',
  '/dashboard/liabilities',
  '/dashboard/mutual-funds',
  '/dashboard/settings',
  '/dashboard/stocks',
  '/dashboard/transactions'
];

test.describe('Exhaustive Application Test Suite', () => {
  // Generous timeout since it will test 19 modules sequentially
  test.setTimeout(300000); 

  test('Test all modules sequentially with a single login session', async ({ page }) => {
    console.log("Logging into the application...");
    await page.goto('/login');
    await page.getByRole('button', { name: 'Sign In', exact: true }).click();
    
    // Fill in credentials
    await page.locator('input[type="email"]').fill('tester@example.com');
    await page.locator('input[type="password"]').fill('password123');
    await page.click('button[type="submit"]');
    
    // Wait for successful login
    await page.waitForURL(/dashboard/, { timeout: 15000 });
    console.log("Successfully logged in!");

    for (const mod of MODULES) {
      console.log(`\nTesting ${mod}...`);
      await page.goto(mod);
      await page.waitForLoadState('networkidle');
      
      // Basic assertion: Page should load without crashing
      await expect(page.locator('body')).not.toContainText('500 Internal Server Error');
      await expect(page.locator('body')).not.toContainText('404 Page Not Found');
      
      // Look for a common action button
      const actionButton = page.locator('button', { hasText: /(Add|New|Create)/i }).first();
      
      if (await actionButton.isVisible()) {
        console.log(`Action button found on ${mod}. Clicking...`);
        await actionButton.click();
        await page.waitForTimeout(1000); // Wait for modal
        
        const safeName = mod.replace(/\//g, '_').replace(/^_/, '');
        await page.screenshot({ path: `playwright-report/screenshots/exhaustive${safeName}_action.png`, fullPage: true });
        
        // Close modal if present to clean up for next module
        const closeBtn = page.locator('button', { hasText: /(Cancel|Close)/i }).first();
        if (await closeBtn.isVisible()) {
          await closeBtn.click();
        }
      } else {
        const safeName = mod.replace(/\//g, '_').replace(/^_/, '');
        await page.screenshot({ path: `playwright-report/screenshots/exhaustive${safeName}.png`, fullPage: true });
      }
      console.log(`Successfully tested ${mod}.`);
    }
  });
});
