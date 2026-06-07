import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";
import {
  SCOPED_MODELS,
  SCOPED_OPS,
  shouldScope,
  injectWorkspace,
  runWithWorkspaceScope,
  runUnscoped,
  currentWorkspaceScope,
} from "@/lib/workspace-scope";

/**
 * Derive the set of workspace-scoped models directly from the Prisma schema:
 * any model block that declares a `workspaceId` field.
 */
function modelsWithWorkspaceIdFromSchema(): Set<string> {
  const schema = readFileSync(
    join(process.cwd(), "prisma/schema.prisma"),
    "utf8",
  );
  const result = new Set<string>();
  let current: string | null = null;
  for (const rawLine of schema.split("\n")) {
    // Strip inline comments so commented mentions ("workspaceIds…") never count.
    const line = rawLine.replace(/\/\/.*$/, "");
    const modelMatch = line.match(/^\s*model\s+(\w+)\s*\{/);
    if (modelMatch) {
      current = modelMatch[1];
      continue;
    }
    if (current) {
      // A field declaration is `<name> <Type>` at the start of the line.
      if (/^\s*workspaceId\s+\w/.test(line)) result.add(current);
      // Close the model block only on a lone closing brace (field-level
      // `@default("{}")` etc. contain braces but are not the block end).
      if (/^\s*\}\s*$/.test(line)) current = null;
    }
  }
  return result;
}

describe("workspace-scope backstop", () => {
  it("SCOPED_MODELS exactly matches schema models that have a workspaceId field", () => {
    const fromSchema = modelsWithWorkspaceIdFromSchema();
    const fromCode = new Set(SCOPED_MODELS);

    const missingFromCode = [...fromSchema].filter((m) => !fromCode.has(m));
    const staleInCode = [...fromCode].filter((m) => !fromSchema.has(m));

    // If this fails, update SCOPED_MODELS in src/lib/workspace-scope.ts.
    expect(missingFromCode, "scoped models missing from SCOPED_MODELS").toEqual(
      [],
    );
    expect(staleInCode, "stale entries in SCOPED_MODELS").toEqual([]);
  });

  it("only scopes multi-row ops on scoped models", () => {
    expect(shouldScope("Employee", "findMany")).toBe(true);
    expect(shouldScope("TimeEntry", "deleteMany")).toBe(true);
    expect(shouldScope("Ticket", "count")).toBe(true);
    // by-unique-key + create/upsert are excluded by design
    expect(shouldScope("Employee", "findUnique")).toBe(false);
    expect(shouldScope("Employee", "create")).toBe(false);
    expect(shouldScope("Employee", "upsert")).toBe(false);
    // non-scoped models are never touched
    expect(shouldScope("Session", "findMany")).toBe(false);
    expect(shouldScope("Account", "deleteMany")).toBe(false);
  });

  it("ANDs the workspace filter without widening an existing where", () => {
    expect(injectWorkspace({ status: "OPEN" }, "ws_1")).toEqual({
      AND: [{ workspaceId: "ws_1" }, { status: "OPEN" }],
    });
    expect(injectWorkspace(undefined, "ws_1")).toEqual({
      AND: [{ workspaceId: "ws_1" }, {}],
    });
    // an existing workspaceId stays intact (redundant but never widened)
    expect(injectWorkspace({ workspaceId: "ws_1" }, "ws_1")).toEqual({
      AND: [{ workspaceId: "ws_1" }, { workspaceId: "ws_1" }],
    });
  });

  it("carries scope through the async context and supports opt-out", () => {
    expect(currentWorkspaceScope()).toBeNull();
    runWithWorkspaceScope("ws_42", () => {
      expect(currentWorkspaceScope()).toBe("ws_42");
      runUnscoped(() => {
        expect(currentWorkspaceScope()).toBeNull();
      });
      expect(currentWorkspaceScope()).toBe("ws_42");
    });
    expect(currentWorkspaceScope()).toBeNull();
  });

  it("SCOPED_OPS excludes singular and create-style operations", () => {
    expect(SCOPED_OPS.has("findUnique")).toBe(false);
    expect(SCOPED_OPS.has("create")).toBe(false);
    expect(SCOPED_OPS.has("update")).toBe(false);
    expect(SCOPED_OPS.has("delete")).toBe(false);
    expect(SCOPED_OPS.has("findMany")).toBe(true);
  });
});
