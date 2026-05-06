import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import type { SessionUser } from "@/lib/types";
import { requireAdmin } from "@/lib/authorization";
import { generateUniquePin, hashPin, sendPinEmail } from "@/lib/employee-pin";
import { log } from "@/lib/logger";

/**
 * POST /api/employees/[id]/resend-pin
 *
 * Generates a fresh 4-digit PIN for the employee, saves the hash, and sends
 * the plain PIN by email. Requires ADMIN or OWNER.
 */
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const user = session.user as SessionUser;
  const workspaceId = user.workspaceId;

  const forbidden = requireAdmin(user);
  if (forbidden) return forbidden;

  const employee = await prisma.employee.findFirst({
    where: { id, workspaceId, deletedAt: null },
    select: { id: true, firstName: true, email: true },
  });

  if (!employee) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  try {
    const rawPin = await generateUniquePin(workspaceId);
    const pHash = hashPin(workspaceId, rawPin);

    await prisma.employee.update({
      where: { id: employee.id },
      data: { pinHash: pHash },
    });

    if (employee.email) {
      const ws = await prisma.workspace.findUnique({
        where: { id: workspaceId },
        select: { name: true },
      });
      await sendPinEmail({
        to: employee.email,
        firstName: employee.firstName,
        rawPin,
        workspaceName: ws?.name ?? "",
      });
    }

    return NextResponse.json({ success: true, hasEmail: !!employee.email });
  } catch (err) {
    log.error("[resend-pin] failed", { err, employeeId: id });
    return NextResponse.json(
      { error: "PIN_GENERATION_FAILED" },
      { status: 500 },
    );
  }
}
