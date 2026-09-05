import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  // CI already runs tsc --noEmit separately — skip the redundant type-check
  // pass that next build runs internally to cut build CPU significantly.
  // (Next 16 no longer runs ESLint during build, so no eslint key is needed.)
  typescript: { ignoreBuildErrors: true },
  /**
   * Deployment-skew protection.
   *
   * Without this, every deploy is a live hazard for anyone already using the
   * app. The browser holds an HTML/RSC payload referencing the OLD build's
   * chunk hashes; the moment a new build replaces them those URLs 404, the
   * App Router fails mid-navigation, and the user gets a blank page. It does
   * not even reach error.tsx, because the boundary's own chunk is one of the
   * missing ones — which is exactly why a hard refresh "fixes" it.
   *
   * Stamping the deployment id makes the client request assets from the build
   * it was actually served by, so an open session keeps working across a
   * deploy. Requires Skew Protection to be enabled on the Vercel project so
   * the older deployment stays addressable.
   */
  deploymentId: process.env.VERCEL_DEPLOYMENT_ID,
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
