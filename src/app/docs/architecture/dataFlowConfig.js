/**
 * Configuration for the data flow architecture diagram.
 * Combines views, flow mappings, node details, and legend.
 */
export const dataFlowConfig = {
    views: [
        { key: 'all', label: 'All Flows' },
        { key: 'live', label: 'Live Polling (~15s)' },
        { key: 'snapshot', label: 'Snapshot Sync' },
        { key: 'seed', label: 'Seed (Bootstrap)' },
        { key: 'read_live', label: 'Frontend: Live' },
        { key: 'read_archives', label: 'Frontend: Archives' },
        { key: 'read_rebroadcast', label: 'Frontend: Rebroadcast' },
    ],

    flows: {
        live: [
            'api_status',
            'worker',
            'h1_season',
            'h1_status',
            'h1_statistic',
            'h1_event',
            'h1_event_progress',
        ],
        snapshot: [
            'api_snapshot',
            'worker',
            'h1_season',
            'h1_status',
            'h1_statistic',
            'h1_event',
            'h1_event_progress',
        ],
        seed: ['seed_files', 'seed_script', 'h1_season', 'h1_status', 'h1_event'],
        read_live: ['h1_status', 'h1_event', 'h1_season', 'fe_live'],
        read_archives: ['h1_status', 'h1_event', 'h1_event_progress', 'fe_archives'],
        read_rebroadcast: [
            'h1_season',
            'h1_status',
            'h1_statistic',
            'h1_event',
            'fe_rebroadcast',
        ],
    },

    legend: [
        { color: '#3b82f6', label: 'Official API' },
        { color: '#a855f7', label: 'Worker / Processing' },
        { color: '#22c55e', label: 'Normalized (h1_*)' },
        { color: '#ec4899', label: 'Seed Files (past wars)' },
        { color: '#06b6d4', label: 'Frontend Components' },
    ],

    title: 'Helldivers Bot Data Flow Architecture',
    description:
        'Interactive diagram showing how data moves from the official Helldivers API through processing, validation, database storage, and frontend display',

    details: {
        api_status: {
            title: 'get_campaign_status',
            subtitle: 'Official Helldivers 1 API',
            sections: [
                {
                    type: 'text',
                    content:
                        'Returns the live state of the current war. Polled every ~15 seconds.',
                },
                {
                    type: 'tags',
                    items: [{ text: '~15s poll', cls: 'tag-interval' }],
                },
                { type: 'heading', content: 'Response shape' },
                {
                    type: 'code',
                    content:
                        '{\n  campaign_status: [{\n    season, points, points_taken,\n    points_max, status, introduction_order\n  }],\n  defend_event: {\n    event_id, region, enemy,\n    points, points_max, status\n  },\n  attack_events: [{ event_id, enemy, ... }],\n  statistics: [{\n    enemy, players, missions, kills,\n    deaths, accidentals, shots, hits\n  }]\n}',
                },
            ],
        },
        api_snapshot: {
            title: 'get_snapshots',
            subtitle: 'Official Helldivers 1 API',
            sections: [
                {
                    type: 'text',
                    content:
                        'Returns the full history of a war: time-series snapshots + all events. For past wars, data is immutable. Also used for on-demand backfill of missing seasons.',
                },
                {
                    type: 'tags',
                    items: [{ text: '~15s poll + on demand', cls: 'tag-interval' }],
                },
                { type: 'heading', content: 'Response shape' },
                {
                    type: 'code',
                    content:
                        '{\n  introduction_order: [2, 1, 0],\n  points_max: [30000, 30000, 30000],\n  snapshots: [{\n    season, time,\n    data: "[{points, points_taken, status}, ...]"\n  }],\n  defend_events: [{ event_id, region, ... }],\n  attack_events: [{ event_id, enemy, ... }]\n}',
                },
            ],
        },
        seed_files: {
            title: 'Seed Files',
            subtitle: 'prisma/seed/seasons/*.json',
            sections: [
                {
                    type: 'text',
                    content:
                        'Static JSON files that bootstrap the app on first deploy. Same shape as get_snapshots response \u2014 processed through the same normalization pipeline.',
                },
                {
                    type: 'tags',
                    items: [{ text: 'first deploy only', cls: 'tag-once' }],
                },
                {
                    type: 'text',
                    content:
                        'Does NOT replace the ability to re-fetch from the API. Seed gets the app running without API dependency; on-demand backfill updates data from the live API.',
                },
                {
                    type: 'code',
                    content:
                        'prisma/seed/seasons/\n  season-001.json\n  season-002.json\n  ...\n  season-155.json',
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
                        'Uses setTimeout (not setInterval) to prevent overlapping requests. Both API endpoints polled every ~15s.',
                },
                {
                    type: 'tags',
                    items: [{ text: '~15s loop', cls: 'tag-interval' }],
                },
                { type: 'heading', content: 'Update cycle' },
                {
                    type: 'text',
                    content:
                        '1. Fetch API response\n2. Validate with Zod schemas\n3. Bucket-upsert into h1_* tables\n4. Schedule next poll via setTimeout',
                },
                {
                    type: 'text',
                    content:
                        'Bucket-upsert groups polls into configurable time buckets (BUCKET_SIZE env var). Within a bucket, values are overwritten; a new bucket creates a new row.',
                },
            ],
        },
        seed_script: {
            title: 'Seed Script',
            subtitle: 'prisma db seed',
            sections: [
                {
                    type: 'text',
                    content:
                        'Runs on first deploy to populate the database from static JSON files. Processes each season file through the same normalization pipeline used by live updates.',
                },
                {
                    type: 'tags',
                    items: [{ text: 'first deploy only', cls: 'tag-once' }],
                },
            ],
        },
        h1_season: {
            title: 'h1_season',
            subtitle: 'Root anchor for all game data',
            sections: [
                {
                    type: 'text',
                    content:
                        'Every normalized table FKs back to this via season (Int). Inlines introduction_order[] and points_max[] arrays (formerly separate tables) plus season_duration[].',
                },
                {
                    type: 'table',
                    headers: ['Field', 'Type'],
                    rows: [
                        ['season', 'Int @unique'],
                        ['last_updated', 'DateTime?'],
                        ['introduction_order', 'Int[]'],
                        ['points_max', 'Int[]'],
                        ['season_duration', 'Int[]'],
                    ],
                },
            ],
        },
        h1_status: {
            title: 'h1_status',
            subtitle: 'Bucketed campaign timeseries',
            sections: [
                {
                    type: 'text',
                    content:
                        'One row per (season, enemy, bucket). Stores campaign progress (points, status) at each time bucket. Both API paths write here \u2014 unified source for live dashboard and archives.',
                },
                {
                    type: 'tags',
                    items: [
                        {
                            text: 'bucket-upsert by (season, enemy, bucket)',
                            cls: 'tag-upsert',
                        },
                        { text: 'Live Dashboard + Archives', cls: 'tag-read' },
                    ],
                },
                {
                    type: 'table',
                    headers: ['Field', 'Type'],
                    rows: [
                        ['season', 'Int FK'],
                        ['enemy', 'Int (0/1/2)'],
                        ['bucket', 'DateTime'],
                        ['points / points_max', 'Int'],
                        ['status', 'String'],
                        ['players', 'Int'],
                    ],
                },
            ],
        },
        h1_statistic: {
            title: 'h1_statistic',
            subtitle: 'Bucketed stats timeseries',
            sections: [
                {
                    type: 'text',
                    content:
                        'One row per (season, enemy, bucket). Stores gameplay statistics (kills, deaths, shots, missions) at each time bucket. Used by the rebroadcast API to reconstruct wire format.',
                },
                {
                    type: 'tags',
                    items: [
                        {
                            text: 'bucket-upsert by (season, enemy, bucket)',
                            cls: 'tag-upsert',
                        },
                        { text: 'Rebroadcast API', cls: 'tag-read' },
                    ],
                },
                {
                    type: 'table',
                    headers: ['Field', 'Type'],
                    rows: [
                        ['season', 'Int FK'],
                        ['enemy', 'Int (0/1/2)'],
                        ['bucket', 'DateTime'],
                        ['kills / deaths', 'BigInt'],
                        ['missions', 'Int'],
                        ['shots / hits', 'BigInt'],
                        ['accidentals', 'BigInt'],
                    ],
                },
            ],
        },
        h1_event: {
            title: 'h1_event',
            subtitle: 'Unified events (attack + defend)',
            sections: [
                {
                    type: 'text',
                    content:
                        'Single table with type discriminator. Region 1-10 = sectors, 11 = homeworld. Mutable \u2014 status and points updated in place as events progress.',
                },
                {
                    type: 'tags',
                    items: [
                        { text: 'upsert by event_id', cls: 'tag-upsert' },
                        { text: 'Event Alerts + Timeline', cls: 'tag-read' },
                    ],
                },
                {
                    type: 'table',
                    headers: ['Field', 'Type'],
                    rows: [
                        ['type', '"attack" | "defend"'],
                        ['event_id', 'Int @unique'],
                        ['season', 'Int FK'],
                        ['region', 'Int'],
                        ['enemy', 'Int'],
                        ['points / points_max', 'Int'],
                        ['status', 'String'],
                        ['players_at_start', 'Int?'],
                    ],
                },
            ],
        },
        h1_event_progress: {
            title: 'h1_event_progress',
            subtitle: 'Bucketed event progression',
            sections: [
                {
                    type: 'text',
                    content:
                        'One row per (event_id, bucket). Tracks how event points change over time. Used by archives to show event progression charts.',
                },
                {
                    type: 'tags',
                    items: [
                        {
                            text: 'bucket-upsert by (event_id, bucket)',
                            cls: 'tag-upsert',
                        },
                        { text: 'Archives progression', cls: 'tag-read' },
                    ],
                },
                {
                    type: 'table',
                    headers: ['Field', 'Type'],
                    rows: [
                        ['event_id', 'Int FK'],
                        ['bucket', 'DateTime'],
                        ['points', 'Int'],
                        ['points_max', 'Int'],
                    ],
                },
            ],
        },
        fe_live: {
            title: 'Live Dashboard',
            subtitle: 'Latest bucket per faction',
            sections: [
                {
                    type: 'text',
                    content:
                        'Reads the latest h1_status bucket for each faction in the active season, plus active events and season arrays. Renders galaxy map, stat cards, and player counts.',
                },
                {
                    type: 'tags',
                    items: [{ text: 'reads h1_status (latest)', cls: 'tag-read' }],
                },
            ],
        },
        fe_archives: {
            title: 'Archives',
            subtitle: 'Full timeseries history',
            sections: [
                {
                    type: 'text',
                    content:
                        'Reads full h1_status timeseries + all h1_event records + h1_event_progress for any season. Missing seasons backfilled on demand from the official API.',
                },
                {
                    type: 'tags',
                    items: [
                        {
                            text: 'reads h1_status + h1_event + h1_event_progress',
                            cls: 'tag-read',
                        },
                    ],
                },
            ],
        },
        fe_rebroadcast: {
            title: 'Rebroadcast API',
            subtitle: 'Reconstructed wire format',
            sections: [
                {
                    type: 'text',
                    content:
                        'Reconstructs the original API wire format from normalized tables for third-party consumers. Reads h1_season + h1_status + h1_statistic + h1_event.',
                },
                {
                    type: 'tags',
                    items: [
                        {
                            text: 'reconstructs from 4 tables',
                            cls: 'tag-read',
                        },
                    ],
                },
            ],
        },
    },
};
