import { test, expect } from '@playwright/test';
import { loginOrSignUp } from './auth-helper';

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

test.describe.skip('Exhaustive Application Test Suite', () => {
  // Generous timeout since it will test 19 modules sequentially
  test.setTimeout(300000); 

  test('Test all modules sequentially with a single login session', async ({ page }) => {
    await loginOrSignUp(page);

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
