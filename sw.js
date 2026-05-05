const CACHE_NAME = "vacation-planner-v39";
const ASSETS = [
  "./styles.css",
  "./app.js?v=39",
  "./manifest.webmanifest",
  "./icon.svg"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

/** Voorkomt dat HTTP-diskcache een oude index of app.js teruggeeft. */
function fetchNoStore(request) {
  return fetch(request, { cache: "no-store" });
}

function isDocumentRequest(request) {
  return request.method === "GET"
    && (request.mode === "navigate" || request.destination === "document");
}

function isAppScriptRequest(request) {
  if (request.method !== "GET") return false;
  try {
    const u = new URL(request.url);
    return u.pathname.endsWith("/app.js") || u.pathname.endsWith("app.js");
  } catch {
    return false;
  }
}

async function matchCachedShell(request) {
  const r = await caches.match(request);
  if (r) return r;
  const fallbacks = ["./index.html", "./", "/index.html"];
  for (const key of fallbacks) {
    const hit = await caches.match(key);
    if (hit) return hit;
  }
  return null;
}

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  if (isDocumentRequest(event.request)) {
    event.respondWith(
      fetchNoStore(event.request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          }
          return response;
        })
        .catch(() => matchCachedShell(event.request))
    );
    return;
  }

  if (isAppScriptRequest(event.request)) {
    event.respondWith(
      fetchNoStore(event.request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          }
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request)
        .then((response) => {
          const cloned = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, cloned));
          return response;
        })
        .catch(() => matchCachedShell(event.request));
    })
  );
});
