// @ts-nocheck
/* eslint-disable */

const sw = /** @type {ServiceWorkerGlobalScope} */ (self);

// ─── Cache Configuration ────────────────────────────────────
const CACHE_VERSION = 4;
const STATIC_CACHE = `shiftfy-static-v${CACHE_VERSION}`;
const RUNTIME_CACHE = `shiftfy-runtime-v${CACHE_VERSION}`;
const IMAGE_CACHE = `shiftfy-images-v${CACHE_VERSION}`;
const ALL_CACHES = [STATIC_CACHE, RUNTIME_CACHE, IMAGE_CACHE];

const OFFLINE_URL = "/offline.html";

/** URLs to precache during install */
const PRECACHE_URLS = [
  "/",
  "/dashboard",
  "/offline.html",
  "/manifest.webmanifest",
  "/icon-192x192.png",
  "/icon-512x512.png",
  "/favicon.ico",
  "/favicon-32x32.png",
  "/apple-touch-icon.png",
];

/** Max entries per runtime cache to prevent unbounded growth */
const MAX_RUNTIME_ENTRIES = 64;
const MAX_IMAGE_ENTRIES = 128;

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
  };

  event.waitUntil(sw.registration.showNotification(data.title || "Shiftfy", options));
});

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

// ─── Install ────────────────────────────────────────────────

sw.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      return cache.addAll(PRECACHE_URLS).catch(() => {
        console.log("[SW] Some precache URLs failed, continuing...");
      });
    }),
  );
  sw.skipWaiting();
});

// ─── Activate — clean up old caches ─────────────────────────

sw.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => !ALL_CACHES.includes(key))
          .map((key) => {
            console.log("[SW] Deleting old cache:", key);
            return caches.delete(key);
          }),
      ),
    ),
  );
  sw.clients.claim();
});

// ─── Cache Helpers ──────────────────────────────────────────

/**
 * Trim a cache to a maximum number of entries (FIFO).
 */
async function trimCache(cacheName, maxEntries) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  if (keys.length > maxEntries) {
    await cache.delete(keys[0]);
    return trimCache(cacheName, maxEntries);
  }
}

// ─── Fetch — Strategy Router ────────────────────────────────

sw.addEventListener("fetch", (event) => {
  const { request } = event;

  // Only handle GET requests
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Skip API routes, auth, and non-http(s) requests
  if (url.pathname.startsWith("/api/")) return;
  if (url.protocol !== "https:" && url.protocol !== "http:") return;

  // ── Strategy 1: Cache-first for Next.js static assets (_next/static/)
  // These are content-hashed and immutable — safe to serve from cache indefinitely
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(STATIC_CACHE).then((cache) => cache.put(request, clone));
          }
          return response;
        });
      }),
    );
    return;
  }

  // ── Strategy 2: Stale-while-revalidate for fonts
  if (
    url.pathname.includes("/fonts/") ||
    url.hostname === "fonts.googleapis.com" ||
    url.hostname === "fonts.gstatic.com"
  ) {
    event.respondWith(
      caches.match(request).then((cached) => {
        const fetchPromise = fetch(request)
          .then((response) => {
            if (response.ok) {
              const clone = response.clone();
              caches.open(RUNTIME_CACHE).then((cache) => {
                cache.put(request, clone);
                trimCache(RUNTIME_CACHE, MAX_RUNTIME_ENTRIES);
              });
            }
            return response;
          })
          .catch(() => cached);

        return cached || fetchPromise;
      }),
    );
    return;
  }

  // ── Strategy 3: Cache-first for images (with size limit)
  if (
    request.destination === "image" ||
    url.pathname.match(/\.(png|jpg|jpeg|svg|gif|webp|avif|ico)$/)
  ) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(IMAGE_CACHE).then((cache) => {
              cache.put(request, clone);
              trimCache(IMAGE_CACHE, MAX_IMAGE_ENTRIES);
            });
          }
          return response;
        });
      }),
    );
    return;
  }

  // ── Strategy 4: Network-first for navigations (HTML pages)
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(RUNTIME_CACHE).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => {
          return caches.match(request).then((cached) => {
            if (cached) return cached;
            return caches.match(OFFLINE_URL).then(
              (offlinePage) => offlinePage || new Response("Offline", { status: 503 }),
            );
          });
        }),
    );
    return;
  }

  // ── Strategy 5: Stale-while-revalidate for _next/data/ (page data)
  if (url.pathname.startsWith("/_next/data/")) {
    event.respondWith(
      caches.match(request).then((cached) => {
        const fetchPromise = fetch(request)
          .then((response) => {
            if (response.ok) {
              const clone = response.clone();
              caches.open(RUNTIME_CACHE).then((cache) => {
                cache.put(request, clone);
                trimCache(RUNTIME_CACHE, MAX_RUNTIME_ENTRIES);
              });
            }
            return response;
          })
          .catch(() => cached);

        return cached || fetchPromise;
      }),
    );
    return;
  }

  // ── Default: Network-first with cache fallback
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(RUNTIME_CACHE).then((cache) => {
            cache.put(request, clone);
            trimCache(RUNTIME_CACHE, MAX_RUNTIME_ENTRIES);
          });
        }
        return response;
      })
      .catch(() => {
        return caches.match(request).then(
          (cached) => cached || new Response("Offline", { status: 503 }),
        );
      }),
  );
});
