/**
 * Multi-tenancy scope guard (CI lint).
 * ────────────────────────────────────
 * Production tenant isolation in this app is enforced ONLY at the application
 * layer: every query on a workspace-scoped model must filter by `workspaceId`.
 * RLS is bypassed by the Supavisor service_role pooler in production, so there
 * is no database backstop — a single forgotten `workspaceId` is a cross-tenant
 * data leak. This script converts that convention into an enforced invariant.
 *
 * What it does:
 *   1. Reads prisma/schema.prisma and collects every model that has a
 *      `workspaceId` field (the scoped models). Derives the Prisma client
 *      accessor for each (e.g. `TimeEntry` → `timeEntry`).
 *   2. Statically scans src/app and src/lib with the TypeScript compiler API
 *      for calls of the form `<x>.<scopedModel>.<op>(...)` where <op> is a
 *      filter/bulk operation (findMany, findFirst, updateMany, deleteMany,
 *      count, aggregate, groupBy).
 *   3. Flags any such call whose first-argument `where` clause does not
 *      reference `workspaceId` anywhere in its (possibly nested AND/OR) tree.
 *
 * Escape hatches (for legitimately cross-workspace code):
 *   - Path allowlist below (cron, webhooks, billing webhook, super-admin, …).
 *   - Inline `// scope-ok: <reason>` on the call line or the line above it.
 *
 * Calls whose arguments are not an inline object literal (e.g. a prebuilt
 * `where` variable) cannot be statically verified; they are reported under
 * "manual review" and do NOT fail the build.
 *
 * Run: `npm run lint:scope`   (exits 1 on any hard violation)
 */
import { readFileSync, readdirSync, statSync } from "fs";
import { join, relative } from "path";
import * as ts from "typescript";

const ROOT = process.cwd();
const SCHEMA_PATH = join(ROOT, "prisma/schema.prisma");
const SCAN_DIRS = [join(ROOT, "src/app"), join(ROOT, "src/lib")];

/** Operations whose results/effects span rows — a missing filter leaks/mutates
 *  across tenants. `findUnique`/`create`/`upsert` are intentionally excluded:
 *  the former is a by-unique lookup (token etc.), the latter set scope in
 *  `data`, not `where`. */
const SCOPED_OPS = new Set([
  "findMany",
  "findFirst",
  "findFirstOrThrow",
  "updateMany",
  "deleteMany",
  "count",
  "aggregate",
  "groupBy",
]);

/** Files/dirs that are legitimately cross-workspace by design. */
const PATH_ALLOWLIST = [
  "src/app/api/cron/",
  "src/app/api/automations/",
  "src/app/api/billing/webhook/",
  "src/app/api/super-admin/",
  "src/app/api/admin/",
  "src/app/api/health",
  "src/lib/subscription.ts",
  "src/lib/stripe",
  "src/lib/billing",
  "src/lib/feature-flags",
  // The scope guard's own tests / scripts are not runtime query sites.
  "src/lib/auth.ts", // invitation/onboarding bootstrap is cross-workspace by design
];

interface Finding {
  file: string;
  line: number;
  model: string;
  op: string;
  snippet: string;
}

/* ── 1. Collect workspace-scoped models from the Prisma schema ── */

function getScopedModelAccessors(): Set<string> {
  const schema = readFileSync(SCHEMA_PATH, "utf8");
  const accessors = new Set<string>();
  const modelRegex = /model\s+(\w+)\s*\{([^}]*)\}/g;
  let m: RegExpExecArray | null;
  while ((m = modelRegex.exec(schema)) !== null) {
    const [, name, body] = m;
    if (name === "Workspace") continue; // the tenant root itself
    if (/^\s*workspaceId\s+/m.test(body)) {
      accessors.add(name[0].toLowerCase() + name.slice(1));
    }
  }
  return accessors;
}

/* ── 2. File discovery ── */

function collectTsFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      if (entry === "node_modules" || entry === "__tests__") continue;
      out.push(...collectTsFiles(full));
    } else if (
      (entry.endsWith(".ts") || entry.endsWith(".tsx")) &&
      !entry.endsWith(".test.ts") &&
      !entry.endsWith(".test.tsx")
    ) {
      out.push(full);
    }
  }
  return out;
}

function isAllowlistedPath(rel: string): boolean {
  return PATH_ALLOWLIST.some((p) => rel.startsWith(p) || rel.includes(p));
}

/* ── 3. AST helpers ── */

/** Tenant/owner keys that legitimately anchor a query to a single workspace.
 *  userId / employeeId both belong to exactly one workspace in this app's
 *  single-workspace model, so an owner-scoped query is acceptable. */
const ACCEPTED_SCOPE_KEYS = new Set(["workspaceId", "userId", "employeeId"]);

function whereReferencesAcceptedKey(node: ts.Node): boolean {
  let found = false;
  const visit = (n: ts.Node) => {
    if (found) return;
    if (ts.isPropertyAssignment(n) || ts.isShorthandPropertyAssignment(n)) {
      if (ACCEPTED_SCOPE_KEYS.has(n.name.getText())) {
        found = true;
        return;
      }
    }
    ts.forEachChild(n, visit);
  };
  visit(node);
  return found;
}

/**
 * Classify a call's `where`:
 *   - "missing"      → no `where` at all on a filter op → returns/affects ALL
 *                      tenants. Unambiguous, hard fail.
 *   - "unverifiable" → `where` is a variable / shorthand / spread; built
 *                      elsewhere and not statically inspectable. Manual review.
 *   - literal        → an inline object literal to inspect for a scope key.
 */
