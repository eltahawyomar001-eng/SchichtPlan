"use client";

import { useEffect, useState } from "react";
import { useSession, signIn, signOut } from "next-auth/react";
import { useRouter, useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import Link from "next/link";
import {
  SchichtPlanMark,
  CheckCircleIcon,
  UsersIcon,
  AlertCircleIcon,
  ClockIcon,
} from "@/components/icons";

type InvitationDetails = {
  id: string;
  email: string;
  role: string;
  workspaceName: string;
  invitedByName: string;
  expiresAt: string;
};

export default function EinladungPage() {
  const router = useRouter();
  const params = useParams();
  const token = params.token as string;
  const { data: session, status: sessionStatus } = useSession();
  const t = useTranslations("invitation");

  const [invitation, setInvitation] = useState<InvitationDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [accepting, setAccepting] = useState(false);
  const [accepted, setAccepted] = useState(false);

  // Pre-check: does the signed-in email match the invitation?
  const isEmailMatch =
    session?.user?.email &&
    invitation?.email &&
    session.user.email.toLowerCase() === invitation.email.toLowerCase();

  const isSignedIn = !!session?.user;

  // Fetch invitation details
  useEffect(() => {
    async function fetchInvitation() {
      try {
        const res = await fetch(`/api/auth/invitation/${token}`);
        if (res.ok) {
          const data = await res.json();
          setInvitation(data);
        } else {
          const data = await res.json();
          setError(data.error || "INVALID_TOKEN");
        }
      } catch {
        setError("NETWORK_ERROR");
      } finally {
        setLoading(false);
      }
    }

    if (token) {
      fetchInvitation();
    }
  }, [token]);

  // Accept invitation
  const handleAccept = async () => {
    setAccepting(true);
    setError(null);

    try {
      const res = await fetch(`/api/invitations/token/${token}`, {
        method: "POST",
      });
      const data = await res.json();

      if (res.ok) {
        setAccepted(true);
        setTimeout(() => {
          router.push("/dashboard");
        }, 2000);
      } else {
        setError(data.error || "ACCEPT_FAILED");
      }
    } catch {
      setError("NETWORK_ERROR");
    } finally {
      setAccepting(false);
    }
  };

  // Sign out and redirect back to this invitation page to sign in
  // with the correct account
  const handleSwitchAccount = () => {
    signOut({ callbackUrl: `/einladung/${token}` });
  };

  // Sign out and redirect to login with callback to this page
  const handleSignInWithCorrectEmail = () => {
    signOut({
      callbackUrl: `/login?callbackUrl=${encodeURIComponent(`/einladung/${token}`)}`,
    });
  };

  // Sign out and redirect to register with pre-filled invitation data
  const handleRegisterWithCorrectEmail = () => {
    const registerUrl =
      `/register?invitation=${token}` +
      `&email=${encodeURIComponent(invitation?.email || "")}`;
    signOut({ callbackUrl: registerUrl });
  };

  const roleLabels: Record<string, string> = {
    ADMIN: t("roleAdmin"),
    MANAGER: t("roleManager"),
    EMPLOYEE: t("roleEmployee"),
  };

  const errorMessages: Record<string, string> = {
    INVALID_TOKEN: t("errorInvalid"),
    INVITATION_EXPIRED: t("errorExpired"),
    INVITATION_ACCEPTED: t("errorAlreadyAccepted"),
    INVITATION_REVOKED: t("errorRevoked"),
    EMAIL_MISMATCH: t("errorEmailMismatch"),
    ALREADY_IN_WORKSPACE: t("errorAlreadyInWorkspace"),
    NETWORK_ERROR: t("errorNetwork"),
    ACCEPT_FAILED: t("errorAcceptFailed"),
  };

  // Loading state
  if (loading || sessionStatus === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-violet-600 border-t-transparent" />
          <p className="mt-3 text-sm text-gray-500">{t("loading")}</p>
        </div>
      </div>
    );
  }

  // Error state (only for fatal errors where we have no invitation data)
  if (error && !invitation) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
        <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-lg text-center">
          <Link href="/" className="mb-6 inline-flex items-center gap-2">
            <SchichtPlanMark className="h-8 w-8" />
            <span className="text-lg font-bold text-gray-900">SchichtPlan</span>
          </Link>
          <div className="mx-auto mt-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-50">
            <AlertCircleIcon className="h-7 w-7 text-red-500" />
          </div>
          <h1 className="mt-4 text-xl font-bold text-gray-900">
            {t("errorTitle")}
          </h1>
          <p className="mt-2 text-sm text-gray-500">
            {errorMessages[error] || t("errorGeneric")}
          </p>
          <div className="mt-6 flex flex-col gap-3">
            <Link
              href="/login"
              className="inline-flex items-center justify-center rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-violet-700 transition-colors"
            >
              {t("goToLogin")}
            </Link>
            <Link
              href="/"
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              {t("backToHome")}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Accepted state
  if (accepted) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
        <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-lg text-center">
          <Link href="/" className="mb-6 inline-flex items-center gap-2">
            <SchichtPlanMark className="h-8 w-8" />
            <span className="text-lg font-bold text-gray-900">SchichtPlan</span>
          </Link>
          <div className="mx-auto mt-4 flex h-14 w-14 items-center justify-center rounded-full bg-green-50">
            <CheckCircleIcon className="h-7 w-7 text-green-500" />
          </div>
          <h1 className="mt-4 text-xl font-bold text-gray-900">
            {t("acceptedTitle")}
          </h1>
          <p className="mt-2 text-sm text-gray-500">
            {t("acceptedMessage", {
              workspace: invitation?.workspaceName || "",
            })}
          </p>
          <p className="mt-1 text-xs text-gray-400">{t("redirecting")}</p>
        </div>
      </div>
    );
  }

  // Main invitation view
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-lg">
        {/* Header */}
        <div className="text-center">
          <Link href="/" className="mb-6 inline-flex items-center gap-2">
            <SchichtPlanMark className="h-8 w-8" />
            <span className="text-lg font-bold text-gray-900">SchichtPlan</span>
          </Link>
          <div className="mx-auto mt-4 flex h-14 w-14 items-center justify-center rounded-full bg-violet-50">
            <UsersIcon className="h-7 w-7 text-violet-600" />
          </div>
          <h1 className="mt-4 text-xl font-bold text-gray-900">{t("title")}</h1>
          <p className="mt-2 text-sm text-gray-500">
            {t("subtitle", { name: invitation?.invitedByName || t("someone") })}
          </p>
        </div>

        {/* Invitation details */}
        <div className="mt-6 rounded-xl border border-gray-200 bg-gray-50 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-500">{t("workspace")}</span>
            <span className="text-sm font-semibold text-gray-900">
              {invitation?.workspaceName}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-500">{t("role")}</span>
            <span className="inline-flex items-center rounded-full bg-violet-100 px-2.5 py-0.5 text-xs font-medium text-violet-700">
              {roleLabels[invitation?.role || "EMPLOYEE"]}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-500">{t("invitedAs")}</span>
            <span className="text-sm font-medium text-gray-900">
              {invitation?.email}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-500">{t("expires")}</span>
            <span className="flex items-center gap-1 text-xs text-gray-500">
              <ClockIcon className="h-3.5 w-3.5" />
              {invitation?.expiresAt
                ? new Date(invitation.expiresAt).toLocaleDateString("de-DE")
                : "-"}
            </span>
          </div>
        </div>

        {/* Error from accept attempt */}
        {error && (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            {errorMessages[error] || t("errorGeneric")}
          </div>
        )}

        {/* Action section — 3 states: email match, email mismatch, not signed in */}
        <div className="mt-6">
          {isSignedIn && isEmailMatch ? (
            /* ✅ Signed in with the CORRECT email — show accept */
            <div className="space-y-3">
              <p className="text-sm text-gray-600 text-center">
                {t("loggedInAs", { email: session?.user?.email || "" })}
              </p>
              <button
                onClick={handleAccept}
                disabled={accepting}
                className="w-full rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-50 transition-colors"
              >
                {accepting ? t("accepting") : t("acceptInvitation")}
              </button>
            </div>
          ) : isSignedIn && !isEmailMatch ? (
            /* ⚠️ Signed in with the WRONG email — show mismatch warning */
            <div className="space-y-4">
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
                <div className="flex gap-3">
                  <AlertCircleIcon className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-amber-800">
                      {t("mismatchTitle")}
                    </p>
                    <p className="text-sm text-amber-700">
                      {t("mismatchDetail", {
                        currentEmail: session?.user?.email || "",
                        invitedEmail: invitation?.email || "",
                      })}
                    </p>
                  </div>
                </div>
              </div>
              <button
                onClick={handleSignInWithCorrectEmail}
                className="w-full rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-violet-700 transition-colors"
              >
                {t("switchAndSignIn", {
                  email: invitation?.email || "",
                })}
              </button>
              <button
                onClick={handleRegisterWithCorrectEmail}
                className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                {t("switchAndRegister", {
                  email: invitation?.email || "",
                })}
              </button>
              <button
                onClick={handleSwitchAccount}
                className="w-full text-sm text-gray-500 hover:text-gray-700 transition-colors"
              >
                {t("switchAccount")}
              </button>
            </div>
          ) : (
            /* 🔒 Not signed in — offer sign in or register */
            <div className="space-y-3">
              <p className="text-sm text-gray-600 text-center">
                {t("signInToAccept")}
              </p>
              <button
                onClick={() =>
                  signIn(undefined, {
                    callbackUrl: `/einladung/${token}`,
                  })
                }
                className="w-full rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-violet-700 transition-colors"
              >
                {t("signIn")}
              </button>
              <Link
                href={`/register?invitation=${token}&email=${encodeURIComponent(invitation?.email || "")}`}
                className="block w-full rounded-lg border border-gray-300 px-4 py-2.5 text-center text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                {t("createAccount")}
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
