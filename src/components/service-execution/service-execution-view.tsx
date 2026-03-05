"use client";

import { useState, useCallback } from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  MapPinIcon,
  CheckCircleIcon,
  CheckIcon,
  AlertTriangleIcon,
  ShieldCheckIcon,
  ChevronLeftIcon,
} from "@/components/icons";
import { useServiceGps, type GpsStatus } from "@/lib/hooks/use-service-gps";
import { useOfflineVisits } from "@/lib/hooks/use-offline-visits";
import { SignatureDrawer } from "./signature-drawer";

// ─── Types ──────────────────────────────────────────────────────

export interface ServiceVisitExec {
  id: string;
  status: "GEPLANT" | "EINGECHECKT" | "ABGESCHLOSSEN" | "STORNIERT";
  scheduledDate: string;
  checkInAt: string | null;
  notes: string | null;
  employee: {
    id: string;
    firstName: string;
    lastName: string;
  };
  location: {
    id: string;
    name: string;
    address: string | null;
    latitude: number | null;
    longitude: number | null;
  };
  signature: {
    signerName: string;
  } | null;
}

interface ServiceTask {
  id: string;
  label: string;
  completed: boolean;
}

interface ServiceExecutionViewProps {
  visit: ServiceVisitExec;
  onComplete: () => void;
  onBack: () => void;
}

// ─── Default task IDs (labels come from i18n) ──────────────────

const DEFAULT_TASK_IDS = [
  "arrived",
  "contact",
  "service",
  "documentation",
] as const;

// ─── GPS Status Indicator ───────────────────────────────────────

function GpsIndicator({
  status,
  distance,
  t,
}: {
  status: GpsStatus;
  distance: number | null;
  t: ReturnType<typeof useTranslations<"serviceProof">>;
}) {
  const isVerified = status === "verified";
  const isAcquiring = status === "acquiring";
  const isOutOfRange = status === "out-of-range";

  return (
    <div className="flex items-center gap-2">
      {/* Pulsing / static dot */}
      <div className="relative flex items-center justify-center">
        <div
          className={cn(
            "h-3 w-3 rounded-full",
            isVerified && "bg-emerald-500",
            isAcquiring && "bg-amber-400",
            isOutOfRange && "bg-red-500",
            status === "error" && "bg-red-500",
            status === "idle" && "bg-gray-400",
          )}
        />
        {/* Pulsing ring for verified state */}
        {isVerified && (
          <div className="absolute inset-0 h-3 w-3 animate-ping rounded-full bg-emerald-400 opacity-75" />
        )}
        {/* Pulsing ring for acquiring */}
        {isAcquiring && (
          <div className="absolute inset-0 h-3 w-3 animate-ping rounded-full bg-amber-300 opacity-75" />
        )}
      </div>

      {/* Status text */}
      <span
        className={cn(
          "text-xs font-medium",
          isVerified && "text-emerald-700",
          isAcquiring && "text-amber-600",
          isOutOfRange && "text-red-600",
          status === "error" && "text-red-600",
        )}
      >
        {isVerified && t("execution.gps.verified")}
        {isAcquiring && t("execution.gps.acquiring")}
        {isOutOfRange &&
          t("execution.gps.outOfRange", { distance: distance ?? "?" })}
        {status === "error" && t("execution.gps.error")}
        {status === "idle" && t("execution.gps.inactive")}
      </span>
    </div>
  );
}

// ─── Step Indicator ─────────────────────────────────────────────

