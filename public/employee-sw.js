// Technician portal service worker. Registered with scope "/employee/" only
// (see client/lib/employee/pwa.ts) — pages outside /employee/* are never
// controlled by this worker and are completely unaffected by anything here.
const CACHE_VERSION = "v1";
const SHELL_CACHE = `nmm-technician-shell-${CACHE_VERSION}`;
const OFFLINE_URL = "/employee-offline.html";

// The SPA's JS/CSS bundle has content-hashed filenames generated at build
// time, so they can't be listed here. Only the offline fallback (and its
// one image) are precached up front, guaranteeing they're available even
// on a technician's very first launch before anything else has been
// fetched once. Everything else is cached opportunistically as it's
// requested (see the fetch handler below).
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) => cache.addAll([OFFLINE_URL, "/nmm-logo.png"]))
  );
  self.skipWaiting();
});

// Cache versioning + safe invalidation: bump CACHE_VERSION on meaningful
// service worker changes. Any previous-version cache is deleted here, so
// stale entries never accumulate or get served by mistake.
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key.startsWith("nmm-technician-shell-") && key !== SHELL_CACHE)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Only ever act on same-origin GET requests. Everything else (API calls,
  // POST/PATCH/DELETE mutations, cross-origin requests to Supabase/Stripe/
  // etc.) falls through to the network completely untouched, exactly as if
  // no service worker were registered. This is what keeps API traffic and
  // mutations out of this cache layer — Phase 3's offline route cache and
  // Phase 4's action queue own that at the application (IndexedDB) level,
  // not here.
  if (req.method !== "GET" || url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;

  // Navigation requests (loading or reloading an /employee/* page):
  // network-first so a technician with signal always sees fresh content,
  // falling back to a cached copy of that same URL, then to the offline
  // fallback page if neither is available.
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(SHELL_CACHE).then((cache) => cache.put(req, copy));
          return res;
        })
        .catch(() => caches.match(req).then((cached) => cached || caches.match(OFFLINE_URL)))
    );
    return;
  }

  // Static build assets only: Vite's production build emits hashed JS/CSS
  // under /assets/ (confirmed in dist/spa/assets/*); cache-first there is
  // safe because a cached entry is never stale in a way that matters — a
  // new deploy ships new hashed filenames, so old entries just stop being
  // requested. Deliberately scoped to exactly this path (rather than "any
  // same-origin GET") so this never absorbs anything else — in dev mode
  // Vite serves every source module as its own unbundled URL outside
  // /assets/, none of which should be cached here.
  if (url.pathname.startsWith("/assets/") || url.pathname === "/nmm-logo.png") {
    event.respondWith(
      caches.match(req).then((cached) => {
        if (cached) return cached;
        return fetch(req)
          .then((res) => {
            if (res.ok) {
              const copy = res.clone();
              caches.open(SHELL_CACHE).then((cache) => cache.put(req, copy));
            }
            return res;
          })
          .catch(() => cached);
      })
    );
    return;
  }

  // Everything else (dev-mode source modules, fonts from a CDN already
  // excluded by the origin check above, anything not explicitly handled):
  // pass straight through to the network, uncached. Safe default — nothing
  // here ends up in this service worker's cache unless it matched one of
  // the explicit branches above.
});
