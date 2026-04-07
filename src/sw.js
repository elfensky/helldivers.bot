import { defaultCache } from '@serwist/next/worker';
import { Serwist, NetworkOnly } from 'serwist';

const serwist = new Serwist({
    precacheEntries: self.__SW_MANIFEST,
    skipWaiting: true,
    clientsClaim: true,
    runtimeCaching: [
        // Explicit: never cache API routes
        {
            matcher: ({ sameOrigin, url }) =>
                sameOrigin && url.pathname.startsWith('/api/'),
            handler: new NetworkOnly(),
        },
        ...defaultCache,
    ],
});

serwist.addEventListeners();

// --- Custom: Push Notifications ---

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
