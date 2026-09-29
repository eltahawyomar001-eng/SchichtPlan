/**
 * @vitest-environment node
 *
 * Filenames for exported proof documents.
 *
 * These files leave the product: they are emailed to customers and filed by
 * Handwerksbetriebe alongside their other paperwork, so they have to follow the
 * convention German offices already use. DIN 5008 defers to DIN ISO 8601 for
 * dates, and the date leads the name because that is the one ordering every
 * operating system sorts correctly without being configured.
 */
import { describe, it, expect } from "vitest";

import {
  buildProofFilename,
  singlePhotoFilename,
  slugForFilename,
} from "@/lib/work-proof-pdf";

describe("slugForFilename", () => {
  it("transliterates umlauts rather than dropping them", () => {
    // "Grünanlage" must stay readable as "Gruenanlage". Stripping the umlaut
    // would leave "Grnanlage", which nobody can match back to the object.
    expect(slugForFilename("Grünanlage Süd")).toBe("Gruenanlage-Sued");
    expect(slugForFilename("Straße")).toBe("Strasse");
    expect(slugForFilename("Öffentlich")).toBe("Oeffentlich");
  });

  it("replaces anything a filesystem or mail client would mangle", () => {
    expect(slugForFilename("Objekt 12 / Halle B")).toBe("Objekt-12-Halle-B");
    expect(slugForFilename("NH Baulogistik GmbH & Co. KG")).toBe(
      "NH-Baulogistik-GmbH-Co-KG",
    );
  });

  it("never leaves a leading or trailing separator", () => {
    expect(slugForFilename("  Hof  ")).toBe("Hof");
    expect(slugForFilename("//Hof//")).toBe("Hof");
  });

  it("caps the length so the whole filename stays usable", () => {
    expect(slugForFilename("A".repeat(200)).length).toBeLessThanOrEqual(60);
  });
});

describe("buildProofFilename", () => {
  it("leads with the ISO date so files sort chronologically", () => {
    expect(
      buildProofFilename({
        from: "2026-09-28",
        to: "2026-09-28",
        location: "NH Baulogistik",
      }),
    ).toBe("2026-09-28_Leistungsnachweis_NH-Baulogistik.pdf");
  });

  it("spans a range in German when the export covers several days", () => {
    expect(
      buildProofFilename({
        from: "2026-09-01",
        to: "2026-09-28",
        location: "NH Baulogistik",
      }),
    ).toBe("2026-09-01_bis_2026-09-28_Leistungsnachweise_NH-Baulogistik.pdf");
  });

  it("names the employee when the export is filtered to one", () => {
    expect(
      buildProofFilename({
        from: "2026-09-28",
        to: "2026-09-28",
        location: "Grünanlage Süd",
        employee: "Rageh-Omar",
      }),
    ).toBe("2026-09-28_Leistungsnachweis_Gruenanlage-Sued_Rageh-Omar.pdf");
  });

  it("says so plainly when no single object applies", () => {
    expect(
      buildProofFilename({
        from: "2026-09-28",
        to: "2026-09-28",
        location: null,
      }),
    ).toBe("2026-09-28_Leistungsnachweis_Alle-Objekte.pdf");
  });
});

describe("singlePhotoFilename", () => {
  it("keeps the ISO date lead and adds the capture time", () => {
    // Same convention as the PDF so a single photo files next to the document
    // it could have come from, with the time disambiguating rounds on one day.
    const name = singlePhotoFilename({
      capturedAt: "2026-09-28T05:12:00",
      location: { name: "NH Baulogistik" },
      employee: { firstName: "Omar", lastName: "Rageh" },
    });
    expect(name).toBe(
      "2026-09-28_0512_Leistungsnachweis_NH-Baulogistik_Rageh-Omar.jpg",
    );
  });

  it("still names a photo with no object or employee", () => {
    const name = singlePhotoFilename({ capturedAt: "2026-09-28T05:12:00" });
    expect(name).toBe("2026-09-28_0512_Leistungsnachweis_Alle-Objekte.jpg");
  });
});
