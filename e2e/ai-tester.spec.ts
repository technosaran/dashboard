import { test, expect } from '@playwright/test';
import { auto } from 'auto-playwright';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load variables from .env.local where the GEMINI_API_KEY is saved
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

// Configure auto-playwright to use Gemini instead of OpenAI
const autoOptions = {
  openaiApiKey: process.env.GEMINI_API_KEY,
  openaiBaseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai/',
  model: 'gemini-1.5-pro'
};

test.describe('AI Human-like App Tester', () => {
  // We give a generous timeout because LLM API calls take time
  test.setTimeout(120000);

  test('Log in and interact intelligently', async ({ page }) => {
    console.log("Navigating to login page...");
    await page.goto('/login');

    // Step 1: Login using natural language
    console.log("Using AI to log in...");
    await auto('Login with the email "tester@example.com" and password "password123"', { page, test }, autoOptions);

    // Ensure we are redirected to dashboard before proceeding
    console.log("Waiting for navigation to dashboard...");
    await page.waitForURL(/dashboard|onboarding/, { timeout: 15000 });
    
    // Step 2: Navigate and interact
    console.log("Using AI to navigate to Accounts and create a random account...");
    await auto('Navigate to the Accounts page, then click the button to add a new account, and create a random dummy account with a random bank name', { page, test }, autoOptions);
    
    console.log("Using AI to navigate to Expenses and add an expense...");
    await auto('Navigate to the Expenses page and add a new random expense for groceries', { page, test }, autoOptions);

    // Step 3: Take a final screenshot
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: `playwright-report/screenshots/ai-human-test-${Date.now()}.png`, fullPage: true });

    console.log("Finished AI testing script.");
  });
});
