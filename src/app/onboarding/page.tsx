"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  ShiftfyMark,
  MapPinIcon,
  UsersIcon,
  CalendarIcon,
  CheckCircleIcon,
  ArrowRightIcon,
  ChevronLeftIcon,
  BuildingIcon,
} from "@/components/icons";
import { ThemeToggle } from "@/components/ui/theme-toggle";

/* ─── Types ──────────────────────────────────────────────────── */

interface StepProps {
  onNext: () => void;
  onBack?: () => void;
}

type OnboardingStep = "welcome" | "location" | "employee" | "complete";

const STEPS: OnboardingStep[] = ["welcome", "location", "employee", "complete"];

/* ─── Step indicator ─────────────────────────────────────────── */

function StepIndicator({
  current,
  labels,
}: {
  current: number;
  labels: string[];
}) {
  return (
    <div className="flex items-center justify-center gap-1 sm:gap-2 px-4">
      {labels.map((label, i) => (
        <div key={i} className="flex items-center gap-1 sm:gap-2">
          <div className="flex flex-col items-center gap-1">
            <div
              className={`flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-full text-xs sm:text-sm font-semibold transition-all duration-300 ${
                i < current
                  ? "bg-emerald-600 text-white"
                  : i === current
                    ? "bg-emerald-600 text-white ring-4 ring-emerald-100 dark:ring-emerald-900"
                    : "bg-gray-100 dark:bg-zinc-800 text-gray-400 dark:text-zinc-500"
              }`}
            >
              {i < current ? <CheckCircleIcon className="h-4 w-4" /> : i + 1}
            </div>
            <span
              className={`text-[10px] sm:text-xs font-medium hidden sm:block ${
                i <= current
                  ? "text-gray-900 dark:text-zinc-100"
                  : "text-gray-400 dark:text-zinc-500"
              }`}
            >
              {label}
            </span>
          </div>
          {i < labels.length - 1 && (
            <div
              className={`h-px w-6 sm:w-10 lg:w-16 transition-all duration-300 ${
                i < current ? "bg-emerald-500" : "bg-gray-200 dark:bg-zinc-700"
              }`}
            />
          )}
        </div>
      ))}
    </div>
  );
}

/* ─── Step 1: Welcome ────────────────────────────────────────── */

function WelcomeStep({ onNext }: StepProps) {
  const t = useTranslations("onboardingWizard");

  return (
    <div className="flex flex-col items-center text-center px-4 max-w-lg mx-auto">
      <div className="flex h-16 w-16 sm:h-20 sm:w-20 items-center justify-center rounded-2xl bg-emerald-50 dark:bg-emerald-950 mb-6">
        <BuildingIcon className="h-8 w-8 sm:h-10 sm:w-10 text-emerald-600 dark:text-emerald-400" />
      </div>
      <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 dark:text-zinc-100 leading-tight">
        {t("welcomeTitle")}
      </h2>
      <p className="mt-3 text-sm sm:text-base text-gray-500 dark:text-zinc-400 leading-relaxed max-w-md">
        {t("welcomeDesc")}
      </p>
      <div className="mt-8 w-full space-y-3">
        <div className="flex items-start gap-3 rounded-xl border border-gray-100 dark:border-zinc-800 bg-gray-50/50 dark:bg-zinc-800/50 p-3 sm:p-4 text-left">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-50 dark:bg-emerald-950">
            <MapPinIcon className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900 dark:text-zinc-100">
              {t("step1Preview")}
            </p>
            <p className="text-xs text-gray-500 dark:text-zinc-400 mt-0.5">
              {t("step1PreviewDesc")}
            </p>
          </div>
        </div>
        <div className="flex items-start gap-3 rounded-xl border border-gray-100 dark:border-zinc-800 bg-gray-50/50 dark:bg-zinc-800/50 p-3 sm:p-4 text-left">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-50 dark:bg-emerald-950">
            <UsersIcon className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900 dark:text-zinc-100">
              {t("step2Preview")}
            </p>
            <p className="text-xs text-gray-500 dark:text-zinc-400 mt-0.5">
              {t("step2PreviewDesc")}
            </p>
          </div>
        </div>
        <div className="flex items-start gap-3 rounded-xl border border-gray-100 dark:border-zinc-800 bg-gray-50/50 dark:bg-zinc-800/50 p-3 sm:p-4 text-left">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-50 dark:bg-emerald-950">
            <CalendarIcon className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900 dark:text-zinc-100">
              {t("step3Preview")}
            </p>
            <p className="text-xs text-gray-500 dark:text-zinc-400 mt-0.5">
              {t("step3PreviewDesc")}
            </p>
          </div>
        </div>
      </div>
      <button
        onClick={onNext}
        className="mt-8 flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 transition-colors"
      >
        {t("getStarted")}
        <ArrowRightIcon className="h-4 w-4" />
      </button>
      <p className="mt-3 text-xs text-gray-400 dark:text-zinc-500">
        {t("timeEstimate")}
      </p>
    </div>
  );
}

