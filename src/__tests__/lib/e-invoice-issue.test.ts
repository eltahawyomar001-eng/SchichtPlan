/**
 * Issuing, which cannot be undone.
 *
 * The properties worth defending are not about the XML -- the KoSIT validator
 * covers that -- but about what happens to the sequence and the record:
 *
 *   a number is drawn only when the document is actually written,
 *   issuing twice produces one number rather than two,
 *   and an incomplete invoice consumes nothing.
 *
 * Each of those failing produces a gap in a sequence that GoBD requires to be
 * gapless, and a gap cannot be repaired afterwards -- only explained to an
 * auditor.
 *
 * The transaction is faked rather than hitting Postgres so these can assert on
 * ordering and on what was NOT called, which is the interesting half.
 */
import { describe, it, expect, vi } from "vitest";
import { issueInvoiceInTx, xmlChecksum } from "@/lib/e-invoice/issue";

const ISSUER = {
  legalName: "Musterreinigung Rhein-Neckar GmbH",
  street: "Industriestraße 14",
  postalCode: "68161",
  city: "Mannheim",
  countryCode: "DE",
  vatId: "DE123456789",
  taxNumber: null,
  legalRegistrationId: null,
  kleinunternehmer: false,
  email: "rechnung@musterreinigung.example",
  phone: "+49 621 1234560",
  contactName: "Sabine Vogt",
  contactPhone: null,
  contactEmail: null,
  addressLine2: null,
  tradingName: null,
  bankName: null,
  iban: "DE02120300000000202051",
  bic: "BYLADEM1001",
  paymentTermDays: 14,
  // Widened so a test can set the other value.
  defaultFormat: "XRECHNUNG" as "XRECHNUNG" | "ZUGFERD",
};

// Widened deliberately: each of these is a field a test needs to blank out or
// fill in, and the inferred literal types would not allow either.
const CLIENT: {
  name: string;
  street: string | null;
  postalCode: string | null;
  city: string | null;
  countryCode: string;
  vatId: string | null;
  leitwegId: string | null;
  invoiceEmail: string | null;
  email: string | null;
  preferredFormat: "XRECHNUNG" | "ZUGFERD" | null;
} = {
  name: "Beispiel Immobilienverwaltung GmbH",
  street: "Parkallee 88",
  postalCode: "60322",
  city: "Frankfurt am Main",
  countryCode: "DE",
  vatId: null,
  leitwegId: null,
  invoiceEmail: "kreditoren@beispiel-immobilien.example",
  email: null,
  preferredFormat: null,
};

const INVOICE = {
  id: "inv_1",
  number: null as string | null,
  issuedAt: null as Date | null,
  sentAt: null as Date | null,
  issueDate: new Date("2026-10-03"),
  dueDate: new Date("2026-10-17"),
  vatRate: 19,
  title: null,
  notes: null,
  reverseCharge: false,
  correctsInvoiceId: null as string | null,
  corrects: null as { number: string; issueDate: Date } | null,
  items: [
    {
      description: "Unterhaltsreinigung September 2026",
      quantity: 10,
      unitPriceCents: 2850,
      vatRate: null,
      unitCode: "HUR",
      position: 0,
    },
  ],
};

