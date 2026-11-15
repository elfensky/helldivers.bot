import { createFlowConfig } from '@/app/docs/_diagram.mjs';

export const overviewConfig = createFlowConfig({
    views: [{ key: 'all', label: 'All' }],

    flows: {},

    legend: [
        { color: '#a855f7', label: 'Frontend' },
        { color: '#22c55e', label: 'Backend' },
        { color: '#f59e0b', label: 'Data Layer' },
    ],

    title: 'System Overview',
    description:
        'High-level architecture showing how the frontend, backend API routes, and data layer connect',

    details: {
        dash: {
            title: 'Dashboard',
            subtitle: 'src/app/page.jsx',
            sections: [
                {
                    type: 'text',
                    content:
                        'Live campaign dashboard with galaxy map, faction stats, event cards, and timeline. Polls /api/h1/live every 10 seconds via the useLiveData hook.',
                },
            ],
        },
        archives: {
            title: 'Archives',
            subtitle: 'src/app/archives/page.jsx',
            sections: [
                {
                    type: 'text',
                    content:
                        'Historical war browser. Season selector derives available seasons from the current season number. Missing seasons are fetched from the official API on first request.',
                },
            ],
        },
        profile: {
            title: 'Profile',
            subtitle: 'src/app/profile/page.jsx',
            sections: [
                {
                    type: 'text',
                    content:
                        'Account management page with API key generation, session management, and linked OAuth accounts. Requires authentication — redirects home when auth is disabled.',
                },
            ],
        },
        docs: {
            title: 'Documentation',
            subtitle: 'src/app/docs/',
            sections: [
                {
                    type: 'text',
                    content:
                        'MDX-based documentation with interactive Mermaid diagrams, code samples, and architecture guides.',
                },
            ],
        },
        api_live: {
            title: 'Live Endpoint',
            subtitle: 'src/app/api/h1/live/route.js',
            sections: [
                {
                    type: 'text',
                    content:
                        'Lightweight GET endpoint returning current campaign data and computed map state. No authentication required. Called by the useLiveData hook every 10 seconds.',
                },
            ],
        },
        api_rb: {
            title: 'Rebroadcast API',
            subtitle: 'src/app/api/h1/rebroadcast/',
            sections: [
                {
                    type: 'text',
                    content:
                        'Proxies the official Helldivers 1 API for external consumers. Reconstructs the official wire format from the normalized h1_* tables. Requires API key authentication.',
                },
            ],
        },
        api_update: {
            title: 'Update Route',
            subtitle: 'src/app/api/h1/update/route.js',
            sections: [
                {
                    type: 'text',
                    content:
                        'Internal GET endpoint (Bearer UPDATE_KEY) that the worker thread calls. Only the poller lease holder does the work; other replicas answer standby. POST answers 405. Runs updateStatus() and updateSeason(), then the push notification check.',
                },
            ],
        },
        auth_api: {
            title: 'Auth API',
            subtitle: 'src/app/api/auth/[...all]/route.js',
            sections: [
                {
                    type: 'text',
                    content:
                        'BetterAuth catch-all route handling Discord, GitHub and Google OAuth flows, session management, and account operations. Optional — returns 503 when BETTER_AUTH_SECRET is absent.',
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
                        'Dedicated Worker Thread calling the update route every UPDATE_INTERVAL seconds using setTimeout (not setInterval) to prevent overlapping requests. Every replica runs it; only the poller lease holder polls the official HD1 API.',
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
                        'Normalized h1_* tables hold the full war record (h1_season, h1_status, h1_statistic, h1_event, h1_event_progress). The worker_heartbeat table holds the poller lease. There are no raw-cache tables.',
                },
            ],
        },
        hd1: {
            title: 'Official HD1 API',
            subtitle: 'api.helldiversgame.com',
            sections: [
                {
                    type: 'text',
                    content:
                        'The official Helldivers 1 community API. Provides live campaign status, historical snapshots, and introduction order data. Updates roughly every second.',
                },
            ],
        },
    },
});
