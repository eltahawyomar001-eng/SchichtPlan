// @ts-nocheck
/* eslint-disable */

/**
 * Service Worker — Workbox-powered caching with push notifications
 *
 * Strategies:
 *   /_next/static/   → CacheFirst (immutable, hashed)
 *   fonts            → StaleWhileRevalidate
 *   images           → CacheFirst + expiration (128 max, 30 days)
 *   navigations      → NetworkFirst → offline page fallback
 *   _next/data/      → StaleWhileRevalidate
 *   default          → NetworkFirst
 *
 * Also handles:
 *   - Push notifications (preserved from legacy sw.js)
 *   - Background Sync for offline mutations
 *   - SKIP_WAITING message for update-available prompt
 */

// ─── Workbox CDN ────────────────────────────────────────────
importScripts(
  "https://storage.googleapis.com/workbox-cdn/releases/7.3.0/workbox-sw.js",
);

workbox.setConfig({ debug: false });

const { registerRoute, NavigationRoute } = workbox.routing;
const { CacheFirst, StaleWhileRevalidate, NetworkFirst } = workbox.strategies;
const { ExpirationPlugin } = workbox.expiration;
const { CacheableResponsePlugin } = workbox.cacheableResponse;
const { precacheAndRoute, cleanupOutdatedCaches } = workbox.precaching;

const sw = /** @type {ServiceWorkerGlobalScope} */ (self);

// ─── Precache & Cleanup ────────────────────────────────────

cleanupOutdatedCaches();

// Manual precache list (no build-time injection — Next.js static files
// are content-hashed so they're safe to cache on first fetch)
precacheAndRoute([
  { url: "/offline.html", revision: "5" },
  { url: "/manifest.webmanifest", revision: "5" },
  { url: "/icon-192x192.png", revision: "1" },
  { url: "/icon-512x512.png", revision: "1" },
  { url: "/favicon.ico", revision: "1" },
  { url: "/favicon-32x32.png", revision: "1" },
  { url: "/apple-touch-icon.png", revision: "1" },
]);

// ─── Strategy 1: CacheFirst for Next.js static assets ──────
registerRoute(
  ({ url }) => url.pathname.startsWith("/_next/static/"),
  new CacheFirst({
    cacheName: "shiftfy-next-static",
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({
        maxEntries: 256,
        maxAgeSeconds: 365 * 24 * 60 * 60, // 1 year (immutable)
      }),
    ],
  }),
);

// ─── Strategy 2: StaleWhileRevalidate for fonts ─────────────
registerRoute(
  ({ url, request }) =>
    request.destination === "font" ||
    url.pathname.includes("/fonts/") ||
    url.hostname === "fonts.googleapis.com" ||
    url.hostname === "fonts.gstatic.com",
  new StaleWhileRevalidate({
    cacheName: "shiftfy-fonts",
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({
        maxEntries: 32,
        maxAgeSeconds: 365 * 24 * 60 * 60,
      }),
    ],
  }),
);

// ─── Strategy 3: CacheFirst for images ──────────────────────
registerRoute(
  ({ request, url }) =>
    request.destination === "image" ||
    /\.(png|jpg|jpeg|svg|gif|webp|avif|ico)$/.test(url.pathname),
  new CacheFirst({
    cacheName: "shiftfy-images",
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({
        maxEntries: 128,
        maxAgeSeconds: 30 * 24 * 60 * 60, // 30 days
        purgeOnQuotaError: true,
      }),
    ],
  }),
);

// ─── Strategy 4: NetworkFirst for navigations ───────────────
const navigationHandler = new NetworkFirst({
  cacheName: "shiftfy-navigations",
  networkTimeoutSeconds: 3,
  plugins: [
    new CacheableResponsePlugin({ statuses: [0, 200] }),
    new ExpirationPlugin({ maxEntries: 64, maxAgeSeconds: 24 * 60 * 60 }),
  ],
});

const navigationRoute = new NavigationRoute(navigationHandler, {
  denylist: [/^\/api\//, /^\/_next\/data\//],
});
registerRoute(navigationRoute);

// ─── Strategy 5: StaleWhileRevalidate for _next/data/ ───────
registerRoute(
  ({ url }) => url.pathname.startsWith("/_next/data/"),
  new StaleWhileRevalidate({
    cacheName: "shiftfy-next-data",
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({ maxEntries: 64, maxAgeSeconds: 24 * 60 * 60 }),
    ],
  }),
);

// ─── Offline Fallback for Navigations ───────────────────────

workbox.routing.setCatchHandler(async ({ event }) => {
  if (event.request.destination === "document" || event.request.mode === "navigate") {
    const offlinePage = await caches.match("/offline.html");
    return offlinePage || new Response("Offline", { status: 503 });
  }
  return Response.error();
});

// ─── Push Notifications ─────────────────────────────────────

sw.addEventListener("push", (event) => {
  if (!event.data) return;

  const data = event.data.json();
  /** @type {NotificationOptions} */
  const options = {
    body: data.body || "",
    icon: data.icon || "/icon-192x192.png",
    badge: data.badge || "/favicon-32x32.png",
    tag: data.tag || "shiftfy",
    data: { url: data.url || "/dashboard" },
    vibrate: [200, 100, 200],
    requireInteraction: false,
    actions: data.actions || [],
  };

  event.waitUntil(
    sw.registration.showNotification(data.title || "Shiftfy", options),
  );
});

sw.addEventListener("notificationclick", (event) => {
  event.notification.close();

  // Support notification action clicks
  const action = event.action;
  const notifData = event.notification.data || {};
  const url =
    action && notifData["action_" + action + "_url"]
      ? notifData["action_" + action + "_url"]
      : notifData.url || "/dashboard";

  event.waitUntil(
    sw.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clients) => {
        for (const client of clients) {
          if (client.url.includes(url) && "focus" in client) {
            return client.focus();
          }
        }
        return sw.clients.openWindow(url);
      }),
  );
});

sw.addEventListener("pushsubscriptionchange", (event) => {
  event.waitUntil(
    sw.registration.pushManager
      .subscribe(event.oldSubscription?.options ?? { userVisibleOnly: true })
      .then((newSub) =>
        fetch("/api/push-subscriptions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(newSub.toJSON()),
        }),
      ),
  );
});

// ─── Background Sync ───────────────────────────────────────

sw.addEventListener("sync", (event) => {
  if (event.tag === "shiftfy-bg-sync") {
    event.waitUntil(
      (async () => {
        // Notify all clients to run their sync engine
        const clients = await sw.clients.matchAll({ type: "window" });
        for (const client of clients) {
          client.postMessage({ type: "SYNC_PENDING_MUTATIONS" });
        }
      })(),
    );
  }
});

// ─── Skip Waiting (Update Prompt) ───────────────────────────

sw.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    sw.skipWaiting();
  }
});
