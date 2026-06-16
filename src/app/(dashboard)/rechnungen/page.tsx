"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Topbar } from "@/components/layout/topbar";
import { PageContent } from "@/components/ui/page-content";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Modal, ModalFooter } from "@/components/ui/modal";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  PlusIcon,
  TrashIcon,
  FileExportIcon,
  CheckCircleIcon,
} from "@/components/icons";

type DocKind = "invoice" | "quote";

interface Totals {
  netCents: number;
  vatCents: number;
  grossCents: number;
}
interface Item {
  description: string;
  quantity: number;
  unitPriceCents: number;
}
interface Quote {
  id: string;
  number: string;
  status: string;
  title: string | null;
  issueDate: string;
  validUntil: string | null;
  vatRate: number;
  acceptToken: string | null;
  convertedInvoiceId: string | null;
  client: { id: string; name: string } | null;
  items: Item[];
  totals: Totals;
}
interface Invoice {
  id: string;
  number: string;
  status: string;
  title: string | null;
  issueDate: string;
  dueDate: string;
  vatRate: number;
  recurring: string;
  client: { id: string; name: string } | null;
  items: Item[];
  totals: Totals;
}
interface Summary {
  outstandingCents: number;
  outstandingCount: number;
  overdueCents: number;
  overdueCount: number;
  paidThisYearCents: number;
}
interface ClientOption {
  id: string;
  name: string;
}

function euro(cents: number): string {
  return (cents / 100).toLocaleString("de-DE", {
    style: "currency",
    currency: "EUR",
  });
}
function todayISO(offset = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toLocaleDateString("en-CA");
}

const QUOTE_BADGE: Record<string, string> = {
  ENTWURF: "bg-gray-100 text-gray-600 border-gray-200",
  GESENDET: "bg-blue-50 text-blue-700 border-blue-200",
  ANGENOMMEN: "bg-emerald-50 text-emerald-700 border-emerald-200",
  ABGELEHNT: "bg-red-50 text-red-700 border-red-200",
  STORNIERT: "bg-gray-100 text-gray-400 border-gray-200",
};
const INVOICE_BADGE: Record<string, string> = {
  ENTWURF: "bg-gray-100 text-gray-600 border-gray-200",
  GESENDET: "bg-blue-50 text-blue-700 border-blue-200",
  BEZAHLT: "bg-emerald-50 text-emerald-700 border-emerald-200",
  UEBERFAELLIG: "bg-red-50 text-red-700 border-red-200",
  STORNIERT: "bg-gray-100 text-gray-400 border-gray-200",
};

