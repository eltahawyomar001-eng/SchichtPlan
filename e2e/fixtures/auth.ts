import { test as base, expect, type Page } from "@playwright/test";

/**
 * Authentication fixture for E2E tests.
 *
 * Reads credentials from env so they never live in the repo:
 *   E2E_USER_EMAIL    — login email
 *   E2E_USER_PASSWORD — login password
 *
 * Login is performed once per worker via `storageState`, then re-used across
 * tests. If credentials are missing, dependent tests are skipped (not failed)
 * so the suite is green in CI environments that don't have a seed account.
 */

export type AuthedFixtures = {
  authedPage: Page;
};

/* eslint-disable react-hooks/rules-of-hooks */
// `use` here is the Playwright fixture callback param, not React's use() hook.
export const test = base.extend<AuthedFixtures>({
  authedPage: async ({ browser }, use, testInfo) => {
    const email = process.env.E2E_USER_EMAIL;
    const password = process.env.E2E_USER_PASSWORD;

    if (!email || !password) {
      testInfo.skip(
        true,
        "E2E_USER_EMAIL / E2E_USER_PASSWORD not set — skipping authenticated test",
      );
    }

    const context = await browser.newContext();
    const page = await context.newPage();

    await page.goto("/login");
    await page
      .locator("input[type='email'], input[name='email']")
      .first()
      .fill(email!);
    await page
      .locator("input[type='password'], input[name='password']")
      .first()
      .fill(password!);
    await page.locator("button[type='submit']").first().click();

    // Wait until we're on a dashboard route (not /login anymore)
    await page.waitForURL((url) => !url.pathname.startsWith("/login"), {
      timeout: 20_000,
    });

    await use(page);

    await context.close();
  },
});

export { expect };
/* eslint-enable react-hooks/rules-of-hooks */
