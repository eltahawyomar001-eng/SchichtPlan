/**
 * ZUGFeRD: a PDF carrying the invoice XML inside it.
 *
 * One file that a person can read and a machine can book. That is the whole
 * appeal, and it is why ZUGFeRD is the common B2B choice in the DACH region
 * where XRechnung is mandated mainly for public bodies.
 *
 * It is NOT "a PDF with the XML stapled on". A consumer looks for specific
 * structure, and this builds all of it:
 *
 *   1. The XML embedded as a named file with AFRelationship /Alternative and
 *      listed in the document's /AF array -- that array is what importers scan.
 *   2. XMP metadata declaring the ZUGFeRD version, profile and filename in the
 *      Factur-X namespace, with the extension schema PDF/A requires for any
 *      non-standard property.
 *   3. PDF/A identification (pdfaid:part 3, conformance B).
 *   4. An OutputIntent, since PDF/A requires colour to be unambiguous.
 *
 * ── What this does NOT yet achieve ──
 *
 * Strict PDF/A-3B conformance. veraPDF reports three failures, two of them
 * clauses 6.2.4.3-2 and 6.2.4.3-4: PDF/A requires EVERY font to be embedded,
 * including the standard 14, and the PDF layer is rendered by jsPDF using
 * built-in Helvetica.
 *
 * Fixing it honestly means embedding a font, and jsPDF does not subset: the
 * vendored DejaVu Sans regular and bold come to about 1.4 MB, added to every
 * invoice emailed to a customer. Subsetting would bring that under 50 kB but
 * requires drawing the invoice with pdf-lib instead, which means rewriting a
 * renderer that is already in production.
 *
 * So the file is a genuine hybrid -- the XML round-trips out of it byte for
 * byte, which is what every real consumer actually does with it -- but it is
 * not an archival PDF/A-3, and nothing here or in the UI claims it is. The
 * default output format stays XRechnung for that reason.
 *
 * scripts/validate-zugferd.sh reproduces the veraPDF result.
 */

import { inflateSync } from "node:zlib";
import {
  AFRelationship,
  PDFArray,
  PDFDict,
  PDFDocument,
  PDFHexString,
  PDFName,
  PDFRawStream,
  PDFString,
} from "pdf-lib";

/** The EN 16931 (COMFORT) profile. The one a B2B invoice needs. */
export const ZUGFERD_PROFILE = "EN 16931";
export const ZUGFERD_VERSION = "2p1";

/**
 * The embedded file's name, which is part of the specification rather than a
 * choice. ZUGFeRD 2.x and Factur-X both look for exactly this, and an
 * importer that cannot find it falls back to treating the file as a plain PDF.
 */
export const ZUGFERD_FILENAME = "factur-x.xml";

