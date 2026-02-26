import { test, expect } from "@playwright/test";

test.describe("Protected Routes", () => {
  test("dashboard redirects to login when unauthenticated", async ({
    page,
  }) => {
    await page.goto("/dashboard");

    // Should redirect to login page
    await page.waitForURL(/login/, { timeout: 10_000 });
    expect(page.url()).toContain("login");
  });

  test("employees page redirects to login when unauthenticated", async ({
    page,
  }) => {
    await page.goto("/mitarbeiter");

    await page.waitForURL(/login/, { timeout: 10_000 });
    expect(page.url()).toContain("login");
  });

  test("shift plan page redirects to login when unauthenticated", async ({
    page,
  }) => {
    await page.goto("/schichtplan");

    await page.waitForURL(/login/, { timeout: 10_000 });
    expect(page.url()).toContain("login");
  });
});
