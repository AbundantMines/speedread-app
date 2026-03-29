// Warpreader Service Worker v3 — network-first for JS, cache fallback for offline
const CACHE_NAME = 'warpreader-v3';
const CORE_ASSETS = [
  '/app.html',
  '/app.js',
  '/auth.js',
  '/billing.js',
  '/sync.js',
  '/training.js',
  '/epub.js',
  '/analytics.js',
];

// Install: cache core assets, activate immediately
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE_ASSETS))
  );
  self.skipWaiting();
});

// Activate: clean old caches, take control immediately
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch: NETWORK-FIRST for everything (use cache only when offline)
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);

  // Skip non-GET, API calls, and external requests
  if (e.request.method !== 'GET') return;
  if (url.pathname.startsWith('/api/')) return;
  if (url.hostname.includes('supabase')) return;
  if (!url.hostname.includes('warpreader')) return;

  e.respondWith(
    fetch(e.request)
      .then((response) => {
        // Got fresh response — update cache
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(e.request, clone));
        }
        return response;
      })
      .catch(() => {
        // Offline — serve from cache
        return caches.match(e.request);
      })
  );
});
