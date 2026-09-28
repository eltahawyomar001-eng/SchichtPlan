import { jsPDF } from "jspdf";

/**
 * Export proof photos as a single PDF an owner can file, email or hand to a
 * customer in a dispute.
 *
 * The photos exist to settle "was this actually done, and when". That argument
 * happens in email and in front of a Kunde, not inside our dashboard, so the
 * evidence has to leave the app as one self-contained document rather than as
 * a folder of signed URLs that expire in ten minutes.
 */

export interface ProofForExport {
  id: string;
  capturedAt: string;
  url?: string | null;
  address?: string | null;
  note?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  accuracyM?: number | null;
  distanceM?: number | null;
  geofenceStatus?: string | null;
  employee?: { firstName: string; lastName: string } | null;
  location?: { name: string } | null;
}

/**
 * Make one filename component safe.
 *
 * German umlauts are transliterated rather than stripped: "Grünanlage" must
 * stay readable as "Gruenanlage", not decay into "Grnanlage". Everything else
 * outside [A-Za-z0-9] collapses to a hyphen, because a filename that travels
 * by email and through Windows, macOS and Linux cannot carry spaces, slashes
 * or punctuation and survive intact.
 */
export function slugForFilename(value: string): string {
  return value
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/Ä/g, "Ae")
    .replace(/Ö/g, "Oe")
    .replace(/Ü/g, "Ue")
    .replace(/ß/g, "ss")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

/**
 * Build the filename.
 *
 * DIN 5008 defers to DIN ISO 8601 for dates, and the date leads the name on
 * purpose: it is the one ordering every operating system sorts correctly
 * without being told. Shape:
 *
 *   2026-09-28_Leistungsnachweis_NH-Baulogistik_Rageh-Omar.pdf
 *   2026-09-01_bis_2026-09-28_Leistungsnachweise_Alle-Objekte.pdf
 */
export function buildProofFilename(opts: {
  from: string;
  to: string;
  location?: string | null;
  employee?: string | null;
}): string {
  const { from, to, location, employee } = opts;
  const single = from === to;
  const datePart = single ? from : `${from}_bis_${to}`;
  const kind = single ? "Leistungsnachweis" : "Leistungsnachweise";

  const parts = [datePart, kind, slugForFilename(location || "Alle-Objekte")];
  if (employee) parts.push(slugForFilename(employee));
  return `${parts.join("_")}.pdf`;
}

/** Signed URL -> data URL, since jsPDF cannot fetch remote images itself. */
async function toDataUrl(
  url: string,
): Promise<{ data: string; w: number; h: number } | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    const data: string = await new Promise((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(String(fr.result));
      fr.onerror = reject;
      fr.readAsDataURL(blob);
    });
    const dims = await new Promise<{ w: number; h: number }>((resolve) => {
      const img = new Image();
      img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
      // A photo that will not decode still gets a page with its metadata:
      // losing the record entirely would be worse than losing the picture.
      img.onerror = () => resolve({ w: 0, h: 0 });
      img.src = data;
    });
    return { data, ...dims };
  } catch {
    return null;
  }
}

const de = (iso: string) =>
  new Date(iso).toLocaleString("de-DE", {
    dateStyle: "long",
    timeStyle: "short",
  });

/** One photo per page: a page per visit is how the evidence is read. */
export async function buildProofPdf(
  photos: ProofForExport[],
  labels: {
    title: string;
    employee: string;
    capturedAt: string;
    location: string;
    address: string;
    coordinates: string;
    note: string;
    verdict: string;
    imageUnavailable: string;
    page: string;
    generated: string;
  },
): Promise<Blob> {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const PW = 210;
  const M = 15;

  for (let i = 0; i < photos.length; i += 1) {
    const p = photos[i];
    if (i > 0) doc.addPage();

    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text(labels.title, M, 20);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(120);
    doc.text(`${labels.page} ${i + 1}/${photos.length}`, PW - M, 20, {
      align: "right",
    });
    doc.setTextColor(0);

    let y = 30;
    const img = p.url ? await toDataUrl(p.url) : null;
    if (img && img.w > 0) {
      // Fit inside the text column while preserving the aspect ratio, capped so
      // the metadata below always stays on the same page as its photo.
      const maxW = PW - M * 2;
      const maxH = 150;
      const scale = Math.min(maxW / img.w, maxH / img.h);
      const w = img.w * scale;
      const h = img.h * scale;
      doc.addImage(img.data, "JPEG", M, y, w, h, undefined, "FAST");
      y += h + 8;
    } else {
      doc.setFontSize(10);
      doc.setTextColor(150);
      doc.text(labels.imageUnavailable, M, y + 6);
      doc.setTextColor(0);
      y += 16;
    }

    const rows: [string, string][] = [
      [
        labels.employee,
        p.employee ? `${p.employee.firstName} ${p.employee.lastName}` : "-",
      ],
      [labels.capturedAt, de(p.capturedAt)],
    ];
    if (p.location?.name) rows.push([labels.location, p.location.name]);
    if (p.address) rows.push([labels.address, p.address]);
    if (p.latitude != null && p.longitude != null) {
      const acc = p.accuracyM != null ? ` (±${Math.round(p.accuracyM)} m)` : "";
      rows.push([
        labels.coordinates,
        `${p.latitude.toFixed(5)}, ${p.longitude.toFixed(5)}${acc}`,
      ]);
    }
    if (p.geofenceStatus) {
      const dist = p.distanceM != null ? ` (${Math.round(p.distanceM)} m)` : "";
      rows.push([labels.verdict, `${p.geofenceStatus}${dist}`]);
    }
    if (p.note) rows.push([labels.note, p.note]);

    doc.setFontSize(10);
    for (const [k, v] of rows) {
      doc.setFont("helvetica", "bold");
      doc.text(`${k}:`, M, y);
      doc.setFont("helvetica", "normal");
      // Wrap rather than overflow: an address or a note can exceed one line.
      const lines = doc.splitTextToSize(v, PW - M * 2 - 38) as string[];
      doc.text(lines, M + 38, y);
      y += 5.5 * lines.length;
    }

    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text(`${labels.generated} ${de(new Date().toISOString())}`, M, 287);
    doc.setTextColor(0);
  }

  return doc.output("blob");
}
