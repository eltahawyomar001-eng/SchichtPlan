import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { authOptions } from "@/lib/auth";
import { hasActiveSubscription } from "@/lib/subscription";
import type { SessionUser } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function WorkspaceInactivePage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const user = session.user as SessionUser;
  const t = await getTranslations("workspaceInactive");

  // If a subscription has since become active, send them home.
  if (user.workspaceId) {
    const active = await hasActiveSubscription(user.workspaceId);
    if (active) redirect("/dashboard");
  }

  // Owners/admins shouldn't land here — push them to billing.
  if (user.role === "OWNER" || user.role === "ADMIN") {
    redirect("/einstellungen/abonnement?required=1");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-50 p-6">
      <div className="w-full max-w-md rounded-2xl border border-neutral-200 bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-semibold text-neutral-900">
          {t("title")}
        </h1>
        <p className="mt-3 text-sm text-neutral-600">{t("description")}</p>
        <p className="mt-6 text-xs text-neutral-500">{t("contactAdmin")}</p>
        <div className="mt-6 flex gap-3">
          <Link
            href="/api/auth/signout"
            className="inline-flex flex-1 items-center justify-center rounded-lg border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
          >
            {t("signOut")}
          </Link>
        </div>
      </div>
    </div>
  );
}
