import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0.2,
  profilesSampleRate: 0.1,
  environment: process.env.NODE_ENV,
  enabled: !!process.env.NEXT_PUBLIC_SENTRY_DSN,
  // Attach server context to every event
  initialScope: {
    tags: {
      runtime: "server",
    },
  },
  // Filter noisy or expected errors
  ignoreErrors: ["NEXT_NOT_FOUND", "NEXT_REDIRECT"],
  beforeSend(event) {
    // Strip sensitive data from breadcrumbs
    if (event.breadcrumbs) {
      event.breadcrumbs = event.breadcrumbs.map((b) => {
        if (b.category === "http" && b.data?.url) {
          // Redact authorization headers
          if (b.data.headers) {
            delete b.data.headers.authorization;
            delete b.data.headers.cookie;
          }
        }
        return b;
      });
    }
    return event;
  },
});
