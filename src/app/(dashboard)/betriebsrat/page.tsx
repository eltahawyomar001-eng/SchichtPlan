"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { Topbar } from "@/components/layout/topbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { AdaptiveModal, ModalFooter } from "@/components/ui/adaptive-modal";
import { PageContent } from "@/components/ui/page-content";
import {
  ScaleIcon,
  PlusIcon,
  TrashIcon,
  CheckCircleIcon,
  CircleXIcon,
  ClockIcon,
  AlertTriangleIcon,
  UsersIcon,
} from "@/components/icons";

interface Approval {
  id: string;
  title: string;
  periodStart: string;
  periodEnd: string;
  locationId: string | null;
  shiftCount: number;
  status: "PENDING" | "APPROVED" | "REJECTED" | "WITHDRAWN";
  deadline: string;
  decisionNote: string | null;
  reviewedAt: string | null;
  createdAt: string;
  submittedBy: { id: string; name: string | null; email: string };
  reviewedBy: { id: string; name: string | null } | null;
}

interface Member {
  id: string;
  isChair: boolean;
  createdAt: string;
  user: { id: string; name: string | null; email: string };
}

interface TeamUser {
  id: string;
  name: string | null;
  email: string;
  role: string;
}

interface Location {
  id: string;
  name: string;
}

interface DetailShift {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  breakMinutes: number;
  status: string;
  employee: { firstName: string; lastName: string } | null;
  location: { name: string } | null;
}

