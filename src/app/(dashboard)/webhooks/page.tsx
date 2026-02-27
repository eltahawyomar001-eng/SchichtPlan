"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import { Topbar } from "@/components/layout/topbar";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { AdaptiveModal, ModalFooter } from "@/components/ui/adaptive-modal";
import { PageContent } from "@/components/ui/page-content";
import {
  PlusIcon,
  TrashIcon,
  EyeIcon,
  EyeOffIcon,
  ClipboardIcon,
  PlayIcon,
} from "@/components/icons";
import { usePlanLimit } from "@/components/providers/plan-limit-provider";

interface WebhookEndpoint {
  id: string;
  url: string;
  events: string[];
  isActive: boolean;
  secret: string;
  createdAt: string;
}

const ALL_EVENTS = [
  "shift.created",
  "shift.updated",
  "shift.deleted",
  "time-entry.created",
  "time-entry.submitted",
  "absence.created",
  "absence.approved",
  "employee.created",
  "employee.updated",
];

export default function WebhooksSeite() {
  const t = useTranslations("webhooks");
  const tc = useTranslations("common");
  const { handlePlanLimit } = usePlanLimit();
  const [hooks, setHooks] = useState<WebhookEndpoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [formUrl, setFormUrl] = useState("");
  const [formEvents, setFormEvents] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [revealedSecret, setRevealedSecret] = useState<string | null>(null);
  const [copiedSecret, setCopiedSecret] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [testingHook, setTestingHook] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{
    id: string;
    ok: boolean;
  } | null>(null);

  const fetchHooks = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch("/api/webhooks");
      if (res.ok) {
        const d = await res.json();
        setHooks(d.data ?? d);
      } else {
        const isPlanLimit = await handlePlanLimit(res);
        if (!isPlanLimit) setError(tc("errorLoading"));
      }
    } catch {
      setError(tc("errorLoading"));
    } finally {
      setLoading(false);
    }
  }, [tc, handlePlanLimit]);

  useEffect(() => {
    fetchHooks();
  }, [fetchHooks]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!formUrl || formEvents.length === 0) return;
    setSaving(true);
    try {
      const res = await fetch("/api/webhooks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: formUrl, events: formEvents }),
      });
      if (res.ok) {
        setShowForm(false);
        setFormUrl("");
        setFormEvents([]);
        fetchHooks();
      } else {
        const isPlanLimit = await handlePlanLimit(res);
        if (!isPlanLimit) {
          const data = await res.json();
          setError(data.error || tc("errorOccurred"));
        }
      }
    } catch {
      setError(tc("errorOccurred"));
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(hook: WebhookEndpoint) {
    try {
      await fetch(`/api/webhooks/${hook.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !hook.isActive }),
      });
      fetchHooks();
    } catch {
      setError(tc("errorOccurred"));
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      await fetch(`/api/webhooks/${deleteTarget}`, { method: "DELETE" });
      setDeleteTarget(null);
      fetchHooks();
    } catch {
      setError(tc("errorOccurred"));
      setDeleteTarget(null);
    }
  }

  async function testWebhook(hook: WebhookEndpoint) {
    setTestingHook(hook.id);
    setTestResult(null);
    try {
      const res = await fetch(`/api/webhooks/${hook.id}/test`, {
        method: "POST",
      });
      setTestResult({ id: hook.id, ok: res.ok });
    } catch {
      setTestResult({ id: hook.id, ok: false });
    } finally {
      setTestingHook(null);
    }
  }

  async function copySecret(secret: string, hookId: string) {
    try {
      await navigator.clipboard.writeText(secret);
      setCopiedSecret(hookId);
      setTimeout(() => setCopiedSecret(null), 2000);
    } catch {
      // Clipboard API not available
    }
  }

  function toggleEvent(event: string) {
    setFormEvents((prev) =>
      prev.includes(event) ? prev.filter((e) => e !== event) : [...prev, event],
    );
  }

  return (
    <div>
      <Topbar
        title={t("title")}
        description={t("description")}
        actions={
          <Button size="sm" onClick={() => setShowForm(!showForm)}>
            <PlusIcon className="h-4 w-4" />
            <span className="hidden sm:inline">{t("newWebhook")}</span>
            <span className="sm:hidden">{tc("new")}</span>
          </Button>
        }
      />
      <PageContent>
        {/* Error */}
        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            {error}
          </div>
        )}

        {/* Create Form Modal */}
        <AdaptiveModal
          open={showForm}
          onClose={() => setShowForm(false)}
          title={t("newWebhook")}
          size="lg"
        >
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="space-y-2">
              <Label>{t("url")} *</Label>
              <Input
                type="url"
                required
                placeholder="https://example.com/webhook"
                value={formUrl}
                onChange={(e) => setFormUrl(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>{t("events")} *</Label>
              <div className="flex flex-wrap gap-2">
                {ALL_EVENTS.map((event) => (
                  <button
                    key={event}
                    type="button"
                    onClick={() => toggleEvent(event)}
                    className={`rounded-full px-3 py-1 text-xs font-medium border transition-colors ${
                      formEvents.includes(event)
                        ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                        : "bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100"
                    }`}
                  >
                    {event}
                  </button>
                ))}
              </div>
            </div>

            <ModalFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowForm(false)}
              >
                {tc("cancel")}
              </Button>
              <Button
                type="submit"
                disabled={saving || formEvents.length === 0}
              >
                {saving ? "..." : t("newWebhook")}
              </Button>
            </ModalFooter>
          </form>
        </AdaptiveModal>

        {/* Webhook list */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-600 border-t-transparent" />
          </div>
        ) : hooks.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <p className="text-lg font-medium text-gray-900">
                {t("noWebhooks")}
              </p>
              <Button className="mt-4" onClick={() => setShowForm(true)}>
                <PlusIcon className="h-4 w-4" />
                {t("newWebhook")}
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {hooks.map((hook) => (
              <Card key={hook.id} className="card-elevated">
                <CardContent className="p-4">
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="font-mono text-sm text-gray-900 truncate">
                        {hook.url}
                      </p>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {hook.events.map((ev) => (
                          <Badge
                            key={ev}
                            className="bg-gray-100 text-gray-600 text-xs"
                          >
                            {ev}
                          </Badge>
                        ))}
                      </div>

                      {/* Secret (masked by default) */}
                      <div className="mt-2 flex items-center gap-2">
                        <p className="font-mono text-xs text-gray-400 break-all">
                          {t("secret")}:{" "}
                          {revealedSecret === hook.id
                            ? hook.secret
                            : "••••••••••••••••"}
                        </p>
                        <button
                          type="button"
                          onClick={() =>
                            setRevealedSecret(
                              revealedSecret === hook.id ? null : hook.id,
                            )
                          }
                          className="p-1 text-gray-400 hover:text-gray-600 rounded"
                          title={
                            revealedSecret === hook.id
                              ? t("hideSecret")
                              : t("showSecret")
                          }
                        >
                          {revealedSecret === hook.id ? (
                            <EyeOffIcon className="h-3.5 w-3.5" />
                          ) : (
                            <EyeIcon className="h-3.5 w-3.5" />
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => copySecret(hook.secret, hook.id)}
                          className="p-1 text-gray-400 hover:text-gray-600 rounded"
                          title={t("copySecret")}
                        >
                          <ClipboardIcon className="h-3.5 w-3.5" />
                        </button>
                        {copiedSecret === hook.id && (
                          <span className="text-xs text-emerald-600">
                            {t("secretCopied")}
                          </span>
                        )}
                      </div>

                      {/* Test result */}
                      {testResult?.id === hook.id && (
                        <p
                          className={`mt-1 text-xs ${testResult.ok ? "text-emerald-600" : "text-red-600"}`}
                        >
                          {testResult.ok ? t("testSuccess") : t("testFailed")}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => testWebhook(hook)}
                        disabled={testingHook === hook.id}
                      >
                        <PlayIcon className="h-3.5 w-3.5" />
                        {testingHook === hook.id ? "..." : t("test")}
                      </Button>
                      <Button
                        variant={hook.isActive ? "default" : "outline"}
                        size="sm"
                        onClick={() => toggleActive(hook)}
                        className={
                          hook.isActive
                            ? "bg-green-100 text-green-800 hover:bg-green-200"
                            : ""
                        }
                      >
                        {hook.isActive ? t("active") : t("inactive")}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-gray-400 hover:text-red-600"
                        onClick={() => setDeleteTarget(hook.id)}
                      >
                        <TrashIcon className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </PageContent>

      <ConfirmDialog
        open={!!deleteTarget}
        title={t("deleteConfirmTitle")}
        message={t("deleteConfirmMessage")}
        confirmLabel={tc("delete")}
        cancelLabel={tc("cancel")}
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
