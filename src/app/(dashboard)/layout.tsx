import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { hasActiveSubscription } from "@/lib/subscription";
import type { SessionUser } from "@/lib/types";

/**
 * Paths that remain reachable inside the dashboard even when the workspace
 * has no active subscription. Owners/admins MUST be able to reach the
 * billing page to subscribe; everyone needs to log out.
 */
const SUBSCRIPTION_ALLOWLIST = [
  "/einstellungen/abonnement",
  "/einstellungen/profil",
  "/workspace-inaktiv",
];

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/login");
  }

  const user = session.user as SessionUser;

  // Redirect new workspaces to the onboarding wizard.
  // Only applies to OWNER and ADMIN — employees join existing workspaces.
  if (
    user.onboardingCompleted === false &&
    (user.role === "OWNER" || user.role === "ADMIN")
  ) {
    redirect("/onboarding");
  }

  // ── Subscription gate ─────────────────────────────────────────────
  // No mocks, no trials: the workspace MUST have an active Stripe
  // subscription before any dashboard route (other than billing) is
  // accessible. OWNER/ADMIN are sent to the billing page; everyone else
  // sees an "inactive workspace" notice (they cannot self-subscribe).
  if (user.workspaceId) {
    const hdrs = await headers();
    const pathname = hdrs.get("x-pathname") ?? "";
    const isAllowlisted = SUBSCRIPTION_ALLOWLIST.some((p) =>
      pathname.startsWith(p),
    );

    if (!isAllowlisted) {
      const active = await hasActiveSubscription(user.workspaceId);
      if (!active) {
        if (user.role === "OWNER" || user.role === "ADMIN") {
          redirect("/einstellungen/abonnement?required=1");
        }
        redirect("/workspace-inaktiv");
      }
    }
  }

  return <DashboardShell>{children}</DashboardShell>;
}