/* ─── Step 2: Create Location ────────────────────────────────── */

function LocationStep({ onNext, onBack }: StepProps) {
  const t = useTranslations("onboardingWizard");
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError(t("locationRequired"));
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/locations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          address: address.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || t("genericError"));
        setLoading(false);
        return;
      }
      onNext();
    } catch {
      setError(t("networkError"));
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto px-4">
      <div className="text-center mb-6">
        <div className="flex h-14 w-14 sm:h-16 sm:w-16 items-center justify-center rounded-2xl bg-emerald-50 dark:bg-emerald-950 mx-auto mb-4">
          <MapPinIcon className="h-7 w-7 sm:h-8 sm:w-8 text-emerald-600 dark:text-emerald-400" />
        </div>
        <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-zinc-100">
          {t("locationTitle")}
        </h2>
        <p className="mt-2 text-sm text-gray-500 dark:text-zinc-400">
          {t("locationDesc")}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label
            htmlFor="loc-name"
            className="block text-sm font-medium text-gray-700 dark:text-zinc-300 mb-1.5"
          >
            {t("locationName")} *
          </label>
          <input
            id="loc-name"
            type="text"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setError("");
            }}
            placeholder={t("locationNamePlaceholder")}
            className="flex h-10 sm:h-11 w-full rounded-lg border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-gray-900 dark:text-zinc-100 placeholder:text-gray-400 dark:placeholder:text-zinc-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:border-transparent"
            autoFocus
            maxLength={200}
          />
        </div>
        <div>
          <label
            htmlFor="loc-addr"
            className="block text-sm font-medium text-gray-700 dark:text-zinc-300 mb-1.5"
          >
            {t("locationAddress")}
          </label>
          <input
            id="loc-addr"
            type="text"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder={t("locationAddressPlaceholder")}
            className="flex h-10 sm:h-11 w-full rounded-lg border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-gray-900 dark:text-zinc-100 placeholder:text-gray-400 dark:placeholder:text-zinc-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:border-transparent"
            maxLength={500}
          />
        </div>

        {error && (
          <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 border border-red-100 dark:border-red-900/50 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        <div className="flex items-center gap-3 pt-2">
          <button
            type="button"
            onClick={onBack}
            className="flex items-center gap-1.5 rounded-lg border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-zinc-300 hover:bg-gray-50 dark:hover:bg-zinc-700 transition-colors"
          >
            <ChevronLeftIcon className="h-4 w-4" />
            {t("back")}
          </button>
          <button
            type="submit"
            disabled={loading || !name.trim()}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 transition-colors"
          >
            {loading ? t("saving") : t("next")}
            {!loading && <ArrowRightIcon className="h-4 w-4" />}
          </button>
        </div>
      </form>
    </div>
  );
}

/* ─── Step 3: Add Employee ───────────────────────────────────── */

