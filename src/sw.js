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

// --- GlitchTip error bridge ---
//
// SW lives in a context that can't import the Sentry browser SDK. We
// postMessage failures to controlled clients; the client-side bridge in
// `src/shared/utils/swErrorBridge.mjs` reconstructs the Error and calls
// reportError. If no clients are open (push received with all tabs
// closed), log to the SW console as a fallback — visible from
// chrome://serviceworker-internals during incident triage.
function postSwError(error, context = {}) {
    const payload = {
        type: 'sw-error',
        error: {
            message: error?.message ?? String(error),
            name: error?.name ?? 'Error',
            stack: error?.stack,
        },
        context,
    };
    self.clients
        .matchAll({ type: 'window', includeUncontrolled: true })
        .then((clients) => {
            if (clients.length === 0) {
                console.error('[sw] error (no clients open):', payload);
                return;
            }
            for (const client of clients) {
                client.postMessage(payload);
            }
        })
        .catch(() => {});
}

// --- Custom: Push Notifications ---

self.addEventListener('push', (event) => {
    try {
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
            self.registration
                .showNotification(payload.title || 'Helldivers Bot', {
                    body: payload.body || '',
                    icon,
                    badge,
                    tag,
                    renotify,
                    data: payload.data,
                })
                .catch((err) => {
                    postSwError(err, { handler: 'push', stage: 'showNotification' });
                    throw err;
                }),
        );
    } catch (err) {
        postSwError(err, { handler: 'push', stage: 'sync' });
        throw err;
    }
});

// Notification click — open or focus the app
self.addEventListener('notificationclick', (event) => {
    try {
        event.notification.close();
        event.waitUntil(
            self.clients
                .matchAll({ type: 'window', includeUncontrolled: true })
                .then((clients) => {
                    if (clients.length > 0) {
                        return clients[0].focus();
                    }
                    return self.clients.openWindow('/');
                })
                .catch((err) => {
                    postSwError(err, { handler: 'notificationclick', stage: 'focus' });
                    throw err;
                }),
        );
    } catch (err) {
        postSwError(err, { handler: 'notificationclick', stage: 'sync' });
        throw err;
    }
});
