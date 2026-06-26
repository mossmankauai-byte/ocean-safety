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
// CACHE NAMING (important): runtime caches use STABLE names with NO version suffix,
// so a deploy does NOT wipe cached map tiles, beach photos, fonts, or weather.
// Returning visitors stay fast instead of re-downloading everything on every publish
// (that was the cause of the Largest-Contentful-Paint spikes on deploy days).
// Only the precached app shell (HTML + icons) is keyed to CACHE_VERSION — so bumping
// it still ships new code on next launch; every other cache self-expires on its timer.

const CACHE_VERSION = 'v31-2026-06-25';

importScripts('https://storage.googleapis.com/workbox-cdn/releases/7.4.1/workbox-sw.js');

if (workbox) {
  workbox.setConfig({ debug: false });
  // Stable prefix only — NO version suffix, so runtime caches survive deploys.
  workbox.core.setCacheNameDetails({ prefix: 'os' });

  // ---- Precache the app shell so first-visit-offline shows the app ----
  // Keyed to CACHE_VERSION: bumping it ships new HTML/icons on next launch.
  workbox.precaching.cleanupOutdatedCaches();
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
      cacheName: 'osm-tiles',
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
      cacheName: 'map-tiles',
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
      cacheName: 'open-meteo',
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
      cacheName: 'noaa-tides',
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
      cacheName: 'wikimedia',
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
      cacheName: 'affiliate',
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
      cacheName: 'google-fonts',
      plugins: [
        new workbox.cacheableResponse.CacheableResponsePlugin({ statuses: [0, 200] }),
        new workbox.expiration.ExpirationPlugin({
          maxEntries: 30,
          maxAgeSeconds: 365 * 24 * 60 * 60
        })
      ]
    })
  );

  // ---- App shell: same-origin HTML / JS / CSS / images / SVG ----
  // StaleWhileRevalidate so repeat opens are instant; a fresh deploy lands on next navigation.
  // Stable cache name: a deploy revalidates changed files in the background instead of
  // dumping the whole shell and forcing a cold re-download.
  workbox.routing.registerRoute(
    ({ request, url }) =>
      url.origin === self.location.origin &&
      ['document', 'script', 'style', 'image', 'font'].includes(request.destination),
    new workbox.strategies.StaleWhileRevalidate({
      cacheName: 'app-shell',
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

// One-time cleanup: reclaim space from OLD version-suffixed caches left by earlier
// deploys (e.g. "osm-tiles-v24-2026-06-21", "os-precache-v25-2026-06-22"). The dated
// -vNN-YYYY-MM-DD suffix is unique to the old scheme, so this never matches the new
// stable caches or Workbox's own precache.
const LEGACY_CACHE = /-v\d+-20\d\d-\d\d-\d\d$/;
self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(
      names.filter((n) => LEGACY_CACHE.test(n)).map((n) => caches.delete(n))
    );
    await self.clients.claim();
  })());
});