function fmtDate(d: string): string {
  return new Date(d).toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function deadlineInfo(deadline: string, status: string) {
  if (status !== "PENDING") return { text: "", overdue: false, urgent: false };
  const ms = new Date(deadline).getTime() - Date.now();
  if (ms <= 0)
    return { text: "Frist überschritten", overdue: true, urgent: true };
  const days = Math.floor(ms / 86_400_000);
  const hours = Math.floor((ms % 86_400_000) / 3_600_000);
  const text =
    days > 0
      ? `${days} Tag(e) ${hours} Std. verbleibend`
      : `${hours} Std. verbleibend`;
  return { text, overdue: false, urgent: days < 1 };
}

const STATUS_BADGE: Record<Approval["status"], { label: string; cls: string }> =
  {
    PENDING: {
      label: "Ausstehend",
      cls: "bg-amber-50 text-amber-700 border-amber-200",
    },
    APPROVED: {
      label: "Zugestimmt",
      cls: "bg-emerald-50 text-emerald-700 border-emerald-200",
    },
    REJECTED: {
      label: "Verweigert",
      cls: "bg-red-50 text-red-700 border-red-200",
    },
    WITHDRAWN: {
      label: "Zurückgezogen",
      cls: "bg-gray-100 text-gray-600 border-gray-200",
    },
  };

export default function BetriebsratPage() {
  const { data: session } = useSession();
  const role = (session?.user as { role?: string } | undefined)?.role;
  const isManager = role === "OWNER" || role === "ADMIN" || role === "MANAGER";
  const isAdmin = role === "OWNER" || role === "ADMIN";

  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [canReview, setCanReview] = useState(false);
  const [members, setMembers] = useState<Member[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [team, setTeam] = useState<TeamUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Submit modal
  const [showSubmit, setShowSubmit] = useState(false);
  const [submitForm, setSubmitForm] = useState({
    title: "",
    periodStart: "",
    periodEnd: "",
    locationId: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Review modal
  const [reviewId, setReviewId] = useState<string | null>(null);
  const [reviewData, setReviewData] = useState<{
    approval: Approval;
    shifts: DetailShift[];
  } | null>(null);
  const [reviewNote, setReviewNote] = useState("");
  const [deciding, setDeciding] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);

  // Member add / remove
  const [showAddMember, setShowAddMember] = useState(false);
  const [newMemberId, setNewMemberId] = useState("");
  const [newMemberChair, setNewMemberChair] = useState(false);
  const [removeMemberId, setRemoveMemberId] = useState<string | null>(null);
  const [withdrawId, setWithdrawId] = useState<string | null>(null);

  const fetchApprovals = useCallback(async () => {
    try {
      const res = await fetch("/api/betriebsrat/approvals");
      if (res.ok) {
        const d = await res.json();
        setApprovals(d.approvals ?? []);
        setCanReview(Boolean(d.canReview));
      } else {
        setError("Kein Zugriff auf den Betriebsrat-Bereich.");
      }
    } catch {
      setError("Netzwerkfehler.");
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchSupporting = useCallback(async () => {
    const [m, l, tm] = await Promise.all([
      fetch("/api/betriebsrat/members").then((r) => (r.ok ? r.json() : [])),
      fetch("/api/locations").then((r) => (r.ok ? r.json() : [])),
      isAdmin
        ? fetch("/api/team").then((r) => (r.ok ? r.json() : { data: [] }))
        : Promise.resolve({ data: [] }),
    ]);
    setMembers(Array.isArray(m) ? m : []);
    setLocations(l.data ?? l ?? []);
    setTeam(tm.data ?? tm ?? []);
  }, [isAdmin]);

  useEffect(() => {
    fetchApprovals();
    fetchSupporting();
  }, [fetchApprovals, fetchSupporting]);

  async function handleSubmitPlan(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setSubmitError(null);
    if (!submitForm.title || !submitForm.periodStart || !submitForm.periodEnd) {
      setSubmitError("Titel und Zeitraum sind erforderlich.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/betriebsrat/approvals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(submitForm),
      });
      if (res.ok) {
        setShowSubmit(false);
        setSubmitForm({
          title: "",
          periodStart: "",
          periodEnd: "",
          locationId: "",
        });
        fetchApprovals();
      } else {
        const d = await res.json().catch(() => ({}));
        setSubmitError(d.message || d.error || "Fehler beim Vorlegen.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function openReview(id: string) {
    setReviewId(id);
    setReviewData(null);
    setReviewNote("");
    setReviewError(null);
    const res = await fetch(`/api/betriebsrat/approvals/${id}`);
    if (res.ok) {
      const d = await res.json();
      setReviewData({ approval: d.approval, shifts: d.shifts });
    } else {
      setReviewError("Vorlage konnte nicht geladen werden.");
    }
  }

  async function decide(decision: "APPROVED" | "REJECTED") {
    if (!reviewId || deciding) return;
    setReviewError(null);
    if (decision === "REJECTED" && !reviewNote.trim()) {
      setReviewError(
        "Bei einer Verweigerung ist eine Begründung erforderlich.",
      );
      return;
    }
    setDeciding(true);
    try {
      const res = await fetch(`/api/betriebsrat/approvals/${reviewId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision, note: reviewNote }),
      });
      if (res.ok) {
        setReviewId(null);
        setReviewData(null);
        fetchApprovals();
      } else {
        const d = await res.json().catch(() => ({}));
        setReviewError(d.message || d.error || "Entscheidung fehlgeschlagen.");
      }
    } finally {
      setDeciding(false);
    }
  }

  async function addMember(e: React.FormEvent) {
    e.preventDefault();
    if (!newMemberId) return;
    const res = await fetch("/api/betriebsrat/members", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: newMemberId, isChair: newMemberChair }),
    });
    if (res.ok) {
      setShowAddMember(false);
      setNewMemberId("");
      setNewMemberChair(false);
      fetchSupporting();
    }
  }

  async function handleRemoveMember() {
    if (!removeMemberId) return;
    await fetch(`/api/betriebsrat/members/${removeMemberId}`, {
      method: "DELETE",
    });
    setRemoveMemberId(null);
    fetchSupporting();
  }

  async function handleWithdraw() {
    if (!withdrawId) return;
    await fetch(`/api/betriebsrat/approvals/${withdrawId}`, {
      method: "DELETE",
    });
    setWithdrawId(null);
    fetchApprovals();
  }

  const memberUserIds = new Set(members.map((m) => m.user.id));
  const eligibleTeam = team.filter((u) => !memberUserIds.has(u.id));

  return (
    <div>
      <Topbar
        title="Betriebsrat"
        description="Mitbestimmung bei Dienstplänen (BetrVG §87)"
        actions={
          isManager ? (
            <Button size="sm" onClick={() => setShowSubmit(true)}>
              <PlusIcon className="h-4 w-4" />
              <span className="hidden sm:inline">Dienstplan vorlegen</span>
            </Button>
          ) : undefined
        }
      />

      <PageContent className="max-w-5xl">
        {/* Intro */}
        <Card>
          <CardContent className="p-4 sm:p-5 flex items-start gap-3">
            <ScaleIcon className="h-6 w-6 text-emerald-600 shrink-0 mt-0.5" />
            <p className="text-sm text-gray-600 dark:text-zinc-400 leading-relaxed">
              Nach <strong>BetrVG §87 Abs. 1</strong> hat der Betriebsrat ein
              Mitbestimmungsrecht bei Beginn und Ende der Arbeitszeit, Pausen
              und der vorübergehenden Verkürzung oder Verlängerung der
              Arbeitszeit. Vorgelegte Dienstpläne sind innerhalb der Frist zu
              bestätigen oder mit Begründung abzulehnen.
            </p>
          </CardContent>
        </Card>

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            {error}
          </div>
        )}

        {/* Approvals */}
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-600 border-t-transparent" />
          </div>
        ) : approvals.length === 0 ? (
          !error && (
            <Card>
              <CardContent className="py-12 text-center text-sm text-gray-400 dark:text-zinc-500">
                Aktuell liegen keine Dienstpläne zur Mitbestimmung vor.
              </CardContent>
            </Card>
          )
        ) : (
          <div className="space-y-3">
            {approvals.map((a) => {
              const dl = deadlineInfo(a.deadline, a.status);
              const badge = STATUS_BADGE[a.status];
              return (
                <Card key={a.id} className="card-elevated">
                  <CardContent className="p-4 sm:p-5">
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-semibold text-gray-900 dark:text-zinc-100">
                            {a.title}
                          </h3>
                          <Badge className={`text-xs border ${badge.cls}`}>
                            {badge.label}
                          </Badge>
                          {dl.overdue && (
                            <Badge className="text-xs border bg-red-100 text-red-700 border-red-300 gap-1">
                              <AlertTriangleIcon className="h-3 w-3" />
                              Überfällig
                            </Badge>
                          )}
                        </div>
                        <div className="mt-1.5 text-sm text-gray-500 dark:text-zinc-400 space-y-0.5">
                          <p>
                            Zeitraum: {fmtDate(a.periodStart)} –{" "}
                            {fmtDate(a.periodEnd)} · {a.shiftCount} Schichten
                          </p>
                          <p>
                            Vorgelegt von{" "}
                            {a.submittedBy.name || a.submittedBy.email}
                          </p>
                          {a.status === "PENDING" && (
                            <p
                              className={`inline-flex items-center gap-1.5 ${dl.urgent ? "text-red-600 font-medium" : ""}`}
                            >
                              <ClockIcon className="h-3.5 w-3.5" />
                              Frist: {fmtDate(a.deadline)} · {dl.text}
                            </p>
                          )}
                          {a.reviewedBy && a.reviewedAt && (
                            <p>
                              Entschieden von {a.reviewedBy.name} am{" "}
                              {fmtDate(a.reviewedAt)}
                            </p>
                          )}
                          {a.decisionNote && (
                            <p className="italic text-gray-600 dark:text-zinc-300">
                              „{a.decisionNote}“
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2 shrink-0">
                        {canReview && a.status === "PENDING" ? (
                          <Button size="sm" onClick={() => openReview(a.id)}>
                            Prüfen &amp; Entscheiden
                          </Button>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openReview(a.id)}
                          >
                            Ansehen
                          </Button>
                        )}
                        {isManager && a.status === "PENDING" && !canReview && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-gray-400 hover:text-red-600"
                            onClick={() => setWithdrawId(a.id)}
                          >
                            Zurückziehen
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Member management (admins) */}
        {isAdmin && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <UsersIcon className="h-5 w-5 text-emerald-600" />
                Betriebsratsmitglieder
              </CardTitle>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowAddMember(true)}
              >
                <PlusIcon className="h-4 w-4" />
                Mitglied
              </Button>
            </CardHeader>
            <CardContent>
              {members.length === 0 ? (
                <p className="py-4 text-center text-sm text-gray-400 dark:text-zinc-500">
                  Noch keine Mitglieder benannt. Ohne Mitglieder kann kein
                  Dienstplan bestätigt werden.
                </p>
              ) : (
                <div className="space-y-2">
                  {members.map((m) => (
                    <div
                      key={m.id}
                      className="flex items-center justify-between rounded-lg border border-gray-100 dark:border-zinc-800 px-3 py-2"
                    >
                      <div className="text-sm">
                        <span className="font-medium text-gray-900 dark:text-zinc-100">
                          {m.user.name || m.user.email}
                        </span>
                        {m.isChair && (
                          <Badge className="ml-2 text-xs bg-emerald-50 text-emerald-700 border-emerald-200">
                            Vorsitz
                          </Badge>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-gray-400 hover:text-red-600"
                        onClick={() => setRemoveMemberId(m.id)}
                      >
                        <TrashIcon className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </PageContent>

      {/* ── Submit modal ── */}
      <AdaptiveModal
        open={showSubmit}
        onClose={() => setShowSubmit(false)}
        title="Dienstplan zur Mitbestimmung vorlegen"
        size="md"
      >
        <form onSubmit={handleSubmitPlan} className="space-y-4">
          <div className="space-y-2">
            <Label>Bezeichnung *</Label>
            <Input
              placeholder="z. B. Dienstplan KW 23 – Objekt Nord"
              value={submitForm.title}
              onChange={(e) =>
                setSubmitForm((f) => ({ ...f, title: e.target.value }))
              }
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Von *</Label>
              <Input
                type="date"
                value={submitForm.periodStart}
                onChange={(e) =>
                  setSubmitForm((f) => ({ ...f, periodStart: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Bis *</Label>
              <Input
                type="date"
                value={submitForm.periodEnd}
                onChange={(e) =>
                  setSubmitForm((f) => ({ ...f, periodEnd: e.target.value }))
                }
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Standort (optional)</Label>
            <Select
              value={submitForm.locationId}
              onChange={(e) =>
                setSubmitForm((f) => ({ ...f, locationId: e.target.value }))
              }
            >
              <option value="">Alle Standorte</option>
              {locations.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </Select>
          </div>
          {submitError && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
              {submitError}
            </div>
          )}
          <ModalFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowSubmit(false)}
            >
              Abbrechen
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Wird vorgelegt…" : "Vorlegen"}
            </Button>
          </ModalFooter>
        </form>
      </AdaptiveModal>

      {/* ── Review modal ── */}
      <AdaptiveModal
        open={!!reviewId}
        onClose={() => setReviewId(null)}
        title={reviewData?.approval.title || "Dienstplan prüfen"}
        size="lg"
      >
        {!reviewData ? (
          <div className="flex justify-center py-8">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent" />
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-gray-500 dark:text-zinc-400">
              Zeitraum: {fmtDate(reviewData.approval.periodStart)} –{" "}
              {fmtDate(reviewData.approval.periodEnd)} ·{" "}
              {reviewData.shifts.length} Schichten
            </p>

            <div className="max-h-72 overflow-y-auto rounded-xl border border-gray-100 dark:border-zinc-800">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-gray-50 dark:bg-zinc-800/80">
                  <tr className="text-left text-gray-500 dark:text-zinc-400">
                    <th className="px-3 py-2 font-medium">Datum</th>
                    <th className="px-3 py-2 font-medium">Zeit</th>
                    <th className="px-3 py-2 font-medium">Pause</th>
                    <th className="px-3 py-2 font-medium">Mitarbeiter</th>
                    <th className="px-3 py-2 font-medium">Standort</th>
                  </tr>
                </thead>
                <tbody className="divide-y dark:divide-zinc-800">
                  {reviewData.shifts.length === 0 ? (
                    <tr>
                      <td
                        colSpan={5}
                        className="px-3 py-6 text-center text-gray-400"
                      >
                        Keine Schichten im Zeitraum.
                      </td>
                    </tr>
                  ) : (
                    reviewData.shifts.map((s) => (
                      <tr key={s.id}>
                        <td className="px-3 py-2 whitespace-nowrap">
                          {fmtDate(s.date)}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap">
                          {s.startTime}–{s.endTime}
                        </td>
                        <td className="px-3 py-2">{s.breakMinutes} min</td>
                        <td className="px-3 py-2">
                          {s.employee
                            ? `${s.employee.firstName} ${s.employee.lastName}`
                            : "—"}
                        </td>
                        <td className="px-3 py-2">{s.location?.name || "—"}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {canReview && reviewData.approval.status === "PENDING" ? (
              <>
                <div className="space-y-2">
                  <Label>Anmerkung / Begründung</Label>
                  <textarea
                    value={reviewNote}
                    onChange={(e) => setReviewNote(e.target.value)}
                    rows={3}
                    placeholder="Bei Verweigerung erforderlich…"
                    className="w-full rounded-lg border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                {reviewError && (
                  <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                    {reviewError}
                  </div>
                )}
                <ModalFooter>
                  <Button
                    type="button"
                    variant="outline"
                    className="text-red-600 border-red-200 hover:bg-red-50"
                    disabled={deciding}
                    onClick={() => decide("REJECTED")}
                  >
                    <CircleXIcon className="h-4 w-4" />
                    Zustimmung verweigern
                  </Button>
                  <Button
                    type="button"
                    disabled={deciding}
                    onClick={() => decide("APPROVED")}
                  >
                    <CheckCircleIcon className="h-4 w-4" />
                    Zustimmen
                  </Button>
                </ModalFooter>
              </>
            ) : (
              <p className="text-sm text-gray-500 dark:text-zinc-400">
                Status: {STATUS_BADGE[reviewData.approval.status].label}
                {reviewData.approval.decisionNote &&
                  ` — „${reviewData.approval.decisionNote}“`}
              </p>
            )}
          </div>
        )}
      </AdaptiveModal>

      {/* ── Add member modal ── */}
      <AdaptiveModal
        open={showAddMember}
        onClose={() => setShowAddMember(false)}
        title="Betriebsratsmitglied benennen"
        size="md"
      >
        <form onSubmit={addMember} className="space-y-4">
          <div className="space-y-2">
            <Label>Benutzer *</Label>
            <Select
              value={newMemberId}
              onChange={(e) => setNewMemberId(e.target.value)}
            >
              <option value="">Bitte auswählen…</option>
              {eligibleTeam.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name || u.email} ({u.role})
                </option>
              ))}
            </Select>
            {eligibleTeam.length === 0 && (
              <p className="text-xs text-amber-600">
                Keine weiteren Benutzer verfügbar.
              </p>
            )}
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={newMemberChair}
              onChange={(e) => setNewMemberChair(e.target.checked)}
              className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
            />
            Vorsitzende:r des Betriebsrats
          </label>
          <ModalFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowAddMember(false)}
            >
              Abbrechen
            </Button>
            <Button type="submit" disabled={!newMemberId}>
              Benennen
            </Button>
          </ModalFooter>
        </form>
      </AdaptiveModal>

      <ConfirmDialog
        open={!!removeMemberId}
        title="Mitglied entfernen?"
        message="Der Benutzer verliert den Zugriff auf den Betriebsrat-Bereich."
        confirmLabel="Entfernen"
        cancelLabel="Abbrechen"
        variant="danger"
        onConfirm={handleRemoveMember}
        onCancel={() => setRemoveMemberId(null)}
      />

      <ConfirmDialog
        open={!!withdrawId}
        title="Vorlage zurückziehen?"
        message="Der Dienstplan wird aus der Mitbestimmung zurückgezogen."
        confirmLabel="Zurückziehen"
        cancelLabel="Abbrechen"
        variant="danger"
        onConfirm={handleWithdraw}
        onCancel={() => setWithdrawId(null)}
      />
    </div>
  );
}
