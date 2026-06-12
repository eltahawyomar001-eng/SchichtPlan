"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CircleCheckIcon } from "@/components/icons";
import { TimesheetUpload } from "./timesheet-upload";
import { TimesheetReview } from "./timesheet-review";
import { MissingEmployeesModal } from "./missing-employees-modal";
import type { OcrResponse } from "./types";

type Step = "upload" | "review" | "done";

/** Client state machine wiring upload → missing-employees warning → review. */
export function TimesheetImportClient() {
  const t = useTranslations("timesheetImport");
  const [step, setStep] = useState<Step>("upload");
  const [result, setResult] = useState<OcrResponse | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [successCount, setSuccessCount] = useState(0);

  function handleExtracted(res: OcrResponse) {
    setResult(res);
    if (res.missingEmployees.length > 0) {
      setModalOpen(true); // warn first; review proceeds with matched entries
    } else {
      setStep("review");
    }
  }

  function reset() {
    setResult(null);
    setSuccessCount(0);
    setStep("upload");
  }

  return (
    <>
      {step === "upload" && <TimesheetUpload onExtracted={handleExtracted} />}

      {step === "review" && result && (
        <TimesheetReview
          importId={result.importId}
          initialEntries={result.entries}
          workspaceEmployees={result.workspaceEmployees}
          onEdit={reset}
          onConfirmed={(count) => {
            setSuccessCount(count);
            setStep("done");
          }}
        />
      )}

      {step === "done" && (
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-400">
              <CircleCheckIcon className="h-8 w-8" />
            </span>
            <p className="text-lg font-semibold text-gray-900 dark:text-zinc-100">
              {t("review.success", { count: successCount })}
            </p>
            <Button variant="outline" onClick={reset}>
              {t("title")}
            </Button>
          </CardContent>
        </Card>
      )}

      <MissingEmployeesModal
        open={modalOpen}
        names={result?.missingEmployees ?? []}
        noMatches={(result?.entries.length ?? 0) === 0}
        onClose={() => {
          setModalOpen(false);
          // If there were matched entries, the manager can still review them.
          if ((result?.entries.length ?? 0) > 0) setStep("review");
        }}
        onContinue={() => {
          setModalOpen(false);
          setStep("review");
        }}
      />
    </>
  );
}
