import { z } from 'zod';
import {
    extendZodWithOpenApi,
    OpenAPIRegistry,
    OpenApiGeneratorV3,
} from '@asteasolutions/zod-to-openapi';

// Extend Zod with OpenAPI capabilities
extendZodWithOpenApi(z);

// Create registry
const registry = new OpenAPIRegistry();

// This spec documents the PUBLIC API surface only: the versioned `/api/v1/h1/*`
// endpoints (key-gated) and `/api/h1/rebroadcast` (the stable HD1-API drop-in),
// plus the deprecated `/api/h1/campaign`. Internal plumbing (`/api/h1/live`,
// `/api/h1/update`, `/api/notifications/*`, auth/analytics proxies) is
// intentionally NOT registered — it has no public contract and can change
// without notice.

// Common schemas
const ErrorResponseSchema = z
    .object({
        time: z
            .number()
            .openapi({ description: 'Time taken to process the request (ms)' }),
        code: z.number().openapi({ description: 'HTTP status code' }),
        message: z.string().openapi({ description: 'Human-readable status message' }),
        error: z.any().openapi({ description: 'Error details or null' }),
    })
    .openapi('ErrorResponse');

const SuccessResponseSchema = z
    .object({
        time: z
            .number()
            .openapi({ description: 'Time taken to process the request (ms)' }),
        code: z.number().openapi({ description: 'HTTP status code' }),
        message: z.string().openapi({ description: 'Human-readable status message' }),
        data: z.any().openapi({ description: 'Response data' }),
    })
    .openapi('SuccessResponse');

// Register common schemas
registry.register('ErrorResponse', ErrorResponseSchema);
registry.register('SuccessResponse', SuccessResponseSchema);

// ---- Helpers (keep the per-endpoint definitions DRY) ----

/** The `{ time, code, message, data }` envelope wrapping a typed `data` shape. */
function envelope(dataSchema) {
    return z.object({
        time: z
            .number()
            .openapi({ description: 'Time taken to process the request (ms)' }),
        code: z.number().openapi({ description: 'HTTP status code' }),
        message: z.string().openapi({ description: 'Human-readable status message' }),
        data: dataSchema,
    });
}

const jsonError = (description) => ({
    description,
    content: { 'application/json': { schema: ErrorResponseSchema } },
});
const jsonOk = (description, schema) => ({
    description,
    content: { 'application/json': { schema } },
});

/** Error responses shared by every key-gated `/v1` read. */
const v1ErrorResponses = (notFound = true) => ({
    400: jsonError('Invalid query parameter or cursor.'),
    401: jsonError('Unauthorized. API key missing, malformed, disabled, or not found.'),
    ...(notFound ? { 404: jsonError('Season not found.') } : {}),
    429: jsonError(
        'Rate limit exceeded. Inspect the `RateLimit-Limit/Remaining/Reset` and `Retry-After` headers.',
    ),
    500: jsonError('Internal server error.'),
});

const factionSlug = z
    .enum(['bugs', 'cyborgs', 'illuminate'])
    .openapi({ description: 'Faction slug.' });

// Reusable query params (descriptions mirror the route Zod schemas).
const seasonParam = z.string().optional().openapi({
    description: "Season number, or 'current' (the default).",
    example: 'current',
});
const enemyParam = factionSlug.optional().openapi({
    description: 'Restrict the response to a single faction.',
});
const limitParam = z.coerce.number().int().min(1).max(500).optional().openapi({
    description: 'Page size, 1–500 (default 100).',
    example: 100,
});
const cursorParam = z.string().optional().openapi({
    description: 'Opaque keyset cursor returned as `page.nextCursor` of a prior page.',
});
const orderParam = z.enum(['asc', 'desc']).optional().openapi({
    description: 'Bucket order (default `desc`).',
});
const fromParam = z.string().optional().openapi({
    description: 'ISO datetime lower bound (history).',
    example: '2026-01-01T00:00:00Z',
});
const toParam = z.string().optional().openapi({
    description: 'ISO datetime upper bound (history).',
    example: '2026-02-01T00:00:00Z',
});
const pageSchema = z.object({
    limit: z.number(),
    nextCursor: z
        .string()
        .nullable()
        .openapi({ description: 'Cursor for the next page, or null.' }),
});

// /api/h1/campaign - GET (deprecated)
registry.registerPath({
    method: 'get',
    path: '/api/h1/campaign',
    deprecated: true,
    summary: 'Get campaign data for a specific season or the latest. (Deprecated)',
    description:
        '**Deprecated** — superseded by `GET /api/v1/h1/status` (campaign progress) and `GET /api/v1/h1/stats` (statistics). Returns campaign data for a given season if the `season` query parameter is provided and valid. If no season is provided, returns the latest campaign data. If data is not found locally, attempts to fetch and update from a remote source.',
    request: {
        query: z.object({
            season: z.string().optional().openapi({
                description: 'The season number to fetch campaign data for.',
                example: '1',
            }),
        }),
    },
    responses: {
        200: jsonOk('Campaign data found and returned successfully.', envelope(z.any())),
        400: jsonError('Invalid season parameter.'),
        404: jsonError('Campaign data not found.'),
        500: jsonError('Internal server error.'),
    },
});

