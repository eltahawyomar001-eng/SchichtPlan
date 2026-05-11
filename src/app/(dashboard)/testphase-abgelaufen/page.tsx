import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { authOptions } from "@/lib/auth";
import { getSubscriptionState } from "@/lib/subscription";
import { prisma } from "@/lib/db";
import type { SessionUser } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function TrialExpiredPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const user = session.user as SessionUser;
  const t = await getTranslations("trialExpired");

  if (user.workspaceId) {
    const state = await getSubscriptionState(user.workspaceId);
    if (state === "active") redirect("/dashboard");

    // Legacy workspaces created before live Stripe integration: their trial
    // record references no real Stripe customer. Send owners straight to the
    // billing-setup page instead of the dead-end "trial expired" screen.
    if (user.role === "OWNER" || user.role === "ADMIN") {
      const sub = await prisma.subscription.findUnique({
        where: { workspaceId: user.workspaceId },
        select: { stripeCustomerId: true, stripeSubscriptionId: true },
      });
      const hasRealStripe =
        (sub?.stripeCustomerId && !sub.stripeCustomerId.startsWith("sim_")) ||
        (sub?.stripeSubscriptionId &&
          !sub.stripeSubscriptionId.startsWith("sim_"));
      if (!hasRealStripe) {
        redirect("/einstellungen/abonnement?legacy=1");
      }
    }
  }

  const isOwnerOrAdmin = user.role === "OWNER" || user.role === "ADMIN";

  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-50 dark:bg-zinc-950 p-6">
      <div className="w-full max-w-md rounded-2xl border border-neutral-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-8 shadow-sm text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-950/50">
          <svg
            className="h-7 w-7 text-amber-600 dark:text-amber-400"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        </div>
        <h1 className="text-2xl font-semibold text-neutral-900 dark:text-zinc-100">
          {t("title")}
        </h1>
        <p className="mt-3 text-sm text-neutral-600 dark:text-zinc-400">
          {t("description")}
        </p>
        {isOwnerOrAdmin ? (
          <>
            <p className="mt-4 text-sm font-medium text-neutral-700 dark:text-zinc-300">
              {t("ctaHint")}
            </p>
            <div className="mt-6 flex flex-col gap-3">
              <Link
                href="/einstellungen/abonnement"
                className="inline-flex w-full items-center justify-center rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 transition-colors"
              >
                {t("ctaButton")}
              </Link>
              <Link
                href="/api/auth/signout"
                className="inline-flex w-full items-center justify-center rounded-lg border border-neutral-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-4 py-2 text-sm font-medium text-neutral-700 dark:text-zinc-300 hover:bg-neutral-50 dark:hover:bg-zinc-800"
              >
                {t("signOut")}
              </Link>
            </div>
          </>
        ) : (
          <>
            <p className="mt-4 text-xs text-neutral-500 dark:text-zinc-500">
              {t("contactAdmin")}
            </p>
            <div className="mt-6">
              <Link
                href="/api/auth/signout"
                className="inline-flex w-full items-center justify-center rounded-lg border border-neutral-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-4 py-2 text-sm font-medium text-neutral-700 dark:text-zinc-300 hover:bg-neutral-50 dark:hover:bg-zinc-800"
              >
                {t("signOut")}
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