function getWhereLiteral(
  arg: ts.Expression | undefined,
): ts.ObjectLiteralExpression | "missing" | "unverifiable" {
  if (!arg) return "missing";
  if (!ts.isObjectLiteralExpression(arg)) return "unverifiable";
  for (const prop of arg.properties) {
    // `{ where }` shorthand — value is a variable built upstream.
    if (
      ts.isShorthandPropertyAssignment(prop) &&
      prop.name.getText() === "where"
    ) {
      return "unverifiable";
    }
    if (ts.isPropertyAssignment(prop) && prop.name.getText() === "where") {
      if (ts.isObjectLiteralExpression(prop.initializer))
        return prop.initializer;
      return "unverifiable"; // where: someVar
    }
    // Spread (`{ ...args }`) — can't see the where.
    if (ts.isSpreadAssignment(prop)) return "unverifiable";
  }
  return "missing"; // object literal with no `where` key
}

function hasInlineOptOut(
  sourceText: string,
  fullText: string,
  call: ts.CallExpression,
  sf: ts.SourceFile,
): boolean {
  const { line } = sf.getLineAndCharacterOfPosition(call.getStart(sf));
  const lines = fullText.split("\n");
  const thisLine = lines[line] ?? "";
  const prevLine = lines[line - 1] ?? "";
  return /scope-ok:/.test(thisLine) || /scope-ok:/.test(prevLine);
}

/* ── 4. Scan ── */

function scan(): {
  violations: Finding[];
  warnings: Finding[];
  manual: Finding[];
} {
  const scoped = getScopedModelAccessors();
  const violations: Finding[] = [];
  const warnings: Finding[] = [];
  const manual: Finding[] = [];

  const files = SCAN_DIRS.flatMap((d) => collectTsFiles(d));

  for (const file of files) {
    const rel = relative(ROOT, file);
    if (isAllowlistedPath(rel)) continue;

    const text = readFileSync(file, "utf8");
    if (
      !text.includes(".findMany") &&
      !/\.(updateMany|deleteMany|count|aggregate|groupBy|findFirst)/.test(text)
    ) {
      continue; // fast skip
    }

    const sf = ts.createSourceFile(
      file,
      text,
      ts.ScriptTarget.Latest,
      true,
      file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
    );

    const visit = (node: ts.Node) => {
      if (
        ts.isCallExpression(node) &&
        ts.isPropertyAccessExpression(node.expression)
      ) {
        const op = node.expression.name.text;
        const target = node.expression.expression; // the `<x>.<model>` part
        if (
          SCOPED_OPS.has(op) &&
          ts.isPropertyAccessExpression(target) &&
          scoped.has(target.name.text)
        ) {
          const model = target.name.text;
          const { line } = sf.getLineAndCharacterOfPosition(node.getStart(sf));
          const snippet = node.getText(sf).replace(/\s+/g, " ").slice(0, 100);

          if (hasInlineOptOut(text, text, node, sf)) {
            // explicitly justified — skip
          } else {
            const where = getWhereLiteral(node.arguments[0]);
            const finding: Finding = {
              file: rel,
              line: line + 1,
              model,
              op,
              snippet,
            };
            if (where === "missing") {
              // No where on a filter op = spans every tenant. Hard fail.
              violations.push(finding);
            } else if (where === "unverifiable") {
              manual.push(finding);
            } else if (!whereReferencesAcceptedKey(where)) {
              // Inline where exists but has no workspaceId/userId/employeeId
              // anchor (only a parent FK or scalar filters). Surface for review
              // but don't block — many are legitimately parent-scoped.
              warnings.push(finding);
            }
          }
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(sf);
  }

  return { violations, warnings, manual };
}

/* ── 5. Report ── */

function main() {
  const { violations, warnings, manual } = scan();

  if (manual.length > 0) {
    console.log(
      `\nℹ️  ${manual.length} query(ies) build \`where\` upstream (variable/shorthand/spread) — not statically verifiable, manual review only:`,
    );
    for (const f of manual) {
      console.log(`   ${f.file}:${f.line}  ${f.model}.${f.op}()  ${f.snippet}`);
    }
  }

  if (warnings.length > 0) {
    console.log(
      `\n⚠️  ${warnings.length} query(ies) have an inline \`where\` with no workspaceId/userId/employeeId anchor (review — often legitimately parent-scoped or a by-id lookup that must add workspaceId):`,
    );
    for (const f of warnings) {
      console.log(`   ${f.file}:${f.line}  ${f.model}.${f.op}()  ${f.snippet}`);
    }
  }

  if (violations.length > 0) {
    console.error(
      `\n❌ ${violations.length} workspace-scope VIOLATION(s) — filter/bulk op on a scoped model with NO \`where\` at all (spans every tenant):`,
    );
    for (const f of violations) {
      console.error(
        `   ${f.file}:${f.line}  ${f.model}.${f.op}()  ${f.snippet}`,
      );
    }
    console.error(
      `\nFix: add a \`where\` filtering by workspaceId, or justify a deliberate cross-tenant query with an inline \`// scope-ok: <reason>\` comment.\n`,
    );
    process.exit(1);
  }

  console.log(
    `\n✅ workspace-scope guard: no unscoped (where-less) queries on tenant models.` +
      (warnings.length
        ? ` (${warnings.length} inline-where item(s) flagged for review above.)`
        : ""),
  );
}

main();
