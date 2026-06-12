"use client";

import { useTranslations } from "next-intl";
import { Topbar } from "@/components/layout/topbar";
import { PageContent } from "@/components/ui/page-content";
import { TimesheetImportClient } from "@/components/timesheet/timesheet-import-client";

export default function TimesheetImportPage() {
  const t = useTranslations("timesheetImport");
  return (
    <>
      <Topbar title={t("title")} description={t("subtitle")} />
      <PageContent className="max-w-3xl">
        <TimesheetImportClient />
      </PageContent>
    </>
  );
}