// /api/h1/rebroadcast - POST
const RebroadcastFormDataSchema = z
    .object({
        action: z
            .enum([
                'get_campaign_status',
                'get_snapshots',
                'get_available_entitlements',
                'get_leaderboards',
                'get_usernames',
            ])
            .openapi({
                description:
                    'The HD1-API action to perform. `get_campaign_status` and `get_snapshots` are implemented; `get_available_entitlements`, `get_leaderboards`, and `get_usernames` are recognised but **not implemented** (return 501) — Demand-Driven Compatibility, implemented on first real consumer.',
            }),
        season: z
            .number()
            .int()
            .positive()
            .optional()
            .openapi({ description: 'Required if action is get_snapshots.', minimum: 1 }),
    })
    .openapi('RebroadcastFormData');

registry.registerPath({
    method: 'post',
    path: '/api/h1/rebroadcast',
    summary: 'Drop-in replacement for the official HD1 API (raw wire format)',
    description:
        'Reconstructs the official Helldivers 1 API wire format from normalized data, so existing HD1-API consumers can repoint here. Key-gated. Rate-limited per API key (`rebroadcast` group); responses carry `RateLimit-*` headers.',
    request: {
        body: {
            required: true,
            content: {
                'multipart/form-data': { schema: RebroadcastFormDataSchema },
                'application/x-www-form-urlencoded': {
                    schema: RebroadcastFormDataSchema,
                },
            },
        },
    },
    responses: {
        200: jsonOk('Success', z.any()),
        400: jsonError('Invalid request (content type, action, or arguments).'),
        401: jsonError('Unauthorized. API key missing, malformed, or not found.'),
        403: jsonError('Forbidden. API key found but disabled.'),
        404: jsonError('Not found.'),
        405: jsonError('Method not allowed.'),
        429: jsonError(
            'Rate limit exceeded (`rebroadcast` group). See `RateLimit-*` and `Retry-After` headers.',
        ),
        501: jsonError(
            'Action recognised but not implemented (`get_available_entitlements`, `get_leaderboards`, `get_usernames`).',
        ),
    },
});

// /api/v1/h1/status - GET
const StatusItemSchema = z
    .object({
        enemy: factionSlug,
        enemyId: z
            .number()
            .openapi({ description: 'Faction id (0 bugs, 1 cyborgs, 2 illuminate).' }),
        points: z.number(),
        pointsMax: z.number(),
        percent: z.number().openapi({ description: 'Campaign progress, 0–100.' }),
        players: z.number(),
        updatedAt: z.string().openapi({ description: 'ISO timestamp of the bucket.' }),
        bucket: z
            .number()
            .optional()
            .openapi({ description: 'Bucket start (history only).' }),
    })
    .openapi('StatusItem');

registry.registerPath({
    method: 'get',
    path: '/api/v1/h1/status',
    summary: 'Campaign status — latest snapshot or paginated history',
    description:
        'Key-gated. `mode=latest` (default) returns the current per-faction campaign progress; `mode=history` returns a cursor-paginated timeseries. Cache-Control is tiered (`latest`/`current-season`/`closed-season`); history reads also carry an `ETag` and honour `If-None-Match` (304). Rate-limited per IP (`public_read` for latest, `history_read` for history).',
    request: {
        query: z.object({
            season: seasonParam,
            enemy: enemyParam,
            mode: z.enum(['latest', 'history']).optional().openapi({
                description: 'latest (default) or history.',
            }),
            from: fromParam,
            to: toParam,
            limit: limitParam,
            cursor: cursorParam,
            order: orderParam,
        }),
    },
    responses: {
        200: jsonOk(
            'Campaign status. Carries RateLimit-* and tiered Cache-Control headers; history also carries an ETag.',
            envelope(
                z.object({
                    season: z.number(),
                    mode: z.enum(['latest', 'history']),
                    bucket: z.number().optional(),
                    items: z.array(StatusItemSchema),
                    page: pageSchema,
                }),
            ),
        ),
        304: {
            description:
                'Not Modified (history reads, when If-None-Match matches the ETag).',
        },
        ...v1ErrorResponses(),
    },
});

// /api/v1/h1/stats - GET
const StatsItemSchema = z
    .object({
        bucket: z.number(),
        enemy: factionSlug,
        enemyId: z.number(),
        season: z.number(),
        missionsWon: z.number(),
        missionsLost: z.number(),
        kills: z.number(),
        deaths: z.number(),
        shots: z.number(),
        hits: z.number(),
        players: z.number(),
    })
    .openapi('StatsItem');

