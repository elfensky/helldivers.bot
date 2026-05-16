import { createFlowConfig } from '@/shared/utils/diagram.mjs';

export const inAppFlowConfig = createFlowConfig({
    views: [{ key: 'all', label: 'All' }],

    legend: [
        { color: '#3b82f6', label: 'External API / Transport' },
        { color: '#a855f7', label: 'Server' },
        { color: '#06b6d4', label: 'Client' },
        { color: '#f59e0b', label: 'Notification' },
    ],

    title: 'In-App Notification Flow (Polling + Toasts)',
    description:
        'How data flows from the official API through polling to in-app toasts and web notifications',

    details: {
        hd1_api: {
            title: 'Official HD1 API',
            subtitle: 'External data source',
            sections: [
                {
                    type: 'text',
                    content:
                        'Official Helldivers 1 API. Updates approximately every second, but the worker polls less frequently to avoid overload.',
                },
            ],
        },
        worker: {
            title: 'Worker Thread',
            subtitle: 'public/workers/cron.js',
            sections: [
                {
                    type: 'text',
                    content:
                        'Dedicated Worker Thread using setTimeout loop (prevents overlap). Calls POST /api/h1/update via HTTP with bearer token auth.',
                },
            ],
        },
        post_update: {
            title: 'Update Route',
            subtitle: 'src/app/api/h1/update/route.js',
            sections: [
                {
                    type: 'text',
                    content:
                        'Validates bearer token, then runs updateStatus() and updateSeason(). Also triggers checkAndNotify() for push notifications (fire-and-forget).',
                },
            ],
        },
        update_status: {
            title: 'updateStatus()',
            subtitle: 'src/update/updateStatus.mjs',
            sections: [
                {
                    type: 'text',
                    content:
                        'Writes campaign progress, event states, and statistics to h1_status, h1_event, and h1_statistic tables via Prisma.',
                },
            ],
        },
        poll: {
            title: 'Client Polling',
            subtitle: 'src/shared/hooks/useLiveData.mjs',
            sections: [
                {
                    type: 'text',
                    content:
                        'setInterval fires every 10 seconds. A visibilitychange listener fires an immediate poll on tab focus (browsers throttle setInterval in background tabs).',
                },
            ],
        },
        live_api: {
            title: 'Live API Endpoint',
            subtitle: 'src/app/api/h1/live/route.js',
            sections: [
                {
                    type: 'text',
                    content:
                        'Lightweight GET endpoint. Calls getCampaign() + computeMapState() and returns JSON. No authentication required.',
                },
            ],
        },
        get_campaign: {
            title: 'getCampaign() + computeMapState()',
            subtitle: 'src/db/queries/',
            sections: [
                {
                    type: 'text',
                    content:
                        'Queries the database for current campaign state and computes the galaxy map sector ownership. Returns serialized JSON.',
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
                        'Module-level singleton ensures one poll interval per tab. Returns live data, map state, connection status, and previous data for change detection.',
                },
            ],
        },
        rerender: {
            title: 'State Replacement',
            subtitle: 'React re-render cycle',
            sections: [
                {
                    type: 'text',
                    content:
                        'Each poll response replaces the entire client state. React re-renders with the new data. The first poll is treated as a silent baseline (no change detection).',
                },
            ],
        },
        detect_changes: {
            title: 'Change Detection',
            subtitle: 'src/shared/utils/game/detectChanges.mjs',
            sections: [
                {
                    type: 'text',
                    content:
                        'Pure function comparing previous and current event arrays. Detects campaign started/won/lost transitions.',
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
        sonner_toast: {
            title: 'Sonner Toasts',
            subtitle: 'src/features/notifications/LiveToasts.jsx',
            sections: [
                {
                    type: 'text',
                    content:
                        'Persistent toast notifications (duration: Infinity) with faction-colored accent and glow animation. Always fires on transitions.',
                },
            ],
        },
        web_noti: {
            title: 'Web Notifications',
            subtitle: 'Browser Notification API',
            sections: [
                {
                    type: 'text',
                    content:
                        'Native browser notifications. Only fires when document.hidden is true, the tab is the BroadcastChannel leader, and permission is granted.',
                },
            ],
        },
    },
});
