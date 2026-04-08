// SYGNAL Service Worker — enables offline + install as app
const CACHE_NAME = 'sygnal-v1';
const ASSETS = [
    '/',
    '/style.css',
    '/app.js',
    '/manifest.json',
    '/icon-192.png',
    '/icon-512.png',
];

// Install — cache core assets
self.addEventListener('install', (e) => {
    e.waitUntil(
        caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
    );
    self.skipWaiting();
});

// Activate — clean old caches
self.addEventListener('activate', (e) => {
    e.waitUntil(
        caches.keys().then(keys =>
            Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
        )
    );
    self.clients.claim();
});

// Fetch — network first, fall back to cache
self.addEventListener('fetch', (e) => {
    // Don't cache API calls — skip external URLs entirely (let browser handle)
    if (e.request.url.includes('/api/') && !e.request.url.startsWith(self.location.origin)) {
        return; // Don't intercept external API calls (Railway bot, etc)
    }
    if (e.request.url.includes('/api/')) {
        e.respondWith(fetch(e.request).catch(() => new Response('{"error":"offline"}', {
            headers: { 'Content-Type': 'application/json' }
        })));
        return;
    }

    e.respondWith(
        fetch(e.request)
            .then(resp => {
                // Cache successful responses
                if (resp.ok) {
                    const clone = resp.clone();
                    caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone));
                }
                return resp;
            })
            .catch(() => caches.match(e.request))
    );
});
