// portal-shop/sw.js — the partner portal's OWN service worker.
//
// Why this file exists at all, given the root sw.js:
//
// 1. INSTALLABILITY. Chrome will not fire `beforeinstallprompt` without a manifest,
//    HTTPS (or localhost), and a service worker WITH A FETCH HANDLER controlling the
//    page. An operator who arrives straight at /portal-shop/dashboard.html?t=... from
//    the welcome email has never loaded the root app, so nothing controls the page and
//    the desktop-icon prompt can never appear.
//
// 2. FRESHNESS. The root sw.js takes scope "/" and runs StaleWhileRevalidate over every
//    same-origin document, script and style, which includes portal-shop/app.js and
//    portal.css. That serves a returning operator the PREVIOUS build on their first
//    load after a deploy. Registering a worker at /portal-shop/ takes control of these
//    pages instead, because the longest matching scope wins, so the portal stops being
//    stale without editing the root worker.
//
// The strategy here is deliberately the opposite of the guest app's. The guest app is
// an offline beach guide and wants cache-first. The portal is a console an operator
// makes decisions in, and the worst failure by far is showing them an old build. So:
// NETWORK FIRST, cache only as the fallback for a shop with flaky wifi.
//
// Bump CACHE_VERSION on any portal-shop change that must reach operators immediately.
const CACHE_VERSION = "portal-shop-v1-2026-08-13";

self.addEventListener("install", (e) => {
  // No precache list. The fetch handler fills the cache with whatever the operator
  // actually opens, and a precache list here would be one more thing to keep in sync.
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.map((n) => (n.startsWith("portal-shop-") && n !== CACHE_VERSION ? caches.delete(n) : null)));
    // claim() is what actually takes these pages off the root worker on the first
    // load after registering, rather than one navigation later.
    await self.clients.claim();
  })());
});

const inScope = (url) =>
  url.origin === self.location.origin && url.pathname.startsWith("/portal-shop/");

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  // Anything outside /portal-shop/ is left entirely alone: Supabase calls, the CDN,
  // /assets/vendor/qrcode.min.js and the shared /icons. Not intercepting them keeps
  // this worker out of the way of the auth and Edge Function paths.
  if (!inScope(url)) return;
  if (!["document", "script", "style", "image", "manifest"].includes(req.destination)) return;

  e.respondWith((async () => {
    try {
      // cache:"no-cache", not a bare fetch. A plain fetch() inside a worker still goes
      // through Chrome's own HTTP cache, and python/Netlify serve these files with no
      // Cache-Control, so heuristic freshness handed back the PREVIOUS build even though
      // this handler is network-first. Measured: edit portal.css, reload, old bytes. This
      // forces a conditional request, so the server decides, and a 304 still costs nothing.
      const fresh = await fetch(req, { cache: "no-cache" });
      // Only 200s are worth keeping. Caching a redirect or an error page is how a
      // console starts serving a sign-in bounce to somebody who is signed in.
      if (fresh && fresh.status === 200 && fresh.type === "basic") {
        const c = await caches.open(CACHE_VERSION);
        c.put(req, fresh.clone());
      }
      return fresh;
    } catch (_) {
      const hit = await caches.match(req);
      if (hit) return hit;
      throw new Error("offline and not cached");
    }
  })());
});
