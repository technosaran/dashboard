import { test } from '@playwright/test';
import { GeminiAgent } from './gemini-agent';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

test.describe('Native Gemini Playwright Testing', () => {
  // Give ample timeout as the AI has to parse the page multiple times
  test.setTimeout(120000);

  test('Log in and interact intelligently using native Gemini API', async ({ page }) => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is not set in .env.local");
    }

    const agent = new GeminiAgent(page, apiKey);

    // 1. Navigation and Login
    await page.goto('/login');
    await agent.execute('Click the Sign In button or tab to switch to login mode if needed, then fill out the email with "tester@example.com" and password with "password123", then click the submit button to log in.', 6);

    // 2. Wait for Dashboard to Load
    console.log("Waiting for navigation to dashboard...");
    await page.waitForURL(/dashboard/, { timeout: 15000 });
    await page.waitForLoadState('networkidle');

    // 3. Test Dashboard interaction
    await agent.execute('Find the Accounts link in the sidebar or dashboard and click it to go to the Accounts page.', 3);
    await page.waitForLoadState('networkidle');

    // 4. Create an Account
    await agent.execute('Find the button to add a new account, click it, fill out the dummy account details (name and random balance), and save it.', 5);

    // 5. Take final screenshot
    await page.screenshot({ path: `playwright-report/screenshots/native-gemini-test-${Date.now()}.png`, fullPage: true });
    
    console.log("Finished native Gemini AI testing.");
  });
});
