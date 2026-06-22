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
 * Flatten one front's region map into a sorted, self-identifying array. Each
 * element carries its own `id` (region number — 1–11 for the three fronts, 0
 * for Super Earth's homeworld) so consumers don't depend on array order.
 *
 * @param {Record<string, { region: string, capital: string, points: number, points_max: number, percent: number, status: string, event: string }>} regions - One faction's region → state map.
 * @returns {Array<object>} regions as an array sorted by `id`.
 */
function frontToArray(regions) {
    return Object.entries(regions)
        .map(([regionId, r]) => ({
            id: Number(regionId),
            region: r.region,
            capital: r.capital,
            points: r.points,
            pointsMax: r.points_max,
            percent: r.percent,
            status: r.status,
            event: r.event,
        }))
        .sort((a, b) => a.id - b.id);
}

/**
 * Project the computed map state + events into the public response. Each front
 * (regions 1–10 plus homeworld 11, or region 0 for Super Earth) is an array
 * keyed by faction slug — see `frontToArray`.
 *
 * @param {Record<string, Record<string, object>>} mapState - computeMapState output (faction id → region → state).
 * @param {Array<object>} events - The events included (active list, or empty).
 * @param {{ season: number, bucket: number, eventsMode: 'active' | 'none', enemyId?: number }} meta - Response metadata.
 * @returns {object} the public map response.
 */
export function projectMap(mapState, events, meta) {
    /** @type {Record<string, Array<object>>} */
    const fronts = {};
    for (const [factionId, regions] of Object.entries(mapState)) {
        const id = Number(factionId);
        // enemy filter: keep only that front (Super Earth front stays — it carries
        // the homeworld-defense state that's relevant regardless of the filter).
        if (meta.enemyId !== undefined && id !== meta.enemyId && id !== 3) continue;
        fronts[FRONT_KEY[id] ?? String(id)] = frontToArray(regions);
    }
    return {
        season: meta.season,
        bucket: meta.bucket,
        events: meta.eventsMode,
        fronts,
        activeEvents: events.map(projectEvent),
    };
}
