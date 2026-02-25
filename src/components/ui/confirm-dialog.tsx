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
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-sm mx-4 rounded-2xl bg-white shadow-2xl ring-1 ring-gray-100 animate-fade-in">
        <div className="flex items-start gap-3 p-6">
          <div
            className={`flex-shrink-0 rounded-xl p-2.5 ${variant === "danger" ? "bg-red-50 ring-1 ring-red-200/50" : "bg-amber-50 ring-1 ring-amber-200/50"}`}
          >
            <AlertTriangleIcon
              className={`h-5 w-5 ${variant === "danger" ? "text-red-600" : "text-amber-600"}`}
            />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-base font-bold text-gray-900">{title}</h3>
            <p className="mt-1.5 text-sm text-gray-500 leading-relaxed">
              {message}
            </p>
          </div>
          <button
            onClick={onCancel}
            className="flex-shrink-0 rounded-lg p-1 hover:bg-gray-100 transition-colors"
          >
            <XIcon className="h-4 w-4 text-gray-400" />
          </button>
        </div>
        <div className="flex justify-end gap-3 border-t border-gray-100 px-6 py-4">
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
