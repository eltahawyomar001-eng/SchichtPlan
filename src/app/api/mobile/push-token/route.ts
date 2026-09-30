import { NextResponse } from "next/server";
import { z } from "zod";
import { withRoute } from "@/lib/with-route";
import { requireAuth, parseJsonBody } from "@/lib/api-response";
import { prisma } from "@/lib/db";

/**
 * Register (POST) or discard (DELETE) this device's push token.
 *
 * Without it the iOS app is silent: an employee assigned a shift, or told their
 * swap was approved, learns about it only by opening the app, which defeats the
 * point of a scheduling app on a phone.
 *
 * Distinct from /api/mobile/live-activity: that token belongs to one running
 * Live Activity and dies with it, this one belongs to the install.
 */

const registerSchema = z.object({
  /** APNs device token, hex. */
  token: z
    .string()
    .min(32)
    .max(400)
    .regex(/^[0-9a-fA-F]+$/, "Ungültiges Token"),
  platform: z.enum(["ios", "android"]).optional(),
  /** The server writes the notification copy, so it needs the language. */
  locale: z.string().max(10).optional(),
  timezone: z.string().max(100).optional(),
});

export const POST = withRoute("/api/mobile/push-token", "POST", async (req) => {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;
  const { user, workspaceId } = auth;

  const body = await parseJsonBody(req);
  if (!body.ok) return body.response;
  const parsed = registerSchema.safeParse(body.data);
  if (!parsed.success) {
    return NextResponse.json({ error: "Ungültige Daten" }, { status: 400 });
  }

  const { token, platform, locale, timezone } = parsed.data;

  /**
   * Upsert on the token.
   *
   * The user is re-pointed on every registration, not just on insert: a
   * device handed to a colleague, or a second account signed in on the same
   * phone, must stop delivering the previous person's shifts to it.
   */
  await prisma.deviceToken.upsert({
    where: { token },
    create: {
      token,
      platform: platform ?? "ios",
      locale: locale ?? "de",
      timezone: timezone || "Europe/Berlin",
      userId: user.id,
      workspaceId,
    },
    update: {
      userId: user.id,
      workspaceId,
      platform: platform ?? "ios",
      locale: locale ?? "de",
      timezone: timezone || "Europe/Berlin",
    },
  });

  return NextResponse.json({ ok: true });
});

export const DELETE = withRoute(
  "/api/mobile/push-token",
  "DELETE",
  async (req) => {
    const auth = await requireAuth();
    if (!auth.ok) return auth.response;
    const { user, workspaceId } = auth;

    const body = await parseJsonBody(req);
    const token =
      body.ok && typeof (body.data as { token?: unknown })?.token === "string"
        ? (body.data as { token: string }).token
        : null;

    /**
     * Without a token, drop every registration this user has in the workspace.
     * That is what signing out should do: continuing to push someone's shifts
     * to a phone they have signed out of is the failure worth preventing.
     */
    await prisma.deviceToken.deleteMany({
      where: { userId: user.id, workspaceId, ...(token ? { token } : {}) },
    });

    return NextResponse.json({ ok: true });
  },
);
