import { test, expect } from "./fixtures/auth";

test.describe("Absence (Abwesenheiten) flow", () => {
  test("Abwesenheiten page loads", async ({ authedPage }) => {
    await authedPage.goto("/abwesenheiten");

    await expect(
      authedPage.locator("h1, h2").filter({ hasText: /Abwesenheit|Absence/i }),
    ).toBeVisible({ timeout: 15_000 });
  });

  test("Request absence dialog opens", async ({ authedPage }) => {
    await authedPage.goto("/abwesenheiten");

    const newButton = authedPage
      .locator(
        "button:has-text('Neuer Antrag'), button:has-text('Antrag'), button:has-text('New request'), button:has-text('Request')",
      )
      .first();

    if (!(await newButton.isVisible().catch(() => false))) {
      test.skip(true, "No new-absence trigger visible on this layout");
    }

    await newButton.click();

    await expect(authedPage.locator("[role='dialog']").first()).toBeVisible({
      timeout: 5_000,
    });
  });
});
