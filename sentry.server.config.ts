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
    // Tag high-severity events for SLA alerting
    if (event.level === "fatal" || event.level === "error") {
      event.tags = { ...event.tags, sla_relevant: "true" };
    }

    // Strip PII query params and sensitive headers from all URLs in the event
    const PII_PARAMS = [
      "token",
      "email",
      "password",
      "reset_token",
      "invite",
      "code",
    ];
    const redactUrl = (url: string): string => {
      try {
        const u = new URL(url);
        for (const p of PII_PARAMS) {
          if (u.searchParams.has(p)) u.searchParams.set(p, "[Filtered]");
        }
        return u.toString();
      } catch {
        return url;
      }
    };

    if (event.request?.url) {
      event.request.url = redactUrl(event.request.url);
    }
    if (event.breadcrumbs) {
      event.breadcrumbs = event.breadcrumbs.map((b) => {
        if (b.category === "http" && b.data?.url) {
          b.data.url = redactUrl(String(b.data.url));
          // Redact sensitive headers
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