function EmployeeStep({ onNext, onBack }: StepProps) {
  const t = useTranslations("onboardingWizard");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [position, setPosition] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName.trim() || !lastName.trim()) {
      setError(t("nameRequired"));
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/employees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          email: email.trim() || undefined,
          position: position.trim() || undefined,
          hourlyRate: 12.41,
          weeklyHours: 40,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || t("genericError"));
        setLoading(false);
        return;
      }
      onNext();
    } catch {
      setError(t("networkError"));
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto px-4">
      <div className="text-center mb-6">
        <div className="flex h-14 w-14 sm:h-16 sm:w-16 items-center justify-center rounded-2xl bg-emerald-50 dark:bg-emerald-950 mx-auto mb-4">
          <UsersIcon className="h-7 w-7 sm:h-8 sm:w-8 text-emerald-600 dark:text-emerald-400" />
        </div>
        <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-zinc-100">
          {t("employeeTitle")}
        </h2>
        <p className="mt-2 text-sm text-gray-500 dark:text-zinc-400">
          {t("employeeDesc")}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label
              htmlFor="emp-first"
              className="block text-sm font-medium text-gray-700 dark:text-zinc-300 mb-1.5"
            >
              {t("firstName")} *
            </label>
            <input
              id="emp-first"
              type="text"
              value={firstName}
              onChange={(e) => {
                setFirstName(e.target.value);
                setError("");
              }}
              placeholder={t("firstNamePlaceholder")}
              className="flex h-10 sm:h-11 w-full rounded-lg border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-gray-900 dark:text-zinc-100 placeholder:text-gray-400 dark:placeholder:text-zinc-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:border-transparent"
              autoFocus
              maxLength={100}
            />
          </div>
          <div>
            <label
              htmlFor="emp-last"
              className="block text-sm font-medium text-gray-700 dark:text-zinc-300 mb-1.5"
            >
              {t("lastName")} *
            </label>
            <input
              id="emp-last"
              type="text"
              value={lastName}
              onChange={(e) => {
                setLastName(e.target.value);
                setError("");
              }}
              placeholder={t("lastNamePlaceholder")}
              className="flex h-10 sm:h-11 w-full rounded-lg border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-gray-900 dark:text-zinc-100 placeholder:text-gray-400 dark:placeholder:text-zinc-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:border-transparent"
              maxLength={100}
            />
          </div>
        </div>
        <div>
          <label
            htmlFor="emp-email"
            className="block text-sm font-medium text-gray-700 dark:text-zinc-300 mb-1.5"
          >
            {t("emailLabel")}
          </label>
          <input
            id="emp-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t("emailPlaceholder")}
            className="flex h-10 sm:h-11 w-full rounded-lg border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-gray-900 dark:text-zinc-100 placeholder:text-gray-400 dark:placeholder:text-zinc-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:border-transparent"
          />
        </div>
        <div>
          <label
            htmlFor="emp-pos"
            className="block text-sm font-medium text-gray-700 dark:text-zinc-300 mb-1.5"
          >
            {t("positionLabel")}
          </label>
          <input
            id="emp-pos"
            type="text"
            value={position}
            onChange={(e) => setPosition(e.target.value)}
            placeholder={t("positionPlaceholder")}
            className="flex h-10 sm:h-11 w-full rounded-lg border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-gray-900 dark:text-zinc-100 placeholder:text-gray-400 dark:placeholder:text-zinc-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:border-transparent"
            maxLength={100}
          />
        </div>

        {error && (
          <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 border border-red-100 dark:border-red-900/50 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        <div className="flex items-center gap-3 pt-2">
          <button
            type="button"
            onClick={onBack}
            className="flex items-center gap-1.5 rounded-lg border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-zinc-300 hover:bg-gray-50 dark:hover:bg-zinc-700 transition-colors"
          >
            <ChevronLeftIcon className="h-4 w-4" />
            {t("back")}
          </button>
          <button
            type="submit"
            disabled={loading || !firstName.trim() || !lastName.trim()}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 transition-colors"
          >
            {loading ? t("saving") : t("next")}
            {!loading && <ArrowRightIcon className="h-4 w-4" />}
          </button>
        </div>
      </form>
    </div>
  );
}

/* ─── Step 4: Complete ───────────────────────────────────────── */

function CompleteStep() {
  const t = useTranslations("onboardingWizard");
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleFinish = async () => {
    setLoading(true);
    try {
      await fetch("/api/onboarding/complete", { method: "POST" });
    } catch {
      // Best-effort; user can still proceed
    }
    router.push("/dashboard");
    router.refresh();
  };

  return (
    <div className="flex flex-col items-center text-center px-4 max-w-lg mx-auto">
      <div className="flex h-16 w-16 sm:h-20 sm:w-20 items-center justify-center rounded-2xl bg-emerald-50 dark:bg-emerald-950 mb-6">
        <CheckCircleIcon className="h-8 w-8 sm:h-10 sm:w-10 text-emerald-600 dark:text-emerald-400" />
      </div>
      <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 dark:text-zinc-100">
        {t("completeTitle")}
      </h2>
      <p className="mt-3 text-sm sm:text-base text-gray-500 dark:text-zinc-400 leading-relaxed max-w-md">
        {t("completeDesc")}
      </p>

      <div className="mt-6 w-full space-y-2">
        <div className="flex items-center gap-3 rounded-xl border border-green-100 dark:border-green-900/50 bg-green-50/50 dark:bg-green-950/30 p-3 text-left">
          <CheckCircleIcon className="h-5 w-5 text-green-600 dark:text-green-400 shrink-0" />
          <span className="text-sm text-gray-700 dark:text-zinc-300">
            {t("doneLocation")}
          </span>
        </div>
        <div className="flex items-center gap-3 rounded-xl border border-green-100 dark:border-green-900/50 bg-green-50/50 dark:bg-green-950/30 p-3 text-left">
          <CheckCircleIcon className="h-5 w-5 text-green-600 dark:text-green-400 shrink-0" />
          <span className="text-sm text-gray-700 dark:text-zinc-300">
            {t("doneEmployee")}
          </span>
        </div>
      </div>

      <div className="mt-4 w-full rounded-xl border border-gray-100 dark:border-zinc-800 bg-gray-50/50 dark:bg-zinc-800/50 p-4 text-left">
        <p className="text-sm font-semibold text-gray-900 dark:text-zinc-100 mb-2">
          {t("nextStepsTitle")}
        </p>
        <ul className="space-y-1.5 text-sm text-gray-600 dark:text-zinc-400">
          <li className="flex items-start gap-2">
            <span className="text-gray-400 dark:text-zinc-500 mt-0.5">1.</span>
            {t("nextStep1")}
          </li>
          <li className="flex items-start gap-2">
            <span className="text-gray-400 dark:text-zinc-500 mt-0.5">2.</span>
            {t("nextStep2")}
          </li>
          <li className="flex items-start gap-2">
            <span className="text-gray-400 dark:text-zinc-500 mt-0.5">3.</span>
            {t("nextStep3")}
          </li>
        </ul>
      </div>

      <button
        onClick={handleFinish}
        disabled={loading}
        className="mt-8 flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 transition-colors"
      >
        {loading ? t("redirecting") : t("goToDashboard")}
        {!loading && <ArrowRightIcon className="h-4 w-4" />}
      </button>
    </div>
  );
}

/* ─── Main Wizard ────────────────────────────────────────────── */

export default function OnboardingPage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(0);
  const t = useTranslations("onboardingWizard");

  const stepLabels = [
    t("stepStart"),
    t("stepLocation"),
    t("stepEmployee"),
    t("stepDone"),
  ];

  const goNext = useCallback(() => {
    setCurrentStep((s) => Math.min(s + 1, STEPS.length - 1));
  }, []);

  const goBack = useCallback(() => {
    setCurrentStep((s) => Math.max(s - 1, 0));
  }, []);

  return (
    <div className="min-h-[100dvh] bg-white dark:bg-zinc-950 flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-gray-100 dark:border-zinc-800 px-4 sm:px-6 py-3 sm:py-4 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <div className="flex items-center gap-2">
          <ShiftfyMark className="h-7 w-7" />
          <span className="font-bold text-sm sm:text-base text-gray-900 dark:text-zinc-100">
            Shift
            <span className="text-emerald-600 dark:text-emerald-400">fy</span>
          </span>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <button
            onClick={() => {
              fetch("/api/onboarding/complete", { method: "POST" }).catch(
                () => {},
              );
              router.push("/dashboard");
              router.refresh();
            }}
            className="text-xs sm:text-sm text-gray-400 dark:text-zinc-500 hover:text-gray-600 dark:hover:text-zinc-300 transition-colors"
          >
            {t("skipSetup")}
          </button>
        </div>
      </header>

      {/* Progress */}
      <div className="py-4 sm:py-6 border-b border-gray-50 dark:border-zinc-800/50">
        <StepIndicator current={currentStep} labels={stepLabels} />
      </div>

      {/* Content */}
      <div className="flex-1 flex items-start sm:items-center justify-center py-6 sm:py-10 overflow-y-auto">
        {currentStep === 0 && <WelcomeStep onNext={goNext} />}
        {currentStep === 1 && <LocationStep onNext={goNext} onBack={goBack} />}
        {currentStep === 2 && <EmployeeStep onNext={goNext} onBack={goBack} />}
        {currentStep === 3 && <CompleteStep />}
      </div>

      {/* Footer */}
      <footer className="border-t border-gray-50 dark:border-zinc-800/50 px-4 py-3 text-center pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <p className="text-xs text-gray-400 dark:text-zinc-500">
          {t("footerText")}
        </p>
      </footer>
    </div>
  );
}
