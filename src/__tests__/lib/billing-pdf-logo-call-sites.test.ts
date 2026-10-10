/**
 * Every route that renders a billing document must print the company logo.
 *
 * The logo is uploaded once in Einstellungen and is supposed to appear on
 * everything from then on. It was wired into the plain invoice PDF only, so it
 * showed up on the one document whoever built it happened to open and was
 * missing from the e-invoice, the PDF actually emailed to the customer, and
 * every quote. That is the shape of the bug: not a broken logo, a call site
 * that was never visited.
 *
 * This is a structural check rather than a rendering one on purpose. Rendering
 * proves the generator can draw an image, which it already could; what went
 * wrong was a route forgetting to pass one, and only counting call sites
 * catches that.
 */
import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";
import fs from "node:fs";

/** Routes that call the shared generator, found rather than listed so a new one is covered the day it is added. */
function callSites(): string[] {
  const out = execFileSync(
    "grep",
    ["-rl", "--include=*.ts", "generateBillingPdf", "src/app/api"],
    { encoding: "utf8" },
  );
  return out.split("\n").filter(Boolean);
}

describe("billing document logo", () => {
  it("finds the call sites at all", () => {
    // Guards the guard: a rename that broke the grep would otherwise make
    // every assertion below pass over an empty list.
    expect(callSites().length).toBeGreaterThanOrEqual(4);
  });

  it.each(callSites())("%s loads and passes the logo", (file) => {
    const src = fs.readFileSync(file, "utf8");

    expect(src).toContain("loadInvoiceLogo");
    // Passed to the generator, not merely imported.
    expect(src).toMatch(/\blogo,/);
    // Fetched from the database, or the lookup silently resolves undefined.
    expect(src).toMatch(/logo:\s*true/);
  });
});
