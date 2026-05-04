import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { hasSchichtplanungAddon } from "@/lib/schichtplanung-addon";
import { isAdmin } from "@/lib/authorization";
import { AddonLocked } from "@/components/billing/addon-locked";
import type { SessionUser } from "@/lib/types";

/**
 * Schichtplan section gate. The shift planning UI is only available when the
 * workspace has the Schichtplanung add-on active (or is on the Enterprise plan,
 * which includes it at no extra charge).
 *
 * Behaviour when the add-on is missing:
 * - OWNER / ADMIN: redirected to the billing page so they can subscribe.
 * - MANAGER / EMPLOYEE: shown a locked-feature view (they cannot manage
 *   subscriptions, so the billing page would just bounce them).
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
  if (!hasAddon) {
    if (isAdmin(user)) {
      redirect("/einstellungen/abonnement?addon=schichtplanung");
    }
    return <AddonLocked feature="schichtplanung" />;
  }

  return <>{children}</>;
}
