// Warpreader Service Worker — offline support
const CACHE_NAME = 'warpreader-v1';
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

// Install: cache core app shell
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE_ASSETS))
  );
  self.skipWaiting();
});

// Activate: clean old caches
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch: network-first for API calls, cache-first for app shell
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);

  // API calls — always network, never cache
  if (url.pathname.startsWith('/api/')) return;

  // Supabase calls — always network
  if (url.hostname.includes('supabase')) return;

  // App shell — cache first, network fallback
  e.respondWith(
    caches.match(e.request).then((cached) => {
      const fetchPromise = fetch(e.request).then((response) => {
        // Update cache with fresh version
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(e.request, clone));
        }
        return response;
      }).catch(() => cached); // network failed, use cache

      return cached || fetchPromise;
    })
  );
});
