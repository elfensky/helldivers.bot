/**
 * Static detail panel content for each node in the data-flow diagram.
 * Each key maps to a node's data-id attribute.
 */
export const detailData = {
    'api-status': {
        title: 'get_campaign_status',
        subtitle: 'Official Helldivers 1 API',
        sections: [
            {
                type: 'text',
                content:
                    'Returns the live state of the current war. Polled every 5-15 seconds.',
            },
            {
                type: 'tags',
                items: [{ text: '5-15s poll', cls: 'tag-interval' }],
            },
            { type: 'heading', content: 'Response shape' },
            {
                type: 'code',
                content:
                    '{\n  campaign_status: [{\n    season, points, points_taken,\n    points_max, status, introduction_order\n  }],\n  defend_event: {\n    event_id, region, enemy,\n    points, points_max, status\n  },\n  attack_events: [{ event_id, enemy, ... }],\n  statistics: [{\n    enemy, players, missions, kills,\n    deaths, accidentals, shots, hits\n  }]\n}',
            },
        ],
    },
    'api-snapshot': {
        title: 'get_snapshots',
        subtitle: 'Official Helldivers 1 API',
        sections: [
            {
                type: 'text',
                content:
                    'Returns the full history of a war: time-series snapshots + all events. For past wars, data is immutable.',
            },
            {
                type: 'tags',
                items: [{ text: '~1h poll (current war)', cls: 'tag-interval' }],
            },
            { type: 'heading', content: 'Response shape' },
            {
                type: 'code',
                content:
                    '{\n  introduction_order: [2, 1, 0],\n  points_max: [30000, 30000, 30000],\n  snapshots: [{\n    season, time,\n    data: "[{points, points_taken, status}, ...]"\n  }],\n  defend_events: [{ event_id, region, ... }],\n  attack_events: [{ event_id, enemy, ... }]\n}',
            },
        ],
    },
    'seed-files': {
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
                    'Does NOT replace the ability to re-fetch from the API. Seed gets the app running without API dependency; force refresh updates data from the live API.',
            },
            {
                type: 'code',
                content:
                    'prisma/seed/seasons/\n  001.json\n  002.json\n  ...\n  155.json',
            },
        ],
    },
    'api-refresh': {
        title: 'get_snapshots (forced)',
        subtitle: 'On-demand season refresh',
        sections: [
            {
                type: 'text',
                content:
                    'Re-fetch any season from the live API to update or correct data. Triggered by admin action (e.g., /api/h1/update?season=148&force=true).',
            },
            {
                type: 'tags',
                items: [{ text: 'on demand', cls: 'tag-interval' }],
            },
            {
                type: 'text',
                content:
                    'Use cases: pick up a newly completed season, correct corrupted data, backfill a season not in seed files. Goes through the same normalization pipeline as the regular snapshot sync.',
            },
        ],
    },
    'refresh-handler': {
        title: 'updateSeason()',
        subtitle: 'src/update/season.mjs',
        sections: [
            {
                type: 'text',
                content:
                    'Same function used by the regular snapshot sync. Fetches get_snapshots for the specified season, validates with Zod, upserts into rebroadcast_snapshot + all normalized h1_* tables.',
            },
            {
                type: 'tags',
                items: [{ text: 'fetch + validate + upsert', cls: 'tag-upsert' }],
            },
            {
                type: 'text',
                content:
                    'Overwrites existing data for that season (idempotent via unique constraints).',
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
                    'Uses setTimeout (not setInterval) to prevent overlapping requests.',
            },
            {
                type: 'tags',
                items: [{ text: '5-15s loop', cls: 'tag-interval' }],
            },
            { type: 'heading', content: 'Update cycle' },
            {
                type: 'text',
                content:
                    '1. Fetch API response\n2. Validate with Zod schemas\n3. Upsert raw JSON into rebroadcast table\n4. Normalize into h1_* tables\n5. Schedule next poll via setTimeout',
            },
        ],
    },
    'seed-script': {
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
    'rb-status': {
        title: 'rebroadcast_status',
        subtitle: 'Raw cache layer',
        sections: [
            {
                type: 'text',
                content:
                    'Stores the latest raw API response per season. Upserted on every poll. No history.',
            },
            {
                type: 'tags',
                items: [{ text: 'upsert by season', cls: 'tag-upsert' }],
            },
            {
                type: 'table',
                headers: ['Field', 'Type', 'Note'],
                rows: [
                    ['season', 'Int', '@unique'],
                    ['last_updated', 'DateTime', 'poll timestamp'],
                    ['json', 'JSONB', 'full response'],
                ],
            },
        ],
    },
    'rb-snapshot': {
        title: 'rebroadcast_snapshot',
        subtitle: 'Raw cache layer',
        sections: [
            {
                type: 'text',
                content:
                    'Stores the latest raw snapshot response per season. Not time-series \u2014 that is h1_snapshot.',
            },
            {
                type: 'tags',
                items: [{ text: 'upsert by season', cls: 'tag-upsert' }],
            },
            {
                type: 'table',
                headers: ['Field', 'Type', 'Note'],
                rows: [
                    ['season', 'Int', '@unique'],
                    ['last_updated', 'DateTime', 'poll timestamp'],
                    ['json', 'JSONB', 'full response'],
                ],
            },
        ],
    },
    'h1-season': {
        title: 'h1_season',
        subtitle: 'Root anchor for all game data',
        sections: [
            {
                type: 'text',
                content: 'Every normalized table FKs back to this via season (Int).',
            },
            {
                type: 'table',
                headers: ['Field', 'Type'],
                rows: [
                    ['season', 'Int @unique'],
                    ['last_updated', 'DateTime?'],
                ],
            },
        ],
    },
    'h1-live': {
        title: 'h1_live',
        subtitle: 'Current season live state',
        sections: [
            {
                type: 'text',
                content:
                    'One row per (season, enemy). Merges campaign_status + statistics + computed map data. Overwritten every 5-15s poll. Current season only \u2014 not populated for past seasons.',
            },
            {
                type: 'tags',
                items: [
                    { text: 'upsert by (season, enemy)', cls: 'tag-upsert' },
                    { text: 'Live Dashboard', cls: 'tag-read' },
                ],
            },
            {
                type: 'table',
                headers: ['Field', 'Type'],
                rows: [
                    ['season', 'Int FK'],
                    ['enemy', 'Int (0/1/2)'],
                    ['points / points_max', 'Int'],
                    ['status', 'String'],
                    ['players', 'Int'],
                    ['kills / deaths', 'BigInt'],
                    ['missions', 'Int'],
                    ['map', 'Json?'],
                ],
            },
            {
                type: 'text',
                content:
                    'Replaces h1_campaign + h1_statistic + App.map (v1 consolidation). Frontend reads 3 rows for full live dashboard.',
            },
        ],
    },
    'h1-event': {
        title: 'h1_event',
        subtitle: 'Unified events (attack + defend)',
        sections: [
            {
                type: 'text',
                content:
                    'Single table with type discriminator. Region 1-10 = sectors, 11 = homeworld.',
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
            {
                type: 'text',
                content: 'Replaces h1_defend_event + h1_attack_event (v1 consolidation)',
            },
        ],
    },
    'h1-intro': {
        title: 'h1_introduction_order',
        subtitle: 'Faction war-entry ordering per season',
        sections: [
            {
                type: 'text',
                content:
                    'One row per season. Which factions entered the war and in what order. Indexed by enemy: [Bugs, Cyborgs, Illuminate].',
            },
            {
                type: 'tags',
                items: [{ text: 'upsert by season', cls: 'tag-upsert' }],
            },
            {
                type: 'table',
                headers: ['Field', 'Type'],
                rows: [
                    ['season', 'Int @unique FK'],
                    ['order', 'Int[]'],
                ],
            },
            {
                type: 'text',
                content:
                    'Populated from campaign_status (current season) or get_snapshots (past seasons). Redundant json field dropped in v1.',
            },
        ],
    },
    'h1-points': {
        title: 'h1_points_max',
        subtitle: 'Max liberation points per season',
        sections: [
            {
                type: 'text',
                content:
                    'One row per season. Max points needed to trigger homeworld assault per faction. Indexed by enemy: [Bugs, Cyborgs, Illuminate].',
            },
            {
                type: 'tags',
                items: [{ text: 'upsert by season', cls: 'tag-upsert' }],
            },
            {
                type: 'table',
                headers: ['Field', 'Type'],
                rows: [
                    ['season', 'Int @unique FK'],
                    ['points', 'Int[]'],
                ],
            },
            {
                type: 'text',
                content:
                    'Populated from campaign_status (current season) or get_snapshots (past seasons). Redundant json field dropped in v1.',
            },
        ],
    },
    'fe-live': {
        title: 'Live Dashboard',
        subtitle: 'Map + Stats + Players',
        sections: [
            {
                type: 'text',
                content:
                    'Reads all 3 h1_live rows for the active season. Renders galaxy map (3 factions x 11 regions), stat cards (kills, deaths, accuracy), and player counts.',
            },
            {
                type: 'tags',
                items: [{ text: 'reads h1_live', cls: 'tag-read' }],
            },
            {
                type: 'text',
                content:
                    "Each h1_live row contains one faction's campaign progress, statistics, and pre-computed map slice. Frontend assembles the full view from all 3 rows.",
            },
        ],
    },
    'fe-events': {
        title: 'Event Alerts',
        subtitle: 'Active defend/attack events',
        sections: [
            {
                type: 'text',
                content:
                    'Shows alerts for ongoing events with progress and countdown timer.',
            },
            {
                type: 'tags',
                items: [
                    {
                        text: 'reads h1_event WHERE status = active',
                        cls: 'tag-read',
                    },
                ],
            },
        ],
    },
};
