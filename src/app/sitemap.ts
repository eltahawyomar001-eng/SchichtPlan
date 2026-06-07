import type { MetadataRoute } from "next";

const SITE_URL = process.env.SITE_URL || "https://www.shiftfy.de";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date().toISOString();

  // Static public pages
  const staticPages: MetadataRoute.Sitemap = [
    {
      url: SITE_URL,
      lastModified: now,
      changeFrequency: "daily",
      priority: 1.0,
    },
    {
      url: `${SITE_URL}/pricing`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: `${SITE_URL}/schichtplanung-software`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.95,
    },
    {
      url: `${SITE_URL}/zeiterfassung-software`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.95,
    },
    // Industry landing pages — target high-intent niche queries the site
    // already ranks page-2 for (see Search Console).
    {
      url: `${SITE_URL}/schichtplanung-sicherheitsdienst`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: `${SITE_URL}/zeiterfassung-logistik`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: `${SITE_URL}/blog`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: `${SITE_URL}/login`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: `${SITE_URL}/register`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: `${SITE_URL}/impressum`,
      lastModified: now,
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: `${SITE_URL}/datenschutz`,
      lastModified: now,
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: `${SITE_URL}/agb`,
      lastModified: now,
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: `${SITE_URL}/widerruf`,
      lastModified: now,
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: `${SITE_URL}/barrierefreiheit`,
      lastModified: now,
      changeFrequency: "yearly",
      priority: 0.3,
    },
  ];

  // Blog post slugs — keep in sync with POSTS object in blog/[slug]/page.tsx
  const blogSlugs = [
    "schichtplanung-best-practices",
    "arbeitszeitgesetz-2025",
    "mitarbeiterbindung-schichtarbeit",
    "digitale-stempeluhr-vorteile",
  ];

  const blogPages: MetadataRoute.Sitemap = blogSlugs.map((slug) => ({
    url: `${SITE_URL}/blog/${slug}`,
    lastModified: now,
    changeFrequency: "monthly" as const,
    priority: 0.8,
  }));

  return [...staticPages, ...blogPages];
}
