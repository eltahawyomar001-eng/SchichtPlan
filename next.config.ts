import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  // CI already runs tsc --noEmit and eslint separately — skip the redundant
  // passes that next build runs internally to cut build CPU significantly
  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true },
  experimental: {
    // Rewrite barrel imports (date-fns in 18 files, recharts, framer-motion)
    // into direct module paths — faster compile and smaller client bundles
    optimizePackageImports: ["date-fns", "recharts", "framer-motion"],
  },
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
  silent: true,
  telemetry: false,
  widenClientFileUpload: false,
  hideSourceMaps: true,
  disableLogger: true,
  automaticVercelMonitors: false,
  // Consolidate source map upload into one post-build operation instead of
  // uploading during each webpack pass (client + server + edge = 3x → 1x)
  useRunAfterProductionCompileHook: true,
  // Tree-shake unused Sentry code from the client bundle
  bundleSizeOptimizations: {
    excludeDebugStatements: true,
    excludeReplayIframe: true,
    excludeReplayShadowDom: true,
    excludeReplayWorker: true,
  },
  // Skip Sentry auto-instrumentation for cron, health, and admin routes —
  // these don't need per-route error wrapping and skipping them reduces
  // the number of files the webpack plugin must process
  excludeServerRoutes: [
    /^\/api\/automations\//,
    /^\/api\/cron\//,
    /^\/api\/health/,
    /^\/api\/admin\//,
  ],
});
