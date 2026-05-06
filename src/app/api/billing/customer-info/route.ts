import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import type { SessionUser } from "@/lib/types";

const updateSchema = z.object({
  companyName: z.string().max(200).optional(),
  vatId: z.string().max(50).optional(),
  billingEmail: z.string().email().max(200).optional().or(z.literal("")),
  billingAddress: z.string().max(300).optional(),
  billingCity: z.string().max(100).optional(),
  billingPostalCode: z.string().max(20).optional(),
  billingCountry: z.string().length(2).optional(),
});

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session)
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const user = session.user as SessionUser;
  if (!user.workspaceId)
    return NextResponse.json({ error: "NO_WORKSPACE" }, { status: 400 });
  if (user.role !== "OWNER" && user.role !== "ADMIN") {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  const record = await prisma.workspaceCustomer.findUnique({
    where: { workspaceId: user.workspaceId },
  });

  return NextResponse.json(record ?? {});
}

export async function PUT(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session)
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const user = session.user as SessionUser;
  if (!user.workspaceId)
    return NextResponse.json({ error: "NO_WORKSPACE" }, { status: 400 });
  if (user.role !== "OWNER" && user.role !== "ADMIN") {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "VALIDATION_ERROR", details: parsed.error.flatten() },
      { status: 422 },
    );
  }

  const data = parsed.data;
  const record = await prisma.workspaceCustomer.upsert({
    where: { workspaceId: user.workspaceId },
    update: { ...data, updatedAt: new Date() },
    create: { workspaceId: user.workspaceId, ...data },
  });

  return NextResponse.json(record);
}
