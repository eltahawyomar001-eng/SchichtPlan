"use client";

/**
 * The workspace's identity as an invoice issuer.
 *
 * Distinct from the workspace profile and from our own billing details: this
 * is what appears as the SUPPLIER on the invoices the customer sends to their
 * own clients, which is what § 14 Abs. 4 UStG governs. Getting it wrong costs
 * the recipient their input-tax deduction, and nothing visibly fails -- so the
 * form states what each field is for rather than leaving it to be guessed.
 */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Topbar } from "@/components/layout/topbar";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PageContent } from "@/components/ui/page-content";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { StatusBanner } from "@/components/ui/status-banner";
import {
  AlertTriangleIcon,
  CheckCircleIcon,
  ChevronLeftIcon,
} from "@/components/icons";

interface PreflightIssue {
  code: string;
  message: string;
  scope: string;
  basis?: string;
}

type Form = {
  legalName: string;
  tradingName: string;
  street: string;
  addressLine2: string;
  postalCode: string;
  city: string;
  countryCode: string;
  vatId: string;
  taxNumber: string;
  legalRegistrationId: string;
  kleinunternehmer: boolean;
  email: string;
  phone: string;
  contactName: string;
  contactPhone: string;
  contactEmail: string;
  bankName: string;
  iban: string;
  bic: string;
  numberPrefix: string;
  paymentTermDays: number;
  defaultFormat: "XRECHNUNG" | "ZUGFERD";
};

const EMPTY: Form = {
  legalName: "",
  tradingName: "",
  street: "",
  addressLine2: "",
  postalCode: "",
  city: "",
  countryCode: "DE",
  vatId: "",
  taxNumber: "",
  legalRegistrationId: "",
  kleinunternehmer: false,
  email: "",
  phone: "",
  contactName: "",
  contactPhone: "",
  contactEmail: "",
  bankName: "",
  iban: "",
  bic: "",
  numberPrefix: "RE",
  paymentTermDays: 14,
  defaultFormat: "XRECHNUNG",
};

