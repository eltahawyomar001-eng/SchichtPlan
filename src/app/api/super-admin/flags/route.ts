import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireSuperAdmin } from "@/lib/super-admin-auth";
import { withRoute } from "@/lib/with-route";
import { parseJsonBody } from "@/lib/api-response";
import { invalidateFlagCache } from "@/lib/feature-flags";

/** GET /api/super-admin/flags — list all feature flags */
export const GET = withRoute("/api/super-admin/flags", "GET", async () => {
  const guard = await requireSuperAdmin();
  if (guard) return guard;

  const flags = await prisma.featureFlag.findMany({
    orderBy: { key: "asc" },
  });

  return NextResponse.json(flags);
});

/** POST /api/super-admin/flags — create or upsert a flag */
export const POST = withRoute("/api/super-admin/flags", "POST", async (req) => {
  const guard = await requireSuperAdmin();
  if (guard) return guard;

  const _json = await parseJsonBody(req);
  if (!_json.ok) return _json.response;
  const body = _json.data as Record<string, unknown>;

  const key = String(body.key ?? "").trim();
  if (!key) {
    return NextResponse.json({ error: "key is required" }, { status: 400 });
  }

  const flag = await prisma.featureFlag.upsert({
    where: { key },
    update: {
      description:
        body.description != null ? String(body.description) : undefined,
      enabled: typeof body.enabled === "boolean" ? body.enabled : undefined,
      rolloutPercent:
        typeof body.rolloutPercent === "number"
          ? body.rolloutPercent
          : undefined,
      updatedAt: new Date(),
    },
    create: {
      key,
      description: body.description != null ? String(body.description) : null,
      enabled: typeof body.enabled === "boolean" ? body.enabled : false,
      rolloutPercent:
        typeof body.rolloutPercent === "number" ? body.rolloutPercent : 0,
    },
  });

  await invalidateFlagCache(key);
  return NextResponse.json(flag, { status: 201 });
});
