import { test, expect } from '@playwright/test';

test.describe('Human Data Adder', () => {
  test.afterEach(async ({ page }, testInfo) => {
    if (testInfo.status !== testInfo.expectedStatus) {
        await page.screenshot({ path: `playwright-report/screenshots/failed-${Date.now()}.png`, fullPage: true });
    }
  });

  test('Log in and add data to all modules', async ({ page }) => {
    test.slow(); // Increases timeout

    // 1. Sign In as the pre-verified tester
    const testEmail = 'tester@example.com';
    console.log(`Navigating to login page to sign in: ${testEmail}...`);
    await page.goto('/login');
    
    // Switch to Sign In tab
    await page.getByRole('button', { name: 'Sign In', exact: true }).click();
    
    // Fill in credentials for a new account (mimic human typing)
    await page.locator('input[type="email"]').pressSequentially(testEmail, { delay: 50 });
    await page.locator('input[type="password"]').pressSequentially('password123', { delay: 50 });
    
    // Submit Sign In form
    await page.click('button[type="submit"]');
    
    // Wait for navigation to dashboard (or onboarding)
    await page.waitForURL(/dashboard|onboarding/, { timeout: 30000 });
    console.log('Successfully logged in!');

    // 2. Add an Account
    console.log('Navigating to Accounts...');
    await page.goto('/dashboard/accounts');
    
    // Wait for the empty state or the "New Account" button
    await page.waitForLoadState('networkidle');
    
    // Click "Create Account" (empty state) or "New Account" (header)
    const createBtn = page.getByRole('button', { name: 'Create Account', exact: true });
    const newBtn = page.getByRole('button', { name: 'New Account', exact: true });
    
    if (await createBtn.count() > 0 && await createBtn.isVisible()) {
      await createBtn.click();
    } else {
      await newBtn.click();
    }
    
    // Fill the drawer form using robust locators and realistic values
    const bankName = "HDFC Bank";
    const balance = Math.floor(Math.random() * 90000) + 10000;
    
    await page.getByPlaceholder("e.g. Primary Savings").pressSequentially(bankName, { delay: 50 });
    await page.locator('select#account-type').selectOption('checking');
    await page.getByPlaceholder("0.00").pressSequentially(balance.toString(), { delay: 50 });
    await page.getByPlaceholder("Search Banks...").pressSequentially('HDFC', { delay: 50 });
    
    // Wait for search results and click HDFC Bank
    await expect(page.getByText('HDFC Bank', { exact: true })).toBeVisible({ timeout: 10000 });
    await page.getByText('HDFC Bank', { exact: true }).click();
    
    await page.getByRole('button', { name: 'Open Account' }).click();
    
    // Wait for toast or drawer to close
    await expect(page.getByText(/created successfully|updated successfully/i)).toBeVisible({ timeout: 10000 });
    
    // 3. Add an Expense
    console.log('Navigating to Expenses...');
    await page.goto('/dashboard/expenses');
    await page.waitForLoadState('networkidle');
    
    // Find Add Expense button
    const addExpenseBtn = page.getByRole('button', { name: /Add Expense/i });
    const newExpenseBtn = page.getByRole('button', { name: /New Expense/i });
    
    if (await addExpenseBtn.count() > 0 && await addExpenseBtn.isVisible()) {
        await addExpenseBtn.click();
    } else if (await newExpenseBtn.count() > 0 && await newExpenseBtn.isVisible()) {
        await newExpenseBtn.click();
    } else {
        // Fallback generic search if exact match fails
        await page.locator('button').filter({ hasText: /expense/i }).last().click();
    }

    const expenseAmount = Math.floor(Math.random() * 3000) + 100;
    await page.locator('input[type="number"]').pressSequentially(expenseAmount.toString(), { delay: 50 });
    
    const textInputs = await page.locator('input[type="text"]').all();
    if (textInputs.length > 0) {
        await textInputs[0].pressSequentially('Groceries', { delay: 50 });
    }
    
    const submitExpenseBtn = page.getByRole('button', { name: /Add|Save|Create/i });
    if (await submitExpenseBtn.count() > 0) {
        await submitExpenseBtn.last().click();
    } else {
        await page.click('button[type="submit"]');
    }
    
    await expect(page.getByText(/success/i)).toBeVisible({ timeout: 10000 });

    // 4. Verification Screenshot
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: `playwright-report/screenshots/dashboard-human-${Date.now()}.png`, fullPage: true });
    
    console.log('Finished testing run.');
  });
});