/** XMP packet declaring PDF/A-3B and the ZUGFeRD attachment. */
function buildXmp(invoiceNumber: string): string {
  const esc = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  // The ZUGFeRD extension schema description is not decoration: PDF/A requires
  // every XMP property outside the standard schemas to be DESCRIBED in the
  // metadata, and a validator reports the file as non-conforming without it.
  return `<?xpacket begin="﻿" id="W5M0MpCehiHzreSzNTczkc9d"?>
<x:xmpmeta xmlns:x="adobe:ns:meta/">
  <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
    <rdf:Description rdf:about="" xmlns:pdfaid="http://www.aiim.org/pdfa/ns/id/">
      <pdfaid:part>3</pdfaid:part>
      <pdfaid:conformance>B</pdfaid:conformance>
    </rdf:Description>
    <rdf:Description rdf:about="" xmlns:dc="http://purl.org/dc/elements/1.1/">
      <dc:title><rdf:Alt><rdf:li xml:lang="x-default">Rechnung ${esc(invoiceNumber)}</rdf:li></rdf:Alt></dc:title>
    </rdf:Description>
    <rdf:Description rdf:about="" xmlns:pdf="http://ns.adobe.com/pdf/1.3/">
      <pdf:Producer>Shiftfy</pdf:Producer>
    </rdf:Description>
    <rdf:Description rdf:about=""
        xmlns:pdfaExtension="http://www.aiim.org/pdfa/ns/extension/"
        xmlns:pdfaSchema="http://www.aiim.org/pdfa/ns/schema#"
        xmlns:pdfaProperty="http://www.aiim.org/pdfa/ns/property#">
      <pdfaExtension:schemas>
        <rdf:Bag>
          <rdf:li rdf:parseType="Resource">
            <pdfaSchema:schema>Factur-X PDFA Extension Schema</pdfaSchema:schema>
            <pdfaSchema:namespaceURI>urn:factur-x:pdfa:CrossIndustryDocument:invoice:1p0#</pdfaSchema:namespaceURI>
            <pdfaSchema:prefix>fx</pdfaSchema:prefix>
            <pdfaSchema:property>
              <rdf:Seq>
                <rdf:li rdf:parseType="Resource">
                  <pdfaProperty:name>DocumentFileName</pdfaProperty:name>
                  <pdfaProperty:valueType>Text</pdfaProperty:valueType>
                  <pdfaProperty:category>external</pdfaProperty:category>
                  <pdfaProperty:description>Name of the embedded XML invoice file</pdfaProperty:description>
                </rdf:li>
                <rdf:li rdf:parseType="Resource">
                  <pdfaProperty:name>DocumentType</pdfaProperty:name>
                  <pdfaProperty:valueType>Text</pdfaProperty:valueType>
                  <pdfaProperty:category>external</pdfaProperty:category>
                  <pdfaProperty:description>INVOICE</pdfaProperty:description>
                </rdf:li>
                <rdf:li rdf:parseType="Resource">
                  <pdfaProperty:name>Version</pdfaProperty:name>
                  <pdfaProperty:valueType>Text</pdfaProperty:valueType>
                  <pdfaProperty:category>external</pdfaProperty:category>
                  <pdfaProperty:description>The version of the ZUGFeRD data</pdfaProperty:description>
                </rdf:li>
                <rdf:li rdf:parseType="Resource">
                  <pdfaProperty:name>ConformanceLevel</pdfaProperty:name>
                  <pdfaProperty:valueType>Text</pdfaProperty:valueType>
                  <pdfaProperty:category>external</pdfaProperty:category>
                  <pdfaProperty:description>The conformance level of the embedded data</pdfaProperty:description>
                </rdf:li>
              </rdf:Seq>
            </pdfaSchema:property>
          </rdf:li>
        </rdf:Bag>
      </pdfaExtension:schemas>
    </rdf:Description>
    <rdf:Description rdf:about=""
        xmlns:fx="urn:factur-x:pdfa:CrossIndustryDocument:invoice:1p0#">
      <fx:DocumentType>INVOICE</fx:DocumentType>
      <fx:DocumentFileName>${ZUGFERD_FILENAME}</fx:DocumentFileName>
      <fx:Version>1.0</fx:Version>
      <fx:ConformanceLevel>${ZUGFERD_PROFILE}</fx:ConformanceLevel>
    </rdf:Description>
  </rdf:RDF>
</x:xmpmeta>
<?xpacket end="w"?>`;
}

/**
 * Wrap an existing PDF and its CII XML into a ZUGFeRD file.
 *
 * The PDF comes in already rendered -- this adds the container, it does not
 * draw anything.
 */
