import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { getTranslations } from "next-intl/server";
import { authOptions } from "@/lib/auth";
import { hasSchichtplanungAddon } from "@/lib/schichtplanung-addon";
import type { SessionUser } from "@/lib/types";

/**
 * Schichtplan section gate. The shift planning UI is only available when the
 * workspace has either:
 *   - the Schichtplanung add-on active (Basic / Professional plans), or
 *   - an Enterprise plan (the module is included for free).
 *
 * OWNER/ADMIN → redirected to the billing page to subscribe.
 * MANAGER/EMPLOYEE → shown an informational notice (they cannot self-subscribe).
 */
export default async function SchichtplanLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const user = session.user as SessionUser;
  if (!user.workspaceId) redirect("/onboarding");

  const hasAddon = await hasSchichtplanungAddon(user.workspaceId);
  if (hasAddon) return <>{children}</>;

  // OWNER/ADMIN can subscribe → send them to billing.
  if (user.role === "OWNER" || user.role === "ADMIN") {
    redirect("/einstellungen/abonnement#schichtplanung-addon");
  }

  // MANAGER/EMPLOYEE cannot subscribe — render an informational notice.
  const t = await getTranslations("shiftPlan");

  return (
    <div className="flex min-h-[60vh] items-center justify-center p-8">
      <div className="max-w-sm text-center">
        <p className="text-lg font-semibold text-neutral-900">
          {t("addonNotActivatedTitle")}
        </p>
        <p className="mt-2 text-sm text-neutral-500">
          {t("addonNotActivatedDescription")}
        </p>
      </div>
    </div>
  );
}
