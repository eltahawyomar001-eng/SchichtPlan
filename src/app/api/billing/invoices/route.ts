import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-response";
import { requirePermission } from "@/lib/authorization";
import { prisma } from "@/lib/db";
import { withRoute } from "@/lib/with-route";

export const GET = withRoute("/api/billing/invoices", "GET", async () => {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;
  const { user, workspaceId } = auth;

  const forbidden = requirePermission(user, "settings", "read");
  if (forbidden) return forbidden;

  const invoices = await prisma.invoice.findMany({
    where: { workspaceId },
    orderBy: { issuedAt: "desc" },
    take: 24,
    select: {
      id: true,
      invoiceNumber: true,
      issuedAt: true,
      amount: true,
      vatAmount: true,
      currency: true,
      pdfUrl: true,
      hostedUrl: true,
    },
  });

  return NextResponse.json({ invoices });
});
