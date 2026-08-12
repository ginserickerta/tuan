// Service worker: makes the app open with no network (bus, school wifi, airplane).
// All study data already lives in IndexedDB — this only caches the shell so the
// app can boot offline. Bump CACHE when the caching strategy itself changes.
const CACHE = "tuan-v1";

// Pages + assets fetched up front so the very first offline launch works.
const SHELL = [
  "/",
  "/add",
  "/topics",
  "/manifest.json",
  "/icon.svg",
  "/icon-192.png",
  "/apple-touch-icon.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      // individual failures must not abort the whole install
      await Promise.allSettled(SHELL.map((url) => cache.add(url)));
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(names.filter((n) => n !== CACHE).map((n) => caches.delete(n)));
      await self.clients.claim();
    })(),
  );
});

/** Cache-first: hashed build assets never change under the same URL. */
async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) {
    const cache = await caches.open(CACHE);
    cache.put(request, response.clone());
  }
  return response;
}

/** Network-first: fresh when online, last known copy when not. */
async function networkFirst(request, fallbackUrl) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch (err) {
    const cached = await caches.match(request);
    if (cached) return cached;
    if (fallbackUrl) {
      const shell = await caches.match(fallbackUrl);
      if (shell) return shell;
    }
    throw err;
  }
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Never cache API calls — OCR/quiz responses are one-shot and can be large.
  if (url.pathname.startsWith("/api/")) return;

  // RSC payloads for client-side navigation: let them fail offline on purpose.
  // Next then falls back to a full page load, which the shell cache serves.
  if (url.searchParams.has("_rsc") || request.headers.get("RSC") === "1") return;

  if (request.mode === "navigate") {
    event.respondWith(networkFirst(request, "/"));
    return;
  }

  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // Icons, manifest, anything else public/: serve cached, refresh in background.
  event.respondWith(
    (async () => {
      const cached = await caches.match(request);
      if (cached) {
        void fetch(request)
          .then(async (res) => {
            if (res.ok) (await caches.open(CACHE)).put(request, res);
          })
          .catch(() => {});
        return cached;
      }
      return networkFirst(request);
    })(),
  );
});
