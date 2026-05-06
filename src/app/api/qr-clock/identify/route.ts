import { NextResponse } from "next/server";
import { withRoute } from "@/lib/with-route";
import { verifyQrToken } from "@/lib/qr-token";
import { hashPin } from "@/lib/employee-pin";
import { prisma } from "@/lib/db";

/**
 * POST /api/qr-clock/identify
 *
 * Public endpoint. Verifies a QR token + employee PIN without performing any
 * punch action. Used by the /stempel page to show the employee's name before
 * they choose IN or OUT — zero data leakage until the correct PIN is entered.
 *
 * Body: { token: string; pin: string }
 * Response 200: { employeeId, employeeName }
 * Response 401: token expired
 * Response 404: wrong PIN
 */
export const POST = withRoute("/api/qr-clock/identify", "POST", async (req) => {
  let body: { token?: string; pin?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "INVALID_JSON" }, { status: 400 });
  }

  const { token, pin } = body ?? {};
  if (!token || !pin) {
    return NextResponse.json({ error: "MISSING_FIELDS" }, { status: 400 });
  }
  if (!/^\d{4}$/.test(pin)) {
    return NextResponse.json({ error: "INVALID_PIN_FORMAT" }, { status: 400 });
  }

  const workspaceId = verifyQrToken(token);
  if (!workspaceId) {
    return NextResponse.json(
      { error: "INVALID_OR_EXPIRED_TOKEN" },
      { status: 401 },
    );
  }

  const pinHash = hashPin(workspaceId, pin);
  const employee = await prisma.employee.findFirst({
    where: { workspaceId, pinHash, isActive: true, deletedAt: null },
    select: { id: true, firstName: true, lastName: true },
  });

  if (!employee) {
    return NextResponse.json({ error: "INVALID_PIN" }, { status: 404 });
  }

  return NextResponse.json({
    employeeId: employee.id,
    employeeName: `${employee.firstName} ${employee.lastName}`,
    firstName: employee.firstName,
  });
});
