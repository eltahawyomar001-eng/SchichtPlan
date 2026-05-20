import { test, expect } from "./fixtures/auth";

test.describe("Time clock (Stempeluhr) flow", () => {
  test("Stempeluhr page renders", async ({ authedPage }) => {
    await authedPage.goto("/stempeluhr");

    await expect(
      authedPage.locator("h1, h2").filter({ hasText: /Stempeluhr|Time/i }),
    ).toBeVisible({ timeout: 15_000 });
  });

  test("Punch-clock primary button is reachable", async ({ authedPage }) => {
    await authedPage.goto("/stempeluhr");

    // Wait for any of the punch buttons to appear. We don't actually click
    // because that would create real DB rows; we just confirm the surface
    // is rendered for a real session.
    const punchButton = authedPage
      .locator(
        "button:has-text('Einstempeln'), button:has-text('Clock in'), button:has-text('Start')",
      )
      .first();

    await expect(punchButton).toBeVisible({ timeout: 15_000 });
  });
});
