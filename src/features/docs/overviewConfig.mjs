import { createFlowConfig } from '@/shared/utils/diagram.mjs';

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
            subtitle: 'src/app/(app)/page.jsx',
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
                        'Proxies the official Helldivers 1 API for external consumers. Returns cached raw JSON from the rebroadcast tables. Requires API key authentication.',
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
                        'Internal POST endpoint called by the worker thread. Runs updateStatus() and updateSeason(), then triggers push notification check. Protected by bearer token (UPDATE_KEY).',
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
                        'BetterAuth catch-all route handling Discord and GitHub OAuth flows, session management, and account operations. Optional — returns 503 when BETTER_AUTH_SECRET is absent.',
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
                        'Dedicated Worker Thread polling the official HD1 API every 10-20 seconds using setTimeout (not setInterval) to prevent overlapping requests. Validates with Zod before triggering the update route.',
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
                        'Two-table strategy: rebroadcast_* tables store raw API JSON, h1_* tables store normalized historical data. Both coexist — raw for fidelity, normalized for queries.',
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
