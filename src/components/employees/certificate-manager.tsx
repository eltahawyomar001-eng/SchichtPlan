"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useTranslations } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { AdaptiveModal, ModalFooter } from "@/components/ui/adaptive-modal";
import {
  ShieldCheckIcon,
  PlusIcon,
  EditIcon,
  TrashIcon,
  PaperclipIcon,
  DownloadIcon,
  CheckCircleIcon,
  AlertTriangleIcon,
  HashIcon,
} from "@/components/icons";

interface EmployeeSkill {
  id: string;
  skillId: string;
  expiresAt: string | null;
  issuedAt: string | null;
  certificateNumber: string | null;
  issuingAuthority: string | null;
  documentUrl: string | null;
  documentName: string | null;
  skill: { id: string; name: string; category: string | null };
}

interface Skill {
  id: string;
  name: string;
  category: string | null;
}

const EMPTY_FORM = {
  skillName: "",
  certificateNumber: "",
  issuingAuthority: "",
  issuedAt: "",
  expiresAt: "",
};

type CertStatus = "VALID" | "EXPIRING" | "EXPIRED" | "PERMANENT";

function certStatus(expiresAt: string | null): CertStatus {
  if (!expiresAt) return "PERMANENT";
  const exp = new Date(expiresAt);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (exp < today) return "EXPIRED";
  const in30 = new Date(today);
  in30.setDate(in30.getDate() + 30);
  if (exp <= in30) return "EXPIRING";
  return "VALID";
}

