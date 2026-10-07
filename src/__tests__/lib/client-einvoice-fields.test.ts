/**
 * The client fields an e-invoice cannot do without.
 *
 * These existed on the Prisma model but not in the validation schema, so the
 * API accepted them and then silently dropped every one. The effect was not a
 * missing field somewhere: preflight requires a structured address (BG-8), so
 * NO invoice could be issued for any client created through the API, and
 * nothing in the UI explained why.
 *
 * A schema test rather than a route test, because the schema is where the
 * fields went missing, and it is the thing that would silently lose them
 * again.
 */
import { describe, it, expect } from "vitest";
import { createClientSchema, updateClientSchema } from "@/lib/validations";

const full = {
  name: "Rheinpark Immobilienverwaltung GmbH",
  email: "info@rheinpark.example",
  street: "Parkallee 88",
  postalCode: "60322",
  city: "Frankfurt am Main",
  countryCode: "de",
  vatId: "DE987654321",
  leitwegId: "991-12345-67",
  invoiceEmail: "kreditoren@rheinpark.example",
  preferredFormat: "XRECHNUNG" as const,
};

describe("createClientSchema", () => {
  it("keeps the structured address", () => {
    const r = createClientSchema.safeParse(full);
    expect(r.success).toBe(true);
    if (!r.success) return;
    expect(r.data.street).toBe("Parkallee 88");
    expect(r.data.postalCode).toBe("60322");
    expect(r.data.city).toBe("Frankfurt am Main");
  });

  it("keeps the VAT ID, which the client needs to deduct input tax", () => {
    const r = createClientSchema.safeParse(full);
    expect(r.success && r.data.vatId).toBe("DE987654321");
  });

  it("keeps the Leitweg-ID, which is what makes an invoice B2G", () => {
    const r = createClientSchema.safeParse(full);
    expect(r.success && r.data.leitwegId).toBe("991-12345-67");
  });

  it("keeps the invoicing email separate from the contact one", () => {
    // Accounts payable is usually not the person we otherwise talk to.
    const r = createClientSchema.safeParse(full);
    expect(r.success && r.data.invoiceEmail).toBe(
      "kreditoren@rheinpark.example",
    );
  });

  it("upper-cases the country code", () => {
    // EN 16931 wants ISO 3166-1 alpha-2, and a lower-case code is rejected.
    const r = createClientSchema.safeParse(full);
    expect(r.success && r.data.countryCode).toBe("DE");
  });

  it("still accepts a client with only a name", () => {
    // The e-invoice fields are needed to ISSUE, not to record a client.
    expect(createClientSchema.safeParse({ name: "Nur ein Name" }).success).toBe(
      true,
    );
  });

  it("rejects a country code that is not two letters", () => {
    expect(
      createClientSchema.safeParse({ ...full, countryCode: "DEU" }).success,
    ).toBe(false);
  });
});

describe("updateClientSchema", () => {
  it("accepts the e-invoice fields on their own", () => {
    // Filling these in later, on an existing client, is the normal path.
    const r = updateClientSchema.safeParse({
      street: "Parkallee 88",
      postalCode: "60322",
      city: "Frankfurt am Main",
    });
    expect(r.success).toBe(true);
    if (!r.success) return;
    expect(r.data.city).toBe("Frankfurt am Main");
  });

  it("allows clearing a field with null", () => {
    const r = updateClientSchema.safeParse({ leitwegId: null });
    expect(r.success).toBe(true);
  });
});
