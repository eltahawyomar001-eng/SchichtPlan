import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        // Allow service worker to control the entire site
        source: "/sw.js",
        headers: [
          { key: "Service-Worker-Allowed", value: "/" },
          {
            key: "Cache-Control",
            value: "no-cache, no-store, must-revalidate",
          },
        ],
      },
    ];
  },
};

const withNextIntl = createNextIntlPlugin();

export default withSentryConfig(withNextIntl(nextConfig), {
  // Suppress noisy source-map upload logs during build
  silent: true,
  // Upload source maps for better stack traces in Sentry
  widenClientFileUpload: true,
  // Automatically tree-shake Sentry logger in production
  disableLogger: true,
});