export default function RechnungsstellungPage() {
  const t = useTranslations("invoiceIssuer");
  const tc = useTranslations("common");

  const [form, setForm] = useState<Form>(EMPTY);
  const [issues, setIssues] = useState<PreflightIssue[]>([]);
  const [loading, setLoading] = useState(true);
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">(
    "idle",
  );
  const [error, setError] = useState<string | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/settings/rechnungsstellung");
      if (!res.ok) {
        setLoadFailed(true);
        return;
      }
      const data = await res.json();
      if (data.profile) {
        // Nulls become empty strings: a controlled input given null warns and
        // then silently stops being controlled.
        const p = data.profile as Record<string, unknown>;
        setForm({
          ...EMPTY,
          ...Object.fromEntries(
            Object.keys(EMPTY).map((k) => [
              k,
              p[k] === null || p[k] === undefined
                ? EMPTY[k as keyof Form]
                : p[k],
            ]),
          ),
        } as Form);
      }
      setIssues(data.issues ?? []);
    } catch {
      setLoadFailed(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const set = <K extends keyof Form>(key: K, value: Form[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setState("saving");
    setError(null);
    try {
      const res = await fetch("/api/settings/rechnungsstellung", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        // The server's message is specific and already in the user's
        // language; a generic one here would hide which field is wrong.
        setError(
          data.error === "TAX_ID_REQUIRED"
            ? t("taxIdRequired")
            : (data.message ?? t("saveFailed")),
        );
        setState("error");
        return;
      }
      setState("saved");
      // Re-read so the readiness panel reflects what was actually stored
      // rather than what was typed.
      await load();
    } catch {
      setError(t("saveFailed"));
      setState("error");
    }
  }

  const ready = !loading && issues.length === 0 && form.legalName !== "";

  return (
    <>
      <Topbar title={t("title")} description={t("description")} />
      <PageContent>
        <Link
          href="/einstellungen"
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900 dark:text-zinc-400 dark:hover:text-zinc-100"
        >
          <ChevronLeftIcon className="h-4 w-4" />
          {tc("back")}
        </Link>

        {loadFailed && (
          <StatusBanner type="error" className="mt-4">
            {t("loadFailed")}
          </StatusBanner>
        )}

        {/* Readiness — the thing the customer actually wants to know. */}
        {!loading && !loadFailed && (
          <Card className="mt-4">
            <CardContent className="flex items-start gap-3 p-4 sm:p-6">
              {ready ? (
                <CheckCircleIcon className="mt-0.5 h-5 w-5 flex-shrink-0 text-emerald-600 dark:text-emerald-400" />
              ) : (
                <AlertTriangleIcon className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-600 dark:text-amber-400" />
              )}
              <div className="min-w-0">
                <p className="font-semibold text-gray-900 dark:text-zinc-100">
                  {ready ? t("readyTitle") : t("incompleteTitle")}
                </p>
                <p className="mt-0.5 text-sm text-gray-500 dark:text-zinc-400">
                  {ready ? t("readyDesc") : t("incompleteDesc")}
                </p>
                {!ready && issues.length > 0 && (
                  <ul className="mt-2 space-y-1.5">
                    {issues.map((i) => (
                      <li
                        key={i.code}
                        className="text-sm text-gray-700 dark:text-zinc-300"
                      >
                        <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-amber-500 align-middle" />
                        {i.message}
                        {/* The legal basis, so "why does it want this" has an
                            answer on the page rather than in a support
                            conversation. */}
                        {i.basis && (
                          <span className="ml-1 text-gray-400 dark:text-zinc-500">
                            ({i.basis})
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        <form onSubmit={save} className="mt-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{t("sectionCompany")}</CardTitle>
              <CardDescription>{t("sectionCompanyDesc")}</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <Field label={t("legalName")} className="sm:col-span-2">
                <Input
                  value={form.legalName}
                  onChange={(e) => set("legalName", e.target.value)}
                  placeholder={t("legalNamePlaceholder")}
                  required
                />
              </Field>
              <Field
                label={t("tradingName")}
                hint={t("tradingNameHint")}
                className="sm:col-span-2"
              >
                <Input
                  value={form.tradingName}
                  onChange={(e) => set("tradingName", e.target.value)}
                />
              </Field>
              <Field label={t("street")} className="sm:col-span-2">
                <Input
                  value={form.street}
                  onChange={(e) => set("street", e.target.value)}
                  required
                />
              </Field>
              <Field label={t("addressLine2")} className="sm:col-span-2">
                <Input
                  value={form.addressLine2}
                  onChange={(e) => set("addressLine2", e.target.value)}
                />
              </Field>
              <Field label={t("postalCode")}>
                <Input
                  value={form.postalCode}
                  onChange={(e) => set("postalCode", e.target.value)}
                  required
                />
              </Field>
              <Field label={t("city")}>
                <Input
                  value={form.city}
                  onChange={(e) => set("city", e.target.value)}
                  required
                />
              </Field>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t("sectionTax")}</CardTitle>
              <CardDescription>{t("sectionTaxDesc")}</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <Field label={t("vatId")}>
                <Input
                  value={form.vatId}
                  onChange={(e) => set("vatId", e.target.value)}
                  placeholder={t("vatIdPlaceholder")}
                />
              </Field>
              <Field label={t("taxNumber")}>
                <Input
                  value={form.taxNumber}
                  onChange={(e) => set("taxNumber", e.target.value)}
                  placeholder={t("taxNumberPlaceholder")}
                />
              </Field>
              <Field
                label={t("legalRegistrationId")}
                hint={t("legalRegistrationHint")}
                className="sm:col-span-2"
              >
                <Input
                  value={form.legalRegistrationId}
                  onChange={(e) => set("legalRegistrationId", e.target.value)}
                />
              </Field>
              <label className="flex cursor-pointer items-start gap-3 sm:col-span-2">
                <input
                  type="checkbox"
                  checked={form.kleinunternehmer}
                  onChange={(e) => set("kleinunternehmer", e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500 dark:border-zinc-600 dark:bg-zinc-800"
                />
                <span>
                  <span className="block text-sm font-medium text-gray-900 dark:text-zinc-100">
                    {t("kleinunternehmer")}
                  </span>
                  <span className="mt-0.5 block text-sm text-gray-500 dark:text-zinc-400">
                    {t("kleinunternehmerHint")}
                  </span>
                </span>
              </label>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t("sectionContact")}</CardTitle>
              <CardDescription>{t("sectionContactDesc")}</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <Field label={t("email")}>
                <Input
                  type="email"
                  value={form.email}
                  onChange={(e) => set("email", e.target.value)}
                />
              </Field>
              <Field label={t("phone")}>
                <Input
                  value={form.phone}
                  onChange={(e) => set("phone", e.target.value)}
                />
              </Field>
              <Field label={t("contactName")}>
                <Input
                  value={form.contactName}
                  onChange={(e) => set("contactName", e.target.value)}
                />
              </Field>
              <Field label={t("contactPhone")}>
                <Input
                  value={form.contactPhone}
                  onChange={(e) => set("contactPhone", e.target.value)}
                />
              </Field>
              <Field label={t("contactEmail")} className="sm:col-span-2">
                <Input
                  type="email"
                  value={form.contactEmail}
                  onChange={(e) => set("contactEmail", e.target.value)}
                />
              </Field>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t("sectionBank")}</CardTitle>
              <CardDescription>{t("sectionBankDesc")}</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <Field label={t("bankName")} className="sm:col-span-2">
                <Input
                  value={form.bankName}
                  onChange={(e) => set("bankName", e.target.value)}
                />
              </Field>
              <Field label={t("iban")}>
                <Input
                  value={form.iban}
                  onChange={(e) => set("iban", e.target.value)}
                />
              </Field>
              <Field label={t("bic")}>
                <Input
                  value={form.bic}
                  onChange={(e) => set("bic", e.target.value)}
                />
              </Field>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t("sectionInvoice")}</CardTitle>
              <CardDescription>{t("sectionInvoiceDesc")}</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <Field label={t("numberPrefix")} hint={t("numberPrefixHint")}>
                <Input
                  value={form.numberPrefix}
                  onChange={(e) => set("numberPrefix", e.target.value)}
                  required
                />
              </Field>
              <Field label={t("paymentTermDays")}>
                <Input
                  type="number"
                  min={0}
                  max={365}
                  value={form.paymentTermDays}
                  onChange={(e) =>
                    set("paymentTermDays", Number(e.target.value))
                  }
                />
              </Field>
              <Field
                label={t("defaultFormat")}
                hint={
                  form.defaultFormat === "XRECHNUNG"
                    ? t("formatXRechnungHint")
                    : t("formatZugferdUnavailable")
                }
                className="sm:col-span-2"
              >
                <Select
                  value={form.defaultFormat}
                  onChange={(e) =>
                    set(
                      "defaultFormat",
                      e.target.value as Form["defaultFormat"],
                    )
                  }
                >
                  <option value="XRECHNUNG">{t("formatXRechnung")}</option>
                  {/* Listed but marked: the container is not built, and
                      silently omitting it would read as an oversight. */}
                  <option value="ZUGFERD">
                    {t("formatZugferd")} — {t("formatZugferdUnavailable")}
                  </option>
                </Select>
              </Field>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 sm:p-6">
              <p className="text-sm text-gray-500 dark:text-zinc-400">
                {t("legalHint")}
              </p>
              {error && (
                <StatusBanner type="error" className="mt-3">
                  {error}
                </StatusBanner>
              )}
              {state === "saved" && (
                <StatusBanner type="success" className="mt-3">
                  {t("saved")}
                </StatusBanner>
              )}
              <div className="mt-4 flex justify-end">
                <Button type="submit" disabled={state === "saving" || loading}>
                  {state === "saving" ? t("saving") : t("save")}
                </Button>
              </div>
            </CardContent>
          </Card>
        </form>
      </PageContent>
    </>
  );
}

/** Label, control and optional explanation, so the grid stays readable. */
function Field({
  label,
  hint,
  className,
  children,
}: {
  label: string;
  hint?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={className}>
      <Label className="mb-1.5 block">{label}</Label>
      {children}
      {hint && (
        <p className="mt-1 text-xs text-gray-500 dark:text-zinc-400">{hint}</p>
      )}
    </div>
  );
}