/** A transaction client that records what was asked of it. */
function fakeTx(
  over: {
    invoice?: Partial<typeof INVOICE> | null;
    issuer?: Partial<typeof ISSUER> | null;
    client?: Partial<typeof CLIENT> | null;
    lastNumber?: number;
  } = {},
) {
  const invoice =
    over.invoice === null
      ? null
      : {
          ...INVOICE,
          ...over.invoice,
          client:
            over.client === null ? null : { ...CLIENT, ...(over.client ?? {}) },
        };
  const issuer =
    over.issuer === null ? null : { ...ISSUER, ...(over.issuer ?? {}) };

  const update = vi.fn().mockResolvedValue({});
  const upsert = vi
    .fn()
    .mockResolvedValue({ lastNumber: over.lastNumber ?? 1 });

  return {
    update,
    upsert,
    tx: {
      customerInvoice: {
        findFirst: vi.fn().mockResolvedValue(invoice),
        update,
      },
      invoiceIssuerProfile: {
        findUnique: vi.fn().mockResolvedValue(issuer),
      },
      invoiceSequence: { upsert },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any,
  };
}

const issue = (f: ReturnType<typeof fakeTx>) =>
  issueInvoiceInTx(f.tx, {
    invoiceId: "inv_1",
    workspaceId: "ws_1",
    now: new Date("2026-10-03T09:00:00Z"),
  });

describe("the happy path", () => {
  it("draws a number and archives the XML", async () => {
    const f = fakeTx({ lastNumber: 7 });
    const result = await issue(f);

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(`expected success, got ${result.code}`);
    expect(result.number).toBe("RE-2026-0007");
    expect(result.xml).toContain("<rsm:CrossIndustryInvoice");
    expect(result.xml).toContain("RE-2026-0007");
  });

  it("writes the number, the XML, the checksum and issuedAt together", async () => {
    // All five in one update. Writing the number without the document is the
    // gap the sequence exists to prevent.
    const f = fakeTx();
    await issue(f);

    const data = f.update.mock.calls[0][0].data;
    expect(data.number).toBe("RE-2026-0001");
    expect(data.issuedAt).toEqual(new Date("2026-10-03T09:00:00Z"));
    expect(data.einvoiceXml).toContain("CrossIndustryInvoice");
    expect(data.einvoiceSha256).toHaveLength(64);
    expect(data.einvoiceFormat).toBe("XRECHNUNG");
  });

  it("stores a checksum of exactly what it archived", async () => {
    // This is what lets an audit show the archived copy is the one that was
    // issued, so the two must not be computed from different strings.
    const f = fakeTx();
    const result = await issue(f);
    if (!result.ok) throw new Error(`expected success, got ${result.code}`);
    expect(result.sha256).toBe(xmlChecksum(result.xml));
    expect(f.update.mock.calls[0][0].data.einvoiceSha256).toBe(result.sha256);
  });

  it("marks the invoice sent without overwriting an existing sentAt", async () => {
    const earlier = new Date("2026-10-01T08:00:00Z");
    const f = fakeTx({ invoice: { sentAt: earlier } });
    await issue(f);
    expect(f.update.mock.calls[0][0].data.sentAt).toEqual(earlier);
  });
});

describe("issuing twice", () => {
  it("refuses, rather than drawing a second number", async () => {
    // A double-submitted form must not produce two numbers for one document.
    const f = fakeTx({
      invoice: { issuedAt: new Date("2026-10-02"), number: "RE-2026-0003" },
    });
    const result = await issue(f);

    expect(result).toEqual({
      ok: false,
      code: "ALREADY_ISSUED",
      number: "RE-2026-0003",
    });
    expect(f.upsert).not.toHaveBeenCalled();
    expect(f.update).not.toHaveBeenCalled();
  });
});

describe("an invoice that is not ready", () => {
  it("consumes no number when preflight fails", async () => {
    // The whole point of checking first: a blocked invoice must leave the
    // sequence untouched, or every failed attempt tears a hole in it.
    const f = fakeTx({ issuer: null });
    const result = await issue(f);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("PREFLIGHT_FAILED");
    expect(f.upsert).not.toHaveBeenCalled();
    expect(f.update).not.toHaveBeenCalled();
  });

  it("reports what is missing", async () => {
    const f = fakeTx({ client: { street: null, postalCode: null } });
    const result = await issue(f);
    if (result.ok || result.code !== "PREFLIGHT_FAILED")
      throw new Error("expected preflight failure");
    expect(result.issues.map((i) => i.code)).toContain(
      "CLIENT_ADDRESS_INCOMPLETE",
    );
  });

  it("blocks when the invoice has no client at all", async () => {
    const f = fakeTx({ client: null });
    const result = await issue(f);
    expect(result.ok).toBe(false);
    expect(f.update).not.toHaveBeenCalled();
  });

  it("returns NOT_FOUND for an invoice in another workspace", async () => {
    // findFirst is scoped by workspaceId, so a foreign id simply misses --
    // and must not leak that it exists.
    const f = fakeTx({ invoice: null });
    expect(await issue(f)).toEqual({ ok: false, code: "NOT_FOUND" });
  });
});

describe("format selection", () => {
  it("uses the issuer default", async () => {
    const f = fakeTx();
    const result = await issue(f);
    if (!result.ok) throw new Error(`expected success, got ${result.code}`);
    expect(result.format).toBe("XRECHNUNG");
    expect(result.xml).toContain("xrechnung_3.0");
  });

  it("lets the recipient's preference win over our default", async () => {
    // A recipient that insists on one syntax will bounce the other, no matter
    // what our default says.
    const f = fakeTx({
      issuer: { defaultFormat: "ZUGFERD" },
      client: { preferredFormat: "XRECHNUNG" },
    });
    const result = await issue(f);
    if (!result.ok) throw new Error(`expected success, got ${result.code}`);
    expect(result.format).toBe("XRECHNUNG");
  });

  it("lets an explicit request win over both", async () => {
    const f = fakeTx({ issuer: { defaultFormat: "ZUGFERD" } });
    const result = await issueInvoiceInTx(f.tx, {
      invoiceId: "inv_1",
      workspaceId: "ws_1",
      format: "XRECHNUNG",
    });
    if (!result.ok) throw new Error(`expected success, got ${result.code}`);
    expect(result.format).toBe("XRECHNUNG");
  });

  it("refuses ZUGFeRD rather than emitting bare XML under its name", async () => {
    // The PDF/A-3 container is not built. A file claiming ZUGFeRD without
    // the embedded-file structure is rejected by the recipient, so refusing
    // is the honest outcome -- and it must happen BEFORE a number is drawn.
    const f = fakeTx({ issuer: { defaultFormat: "ZUGFERD" } });
    const result = await issue(f);
    expect(result).toEqual({
      ok: false,
      code: "FORMAT_UNAVAILABLE",
      format: "ZUGFERD",
    });
    expect(f.upsert).not.toHaveBeenCalled();
    expect(f.update).not.toHaveBeenCalled();
  });
});

describe("a Storno", () => {
  it("is emitted as a credit note naming the original", async () => {
    const f = fakeTx({
      invoice: {
        correctsInvoiceId: "inv_0",
        corrects: {
          number: "RE-2026-0001",
          issueDate: new Date("2026-09-01"),
        },
      },
    });
    const result = await issue(f);
    if (!result.ok) throw new Error("expected the storno to be issued");
    // BT-3 = 381 is what conveys the reversal; the amounts stay positive
    // because BR-27 forbids a negative item net price.
    expect(result.xml).toContain("<ram:TypeCode>381</ram:TypeCode>");
    expect(result.xml).toContain("RE-2026-0001");
    expect(result.xml).not.toContain(">-");
  });

  it("is blocked when it does not say what it reverses", async () => {
    const f = fakeTx({
      invoice: { correctsInvoiceId: "inv_0", corrects: null },
    });
    const result = await issue(f);
    if (result.ok || result.code !== "PREFLIGHT_FAILED")
      throw new Error("expected preflight failure");
    expect(result.issues.map((i) => i.code)).toContain(
      "CORRECTION_REFERENCE_MISSING",
    );
  });
});

describe("legacy drafts", () => {
  it("keeps a number the draft already had", async () => {
    // Drafts created before numbering moved to issue time already show a
    // number to the user. Drawing a second one would mean the document the
    // customer saw and the document we archived have different numbers.
    const f = fakeTx({ invoice: { number: "RE-2026-0099" } });
    const result = await issue(f);
    if (!result.ok) throw new Error(`expected success, got ${result.code}`);
    expect(result.number).toBe("RE-2026-0099");
    expect(f.upsert).not.toHaveBeenCalled();
  });
});

describe("the checksum", () => {
  it("is stable for identical input", async () => {
    expect(xmlChecksum("<a/>")).toBe(xmlChecksum("<a/>"));
  });

  it("changes when a single character changes", async () => {
    expect(xmlChecksum("<a/>")).not.toBe(xmlChecksum("<a />"));
  });
});
