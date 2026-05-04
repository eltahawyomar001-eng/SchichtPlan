import { getTranslations } from "next-intl/server";
import { Topbar } from "@/components/layout/topbar";
import { PageContent } from "@/components/ui/page-content";
import { LockIcon } from "@/components/icons";

interface Props {
  feature: "tickets" | "schichtplanung";
}

/**
 * Rendered to non-admin users (MANAGER / EMPLOYEE) when their workspace lacks
 * the required add-on. Admins are redirected to the billing page instead so
 * they can subscribe; non-admins see this informational view since they do
 * not have permission to manage subscriptions.
 */
export async function AddonLocked({ feature }: Props) {
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
            <div className="mt-6 inline-flex items-center gap-2 rounded-lg bg-gray-50 dark:bg-zinc-800 px-4 py-2.5 text-xs font-medium text-gray-600 dark:text-gray-300">
              {t("contactAdmin")}
            </div>
          </div>
        </div>
      </PageContent>
    </>
  );
}
