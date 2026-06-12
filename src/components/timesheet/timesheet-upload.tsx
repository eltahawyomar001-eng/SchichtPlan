"use client";

import { useCallback, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { UploadCloudIcon, SparklesIcon } from "@/components/icons";
import type { OcrResponse } from "./types";

interface TimesheetUploadProps {
  /** Called with the staged result on a successful extraction. */
  onExtracted: (result: OcrResponse) => void;
}

const ACCEPTED = ["image/jpeg", "image/png", "image/webp"];
const MAX_BYTES = 10 * 1024 * 1024;

/**
 * Desktop-optimized dropzone + click-to-select for a Stundenzettel image.
 * Shows a clean blocking overlay while the server-side AI processes the file.
 */
export function TimesheetUpload({ onExtracted }: TimesheetUploadProps) {
  const t = useTranslations("timesheetImport.upload");
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFile = useCallback(
    async (file: File) => {
      setError(null);
      if (!ACCEPTED.includes(file.type)) {
        setError(t("unsupportedType"));
        return;
      }
      if (file.size > MAX_BYTES) {
        setError(t("fileTooLarge"));
        return;
      }

      setProcessing(true);
      try {
        const form = new FormData();
        form.append("file", file);
        const res = await fetch("/api/timesheet/ocr", {
          method: "POST",
          body: form,
        });
        if (!res.ok) throw new Error("ocr_failed");
        const data = (await res.json()) as OcrResponse;
        onExtracted(data);
      } catch {
        setError(t("errorGeneric"));
      } finally {
        setProcessing(false);
      }
    },
    [onExtracted, t],
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const file = e.dataTransfer.files?.[0];
      if (file) void handleFile(file);
    },
    [handleFile],
  );

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        disabled={processing}
        className={cn(
          "flex w-full flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed px-6 py-16 text-center transition-colors",
          dragging
            ? "border-emerald-400 bg-emerald-50 dark:bg-emerald-950/20"
            : "border-gray-300 bg-gray-50/50 hover:border-emerald-300 hover:bg-gray-50 dark:border-zinc-700 dark:bg-zinc-900/40 dark:hover:border-emerald-700",
        )}
      >
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-400">
          <UploadCloudIcon className="h-7 w-7" />
        </span>
        <span className="text-base font-semibold text-gray-900 dark:text-zinc-100">
          {t("dropTitle")}
        </span>
        <span className="max-w-xs text-sm text-gray-500 dark:text-zinc-400">
          {t("dropHint")}
        </span>
      </button>

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED.join(",")}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleFile(file);
          e.target.value = "";
        }}
      />

      {error && (
        <p className="mt-3 text-sm font-medium text-red-600 dark:text-red-400">
          {error}
        </p>
      )}

      {/* Blocking processing overlay */}
      {processing && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 rounded-2xl bg-white/80 backdrop-blur-sm dark:bg-zinc-950/80">
          <span className="relative flex h-12 w-12 items-center justify-center">
            <span className="absolute h-12 w-12 animate-ping rounded-full bg-emerald-400/40" />
            <SparklesIcon className="h-7 w-7 text-emerald-500" />
          </span>
          <div className="text-center">
            <p className="font-semibold text-gray-900 dark:text-zinc-100">
              {t("processing")}
            </p>
            <p className="mt-1 text-sm text-gray-500 dark:text-zinc-400">
              {t("processingHint")}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
