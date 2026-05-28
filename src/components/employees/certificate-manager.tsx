"use client";

import { useState, useEffect, useCallback, useRef } from "react";
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
  skillId: "",
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

function fmt(d: string | null): string {
  if (!d) return "–";
  return new Date(d).toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function CertificateManager({ employeeId }: { employeeId: string }) {
  const [certs, setCerts] = useState<EmployeeSkill[]>([]);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editSkillId, setEditSkillId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [uploadingFor, setUploadingFor] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadSkillId = useRef<string | null>(null);

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
    setForm(EMPTY_FORM);
    setFormError(null);
    setShowForm(true);
  }

  function openEdit(c: EmployeeSkill) {
    setEditSkillId(c.skillId);
    setForm({
      skillId: c.skillId,
      certificateNumber: c.certificateNumber ?? "",
      issuingAuthority: c.issuingAuthority ?? "",
      issuedAt: c.issuedAt ? c.issuedAt.slice(0, 10) : "",
      expiresAt: c.expiresAt ? c.expiresAt.slice(0, 10) : "",
    });
    setFormError(null);
    setShowForm(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;
    setFormError(null);
    if (!editSkillId && !form.skillId) {
      setFormError("Bitte eine Qualifikation auswählen.");
      return;
    }
    setSaving(true);
    try {
      const url = editSkillId
        ? `/api/employees/${employeeId}/skills/${editSkillId}`
        : `/api/employees/${employeeId}/skills`;
      const res = await fetch(url, {
        method: editSkillId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          skillId: form.skillId,
          certificateNumber: form.certificateNumber,
          issuingAuthority: form.issuingAuthority,
          issuedAt: form.issuedAt,
          expiresAt: form.expiresAt,
        }),
      });
      if (res.ok) {
        setShowForm(false);
        await fetchCerts();
      } else {
        const d = await res.json().catch(() => ({}));
        setFormError(d.message || d.error || "Speichern fehlgeschlagen.");
      }
    } catch {
      setFormError("Netzwerkfehler.");
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

  function triggerUpload(skillId: string) {
    uploadSkillId.current = skillId;
    fileInputRef.current?.click();
  }

  async function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    const skillId = uploadSkillId.current;
    e.target.value = "";
    if (!file || !skillId) return;
    setUploadingFor(skillId);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(
        `/api/employees/${employeeId}/skills/${skillId}/document`,
        { method: "POST", body: fd },
      );
      if (res.ok) {
        await fetchCerts();
      } else {
        const d = await res.json().catch(() => ({}));
        alert(d.message || "Upload fehlgeschlagen.");
      }
    } finally {
      setUploadingFor(null);
      uploadSkillId.current = null;
    }
  }

  async function removeDocument(skillId: string) {
    await fetch(`/api/employees/${employeeId}/skills/${skillId}/document`, {
      method: "DELETE",
    });
    fetchCerts();
  }

  const assignedIds = new Set(certs.map((c) => c.skillId));
  const availableSkills = skills.filter((s) => !assignedIds.has(s.id));

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base flex items-center gap-2">
          <ShieldCheckIcon className="h-5 w-5 text-emerald-600" />
          §34a Sachkunde &amp; Zertifikate
        </CardTitle>
        <Button size="sm" onClick={openAdd}>
          <PlusIcon className="h-4 w-4" />
          <span className="hidden sm:inline">Zertifikat hinzufügen</span>
        </Button>
      </CardHeader>
      <CardContent>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/pdf,image/png,image/jpeg"
          className="hidden"
          onChange={handleFileSelected}
        />

        {loading ? (
          <div className="flex justify-center py-6">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent" />
          </div>
        ) : certs.length === 0 ? (
          <p className="py-6 text-center text-sm text-gray-400 dark:text-zinc-500">
            Noch keine Zertifikate hinterlegt. Für §34a-pflichtige Standorte ist
            ein gültiger Sachkundenachweis erforderlich.
          </p>
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
                        {status === "VALID" && (
                          <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-xs gap-1">
                            <CheckCircleIcon className="h-3 w-3" /> Gültig
                          </Badge>
                        )}
                        {status === "PERMANENT" && (
                          <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-xs gap-1">
                            <CheckCircleIcon className="h-3 w-3" /> Unbefristet
                          </Badge>
                        )}
                        {status === "EXPIRING" && (
                          <Badge className="bg-amber-50 text-amber-700 border-amber-200 text-xs gap-1">
                            <AlertTriangleIcon className="h-3 w-3" /> Läuft bald
                            ab
                          </Badge>
                        )}
                        {status === "EXPIRED" && (
                          <Badge className="bg-red-50 text-red-700 border-red-200 text-xs gap-1">
                            <AlertTriangleIcon className="h-3 w-3" /> Abgelaufen
                          </Badge>
                        )}
                      </div>
                      <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 text-sm text-gray-600 dark:text-zinc-400">
                        <span className="inline-flex items-center gap-1.5">
                          <HashIcon className="h-3.5 w-3.5 shrink-0" />
                          Zert.-Nr.: {c.certificateNumber || "–"}
                        </span>
                        <span>Aussteller: {c.issuingAuthority || "–"}</span>
                        <span>Ausgestellt: {fmt(c.issuedAt)}</span>
                        <span>Gültig bis: {fmt(c.expiresAt)}</span>
                      </div>

                      {/* Document row */}
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
                              {c.documentName || "Nachweis"}
                            </a>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 text-xs"
                              disabled={uploadingFor === c.skillId}
                              onClick={() => triggerUpload(c.skillId)}
                            >
                              Ersetzen
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 text-xs text-gray-400 hover:text-red-600"
                              onClick={() => removeDocument(c.skillId)}
                            >
                              Entfernen
                            </Button>
                          </>
                        ) : (
                          <>
                            <span className="inline-flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">
                              <AlertTriangleIcon className="h-3.5 w-3.5" />
                              Kein Nachweis hinterlegt
                            </span>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 text-xs"
                              disabled={uploadingFor === c.skillId}
                              onClick={() => triggerUpload(c.skillId)}
                            >
                              <PaperclipIcon className="h-3.5 w-3.5" />
                              {uploadingFor === c.skillId
                                ? "Lädt…"
                                : "Nachweis hochladen"}
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
        title={editSkillId ? "Zertifikat bearbeiten" : "Zertifikat hinzufügen"}
        size="md"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {!editSkillId && (
            <div className="space-y-2">
              <Label>Qualifikation *</Label>
              <select
                value={form.skillId}
                onChange={(e) =>
                  setForm((f) => ({ ...f, skillId: e.target.value }))
                }
                className="flex h-10 w-full rounded-lg border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="">Bitte auswählen…</option>
                {availableSkills.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
              {availableSkills.length === 0 && (
                <p className="text-xs text-amber-600">
                  Alle vorhandenen Qualifikationen sind bereits zugewiesen. Neue
                  Qualifikationen können unter „Qualifikationen“ angelegt
                  werden.
                </p>
              )}
            </div>
          )}

          <div className="space-y-2">
            <Label>Zertifikatsnummer</Label>
            <Input
              placeholder="z. B. SK-2024-018273"
              value={form.certificateNumber}
              onChange={(e) =>
                setForm((f) => ({ ...f, certificateNumber: e.target.value }))
              }
            />
          </div>

          <div className="space-y-2">
            <Label>Ausstellende Stelle</Label>
            <Input
              placeholder="z. B. IHK Frankfurt am Main"
              value={form.issuingAuthority}
              onChange={(e) =>
                setForm((f) => ({ ...f, issuingAuthority: e.target.value }))
              }
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Ausgestellt am</Label>
              <Input
                type="date"
                value={form.issuedAt}
                onChange={(e) =>
                  setForm((f) => ({ ...f, issuedAt: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Gültig bis</Label>
              <Input
                type="date"
                value={form.expiresAt}
                onChange={(e) =>
                  setForm((f) => ({ ...f, expiresAt: e.target.value }))
                }
              />
            </div>
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
              Abbrechen
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Speichern…" : "Speichern"}
            </Button>
          </ModalFooter>
        </form>
      </AdaptiveModal>

      <ConfirmDialog
        open={!!deleteTarget}
        title="Zertifikat entfernen?"
        message="Das Zertifikat und der hinterlegte Nachweis werden dauerhaft gelöscht."
        confirmLabel="Entfernen"
        cancelLabel="Abbrechen"
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </Card>
  );
}
