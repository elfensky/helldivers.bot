/**
 * Fixture data for visual regression tests.
 *
 * Everything here is a literal — never derived from the API, the database, or
 * the real clock. A baseline PNG is only meaningful if the same input renders
 * the same pixels on every run.
 */

/** Fixed wall clock for every visual test, so Date-derived strings never move. */
export const FIXED_NOW = Date.UTC(2026, 0, 15, 12, 0, 0);

const HOUR = 3600;
const NOW_S = Math.floor(FIXED_NOW / 1000);

/**
 * One live event, shaped like an `h1_event` row.
 *
 * @param {object} [overrides]
 */
export function makeEvent(overrides = {}) {
    return {
        type: 'attack',
        start_time: NOW_S - 6 * HOUR,
        end_time: NOW_S + 18 * HOUR,
        region: 3,
        enemy: 0,
        points: 1_800_000,
        points_max: 5_000_000,
        status: 'active',
        ...overrides,
    };
}

/**
 * One faction's regions 0-11, as `computeMapState` returns them.
 *
 * @param {object} [overrides] - Keyed by region number.
 */
function makeFactionMap(overrides = {}) {
    const map = {};
    for (let r = 0; r <= 11; r++) {
        map[r] = { region: `Region ${r}`, status: 'lost', event: 'idle', percent: 0 };
    }
    for (const [key, val] of Object.entries(overrides)) {
        map[Number(key)] = { ...map[Number(key)], ...val };
    }
    return map;
}

/** Full map state: 0-2 factions, 3 Super Earth. */
export function makeMapState() {
    return {
        0: makeFactionMap({ 3: { status: 'active', event: 'attack', percent: 36 } }),
        1: makeFactionMap(),
        2: makeFactionMap({ 7: { status: 'active', event: 'defend', percent: 72 } }),
        3: makeFactionMap(),
    };
}

/**
 * One row of `data.status` — DashboardClient passes this same array to
 * StatGrid as `live`, so each row carries campaign progress *and* the
 * telemetry fields StatGrid reads.
 *
 * @param {number} enemy - Faction index 0-2.
 * @param {object} [overrides]
 */
export function makeStatRow(enemy, overrides = {}) {
    return {
        enemy,
        points: 1_000_000 + enemy * 700_000,
        points_max: 5_000_000,
        status: 'active',
        players: 4_000 + enemy * 137,
        kills: 300_000_000 + enemy * 11_000_000,
        deaths: 9_000_000 + enemy * 250_000,
        accidentals: 700_000 + enemy * 30_000,
        successful_missions: 2_400_000 + enemy * 90_000,
        missions: 3_000_000 + enemy * 100_000,
        first_seen: NOW_S - 30 * 24 * HOUR,
        ...overrides,
    };
}

/**
 * The value a `LiveDataProvider` would supply. Shape mirrors the
 * `useLiveDataContext` return used by DashboardClient's unit test.
 *
 * @param {object} [overrides]
 */
export function liveStore(overrides = {}) {
    return {
        data: {
            status: [makeStatRow(0), makeStatRow(1), makeStatRow(2)],
            events: [],
            last_updated: '2026-01-15',
            season: 42,
            season_duration: 30 * 24 * HOUR,
            war_start: NOW_S - 30 * 24 * HOUR,
        },
        mapState: makeMapState(),
        status: 'live',
        prevData: null,
        isLeader: true,
        ...overrides,
    };
}
