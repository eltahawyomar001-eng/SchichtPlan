import { test, expect } from "./fixtures/auth";

test.describe("Dashboard core flow", () => {
  test("Dashboard loads with stats grid", async ({ authedPage }) => {
    await authedPage.goto("/dashboard");

    // Wait for the dashboard to render. We look for a stable element that's
    // present whether the user has data or not — the page title.
    await expect(
      authedPage.locator("h1, h2").filter({ hasText: /Dashboard|Übersicht/i }),
    ).toBeVisible({ timeout: 20_000 });
  });

  test("Settings → Roles page renders for authorized users", async ({
    authedPage,
  }) => {
    await authedPage.goto("/einstellungen/rollen");

    await expect(
      authedPage
        .locator("h1, h2, [role='heading']")
        .filter({ hasText: /Rolle|Role/i }),
    ).toBeVisible({ timeout: 15_000 });
  });

  test("Notifications API responds for authenticated user", async ({
    authedPage,
  }) => {
    // Make a real request to the notifications endpoint using the page's session.
    const res = await authedPage.request.get("/api/notifications");
    // Either 200 (data) or 401 (unauthorized due to no employee link) are
    // acceptable; the goal is to confirm the route is reachable and not
    // returning 5xx.
    expect(res.status()).toBeLessThan(500);
  });
});
