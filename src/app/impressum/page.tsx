import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import PublicPageShell from "@/components/layout/public-page-shell";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("legalImprint");
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
    alternates: { canonical: "/impressum" },
    robots: { index: true, follow: true },
  };
}

/** Address and contact details are proper nouns — never translated. */
const OPERATOR = {
  company: "Bashabsheh Vergabepartner",
  owner: "Mohammad Bashabsheh",
  street: "Kolonnenstraße 8",
  city: "10827 Berlin",
  phone: "+49 176 30365636",
  email: "Kontakt@shiftfy.info",
};

const ODR_URL = "https://ec.europa.eu/consumers/odr";

export default async function ImpressumPage() {
  const t = await getTranslations("legalImprint");

  const H = "text-lg font-semibold text-gray-900 dark:text-zinc-100 mb-2";

  return (
    <PublicPageShell legalTranslationNotice>
      <h1 className="text-3xl font-bold text-gray-900 dark:text-zinc-100 mb-8">
        {t("title")}
      </h1>

      <div className="prose prose-gray dark:prose-invert max-w-none space-y-6 text-sm text-gray-700 dark:text-zinc-300 leading-relaxed">
        <section>
          <h2 className={H}>{t("detailsHeading")}</h2>
          <p>
            {OPERATOR.company}
            <br />
            {t("ownerLabel")}: {OPERATOR.owner}
          </p>
          <p className="mt-2">
            {OPERATOR.street}
            <br />
            {OPERATOR.city}
            <br />
            {t("country")}
          </p>
        </section>

        <section>
          <h2 className={H}>{t("contactHeading")}</h2>
          <p>
            {t("phoneLabel")}: {OPERATOR.phone}
            <br />
            {t("emailLabel")}: {OPERATOR.email}
          </p>
        </section>

        <section>
          <h2 className={H}>{t("vatHeading")}</h2>
          <p>{t("vatBody")}</p>
        </section>

        <section>
          <h2 className={H}>{t("responsibleHeading")}</h2>
          <p>
            {OPERATOR.owner}
            <br />
            {OPERATOR.street}
            <br />
            {OPERATOR.city}
          </p>
        </section>

        <section>
          <h2 className={H}>{t("liabilityContentHeading")}</h2>
          <p>{t("liabilityContentBody")}</p>
        </section>

        <section>
          <h2 className={H}>{t("liabilityLinksHeading")}</h2>
          <p>{t("liabilityLinksBody")}</p>
        </section>

        <section>
          <h2 className={H}>{t("copyrightHeading")}</h2>
          <p>{t("copyrightBody")}</p>
        </section>

        <section>
          <h2 className={H}>{t("odrHeading")}</h2>
          <p>
            {t("odrBody")}{" "}
            <a
              href={ODR_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="text-emerald-600 hover:text-emerald-700 underline"
            >
              {ODR_URL}
            </a>
            .
          </p>
          <p className="mt-2">{t("odrNotParticipating")}</p>
        </section>
      </div>
    </PublicPageShell>
  );
}
