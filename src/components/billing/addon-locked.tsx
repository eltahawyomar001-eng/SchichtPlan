import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Topbar } from "@/components/layout/topbar";
import { PageContent } from "@/components/ui/page-content";
import { LockIcon, ArrowRightIcon } from "@/components/icons";

type Feature = "tickets" | "schichtplanung";

interface Props {
  feature: Feature;
  /**
   * OWNER / ADMIN get a link to the add-on on the billing page. Everyone else
   * gets "ask your administrator", since they cannot manage subscriptions.
   */
  canSubscribe?: boolean;
}

/** Anchor of the add-on's card on the billing page, so the link lands on it. */
const BILLING_HREF: Record<Feature, string> = {
  tickets: "/einstellungen/abonnement?addon=ticketing#ticketing-addon",
  schichtplanung:
    "/einstellungen/abonnement?addon=schichtplanung#schichtplanung-addon",
};

/**
 * Shown in place of a feature the workspace has not bought.
 *
 * Admins used to be `redirect()`ed to the billing page from the route's layout
 * instead. That is what made buying an add-on feel broken: the click landed
 * back on the subscription page, which reads as "your purchase didn't work"
 * rather than "you don't own this yet". Rendering the state where the user
 * asked for it — with the purchase one click away — keeps them oriented, and
 * means a stale gate degrades into a visible panel instead of a bounce.
 */
export async function AddonLocked({ feature, canSubscribe = false }: Props) {
  const t = await getTranslations("addon");
  const featureName = t(`${feature}Name`);

  return (
    <>
      <Topbar title={featureName} />
      <PageContent>
        <div className="flex min-h-[60vh] items-center justify-center px-4">
          <div className="w-full max-w-md rounded-2xl border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-6 sm:p-8 text-center shadow-sm">
            <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-amber-50 dark:bg-amber-950/30">
              <LockIcon className="h-7 w-7 text-amber-600 dark:text-amber-400" />
            </div>
            <h1 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white">
              {t("lockedTitle", { feature: featureName })}
            </h1>
            <p className="mt-3 text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
              {t("lockedDescription", { feature: featureName })}
            </p>

            {canSubscribe ? (
              <Link
                href={BILLING_HREF[feature]}
                className="mt-6 inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 transition-colors"
              >
                {t("unlockCta", { feature: featureName })}
                <ArrowRightIcon className="h-4 w-4" />
              </Link>
            ) : (
              <div className="mt-6 inline-flex items-center gap-2 rounded-lg bg-gray-50 dark:bg-zinc-800 px-4 py-2.5 text-xs font-medium text-gray-600 dark:text-gray-300">
                {t("contactAdmin")}
              </div>
            )}
          </div>
        </div>
      </PageContent>
    </>
  );
}
