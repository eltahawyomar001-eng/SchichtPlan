import { test, expect } from "@playwright/test";

test.describe("Public Pages", () => {
  test("impressum page loads", async ({ page }) => {
    await page.goto("/impressum");
    await expect(page.locator("text=Impressum").first()).toBeVisible({
      timeout: 10_000,
    });
  });

  test("datenschutz page loads", async ({ page }) => {
    await page.goto("/datenschutz");
    await expect(page.locator("text=Datenschutz").first()).toBeVisible({
      timeout: 10_000,
    });
  });

  test("AGB page loads", async ({ page }) => {
    await page.goto("/agb");
    await expect(
      page.locator("text=Allgemeine Geschäftsbedingungen, text=AGB").first(),
    ).toBeVisible({ timeout: 10_000 });
  });

  test("password reset page loads", async ({ page }) => {
    await page.goto("/passwort-vergessen");
    await expect(
      page.locator("input[type='email'], input[name='email']").first(),
    ).toBeVisible();
  });
});

test.describe("Security Headers", () => {
  test("response includes security headers", async ({ request }) => {
    const res = await request.get("/");
    const headers = res.headers();

    expect(headers["x-content-type-options"]).toBe("nosniff");
    expect(headers["x-frame-options"]).toBe("DENY");
    expect(headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
  });

  test("API response includes security headers", async ({ request }) => {
    const res = await request.get("/api/health");
    const headers = res.headers();

    expect(headers["x-content-type-options"]).toBe("nosniff");
  });
});

test.describe("API Endpoints", () => {
  test("unauthenticated API call returns 401", async ({ request }) => {
    const res = await request.get("/api/employees");
    expect(res.status()).toBe(401);
  });

  test("unauthenticated absence request returns 401", async ({ request }) => {
    const res = await request.get("/api/absences");
    expect(res.status()).toBe(401);
  });

  test("unauthenticated shift plan returns 401", async ({ request }) => {
    const res = await request.get("/api/shifts");
    expect(res.status()).toBe(401);
  });
});
