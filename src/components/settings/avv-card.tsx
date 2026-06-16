"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  FileCheckIcon,
  CheckCircleIcon,
  DownloadIcon,
} from "@/components/icons";

export function AvvCard() {
  const t = useTranslations("avvCard");

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileCheckIcon className="h-5 w-5" />
          {t("title")}
        </CardTitle>
        <CardDescription>{t("description")}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <Badge className="w-fit gap-1.5 border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400">
            <CheckCircleIcon className="h-3.5 w-3.5" />
            {t("concluded")}
          </Badge>
          <Link
            href="/avv"
            target="_blank"
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            <DownloadIcon className="h-4 w-4" />
            {t("view")}
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