export default function RechnungenPage() {
  const t = useTranslations("invoicing");
  const tc = useTranslations("common");

  const [tab, setTab] = useState<DocKind>("invoice");
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [confirmDel, setConfirmDel] = useState<{
    kind: DocKind;
    id: string;
  } | null>(null);

  const load = useCallback(async () => {
    try {
      const [invRes, quoRes, cliRes] = await Promise.all([
        fetch("/api/invoices"),
        fetch("/api/quotes"),
        fetch("/api/clients?take=200"),
      ]);
      if (invRes.ok) {
        const d = await invRes.json();
        setInvoices(d.invoices ?? []);
        setSummary(d.summary ?? null);
      }
      if (quoRes.ok) setQuotes(await quoRes.json());
      if (cliRes.ok) {
        const d = await cliRes.json();
        const arr = Array.isArray(d) ? d : (d.data ?? d.items ?? []);
        setClients(arr.map((c: ClientOption) => ({ id: c.id, name: c.name })));
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function setInvoiceStatus(id: string, status: string) {
    const res = await fetch(`/api/invoices/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (res.ok) {
      toast.success(t("statusUpdated"));
      load();
    } else toast.error(tc("errorOccurred"));
  }

  async function sendQuote(id: string) {
    const res = await fetch(`/api/quotes/${id}/send`, { method: "POST" });
    if (res.ok) {
      const d = await res.json();
      if (d.acceptUrl) {
        await navigator.clipboard?.writeText(d.acceptUrl).catch(() => {});
        toast.success(t("quoteSentLinkCopied"));
      } else toast.success(t("quoteSent"));
      load();
    } else toast.error(tc("errorOccurred"));
  }

  async function convertQuote(id: string) {
    const res = await fetch(`/api/quotes/${id}/convert`, { method: "POST" });
    if (res.ok) {
      toast.success(t("convertedToInvoice"));
      setTab("invoice");
      load();
    } else toast.error(tc("errorOccurred"));
  }

  async function doDelete() {
    if (!confirmDel) return;
    const url =
      confirmDel.kind === "invoice"
        ? `/api/invoices/${confirmDel.id}`
        : `/api/quotes/${confirmDel.id}`;
    const res = await fetch(url, { method: "DELETE" });
    if (res.ok) {
      toast.success(tc("deleted"));
      load();
    } else toast.error(tc("errorOccurred"));
    setConfirmDel(null);
  }

  return (
    <div>
      <Topbar
        title={t("title")}
        description={t("description")}
        actions={
          <Button size="sm" onClick={() => setFormOpen(true)}>
            <PlusIcon className="h-4 w-4" />
            <span className="hidden sm:inline">
              {tab === "invoice" ? t("newInvoice") : t("newQuote")}
            </span>
          </Button>
        }
      />

      <PageContent className="max-w-5xl">
        {/* Outstanding summary */}
        <div className="grid gap-4 sm:grid-cols-3">
          <Card>
            <CardContent className="p-5">
              <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-zinc-400">
                {t("outstanding")}
              </p>
              <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-zinc-100">
                {euro(summary?.outstandingCents ?? 0)}
              </p>
              <p className="text-xs text-gray-400">
                {summary?.outstandingCount ?? 0} {t("openInvoices")}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5">
              <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-zinc-400">
                {t("overdue")}
              </p>
              <p className="mt-1 text-2xl font-bold text-red-600">
                {euro(summary?.overdueCents ?? 0)}
              </p>
              <p className="text-xs text-gray-400">
                {summary?.overdueCount ?? 0} {t("invoicesLabel")}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5">
              <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-zinc-400">
                {t("paidThisYear")}
              </p>
              <p className="mt-1 text-2xl font-bold text-emerald-600">
                {euro(summary?.paidThisYearCents ?? 0)}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <div className="flex gap-2">
          {(["invoice", "quote"] as const).map((k) => (
            <button
              key={k}
              onClick={() => setTab(k)}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                tab === k
                  ? "bg-emerald-600 text-white"
                  : "bg-gray-100 text-gray-600 dark:bg-zinc-800 dark:text-zinc-300"
              }`}
            >
              {k === "invoice" ? t("invoices") : t("quotes")}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-600 border-t-transparent" />
          </div>
        ) : (
          <Card>
            <CardContent className="p-0">
              {tab === "invoice" ? (
                <InvoiceTable
                  rows={invoices}
                  t={t}
                  onStatus={setInvoiceStatus}
                  onDelete={(id) => setConfirmDel({ kind: "invoice", id })}
                />
              ) : (
                <QuoteTable
                  rows={quotes}
                  t={t}
                  onSend={sendQuote}
                  onConvert={convertQuote}
                  onDelete={(id) => setConfirmDel({ kind: "quote", id })}
                />
              )}
            </CardContent>
          </Card>
        )}
      </PageContent>

      {formOpen && (
        <DocumentFormModal
          kind={tab}
          clients={clients}
          t={t}
          tc={tc}
          onClose={() => setFormOpen(false)}
          onSaved={() => {
            setFormOpen(false);
            load();
          }}
        />
      )}

      <ConfirmDialog
        open={!!confirmDel}
        onConfirm={doDelete}
        onCancel={() => setConfirmDel(null)}
        title={t("confirmDeleteTitle")}
        message={t("confirmDeleteDesc")}
        variant="danger"
      />
    </div>
  );
}

/* ───────────────────────── Tables ───────────────────────── */

function InvoiceTable({
  rows,
  t,
  onStatus,
  onDelete,
}: {
  rows: Invoice[];
  t: (k: string) => string;
  onStatus: (id: string, s: string) => void;
  onDelete: (id: string) => void;
}) {
  if (rows.length === 0)
    return (
      <p className="py-10 text-center text-sm text-gray-400">
        {t("noInvoices")}
      </p>
    );
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="border-b text-left text-gray-500 dark:text-zinc-400">
          <tr>
            <th className="px-4 py-2.5 font-medium">{t("number")}</th>
            <th className="px-4 py-2.5 font-medium">{t("client")}</th>
            <th className="px-4 py-2.5 font-medium">{t("dueDate")}</th>
            <th className="px-4 py-2.5 font-medium text-right">{t("gross")}</th>
            <th className="px-4 py-2.5 font-medium">{t("status")}</th>
            <th className="px-4 py-2.5" />
          </tr>
        </thead>
        <tbody className="divide-y dark:divide-zinc-800">
          {rows.map((inv) => (
            <tr key={inv.id}>
              <td className="px-4 py-2.5 font-medium text-gray-900 dark:text-zinc-100">
                {inv.number}
                {inv.recurring !== "KEINE" && (
                  <span className="ml-1.5 text-[10px] text-emerald-600">↻</span>
                )}
              </td>
              <td className="px-4 py-2.5 text-gray-600 dark:text-zinc-300">
                {inv.client?.name ?? "—"}
              </td>
              <td className="px-4 py-2.5 text-gray-600 dark:text-zinc-300">
                {new Date(inv.dueDate).toLocaleDateString("de-DE")}
              </td>
              <td className="px-4 py-2.5 text-right font-medium">
                {euro(inv.totals.grossCents)}
              </td>
              <td className="px-4 py-2.5">
                <Badge className={`${INVOICE_BADGE[inv.status]} text-xs`}>
                  {t(`invStatus.${inv.status}`)}
                </Badge>
              </td>
              <td className="px-4 py-2.5">
                <div className="flex justify-end gap-1.5">
                  {inv.status === "ENTWURF" && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onStatus(inv.id, "GESENDET")}
                    >
                      {t("send")}
                    </Button>
                  )}
                  {(inv.status === "GESENDET" ||
                    inv.status === "UEBERFAELLIG") && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onStatus(inv.id, "BEZAHLT")}
                    >
                      <CheckCircleIcon className="h-3.5 w-3.5" />
                      {t("markPaid")}
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => onDelete(inv.id)}
                  >
                    <TrashIcon className="h-3.5 w-3.5 text-red-500" />
                  </Button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function QuoteTable({
  rows,
  t,
  onSend,
  onConvert,
  onDelete,
}: {
  rows: Quote[];
  t: (k: string) => string;
  onSend: (id: string) => void;
  onConvert: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  if (rows.length === 0)
    return (
      <p className="py-10 text-center text-sm text-gray-400">{t("noQuotes")}</p>
    );
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="border-b text-left text-gray-500 dark:text-zinc-400">
          <tr>
            <th className="px-4 py-2.5 font-medium">{t("number")}</th>
            <th className="px-4 py-2.5 font-medium">{t("client")}</th>
            <th className="px-4 py-2.5 font-medium text-right">{t("gross")}</th>
            <th className="px-4 py-2.5 font-medium">{t("status")}</th>
            <th className="px-4 py-2.5" />
          </tr>
        </thead>
        <tbody className="divide-y dark:divide-zinc-800">
          {rows.map((q) => (
            <tr key={q.id}>
              <td className="px-4 py-2.5 font-medium text-gray-900 dark:text-zinc-100">
                {q.number}
              </td>
              <td className="px-4 py-2.5 text-gray-600 dark:text-zinc-300">
                {q.client?.name ?? "—"}
              </td>
              <td className="px-4 py-2.5 text-right font-medium">
                {euro(q.totals.grossCents)}
              </td>
              <td className="px-4 py-2.5">
                <Badge className={`${QUOTE_BADGE[q.status]} text-xs`}>
                  {t(`quoteStatus.${q.status}`)}
                </Badge>
              </td>
              <td className="px-4 py-2.5">
                <div className="flex justify-end gap-1.5">
                  {(q.status === "ENTWURF" || q.status === "GESENDET") && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onSend(q.id)}
                    >
                      {q.status === "ENTWURF" ? t("send") : t("copyLink")}
                    </Button>
                  )}
                  {q.status === "ANGENOMMEN" && !q.convertedInvoiceId && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onConvert(q.id)}
                    >
                      <FileExportIcon className="h-3.5 w-3.5" />
                      {t("toInvoice")}
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => onDelete(q.id)}
                  >
                    <TrashIcon className="h-3.5 w-3.5 text-red-500" />
                  </Button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ─────────────────────── Create modal ─────────────────────── */

function DocumentFormModal({
  kind,
  clients,
  t,
  tc,
  onClose,
  onSaved,
}: {
  kind: DocKind;
  clients: ClientOption[];
  t: (k: string) => string;
  tc: (k: string) => string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [clientId, setClientId] = useState("");
  const [title, setTitle] = useState("");
  const [issueDate, setIssueDate] = useState(todayISO());
  const [dueDate, setDueDate] = useState(todayISO(14));
  const [validUntil, setValidUntil] = useState(todayISO(30));
  const [vatRate, setVatRate] = useState("19");
  const [recurring, setRecurring] = useState("KEINE");
  const [items, setItems] = useState<
    { description: string; quantity: string; unitPriceEuro: string }[]
  >([{ description: "", quantity: "1", unitPriceEuro: "" }]);
  const [saving, setSaving] = useState(false);

  function updateItem(i: number, field: string, value: string) {
    setItems((prev) =>
      prev.map((it, idx) => (idx === i ? { ...it, [field]: value } : it)),
    );
  }

  const netCents = items.reduce((s, it) => {
    const qty = parseFloat(it.quantity) || 0;
    const price = Math.round((parseFloat(it.unitPriceEuro) || 0) * 100);
    return s + Math.round(qty * price);
  }, 0);
  const vatCents = Math.round((netCents * (parseFloat(vatRate) || 0)) / 100);

  async function save() {
    const cleanItems = items
      .filter(
        (it) => it.description.trim() && parseFloat(it.unitPriceEuro) >= 0,
      )
      .map((it) => ({
        description: it.description.trim(),
        quantity: parseFloat(it.quantity) || 1,
        unitPriceCents: Math.round((parseFloat(it.unitPriceEuro) || 0) * 100),
      }));
    if (cleanItems.length === 0) {
      toast.error(t("needOneItem"));
      return;
    }
    setSaving(true);
    try {
      const payload =
        kind === "invoice"
          ? {
              clientId: clientId || null,
              title: title || null,
              issueDate,
              dueDate,
              vatRate: parseFloat(vatRate) || 0,
              recurring,
              items: cleanItems,
            }
          : {
              clientId: clientId || null,
              title: title || null,
              issueDate,
              validUntil: validUntil || null,
              vatRate: parseFloat(vatRate) || 0,
              items: cleanItems,
            };
      const url = kind === "invoice" ? "/api/invoices" : "/api/quotes";
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        toast.success(tc("saved"));
        onSaved();
      } else {
        const d = await res.json().catch(() => ({}));
        toast.error(d.message || d.error || tc("errorOccurred"));
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      size="2xl"
      title={kind === "invoice" ? t("newInvoice") : t("newQuote")}
    >
      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>{t("client")}</Label>
            <Select
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
            >
              <option value="">{t("noClient")}</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>{t("titleField")}</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t("titlePlaceholder")}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <Label>{t("issueDate")}</Label>
            <Input
              type="date"
              value={issueDate}
              onChange={(e) => setIssueDate(e.target.value)}
            />
          </div>
          {kind === "invoice" ? (
            <div className="space-y-1.5">
              <Label>{t("dueDate")}</Label>
              <Input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label>{t("validUntil")}</Label>
              <Input
                type="date"
                value={validUntil}
                onChange={(e) => setValidUntil(e.target.value)}
              />
            </div>
          )}
          <div className="space-y-1.5">
            <Label>{t("vatRate")}</Label>
            <Input
              type="number"
              value={vatRate}
              onChange={(e) => setVatRate(e.target.value)}
            />
          </div>
        </div>

        {kind === "invoice" && (
          <div className="space-y-1.5">
            <Label>{t("recurring")}</Label>
            <Select
              value={recurring}
              onChange={(e) => setRecurring(e.target.value)}
            >
              <option value="KEINE">{t("recurKEINE")}</option>
              <option value="MONATLICH">{t("recurMONATLICH")}</option>
              <option value="QUARTALSWEISE">{t("recurQUARTALSWEISE")}</option>
              <option value="JAEHRLICH">{t("recurJAEHRLICH")}</option>
            </Select>
          </div>
        )}

        {/* Line items */}
        <div className="space-y-2">
          <Label>{t("items")}</Label>
          {items.map((it, i) => (
            <div key={i} className="flex gap-2 items-start">
              <Input
                className="flex-1"
                placeholder={t("itemDescription")}
                value={it.description}
                onChange={(e) => updateItem(i, "description", e.target.value)}
              />
              <Input
                className="w-16"
                type="number"
                placeholder={t("qty")}
                value={it.quantity}
                onChange={(e) => updateItem(i, "quantity", e.target.value)}
              />
              <Input
                className="w-28"
                type="number"
                step="0.01"
                placeholder={t("unitPrice")}
                value={it.unitPriceEuro}
                onChange={(e) => updateItem(i, "unitPriceEuro", e.target.value)}
              />
              <Button
                size="sm"
                variant="ghost"
                onClick={() =>
                  setItems((prev) => prev.filter((_, idx) => idx !== i))
                }
                disabled={items.length === 1}
              >
                <TrashIcon className="h-4 w-4 text-red-500" />
              </Button>
            </div>
          ))}
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              setItems((prev) => [
                ...prev,
                { description: "", quantity: "1", unitPriceEuro: "" },
              ])
            }
          >
            <PlusIcon className="h-4 w-4" />
            {t("addItem")}
          </Button>
        </div>

        {/* Totals preview */}
        <div className="rounded-xl bg-gray-50 dark:bg-zinc-900 p-4 text-sm space-y-1">
          <div className="flex justify-between text-gray-600 dark:text-zinc-400">
            <span>{t("net")}</span>
            <span>{euro(netCents)}</span>
          </div>
          <div className="flex justify-between text-gray-600 dark:text-zinc-400">
            <span>
              {t("vat")} ({vatRate}%)
            </span>
            <span>{euro(vatCents)}</span>
          </div>
          <div className="flex justify-between font-semibold text-gray-900 dark:text-zinc-100">
            <span>{t("gross")}</span>
            <span>{euro(netCents + vatCents)}</span>
          </div>
        </div>
      </div>

      <ModalFooter>
        <Button variant="outline" onClick={onClose}>
          {tc("cancel")}
        </Button>
        <Button onClick={save} disabled={saving}>
          {saving ? tc("saving") : tc("save")}
        </Button>
      </ModalFooter>
    </Modal>
  );
}
