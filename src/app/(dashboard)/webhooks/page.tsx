"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import { Topbar } from "@/components/layout/topbar";
import { PlusIcon } from "@/components/icons";

interface WebhookEndpoint {
  id: string;
  url: string;
  events: string[];
  isActive: boolean;
  secret: string;
  createdAt: string;
}

export default function WebhooksSeite() {
  const t = useTranslations("webhooks");
  const [hooks, setHooks] = useState<WebhookEndpoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formUrl, setFormUrl] = useState("");
  const [formEvents, setFormEvents] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [revealedSecret, setRevealedSecret] = useState<string | null>(null);

  const allEvents = [
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

  const fetchHooks = useCallback(async () => {
    try {
      const res = await fetch("/api/webhooks");
      if (res.ok) setHooks(await res.json());
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

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
      }
    } catch {
      // ignore
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(hook: WebhookEndpoint) {
    await fetch(`/api/webhooks/${hook.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !hook.isActive }),
    });
    fetchHooks();
  }

  async function deleteHook(id: string) {
    await fetch(`/api/webhooks/${id}`, { method: "DELETE" });
    fetchHooks();
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
          <button
            onClick={() => setShowForm(!showForm)}
            className="inline-flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700 transition-colors"
          >
            <PlusIcon className="h-4 w-4" />
            {t("newWebhook")}
          </button>
        }
      />
      <div className="p-4 sm:p-6 space-y-6">
        {showForm && (
          <form
            onSubmit={handleCreate}
            className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm space-y-4"
          >
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t("url")} *
              </label>
              <input
                type="url"
                required
                placeholder="https://example.com/webhook"
                value={formUrl}
                onChange={(e) => setFormUrl(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t("events")} *
              </label>
              <div className="flex flex-wrap gap-2">
                {allEvents.map((event) => (
                  <button
                    key={event}
                    type="button"
                    onClick={() => toggleEvent(event)}
                    className={`rounded-full px-3 py-1 text-xs font-medium border transition-colors ${
                      formEvents.includes(event)
                        ? "bg-violet-100 text-violet-800 border-violet-300"
                        : "bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100"
                    }`}
                  >
                    {event}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Abbrechen
              </button>
              <button
                type="submit"
                disabled={saving || formEvents.length === 0}
                className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-50"
              >
                {saving ? "..." : t("newWebhook")}
              </button>
            </div>
          </form>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-violet-600 border-t-transparent" />
          </div>
        ) : hooks.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-300 p-12 text-center">
            <p className="text-gray-500">{t("noWebhooks")}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {hooks.map((hook) => (
              <div
                key={hook.id}
                className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-mono text-sm text-gray-900">
                      {hook.url}
                    </p>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {hook.events.map((ev) => (
                        <span
                          key={ev}
                          className="inline-block rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600"
                        >
                          {ev}
                        </span>
                      ))}
                    </div>
                    {revealedSecret === hook.id && (
                      <p className="mt-2 font-mono text-xs text-gray-400 break-all">
                        {t("secret")}: {hook.secret}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() =>
                        setRevealedSecret(
                          revealedSecret === hook.id ? null : hook.id,
                        )
                      }
                      className="text-xs text-gray-500 hover:text-gray-700"
                    >
                      {revealedSecret === hook.id ? "🙈" : "🔑"}
                    </button>
                    <button
                      onClick={() => toggleActive(hook)}
                      className={`rounded-full px-3 py-1 text-xs font-medium ${
                        hook.isActive
                          ? "bg-green-100 text-green-800"
                          : "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {hook.isActive ? "Aktiv" : "Inaktiv"}
                    </button>
                    <button
                      onClick={() => deleteHook(hook.id)}
                      className="text-sm text-red-500 hover:text-red-700"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
