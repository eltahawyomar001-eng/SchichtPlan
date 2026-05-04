import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { hasTicketingAddon } from "@/lib/ticketing-addon";
import { isAdmin } from "@/lib/authorization";
import { AddonLocked } from "@/components/billing/addon-locked";
import type { SessionUser } from "@/lib/types";

/**
 * Tickets section gate. The ticket UI is only available when the workspace
 * has purchased the Ticketing add-on (see /lib/ticketing-addon.ts).
 *
 * Behaviour when the add-on is missing:
 * - OWNER / ADMIN: redirected to the billing page so they can subscribe.
 * - MANAGER / EMPLOYEE: shown a locked-feature view (they cannot manage
 *   subscriptions, so the billing page would just bounce them).
 */
export default async function TicketsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const user = session.user as SessionUser;
  if (!user.workspaceId) redirect("/onboarding");

  const hasAddon = await hasTicketingAddon(user.workspaceId);
  if (!hasAddon) {
    if (isAdmin(user)) {
      redirect("/einstellungen/abonnement?addon=ticketing");
    }
    return <AddonLocked feature="tickets" />;
  }

  return <>{children}</>;
}
