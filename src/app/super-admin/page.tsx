import { notFound } from "next/navigation";
import { isSuperAdmin } from "@/lib/super-admin-auth";
import { prisma } from "@/lib/db";
import { WorkspacesTable } from "./_components/workspaces-table";

export default async function SuperAdminPage() {
  if (!(await isSuperAdmin())) notFound();

  const workspaces = await prisma.workspace.findMany({
    include: {
      subscription: {
        select: {
          plan: true,
          status: true,
          seatCount: true,
          trialStart: true,
          trialEnd: true,
          currentPeriodEnd: true,
          cancelAtPeriodEnd: true,
          stripeCustomerId: true,
          stripeSubscriptionId: true,
        },
      },
      members: {
        where: { role: "OWNER" },
        select: { email: true, name: true },
        take: 1,
      },
      _count: { select: { members: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-zinc-950">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
            Super Admin
          </h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            {workspaces.length} workspace
            {workspaces.length !== 1 ? "s" : ""} ·{" "}
            {
              workspaces.filter((w) => w.subscription?.status === "ACTIVE")
                .length
            }{" "}
            paying
          </p>
        </div>
        <WorkspacesTable workspaces={workspaces} />
      </div>
    </div>
  );
}
