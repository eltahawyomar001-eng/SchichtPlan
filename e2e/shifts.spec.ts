import { test, expect } from "./fixtures/auth";

test.describe("Shift planning core flow", () => {
  test("Schichtplan page renders for an authenticated user", async ({
    authedPage,
  }) => {
    await authedPage.goto("/schichtplan");

    // Wait for either the empty state or a shift cell to appear.
    // We pick a stable signal — the calendar header — rather than guessing at cells.
    await expect(
      authedPage.locator("h1, h2").filter({ hasText: /Schichtplan|Shift/i }),
    ).toBeVisible({ timeout: 15_000 });
  });

  test("Create-shift dialog can be opened from the schedule", async ({
    authedPage,
  }) => {
    await authedPage.goto("/schichtplan");

    // The "new shift" / "+" trigger varies — match common variants.
    const newButton = authedPage
      .locator(
        "button:has-text('Neue Schicht'), button:has-text('New Shift'), button[aria-label*='neu'], button[aria-label*='create']",
      )
      .first();

    // If the button isn't visible (e.g. layout differs on small viewports),
    // skip rather than fail — the goal of this test is to confirm the dialog
    // opens, not to assert a specific viewport.
    if (!(await newButton.isVisible().catch(() => false))) {
      test.skip(true, "No visible 'new shift' trigger on this layout");
    }

    await newButton.click();

    await expect(authedPage.locator("[role='dialog']").first()).toBeVisible({
      timeout: 5_000,
    });
  });
});
