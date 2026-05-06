import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { getSubscriptionState, getHardBlockState } from "@/lib/subscription";
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
  "/testphase-abgelaufen",
];

/**
 * Paths that remain accessible even during a hard-block (30 days over limit).
 * Billing and profile pages allow the admin to resolve the situation.
 */
const HARD_BLOCK_ALLOWLIST = [
  "/einstellungen/abonnement",
  "/einstellungen/profil",
  "/hard-block",
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
      const state = await getSubscriptionState(user.workspaceId);
      if (state !== "active") {
        if (state === "trial_expired") {
          redirect("/testphase-abgelaufen");
        }
        if (user.role === "OWNER" || user.role === "ADMIN") {
          redirect("/einstellungen/abonnement?required=1");
        }
        redirect("/workspace-inaktiv");
      }

      // Hard-block: 30 days over seat limit → block all admin features.
      // Punch clock (/stempel, /api/qr-clock/*) lives outside the dashboard
      // group so employees can still clock in/out (§ 16 ArbZG compliance).
      const isHardBlockAllowlisted = HARD_BLOCK_ALLOWLIST.some((p) =>
        pathname.startsWith(p),
      );
      if (!isHardBlockAllowlisted) {
        const hardBlocked = await getHardBlockState(user.workspaceId);
        if (hardBlocked) redirect("/hard-block");
      }
    }
  }

  return <DashboardShell>{children}</DashboardShell>;
}
