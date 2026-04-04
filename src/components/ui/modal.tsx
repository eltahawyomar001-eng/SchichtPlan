"use client";

import { useEffect, useRef, useCallback } from "react";
import { cn } from "@/lib/utils";
import { XIcon } from "@/components/icons";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  /** Max width class — defaults to max-w-lg */
  size?: "sm" | "md" | "lg" | "xl" | "2xl" | "3xl" | "full";
  /** Optional title for the modal header */
  title?: string;
  /** Optional description below the title */
  description?: string;
  /** Optional footer content — rendered sticky outside scroll area */
  footer?: React.ReactNode;
  className?: string;
  /**
   * Called before closing via backdrop click, Escape key, X button, or swipe.
   * Return `true` to prevent the close (e.g. to show a confirm dialog).
   * If not provided or returns `false`, the modal closes normally.
   */
  preventClose?: () => boolean;
}

const sizeMap = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-lg",
  xl: "max-w-xl",
  "2xl": "max-w-2xl",
  "3xl": "max-w-3xl",
  full: "max-w-full",
};

/** Minimum drag distance (px) to trigger dismiss */
const SWIPE_THRESHOLD = 80;

/**
 * Unified modal overlay.
 * Provides consistent backdrop blur, rounded corners, entrance animation,
 * iOS/Android safe-area support, mobile bottom-sheet with drag handle & swipe-to-dismiss.
 */
export function Modal({
  open,
  onClose,
  children,
  size = "lg",
  title,
  description,
  footer,
  className,
  preventClose,
}: ModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const dragState = useRef<{
    startY: number;
    currentY: number;
    isDragging: boolean;
  }>({ startY: 0, currentY: 0, isDragging: false });

  /** Guarded close — respects preventClose callback */
  const guardedClose = useCallback(() => {
    if (preventClose?.()) return;
    onClose();
  }, [onClose, preventClose]);

  // Escape key handler
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") guardedClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, guardedClose]);

  // Lock body scroll
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

  // Swipe-to-dismiss handlers (mobile only)
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    // Only allow swipe from the drag handle area (top 40px of sheet)
    const sheet = sheetRef.current;
    if (!sheet) return;
    const rect = sheet.getBoundingClientRect();
    const touchY = e.touches[0].clientY;
    if (touchY - rect.top > 40) return;

    dragState.current = {
      startY: e.touches[0].clientY,
      currentY: e.touches[0].clientY,
      isDragging: true,
    };
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!dragState.current.isDragging) return;
    const currentY = e.touches[0].clientY;
    const deltaY = currentY - dragState.current.startY;
    dragState.current.currentY = currentY;

    // Only allow dragging downward
    if (deltaY > 0 && sheetRef.current) {
      sheetRef.current.style.transform = `translateY(${deltaY}px)`;
      sheetRef.current.style.transition = "none";
    }
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (!dragState.current.isDragging) return;
    const deltaY = dragState.current.currentY - dragState.current.startY;
    dragState.current.isDragging = false;

    if (sheetRef.current) {
      if (deltaY > SWIPE_THRESHOLD) {
        // Dismiss — animate out (check preventClose first)
        if (preventClose?.()) {
          // Snap back — preventClose blocked the dismiss
          sheetRef.current.style.transition =
            "transform 0.3s cubic-bezier(0.2, 0.9, 0.3, 1)";
          sheetRef.current.style.transform = "translateY(0)";
          return;
        }
        sheetRef.current.style.transition =
          "transform 0.25s cubic-bezier(0.4, 0, 1, 1)";
        sheetRef.current.style.transform = "translateY(100%)";
        setTimeout(onClose, 250);
      } else {
        // Snap back
        sheetRef.current.style.transition =
          "transform 0.3s cubic-bezier(0.2, 0.9, 0.3, 1)";
        sheetRef.current.style.transform = "translateY(0)";
      }
    }
  }, [onClose, preventClose]);

  if (!open) return null;

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm animate-fade-in"
      style={{
        paddingTop: "env(safe-area-inset-top)",
        paddingLeft: "env(safe-area-inset-left)",
        paddingRight: "env(safe-area-inset-right)",
      }}
      onClick={(e) => {
        if (e.target === overlayRef.current) guardedClose();
      }}
    >
      <div
        ref={sheetRef}
        className={cn(
          "w-full mx-0 sm:mx-4 rounded-t-2xl sm:rounded-2xl bg-white shadow-[var(--shadow-2xl)] ring-1 ring-gray-900/[0.04]",
          "max-h-[92vh] sm:max-h-[85vh] overflow-hidden flex flex-col",
          "animate-slide-up sm:animate-spring-scale-in",
          sizeMap[size],
          className,
        )}
        style={{
          paddingBottom: "env(safe-area-inset-bottom)",
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Drag handle — mobile only */}
        <div className="flex sm:hidden justify-center pt-2.5 pb-0.5 shrink-0 cursor-grab active:cursor-grabbing">
          <div className="w-9 h-[5px] rounded-full bg-gray-300" />
        </div>

        {/* Header — sticky */}
        {title && (
          <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3.5 sm:px-6 sm:py-4 shrink-0">
            <div className="min-w-0 flex-1">
              <h2 className="text-lg sm:text-lg font-bold text-gray-900 tracking-tight">
                {title}
              </h2>
              {description && (
                <p className="mt-0.5 text-sm text-gray-500">{description}</p>
              )}
            </div>
            <button
              onClick={guardedClose}
              className="flex-shrink-0 -mr-1 rounded-xl p-2 hover:bg-gray-100 active:bg-gray-200 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
              aria-label="Close"
            >
              <XIcon className="h-5 w-5 text-gray-400" />
            </button>
          </div>
        )}

        {/* Body — scrollable */}
        <div
          className={cn(
            "flex-1 overflow-y-auto overscroll-contain",
            title ? "p-5 sm:p-6" : "",
          )}
          style={{ WebkitOverflowScrolling: "touch" }}
        >
          {children}
        </div>

        {/* Footer — sticky, outside scroll area */}
        {footer && (
          <div
            className="shrink-0 border-t border-gray-100 bg-white/80 backdrop-blur-lg px-5 py-4 sm:px-6"
            style={{
              paddingBottom: "calc(1rem + env(safe-area-inset-bottom, 0px))",
            }}
          >
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Standard footer for modal forms — right-aligned cancel + submit buttons.
 * Use inside the Modal `footer` prop for sticky behavior, or inline for legacy.
 */
export function ModalFooter({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex justify-end gap-3", className)}>{children}</div>
  );
}
