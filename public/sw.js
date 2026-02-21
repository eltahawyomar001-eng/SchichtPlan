// @ts-nocheck
/* eslint-disable */

const sw = /** @type {ServiceWorkerGlobalScope} */ (self);

// Push notification handler
sw.addEventListener("push", (event) => {
  if (!event.data) return;

  const data = event.data.json();
  /** @type {NotificationOptions} */
  const options = {
    body: data.body || "",
    icon: data.icon || "/android-chrome-192x192.png",
    badge: data.badge || "/favicon-32x32.png",
    tag: data.tag || "schichtplan",
    data: { url: data.url || "/dashboard" },
    vibrate: [200, 100, 200],
    requireInteraction: false,
  };

  event.waitUntil(sw.registration.showNotification(data.title || "SchichtPlan", options));
});

// Notification click handler
sw.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/dashboard";

  event.waitUntil(
    sw.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if (client.url.includes(url) && "focus" in client) {
          return client.focus();
        }
      }
      return sw.clients.openWindow(url);
    }),
  );
});

// Handle subscription renewal (when browser invalidates the old one)
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

// Cache strategies for offline support
const CACHE_NAME = "schichtplan-v1";
const OFFLINE_URL = "/offline";
const PRECACHE_URLS = [
  "/",
  "/dashboard",
  "/offline",
  "/manifest.webmanifest",
  "/android-chrome-192x192.png",
  "/android-chrome-512x512.png",
];

sw.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_URLS).catch(() => {
        // Some URLs may not exist yet, that's OK
        console.log("[SW] Some precache URLs failed, continuing...");
      });
    }),
  );
  sw.skipWaiting();
});

sw.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key)),
      ),
    ),
  );
  sw.clients.claim();
});

sw.addEventListener("fetch", (event) => {
  const { request } = event;

  // Only handle GET requests
  if (request.method !== "GET") return;

  // Skip API requests and auth routes
  const url = new URL(request.url);
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/_next/")) {
    return;
  }

  event.respondWith(
    fetch(request)
      .then((response) => {
        // Cache successful navigation responses
        if (response.ok && request.mode === "navigate") {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return response;
      })
      .catch(() => {
        // Serve from cache or show offline page
        return caches.match(request).then((cached) => {
          if (cached) return cached;
          if (request.mode === "navigate") {
            return caches.match(OFFLINE_URL).then(
              (offlinePage) => offlinePage || new Response("Offline", { status: 503 }),
            );
          }
          return new Response("Offline", { status: 503 });
        });
      }),
  );
});
