"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useTranslations } from "next-intl";
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

const STATUS_CLS: Record<Approval["status"], string> = {
  PENDING: "bg-amber-50 text-amber-700 border-amber-200",
  APPROVED: "bg-emerald-50 text-emerald-700 border-emerald-200",
  REJECTED: "bg-red-50 text-red-700 border-red-200",
  WITHDRAWN: "bg-gray-100 text-gray-600 border-gray-200",
};

const STATUS_KEY: Record<Approval["status"], string> = {
  PENDING: "statusPending",
  APPROVED: "statusApproved",
  REJECTED: "statusRejected",
  WITHDRAWN: "statusWithdrawn",
};

export default function BetriebsratPage() {
  const t = useTranslations("betriebsrat");
  const tc = useTranslations("common");
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

  function deadlineInfo(deadline: string, status: string) {
    if (status !== "PENDING")
      return { text: "", overdue: false, urgent: false };
    const ms = new Date(deadline).getTime() - Date.now();
    if (ms <= 0)
      return { text: t("deadlineExceeded"), overdue: true, urgent: true };
    const days = Math.floor(ms / 86_400_000);
    const hours = Math.floor((ms % 86_400_000) / 3_600_000);
    const text =
      days > 0
        ? t("daysHoursLeft", { days, hours })
        : t("hoursLeft", { hours });
    return { text, overdue: false, urgent: days < 1 };
  }

  const fetchApprovals = useCallback(async () => {
    try {
      const res = await fetch("/api/betriebsrat/approvals");
      if (res.ok) {
        const d = await res.json();
        setApprovals(d.approvals ?? []);
        setCanReview(Boolean(d.canReview));
      } else {
        setError(t("noAccess"));
      }
    } catch {
      setError(t("networkError"));
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      setSubmitError(t("titleAndPeriodRequired"));
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
        setSubmitError(d.message || d.error || t("submitError"));
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
      setReviewError(t("loadError"));
    }
  }

  async function decide(decision: "APPROVED" | "REJECTED") {
    if (!reviewId || deciding) return;
    setReviewError(null);
    if (decision === "REJECTED" && !reviewNote.trim()) {
      setReviewError(t("reasonRequired"));
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
        setReviewError(d.message || d.error || t("decideError"));
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
    const res = await fetch(`/api/betriebsrat/members/${removeMemberId}`, {
      method: "DELETE",
    });
    if (res.ok) {
      setRemoveMemberId(null);
      fetchSupporting();
    }
  }

  async function handleWithdraw() {
    if (!withdrawId) return;
    const res = await fetch(`/api/betriebsrat/approvals/${withdrawId}`, {
      method: "DELETE",
    });
    if (res.ok) {
      setWithdrawId(null);
      fetchApprovals();
    }
  }

  const memberUserIds = new Set(members.map((m) => m.user.id));
  const eligibleTeam = team.filter((u) => !memberUserIds.has(u.id));

  return (
    <div>
      <Topbar
        title={t("title")}
        description={t("description")}
        actions={
          isManager ? (
            <Button size="sm" onClick={() => setShowSubmit(true)}>
              <PlusIcon className="h-4 w-4" />
              <span className="hidden sm:inline">{t("submit")}</span>
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
              {t("intro")}
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
                {t("empty")}
              </CardContent>
            </Card>
          )
        ) : (
          <div className="space-y-3">
            {approvals.map((a) => {
              const dl = deadlineInfo(a.deadline, a.status);
              return (
                <Card key={a.id} className="card-elevated">
                  <CardContent className="p-4 sm:p-5">
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-semibold text-gray-900 dark:text-zinc-100">
                            {a.title}
                          </h3>
                          <Badge
                            className={`text-xs border ${STATUS_CLS[a.status]}`}
                          >
                            {t(STATUS_KEY[a.status])}
                          </Badge>
                          {dl.overdue && (
                            <Badge className="text-xs border bg-red-100 text-red-700 border-red-300 gap-1">
                              <AlertTriangleIcon className="h-3 w-3" />
                              {t("overdue")}
                            </Badge>
                          )}
                        </div>
                        <div className="mt-1.5 text-sm text-gray-500 dark:text-zinc-400 space-y-0.5">
                          <p>
                            {t("period")}: {fmtDate(a.periodStart)} –{" "}
                            {fmtDate(a.periodEnd)} · {a.shiftCount}{" "}
                            {t("shifts")}
                          </p>
                          <p>
                            {t("submittedBy")}{" "}
                            {a.submittedBy.name || a.submittedBy.email}
                          </p>
                          {a.status === "PENDING" && (
                            <p
                              className={`inline-flex items-center gap-1.5 ${dl.urgent ? "text-red-600 font-medium" : ""}`}
                            >
                              <ClockIcon className="h-3.5 w-3.5" />
                              {t("deadline")}: {fmtDate(a.deadline)} · {dl.text}
                            </p>
                          )}
                          {a.reviewedBy && a.reviewedAt && (
                            <p>
                              {t("decidedBy")} {a.reviewedBy.name} {t("on")}{" "}
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
                            {t("review")}
                          </Button>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openReview(a.id)}
                          >
                            {t("viewOnly")}
                          </Button>
                        )}
                        {isManager && a.status === "PENDING" && !canReview && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-gray-400 hover:text-red-600"
                            onClick={() => setWithdrawId(a.id)}
                          >
                            {t("withdraw")}
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
                {t("members")}
              </CardTitle>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowAddMember(true)}
              >
                <PlusIcon className="h-4 w-4" />
                {t("member")}
              </Button>
            </CardHeader>
            <CardContent>
              {members.length === 0 ? (
                <p className="py-4 text-center text-sm text-gray-400 dark:text-zinc-500">
                  {t("noMembers")}
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
                            {t("chair")}
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
        title={t("submitTitle")}
        size="md"
      >
        <form onSubmit={handleSubmitPlan} className="space-y-4">
          <div className="space-y-2">
            <Label>{t("label")} *</Label>
            <Input
              placeholder={t("labelPlaceholder")}
              value={submitForm.title}
              onChange={(e) =>
                setSubmitForm((f) => ({ ...f, title: e.target.value }))
              }
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>{t("from")} *</Label>
              <Input
                type="date"
                value={submitForm.periodStart}
                onChange={(e) =>
                  setSubmitForm((f) => ({ ...f, periodStart: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>{t("to")} *</Label>
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
            <Label>{t("locationOptional")}</Label>
            <Select
              value={submitForm.locationId}
              onChange={(e) =>
                setSubmitForm((f) => ({ ...f, locationId: e.target.value }))
              }
            >
              <option value="">{t("allLocations")}</option>
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
              {tc("cancel")}
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? t("submitting") : t("submit")}
            </Button>
          </ModalFooter>
        </form>
      </AdaptiveModal>

      {/* ── Review modal ── */}
      <AdaptiveModal
        open={!!reviewId}
        onClose={() => setReviewId(null)}
        title={reviewData?.approval.title || t("reviewTitle")}
        size="lg"
      >
        {!reviewData ? (
          <div className="flex justify-center py-8">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent" />
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-gray-500 dark:text-zinc-400">
              {t("period")}: {fmtDate(reviewData.approval.periodStart)} –{" "}
              {fmtDate(reviewData.approval.periodEnd)} ·{" "}
              {reviewData.shifts.length} {t("shifts")}
            </p>

            <div className="max-h-72 overflow-y-auto rounded-xl border border-gray-100 dark:border-zinc-800">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-gray-50 dark:bg-zinc-800/80">
                  <tr className="text-left text-gray-500 dark:text-zinc-400">
                    <th className="px-3 py-2 font-medium">{t("tableDate")}</th>
                    <th className="px-3 py-2 font-medium">{t("tableTime")}</th>
                    <th className="px-3 py-2 font-medium">{t("tableBreak")}</th>
                    <th className="px-3 py-2 font-medium">
                      {t("tableEmployee")}
                    </th>
                    <th className="px-3 py-2 font-medium">
                      {t("tableLocation")}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y dark:divide-zinc-800">
                  {reviewData.shifts.length === 0 ? (
                    <tr>
                      <td
                        colSpan={5}
                        className="px-3 py-6 text-center text-gray-400"
                      >
                        {t("noShifts")}
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
                  <Label>{t("noteLabel")}</Label>
                  <textarea
                    value={reviewNote}
                    onChange={(e) => setReviewNote(e.target.value)}
                    rows={3}
                    placeholder={t("notePlaceholder")}
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
                    {t("refuse")}
                  </Button>
                  <Button
                    type="button"
                    disabled={deciding}
                    onClick={() => decide("APPROVED")}
                  >
                    <CheckCircleIcon className="h-4 w-4" />
                    {t("approve")}
                  </Button>
                </ModalFooter>
              </>
            ) : (
              <p className="text-sm text-gray-500 dark:text-zinc-400">
                {t("statusLabel")}: {t(STATUS_KEY[reviewData.approval.status])}
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
        title={t("addMemberTitle")}
        size="md"
      >
        <form onSubmit={addMember} className="space-y-4">
          <div className="space-y-2">
            <Label>{t("user")} *</Label>
            <Select
              value={newMemberId}
              onChange={(e) => setNewMemberId(e.target.value)}
            >
              <option value="">{t("selectUser")}</option>
              {eligibleTeam.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name || u.email} ({u.role})
                </option>
              ))}
            </Select>
            {eligibleTeam.length === 0 && (
              <p className="text-xs text-amber-600">{t("noUsers")}</p>
            )}
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={newMemberChair}
              onChange={(e) => setNewMemberChair(e.target.checked)}
              className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
            />
            {t("isChair")}
          </label>
          <ModalFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowAddMember(false)}
            >
              {tc("cancel")}
            </Button>
            <Button type="submit" disabled={!newMemberId}>
              {t("designate")}
            </Button>
          </ModalFooter>
        </form>
      </AdaptiveModal>

      <ConfirmDialog
        open={!!removeMemberId}
        title={t("removeMemberTitle")}
        message={t("removeMemberMessage")}
        confirmLabel={tc("delete")}
        cancelLabel={tc("cancel")}
        variant="danger"
        onConfirm={handleRemoveMember}
        onCancel={() => setRemoveMemberId(null)}
      />

      <ConfirmDialog
        open={!!withdrawId}
        title={t("withdrawTitle")}
        message={t("withdrawMessage")}
        confirmLabel={t("withdraw")}
        cancelLabel={tc("cancel")}
        variant="danger"
        onConfirm={handleWithdraw}
        onCancel={() => setWithdrawId(null)}
      />
    </div>
  );
}
