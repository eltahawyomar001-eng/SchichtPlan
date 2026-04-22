import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { hasTicketingAddon } from "@/lib/ticketing-addon";
import type { SessionUser } from "@/lib/types";

/**
 * Tickets section gate. The ticket UI is only available when the workspace
 * has purchased the Ticketing add-on (see /lib/ticketing-addon.ts).
 *
 * Workspaces without the add-on are redirected to the billing page anchored
 * to the ticketing add-on section, where they can subscribe.
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
    redirect("/einstellungen/abonnement#ticketing-addon");
  }

  return <>{children}</>;
}
