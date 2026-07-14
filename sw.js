// Service worker for Ocean Safe — Kauaʻi Beach Guide.
// Powered by Workbox v7 (loaded from Google's CDN — no build step required).
//
// Strategy summary:
//   - OpenStreetMap tiles      → CacheFirst (30 days)        — tiles never change
//   - Open-Meteo weather       → StaleWhileRevalidate (1 hr) — keep fresh, fall back to cached when offline
//   - NOAA tides               → StaleWhileRevalidate (6 hr) — same idea, slower-changing data
//   - GetYourGuide & affiliate widgets → NetworkFirst (3s)   — get fresh listings, cache if offline
//   - HTML / JS / CSS / icons  → StaleWhileRevalidate         — fast loads, deploys land within minutes
//
// To bust the cache after a meaningful deploy, bump CACHE_VERSION below.
// Visitors get the new HTML on next launch (with a brief "Updating…" hop).

const CACHE_VERSION = 'v28-2026-07-10-multi-island';

importScripts('https://storage.googleapis.com/workbox-cdn/releases/7.4.1/workbox-sw.js');

if (workbox) {
  workbox.setConfig({ debug: false });
  workbox.core.setCacheNameDetails({ prefix: 'os', suffix: CACHE_VERSION });

  // ---- Precache the app shell so first-visit-offline shows the app ----
  // Bump CACHE_VERSION above to invalidate.
  workbox.precaching.precacheAndRoute([
    { url: '/',                         revision: CACHE_VERSION },
    { url: '/index.html',               revision: CACHE_VERSION },
    { url: '/manifest.webmanifest',     revision: CACHE_VERSION },
    { url: '/icons/favicon-32.png',     revision: CACHE_VERSION },
    { url: '/icons/apple-touch-icon.png', revision: CACHE_VERSION },
    { url: '/icons/pwa-192.png',        revision: CACHE_VERSION },
    { url: '/icons/pwa-512.png',        revision: CACHE_VERSION },
    { url: '/icons/og-image.png',       revision: CACHE_VERSION }
  ]);

  // ---- Map tiles (OpenStreetMap + variants) ----
  workbox.routing.registerRoute(
    /^https:\/\/[a-c]\.tile\.openstreetmap\.org\//,
    new workbox.strategies.CacheFirst({
      cacheName: `osm-tiles-${CACHE_VERSION}`,
      plugins: [
        new workbox.cacheableResponse.CacheableResponsePlugin({ statuses: [0, 200] }),
        new workbox.expiration.ExpirationPlugin({
          maxEntries: 800,
          maxAgeSeconds: 30 * 24 * 60 * 60,
          purgeOnQuotaError: true
        })
      ]
    })
  );

  // CartoDB / Stamen / other tile providers (defensive — catches future tile swaps)
  workbox.routing.registerRoute(
    /^https:\/\/[a-d]?\.?(basemaps\.cartocdn|tile\.openstreetmap|tiles\.stadiamaps)\.[a-z]+\//,
    new workbox.strategies.CacheFirst({
      cacheName: `map-tiles-${CACHE_VERSION}`,
      plugins: [
        new workbox.cacheableResponse.CacheableResponsePlugin({ statuses: [0, 200] }),
        new workbox.expiration.ExpirationPlugin({
          maxEntries: 800,
          maxAgeSeconds: 30 * 24 * 60 * 60,
          purgeOnQuotaError: true
        })
      ]
    })
  );

  // ---- Open-Meteo weather/forecast ----
  workbox.routing.registerRoute(
    /^https:\/\/api\.open-meteo\.com\//,
    new workbox.strategies.StaleWhileRevalidate({
      cacheName: `open-meteo-${CACHE_VERSION}`,
      plugins: [
        new workbox.cacheableResponse.CacheableResponsePlugin({ statuses: [0, 200] }),
        new workbox.expiration.ExpirationPlugin({
          maxEntries: 50,
          maxAgeSeconds: 60 * 60
        })
      ]
    })
  );

  // ---- NOAA tides & currents ----
  workbox.routing.registerRoute(
    /^https:\/\/api\.tidesandcurrents\.noaa\.gov\//,
    new workbox.strategies.StaleWhileRevalidate({
      cacheName: `noaa-tides-${CACHE_VERSION}`,
      plugins: [
        new workbox.cacheableResponse.CacheableResponsePlugin({ statuses: [0, 200] }),
        new workbox.expiration.ExpirationPlugin({
          maxEntries: 20,
          maxAgeSeconds: 6 * 60 * 60
        })
      ]
    })
  );

  // ---- Wikimedia images (beach photos) ----
  workbox.routing.registerRoute(
    /^https:\/\/upload\.wikimedia\.org\//,
    new workbox.strategies.CacheFirst({
      cacheName: `wikimedia-${CACHE_VERSION}`,
      plugins: [
        new workbox.cacheableResponse.CacheableResponsePlugin({ statuses: [0, 200] }),
        new workbox.expiration.ExpirationPlugin({
          maxEntries: 200,
          maxAgeSeconds: 30 * 24 * 60 * 60,
          purgeOnQuotaError: true
        })
      ]
    })
  );

  // ---- Affiliate widgets (GetYourGuide, Viator) — network-first so listings stay current ----
  workbox.routing.registerRoute(
    /^https:\/\/(widget\.getyourguide|www\.viator)\.com\//,
    new workbox.strategies.NetworkFirst({
      cacheName: `affiliate-${CACHE_VERSION}`,
      networkTimeoutSeconds: 3,
      plugins: [
        new workbox.expiration.ExpirationPlugin({
          maxEntries: 50,
          maxAgeSeconds: 24 * 60 * 60
        })
      ]
    })
  );

  // ---- Google Fonts (Fraunces + Inter) ----
  workbox.routing.registerRoute(
    /^https:\/\/fonts\.(googleapis|gstatic)\.com\//,
    new workbox.strategies.CacheFirst({
      cacheName: `google-fonts-${CACHE_VERSION}`,
      plugins: [
        new workbox.cacheableResponse.CacheableResponsePlugin({ statuses: [0, 200] }),
        new workbox.expiration.ExpirationPlugin({
          maxEntries: 30,
          maxAgeSeconds: 365 * 24 * 60 * 60
        })
      ]
    })
  );

  // ---- Per-island data (/data/<slug>.js) — runtime SWR, NOT precached ----
  // Deliberately kept out of the precache list above so Kauaʻi-only visitors never
  // download other islands. Registered BEFORE the generic app-shell route so it owns
  // its own cache bucket; the app-shell route would otherwise also catch these scripts.
  workbox.routing.registerRoute(
    ({ url }) => url.origin === self.location.origin && /^\/data\/[a-z0-9_-]+\.js$/.test(url.pathname),
    new workbox.strategies.StaleWhileRevalidate({
      cacheName: `island-data-${CACHE_VERSION}`,
      plugins: [
        new workbox.cacheableResponse.CacheableResponsePlugin({ statuses: [0, 200] }),
        new workbox.expiration.ExpirationPlugin({ maxEntries: 8, maxAgeSeconds: 30 * 24 * 60 * 60 })
      ]
    })
  );

  // ---- App shell: same-origin HTML / JS / CSS / images / SVG ----
  // StaleWhileRevalidate so repeat opens are instant; a fresh deploy lands on next navigation.
  workbox.routing.registerRoute(
    ({ request, url }) =>
      url.origin === self.location.origin &&
      ['document', 'script', 'style', 'image', 'font'].includes(request.destination),
    new workbox.strategies.StaleWhileRevalidate({
      cacheName: `app-shell-${CACHE_VERSION}`,
      plugins: [
        new workbox.cacheableResponse.CacheableResponsePlugin({ statuses: [0, 200] }),
        new workbox.expiration.ExpirationPlugin({
          maxEntries: 60,
          maxAgeSeconds: 14 * 24 * 60 * 60
        })
      ]
    })
  );
}

// Take control immediately on update — so a deploy doesn't require closing all tabs.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

