"use client";

import { useState, useEffect, useRef } from "react";
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
import {
  MAX_ATTACHMENT_BYTES,
  validateFile,
} from "@/lib/ticket-file-validation";

interface LocationItem {
  id: string;
  name: string;
}

interface CategoryDef {
  id: string;
  name: string;
  color: string | null;
  legacyEnum: string | null;
}

interface AssigneeOption {
  id: string;
  name: string | null;
  email: string;
  role?: string;
}

// Pre-built accept= string for the file input. Mirrors the backend MIME
// whitelist so browsers filter selection up front instead of rejecting
// silently after upload.
const ACCEPT_ATTR = [
  ".pdf",
  ".doc",
  ".docx",
  ".xls",
  ".xlsx",
  ".csv",
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".heic",
  ".heif",
  ".txt",
  ".md",
  ".json",
  ".xml",
  ".rtf",
  ".odt",
  ".ods",
  ".ppt",
  ".pptx",
  ".zip",
  ".7z",
  ".rar",
  ".tar",
  ".gz",
].join(",");

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export default function NewTicketPage() {
  const t = useTranslations("tickets");
  const tRoles = useTranslations("userRoles");
  const router = useRouter();

  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [categoryDefId, setCategoryDefId] = useState<string>("");
  const [categoryFallback, setCategoryFallback] = useState<string>("SONSTIGES");
  const [priority, setPriority] = useState("MITTEL");
  const [location, setLocation] = useState("");
  const [objectAddress, setObjectAddress] = useState("");
  const [assignedToId, setAssignedToId] = useState("");
  const [locations, setLocations] = useState<LocationItem[]>([]);
  const [categories, setCategories] = useState<CategoryDef[]>([]);
  const [assignees, setAssignees] = useState<AssigneeOption[]>([]);
  const [files, setFiles] = useState<File[]>([]);
  const [fileErrors, setFileErrors] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    (async () => {
      try {
        const [locRes, catRes, asRes] = await Promise.all([
          fetch("/api/locations?take=200"),
          fetch("/api/ticket-categories", { cache: "no-store" }),
          fetch("/api/tickets/assignees", { cache: "no-store" }),
        ]);
        if (locRes.ok) {
          const data = await locRes.json();
          setLocations(data.data ?? data);
        }
        if (catRes.ok) {
          const data = await catRes.json();
          setCategories(data.categories ?? []);
          // Default to "Sonstiges" if available
          const defaultCat =
            (data.categories as CategoryDef[]).find(
              (c) => c.legacyEnum === "SONSTIGES",
            ) ?? data.categories?.[0];
          if (defaultCat) {
            setCategoryDefId(defaultCat.id);
            setCategoryFallback(defaultCat.legacyEnum ?? "SONSTIGES");
          }
        }
        if (asRes.ok) {
          const data = await asRes.json();
          setAssignees(data.assignees ?? []);
        }
      } catch {
        // silent — dropdowns just stay empty
      }
    })();
  }, []);

  function handleFiles(selected: FileList | null) {
    if (!selected || selected.length === 0) return;
    const errs: string[] = [];
    const next: File[] = [...files];
    for (const f of Array.from(selected)) {
      const v = validateFile({ name: f.name, type: f.type, size: f.size });
      if (!v.ok) {
        errs.push(`${f.name}: ${v.message ?? t("attachmentRejected")}`);
        continue;
      }
      if (next.length >= 20) {
        errs.push(t("attachmentTooMany"));
        break;
      }
      if (
        next.some(
          (existing) => existing.name === f.name && existing.size === f.size,
        )
      ) {
        continue;
      }
      next.push(f);
    }
    setFiles(next);
    setFileErrors(errs);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function removeFile(idx: number) {
    setFiles((prev) => prev.filter((_, i) => i !== idx));
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const payload: Record<string, unknown> = {
        subject,
        description,
        category: categoryFallback,
        priority,
        location: location || undefined,
        objectAddress: objectAddress || undefined,
        assignedToId: assignedToId || undefined,
      };
      if (categoryDefId) payload.categoryDefId = categoryDefId;

      let res: Response;
      if (files.length > 0) {
        const form = new FormData();
        form.append("payload", JSON.stringify(payload));
        for (const f of files) form.append("file", f);
        res = await fetch("/api/tickets", { method: "POST", body: form });
      } else {
        res = await fetch("/api/tickets", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }

      const data = await res.json();
      if (res.ok) {
        router.push(`/tickets/${data.id}`);
      } else {
        setError(data.message ?? data.error ?? t("createError"));
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
          className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 dark:text-zinc-400 dark:hover:text-zinc-200 mb-2"
        >
          <ArrowLeftIcon className="h-4 w-4" />
          {t("backToList")}
        </button>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 mb-4 dark:border-red-800 dark:bg-red-950/50 dark:text-red-400">
            {error}
          </div>
        )}

        <Card>
          <CardHeader>
            <CardTitle>{t("newTicket")}</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
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
                    value={categoryDefId}
                    onChange={(e) => {
                      setCategoryDefId(e.target.value);
                      const c = categories.find((x) => x.id === e.target.value);
                      setCategoryFallback(c?.legacyEnum ?? "SONSTIGES");
                    }}
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
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

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <Label htmlFor="location">{t("location")}</Label>
                  <Select
                    id="location"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                  >
                    <option value="">{t("noLocation")}</option>
                    {locations.map((loc) => (
                      <option key={loc.id} value={loc.name}>
                        {loc.name}
                      </option>
                    ))}
                  </Select>
                </div>
                <div>
                  <Label htmlFor="objectAddress">{t("objectAddress")}</Label>
                  <Input
                    id="objectAddress"
                    value={objectAddress}
                    onChange={(e) => setObjectAddress(e.target.value)}
                    placeholder={t("objectAddressPlaceholder")}
                    maxLength={300}
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="assignedToId">{t("assignTo")}</Label>
                <Select
                  id="assignedToId"
                  value={assignedToId}
                  onChange={(e) => setAssignedToId(e.target.value)}
                >
                  <option value="">{t("noAssignee")}</option>
                  {assignees.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name || a.email}
                      {a.role ? ` · ${tRoles(a.role)}` : ""}
                    </option>
                  ))}
                </Select>
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
                  className="w-full rounded-lg border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-3 text-sm text-gray-900 dark:text-zinc-100 placeholder:text-gray-400 dark:placeholder:text-zinc-500 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 focus:outline-none resize-none"
                />
                {description.length > 0 && description.length < 10 && (
                  <p className="mt-1 text-xs text-amber-600">
                    {t("descriptionMinHint", {
                      remaining: 10 - description.length,
                    })}
                  </p>
                )}
              </div>

              {/* ── Attachments ── */}
              <div>
                <Label>{t("attachmentsLabel")}</Label>
                <div className="mt-1.5 rounded-xl border-2 border-dashed border-gray-300 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-900/40 p-4 text-center transition-colors hover:border-emerald-400 dark:hover:border-emerald-700">
                  <input
                    ref={fileInputRef}
                    id="ticket-files"
                    type="file"
                    multiple
                    accept={ACCEPT_ATTR}
                    onChange={(e) => handleFiles(e.target.files)}
                    className="hidden"
                  />
                  <label
                    htmlFor="ticket-files"
                    className="inline-block cursor-pointer text-sm font-medium text-emerald-700 dark:text-emerald-400 hover:underline"
                  >
                    {t("attachmentSelect")}
                  </label>
                  <p className="mt-1 text-xs text-gray-500 dark:text-zinc-400">
                    {t("attachmentHint", {
                      max: Math.round(MAX_ATTACHMENT_BYTES / 1024 / 1024),
                    })}
                  </p>
                </div>
                {fileErrors.length > 0 && (
                  <ul className="mt-2 space-y-1 text-xs text-red-600 dark:text-red-400">
                    {fileErrors.map((err, i) => (
                      <li key={i}>• {err}</li>
                    ))}
                  </ul>
                )}
                {files.length > 0 && (
                  <ul className="mt-2 space-y-1">
                    {files.map((f, i) => (
                      <li
                        key={`${f.name}-${i}`}
                        className="flex items-center justify-between rounded-lg bg-emerald-50 dark:bg-emerald-950/30 px-3 py-2 text-sm text-emerald-900 dark:text-emerald-200"
                      >
                        <span className="truncate">
                          {f.name}{" "}
                          <span className="text-xs text-emerald-700 dark:text-emerald-400">
                            ({formatBytes(f.size)})
                          </span>
                        </span>
                        <button
                          type="button"
                          onClick={() => removeFile(i)}
                          className="ml-2 text-xs font-medium text-emerald-700 hover:text-emerald-900 dark:text-emerald-300"
                        >
                          {t("attachmentRemove")}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {subject.length > 0 && subject.length < 3 && (
                <p className="text-xs text-amber-600">
                  {t("subjectMinHint", { remaining: 3 - subject.length })}
                </p>
              )}

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
                  <SendIcon className="h-4 w-4" />
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
