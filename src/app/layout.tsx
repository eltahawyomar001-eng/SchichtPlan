import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import { CookieBanner } from "@/components/cookie-banner";
import { CombinedJsonLd } from "@/components/seo/JsonLd";

const inter = Inter({ subsets: ["latin"] });

const SITE_URL = process.env.SITE_URL || "https://www.shiftfy.de";

export const viewport: Viewport = {
  themeColor: "#059669",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
};

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default:
      "Shiftfy – Schichtplanung & Zeiterfassung Software | Dienstplan online erstellen",
    template: "%s | Shiftfy",
  },
  description:
    "Shiftfy ist die intelligente Software für Schichtplanung, Zeiterfassung und Personalmanagement. Ideal für Sicherheitsdienste, Gastronomie, Einzelhandel & Dienstleister. DSGVO-konform, kostenlos starten.",
  keywords: [
    "Schichtplanung",
    "Schichtplan erstellen",
    "Schichtplaner",
    "Dienstplan",
    "Dienstplan erstellen",
    "Dienstplanung Software",
    "Zeiterfassung",
    "Zeiterfassung Software",
    "Zeiterfassung Mitarbeiter",
    "digitale Zeiterfassung",
    "Arbeitszeiterfassung",
    "Personalplanung",
    "Personalmanagement",
    "Mitarbeiterplanung",
    "Schichtplan Software",
    "Schichtplanung online",
    "Schichtplan App",
    "Einsatzplanung",
    "Workforce Management",
    "Stempeluhr digital",
    "Stempeluhr App",
    "Urlaubsverwaltung",
    "Abwesenheitsmanagement",
    "Lohnexport",
    "DSGVO Zeiterfassung",
    "Sicherheitsdienst Schichtplan",
    "Gastronomie Dienstplan",
    "Einzelhandel Schichtplanung",
    "kostenlose Schichtplanung",
    "Schichttausch",
    "Arbeitszeitkonto",
  ],
  authors: [{ name: "Shiftfy", url: SITE_URL }],
  creator: "Shiftfy",
  publisher: "Shiftfy",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  alternates: {
    canonical: SITE_URL,
    languages: {
      "de-DE": SITE_URL,
      "en-US": `${SITE_URL}?locale=en`,
    },
  },
  openGraph: {
    type: "website",
    locale: "de_DE",
    alternateLocale: "en_US",
    url: SITE_URL,
    siteName: "Shiftfy",
    title: "Shiftfy – Schichtplanung & Zeiterfassung Software",
    description:
      "Digitale Schichtplanung, Zeiterfassung und Personalmanagement – alles in einer App. Kostenlos starten, DSGVO-konform, made in Germany.",
    images: [
      {
        url: `${SITE_URL}/og-image.png`,
        width: 1200,
        height: 630,
        alt: "Shiftfy – Intelligente Schichtplanung und Zeiterfassung",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Shiftfy – Schichtplanung & Zeiterfassung Software",
    description:
      "Digitale Schichtplanung, Zeiterfassung und Personalmanagement. Kostenlos starten.",
    images: [`${SITE_URL}/og-image.png`],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  verification: {
    google: "cve8iGCgRhzGO37P7zkIivUQqwA4XNzipDR5BstXw94",
  },
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Shiftfy",
  },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "48x48", type: "image/x-icon" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/icon-192x192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512x512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }],
  },
  other: {
    "mobile-web-app-capable": "yes",
  },
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <html lang={locale}>
      <head>
        <CombinedJsonLd />
      </head>
      <body className={inter.className}>
        <NextIntlClientProvider messages={messages}>
          <Providers>{children}</Providers>
          <CookieBanner />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
