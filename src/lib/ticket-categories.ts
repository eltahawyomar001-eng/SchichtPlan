import { prisma } from "@/lib/db";
import type { TicketCategory } from "@prisma/client";

/**
 * Default category seed used the very first time a workspace touches the
 * ticketing module. Mirrors the legacy `TicketCategory` enum so historical
 * tickets carrying the enum value still resolve to a real row via
 * `legacyEnum`.
 */
const DEFAULT_CATEGORIES: Array<{
  slug: string;
  name: string;
  color: string;
  legacyEnum: TicketCategory;
  sortOrder: number;
}> = [
  {
    slug: "schichtplan",
    name: "Schichtplan",
    color: "emerald",
    legacyEnum: "SCHICHTPLAN",
    sortOrder: 10,
  },
  {
    slug: "zeiterfassung",
    name: "Zeiterfassung",
    color: "sky",
    legacyEnum: "ZEITERFASSUNG",
    sortOrder: 20,
  },
  {
    slug: "lohnabrechnung",
    name: "Lohnabrechnung",
    color: "amber",
    legacyEnum: "LOHNABRECHNUNG",
    sortOrder: 30,
  },
  {
    slug: "technik",
    name: "Technik",
    color: "violet",
    legacyEnum: "TECHNIK",
    sortOrder: 40,
  },
  {
    slug: "hr",
    name: "HR",
    color: "pink",
    legacyEnum: "HR",
    sortOrder: 50,
  },
  {
    slug: "qualitaetsmangel",
    name: "Qualitätsmangel",
    color: "red",
    legacyEnum: "QUALITAETSMANGEL",
    sortOrder: 60,
  },
  {
    slug: "fehlende-leistung",
    name: "Fehlende Leistung",
    color: "orange",
    legacyEnum: "FEHLENDE_LEISTUNG",
    sortOrder: 70,
  },
  {
    slug: "sonstiges",
    name: "Sonstiges",
    color: "zinc",
    legacyEnum: "SONSTIGES",
    sortOrder: 80,
  },
];

/**
 * Seed default ticket categories for a workspace if none exist yet.
 * Idempotent — safe to call on every category-list read.
 */
export async function ensureDefaultCategories(
  workspaceId: string,
): Promise<void> {
  const count = await prisma.ticketCategoryDef.count({
    where: { workspaceId },
  });
  if (count > 0) return;

  await prisma.ticketCategoryDef.createMany({
    data: DEFAULT_CATEGORIES.map((c) => ({ ...c, workspaceId })),
    skipDuplicates: true,
  });
}

/**
 * Resolve a legacy `TicketCategory` enum value to the workspace's matching
 * category-def row (creating defaults on first call). Used to backfill
 * `categoryDefId` for historical tickets that only carry the enum field.
 */
export async function resolveLegacyCategory(
  workspaceId: string,
  legacy: TicketCategory,
): Promise<string | null> {
  await ensureDefaultCategories(workspaceId);
  const row = await prisma.ticketCategoryDef.findFirst({
    where: { workspaceId, legacyEnum: legacy },
    select: { id: true },
  });
  return row?.id ?? null;
}

/**
 * Stable slugifier used when admins create/rename categories. Falls back to a
 * short random suffix to keep `(workspaceId, slug)` unique without surprising
 * the user with collision errors.
 */
export function slugifyCategoryName(name: string): string {
  const base = name
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return base || `cat-${Math.random().toString(36).slice(2, 8)}`;
}
