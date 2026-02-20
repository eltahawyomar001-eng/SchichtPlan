"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import Link from "next/link";
import {
  SchichtPlanMark,
  UserIcon,
  MailIcon,
  BuildingIcon,
  LockIcon,
  EyeIcon,
  EyeOffIcon,
  CheckCircleIcon,
  CalendarIcon,
  UsersIcon,
  ClockIcon,
} from "@/components/icons";

function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const t = useTranslations("auth");

  const invitationToken = searchParams.get("invitation") || "";
  const invitedEmail = searchParams.get("email") || "";
  const isInvitation = !!invitationToken;

  const [formData, setFormData] = useState({
    name: "",
    email: invitedEmail,
    password: "",
    confirmPassword: "",
    workspaceName: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [consentGiven, setConsentGiven] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (formData.password !== formData.confirmPassword) {
      setError(t("passwordsNoMatch"));
      return;
    }

    if (formData.password.length < 8) {
      setError(t("passwordTooShort"));
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name,
          email: formData.email,
          password: formData.password,
          workspaceName: isInvitation ? undefined : formData.workspaceName,
          invitationToken: isInvitation ? invitationToken : undefined,
          consentGiven,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || t("registrationFailed"));
        setLoading(false);
        return;
      }

      router.push("/login?registered=true");
    } catch {
      setError(t("genericError"));
      setLoading(false);
    }
  };

  const passwordStrength =
    formData.password.length === 0
      ? 0
      : formData.password.length < 8
        ? 1
        : formData.password.length < 12
          ? 2
          : 3;

  return (
    <div className="flex min-h-screen">
      {/* ── Left: Form ── */}
      <div className="flex w-full flex-col justify-center px-6 py-10 lg:w-1/2 lg:px-16 xl:px-24">
        <div className="mx-auto w-full max-w-[460px]">
          {/* Logo + headline */}
          <Link href="/" className="mb-8 inline-flex items-center gap-3">
            <SchichtPlanMark className="h-10 w-10" />
            <span className="text-xl font-bold text-gray-900">SchichtPlan</span>
          </Link>

          <h1 className="text-3xl font-extrabold tracking-tight text-gray-900 sm:text-4xl">
            {t("registerTitle")}
            <br />
            <span className="text-gradient">{t("registerTitleHighlight")}</span>
          </h1>
          <p className="mt-3 text-base text-gray-500">
            {t("registerSubtitle")}
          </p>

          {/* Error banner */}
          {error && (
            <div className="mt-6 flex items-center gap-2 rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
              <svg
                viewBox="0 0 20 20"
                fill="currentColor"
                className="h-5 w-5 shrink-0"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm-.75-11.25a.75.75 0 011.5 0v4.5a.75.75 0 01-1.5 0v-4.5zM10 14a1 1 0 100-2 1 1 0 000 2z"
                  clipRule="evenodd"
                />
              </svg>
              {error}
            </div>
          )}

          {/* ── Form ── */}
          <form onSubmit={handleSubmit} className="mt-8 space-y-5">
            {/* Name */}
            <div>
              <label
                htmlFor="name"
                className="mb-1.5 block text-sm font-medium text-gray-700"
              >
                {t("fullName")}
              </label>
              <div className="relative">
                <UserIcon className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
                <input
                  id="name"
                  name="name"
                  autoComplete="name"
                  placeholder={t("fullNamePlaceholder")}
                  value={formData.name}
                  onChange={handleChange}
                  required
                  className="h-12 w-full rounded-xl border border-gray-300 bg-white pl-11 pr-4 text-sm text-gray-900 placeholder:text-gray-400 transition-shadow focus:border-[var(--brand-500)] focus:ring-2 focus:ring-[var(--brand-200)] focus:outline-none"
                />
              </div>
            </div>

            {/* Email */}
            <div>
              <label
                htmlFor="email"
                className="mb-1.5 block text-sm font-medium text-gray-700"
              >
                {t("businessEmail")}
              </label>
              <div className="relative">
                <MailIcon className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  placeholder={t("emailPlaceholder")}
                  value={formData.email}
                  onChange={handleChange}
                  required
                  readOnly={isInvitation && !!invitedEmail}
                  className={`h-12 w-full rounded-xl border border-gray-300 bg-white pl-11 pr-4 text-sm text-gray-900 placeholder:text-gray-400 transition-shadow focus:border-[var(--brand-500)] focus:ring-2 focus:ring-[var(--brand-200)] focus:outline-none ${isInvitation && invitedEmail ? "bg-gray-50 cursor-not-allowed" : ""}`}
                />
              </div>
            </div>

            {/* Workspace / Company — hidden when joining via invitation */}
            {!isInvitation && (
              <div>
                <label
                  htmlFor="workspaceName"
                  className="mb-1.5 block text-sm font-medium text-gray-700"
                >
                  {t("companyName")}
                </label>
                <div className="relative">
                  <BuildingIcon className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
                  <input
                    id="workspaceName"
                    name="workspaceName"
                    autoComplete="organization"
                    placeholder={t("companyPlaceholder")}
                    value={formData.workspaceName}
                    onChange={handleChange}
                    required
                    className="h-12 w-full rounded-xl border border-gray-300 bg-white pl-11 pr-4 text-sm text-gray-900 placeholder:text-gray-400 transition-shadow focus:border-[var(--brand-500)] focus:ring-2 focus:ring-[var(--brand-200)] focus:outline-none"
                  />
                </div>
              </div>
            )}

            {/* Password */}
            <div>
              <label
                htmlFor="password"
                className="mb-1.5 block text-sm font-medium text-gray-700"
              >
                {t("password")}
              </label>
              <div className="relative">
                <LockIcon className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  placeholder={t("passwordPlaceholder")}
                  value={formData.password}
                  onChange={handleChange}
                  required
                  className="h-12 w-full rounded-xl border border-gray-300 bg-white pl-11 pr-11 text-sm text-gray-900 placeholder:text-gray-400 transition-shadow focus:border-[var(--brand-500)] focus:ring-2 focus:ring-[var(--brand-200)] focus:outline-none"
                />
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                >
                  {showPassword ? (
                    <EyeOffIcon className="h-5 w-5" />
                  ) : (
                    <EyeIcon className="h-5 w-5" />
                  )}
                </button>
              </div>

              {/* Password strength */}
              {formData.password.length > 0 && (
                <div className="mt-2 flex items-center gap-2">
                  <div className="flex flex-1 gap-1">
                    {[1, 2, 3].map((i) => (
                      <div
                        key={i}
                        className={`h-1 flex-1 rounded-full transition-colors ${
                          i <= passwordStrength
                            ? passwordStrength === 1
                              ? "bg-red-400"
                              : passwordStrength === 2
                                ? "bg-amber-400"
                                : "bg-emerald-400"
                            : "bg-gray-200"
                        }`}
                      />
                    ))}
                  </div>
                  <span className="text-xs text-gray-400">
                    {passwordStrength === 1
                      ? t("passwordStrengthWeak")
                      : passwordStrength === 2
                        ? t("passwordStrengthMedium")
                        : t("passwordStrengthStrong")}
                  </span>
                </div>
              )}
            </div>

            {/* Confirm Password */}
            <div>
              <label
                htmlFor="confirmPassword"
                className="mb-1.5 block text-sm font-medium text-gray-700"
              >
                {t("confirmPassword")}
              </label>
              <div className="relative">
                <LockIcon className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type={showConfirm ? "text" : "password"}
                  autoComplete="new-password"
                  placeholder={t("confirmPlaceholder")}
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  required
                  className="h-12 w-full rounded-xl border border-gray-300 bg-white pl-11 pr-11 text-sm text-gray-900 placeholder:text-gray-400 transition-shadow focus:border-[var(--brand-500)] focus:ring-2 focus:ring-[var(--brand-200)] focus:outline-none"
                />
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setShowConfirm((v) => !v)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                >
                  {showConfirm ? (
                    <EyeOffIcon className="h-5 w-5" />
                  ) : (
                    <EyeIcon className="h-5 w-5" />
                  )}
                </button>
              </div>
            </div>

            {/* DSGVO Consent Checkbox */}
            <div className="flex items-start gap-3">
              <input
                id="consent"
                type="checkbox"
                checked={consentGiven}
                onChange={(e) => setConsentGiven(e.target.checked)}
                className="mt-1 h-4 w-4 rounded border-gray-300 text-[var(--brand-600)] focus:ring-[var(--brand-500)] cursor-pointer"
              />
              <label
                htmlFor="consent"
                className="text-sm text-gray-600 cursor-pointer"
              >
                {t("consentText")}{" "}
                <Link
                  href="/datenschutz"
                  target="_blank"
                  className="font-semibold text-[var(--brand-600)] hover:text-[var(--brand-700)] underline"
                >
                  {t("privacy")}
                </Link>{" "}
                {t("and")}{" "}
                <Link
                  href="/agb"
                  target="_blank"
                  className="font-semibold text-[var(--brand-600)] hover:text-[var(--brand-700)] underline"
                >
                  {t("terms")}
                </Link>{" "}
                {t("consentTextEnd")}
              </label>
            </div>

            {/* CTA Button */}
            <button
              type="submit"
              disabled={loading || !consentGiven}
              className="relative flex h-13 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[var(--brand-600)] to-[var(--brand-500)] text-base font-semibold text-white shadow-lg shadow-purple-500/25 transition-all hover:shadow-xl hover:shadow-purple-500/30 hover:brightness-110 active:scale-[0.98] disabled:opacity-60 disabled:pointer-events-none"
            >
              {loading ? (
                <>
                  <svg
                    className="h-5 w-5 animate-spin"
                    viewBox="0 0 24 24"
                    fill="none"
                  >
                    <circle
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="3"
                      strokeOpacity="0.3"
                    />
                    <path
                      d="M12 2a10 10 0 0 1 10 10"
                      stroke="currentColor"
                      strokeWidth="3"
                      strokeLinecap="round"
                    />
                  </svg>
                  {t("creating")}
                </>
              ) : (
                t("letsGo")
              )}
            </button>
          </form>

          {/* Footer link */}
          <p className="mt-8 text-center text-sm text-gray-500">
            {t("hasAccount")}{" "}
            <Link
              href="/login"
              className="font-semibold text-[var(--brand-600)] hover:text-[var(--brand-700)] transition-colors"
            >
              {t("loginHere")}
            </Link>
          </p>

          <p className="mt-4 text-center text-xs text-gray-400">
            {t("securedByDsgvo")}
          </p>
        </div>
      </div>

      {/* ── Right: Decorative panel ── */}
      <div className="relative hidden overflow-hidden lg:flex lg:w-1/2 lg:items-center lg:justify-center bg-gradient-to-br from-[var(--brand-600)] via-[var(--brand-500)] to-[var(--brand-400)]">
        {/* Background pattern */}
        <div className="absolute inset-0 opacity-10">
          <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern
                id="grid-pattern"
                width="40"
                height="40"
                patternUnits="userSpaceOnUse"
              >
                <path
                  d="M 40 0 L 0 0 0 40"
                  fill="none"
                  stroke="white"
                  strokeWidth="0.5"
                />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid-pattern)" />
          </svg>
        </div>

        {/* Floating decorative blobs */}
        <div className="absolute -left-20 -top-20 h-72 w-72 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute -bottom-32 -right-20 h-96 w-96 rounded-full bg-white/5 blur-3xl" />

        {/* Content card */}
        <div className="relative z-10 max-w-md px-10 text-center">
          {/* Illustration: floating schedule UI card */}
          <div className="mx-auto mb-10 w-80">
            <svg
              viewBox="0 0 320 260"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="w-full drop-shadow-2xl"
            >
              {/* Main card */}
              <rect
                x="20"
                y="20"
                width="280"
                height="220"
                rx="16"
                fill="white"
                fillOpacity="0.95"
              />
              {/* Header bar */}
              <rect
                x="20"
                y="20"
                width="280"
                height="50"
                rx="16"
                fill="white"
              />
              <rect x="20" y="54" width="280" height="2" fill="#E5E7EB" />
              {/* Calendar icon in header */}
              <CalendarIcon
                x="36"
                y="30"
                width="24"
                height="24"
                className="text-[var(--brand-600)]"
              />
              <text x="68" y="48" fontSize="14" fontWeight="700" fill="#1F2937">
                {t("scheduleKW")}
              </text>
              {/* Day columns headers */}
              {[t("dayMo"), t("dayTu"), t("dayWe"), t("dayTh"), t("dayFr")].map(
                (d, i) => (
                  <g key={d}>
                    <text
                      x={52 + i * 52}
                      y="80"
                      fontSize="11"
                      fontWeight="600"
                      fill="#9CA3AF"
                      textAnchor="middle"
                    >
                      {d}
                    </text>
                  </g>
                ),
              )}
              {/* Shift blocks row 1 */}
              <rect
                x="30"
                y="90"
                width="48"
                height="28"
                rx="6"
                fill="#7C3AED"
                fillOpacity="0.15"
              />
              <text
                x="54"
                y="108"
                fontSize="9"
                fontWeight="600"
                fill="#7C3AED"
                textAnchor="middle"
              >
                06–14
              </text>
              <rect
                x="82"
                y="90"
                width="48"
                height="28"
                rx="6"
                fill="#7C3AED"
                fillOpacity="0.15"
              />
              <text
                x="106"
                y="108"
                fontSize="9"
                fontWeight="600"
                fill="#7C3AED"
                textAnchor="middle"
              >
                06–14
              </text>
              <rect
                x="134"
                y="90"
                width="48"
                height="28"
                rx="6"
                fill="#10B981"
                fillOpacity="0.15"
              />
              <text
                x="158"
                y="108"
                fontSize="9"
                fontWeight="600"
                fill="#10B981"
                textAnchor="middle"
              >
                14–22
              </text>
              <rect
                x="186"
                y="90"
                width="48"
                height="28"
                rx="6"
                fill="#F59E0B"
                fillOpacity="0.15"
              />
              <text
                x="210"
                y="108"
                fontSize="9"
                fontWeight="600"
                fill="#F59E0B"
                textAnchor="middle"
              >
                {t("dayOff")}
              </text>
              <rect
                x="238"
                y="90"
                width="48"
                height="28"
                rx="6"
                fill="#7C3AED"
                fillOpacity="0.15"
              />
              <text
                x="262"
                y="108"
                fontSize="9"
                fontWeight="600"
                fill="#7C3AED"
                textAnchor="middle"
              >
                06–14
              </text>

              {/* Shift blocks row 2 */}
              <rect
                x="30"
                y="126"
                width="48"
                height="28"
                rx="6"
                fill="#10B981"
                fillOpacity="0.15"
              />
              <text
                x="54"
                y="144"
                fontSize="9"
                fontWeight="600"
                fill="#10B981"
                textAnchor="middle"
              >
                14–22
              </text>
              <rect
                x="82"
                y="126"
                width="48"
                height="28"
                rx="6"
                fill="#F59E0B"
                fillOpacity="0.15"
              />
              <text
                x="106"
                y="144"
                fontSize="9"
                fontWeight="600"
                fill="#F59E0B"
                textAnchor="middle"
              >
                {t("dayOff")}
              </text>
              <rect
                x="134"
                y="126"
                width="48"
                height="28"
                rx="6"
                fill="#7C3AED"
                fillOpacity="0.15"
              />
              <text
                x="158"
                y="144"
                fontSize="9"
                fontWeight="600"
                fill="#7C3AED"
                textAnchor="middle"
              >
                06–14
              </text>
              <rect
                x="186"
                y="126"
                width="48"
                height="28"
                rx="6"
                fill="#10B981"
                fillOpacity="0.15"
              />
              <text
                x="210"
                y="144"
                fontSize="9"
                fontWeight="600"
                fill="#10B981"
                textAnchor="middle"
              >
                14–22
              </text>
              <rect
                x="238"
                y="126"
                width="48"
                height="28"
                rx="6"
                fill="#7C3AED"
                fillOpacity="0.15"
              />
              <text
                x="262"
                y="144"
                fontSize="9"
                fontWeight="600"
                fill="#7C3AED"
                textAnchor="middle"
              >
                06–14
              </text>

              {/* Employee avatars */}
              <circle
                cx="40"
                cy="178"
                r="12"
                fill="#7C3AED"
                fillOpacity="0.2"
              />
              <UsersIcon
                x="32"
                y="170"
                width="16"
                height="16"
                className="text-[var(--brand-600)]"
              />
              <text
                x="58"
                y="182"
                fontSize="11"
                fontWeight="500"
                fill="#374151"
              >
                3 {t("employeesPlanned")}
              </text>

              {/* Status badge */}
              <rect
                x="200"
                y="168"
                width="90"
                height="24"
                rx="12"
                fill="#10B981"
                fillOpacity="0.15"
              />
              <circle cx="214" cy="180" r="3" fill="#10B981" />
              <text
                x="222"
                y="184"
                fontSize="10"
                fontWeight="600"
                fill="#10B981"
              >
                {t("complete")}
              </text>

              {/* Bottom stats */}
              <rect x="20" y="204" width="280" height="2" fill="#E5E7EB" />
              <ClockIcon
                x="34"
                y="214"
                width="14"
                height="14"
                className="text-gray-400"
              />
              <text
                x="54"
                y="226"
                fontSize="10"
                fontWeight="500"
                fill="#6B7280"
              >
                120 {t("hrsShifts")}
              </text>
            </svg>
          </div>

          <h2 className="text-2xl font-bold text-white">
            {t("schedulingMadeEasy")}
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-white/80">
            {t("schedulingDesc")}
          </p>

          {/* Feature chips */}
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            {[
              t("featureDragDrop"),
              t("featureRealtime"),
              t("featureTeamComm"),
            ].map((f) => (
              <span
                key={f}
                className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-4 py-2 text-xs font-medium text-white backdrop-blur-sm"
              >
                <CheckCircleIcon className="h-3.5 w-3.5" />
                {f}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-violet-600 border-t-transparent" />
        </div>
      }
    >
      <RegisterForm />
    </Suspense>
  );
}
