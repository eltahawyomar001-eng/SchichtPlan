"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { AlertTriangleIcon, UserPlusIcon } from "@/components/icons";

interface MissingEmployeesModalProps {
  open: boolean;
  names: string[];
  /** Continue to the review screen with the matched entries. */
  onContinue: () => void;
  onClose: () => void;
  /** True when every extracted row was blocked (nothing left to review). */
  noMatches: boolean;
}

/**
 * Warns the manager that some names on the Stundenzettel don't map to an
 * existing employee. Those rows are blocked server-side; the manager must
 * invite the people first.
 */
export function MissingEmployeesModal({
  open,
  names,
  onContinue,
  onClose,
  noMatches,
}: MissingEmployeesModalProps) {
  const t = useTranslations("timesheetImport.missing");
  const router = useRouter();

  return (
    <Modal open={open} onClose={onClose} size="md" title={t("title")}>
      <div className="space-y-4">
        <div className="flex gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/50 dark:bg-amber-950/30">
          <AlertTriangleIcon className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
          <p className="text-sm leading-relaxed text-amber-900 dark:text-amber-200">
            {t("body")}
          </p>
        </div>

        <ul className="space-y-1.5">
          {names.map((name) => (
            <li
              key={name}
              className="flex items-center gap-2 rounded-lg bg-gray-50 px-3 py-2 text-sm font-medium text-gray-800 dark:bg-zinc-800 dark:text-zinc-100"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
              {name}
            </li>
          ))}
        </ul>

        <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
          <Button variant="outline" onClick={() => router.push("/mitarbeiter")}>
            <UserPlusIcon className="h-4 w-4" />
            {t("inviteCta")}
          </Button>
          {!noMatches && (
            <Button variant="default" onClick={onContinue}>
              {t("continue")}
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
}
