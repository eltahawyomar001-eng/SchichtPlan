import { NextResponse } from "next/server";
import { z } from "zod";
import { withRoute } from "@/lib/with-route";
import { requireAuth, parseJsonBody } from "@/lib/api-response";
import { prisma } from "@/lib/db";
import { log } from "@/lib/logger";
import { evaluateGeofence } from "@/lib/geofence";
import { isManagement } from "@/lib/authorization";
import {
  ALLOWED_PHOTO_MIME,
  createPhotoReadUrl,
  deletePhotoObject,
  statPhoto,
} from "@/lib/work-proof-storage";

/**
 * POST /api/work-proof  — register an uploaded photo as proof of work.
 * GET  /api/work-proof  — list proof for a shift, time entry or day.
 *
 * The whole value of this feature is that the stamps are ours. `capturedAt` is
 * the server clock, and the distance and geofence verdict are recomputed here
 * from the raw fix against the object's coordinates. A device-reported time,
 * distance or verdict is never stored: the person being measured must not be
 * able to influence the measurement.
 */

const createSchema = z.object({
  storagePath: z.string().min(1).max(1024),
  fileName: z.string().min(1).max(500),
  /** Raw device fix. Optional: a photo without a position is still evidence. */
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  accuracyM: z.number().nonnegative().max(100_000).optional(),
  /** OS mock-location flag. Android reports it; iOS does not. */
  mocked: z.boolean().optional(),
  note: z.string().max(500).optional(),
  timeEntryId: z.string().min(1).optional(),
  shiftId: z.string().min(1).optional(),
  locationId: z.string().min(1).optional(),
});

export const POST = withRoute("/api/work-proof", "POST", async (req) => {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;
  const { user, workspaceId } = auth;

  const _json = await parseJsonBody(req);
  if (!_json.ok) return _json.response;
  const parsed = createSchema.safeParse(_json.data);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "INVALID_BODY", details: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const body = parsed.data;

  const employee = await prisma.employee.findFirst({
    where: { workspaceId, userId: user.id, isActive: true },
    select: { id: true },
  });
  if (!employee) {
    return NextResponse.json({ error: "NO_EMPLOYEE_RECORD" }, { status: 403 });
  }

  // The path is workspace-scoped by construction; refuse anything that claims
  // to live under a different workspace, so one tenant can never register
  // another tenant's object as its own evidence.
  if (!body.storagePath.startsWith(`${workspaceId}/`)) {
    return NextResponse.json(
      { error: "PATH_NOT_IN_WORKSPACE" },
      { status: 403 },
    );
  }

  // Ask storage what actually landed. The client's claim about size and type
  // describes what it intended to upload, not what it did.
  const stat = await statPhoto(body.storagePath);
  if (!stat) {
    return NextResponse.json(
      {
        error: "UPLOAD_NOT_FOUND",
        message: "Das Foto wurde nicht gefunden. Bitte erneut aufnehmen.",
      },
      { status: 409 },
    );
  }
  if (!ALLOWED_PHOTO_MIME.includes(stat.mimetype)) {
    await deletePhotoObject(body.storagePath);
    return NextResponse.json({ error: "UNSUPPORTED_TYPE" }, { status: 415 });
  }

  // Resolve the object to measure against: an explicit location, else the one
  // on the time entry or shift the proof is attached to.
  let locationId = body.locationId ?? null;
  if (!locationId && body.timeEntryId) {
    const te = await prisma.timeEntry.findFirst({
      where: { id: body.timeEntryId, workspaceId },
      select: { locationId: true },
    });
    locationId = te?.locationId ?? null;
  }
  if (!locationId && body.shiftId) {
    const sh = await prisma.shift.findFirst({
      where: { id: body.shiftId, workspaceId },
      select: { locationId: true },
    });
    locationId = sh?.locationId ?? null;
  }

  const target = locationId
    ? await prisma.location.findFirst({
        where: { id: locationId, workspaceId },
        select: {
          latitude: true,
          longitude: true,
          geofenceRadiusMeters: true,
          geofenceEnforced: true,
        },
      })
    : null;

  // Same evaluator the punch clock uses, so a photo and a clock-in taken at
  // the same spot can never disagree about where that spot was.
  const decision = evaluateGeofence(target, {
    latitude: body.latitude ?? null,
    longitude: body.longitude ?? null,
    accuracyM: body.accuracyM ?? null,
    mocked: body.mocked ?? false,
  });

  const photo = await prisma.workProofPhoto.create({
    data: {
      storagePath: body.storagePath,
      fileName: body.fileName.slice(0, 500),
      fileType: stat.mimetype,
      fileSize: BigInt(stat.size),
      // capturedAt is the column default: the server clock, not the device's.
      latitude: body.latitude ?? null,
      longitude: body.longitude ?? null,
      accuracyM: body.accuracyM ?? null,
      distanceM: decision.distanceM,
      geofenceStatus: decision.status,
      locationMocked: body.mocked ?? false,
      note: body.note?.slice(0, 500) ?? null,
      timeEntryId: body.timeEntryId ?? null,
      shiftId: body.shiftId ?? null,
      locationId,
      employeeId: employee.id,
      workspaceId,
    },
    select: {
      id: true,
      capturedAt: true,
      geofenceStatus: true,
      distanceM: true,
    },
  });

  log.info("[work-proof] photo registered", {
    workspaceId,
    photoId: photo.id,
    geofenceStatus: photo.geofenceStatus,
  });

  return NextResponse.json(
    {
      id: photo.id,
      capturedAt: photo.capturedAt,
      geofenceStatus: photo.geofenceStatus,
      distanceM: photo.distanceM,
    },
    { status: 201 },
  );
});

