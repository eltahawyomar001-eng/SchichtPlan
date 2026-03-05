"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { XIcon, ShieldCheckIcon, AlertTriangleIcon } from "@/components/icons";

// ─── Types ──────────────────────────────────────────────────────

interface SignatureDrawerProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: {
    signatureData: string;
    signerName: string;
    signerRole: string;
  }) => Promise<void>;
  isOnline: boolean;
  isWithinGeofence: boolean;
}

// ─── Signer role options ────────────────────────────────────────

const SIGNER_ROLES = [
  { value: "", label: "Position auswählen…" },
  { value: "Objektleiter", label: "Objektleiter/in" },
  { value: "Hausmeister", label: "Hausmeister/in" },
  { value: "Facility Manager", label: "Facility Manager/in" },
  { value: "Empfang", label: "Empfang" },
  { value: "Abteilungsleiter", label: "Abteilungsleiter/in" },
  { value: "Geschäftsführer", label: "Geschäftsführer/in" },
  { value: "Sonstige", label: "Sonstige" },
];

// ─── Velocity-smoothed drawing helpers ──────────────────────────

interface Point {
  x: number;
  y: number;
  time: number;
}

function getVelocity(p1: Point, p2: Point): number {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const dt = p2.time - p1.time || 1;
  return Math.sqrt(dx * dx + dy * dy) / dt;
}

function smoothLineWidth(
  velocity: number,
  lastWidth: number,
  minWidth: number,
  maxWidth: number,
  filterWeight: number,
): number {
  // Higher velocity → thinner line (pen physics)
  const targetWidth = Math.max(minWidth, maxWidth / (velocity * 0.8 + 1));
  // Exponential moving average for smoothing
  return lastWidth * filterWeight + targetWidth * (1 - filterWeight);
}

// ─── Component ──────────────────────────────────────────────────

