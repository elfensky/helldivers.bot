const CACHE_NAME = 'hd1-shell-v2';

// If you add icons or static assets to public/, update this list.
const SHELL_ASSETS = [
    '/',
    '/icon.svg',
    '/apple-icon.png',
    '/site.webmanifest',
    '/fonts/insignia.regular.otf',
    '/icons/superearth.webp',
    '/icons/faction0.webp',
    '/icons/faction1.webp',
    '/icons/faction2.webp',
    '/icons/faction3.webp',
    '/icons/attack.webp',
    '/icons/defend.webp',
    '/images/logo.webp',
    '/svgs/galaxy.svg',
];

// Install — cache app shell (do NOT skipWaiting — controlled by client)
self.addEventListener('install', (event) => {
    event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_ASSETS)));
});

// Activate — clean old caches, claim clients
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

// Message — controlled update: client tells us when to activate
self.addEventListener('message', (event) => {
    if (event.data?.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});

// Fetch — network-first for navigation, stale-while-revalidate for assets
self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    // Never intercept API routes or SSE stream
    if (url.pathname.startsWith('/api/')) return;

    // Only handle GET requests
    if (event.request.method !== 'GET') return;

    // Skip non-same-origin requests
    if (url.origin !== self.location.origin) return;

    // Navigation requests (HTML documents) — network-first with cache fallback
    if (event.request.mode === 'navigate') {
        event.respondWith(
            fetch(event.request)
                .then((response) => {
                    if (response.ok) {
                        const clone = response.clone();
                        caches.open(CACHE_NAME).then((cache) => {
                            cache.put(event.request, clone);
                        });
                    }
                    return response;
                })
                .catch(() =>
                    caches
                        .match(event.request)
                        .then(
                            (cached) =>
                                cached || new Response('Offline', { status: 503 }),
                        ),
                ),
        );
        return;
    }

    // Static assets — stale-while-revalidate
    event.respondWith(
        caches.match(event.request).then((cached) => {
            const fetchPromise = fetch(event.request)
                .then((response) => {
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

// Push — show native notification (validate payload)
self.addEventListener('push', (event) => {
    if (!event.data) return;

    let payload;
    try {
        payload = event.data.json();
    } catch {
        payload = { title: 'Helldivers Bot', body: event.data.text() };
    }

    // Validate icon is same-origin (prevent spoofing via compromised push endpoint)
    let icon = '/icons/superearth.webp';
    if (payload.icon && typeof payload.icon === 'string') {
        if (payload.icon.startsWith('/') && !payload.icon.startsWith('//')) {
            icon = payload.icon;
        }
    }

    // Validate badge is same-origin (same pattern as icon)
    let badge = '/favicons/favicon-96x96.png';
    if (payload.badge && typeof payload.badge === 'string') {
        if (payload.badge.startsWith('/') && !payload.badge.startsWith('//')) {
            badge = payload.badge;
        }
    }

    // Tag and renotify — pass through if present
    // renotify without a tag is invalid per spec and Chrome will throw
    const tag = typeof payload.tag === 'string' ? payload.tag : undefined;
    const renotify = tag ? Boolean(payload.renotify) : undefined;

    event.waitUntil(
        self.registration.showNotification(payload.title || 'Helldivers Bot', {
            body: payload.body || '',
            icon,
            badge,
            tag,
            renotify,
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
