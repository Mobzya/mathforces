/* global self, caches, fetch, URL, Response, AbortController, Request */

const CACHE_PREFIX = "mathforces-";
const SHELL_CACHE = `${CACHE_PREFIX}shell-v12`;
const STATIC_CACHE = `${CACHE_PREFIX}static-v12`;
const OFFLINE_FALLBACK = "/offline";
const APP_SHELL = [
  OFFLINE_FALLBACK,
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/maskable-icon-512.png",
  "/icons/apple-touch-icon.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    Promise.all([
      caches.open(SHELL_CACHE).then((cache) => cache.addAll(APP_SHELL)),
      self.skipWaiting()
    ])
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    Promise.all([
      caches
        .keys()
        .then((keys) =>
          Promise.all(
            keys
              .filter(
                (key) =>
                  key.startsWith(CACHE_PREFIX) &&
                  key !== SHELL_CACHE &&
                  key !== STATIC_CACHE
              )
              .map((key) => caches.delete(key))
          )
        ),
      self.registration.navigationPreload?.enable()
    ])
  );
  self.clients.claim();
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") {
    return;
  }

  const requestUrl = new URL(event.request.url);
  if (requestUrl.origin !== self.location.origin) {
    return;
  }

  if (requestUrl.pathname.startsWith("/api/")) {
    return;
  }

  if (event.request.mode === "navigate") {
    event.respondWith(
      handleNavigation(event.request, event.preloadResponse)
    );
    return;
  }

  if (
    requestUrl.pathname.startsWith("/_next/static/") ||
    requestUrl.pathname.startsWith("/icons/") ||
    requestUrl.pathname === "/manifest.webmanifest"
  ) {
    event.respondWith(cacheFirst(event.request));
  }
});

async function handleNavigation(request, preloadResponse) {
  try {
    // Five seconds was too aggressive for a cold local/production server and
    // turned a slow profile transition into a false offline page.
    const response = (await preloadResponse) ?? (await fetchWithTimeout(request, 15_000));
    // Next.js HTML refers to build-specific JavaScript chunks. Caching whole
    // pages can pair old HTML with a new build and leave every client button
    // unhydrated, so only the dedicated offline page is stored.
    return response;
  } catch {
    return (await caches.match(OFFLINE_FALLBACK)) ?? Response.error();
  }
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) {
    return cached;
  }

  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(STATIC_CACHE);
      await cache.put(request, response.clone());
    }
    return response;
  } catch {
    return Response.error();
  }
}

async function fetchWithTimeout(request, timeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(new Request(request, { signal: controller.signal }));
  } finally {
    clearTimeout(timeout);
  }
}
