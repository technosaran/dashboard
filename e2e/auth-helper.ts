import { Page } from "@playwright/test";

export async function loginOrSignUp(page: Page, email: string = `tester+${Date.now()}_${Math.floor(Math.random() * 10000)}@example.com`, password: string = "password123") {
  console.log(`Authenticating test user: ${email}...`);
  await page.goto("/login");
  await page.waitForLoadState("networkidle");

  // Attempt Sign Up first
  const signUpTab = page.getByRole("button", { name: /Sign Up|Create Account/i }).or(page.locator("button", { hasText: /Sign Up/i }));
  if (await signUpTab.count() > 0 && await signUpTab.first().isVisible()) {
    await signUpTab.first().click();
  }

  const emailInput = page.locator('input[type="email"], input[name="email"]');
  const passwordInput = page.locator('input[type="password"], input[name="password"]');

  await emailInput.fill(email);
  await passwordInput.fill(password);

  const submitBtn = page.locator('button[type="submit"]').first();
  await submitBtn.click();

  try {
    await page.waitForURL(/dashboard|onboarding/, { timeout: 7000 });
    console.log("Successfully logged in!");
    return;
  } catch {
    const errorText = await page.locator('.text-rose-400').innerText().catch(() => null);
    console.log("Sign up failed, maybe already exists, attempting sign in... Error on page:", errorText);
  }

  // Fallback to Sign In
  await page.goto("/login");
  await page.waitForLoadState("networkidle");

  const signInBtn = page.getByRole("button", { name: "Sign In", exact: true });
  if (await signInBtn.isVisible()) {
    await signInBtn.click();
  }

  await emailInput.fill(email);
  await passwordInput.fill(password);
  await submitBtn.click();
  await page.waitForURL(/dashboard|onboarding/, { timeout: 15000 });

  console.log("Successfully authenticated!");
}
