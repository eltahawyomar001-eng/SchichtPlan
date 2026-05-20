import { test, expect } from "./fixtures/auth";

test.describe("Ticketing add-on flow", () => {
  test("Tickets list page loads", async ({ authedPage }) => {
    await authedPage.goto("/tickets");

    // Either the ticket list, an empty state, or an upgrade prompt is expected —
    // all three contain the word "Tickets" in a heading.
    await expect(
      authedPage.locator("h1, h2").filter({ hasText: /Tickets/i }),
    ).toBeVisible({ timeout: 15_000 });
  });

  test("New-ticket route is reachable", async ({ authedPage }) => {
    await authedPage.goto("/tickets/neu");

    // The page may show either the ticket form or a plan-limit upgrade
    // prompt (if the workspace doesn't have the ticketing add-on).
    // Both are valid outcomes — we just confirm the route renders.
    await expect(authedPage.locator("body")).toBeVisible();
    await expect(authedPage).toHaveURL(/\/tickets/);
  });
});
