import { test, expect } from "@playwright/test";

test.describe("Health & Landing", () => {
  test("health endpoint returns OK", async ({ request }) => {
    const res = await request.get("/api/health");
    expect(res.ok()).toBe(true);
    const body = await res.json();
    expect(body.status).toBe("ok");
  });

  test("landing page loads", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/Shiftfy|Schichtplan/i);
  });

  test("landing page has login link", async ({ page }) => {
    await page.goto("/");
    const loginLink = page.locator('a[href*="login"]').first();
    await expect(loginLink).toBeVisible();
  });
});
