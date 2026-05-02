const CACHE_NAME = 'calculadora-v1.0.0';

const ASSETS = [
    '/Calculadora/',
    '/Calculadora/index.html',
    '/Calculadora/manifest.json',
    '/Calculadora/css/main.css',
    '/Calculadora/js/config.js',
    '/Calculadora/js/logic.js',
    '/Calculadora/js/app.js',
    '/Calculadora/icon-192.png',
    '/Calculadora/icon-512.png',
];

// Install: cache all assets, do NOT skipWaiting
self.addEventListener('install', e => {
    e.waitUntil(
        caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
    );
});

// Activate: remove old caches, claim clients
self.addEventListener('activate', e => {
    e.waitUntil(
        caches.keys()
            .then(keys => Promise.all(
                keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
            ))
            .then(() => self.clients.claim())
    );
});

// Fetch: cache-first with background revalidation (stale-while-revalidate)
self.addEventListener('fetch', e => {
    if (e.request.method !== 'GET') return;

    e.respondWith(
        caches.match(e.request).then(cached => {
            const network = fetch(e.request).then(res => {
                if (res && res.ok) {
                    const clone = res.clone();
                    caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone));
                }
                return res;
            }).catch(() => {});

            return cached || network;
        })
    );
});

// Skip waiting on demand from app.js
self.addEventListener('message', e => {
    if (e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting();
});
