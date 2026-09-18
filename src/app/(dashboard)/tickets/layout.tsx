import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { hasTicketingAddon } from "@/lib/ticketing-addon";
import { isAdmin } from "@/lib/authorization";
import { AddonLocked } from "@/components/billing/addon-locked";
import type { SessionUser } from "@/lib/types";

/**
 * Tickets section gate. Available only when the workspace has the add-on.
 *
 * Nobody is redirected away any more. An admin used to be sent to the billing
 * page, which is precisely what made a fresh purchase look like it had failed:
 * you click the feature and land back on Settings → Subscription. Now the
 * locked state renders in place, with the purchase one click away.
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
    return <AddonLocked feature="tickets" canSubscribe={isAdmin(user)} />;
  }

  return <>{children}</>;
}
