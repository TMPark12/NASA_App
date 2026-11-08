const CACHE_NAME = "nasa-explorer-cache-v9";
const CACHE_PREFIX = "nasa-explorer-";
const API_CACHE = "nasa-explorer-api";
const APP_SHELL = [
  "./index.html",
  "./style.css",
  "./manifest.json",
  "./facts.json",
  "./icon.svg",
  "./icon-180.png",
  "./icon-192.png",
  "./icon-512.png"
];

self.addEventListener("install", event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll(APP_SHELL.map(path => new URL(path, self.registration.scope)));
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    const cacheNames = await caches.keys();
    const oldCaches = cacheNames
      .filter(cacheName => cacheName.startsWith(CACHE_PREFIX) && cacheName !== CACHE_NAME && cacheName !== API_CACHE);
    await Promise.all(oldCaches.map(async cacheName => {
      try {
        const oldCache = await caches.open(cacheName);
        const requests = await oldCache.keys();
        const apiRequests = requests.filter(request => new URL(request.url).hostname === "api.nasa.gov");
        if (apiRequests.length) {
          const apiCache = await caches.open(API_CACHE);
          for (const request of apiRequests) {
            const response = await oldCache.match(request);
            if (response && !(await apiCache.match(request))) await apiCache.put(request, response);
          }
        }
        await caches.delete(cacheName);
      } catch (error) {
        console.error("Unable to migrate old app cache:", error);
      }
    }));
    await self.clients.claim();
  })());
});

async function networkFirst(request) {
  let response;
  try {
    response = await fetch(request);
  } catch (error) {
    const cache = await caches.open(API_CACHE);
    const cachedResponse = await cache.match(request) || await caches.match(request);
    if (cachedResponse) return cachedResponse;
    throw error;
  }
  if (response.ok) {
    try {
      const cache = await caches.open(API_CACHE);
      await cache.put(request, response.clone());
    } catch (error) {
      console.error("Unable to cache NASA API response:", error);
    }
  }
  return response;
}

async function appShellFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  const cachedResponse = await cache.match(request);
  if (cachedResponse) return cachedResponse;

  const response = await fetch(request);
  if (response.ok) {
    try {
      await cache.put(request, response.clone());
    } catch (error) {
      console.error("Unable to cache app resource:", error);
    }
  }
  return response;
}

self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);
  if (url.hostname === "api.nasa.gov") {
    event.respondWith(networkFirst(event.request));
    return;
  }

  if (url.origin !== self.location.origin) return;

  if (event.request.mode === "navigate") {
    event.respondWith((async () => {
      try {
        return await fetch(event.request);
      } catch {
        const cache = await caches.open(CACHE_NAME);
        const offlinePage = await cache.match(new URL("./index.html", self.registration.scope));
        if (offlinePage) return offlinePage;
        throw new Error("The app shell is unavailable offline.");
      }
    })());
    return;
  }

  event.respondWith(appShellFirst(event.request));
});
