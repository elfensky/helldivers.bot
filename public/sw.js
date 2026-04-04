const CACHE_NAME = 'hd1-shell-v1';
const SHELL_ASSETS = ['/', '/icon.svg', '/apple-icon.png'];

// Install — cache app shell
self.addEventListener('install', (event) => {
    event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_ASSETS)));
    self.skipWaiting();
});

// Activate — clean old caches
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches
            .keys()
            .then((keys) =>
                Promise.all(
                    keys
                        .filter((key) => key !== CACHE_NAME)
                        .map((key) => caches.delete(key)),
                ),
            ),
    );
    self.clients.claim();
});

// Fetch — stale-while-revalidate for shell, skip API routes
self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    // Never intercept API routes or SSE stream
    if (url.pathname.startsWith('/api/')) return;

    // Only handle GET requests
    if (event.request.method !== 'GET') return;

    // Skip non-same-origin requests
    if (url.origin !== self.location.origin) return;

    event.respondWith(
        caches.match(event.request).then((cached) => {
            const fetchPromise = fetch(event.request)
                .then((response) => {
                    // Cache successful responses for shell assets
                    if (response.ok) {
                        const clone = response.clone();
                        caches.open(CACHE_NAME).then((cache) => {
                            cache.put(event.request, clone);
                        });
                    }
                    return response;
                })
                .catch(() => cached);

            return cached || fetchPromise;
        }),
    );
});

// Push — show native notification
self.addEventListener('push', (event) => {
    if (!event.data) return;

    let payload;
    try {
        payload = event.data.json();
    } catch {
        payload = { title: 'Helldivers Bot', body: event.data.text() };
    }

    event.waitUntil(
        self.registration.showNotification(payload.title || 'Helldivers Bot', {
            body: payload.body || '',
            icon: payload.icon || '/icon.svg',
            badge: '/icon.svg',
            data: payload.data,
        }),
    );
});

// Notification click — open or focus the app
self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    event.waitUntil(
        self.clients
            .matchAll({ type: 'window', includeUncontrolled: true })
            .then((clients) => {
                if (clients.length > 0) {
                    return clients[0].focus();
                }
                return self.clients.openWindow('/');
            }),
    );
});
