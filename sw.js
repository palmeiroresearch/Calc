const CACHE_NAME = 'calculadora-v1.1.0';

// Must exist — install fails if any of these are missing
const ASSETS_CRITICAL = [
    './',
    './index.html',
    './manifest.json',
    './css/main.css',
    './js/config.js',
    './js/logic.js',
    './js/converter.js',
    './js/app.js',
];

// Optional — cached individually, errors ignored
const ASSETS_OPTIONAL = [
    './icon-192.png',
    './icon-512.png',
    './rates.json',
];

// Install: cache critical assets, then try optional ones
self.addEventListener('install', e => {
    e.waitUntil(
        caches.open(CACHE_NAME).then(cache =>
            cache.addAll(ASSETS_CRITICAL).then(() =>
                Promise.all(
                    ASSETS_OPTIONAL.map(url => cache.add(url).catch(() => {}))
                )
            )
        )
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
