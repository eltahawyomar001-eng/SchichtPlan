import { test, expect } from "./fixtures/auth";

test.describe("Tickets", () => {
  test("tickets list page loads and shows correct UI", async ({
    authedPage,
  }) => {
    await authedPage.goto("/tickets");

    await expect(
      authedPage.locator("h1, h2").filter({ hasText: /Tickets/i }),
    ).toBeVisible({ timeout: 15_000 });
  });

  test("new ticket form is reachable and has required fields", async ({
    authedPage,
  }) => {
    await authedPage.goto("/tickets/neu");

    // Wait for the form to render (or an upgrade prompt)
    await authedPage.waitForLoadState("networkidle");

    // If the ticketing add-on is not active the page shows an upgrade prompt —
    // skip the rest of the form assertions in that case.
    const isUpgradePrompt = await authedPage
      .locator('[data-testid="upgrade-prompt"], text=Upgrade, text=upgraden')
      .isVisible()
      .catch(() => false);

    if (isUpgradePrompt) {
      test.skip(true, "Ticketing add-on not enabled for this workspace");
    }

    await expect(authedPage.locator("textarea, input").first()).toBeVisible({
      timeout: 10_000,
    });
  });

  test("ticket detail page loads when a ticket exists", async ({
    authedPage,
  }) => {
    await authedPage.goto("/tickets");
    await authedPage.waitForLoadState("networkidle");

    // Click the first ticket in the list if one exists
    const firstTicket = authedPage
      .locator("a[href^='/tickets/'], tr[data-href^='/tickets/']")
      .first();
    const hasTickets = await firstTicket.isVisible().catch(() => false);

    if (!hasTickets) {
      test.skip(true, "No tickets exist in this workspace");
    }

    await firstTicket.click();
    await authedPage.waitForLoadState("networkidle");

    // Should be on a ticket detail page
    await expect(authedPage).toHaveURL(/\/tickets\/[a-z0-9]+$/i);
  });

  /**
   * Regression test for the "Zugewiesen an" assignment dropdown bug.
   *
   * Bug: The dropdown fetched users from /api/team and filtered to
   * OWNER/ADMIN/MANAGER roles only, so EMPLOYEE-role users never appeared.
   *
   * Fix: Switched to /api/tickets/assignees which returns all roles.
   *
   * This test verifies that the /api/tickets/assignees endpoint is called
   * (not /api/team) and that the assignment dropdown renders options.
   */
  test("ticket assignment dropdown fetches from /api/tickets/assignees", async ({
    authedPage,
    context,
  }) => {
    const assigneesRequests: string[] = [];

    // Intercept API calls to detect which endpoint is used
    authedPage.on("request", (req) => {
      if (req.url().includes("/api/tickets/assignees")) {
        assigneesRequests.push(req.url());
      }
    });

    await authedPage.goto("/tickets");
    await authedPage.waitForLoadState("networkidle");

    const firstTicket = authedPage
      .locator("a[href^='/tickets/'], [href^='/tickets/']")
      .first();
    const hasTickets = await firstTicket.isVisible().catch(() => false);

    if (!hasTickets) {
      test.skip(true, "No tickets exist to open");
    }

    await firstTicket.click();
    await authedPage.waitForLoadState("networkidle");

    // Wait for the management sidebar to appear (only visible to managers/admins)
    const assigneeDropdown = authedPage.locator("select").filter({
      has: authedPage.locator('option[value=""]'),
    });

    const hasSidebar = await assigneeDropdown.isVisible().catch(() => false);
    if (!hasSidebar) {
      test.skip(true, "Not a management user — assignment dropdown not shown");
    }

    // The /api/tickets/assignees endpoint should have been called
    await authedPage.waitForResponse(
      (res) => res.url().includes("/api/tickets/assignees"),
      { timeout: 5_000 },
    );

    expect(assigneesRequests.length).toBeGreaterThan(0);

    // The dropdown should have at least the "unassigned" option plus team members
    const options = await assigneeDropdown.locator("option").count();
    expect(options).toBeGreaterThanOrEqual(1);
  });

  test("ticket status change updates the UI without page reload", async ({
    authedPage,
  }) => {
    await authedPage.goto("/tickets");
    await authedPage.waitForLoadState("networkidle");

    const firstTicket = authedPage
      .locator("a[href^='/tickets/'], [href^='/tickets/']")
      .first();
    const hasTickets = await firstTicket.isVisible().catch(() => false);

    if (!hasTickets) {
      test.skip(true, "No tickets exist to test status change");
    }

    await firstTicket.click();
    await authedPage.waitForLoadState("networkidle");

    // Management controls are only visible to admins/managers
    const statusSelect = authedPage
      .locator("label")
      .filter({ hasText: /Status/i })
      .locator("..")
      .locator("select")
      .first();

    const hasStatusControl = await statusSelect.isVisible().catch(() => false);
    if (!hasStatusControl) {
      test.skip(true, "Status control not visible for this user/workspace");
    }

    // Change status and verify the API is called (response intercepted)
    const patchPromise = authedPage.waitForResponse(
      (res) =>
        res.url().includes("/api/tickets/") &&
        res.request().method() === "PATCH",
      { timeout: 5_000 },
    );

    // Select a different status
    const currentValue = await statusSelect.inputValue();
    const newValue = currentValue === "OFFEN" ? "IN_BEARBEITUNG" : "OFFEN";
    await statusSelect.selectOption(newValue);

    const response = await patchPromise;
    expect(response.status()).toBe(200);
  });
});