function StepIndicator({
  step,
  currentStep,
  label,
  description,
}: {
  step: number;
  currentStep: number;
  label: string;
  description: string;
}) {
  const isCompleted = currentStep > step;
  const isActive = currentStep === step;

  return (
    <div className="flex gap-3">
      {/* Circle + line */}
      <div className="flex flex-col items-center">
        <div
          className={cn(
            "flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold transition-all duration-300",
            isCompleted && "bg-emerald-500 text-white",
            isActive &&
              "bg-emerald-100 text-emerald-700 ring-2 ring-emerald-500",
            !isCompleted && !isActive && "bg-gray-100 text-gray-400",
          )}
        >
          {isCompleted ? <CheckIcon className="h-4 w-4" /> : step}
        </div>
        {step < 3 && (
          <div
            className={cn(
              "mt-1 w-0.5 flex-1 min-h-[24px] transition-colors duration-300",
              isCompleted ? "bg-emerald-500" : "bg-gray-200",
            )}
          />
        )}
      </div>

      {/* Label */}
      <div className="pb-6">
        <p
          className={cn(
            "text-sm font-semibold leading-tight",
            isActive
              ? "text-[#111827]"
              : isCompleted
                ? "text-emerald-700"
                : "text-gray-400",
          )}
        >
          {label}
        </p>
        <p
          className={cn(
            "mt-0.5 text-xs",
            isActive ? "text-gray-500" : "text-gray-400",
          )}
        >
          {description}
        </p>
      </div>
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────────

export function ServiceExecutionView({
  visit,
  onComplete,
  onBack,
}: ServiceExecutionViewProps) {
  const t = useTranslations("serviceProof");

  // Determine initial step based on visit status
  const getInitialStep = () => {
    if (visit.status === "ABGESCHLOSSEN") return 4; // all done
    if (visit.status === "EINGECHECKT") return 2; // already checked in
    return 1; // GEPLANT — start from check-in
  };

  const [currentStep, setCurrentStep] = useState(getInitialStep);
  const [tasks, setTasks] = useState<ServiceTask[]>(
    DEFAULT_TASK_IDS.map((id) => ({
      id,
      label: t(`execution.step2.tasks.${id}`),
      completed: false,
    })),
  );
  const [checkInTime, setCheckInTime] = useState<Date | null>(
    visit.checkInAt ? new Date(visit.checkInAt) : null,
  );
  const [isCheckingIn, setIsCheckingIn] = useState(false);
  const [showSignature, setShowSignature] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // GPS tracking
  const {
    position,
    status: gpsStatus,
    isWithinGeofence,
    distanceMetres,
    errorMessage: gpsError,
  } = useServiceGps({
    fenceLat: visit.location.latitude,
    fenceLng: visit.location.longitude,
    enabled: currentStep <= 2,
  });

  // Offline support
  const { isOnline, executeAction, pendingCount } = useOfflineVisits();

  // All tasks completed?
  const allTasksCompleted = tasks.every((t) => t.completed);

  // ────────── Handlers ──────────

  const handleCheckIn = useCallback(async () => {
    if (!position) {
      setError(t("execution.gps.positionAcquiring"));
      return;
    }

    setIsCheckingIn(true);
    setError(null);

    try {
      const result = await executeAction("CHECK_IN", visit.id, {
        lat: position.lat,
        lng: position.lng,
      });

      if (result.queued) {
        // Offline — proceed optimistically
      }

      setCheckInTime(new Date());
      setCurrentStep(2);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : t("execution.step1.checkInFailed"),
      );
    } finally {
      setIsCheckingIn(false);
    }
  }, [position, executeAction, visit.id]);

  const toggleTask = useCallback((taskId: string) => {
    setTasks((prev) =>
      prev.map((t) =>
        t.id === taskId ? { ...t, completed: !t.completed } : t,
      ),
    );
  }, []);

  const handleTasksComplete = useCallback(() => {
    if (!allTasksCompleted) return;
    setCurrentStep(3);
  }, [allTasksCompleted]);

  const handleSignatureSubmit = useCallback(
    async (data: {
      signatureData: string;
      signerName: string;
      signerRole: string;
    }) => {
      setError(null);

      try {
        const result = await executeAction("SIGNATURE", visit.id, {
          signatureData: data.signatureData,
          signerName: data.signerName,
          signerRole: data.signerRole || undefined,
          lat: position?.lat,
          lng: position?.lng,
        });

        if (result.queued) {
          // Offline — show as completed optimistically
        }

        setShowSignature(false);

        // Now check out
        const checkOutResult = await executeAction("CHECK_OUT", visit.id, {
          lat: position?.lat,
          lng: position?.lng,
        });

        if (checkOutResult.queued) {
          // Offline
        }

        setCurrentStep(4);
        onComplete();
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : t("execution.error.completionFailed"),
        );
      }
    },
    [executeAction, visit.id, position, onComplete],
  );

  // ────────── Render ──────────

  return (
    <div className="flex min-h-screen flex-col bg-[#F9FAFB]">
      {/* ── Sticky Glassmorphism Header ── */}
      <header className="sticky top-0 z-40 border-b border-white/20 bg-white/70 backdrop-blur-xl backdrop-saturate-150">
        <div className="px-4 py-3 safe-area-top">
          {/* Back button row */}
          <div className="flex items-center gap-3 mb-2">
            <button
              onClick={onBack}
              className="flex h-10 w-10 items-center justify-center rounded-xl bg-gray-100/80 active:scale-[0.95] transition-transform"
              aria-label={t("execution.back")}
            >
              <ChevronLeftIcon className="h-5 w-5 text-gray-600" />
            </button>
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-base font-bold text-[#111827]">
                {visit.location.name}
              </h1>
              {visit.location.address && (
                <div className="flex items-center gap-1 text-xs text-gray-500">
                  <MapPinIcon className="h-3 w-3 shrink-0" />
                  <span className="truncate">{visit.location.address}</span>
                </div>
              )}
            </div>
          </div>

          {/* GPS status + employee */}
          <div className="flex items-center justify-between">
            <GpsIndicator status={gpsStatus} distance={distanceMetres} t={t} />
            <span className="text-xs text-gray-500">
              {visit.employee.firstName} {visit.employee.lastName}
            </span>
          </div>
        </div>
      </header>

      {/* ── Main Content ── */}
      <main className="flex-1 px-4 py-6">
        {/* Error banner */}
        {(error || gpsError) && (
          <div className="mb-4 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3">
            <AlertTriangleIcon className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
            <p className="text-sm text-red-700">{error || gpsError}</p>
          </div>
        )}

        {/* Offline warning */}
        {!isOnline && (
          <div className="mb-4 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3">
            <AlertTriangleIcon className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
            <div>
              <p className="text-sm font-medium text-amber-800">
                {t("execution.offline.title")}
              </p>
              <p className="text-xs text-amber-600">
                {t("execution.offline.description")}
                {pendingCount > 0 &&
                  ` ${t("execution.offline.pending", { count: pendingCount })}`}
              </p>
            </div>
          </div>
        )}

        {/* Step indicator */}
        <div className="mb-6">
          <StepIndicator
            step={1}
            currentStep={currentStep}
            label={t("execution.step1.title")}
            description={t("execution.step1.description")}
          />
          <StepIndicator
            step={2}
            currentStep={currentStep}
            label={t("execution.step2.title")}
            description={t("execution.step2.description")}
          />
          <StepIndicator
            step={3}
            currentStep={currentStep}
            label={t("execution.step3.title")}
            description={t("execution.step3.description")}
          />
        </div>

        {/* ── Step 1: Check-In ── */}
        {currentStep === 1 && (
          <div className="space-y-4">
            <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
              <h3 className="text-sm font-semibold text-[#111827]">
                {t("execution.step1.cardTitle")}
              </h3>
              <p className="mt-1 text-xs text-gray-500">
                {t("execution.step1.cardDescription")}
              </p>

              {/* Distance info */}
              {distanceMetres !== null && (
                <div className="mt-3 flex items-center gap-2 rounded-lg bg-gray-50 px-3 py-2">
                  <MapPinIcon className="h-4 w-4 text-gray-400" />
                  <span className="text-sm text-gray-600">
                    {t("execution.step1.distance")}:{" "}
                    <span className="font-semibold">{distanceMetres}m</span>
                  </span>
                </div>
              )}
            </div>

            <Button
              onClick={handleCheckIn}
              disabled={
                isCheckingIn ||
                gpsStatus === "acquiring" ||
                gpsStatus === "error" ||
                (!isWithinGeofence && gpsStatus !== "idle")
              }
              className={cn(
                "w-full !h-14 text-base font-bold",
                !isWithinGeofence && gpsStatus === "out-of-range"
                  ? "opacity-50"
                  : "",
              )}
            >
              {isCheckingIn ? (
                <span className="flex items-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  {t("execution.step1.checkingIn")}
                </span>
              ) : gpsStatus === "acquiring" ? (
                t("execution.step1.gpsAcquiring")
              ) : !isWithinGeofence && gpsStatus === "out-of-range" ? (
                t("execution.step1.outsideGeofence")
              ) : (
                <span className="flex items-center gap-2">
                  <MapPinIcon className="h-5 w-5" />
                  {t("execution.step1.checkInNow")}
                </span>
              )}
            </Button>

            {!isWithinGeofence && gpsStatus === "out-of-range" && (
              <p className="text-center text-xs text-red-500">
                {t("execution.step1.outsideRadius")}
              </p>
            )}
          </div>
        )}

        {/* ── Step 2: Task Confirmation ── */}
        {currentStep === 2 && (
          <div className="space-y-4">
            <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
              <h3 className="text-sm font-semibold text-[#111827]">
                {t("execution.step2.cardTitle")}
              </h3>
              <p className="mt-1 text-xs text-gray-500">
                {t("execution.step2.cardDescription")}
              </p>

              {checkInTime && (
                <div className="mt-2 flex items-center gap-1.5 text-xs text-emerald-600">
                  <CheckCircleIcon className="h-3.5 w-3.5" />
                  {t("execution.step2.checkedInAt", {
                    time: checkInTime.toLocaleTimeString("de-DE", {
                      hour: "2-digit",
                      minute: "2-digit",
                    }),
                  })}
                </div>
              )}

              <div className="mt-4 space-y-1">
                {tasks.map((task) => (
                  <button
                    key={task.id}
                    onClick={() => toggleTask(task.id)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-xl px-3 py-3.5 text-left transition-all active:scale-[0.98]",
                      task.completed
                        ? "bg-emerald-50"
                        : "bg-gray-50 hover:bg-gray-100",
                    )}
                    style={{ margin: "4px 0" }}
                  >
                    <div
                      className={cn(
                        "flex h-6 w-6 shrink-0 items-center justify-center rounded-md border-2 transition-all",
                        task.completed
                          ? "border-emerald-500 bg-emerald-500"
                          : "border-gray-300 bg-white",
                      )}
                    >
                      {task.completed && (
                        <CheckIcon className="h-3.5 w-3.5 text-white" />
                      )}
                    </div>
                    <span
                      className={cn(
                        "text-sm font-medium",
                        task.completed ? "text-emerald-700" : "text-[#111827]",
                      )}
                    >
                      {task.label}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <Button
              onClick={handleTasksComplete}
              disabled={!allTasksCompleted}
              className="w-full !h-14 text-base font-bold"
            >
              {allTasksCompleted ? (
                <span className="flex items-center gap-2">
                  <CheckCircleIcon className="h-5 w-5" />
                  {t("execution.step2.toSignature")}
                </span>
              ) : (
                t("execution.step2.tasksRemaining", {
                  count: tasks.filter((task) => !task.completed).length,
                })
              )}
            </Button>
          </div>
        )}

        {/* ── Step 3: Signature & Finalize ── */}
        {currentStep === 3 && (
          <div className="space-y-4">
            <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
              <div className="flex items-center gap-2">
                <ShieldCheckIcon className="h-5 w-5 text-emerald-600" />
                <h3 className="text-sm font-semibold text-[#111827]">
                  {t("execution.step3.cardTitle")}
                </h3>
              </div>
              <p className="mt-1 text-xs text-gray-500">
                {t("execution.step3.cardDescription")}
              </p>

              {/* Summary */}
              <div className="mt-3 space-y-2 rounded-lg bg-gray-50 p-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-500">
                    {t("execution.step3.summaryLocation")}
                  </span>
                  <span className="font-medium text-[#111827]">
                    {visit.location.name}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-500">
                    {t("execution.step3.summaryEmployee")}
                  </span>
                  <span className="font-medium text-[#111827]">
                    {visit.employee.firstName} {visit.employee.lastName}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-500">
                    {t("execution.step3.summaryTasks")}
                  </span>
                  <span className="font-medium text-emerald-700">
                    {t("execution.step3.summaryTasksDone", {
                      done: tasks.filter((task) => task.completed).length,
                      total: tasks.length,
                    })}
                  </span>
                </div>
                {checkInTime && (
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-500">
                      {t("execution.step3.summaryCheckedIn")}
                    </span>
                    <span className="font-medium text-[#111827]">
                      {checkInTime.toLocaleTimeString("de-DE", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                )}
              </div>
            </div>

            <Button
              onClick={() => setShowSignature(true)}
              className="w-full !h-14 text-base font-bold"
            >
              <span className="flex items-center gap-2">
                <ShieldCheckIcon className="h-5 w-5" />
                {t("execution.step3.captureSignature")}
              </span>
            </Button>
          </div>
        )}

        {/* ── Step 4: Completed ── */}
        {currentStep === 4 && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
              <CheckCircleIcon className="h-8 w-8 text-emerald-600" />
            </div>
            <h3 className="mt-4 text-lg font-bold text-[#111827]">
              {t("execution.step4.title")}
            </h3>
            <p className="mt-1 text-sm text-gray-500">
              {t("execution.step4.description")}
            </p>
            {!isOnline && pendingCount > 0 && (
              <div className="mt-4 flex items-center gap-2 rounded-xl bg-amber-50 px-4 py-2">
                <AlertTriangleIcon className="h-4 w-4 text-amber-500" />
                <span className="text-xs text-amber-700">
                  {t("execution.step4.syncPending", { count: pendingCount })}
                </span>
              </div>
            )}
            <Button onClick={onBack} variant="outline" className="mt-6">
              {t("execution.step4.backToList")}
            </Button>
          </div>
        )}
      </main>

      {/* ── Signature Drawer ── */}
      <SignatureDrawer
        open={showSignature}
        onClose={() => setShowSignature(false)}
        onSubmit={handleSignatureSubmit}
        isOnline={isOnline}
        isWithinGeofence={isWithinGeofence}
      />
    </div>
  );
}
