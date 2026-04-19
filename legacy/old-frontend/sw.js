const CACHE_VERSION = 'trip-map-v2';
const APP_SHELL = `app-shell-${CACHE_VERSION}`;
const VENDOR = `vendor-${CACHE_VERSION}`;
const DATA = `data-${CACHE_VERSION}`;
const TILES = `tiles-${CACHE_VERSION}`;
const PHOTOS = `photos-${CACHE_VERSION}`;
const TILE_LIMIT = 200;

const SHELL_URLS = [
  '/',
  '/index.html',
  '/app.js',
  '/styles.css',
  '/runtime-config.js',
];

const VENDOR_URLS = [
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
  'https://unpkg.com/leaflet.markercluster@1.4.1/dist/MarkerCluster.css',
  'https://unpkg.com/leaflet.markercluster@1.4.1/dist/MarkerCluster.Default.css',
  'https://unpkg.com/leaflet.markercluster@1.4.1/dist/leaflet.markercluster.js',
];

function precache(cacheName, urls) {
  return caches.open(cacheName).then((cache) =>
    Promise.all(
      urls.map((url) =>
        cache.add(url).catch((err) => {
          console.warn('[sw] precache failed', url, err);
        })
      )
    )
  );
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    Promise.all([precache(APP_SHELL, SHELL_URLS), precache(VENDOR, VENDOR_URLS)])
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  const keep = new Set([APP_SHELL, VENDOR, DATA, TILES, PHOTOS]);
  event.waitUntil(
    caches
      .keys()
      .then((names) =>
        Promise.all(names.filter((n) => !keep.has(n)).map((n) => caches.delete(n)))
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  let url;
  try {
    url = new URL(req.url);
  } catch (_err) {
    return;
  }

  if (url.pathname.startsWith('/admin') || url.pathname.startsWith('/api/admin')) return;
  if (url.hostname === 'maps.googleapis.com' || url.hostname === 'maps.gstatic.com') return;
  if (url.hostname === 'places.googleapis.com') return;
  if (url.hostname === 'nominatim.openstreetmap.org') return;

  if (url.hostname === 'tile.openstreetmap.org') {
    event.respondWith(cacheFirstWithLRU(req, TILES, TILE_LIMIT));
    return;
  }

  if (url.hostname === 'unpkg.com') {
    event.respondWith(cacheFirst(req, VENDOR));
    return;
  }

  if (url.origin === self.location.origin && url.pathname.startsWith('/photos/')) {
    event.respondWith(cacheFirst(req, PHOTOS));
    return;
  }

  if (url.origin === self.location.origin && /^\/api\/trips\/[^/]+\/full$/.test(url.pathname)) {
    event.respondWith(staleWhileRevalidate(req, DATA));
    return;
  }

  if (url.origin === self.location.origin && url.pathname.startsWith('/api/')) return;

  if (url.origin === self.location.origin) {
    event.respondWith(staleWhileRevalidate(req, APP_SHELL));
  }
});

async function cacheFirst(req, cacheName) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok) cache.put(req, res.clone());
  return res;
}

async function cacheFirstWithLRU(req, cacheName, limit) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok) {
    cache.put(req, res.clone()).then(() => trimCache(cacheName, limit));
  }
  return res;
}

async function trimCache(cacheName, limit) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  if (keys.length <= limit) return;
  for (let i = 0; i < keys.length - limit; i += 1) {
    await cache.delete(keys[i]);
  }
}

async function staleWhileRevalidate(req, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(req);
  const network = fetch(req)
    .then((res) => {
      if (res.ok) cache.put(req, res.clone());
      return res;
    })
    .catch(() => null);
  return cached || (await network) || new Response('', { status: 504 });
}
