import { NextResponse } from "next/server";
import { z } from "zod";
import { withRoute } from "@/lib/with-route";
import { requireAuth, parseJsonBody } from "@/lib/api-response";
import { prisma } from "@/lib/db";

/**
 * Register (POST) or discard (DELETE) the push token for a running Live
 * Activity.
 *
 * ActivityKit hands the device a token when an activity starts with
 * `pushType: .token`. Without it here, the card on a locked phone can only be
 * changed by the iOS app while it is running -- so ending a break in the web
 * app leaves the lock screen asserting "on break" indefinitely.
 *
 * The labels come with the token on purpose. A push has to carry the COMPLETE
 * content state, because ActivityKit replaces it wholesale and anything
 * omitted decodes to its default and blanks that part of the card. The server
 * has no other way to know which language the card is written in.
 */

const registerSchema = z.object({
  /** APNs device token, hex. */
  token: z
    .string()
    .min(32)
    .max(400)
    .regex(/^[0-9a-fA-F]+$/, "Ungültiges Token"),
  labels: z.record(z.string(), z.string()).optional(),
  companyName: z.string().max(200).optional(),
  timezone: z.string().max(100).optional(),
});

export const POST = withRoute(
  "/api/mobile/live-activity",
  "POST",
  async (req) => {
    const auth = await requireAuth();
    if (!auth.ok) return auth.response;
    const { user, workspaceId } = auth;

    if (!user.employeeId) {
      return NextResponse.json(
        { error: "NO_EMPLOYEE_PROFILE" },
        { status: 400 },
      );
    }

    const body = await parseJsonBody(req);
    if (!body.ok) return body.response;
    const parsed = registerSchema.safeParse(body.data);
    if (!parsed.success) {
      return NextResponse.json({ error: "Ungültige Daten" }, { status: 400 });
    }

    const { token, labels, companyName, timezone } = parsed.data;

    /**
     * Upsert on the token, which is unique per activity.
     *
     * Re-registering the same activity -- which happens whenever the app
     * restarts while clocked in -- must update the row rather than add another,
     * or each punch would push the same card several times over.
     */
    await prisma.liveActivityToken.upsert({
      where: { token },
      create: {
        token,
        employeeId: user.employeeId,
        workspaceId,
        labels: labels ?? {},
        companyName: companyName ?? null,
        timezone: timezone || "Europe/Berlin",
      },
      update: {
        // Re-pointed on purpose: a device handed to another employee must not
        // keep pushing the previous one's shift to the same card.
        employeeId: user.employeeId,
        workspaceId,
        labels: labels ?? {},
        companyName: companyName ?? null,
        timezone: timezone || "Europe/Berlin",
      },
    });

    return NextResponse.json({ ok: true });
  },
);

export const DELETE = withRoute(
  "/api/mobile/live-activity",
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
     * Scoped to this employee either way. Without a token we clear all of
     * theirs, which is what signing out should do: no activity of theirs is
     * running any more, and a token left behind would push someone else's
     * shift to a device they no longer use.
     */
    await prisma.liveActivityToken.deleteMany({
      where: {
        workspaceId,
        ...(user.employeeId ? { employeeId: user.employeeId } : {}),
        ...(token ? { token } : {}),
      },
    });

    return NextResponse.json({ ok: true });
  },
);