export async function buildZugferdPdf(input: {
  pdf: ArrayBuffer | Uint8Array;
  xml: string;
  invoiceNumber: string;
}): Promise<Uint8Array> {
  const doc = await PDFDocument.load(input.pdf);

  const xmlBytes = new TextEncoder().encode(input.xml);

  // AFRelationship /Alternative says the attachment is an alternative
  // REPRESENTATION of the same invoice, not a supplementary document. An
  // importer uses that to tell the invoice data apart from, say, a timesheet
  // the sender also attached.
  await doc.attach(xmlBytes, ZUGFERD_FILENAME, {
    mimeType: "application/xml",
    description: "Rechnungsdaten im ZUGFeRD-Format (CII)",
    afRelationship: AFRelationship.Alternative,
    creationDate: new Date(),
    modificationDate: new Date(),
  });

  doc.setTitle(`Rechnung ${input.invoiceNumber}`);
  doc.setProducer("Shiftfy");
  doc.setCreator("Shiftfy");

  // ── PDF/A identification ──
  //
  // pdf-lib writes its own metadata stream, so the XMP is replaced wholesale
  // afterwards rather than appended to.
  const xmp = buildXmp(input.invoiceNumber);
  const metadataStream = doc.context.stream(xmp, {
    Type: "Metadata",
    Subtype: "XML",
    Length: xmp.length,
  });
  const metadataRef = doc.context.register(metadataStream);
  doc.catalog.set(PDFName.of("Metadata"), metadataRef);

  // ── OutputIntent ──
  //
  // PDF/A requires colour to be unambiguous. A device-independent intent is
  // declared by NAME here rather than by embedding an ICC profile: embedding
  // sRGB would add roughly half a megabyte to every invoice, and the
  // identifier is what importers key on.
  const outputIntent = doc.context.obj({
    Type: PDFName.of("OutputIntent"),
    S: PDFName.of("GTS_PDFA1"),
    OutputConditionIdentifier: PDFString.of("sRGB"),
    RegistryName: PDFString.of("http://www.color.org"),
    Info: PDFString.of("sRGB IEC61966-2.1"),
  });
  doc.catalog.set(PDFName.of("OutputIntents"), doc.context.obj([outputIntent]));

  // A document ID is required by PDF/A and pdf-lib does not add one.
  const id = PDFHexString.of(
    Array.from({ length: 16 }, () =>
      Math.floor(Math.random() * 256)
        .toString(16)
        .padStart(2, "0"),
    ).join(""),
  );
  doc.context.trailerInfo.ID = doc.context.obj([id, id]);

  return doc.save({ useObjectStreams: false });
}

/**
 * The embedded XML from a ZUGFeRD file, or null.
 *
 * Needed on the receiving side: a supplier sending ZUGFeRD sends a PDF, and
 * the bookable document is inside it.
 *
 * The attachment stream is Flate-compressed -- pdf-lib compresses it on the
 * way in and `getContents()` hands back the raw bytes -- so it has to be
 * inflated rather than decoded directly. Reading it without that yields
 * binary noise that looks like a corrupt invoice rather than a compressed one.
 */
export async function extractZugferdXml(
  pdf: ArrayBuffer | Uint8Array,
): Promise<string | null> {
  const doc = await PDFDocument.load(pdf, { ignoreEncryption: true });

  // lookupMaybe, not lookup: the typed lookup THROWS when the key is absent,
  // so an ordinary PDF with no attachments crashed here instead of returning
  // null -- and an ordinary PDF is exactly what a supplier who does not send
  // ZUGFeRD will hand us.
  const names = doc.catalog.lookupMaybe(PDFName.of("Names"), PDFDict);
  const embedded = names?.lookupMaybe(PDFName.of("EmbeddedFiles"), PDFDict);
  const arr = embedded?.lookupMaybe(PDFName.of("Names"), PDFArray);
  if (!arr) return null;

  // Pairs of [name, fileSpec].
  for (let i = 0; i + 1 < arr.size(); i += 2) {
    const spec = arr.lookupMaybe(i + 1, PDFDict);
    const ef = spec?.lookupMaybe(PDFName.of("EF"), PDFDict);
    const stream = ef?.lookup(PDFName.of("F"));
    if (!stream || !("getContents" in stream)) continue;

    const raw = (stream as PDFRawStream).getContents();
    const filter = (stream as PDFRawStream).dict.get(PDFName.of("Filter"));
    let bytes: Uint8Array = raw;
    if (String(filter).includes("FlateDecode")) {
      try {
        bytes = new Uint8Array(inflateSync(Buffer.from(raw)));
      } catch {
        // A stream we cannot inflate is not the invoice; try the next
        // attachment rather than failing the whole extraction.
        continue;
      }
    }

    const text = new TextDecoder().decode(bytes);
    // Any XML attachment is accepted rather than only factur-x.xml: ZUGFeRD 1.x
    // used ZUGFeRD-invoice.xml, and files in the wild still carry either.
    if (text.includes("CrossIndustryInvoice") || text.includes("<Invoice")) {
      return text;
    }
  }
  return null;
}
