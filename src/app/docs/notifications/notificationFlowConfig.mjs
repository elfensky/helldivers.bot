import { createFlowConfig } from '@/app/docs/_diagram.mjs';

export const notificationFlowConfig = createFlowConfig({
    views: [
        { key: 'all', label: 'All Flows' },
        { key: 'polling', label: 'Live Polling' },
        { key: 'toast', label: 'Toast Notifications' },
        { key: 'push', label: 'Push Notifications' },
    ],

    flows: {
        polling: ['worker', 'update', 'db', 'live', 'hook'],
        toast: ['worker', 'update', 'db', 'live', 'hook', 'detect', 'toast', 'webnoti'],
        push: ['worker', 'update', 'pushcheck', 'pushapi', 'sw'],
    },

    legend: [
        { color: '#a855f7', label: 'Server / Worker' },
        { color: '#22c55e', label: 'Database' },
        { color: '#3b82f6', label: 'Transport' },
        { color: '#06b6d4', label: 'Client' },
        { color: '#f59e0b', label: 'Notification' },
    ],

    title: 'Notification Flow Diagram',
    description:
        'Interactive diagram showing how notifications flow from the worker thread through polling, toast, web notifications, and push notifications',

    details: {
        worker: {
            title: 'Worker Thread',
            subtitle: 'public/workers/cron.js',
            sections: [
                {
                    type: 'text',
                    content:
                        'Dedicated Worker Thread that polls the official Helldivers 1 API every ~20 seconds. Calls POST /api/h1/update via HTTP to the main Next.js process.',
                },
                {
                    type: 'table',
                    headers: ['Setting', 'Value'],
                    rows: [
                        ['Poll interval', 'UPDATE_INTERVAL env (default 20s)'],
                        ['Method', 'setTimeout (prevents overlap)'],
                        ['Auth', 'Bearer token (UPDATE_KEY)'],
                    ],
                },
            ],
        },
        update: {
            title: 'Update Route',
            subtitle: 'src/app/api/h1/update/route.js',
            sections: [
                {
                    type: 'text',
                    content:
                        'API route that runs updateStatus() and updateSeason(). After successful DB writes, triggers push notification check (fire-and-forget). Clients poll for fresh data independently.',
                },
                { type: 'heading', content: 'Sequence' },
                {
                    type: 'text',
                    content:
                        '1. Validate bearer token\n2. updateStatus() \u2192 DB writes\n3. updateSeason() \u2192 snapshot sync\n4. checkAndNotify() (async, non-blocking)',
                },
            ],
        },
        live: {
            title: 'Live Endpoint',
            subtitle: 'src/app/api/h1/live/route.js',
            sections: [
                {
                    type: 'text',
                    content:
                        'Lightweight GET endpoint that returns current campaign data and computed map state. Called by the useLiveData hook every 10 seconds. No authentication required.',
                },
                {
                    type: 'table',
                    headers: ['Property', 'Value'],
                    rows: [
                        ['Response', '{ data, mapState } JSON'],
                        ['Cache-Control', 'no-store'],
                        ['Bigint handling', 'JSON.stringify replacer'],
                    ],
                },
            ],
        },
        hook: {
            title: 'useLiveData Hook',
            subtitle: 'src/shared/hooks/useLiveData.mjs',
            sections: [
                {
                    type: 'text',
                    content:
                        'Client hook that polls /api/h1/live every 10 seconds via setInterval + fetch. Module-level singleton shared across all hook instances. Returns live data, map state, connection status, and previous data for change detection.',
                },
                { type: 'heading', content: 'First-Message Baseline' },
                {
                    type: 'text',
                    content:
                        'The first successful poll is treated as a silent state reset \u2014 no prevData is set. This prevents false toasts when the SSR snapshot is stale.',
                },
                { type: 'heading', content: 'Features' },
                {
                    type: 'table',
                    headers: ['Feature', 'Detail'],
                    rows: [
                        ['Poll interval', '10 seconds (POLL_INTERVAL)'],
                        ['Tab focus', 'visibilitychange fires immediate poll'],
                        ['Status', 'polling / live / offline (tri-state)'],
                        ['Leader election', 'BroadcastChannel for Web Notifications'],
                        ['Offline fallback', 'localStorage cache (hd1-live-cache-v1)'],
                    ],
                },
            ],
        },
        detect: {
            title: 'Change Detection',
            subtitle: 'src/shared/utils/game/detectChanges.mjs',
            sections: [
                {
                    type: 'text',
                    content:
                        'Pure function that compares previous and current event arrays. Used by both client (LiveToasts) and server (pushNotifier).',
                },
                {
                    type: 'table',
                    headers: ['Transition', 'Detection'],
                    rows: [
                        ['Campaign started', 'New event_id appears'],
                        ['Campaign won', 'active \u2192 success'],
                        ['Campaign lost', 'active \u2192 fail'],
                    ],
                },
            ],
        },
        toast: {
            title: 'Sonner Toasts',
            subtitle: 'src/features/notifications/LiveToasts.jsx',
            sections: [
                {
                    type: 'text',
                    content:
                        'Fires persistent toast notifications (duration: Infinity) on event transitions. Styled with faction colors and the same glow animation as contested regions on the map.',
                },
                {
                    type: 'table',
                    headers: ['Property', 'Value'],
                    rows: [
                        ['Duration', 'Infinite (until dismissed)'],
                        ['Accent', 'Right-side, faction color'],
                        ['Animation', 'card-glow pulse'],
                        ['Position', 'Bottom-right'],
                    ],
                },
            ],
        },
        webnoti: {
            title: 'Web Notifications',
            subtitle: 'Browser Notification API',
            sections: [
                {
                    type: 'text',
                    content:
                        'Native browser notifications for backgrounded tabs. Only fires when document.hidden is true and permission is granted. Leader tab only (BroadcastChannel election).',
                },
            ],
        },
        pushcheck: {
            title: 'Push Notifier',
            subtitle: 'src/update/pushNotifier.mjs',
            sections: [
                {
                    type: 'text',
                    content:
                        'Server-side change detection that runs after each update cycle (fire-and-forget). Keeps previous events in memory and sends web-push notifications on transitions.',
                },
                {
                    type: 'table',
                    headers: ['Feature', 'Detail'],
                    rows: [
                        ['Concurrency', 'Max 50 simultaneous pushes'],
                        ['Cleanup', 'Removes 410/404 subscriptions'],
                        ['Blocking', 'Non-blocking (async)'],
                        ['Reset', 'On server restart (ok)'],
                    ],
                },
            ],
        },
        pushapi: {
            title: 'Subscription API',
            subtitle: 'src/app/api/notifications/subscribe/route.js',
            sections: [
                {
                    type: 'text',
                    content:
                        'POST to subscribe (upserts endpoint + keys), DELETE to unsubscribe. Validated with Zod: endpoint URL max 2048, keys base64 max 256.',
                },
            ],
        },
        sw: {
            title: 'Service Worker',
            subtitle: 'src/sw.js (Serwist)',
            sections: [
                {
                    type: 'text',
                    content:
                        'Serwist-managed service worker with automatic precache manifest. Handles push events (showNotification) and notification clicks (focus/open). API routes excluded via explicit NetworkOnly matcher.',
                },
            ],
        },
        db: {
            title: 'Database',
            subtitle: 'PostgreSQL (Prisma 7)',
            sections: [
                {
                    type: 'text',
                    content:
                        'Central data store for all game state. The worker writes campaign status and snapshots via the Update Route. The Live Endpoint reads current campaign data for client polling.',
                },
                {
                    type: 'table',
                    headers: ['Table', 'Purpose'],
                    rows: [
                        ['h1_status', 'Bucketed campaign timeseries'],
                        ['h1_statistic', 'Bucketed stats timeseries'],
                        ['h1_event', 'Historical attack/defend events'],
                        ['push_subscription', 'Web push subscription endpoints'],
                    ],
                },
            ],
        },
    },
});