export const GET = withRoute("/api/work-proof", "GET", async (req) => {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;
  const { user, workspaceId } = auth;

  /**
   * An employee sees only their own proof, never a colleague's.
   *
   * These photos are of workplaces and sometimes of people, and one worker has
   * no business reviewing where another was standing at 05:20. Managers see the
   * whole workspace because reviewing the round is the entire point for them.
   * The filter is applied server-side: a client-supplied employeeId would let
   * anyone read anyone.
   */
  let ownEmployeeId: string | null = null;
  if (!isManagement(user)) {
    const me = await prisma.employee.findFirst({
      where: { workspaceId, userId: user.id },
      select: { id: true },
    });
    // No employee record means nothing of their own exists to show.
    if (!me) return NextResponse.json({ photos: [] });
    ownEmployeeId = me.id;
  }

  const { searchParams } = new URL(req.url);
  const shiftId = searchParams.get("shiftId");
  const timeEntryId = searchParams.get("timeEntryId");
  const date = searchParams.get("date");

  const photos = await prisma.workProofPhoto.findMany({
    where: {
      workspaceId,
      deletedAt: null,
      ...(ownEmployeeId ? { employeeId: ownEmployeeId } : {}),
      ...(shiftId ? { shiftId } : {}),
      ...(timeEntryId ? { timeEntryId } : {}),
      ...(date
        ? {
            capturedAt: {
              gte: new Date(`${date}T00:00:00.000Z`),
              lt: new Date(`${date}T23:59:59.999Z`),
            },
          }
        : {}),
    },
    orderBy: { capturedAt: "desc" },
    take: 200,
    select: {
      id: true,
      storagePath: true,
      fileName: true,
      capturedAt: true,
      latitude: true,
      longitude: true,
      accuracyM: true,
      distanceM: true,
      geofenceStatus: true,
      locationMocked: true,
      note: true,
      shiftId: true,
      timeEntryId: true,
      employee: { select: { id: true, firstName: true, lastName: true } },
      location: { select: { id: true, name: true } },
    },
  });

  // Signed per request: a read link is deliberately short-lived, so it cannot
  // be forwarded and used indefinitely.
  const withUrls = await Promise.all(
    photos.map(async (p) => ({
      ...p,
      url: await createPhotoReadUrl(p.storagePath),
      storagePath: undefined,
    })),
  );

  return NextResponse.json({ photos: withUrls });
});
