"use client";

import { useEffect, useRef, useCallback } from "react";
import { cn } from "@/lib/utils";
import { XIcon } from "@/components/icons";

interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  /** Optional title for the sheet header */
  title?: string;
  /** Optional description below the title */
  description?: string;
  /** Optional footer content — rendered sticky outside scroll area */
  footer?: React.ReactNode;
  className?: string;
  /**
   * Sheet height — "auto" sizes to content, "full" takes ~92vh.
   * Default: "auto"
   */
  height?: "auto" | "full";
}

/** Minimum drag distance (px) to trigger dismiss */
const SWIPE_THRESHOLD = 80;

/**
 * iOS-style bottom sheet for mobile viewports (≤ 768px).
 *
 * Features:
 * - Swipe-to-dismiss from drag handle (top 48px)
 * - Safe-area-inset-top / bottom padding
 * - 48px minimum touch targets
 * - Spring-physics cubic-bezier animations
 * - Body scroll lock
 * - Escape key dismissal
 * - Keyboard-aware: auto-scrolls focused inputs into view
 * - Dark backdrop with heavy blur (Apple HIG)
 *
 * This component is NOT responsive — it always renders as a bottom sheet.
 * Use `<AdaptiveModal>` for automatic desktop Modal / mobile BottomSheet switching.
 */
export function BottomSheet({
  open,
  onClose,
  children,
  title,
  description,
  footer,
  className,
  height = "auto",
}: BottomSheetProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const dragState = useRef<{
    startY: number;
    currentY: number;
    isDragging: boolean;
  }>({ startY: 0, currentY: 0, isDragging: false });

  // Escape key handler
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  // Lock body scroll when open
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

  // Reset sheet transform when re-opened
  useEffect(() => {
    if (open && sheetRef.current) {
      sheetRef.current.style.transform = "";
      sheetRef.current.style.transition = "";
    }
  }, [open]);

  // Keyboard-aware scrolling — when an input is focused, scroll it into view
  useEffect(() => {
    if (!open) return;

    const handleFocusIn = (e: FocusEvent) => {
      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "SELECT" ||
        target.tagName === "TEXTAREA"
      ) {
        // Wait for virtual keyboard to appear, then scroll into view
        setTimeout(() => {
          target.scrollIntoView({
            behavior: "smooth",
            block: "center",
          });
        }, 300);
      }
    };

    const container = scrollRef.current;
    container?.addEventListener("focusin", handleFocusIn);
    return () => container?.removeEventListener("focusin", handleFocusIn);
  }, [open]);

  // Swipe-to-dismiss handlers — only from drag handle area (top 48px)
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const sheet = sheetRef.current;
    if (!sheet) return;
    const rect = sheet.getBoundingClientRect();
    const touchY = e.touches[0].clientY;
    // Only allow drag from the top 48px (drag handle zone)
    if (touchY - rect.top > 48) return;

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
        // Dismiss — animate out
        sheetRef.current.style.transition =
          "transform 0.25s cubic-bezier(0.4, 0, 1, 1)";
        sheetRef.current.style.transform = "translateY(100%)";
        setTimeout(onClose, 250);
      } else {
        // Snap back with spring
        sheetRef.current.style.transition =
          "transform 0.3s cubic-bezier(0.2, 0.9, 0.3, 1)";
        sheetRef.current.style.transform = "translateY(0)";
      }
    }
  }, [onClose]);

  if (!open) return null;

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-md animate-fade-in"
      style={{
        paddingLeft: "env(safe-area-inset-left, 0px)",
        paddingRight: "env(safe-area-inset-right, 0px)",
      }}
      onClick={(e) => {
        if (e.target === overlayRef.current) onClose();
      }}
    >
      <div
        ref={sheetRef}
        className={cn(
          "w-full rounded-t-3xl bg-white shadow-[var(--shadow-2xl)] ring-1 ring-gray-900/[0.04]",
          "overflow-hidden flex flex-col",
          "animate-slide-up",
          height === "full" ? "max-h-[92vh]" : "max-h-[90vh]",
          className,
        )}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Drag handle — always visible, 44px touch zone */}
        <div className="flex justify-center pt-2 pb-0.5 shrink-0 cursor-grab active:cursor-grabbing min-h-[44px] items-start">
          <div className="mt-1.5 w-9 h-1 rounded-full bg-gray-300/70" />
        </div>

        {/* Header — with safe-area-inset-top for notch/Dynamic Island */}
        {title && (
          <div
            className="flex items-center justify-between border-b border-gray-100 px-4 pb-3 shrink-0"
            style={{ paddingTop: "max(0px, env(safe-area-inset-top, 0px))" }}
          >
            <div className="min-w-0 flex-1">
              <h2 className="text-lg font-bold text-gray-900 tracking-tight">
                {title}
              </h2>
              {description && (
                <p className="mt-0.5 text-sm text-gray-500">{description}</p>
              )}
            </div>
            <button
              onClick={onClose}
              className="flex-shrink-0 -mr-1 rounded-xl p-2.5 hover:bg-gray-100 active:bg-gray-200 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
              aria-label="Close"
            >
              <XIcon className="h-5 w-5 text-gray-400" />
            </button>
          </div>
        )}

        {/* Body — scrollable, keyboard-aware */}
        <div
          ref={scrollRef}
          className={cn(
            "flex-1 overflow-y-auto overscroll-contain px-4 py-3",
            title ? "" : "pt-0",
          )}
          style={{ WebkitOverflowScrolling: "touch" }}
        >
          {children}
        </div>

        {/* Footer — sticky, above Home Indicator */}
        {footer && (
          <div
            className="shrink-0 border-t border-gray-100 bg-white/80 backdrop-blur-lg px-4 py-3"
            style={{
              paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom, 0px))",
            }}
          >
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
