import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { authOptions } from "@/lib/auth";
import { getHardBlockState } from "@/lib/subscription";
import type { SessionUser } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function HardBlockPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const user = session.user as SessionUser;
  const t = await getTranslations("hardBlock");

  if (user.workspaceId) {
    const blocked = await getHardBlockState(user.workspaceId);
    if (!blocked) redirect("/dashboard");
  }

  const isOwnerOrAdmin = user.role === "OWNER" || user.role === "ADMIN";

  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-neutral-50 p-6">
      <div className="w-full max-w-md rounded-2xl border border-red-200 bg-white p-8 shadow-sm text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-100">
          <svg
            className="h-7 w-7 text-red-600"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"
            />
          </svg>
        </div>
        <h1 className="text-2xl font-semibold text-neutral-900">
          {t("title")}
        </h1>
        <p className="mt-3 text-sm text-neutral-600">{t("description")}</p>
        <p className="mt-3 text-xs text-emerald-700 font-medium bg-emerald-50 rounded-lg px-3 py-2">
          {t("punchClockNote")}
        </p>
        {isOwnerOrAdmin ? (
          <>
            <p className="mt-4 text-sm font-medium text-neutral-700">
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
                className="inline-flex w-full items-center justify-center rounded-lg border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
              >
                {t("signOut")}
              </Link>
            </div>
          </>
        ) : (
          <>
            <p className="mt-4 text-xs text-neutral-500">{t("contactAdmin")}</p>
            <div className="mt-6">
              <Link
                href="/api/auth/signout"
                className="inline-flex w-full items-center justify-center rounded-lg border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
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
