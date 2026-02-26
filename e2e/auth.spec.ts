import { test, expect } from "@playwright/test";

test.describe("Authentication", () => {
  test("login page loads", async ({ page }) => {
    await page.goto("/login");
    await expect(
      page.locator("input[type='email'], input[name='email']").first(),
    ).toBeVisible();
    await expect(
      page.locator("input[type='password'], input[name='password']").first(),
    ).toBeVisible();
  });

  test("login with invalid credentials shows error", async ({ page }) => {
    await page.goto("/login");

    await page
      .locator("input[type='email'], input[name='email']")
      .first()
      .fill("invalid@example.com");
    await page
      .locator("input[type='password'], input[name='password']")
      .first()
      .fill("wrongpassword");

    await page.locator("button[type='submit']").first().click();

    // Should show some kind of error (toast, inline message, etc.)
    await expect(
      page
        .locator('[role="alert"], [data-error], .text-red-500, .text-red-600')
        .first(),
    ).toBeVisible({ timeout: 10_000 });
  });

  test("register page loads", async ({ page }) => {
    await page.goto("/register");
    await expect(
      page.locator("input[type='email'], input[name='email']").first(),
    ).toBeVisible();
  });

  test("pricing page loads", async ({ page }) => {
    await page.goto("/pricing");
    await expect(page.locator("text=STARTER").first()).toBeVisible({
      timeout: 10_000,
    });
  });
});
