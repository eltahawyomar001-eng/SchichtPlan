"use client";

import { useEffect, useRef } from "react";
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
  className?: string;
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

/**
 * Unified modal overlay.
 * Provides consistent backdrop blur, rounded corners, entrance animation,
 * iOS/Android safe-area support, and mobile bottom-sheet behavior.
 */
export function Modal({
  open,
  onClose,
  children,
  size = "lg",
  title,
  description,
  className,
}: ModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

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
        if (e.target === overlayRef.current) onClose();
      }}
    >
      <div
        className={cn(
          "w-full mx-0 sm:mx-4 rounded-t-2xl sm:rounded-2xl bg-white shadow-2xl ring-1 ring-gray-100",
          "max-h-[92vh] sm:max-h-[85vh] overflow-hidden flex flex-col",
          "animate-slide-up sm:animate-fade-in",
          sizeMap[size],
          className,
        )}
        style={{
          paddingBottom: "env(safe-area-inset-bottom)",
        }}
      >
        {/* Header — sticky */}
        {title && (
          <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4 sm:px-6 shrink-0">
            <div>
              <h2 className="text-base sm:text-lg font-bold text-gray-900">
                {title}
              </h2>
              {description && (
                <p className="mt-0.5 text-sm text-gray-500">{description}</p>
              )}
            </div>
            <button
              onClick={onClose}
              className="flex-shrink-0 rounded-xl p-1.5 hover:bg-gray-100 transition-colors"
            >
              <XIcon className="h-4 w-4 text-gray-400" />
            </button>
          </div>
        )}

        {/* Body — scrollable */}
        <div
          className={cn(
            "flex-1 overflow-y-auto overscroll-contain",
            title ? "p-5 sm:p-6" : "",
          )}
        >
          {children}
        </div>
      </div>
    </div>
  );
}

/**
 * Standard footer for modal forms — right-aligned cancel + submit buttons.
 * Sticky at the bottom with safe-area support.
 */
export function ModalFooter({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex justify-end gap-3 border-t border-gray-100 pt-5",
        className,
      )}
    >
      {children}
    </div>
  );
}
