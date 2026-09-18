import React from "react";

/**
 * Renderer for the long legal pages.
 *
 * These documents were JSX with the German written straight into the markup,
 * which made them untranslatable and made a legal update a code change. Here
 * the document lives in the message files as data, one coherent block per
 * language, and this component draws it. Adding a language is a translation,
 * not a rewrite.
 *
 * `**bold**` is honoured inside any text so emphasis that carries legal weight
 * ("processes API input **not** for training") survives translation.
 */

export type LegalLink = { label: string; href: string };

export type LegalBlock =
  | {
      type: "p";
      text: string;
      lead?: string;
      tone?: "muted" | "small";
      link?: LegalLink;
      suffix?: string;
    }
  | { type: "h3"; text: string }
  | { type: "ul"; items: { lead?: string; text: string }[] }
  | {
      type: "lines";
      lines: string[];
      link?: LegalLink;
      tone?: "muted" | "small";
    }
  | { type: "table"; headers: string[]; rows: string[][] };

export type LegalSection = { heading: string; blocks: LegalBlock[] };

/** Render `**bold**` segments without pulling in a markdown dependency. */
function inline(text: string): React.ReactNode[] {
  return text
    .split("**")
    .map((part, i) =>
      i % 2 === 1 ? (
        <strong key={i}>{part}</strong>
      ) : (
        <React.Fragment key={i}>{part}</React.Fragment>
      ),
    );
}

const TONE: Record<string, string> = {
  muted: "mt-3 text-gray-600 dark:text-zinc-400",
  small: "mt-1 text-xs text-gray-500 dark:text-zinc-500",
};

function Anchor({ link }: { link: LegalLink }) {
  const external = link.href.startsWith("http");
  return (
    <a
      href={link.href}
      {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      className="text-emerald-600 hover:text-emerald-700 underline"
    >
      {link.label}
    </a>
  );
}

function Block({ block }: { block: LegalBlock }) {
  switch (block.type) {
    case "h3":
      return (
        <h3 className="text-base font-medium text-gray-800 dark:text-zinc-200 mt-4 mb-1">
          {inline(block.text)}
        </h3>
      );

    case "p":
      return (
        <p className={block.tone ? TONE[block.tone] : "mt-2"}>
          {block.lead && <strong>{block.lead}</strong>}
          {block.lead ? " " : null}
          {inline(block.text)}
          {block.link && (
            <>
              {" "}
              <Anchor link={block.link} />
            </>
          )}
          {block.suffix}
        </p>
      );

    case "ul":
      return (
        <ul className="list-disc pl-5 space-y-2 mt-2">
          {block.items.map((item, i) => (
            <li key={i}>
              {item.lead && <strong>{item.lead}</strong>}
              {item.lead ? " " : null}
              {inline(item.text)}
            </li>
          ))}
        </ul>
      );

    case "lines":
      return (
        <p className={block.tone ? TONE[block.tone] : "mt-2"}>
          {block.lines.map((line, i) => (
            <React.Fragment key={i}>
              {i > 0 && <br />}
              {inline(line)}
            </React.Fragment>
          ))}
          {block.link && (
            <>
              <br />
              <Anchor link={block.link} />
            </>
          )}
        </p>
      );

    case "table":
      return (
        <div className="overflow-x-auto mt-3">
          <table className="min-w-full text-sm border border-gray-200 dark:border-zinc-700 rounded-lg">
            <thead>
              <tr className="bg-emerald-600 text-white">
                {block.headers.map((h, i) => (
                  <th key={i} className="text-left px-3 py-2 font-semibold">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-zinc-800">
              {block.rows.map((row, r) => (
                <tr
                  key={r}
                  className={
                    r % 2 === 1 ? "bg-gray-50 dark:bg-zinc-800/40" : ""
                  }
                >
                  {row.map((cell, c) => (
                    <td key={c} className="px-3 py-1.5">
                      {inline(cell)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
  }
}

export default function LegalDocument({
  sections,
}: {
  sections: LegalSection[];
}) {
  return (
    <div className="prose prose-gray dark:prose-invert max-w-none space-y-6 text-sm text-gray-700 dark:text-zinc-300 leading-relaxed">
      {sections.map((section, i) => (
        <section key={i}>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-zinc-100 mb-2">
            {section.heading}
          </h2>
          {section.blocks.map((block, j) => (
            <Block key={j} block={block} />
          ))}
        </section>
      ))}
    </div>
  );
}
