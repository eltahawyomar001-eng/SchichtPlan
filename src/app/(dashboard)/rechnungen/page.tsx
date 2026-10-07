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
  DownloadIcon,
  FileCheckIcon,
  CircleXIcon,
  AlertTriangleIcon,
  ClockIcon,
  SendIcon,
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
  /** Null until the invoice is issued: the number is drawn at that moment. */
  number: string | null;
  status: string;
  issuedAt: string | null;
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
  /** What preflight is still blocking, shown after a refused issue. */
  const [blocked, setBlocked] = useState<
    | {
        code: string;
        message: string;
        basis?: string;
      }[]
    | null
  >(null);
  const [issuing, setIssuing] = useState<string | null>(null);
  const [stornoFor, setStornoFor] = useState<Invoice | null>(null);
  const [stornoReason, setStornoReason] = useState("");
  const [hoursOpen, setHoursOpen] = useState(false);
  const [datevOpen, setDatevOpen] = useState(false);
  const [sending, setSending] = useState<string | null>(null);

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

  /**
   * Issue a draft as an e-invoice.
   *
   * Replaces the old "send", which merely flipped the status to GESENDET --
   * producing an invoice with a number but no structured document, and
   * bypassing every § 14 Abs. 4 check. 422 means the tenant's master data is
   * incomplete; the list is the useful part of that answer, so it goes in a
   * dialog rather than a toast that disappears.
   */
  async function issueInvoice(id: string) {
    setIssuing(id);
    try {
      const res = await fetch(`/api/invoices/${id}/issue`, { method: "POST" });
      const d = await res.json().catch(() => ({}));
      if (res.ok) {
        toast.success(t("issued", { number: d.number }));
        load();
        return;
      }
      if (res.status === 422 && Array.isArray(d.issues)) {
        setBlocked(d.issues);
        return;
      }
      toast.error(d.message ?? t("issueFailed"));
    } finally {
      setIssuing(null);
    }
  }

  /**
   * Email the invoice to the client.
   *
   * Only offered on issued invoices: a draft has no number and no structured
   * document, so what would arrive is not an invoice.
   */
  async function sendInvoice(inv: Invoice) {
    setSending(inv.id);
    try {
      const res = await fetch(`/api/invoices/${inv.id}/send`, {
        method: "POST",
      });
      const d = await res.json().catch(() => ({}));
      if (res.ok) {
        toast.success(t("sentTo", { to: d.to }));
        load();
      } else {
        toast.error(d.message ?? t("sendFailed"));
      }
    } finally {
      setSending(null);
    }
  }

  async function doStorno() {
    if (!stornoFor) return;
    const res = await fetch(`/api/invoices/${stornoFor.id}/storno`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        stornoReason.trim() ? { reason: stornoReason.trim() } : {},
      ),
    });
    const d = await res.json().catch(() => ({}));
    if (res.ok) {
      toast.success(t("stornoCreated", { number: d.number ?? "" }));
      load();
    } else {
      toast.error(d.message ?? t("stornoFailed"));
    }
    setStornoFor(null);
    setStornoReason("");
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
    } else {
      const d = await res.json().catch(() => ({}));
      toast.error(d.message ?? tc("errorOccurred"));
    }
    setConfirmDel(null);
  }

  return (
    <div>
      <Topbar
        title={t("title")}
        description={t("description")}
        actions={
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setDatevOpen(true)}
            >
              <FileExportIcon className="h-4 w-4" />
              <span className="hidden sm:inline">{t("datevExport")}</span>
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setHoursOpen(true)}
            >
              <ClockIcon className="h-4 w-4" />
              <span className="hidden sm:inline">{t("fromHours")}</span>
            </Button>
            <Button size="sm" onClick={() => setFormOpen(true)}>
              <PlusIcon className="h-4 w-4" />
              <span className="hidden sm:inline">
                {tab === "invoice" ? t("newInvoice") : t("newQuote")}
              </span>
            </Button>
          </div>
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
                  onIssue={issueInvoice}
                  onStorno={setStornoFor}
                  onSend={sendInvoice}
                  issuing={issuing}
                  sending={sending}
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

      {/* Why an invoice could not be issued.
          A dialog rather than a toast: the list is the answer, it is several
          lines long, and it names fields the user has to go and fill in. */}
      <Modal
        open={!!blocked}
        onClose={() => setBlocked(null)}
        size="md"
        title={t("issueBlockedTitle")}
        description={t("issueBlockedHint")}
      >
        <ul className="space-y-2.5">
          {(blocked ?? []).map((i) => (
            <li key={i.code} className="flex items-start gap-2.5 text-sm">
              <AlertTriangleIcon className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-600 dark:text-amber-400" />
              <span className="text-gray-700 dark:text-zinc-300">
                {i.message}
                {i.basis && (
                  <span className="ml-1 text-gray-400 dark:text-zinc-500">
                    ({i.basis})
                  </span>
                )}
              </span>
            </li>
          ))}
        </ul>
        <ModalFooter>
          <Button variant="outline" onClick={() => setBlocked(null)}>
            {tc("close")}
          </Button>
          {/* Most of these live in one form, so link straight to it rather
              than leaving the user to find it. */}
          <Button
            onClick={() => {
              setBlocked(null);
              window.location.href = "/einstellungen/rechnungsstellung";
            }}
          >
            {t("issueBlockedSettings")}
          </Button>
        </ModalFooter>
      </Modal>

      {hoursOpen && (
        <FromHoursModal
          clients={clients}
          onClose={() => setHoursOpen(false)}
          onCreated={() => {
            setHoursOpen(false);
            setTab("invoice");
            load();
          }}
        />
      )}

      {datevOpen && <DatevModal onClose={() => setDatevOpen(false)} />}

      {/* Storno. Explains WHY a cancellation creates a second document,
          because otherwise it looks like the app refusing to delete. */}
      <Modal
        open={!!stornoFor}
        onClose={() => {
          setStornoFor(null);
          setStornoReason("");
        }}
        size="md"
        title={t("stornoConfirmTitle")}
        description={t("stornoConfirmDesc")}
      >
        <Label className="mb-1.5 block">{t("stornoReason")}</Label>
        <Input
          value={stornoReason}
          onChange={(e) => setStornoReason(e.target.value)}
        />
        <ModalFooter>
          <Button
            variant="outline"
            onClick={() => {
              setStornoFor(null);
              setStornoReason("");
            }}
          >
            {tc("cancel")}
          </Button>
          <Button variant="destructive" onClick={doStorno}>
            {t("storno")}
          </Button>
        </ModalFooter>
      </Modal>
    </div>
  );
}