export function CertificateManager({ employeeId }: { employeeId: string }) {
  const t = useTranslations("certificates");
  const tc = useTranslations("common");

  const [certs, setCerts] = useState<EmployeeSkill[]>([]);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editSkillId, setEditSkillId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [form, setForm] = useState(EMPTY_FORM);
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [uploadingFor, setUploadingFor] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const replaceInputRef = useRef<HTMLInputElement>(null);
  const replaceSkillId = useRef<string | null>(null);

  function fmt(d: string | null): string {
    if (!d) return "–";
    return new Date(d).toLocaleDateString("de-DE", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  }

  const fetchCerts = useCallback(async () => {
    try {
      const res = await fetch(`/api/employees/${employeeId}/skills`);
      if (res.ok) setCerts(await res.json());
    } finally {
      setLoading(false);
    }
  }, [employeeId]);

  const fetchSkills = useCallback(async () => {
    const res = await fetch("/api/skills");
    if (res.ok) {
      const d = await res.json();
      setSkills(d.data ?? d);
    }
  }, []);

  useEffect(() => {
    fetchCerts();
    fetchSkills();
  }, [fetchCerts, fetchSkills]);

  function openAdd() {
    setEditSkillId(null);
    setEditName("");
    setForm(EMPTY_FORM);
    setFile(null);
    setFormError(null);
    setShowForm(true);
  }

  function openEdit(c: EmployeeSkill) {
    setEditSkillId(c.skillId);
    setEditName(c.skill.name);
    setForm({
      skillName: c.skill.name,
      certificateNumber: c.certificateNumber ?? "",
      issuingAuthority: c.issuingAuthority ?? "",
      issuedAt: c.issuedAt ? c.issuedAt.slice(0, 10) : "",
      expiresAt: c.expiresAt ? c.expiresAt.slice(0, 10) : "",
    });
    setFile(null);
    setFormError(null);
    setShowForm(true);
  }

  /** Resolve an existing skill by name (case-insensitive) or create it. */
  async function resolveSkillId(name: string): Promise<string | null> {
    const trimmed = name.trim();
    const existing = skills.find(
      (s) => s.name.toLowerCase() === trimmed.toLowerCase(),
    );
    if (existing) return existing.id;
    // Create the qualification on the fly.
    const res = await fetch("/api/skills", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: trimmed, category: "§34a" }),
    });
    if (res.ok) {
      const created = await res.json();
      await fetchSkills();
      return created.id ?? null;
    }
    // Likely a duplicate created elsewhere — refetch and match.
    const r2 = await fetch("/api/skills");
    if (r2.ok) {
      const d = await r2.json();
      const list: Skill[] = d.data ?? d;
      const match = list.find(
        (s) => s.name.toLowerCase() === trimmed.toLowerCase(),
      );
      if (match) return match.id;
    }
    return null;
  }

  async function uploadDocument(skillId: string, f: File): Promise<boolean> {
    const fd = new FormData();
    fd.append("file", f);
    const res = await fetch(
      `/api/employees/${employeeId}/skills/${skillId}/document`,
      { method: "POST", body: fd },
    );
    return res.ok;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;
    setFormError(null);
    if (!editSkillId && !form.skillName.trim()) {
      setFormError(t("qualificationRequired"));
      return;
    }
    setSaving(true);
    try {
      let skillId = editSkillId;

      if (editSkillId) {
        const res = await fetch(
          `/api/employees/${employeeId}/skills/${editSkillId}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              certificateNumber: form.certificateNumber,
              issuingAuthority: form.issuingAuthority,
              issuedAt: form.issuedAt,
              expiresAt: form.expiresAt,
            }),
          },
        );
        if (!res.ok) {
          const d = await res.json().catch(() => ({}));
          setFormError(d.message || d.error || t("errorSave"));
          return;
        }
      } else {
        skillId = await resolveSkillId(form.skillName);
        if (!skillId) {
          setFormError(t("errorSave"));
          return;
        }
        const res = await fetch(`/api/employees/${employeeId}/skills`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            skillId,
            certificateNumber: form.certificateNumber,
            issuingAuthority: form.issuingAuthority,
            issuedAt: form.issuedAt,
            expiresAt: form.expiresAt,
          }),
        });
        if (!res.ok) {
          const d = await res.json().catch(() => ({}));
          setFormError(d.message || d.error || t("errorAlreadyAssigned"));
          return;
        }
      }

      if (file && skillId) {
        const ok = await uploadDocument(skillId, file);
        if (!ok) {
          setFormError(t("errorUpload"));
          await fetchCerts();
          return;
        }
      }

      setShowForm(false);
      setFile(null);
      await fetchCerts();
    } catch {
      setFormError(t("errorNetwork"));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    await fetch(`/api/employees/${employeeId}/skills/${deleteTarget}`, {
      method: "DELETE",
    });
    setDeleteTarget(null);
    fetchCerts();
  }

  function triggerReplace(skillId: string) {
    replaceSkillId.current = skillId;
    replaceInputRef.current?.click();
  }

  async function handleReplaceSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    const skillId = replaceSkillId.current;
    e.target.value = "";
    if (!f || !skillId) return;
    setUploadingFor(skillId);
    try {
      await uploadDocument(skillId, f);
      await fetchCerts();
    } finally {
      setUploadingFor(null);
      replaceSkillId.current = null;
    }
  }

  async function removeDocument(skillId: string) {
    await fetch(`/api/employees/${employeeId}/skills/${skillId}/document`, {
      method: "DELETE",
    });
    fetchCerts();
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base flex items-center gap-2">
          <ShieldCheckIcon className="h-5 w-5 text-emerald-600" />
          {t("title")}
        </CardTitle>
        <Button size="sm" onClick={openAdd}>
          <PlusIcon className="h-4 w-4" />
          <span className="hidden sm:inline">{t("add")}</span>
        </Button>
      </CardHeader>
      <CardContent>
        <input
          ref={replaceInputRef}
          type="file"
          accept="application/pdf,image/png,image/jpeg"
          className="hidden"
          onChange={handleReplaceSelected}
        />

        {loading ? (
          <div className="flex justify-center py-6">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent" />
          </div>
        ) : certs.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <ShieldCheckIcon className="h-10 w-10 text-gray-300 dark:text-zinc-600" />
            <p className="max-w-md text-sm text-gray-500 dark:text-zinc-400">
              {t("empty")}
            </p>
            <Button onClick={openAdd}>
              <PlusIcon className="h-4 w-4" />
              {t("addFirst")}
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {certs.map((c) => {
              const status = certStatus(c.expiresAt);
              return (
                <div
                  key={c.id}
                  className="rounded-xl border border-gray-200 dark:border-zinc-700 p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-gray-900 dark:text-zinc-100">
                          {c.skill.name}
                        </span>
                        {(status === "VALID" || status === "PERMANENT") && (
                          <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-xs gap-1">
                            <CheckCircleIcon className="h-3 w-3" />
                            {status === "PERMANENT"
                              ? t("statusPermanent")
                              : t("statusValid")}
                          </Badge>
                        )}
                        {status === "EXPIRING" && (
                          <Badge className="bg-amber-50 text-amber-700 border-amber-200 text-xs gap-1">
                            <AlertTriangleIcon className="h-3 w-3" />
                            {t("statusExpiring")}
                          </Badge>
                        )}
                        {status === "EXPIRED" && (
                          <Badge className="bg-red-50 text-red-700 border-red-200 text-xs gap-1">
                            <AlertTriangleIcon className="h-3 w-3" />
                            {t("statusExpired")}
                          </Badge>
                        )}
                      </div>
                      <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 text-sm text-gray-600 dark:text-zinc-400">
                        <span className="inline-flex items-center gap-1.5">
                          <HashIcon className="h-3.5 w-3.5 shrink-0" />
                          {t("certNumber")}: {c.certificateNumber || "–"}
                        </span>
                        <span>
                          {t("issuer")}: {c.issuingAuthority || "–"}
                        </span>
                        <span>
                          {t("issuedOn")}: {fmt(c.issuedAt)}
                        </span>
                        <span>
                          {t("validUntil")}: {fmt(c.expiresAt)}
                        </span>
                      </div>

                      <div className="mt-3 flex items-center gap-2 flex-wrap">
                        {c.documentUrl ? (
                          <>
                            <a
                              href={c.documentUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-100"
                            >
                              <DownloadIcon className="h-3.5 w-3.5" />
                              {c.documentName || t("document")}
                            </a>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 text-xs"
                              disabled={uploadingFor === c.skillId}
                              onClick={() => triggerReplace(c.skillId)}
                            >
                              {t("replace")}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 text-xs text-gray-400 hover:text-red-600"
                              onClick={() => removeDocument(c.skillId)}
                            >
                              {t("remove")}
                            </Button>
                          </>
                        ) : (
                          <>
                            <span className="inline-flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">
                              <AlertTriangleIcon className="h-3.5 w-3.5" />
                              {t("noDocument")}
                            </span>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 text-xs"
                              disabled={uploadingFor === c.skillId}
                              onClick={() => triggerReplace(c.skillId)}
                            >
                              <PaperclipIcon className="h-3.5 w-3.5" />
                              {uploadingFor === c.skillId
                                ? t("uploading")
                                : t("uploadProof")}
                            </Button>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="flex gap-1 shrink-0">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openEdit(c)}
                      >
                        <EditIcon className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-gray-400 hover:text-red-600"
                        onClick={() => setDeleteTarget(c.skillId)}
                      >
                        <TrashIcon className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>

      {/* Add / Edit modal */}
      <AdaptiveModal
        open={showForm}
        onClose={() => setShowForm(false)}
        title={editSkillId ? t("editTitle") : t("addTitle")}
        size="md"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>{t("qualification")} *</Label>
            {editSkillId ? (
              <Input value={editName} disabled />
            ) : (
              <>
                <Input
                  list="cert-skill-suggestions"
                  placeholder={t("qualificationPlaceholder")}
                  value={form.skillName}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, skillName: e.target.value }))
                  }
                />
                <datalist id="cert-skill-suggestions">
                  {skills.map((s) => (
                    <option key={s.id} value={s.name} />
                  ))}
                </datalist>
                <p className="text-xs text-gray-400 dark:text-zinc-500">
                  {t("qualificationHint")}
                </p>
              </>
            )}
          </div>

          <div className="space-y-2">
            <Label>{t("certNumber")}</Label>
            <Input
              placeholder={t("certNumberPlaceholder")}
              value={form.certificateNumber}
              onChange={(e) =>
                setForm((f) => ({ ...f, certificateNumber: e.target.value }))
              }
            />
          </div>

          <div className="space-y-2">
            <Label>{t("issuer")}</Label>
            <Input
              placeholder={t("issuerPlaceholder")}
              value={form.issuingAuthority}
              onChange={(e) =>
                setForm((f) => ({ ...f, issuingAuthority: e.target.value }))
              }
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>{t("issuedOn")}</Label>
              <Input
                type="date"
                value={form.issuedAt}
                onChange={(e) =>
                  setForm((f) => ({ ...f, issuedAt: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>{t("validUntil")}</Label>
              <Input
                type="date"
                value={form.expiresAt}
                onChange={(e) =>
                  setForm((f) => ({ ...f, expiresAt: e.target.value }))
                }
              />
            </div>
          </div>

          {/* Document upload — in the same dialog */}
          <div className="space-y-2">
            <Label>{t("fileLabel")}</Label>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf,image/png,image/jpeg"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="block w-full text-sm text-gray-600 dark:text-zinc-400 file:mr-3 file:rounded-lg file:border-0 file:bg-emerald-50 file:px-3 file:py-2 file:text-sm file:font-medium file:text-emerald-700 hover:file:bg-emerald-100"
            />
            <p className="text-xs text-gray-400 dark:text-zinc-500">
              {file ? file.name : t("fileHint")}
            </p>
          </div>

          {formError && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
              {formError}
            </div>
          )}

          <ModalFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowForm(false)}
            >
              {tc("cancel")}
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? tc("saving") : tc("save")}
            </Button>
          </ModalFooter>
        </form>
      </AdaptiveModal>

      <ConfirmDialog
        open={!!deleteTarget}
        title={t("deleteTitle")}
        message={t("deleteMessage")}
        confirmLabel={tc("delete")}
        cancelLabel={tc("cancel")}
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </Card>
  );
}
