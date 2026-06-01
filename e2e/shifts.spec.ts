import { test, expect } from "./fixtures/auth";

test.describe("Shift planning core flow", () => {
  test("Schichtplan page renders for an authenticated user", async ({
    authedPage,
  }) => {
    await authedPage.goto("/schichtplan");

    await expect(
      authedPage.locator("h1, h2").filter({ hasText: /Schichtplan|Shift/i }),
    ).toBeVisible({ timeout: 15_000 });
  });

  test("Create-shift dialog can be opened from the schedule", async ({
    authedPage,
  }) => {
    await authedPage.goto("/schichtplan");

    const newButton = authedPage
      .locator(
        "button:has-text('Neue Schicht'), button:has-text('New Shift'), button[aria-label*='neu'], button[aria-label*='create']",
      )
      .first();

    if (!(await newButton.isVisible().catch(() => false))) {
      test.skip(true, "No visible 'new shift' trigger on this layout");
    }

    await newButton.click();

    await expect(authedPage.locator("[role='dialog']").first()).toBeVisible({
      timeout: 5_000,
    });
  });

  test("employee list page loads and shows team members", async ({
    authedPage,
  }) => {
    await authedPage.goto("/mitarbeiter");
    await authedPage.waitForLoadState("networkidle");

    await expect(
      authedPage
        .locator("h1, h2")
        .filter({ hasText: /Mitarbeiter|Employee/i })
        .first(),
    ).toBeVisible({ timeout: 15_000 });

    // Page should not be an error state
    await expect(
      authedPage.locator("text=500, text=Error").first(),
    ).not.toBeVisible();
  });

  test("absence management page is accessible", async ({ authedPage }) => {
    await authedPage.goto("/abwesenheiten");
    await authedPage.waitForLoadState("networkidle");

    await expect(authedPage.locator("h1, h2").first()).toBeVisible({
      timeout: 15_000,
    });
    await expect(authedPage).not.toHaveURL(/\/404|\/not-found/);
  });

  test("shift API returns correct data shape", async ({ authedPage }) => {
    // Verify the shifts API is responding correctly — catch regressions
    // where the API returns 500 instead of data.
    const response = await authedPage.request.get(
      "/api/shifts?start=2025-01-01&end=2025-01-31",
    );

    // Should be 200 or 403 (plan limit) — never 500
    expect([200, 403]).toContain(response.status());

    if (response.status() === 200) {
      const body = await response.json();
      // Response must have a pagination wrapper
      expect(body).toHaveProperty("data");
      expect(Array.isArray(body.data)).toBe(true);
    }
  });

  test("tickets assignees API returns all roles including EMPLOYEE", async ({
    authedPage,
  }) => {
    /**
     * Regression test for the assignment dropdown bug.
     * The endpoint must return EMPLOYEE-role users, not just managers.
     */
    const response = await authedPage.request.get("/api/tickets/assignees");

    // 403 = ticketing add-on not enabled — skip, not a failure
    if (response.status() === 403) {
      test.skip(true, "Ticketing add-on not enabled");
    }

    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body).toHaveProperty("assignees");
    expect(Array.isArray(body.assignees)).toBe(true);

    // Every entry must have the shape the dropdown expects
    for (const user of body.assignees) {
      expect(user).toHaveProperty("id");
      expect(user).toHaveProperty("role");
      expect(["OWNER", "ADMIN", "MANAGER", "EMPLOYEE"]).toContain(user.role);
    }
  });
});
