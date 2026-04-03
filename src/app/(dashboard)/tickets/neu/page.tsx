"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Topbar } from "@/components/layout/topbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { PageContent } from "@/components/ui/page-content";
import { ArrowLeftIcon, SendIcon } from "@/components/icons";

// ─── Component ──────────────────────────────────────────────────

export default function NewTicketPage() {
  const t = useTranslations("tickets");
  const router = useRouter();

  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("SONSTIGES");
  const [priority, setPriority] = useState("MITTEL");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const res = await fetch("/api/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject, description, category, priority }),
      });

      if (res.ok) {
        const ticket = await res.json();
        router.push(`/tickets/${ticket.id}`);
      } else {
        const data = await res.json();
        setError(data.error ?? t("createError"));
      }
    } catch {
      setError(t("createError"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Topbar title={t("newTicket")} />
      <PageContent className="max-w-2xl">
        <button
          onClick={() => router.push("/tickets")}
          className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-2"
        >
          <ArrowLeftIcon className="h-4 w-4" />
          {t("backToList")}
        </button>

        <Card>
          <CardHeader>
            <CardTitle>{t("newTicket")}</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
                  {error}
                </div>
              )}

              <div>
                <Label htmlFor="subject">{t("subject")}</Label>
                <Input
                  id="subject"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder={t("subjectPlaceholder")}
                  required
                  minLength={3}
                  maxLength={200}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="category">{t("category")}</Label>
                  <Select
                    id="category"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                  >
                    <option value="SCHICHTPLAN">
                      {t("categories.SCHICHTPLAN")}
                    </option>
                    <option value="ZEITERFASSUNG">
                      {t("categories.ZEITERFASSUNG")}
                    </option>
                    <option value="LOHNABRECHNUNG">
                      {t("categories.LOHNABRECHNUNG")}
                    </option>
                    <option value="TECHNIK">{t("categories.TECHNIK")}</option>
                    <option value="HR">{t("categories.HR")}</option>
                    <option value="SONSTIGES">
                      {t("categories.SONSTIGES")}
                    </option>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="priority">{t("priority")}</Label>
                  <Select
                    id="priority"
                    value={priority}
                    onChange={(e) => setPriority(e.target.value)}
                  >
                    <option value="NIEDRIG">{t("priorities.NIEDRIG")}</option>
                    <option value="MITTEL">{t("priorities.MITTEL")}</option>
                    <option value="HOCH">{t("priorities.HOCH")}</option>
                    <option value="DRINGEND">{t("priorities.DRINGEND")}</option>
                  </Select>
                </div>
              </div>

              <div>
                <Label htmlFor="description">{t("description")}</Label>
                <textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder={t("descriptionPlaceholder")}
                  required
                  minLength={10}
                  rows={6}
                  className="w-full rounded-lg border border-gray-200 p-3 text-sm focus:border-emerald-300 focus:ring-1 focus:ring-emerald-300 focus:outline-none resize-none"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.push("/tickets")}
                >
                  {t("cancel")}
                </Button>
                <Button
                  type="submit"
                  disabled={
                    submitting || subject.length < 3 || description.length < 10
                  }
                >
                  <SendIcon className="mr-1.5 h-4 w-4" />
                  {submitting ? t("submitting") : t("submitTicket")}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </PageContent>
    </>
  );
}