registry.registerPath({
    method: 'get',
    path: '/api/v1/h1/stats',
    summary: 'Statistics timeseries for a season (cursor-paginated)',
    description:
        'Key-gated. Per-bucket kill/death/mission/player statistics over `h1_statistic`. Tiered Cache-Control + ETag (304 via `If-None-Match`). Rate-limited per IP (`history_read`).',
    request: {
        query: z.object({
            season: seasonParam,
            enemy: enemyParam,
            from: fromParam,
            to: toParam,
            limit: limitParam,
            cursor: cursorParam,
            order: orderParam,
        }),
    },
    responses: {
        200: jsonOk(
            'Statistics page. Carries RateLimit-*, Cache-Control, and ETag headers.',
            envelope(
                z.object({
                    season: z.number(),
                    bucketSize: z
                        .number()
                        .openapi({ description: 'Bucket width (seconds).' }),
                    items: z.array(StatsItemSchema),
                    page: pageSchema,
                }),
            ),
        ),
        304: { description: 'Not Modified (when If-None-Match matches the ETag).' },
        ...v1ErrorResponses(),
    },
});

// /api/v1/h1/season - GET
const SeasonItemSchema = z
    .object({
        season: z.number(),
        isCurrent: z.boolean(),
        lastUpdated: z.string().nullable(),
        introductionOrder: z
            .array(factionSlug)
            .openapi({ description: 'Faction slugs in introduction order.' }),
        pointsMax: z
            .object({ bugs: z.number(), cyborgs: z.number(), illuminate: z.number() })
            .openapi({ description: 'Points required per faction, slug-keyed.' }),
        seasonDuration: z.number(),
    })
    .openapi('SeasonItem');

registry.registerPath({
    method: 'get',
    path: '/api/v1/h1/season',
    summary: 'Season metadata (introduction order, points_max, duration)',
    description:
        'Key-gated. Returns an array of season-metadata objects; pass the repeatable `season` param for several seasons (defaults to `current`). Cache-Control is `current-season` when the live season is included, else `closed-season`. Rate-limited per IP (`public_read`).',
    request: {
        query: z.object({
            season: z.string().optional().openapi({
                description:
                    "Repeatable: pass multiple `season=` for several seasons. Each is a number or 'current' (default).",
                example: 'current',
            }),
        }),
    },
    responses: {
        200: jsonOk(
            'Array of season metadata. Carries RateLimit-* and Cache-Control headers.',
            envelope(z.array(SeasonItemSchema)),
        ),
        ...v1ErrorResponses(),
    },
});

// /api/v1/h1/map - GET
const MapRegionSchema = z
    .object({
        id: z
            .number()
            .openapi({ description: 'Region number (1–11, or 0 for Super Earth).' }),
        region: z.string(),
        capital: z.string(),
        points: z.number(),
        pointsMax: z.number(),
        percent: z.number().openapi({ description: 'Sector progress, 0–100.' }),
        status: z
            .string()
            .openapi({ description: 'captured | in_progress | lost | active.' }),
        event: z.string().openapi({ description: 'Active event marker, or empty.' }),
    })
    .openapi('MapRegion');

const MapEventSchema = z
    .object({
        type: z.string(),
        enemy: factionSlug.nullable(),
        enemyId: z.number(),
        region: z.number(),
        status: z.string(),
        points: z.number(),
        pointsMax: z.number(),
        startTime: z.number(),
        endTime: z.number(),
    })
    .openapi('MapEvent');

registry.registerPath({
    method: 'get',
    path: '/api/v1/h1/map',
    summary: 'Render-ready galaxy map (per-faction fronts)',
    description:
        'Key-gated. Returns the computed galaxy ownership as per-faction fronts (`bugs`/`cyborgs`/`illuminate`/`superEarth`), each an id-sorted array of regions. `at=latest` only for now (historical reconstruction is deferred). Rate-limited per IP (`public_read`); `latest` Cache-Control.',
    request: {
        query: z.object({
            season: seasonParam,
            at: z.string().optional().openapi({
                description:
                    '`latest` only for now (historical `at=<datetime>` not yet supported).',
                example: 'latest',
            }),
            enemy: enemyParam,
            events: z.enum(['active', 'none']).optional().openapi({
                description: 'Whether to overlay active events (default `active`).',
            }),
        }),
    },
    responses: {
        200: jsonOk(
            'Galaxy map. Carries RateLimit-* and Cache-Control headers.',
            envelope(
                z.object({
                    season: z.number(),
                    bucket: z.number(),
                    events: z.enum(['active', 'none']),
                    fronts: z
                        .object({
                            bugs: z.array(MapRegionSchema),
                            cyborgs: z.array(MapRegionSchema),
                            illuminate: z.array(MapRegionSchema),
                            superEarth: z.array(MapRegionSchema),
                        })
                        .partial()
                        .openapi({
                            description: 'Per-faction fronts (filtered by `enemy`).',
                        }),
                    activeEvents: z.array(MapEventSchema),
                }),
            ),
        ),
        ...v1ErrorResponses(),
    },
});

// Generate OpenAPI spec
export function generateOpenApiSpec() {
    const generator = new OpenApiGeneratorV3(registry.definitions);

    return generator.generateDocument({
        openapi: '3.0.0',
        info: {
            title: 'Helldivers 1 API',
            version: '1.0.0',
            description:
                'Public API for Helldivers 1 historic game data. Caches the official HD1 API and exposes normalized campaign data: versioned `/api/v1/h1/*` reads (key-gated) and `/api/h1/rebroadcast` (raw HD1 wire-format drop-in).',
        },
    });
}