/* ───────────────────────── Tables ───────────────────────── */

function InvoiceTable({
  rows,
  t,
  onStatus,
  onIssue,
  onStorno,
  onSend,
  issuing,
  sending,
  onDelete,
}: {
  rows: Invoice[];
  t: (k: string) => string;
  onStatus: (id: string, s: string) => void;
  onIssue: (id: string) => void;
  onStorno: (inv: Invoice) => void;
  onSend: (inv: Invoice) => void;
  issuing: string | null;
  sending: string | null;
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
            <th className="whitespace-nowrap px-4 py-2.5 font-medium">
              {t("number")}
            </th>
            <th className="px-4 py-2.5 font-medium">{t("client")}</th>
            <th className="px-4 py-2.5 font-medium">{t("dueDate")}</th>
            <th className="whitespace-nowrap px-4 py-2.5 font-medium text-right">
              {t("gross")}
            </th>
            <th className="px-4 py-2.5 font-medium">{t("status")}</th>
            <th className="px-4 py-2.5" />
          </tr>
        </thead>
        <tbody className="divide-y dark:divide-zinc-800">
          {rows.map((inv) => (
            <tr key={inv.id}>
              <td className="whitespace-nowrap px-4 py-2.5 font-medium text-gray-900 dark:text-zinc-100">
                {inv.number ?? (
                  // A draft genuinely has no number yet, and showing a
                  // placeholder that looks like one is how a draft ends up
                  // being quoted to a customer.
                  <span className="text-gray-400 dark:text-zinc-500 italic">
                    {t("draftNoNumber")}
                  </span>
                )}
                {inv.recurring !== "KEINE" && (
                  <span className="ml-1.5 text-[10px] text-emerald-600">↻</span>
                )}
              </td>
              <td className="min-w-[180px] break-words px-4 py-2.5 text-gray-600 dark:text-zinc-300 [word-break:normal] [overflow-wrap:break-word]">
                {inv.client?.name ?? "—"}
              </td>
              <td className="whitespace-nowrap px-4 py-2.5 text-gray-600 dark:text-zinc-300">
                {new Date(inv.dueDate).toLocaleDateString("de-DE")}
              </td>
              <td className="whitespace-nowrap px-4 py-2.5 text-right font-medium">
                {euro(inv.totals.grossCents)}
              </td>
              <td className="px-4 py-2.5">
                <Badge className={`${INVOICE_BADGE[inv.status]} text-xs`}>
                  {t(`invStatus.${inv.status}`)}
                </Badge>
              </td>
              <td className="px-4 py-2.5">
                <div className="flex justify-end gap-1.5">
                  <Button
                    size="sm"
                    variant="ghost"
                    title="PDF"
                    onClick={() =>
                      window.open(`/api/invoices/${inv.id}/pdf`, "_blank")
                    }
                  >
                    <DownloadIcon className="h-3.5 w-3.5" />
                  </Button>
                  {/* The archived XML and the hybrid PDF, both only once
                      there is an issued document behind them. */}
                  {inv.issuedAt && (
                    <>
                      <Button
                        size="sm"
                        variant="ghost"
                        title={t("downloadXml")}
                        onClick={() =>
                          window.open(`/api/invoices/${inv.id}/xml`, "_blank")
                        }
                      >
                        <FileCheckIcon className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        title={t("downloadZugferd")}
                        onClick={() =>
                          window.open(
                            `/api/invoices/${inv.id}/zugferd`,
                            "_blank",
                          )
                        }
                      >
                        <DownloadIcon className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        title={t("sendInvoice")}
                        disabled={sending === inv.id}
                        onClick={() => onSend(inv)}
                      >
                        <SendIcon className="h-3.5 w-3.5" />
                      </Button>
                    </>
                  )}
                  {!inv.issuedAt && inv.status === "ENTWURF" && (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={issuing === inv.id}
                      onClick={() => onIssue(inv.id)}
                    >
                      {issuing === inv.id ? t("issuing") : t("issue")}
                    </Button>
                  )}
                  {(inv.status === "GESENDET" ||
                    inv.status === "UEBERFAELLIG") && (
                    <Button
                      size="sm"
                      variant="ghost"
                      title={t("markPaid")}
                      onClick={() => onStatus(inv.id, "BEZAHLT")}
                    >
                      <CheckCircleIcon className="h-3.5 w-3.5" />
                    </Button>
                  )}
                  {/* Issued invoices are cancelled, never deleted: GoBD and
                      § 147 AO forbid removing one from the books. */}
                  {inv.issuedAt ? (
                    inv.status !== "STORNIERT" && (
                      <Button
                        size="sm"
                        variant="ghost"
                        title={t("storno")}
                        onClick={() => onStorno(inv)}
                      >
                        <CircleXIcon className="h-3.5 w-3.5 text-red-500" />
                      </Button>
                    )
                  ) : (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => onDelete(inv.id)}
                    >
                      <TrashIcon className="h-3.5 w-3.5 text-red-500" />
                    </Button>
                  )}
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
            <th className="whitespace-nowrap px-4 py-2.5 font-medium">
              {t("number")}
            </th>
            <th className="px-4 py-2.5 font-medium">{t("client")}</th>
            <th className="whitespace-nowrap px-4 py-2.5 font-medium text-right">
              {t("gross")}
            </th>
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
              <td className="whitespace-nowrap px-4 py-2.5 text-right font-medium">
                {euro(q.totals.grossCents)}
              </td>
              <td className="px-4 py-2.5">
                <Badge className={`${QUOTE_BADGE[q.status]} text-xs`}>
                  {t(`quoteStatus.${q.status}`)}
                </Badge>
              </td>
              <td className="px-4 py-2.5">
                <div className="flex justify-end gap-1.5">
                  <Button
                    size="sm"
                    variant="ghost"
                    title="PDF"
                    onClick={() =>
                      window.open(`/api/quotes/${q.id}/pdf`, "_blank")
                    }
                  >
                    <DownloadIcon className="h-3.5 w-3.5" />
                  </Button>
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

/* ───────────────────── Rechnung aus Stunden ───────────────────── */

interface HoursLine {
  projectId: string;
  description: string;
  quantity: number;
  unitPriceCents: number;
  netMinutes: number;
}
interface SkippedEntry {
  entryId: string;
  date: string;
  netMinutes: number;
  reason: string;
  projectName?: string;
}

/** First and last day of the previous whole month, as yyyy-mm-dd. */
function lastMonthRange(): { from: string; to: string } {
  const now = new Date();
  const first = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const last = new Date(now.getFullYear(), now.getMonth(), 0);
  const iso = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return { from: iso(first), to: iso(last) };
}

/**
 * Build an invoice from recorded time.
 *
 * Previews before it creates anything, because the interesting part is not
 * the total but WHAT WAS LEFT OUT: hours still awaiting confirmation, or a
 * project with no rate, are exactly the things that otherwise go unbilled
 * without anyone noticing.
 */
function FromHoursModal({
  clients,
  onClose,
  onCreated,
}: {
  clients: ClientOption[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const t = useTranslations("invoicing");
  const tc = useTranslations("common");
  const defaults = lastMonthRange();

  const [clientId, setClientId] = useState(clients[0]?.id ?? "");
  const [from, setFrom] = useState(defaults.from);
  const [to, setTo] = useState(defaults.to);
  const [lines, setLines] = useState<HoursLine[]>([]);
  const [skipped, setSkipped] = useState<SkippedEntry[]>([]);
  const [netCents, setNetCents] = useState(0);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const preview = useCallback(async () => {
    if (!clientId) return;
    setLoading(true);
    try {
      const qs = new URLSearchParams({ clientId, from, to });
      const res = await fetch(`/api/invoices/aus-stunden?${qs}`);
      if (res.ok) {
        const d = await res.json();
        setLines(d.lines ?? []);
        setSkipped(d.skipped ?? []);
        setNetCents(d.netCents ?? 0);
      }
      setLoaded(true);
    } finally {
      setLoading(false);
    }
  }, [clientId, from, to]);

  useEffect(() => {
    void preview();
  }, [preview]);

  async function create() {
    setCreating(true);
    try {
      const res = await fetch("/api/invoices/aus-stunden", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId, from, to }),
      });
      const d = await res.json().catch(() => ({}));
      if (res.ok) {
        toast.success(tc("saved"));
        onCreated();
      } else {
        toast.error(d.message ?? tc("errorOccurred"));
      }
    } finally {
      setCreating(false);
    }
  }

  // Grouped by reason: "12 entries not yet confirmed" is actionable in a way
  // that twelve separate rows naming each date is not.
  const skipGroups = skipped.reduce<Record<string, number>>((acc, s) => {
    acc[s.reason] = (acc[s.reason] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title={t("fromHoursTitle")}
      description={t("fromHoursDesc")}
    >
      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <Label className="mb-1.5 block">{t("fromHoursClient")}</Label>
          <Select
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
          >
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label className="mb-1.5 block">{t("fromHoursFrom")}</Label>
          <Input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
        </div>
        <div>
          <Label className="mb-1.5 block">{t("fromHoursTo")}</Label>
          <Input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </div>
      </div>

      <div className="mt-4">
        <p className="mb-2 text-sm font-semibold text-gray-900 dark:text-zinc-100">
          {t("fromHoursPreview")}
        </p>
        {loading ? (
          <p className="py-6 text-center text-sm text-gray-400">
            {tc("loading")}
          </p>
        ) : lines.length === 0 ? (
          <p className="py-6 text-center text-sm text-gray-400">
            {loaded ? t("fromHoursNothing") : ""}
          </p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-gray-100 dark:border-zinc-800">
            <table className="w-full text-sm">
              <tbody className="divide-y dark:divide-zinc-800">
                {lines.map((l) => (
                  <tr key={l.projectId}>
                    <td className="px-3 py-2 text-gray-700 dark:text-zinc-300">
                      {l.description}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-right text-gray-500 dark:text-zinc-400">
                      {l.quantity.toLocaleString("de-DE")} h
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-right font-medium">
                      {euro(Math.round(l.quantity * l.unitPriceCents))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {lines.length > 0 && (
          <p className="mt-2 text-right text-sm font-semibold text-gray-900 dark:text-zinc-100">
            {t("fromHoursNet")}: {euro(netCents)}
          </p>
        )}

        {/* What was NOT billed. The useful half of the preview. */}
        {skipped.length > 0 && (
          <div className="mt-3 rounded-xl bg-amber-50 p-3 dark:bg-amber-950/20">
            <p className="text-xs font-semibold text-amber-800 dark:text-amber-300">
              {t("fromHoursSkipped", { count: skipped.length })}
            </p>
            <ul className="mt-1.5 space-y-0.5">
              {Object.entries(skipGroups).map(([reason, count]) => (
                <li
                  key={reason}
                  className="text-xs text-amber-700 dark:text-amber-400"
                >
                  {count} × {t(`skip${reason}`)}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <ModalFooter>
        <Button variant="outline" onClick={onClose}>
          {tc("cancel")}
        </Button>
        <Button onClick={create} disabled={creating || lines.length === 0}>
          {t("fromHoursCreate")}
        </Button>
      </ModalFooter>
    </Modal>
  );
}

/* ───────────────────── DATEV-Export ───────────────────── */

/**
 * Export the issued invoices for the tax adviser.
 *
 * The two numbers come from the adviser, not from us, and the export is
 * useless without them -- so they are asked for rather than guessed.
 */
function DatevModal({ onClose }: { onClose: () => void }) {
  const t = useTranslations("invoicing");
  const defaults = lastMonthRange();

  const [from, setFrom] = useState(defaults.from);
  const [to, setTo] = useState(defaults.to);
  const [consultant, setConsultant] = useState("");
  const [client, setClient] = useState("");

  const qs = (format?: string) =>
    new URLSearchParams({
      from,
      to,
      consultantNumber: consultant,
      clientNumber: client,
      ...(format ? { format } : {}),
    }).toString();

  return (
    <Modal
      open
      onClose={onClose}
      size="md"
      title={t("datevTitle")}
      description={t("datevDesc")}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label className="mb-1.5 block">{t("fromHoursFrom")}</Label>
          <Input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
        </div>
        <div>
          <Label className="mb-1.5 block">{t("fromHoursTo")}</Label>
          <Input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </div>
        <div>
          <Label className="mb-1.5 block">{t("datevConsultant")}</Label>
          <Input
            value={consultant}
            onChange={(e) => setConsultant(e.target.value)}
            inputMode="numeric"
          />
        </div>
        <div>
          <Label className="mb-1.5 block">{t("datevClient")}</Label>
          <Input
            value={client}
            onChange={(e) => setClient(e.target.value)}
            inputMode="numeric"
          />
        </div>
      </div>
      <p className="mt-3 text-xs text-gray-500 dark:text-zinc-400">
        {t("datevHint")}
      </p>
      <ModalFooter>
        {/* The plain CSV needs no adviser numbers, so it stays available
            while the DATEV file is still missing them. */}
        <Button
          variant="outline"
          onClick={() =>
            window.open(`/api/invoices/export/datev?${qs("csv")}`, "_blank")
          }
        >
          {t("csvDownload")}
        </Button>
        <Button
          disabled={!consultant.trim() || !client.trim()}
          onClick={() =>
            window.open(`/api/invoices/export/datev?${qs()}`, "_blank")
          }
        >
          {t("datevDownload")}
        </Button>
      </ModalFooter>
    </Modal>
  );
}
