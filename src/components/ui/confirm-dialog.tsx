"use client";

import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangleIcon, XIcon } from "@/components/icons";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "danger" | "warning";
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Delete",
  cancelLabel = "Cancel",
  variant = "danger",
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (open) cancelRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    /**
     * Capture phase + stopImmediatePropagation, so Escape dismisses only this
     * dialog.
     *
     * Modal attaches its own Escape handler to window. When a confirmation is
     * opened from inside a modal, the modal mounted first, so its bubble-phase
     * listener also ran — one Escape closed the confirmation AND the modal
     * beneath it, throwing the user out of the thing they were part-way
     * through. A capture listener on window runs before any bubble listener on
     * window, so the topmost dialog gets to consume the key.
     */
    const handler = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopImmediatePropagation();
      onCancel();
    };
    window.addEventListener("keydown", handler, true);
    return () => window.removeEventListener("keydown", handler, true);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div
      /**
       * z-[80] — above the base overlay layer, not level with it.
       *
       * Modal, BottomSheet, UpgradeModal, CommandPalette and this dialog all
       * sat at z-[60]. With equal z-index the winner is whichever renders last
       * in the DOM, so a confirmation opened FROM a modal landed underneath the
       * modal that opened it: the user had to close the thing they were
       * confirming in order to see the confirmation. Pages happened to get it
       * right or wrong purely by the order they listed their overlays in.
       *
       * A confirmation is always secondary to whatever opened it, so it belongs
       * on its own layer above them. Overlay scale in use:
       *   40  sidebar backdrop
       *   60  modals, sheets, command palette  (base overlay layer)
       *   70  onboarding tour coach-marks
       *   80  confirmations                    (this)
       *  100  blocking ToS re-acceptance
       *  9997+ transient chrome: toasts, connectivity banner
       */
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      style={{
        paddingTop: "max(1rem, env(safe-area-inset-top, 0px))",
        paddingBottom: "max(1rem, env(safe-area-inset-bottom, 0px))",
        paddingLeft: "max(1rem, env(safe-area-inset-left, 0px))",
        paddingRight: "max(1rem, env(safe-area-inset-right, 0px))",
      }}
    >
      <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-zinc-900 shadow-2xl ring-1 ring-gray-100 dark:ring-zinc-800 animate-fade-in overflow-hidden">
        <div className="flex items-start gap-3 p-6">
          <div
            className={`flex-shrink-0 rounded-xl p-2.5 ${variant === "danger" ? "bg-red-50 ring-1 ring-red-200/50 dark:bg-red-950 dark:ring-red-800/50" : "bg-amber-50 ring-1 ring-amber-200/50 dark:bg-amber-950 dark:ring-amber-800/50"}`}
          >
            <AlertTriangleIcon
              className={`h-5 w-5 ${variant === "danger" ? "text-red-600 dark:text-red-400" : "text-amber-600 dark:text-amber-400"}`}
            />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-base font-bold text-gray-900 dark:text-zinc-100">
              {title}
            </h3>
            <p className="mt-1.5 text-sm text-gray-500 dark:text-zinc-400 leading-relaxed">
              {message}
            </p>
          </div>
          <button
            onClick={onCancel}
            className="flex-shrink-0 rounded-lg p-1 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <XIcon className="h-4 w-4 text-gray-400 dark:text-zinc-500" />
          </button>
        </div>
        <div className="flex justify-end gap-3 border-t border-gray-100 dark:border-zinc-800 px-6 py-4">
          <Button
            ref={cancelRef}
            variant="outline"
            size="sm"
            onClick={onCancel}
          >
            {cancelLabel}
          </Button>
          <Button
            variant={variant === "danger" ? "destructive" : "outline"}
            size="sm"
            onClick={onConfirm}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
