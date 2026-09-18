/**
 * @vitest-environment node
 *
 * The legal pages render their document from the message files as structured
 * data. The generic key-parity test sees `legalPrivacy.sections` as a single
 * leaf, so it cannot tell that one language quietly lost a clause, a list item
 * or a table row. This compares the documents block by block.
 */
import { describe, it, expect } from "vitest";
import de from "../../../messages/de.json";
import en from "../../../messages/en.json";

type Block = {
  type: string;
  items?: unknown[];
  rows?: unknown[][];
  headers?: unknown[];
  lines?: unknown[];
  link?: { href: string };
};
type Section = { heading: string; blocks: Block[] };

const DOCS = ["legalPrivacy"] as const;

describe.each(DOCS)("%s document parity", (docKey) => {
  const deDoc = (de as unknown as Record<string, { sections: Section[] }>)[
    docKey
  ];
  const enDoc = (en as unknown as Record<string, { sections: Section[] }>)[
    docKey
  ];

  it("exists in both languages", () => {
    expect(deDoc?.sections).toBeInstanceOf(Array);
    expect(enDoc?.sections).toBeInstanceOf(Array);
  });

  it("has the same number of sections", () => {
    expect(enDoc.sections.length).toBe(deDoc.sections.length);
  });

  it("has matching block structure in every section", () => {
    const problems: string[] = [];
    deDoc.sections.forEach((d, i) => {
      const e = enDoc.sections[i];
      if (!e) return problems.push(`section ${i} missing in EN`);
      if (d.blocks.length !== e.blocks.length) {
        return problems.push(
          `section ${i}: ${d.blocks.length} blocks vs ${e.blocks.length}`,
        );
      }
      d.blocks.forEach((bd, j) => {
        const be = e.blocks[j];
        if (bd.type !== be.type) {
          problems.push(`section ${i} block ${j}: ${bd.type} vs ${be.type}`);
        }
        if (bd.items && bd.items.length !== be.items?.length) {
          problems.push(`section ${i} block ${j}: list length differs`);
        }
        if (bd.lines && bd.lines.length !== be.lines?.length) {
          problems.push(`section ${i} block ${j}: address lines differ`);
        }
        if (bd.rows && bd.rows.length !== be.rows?.length) {
          problems.push(`section ${i} block ${j}: table rows differ`);
        }
        if (bd.headers && bd.headers.length !== be.headers?.length) {
          problems.push(`section ${i} block ${j}: table columns differ`);
        }
      });
    });
    expect(problems).toEqual([]);
  });

  it("points both languages at the same URLs", () => {
    const hrefs = (doc: { sections: Section[] }) =>
      doc.sections.flatMap((s) =>
        s.blocks.filter((b) => b.link).map((b) => b.link!.href),
      );
    // Labels are translated; the destinations must not drift apart.
    expect(hrefs(enDoc)).toEqual(hrefs(deDoc));
  });

  it("keeps ** ** emphasis balanced in both languages", () => {
    const unbalanced: string[] = [];
    const walk = (doc: { sections: Section[] }, lang: string) =>
      JSON.stringify(doc)
        .split('"')
        .forEach((s) => {
          if ((s.match(/\*\*/g)?.length ?? 0) % 2 !== 0) {
            unbalanced.push(`${lang}: ${s.slice(0, 50)}`);
          }
        });
    walk(deDoc, "de");
    walk(enDoc, "en");
    expect(unbalanced).toEqual([]);
  });
});
