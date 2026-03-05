"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface SignaturePadProps {
  /** Called when the user finishes drawing, with the base64 data-URL */
  onSignature: (dataUrl: string) => void;
  /** Whether the pad is disabled (e.g. already signed) */
  disabled?: boolean;
  className?: string;
  /** Line width in pixels */
  lineWidth?: number;
  /** Canvas height in pixels */
  height?: number;
}

/**
 * Canvas-based signature capture pad.
 * Returns a base64 PNG data-URL via the `onSignature` callback.
 */
export function SignaturePad({
  onSignature,
  disabled = false,
  className,
  lineWidth = 2.5,
  height = 200,
}: SignaturePadProps) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = React.useState(false);
  const [hasContent, setHasContent] = React.useState(false);

  // ────────── Helpers ──────────

  const getCoords = (
    e: React.MouseEvent | React.TouchEvent,
    canvas: HTMLCanvasElement,
  ) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    if ("touches" in e) {
      const touch = e.touches[0] || e.changedTouches[0];
      return {
        x: (touch.clientX - rect.left) * scaleX,
        y: (touch.clientY - rect.top) * scaleY,
      };
    }
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  // ────────── Drawing handlers ──────────

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    if (disabled) return;
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const { x, y } = getCoords(e, canvas);
    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
    setHasContent(true);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing || disabled) return;
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const { x, y } = getCoords(e, canvas);
    ctx.strokeStyle = "#1f2937";
    ctx.lineWidth = lineWidth;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
  };

  // ────────── Actions ──────────

  const clear = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasContent(false);
  };

  const confirm = () => {
    const canvas = canvasRef.current;
    if (!canvas || !hasContent) return;
    const dataUrl = canvas.toDataURL("image/png");
    onSignature(dataUrl);
  };

  // ────────── High-DPI setup ──────────

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    const ctx = canvas.getContext("2d");
    if (ctx) ctx.scale(dpr, dpr);
  }, []);

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <div
        className={cn(
          "relative rounded-xl border-2 border-dashed transition-colors",
          disabled
            ? "border-gray-200 bg-gray-50"
            : "border-gray-300 bg-white hover:border-emerald-400",
        )}
      >
        <canvas
          ref={canvasRef}
          style={{ width: "100%", height: `${height}px` }}
          className="touch-none cursor-crosshair rounded-xl"
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
        />
        {!hasContent && !disabled && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <p className="text-sm text-gray-400">Hier unterschreiben</p>
          </div>
        )}
      </div>

      {!disabled && (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={clear}
            className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50 active:scale-[0.98]"
          >
            Löschen
          </button>
          <button
            type="button"
            onClick={confirm}
            disabled={!hasContent}
            className={cn(
              "rounded-lg px-4 py-2 text-sm font-semibold text-white transition-colors active:scale-[0.98]",
              hasContent
                ? "bg-emerald-600 hover:bg-emerald-700"
                : "cursor-not-allowed bg-gray-300",
            )}
          >
            Unterschrift bestätigen
          </button>
        </div>
      )}
    </div>
  );
}
