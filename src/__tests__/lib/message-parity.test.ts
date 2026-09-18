/**
 * @vitest-environment node
 *
 * German and English message files must stay in step. A key present in one and
 * missing from the other renders the fallback (the last path segment, e.g.
 * "copyrightBody") to a real visitor, which is how a page ends up looking
 * half-translated.
 */
import { describe, it, expect } from "vitest";
import de from "../../../messages/de.json";
import en from "../../../messages/en.json";

type Tree = Record<string, unknown>;

/** Flatten to dotted paths so nested namespaces are compared too. */
function paths(obj: Tree, prefix = ""): string[] {
  const out: string[] = [];
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === "object" && !Array.isArray(v)) {
      out.push(...paths(v as Tree, key));
    } else {
      out.push(key);
    }
  }
  return out;
}

const dePaths = paths(de as Tree);
const enPaths = paths(en as Tree);

describe("message file parity", () => {
  it("has no German key missing from English", () => {
    const missing = dePaths.filter((p) => !enPaths.includes(p));
    expect(missing).toEqual([]);
  });

  it("has no English key missing from German", () => {
    const missing = enPaths.filter((p) => !dePaths.includes(p));
    expect(missing).toEqual([]);
  });

  it("uses the same {placeholders} in both languages", () => {
    // ICU plural/select branches carry their own braces —
    // "{count, plural, =1 {Tag} other {Tage}}" — and those inner labels are
    // translated text, not arguments. Strip the branch bodies first, or every
    // pluralised string reads as a mismatch.
    const stripBranches = (s: string) =>
      s.replace(/(?:=\d+|zero|one|two|few|many|other)\s*\{[^{}]*\}/g, "");
    const placeholders = (s: unknown) =>
      typeof s === "string"
        ? [
            ...new Set(
              [...stripBranches(s).matchAll(/\{\s*(\w+)/g)].map((m) => m[1]),
            ),
          ].sort()
        : [];
    const read = (tree: Tree, path: string): unknown =>
      path.split(".").reduce<unknown>((o, k) => (o as Tree)?.[k], tree);

    const mismatched = dePaths.filter((p) => {
      const a = placeholders(read(de as Tree, p));
      const b = placeholders(read(en as Tree, p));
      return a.join(",") !== b.join(",");
    });
    expect(mismatched).toEqual([]);
  });
});