export function SignatureDrawer({
  open,
  onClose,
  onSubmit,
  isOnline,
  isWithinGeofence,
}: SignatureDrawerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasContent, setHasContent] = useState(false);
  const [signerName, setSignerName] = useState("");
  const [signerRole, setSignerRole] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Velocity-smoothing state
  const lastPoint = useRef<Point | null>(null);
  const lastWidth = useRef(2.5);
  const VELOCITY_FILTER_WEIGHT = 0.7;
  const MIN_LINE_WIDTH = 1;
  const MAX_LINE_WIDTH = 4.5;

  // ────────── Canvas setup (HiDPI) ──────────

  const setupCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.scale(dpr, dpr);
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
    }
  }, []);

  useEffect(() => {
    if (open) {
      // Delay to let the animation settle
      const timer = setTimeout(setupCanvas, 350);
      return () => clearTimeout(timer);
    }
  }, [open, setupCanvas]);

  // ────────── Coordinate helpers ──────────

  const getCoords = (
    e: React.MouseEvent | React.TouchEvent,
    canvas: HTMLCanvasElement,
  ): Point => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const dpr = window.devicePixelRatio || 1;

    let clientX: number, clientY: number;
    if ("touches" in e) {
      const touch = e.touches[0] || e.changedTouches[0];
      clientX = touch.clientX;
      clientY = touch.clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    return {
      x: ((clientX - rect.left) * scaleX) / dpr,
      y: ((clientY - rect.top) * scaleY) / dpr,
      time: Date.now(),
    };
  };

  // ────────── Drawing handlers ──────────

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const point = getCoords(e, canvas);
    lastPoint.current = point;
    lastWidth.current = 2.5;

    ctx.beginPath();
    ctx.moveTo(point.x, point.y);
    setIsDrawing(true);
    setHasContent(true);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing) return;
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const point = getCoords(e, canvas);
    const prev = lastPoint.current;

    if (prev) {
      const velocity = getVelocity(prev, point);
      const width = smoothLineWidth(
        velocity,
        lastWidth.current,
        MIN_LINE_WIDTH,
        MAX_LINE_WIDTH,
        VELOCITY_FILTER_WEIGHT,
      );
      lastWidth.current = width;

      ctx.strokeStyle = "#1f2937";
      ctx.lineWidth = width;
      ctx.beginPath();
      ctx.moveTo(prev.x, prev.y);

      // Bezier smoothing for natural curves
      const midX = (prev.x + point.x) / 2;
      const midY = (prev.y + point.y) / 2;
      ctx.quadraticCurveTo(prev.x, prev.y, midX, midY);
      ctx.stroke();
    }

    lastPoint.current = point;
  };

  const stopDrawing = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    lastPoint.current = null;
  };

  // ────────── Actions ──────────

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasContent(false);
    lastPoint.current = null;
    lastWidth.current = 2.5;
  };

  const handleSubmit = async () => {
    const canvas = canvasRef.current;
    if (!canvas || !hasContent || !signerName) return;

    setIsSubmitting(true);
    try {
      const signatureData = canvas.toDataURL("image/png");
      await onSubmit({
        signatureData,
        signerName,
        signerRole,
      });
      // Reset state after successful submit
      clearCanvas();
      setSignerName("");
      setSignerRole("");
    } catch {
      // Error handling is in parent
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (isSubmitting) return;
    clearCanvas();
    setSignerName("");
    setSignerRole("");
    onClose();
  };

  // ────────── Body scroll lock ──────────

  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  // Escape key
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isSubmitting) handleClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, isSubmitting]); // eslint-disable-line react-hooks/exhaustive-deps

  const canSubmit =
    hasContent &&
    signerName.trim().length > 0 &&
    (isWithinGeofence || !isOnline);

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm"
            onClick={handleClose}
          />

          {/* Bottom Sheet */}
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{
              type: "spring",
              damping: 30,
              stiffness: 300,
              mass: 0.8,
            }}
            className="fixed inset-x-0 bottom-0 z-50 flex max-h-[92vh] flex-col rounded-t-2xl bg-white shadow-2xl ring-1 ring-gray-900/[0.04]"
            style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drag handle */}
            <div className="flex justify-center pt-2.5 pb-1 shrink-0 min-h-[48px] items-center">
              <div className="w-9 h-[5px] rounded-full bg-gray-300/80" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3 shrink-0">
              <div>
                <h2 className="text-lg font-bold text-[#111827] tracking-tight">
                  Unterschrift erfassen
                </h2>
                <p className="mt-0.5 text-sm text-gray-500">
                  Leistungsnachweis abzeichnen
                </p>
              </div>
              <button
                onClick={handleClose}
                disabled={isSubmitting}
                className="flex-shrink-0 -mr-1 rounded-xl p-3 hover:bg-gray-100 active:bg-gray-200 transition-colors min-w-[48px] min-h-[48px] flex items-center justify-center"
                aria-label="Schließen"
              >
                <XIcon className="h-5 w-5 text-gray-400" />
              </button>
            </div>

            {/* Scrollable body */}
            <div className="flex-1 overflow-y-auto overscroll-contain px-5 py-4 space-y-4">
              {/* Signer name */}
              <div>
                <Label className="text-[#111827]">
                  Name des Unterzeichners *
                </Label>
                <Input
                  value={signerName}
                  onChange={(e) => setSignerName(e.target.value)}
                  placeholder="z.B. Max Mustermann"
                  className="mt-1.5"
                  autoComplete="name"
                />
              </div>

              {/* Signer role */}
              <div>
                <Label className="text-[#111827]">Position / Rolle</Label>
                <Select
                  value={signerRole}
                  onChange={(e) => setSignerRole(e.target.value)}
                  className="mt-1.5"
                >
                  {SIGNER_ROLES.map((role) => (
                    <option key={role.value} value={role.value}>
                      {role.label}
                    </option>
                  ))}
                </Select>
              </div>

              {/* Signature canvas */}
              <div>
                <Label className="text-[#111827]">Unterschrift *</Label>
                <div
                  className={cn(
                    "relative mt-1.5 rounded-xl border-2 border-dashed transition-colors",
                    hasContent
                      ? "border-emerald-400 bg-white"
                      : "border-gray-300 bg-white hover:border-emerald-400",
                  )}
                >
                  <canvas
                    ref={canvasRef}
                    style={{ width: "100%", height: "200px" }}
                    className="touch-none cursor-crosshair rounded-xl"
                    onMouseDown={startDrawing}
                    onMouseMove={draw}
                    onMouseUp={stopDrawing}
                    onMouseLeave={stopDrawing}
                    onTouchStart={startDrawing}
                    onTouchMove={draw}
                    onTouchEnd={stopDrawing}
                  />
                  {!hasContent && (
                    <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                      <p className="text-sm text-gray-400">
                        Hier unterschreiben
                      </p>
                    </div>
                  )}
                </div>
                {hasContent && (
                  <button
                    type="button"
                    onClick={clearCanvas}
                    className="mt-2 text-xs font-medium text-gray-500 hover:text-gray-700 transition-colors"
                  >
                    Unterschrift löschen
                  </button>
                )}
              </div>
            </div>

            {/* Sticky footer */}
            <div
              className="shrink-0 border-t border-gray-100 bg-white/80 backdrop-blur-lg px-5 py-4 space-y-3"
              style={{
                paddingBottom: "calc(1rem + env(safe-area-inset-bottom, 0px))",
              }}
            >
              {/* Offline warning in footer */}
              {!isOnline && (
                <div className="flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2">
                  <AlertTriangleIcon className="h-4 w-4 shrink-0 text-amber-500" />
                  <span className="text-xs text-amber-700">
                    Offline — wird bei Verbindung synchronisiert
                  </span>
                </div>
              )}

              {!signerName.trim() && (
                <p className="text-xs text-amber-600">
                  Bitte geben Sie den Namen des Unterzeichners ein.
                </p>
              )}

              <Button
                onClick={handleSubmit}
                disabled={!canSubmit || isSubmitting}
                className="w-full !h-14 text-base font-bold"
              >
                {isSubmitting ? (
                  <span className="flex items-center gap-2">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    Wird abgeschlossen…
                  </span>
                ) : !isOnline ? (
                  <span className="flex items-center gap-2">
                    <AlertTriangleIcon className="h-5 w-5" />
                    Auf Gerät speichern (Sync später)
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <ShieldCheckIcon className="h-5 w-5" />
                    Versiegeln & Absenden
                  </span>
                )}
              </Button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
