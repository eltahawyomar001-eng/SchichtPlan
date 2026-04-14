"use client";

import { Toaster as SonnerToaster } from "sonner";
import { useTheme } from "@/components/providers/theme-provider";

/**
 * Global toast container — renders the Sonner Toaster with Shiftfy branding.
 *
 * Place this once in the Providers tree. Usage anywhere in the app:
 *
 *   import { toast } from "sonner";
 *   toast.success("Schicht erstellt");
 *   toast.error("Fehler beim Speichern");
 *   toast("Nachricht gesendet");
 *   toast.loading("Wird gespeichert…");
 */
export function Toaster() {
  const { theme } = useTheme();

  return (
    <SonnerToaster
      theme={theme as "light" | "dark" | "system"}
      position="bottom-right"
      offset={16}
      gap={8}
      expand={false}
      richColors
      closeButton
      duration={4000}
      toastOptions={{
        unstyled: false,
        classNames: {
          toast:
            "!rounded-xl !border !shadow-lg !font-sans !text-sm !px-4 !py-3 " +
            "!bg-white dark:!bg-zinc-900 !border-gray-200 dark:!border-zinc-700 " +
            "!text-gray-900 dark:!text-zinc-100",
          title: "!font-semibold !text-sm",
          description: "!text-xs !text-gray-500 dark:!text-zinc-400",
          actionButton:
            "!bg-emerald-600 !text-white !rounded-lg !text-xs !font-semibold !px-3 !py-1.5 hover:!bg-emerald-700 !transition-colors",
          cancelButton:
            "!bg-gray-100 dark:!bg-zinc-800 !text-gray-700 dark:!text-zinc-300 !rounded-lg !text-xs !font-semibold !px-3 !py-1.5",
          closeButton:
            "!border-gray-200 dark:!border-zinc-700 !bg-white dark:!bg-zinc-800 !text-gray-400 dark:!text-zinc-500 hover:!text-gray-600 dark:hover:!text-zinc-300 !transition-colors",
          success:
            "!border-emerald-200 dark:!border-emerald-800 !bg-emerald-50 dark:!bg-emerald-950 !text-emerald-900 dark:!text-emerald-100",
          error:
            "!border-red-200 dark:!border-red-800 !bg-red-50 dark:!bg-red-950 !text-red-900 dark:!text-red-100",
          warning:
            "!border-amber-200 dark:!border-amber-800 !bg-amber-50 dark:!bg-amber-950 !text-amber-900 dark:!text-amber-100",
          info: "!border-blue-200 dark:!border-blue-800 !bg-blue-50 dark:!bg-blue-950 !text-blue-900 dark:!text-blue-100",
        },
      }}
    />
  );
}
