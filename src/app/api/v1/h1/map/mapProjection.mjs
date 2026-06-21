import { z } from 'zod';
import { FACTION_SLUG_BY_ID, FACTION_INDEX } from '@/shared/enums/factions.mjs';

// computeMapState keys fronts by faction id (3 = Super Earth's own defense).
const FRONT_KEY = { 0: 'bugs', 1: 'cyborgs', 2: 'illuminate', 3: 'superEarth' };

const querySchema = z.object({
    season: z
        .union([z.literal('current'), z.coerce.number().int().positive()])
        .default('current'),
    // `latest` or an ISO datetime. Historical (`at=<datetime>`) is deferred by the route.
    at: z.union([z.literal('latest'), z.coerce.date()]).default('latest'),
    enemy: z.enum(['bugs', 'cyborgs', 'illuminate']).optional(),
    events: z.enum(['active', 'none']).default('active'),
});

/**
 * Parse + validate the map endpoint's query string.
 *
 * @param {URLSearchParams} searchParams - The request's query parameters.
 * @returns {{ success: true, data: import('zod').infer<typeof querySchema> } | { success: false, message: string }}
 */
export function parseMapQuery(searchParams) {
    const result = querySchema.safeParse(Object.fromEntries(searchParams));
    if (!result.success) {
        const issue = result.error.issues[0];
        return {
            success: false,
            message: `Invalid query: ${issue.path.join('.') || 'parameter'} — ${issue.message}`,
        };
    }
    return { success: true, data: result.data };
}

/**
 * @param {string} enemy - Faction slug.
 * @returns {number} faction id.
 */
export function enemyIdFromSlug(enemy) {
    return FACTION_INDEX[enemy];
}

/**
 * Project one campaign event into a light public shape.
 *
 * @param {{ type: string, enemy: number, region: number, status: string, points: number, points_max: number, start_time: number, end_time: number }} e - Event row.
 * @returns {object} projected event.
 */
function projectEvent(e) {
    return {
        type: e.type,
        enemy: FACTION_SLUG_BY_ID[e.enemy] ?? null,
        enemyId: e.enemy,
        region: e.region,
        status: e.status,
        points: e.points,
        pointsMax: e.points_max,
        startTime: e.start_time,
        endTime: e.end_time,
    };
}

/**
 * Project the computed map state + events into the public response. The map is
 * the render-ready per-faction structure from `computeMapState` (each front is
 * regions 1–10 plus homeworld 11), re-keyed by faction slug.
 *
 * @param {Record<string, Record<string, object>>} mapState - computeMapState output (faction id → region → state).
 * @param {Array<object>} events - The events included (active list, or empty).
 * @param {{ season: number, bucket: number, eventsMode: 'active' | 'none', enemyId?: number }} meta - Response metadata.
 * @returns {object} the public map response.
 */
export function projectMap(mapState, events, meta) {
    /** @type {Record<string, Record<string, object>>} */
    const fronts = {};
    for (const [factionId, regions] of Object.entries(mapState)) {
        const id = Number(factionId);
        // enemy filter: keep only that front (Super Earth front stays — it carries
        // the homeworld-defense state that's relevant regardless of the filter).
        if (meta.enemyId !== undefined && id !== meta.enemyId && id !== 3) continue;
        fronts[FRONT_KEY[id] ?? String(id)] = regions;
    }
    return {
        season: meta.season,
        bucket: meta.bucket,
        events: meta.eventsMode,
        fronts,
        activeEvents: events.map(projectEvent),
    };
}
