/**
 * Write the golden invoices to disk for the KoSIT validator.
 *
 * Separate from the vitest suite because the validator is a container that
 * reads files, not a test runner.
 */
import { mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import { GOLDEN_INVOICES } from "../src/lib/e-invoice/fixtures";

const out = process.argv[2];
if (!out) {
  console.error("usage: write-golden-invoices.ts <output-dir>");
  process.exit(2);
}

mkdirSync(out, { recursive: true });
for (const [name, make] of Object.entries(GOLDEN_INVOICES)) {
  writeFileSync(join(out, `${name}.xml`), make(), "utf8");
}
