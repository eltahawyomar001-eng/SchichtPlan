"use client";

import { useState, useCallback } from "react";
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

// ─── Default tasks for service visits ───────────────────────────

const DEFAULT_TASKS: Omit<ServiceTask, "completed">[] = [
  { id: "arrived", label: "Am Standort eingetroffen" },
  { id: "contact", label: "Ansprechpartner kontaktiert" },
  { id: "service", label: "Dienstleistung erbracht" },
  { id: "documentation", label: "Dokumentation erstellt" },
];

// ─── GPS Status Indicator ───────────────────────────────────────

function GpsIndicator({
  status,
  distance,
}: {
  status: GpsStatus;
  distance: number | null;
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
        {isVerified && "GPS verifiziert"}
        {isAcquiring && "GPS wird ermittelt…"}
        {isOutOfRange && `Außerhalb (${distance ?? "?"}m)`}
        {status === "error" && "GPS-Fehler"}
        {status === "idle" && "GPS inaktiv"}
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
  // Determine initial step based on visit status
  const getInitialStep = () => {
    if (visit.status === "ABGESCHLOSSEN") return 4; // all done
    if (visit.status === "EINGECHECKT") return 2; // already checked in
    return 1; // GEPLANT — start from check-in
  };

  const [currentStep, setCurrentStep] = useState(getInitialStep);
  const [tasks, setTasks] = useState<ServiceTask[]>(
    DEFAULT_TASKS.map((t) => ({ ...t, completed: false })),
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
      setError("GPS-Position wird noch ermittelt…");
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
      setError(err instanceof Error ? err.message : "Check-in fehlgeschlagen");
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
        setError(err instanceof Error ? err.message : "Fehler beim Abschluss");
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
              aria-label="Zurück"
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
            <GpsIndicator status={gpsStatus} distance={distanceMetres} />
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
                Offline-Modus
              </p>
              <p className="text-xs text-amber-600">
                Aktionen werden auf dem Gerät gespeichert und bei Verbindung
                synchronisiert.
                {pendingCount > 0 && ` (${pendingCount} ausstehend)`}
              </p>
            </div>
          </div>
        )}

        {/* Step indicator */}
        <div className="mb-6">
          <StepIndicator
            step={1}
            currentStep={currentStep}
            label="Einchecken"
            description="GPS-Position bestätigen"
          />
          <StepIndicator
            step={2}
            currentStep={currentStep}
            label="Aufgaben bestätigen"
            description="Alle Aufgaben abhaken"
          />
          <StepIndicator
            step={3}
            currentStep={currentStep}
            label="Unterschrift & Abschluss"
            description="Leistungsnachweis abzeichnen"
          />
        </div>

        {/* ── Step 1: Check-In ── */}
        {currentStep === 1 && (
          <div className="space-y-4">
            <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
              <h3 className="text-sm font-semibold text-[#111827]">
                Standort-Verifizierung
              </h3>
              <p className="mt-1 text-xs text-gray-500">
                Bestätigen Sie Ihre Anwesenheit am Einsatzort. Die GPS-Position
                wird automatisch geprüft.
              </p>

              {/* Distance info */}
              {distanceMetres !== null && (
                <div className="mt-3 flex items-center gap-2 rounded-lg bg-gray-50 px-3 py-2">
                  <MapPinIcon className="h-4 w-4 text-gray-400" />
                  <span className="text-sm text-gray-600">
                    Entfernung:{" "}
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
                  Einchecken…
                </span>
              ) : gpsStatus === "acquiring" ? (
                "GPS wird ermittelt…"
              ) : !isWithinGeofence && gpsStatus === "out-of-range" ? (
                "Außerhalb des Geofence"
              ) : (
                <span className="flex items-center gap-2">
                  <MapPinIcon className="h-5 w-5" />
                  Jetzt einchecken
                </span>
              )}
            </Button>

            {!isWithinGeofence && gpsStatus === "out-of-range" && (
              <p className="text-center text-xs text-red-500">
                Sie befinden sich außerhalb des 200m-Radius. Bitte nähern Sie
                sich dem Standort.
              </p>
            )}
          </div>
        )}

        {/* ── Step 2: Task Confirmation ── */}
        {currentStep === 2 && (
          <div className="space-y-4">
            <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
              <h3 className="text-sm font-semibold text-[#111827]">
                Aufgaben-Checkliste
              </h3>
              <p className="mt-1 text-xs text-gray-500">
                Bestätigen Sie die erledigten Aufgaben vor Ort.
              </p>

              {checkInTime && (
                <div className="mt-2 flex items-center gap-1.5 text-xs text-emerald-600">
                  <CheckCircleIcon className="h-3.5 w-3.5" />
                  Eingecheckt um{" "}
                  {checkInTime.toLocaleTimeString("de-DE", {
                    hour: "2-digit",
                    minute: "2-digit",
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
                  Weiter zur Unterschrift
                </span>
              ) : (
                `Noch ${tasks.filter((t) => !t.completed).length} Aufgaben offen`
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
                  Leistungsnachweis abschließen
                </h3>
              </div>
              <p className="mt-1 text-xs text-gray-500">
                Lassen Sie den Leistungsnachweis vom Verantwortlichen vor Ort
                unterschreiben und den Einsatz abschließen.
              </p>

              {/* Summary */}
              <div className="mt-3 space-y-2 rounded-lg bg-gray-50 p-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-500">Standort</span>
                  <span className="font-medium text-[#111827]">
                    {visit.location.name}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-500">Mitarbeiter</span>
                  <span className="font-medium text-[#111827]">
                    {visit.employee.firstName} {visit.employee.lastName}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-500">Aufgaben</span>
                  <span className="font-medium text-emerald-700">
                    {tasks.filter((t) => t.completed).length}/{tasks.length}{" "}
                    erledigt
                  </span>
                </div>
                {checkInTime && (
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-500">Eingecheckt</span>
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
                Unterschrift erfassen
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
              Einsatz abgeschlossen
            </h3>
            <p className="mt-1 text-sm text-gray-500">
              Der Leistungsnachweis wurde erfolgreich erstellt und abgezeichnet.
            </p>
            {!isOnline && pendingCount > 0 && (
              <div className="mt-4 flex items-center gap-2 rounded-xl bg-amber-50 px-4 py-2">
                <AlertTriangleIcon className="h-4 w-4 text-amber-500" />
                <span className="text-xs text-amber-700">
                  Wird bei Verbindung synchronisiert ({pendingCount} ausstehend)
                </span>
              </div>
            )}
            <Button onClick={onBack} variant="outline" className="mt-6">
              Zurück zur Übersicht
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
