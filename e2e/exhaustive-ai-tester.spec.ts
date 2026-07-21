import { test, expect } from '@playwright/test';
import { auto } from 'auto-playwright';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const autoOptions = {
  openaiApiKey: process.env.GEMINI_API_KEY,
  openaiBaseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai/',
  model: 'gemini-1.5-pro'
};

const MODULES_TO_TEST = [
  { route: '/dashboard/accounts', instruction: 'Find the add account button, click it, fill out the drawer form to create a new random dummy account, and submit it.' },
  { route: '/dashboard/expenses', instruction: 'Click the button to add a new expense, fill in a random amount and a description like "Groceries", and save it.' },
  { route: '/dashboard/income', instruction: 'Add a new income source with a random amount and a description like "Salary".' },
  { route: '/dashboard/crypto', instruction: 'Add a new crypto asset for Bitcoin (BTC) with a random quantity and value.' },
  { route: '/dashboard/stocks', instruction: 'Add a new stock asset for AAPL with a random quantity and purchase price.' },
  { route: '/dashboard/goals', instruction: 'Create a new financial goal called "Vacation" with a target amount of 5000 and target date.' },
  { route: '/dashboard/family', instruction: 'Add a new family member to track finances together.' },
  { route: '/dashboard/budget', instruction: 'Set up a new monthly budget limit for a random category.' },
  { route: '/dashboard/alternative-assets', instruction: 'Add a new alternative asset like "Rolex Watch" with an estimated value.' },
  { route: '/dashboard/liabilities', instruction: 'Add a new liability like "Car Loan" with a random remaining balance.' }
];

test.describe('Exhaustive AI Human-like App Tester', () => {
  // Give this massive test a very long timeout (20 minutes)
  test.setTimeout(1200000);

  test('Log in and interact intelligently with all modules', async ({ page }) => {
    
    // 1. Login
    console.log("Navigating to login page...");
    await page.goto('/login');
    console.log("Using AI to log in...");
    await auto('Login with the email "tester@example.com" and password "password123"', { page, test }, autoOptions);

    console.log("Waiting for navigation to dashboard...");
    await page.waitForURL(/dashboard/, { timeout: 15000 });
    
    // 2. Iterate through modules
    for (const mod of MODULES_TO_TEST) {
      console.log(`\n--- Testing Module: ${mod.route} ---`);
      
      // Navigate to the module
      await page.goto(mod.route);
      await page.waitForLoadState('networkidle');
      
      try {
        // Execute the AI instruction
        console.log(`Executing AI Instruction: ${mod.instruction}`);
        await auto(mod.instruction, { page, test }, autoOptions);
        
        // Take a screenshot of the result
        const safeName = mod.route.replace(/\//g, '_').replace(/^_/, '');
        await page.screenshot({ path: `playwright-report/screenshots/exhaustive_${safeName}_success.png`, fullPage: true });
        console.log(`✅ Module ${mod.route} successfully tested.`);
      } catch (err: any) {
        console.error(`❌ Module ${mod.route} failed:`, err.message);
        // Take a failure screenshot
        const safeName = mod.route.replace(/\//g, '_').replace(/^_/, '');
        await page.screenshot({ path: `playwright-report/screenshots/exhaustive_${safeName}_failed.png`, fullPage: true });
        // We continue testing other modules even if one fails
      }
    }

    console.log("\nFinished Exhaustive AI testing script.");
  });
});
