import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { hasSchichtplanungAddon } from "@/lib/schichtplanung-addon";
import type { SessionUser } from "@/lib/types";

/**
 * Schichtplan section gate. The shift planning UI is only available when the
 * workspace has the Schichtplanung add-on active (or is on the Enterprise plan,
 * which includes it at no extra charge).
 *
 * Workspaces without the add-on are redirected to the billing page anchored
 * to the schichtplanung add-on section, where they can subscribe.
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
    redirect("/einstellungen/abonnement?addon=schichtplanung");
  }

  return <>{children}</>;
}
