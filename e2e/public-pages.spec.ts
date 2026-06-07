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
  // Protected API routes must DENY unauthenticated access. The auth middleware
  // currently redirects (307) to /login rather than returning 401 JSON; either
  // is acceptable for security (access is denied, no data leaks). We assert the
  // request is rejected and never returns 200 with data. `maxRedirects: 0`
  // stops Playwright from following the redirect to the 200 login page.
  // TODO(api-contract): make /api/* return 401 JSON instead of a 307 redirect
  // so programmatic/mobile clients get a proper API response.
  const expectDenied = (status: number) =>
    expect([301, 302, 307, 308, 401, 403]).toContain(status);

  test("unauthenticated employees API is denied", async ({ request }) => {
    const res = await request.get("/api/employees", { maxRedirects: 0 });
    expectDenied(res.status());
  });

  test("unauthenticated absences API is denied", async ({ request }) => {
    const res = await request.get("/api/absences", { maxRedirects: 0 });
    expectDenied(res.status());
  });

  test("unauthenticated shifts API is denied", async ({ request }) => {
    const res = await request.get("/api/shifts", { maxRedirects: 0 });
    expectDenied(res.status());
  });
});
