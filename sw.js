const CACHE_NAME = 'calculadora-v1.2.0';

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

// Fetch: network-first for rates.json, cache-first for everything else
self.addEventListener('fetch', e => {
    if (e.request.method !== 'GET') return;

    const isRates = e.request.url.endsWith('rates.json');

    if (isRates) {
        // Network-first: always try to get fresh rates, fall back to cache offline
        e.respondWith(
            fetch(e.request).then(res => {
                if (res && res.ok) {
                    const clone = res.clone();
                    caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone));
                }
                return res;
            }).catch(() => caches.match(e.request))
        );
        return;
    }

    // Cache-first for all other assets (app shell)
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
