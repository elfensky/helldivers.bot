/**
 * HD1 wire-shape fixtures.
 *
 * VARIANT B — schema-scoped factories. Event factories are named for the
 * endpoint whose schema they satisfy, because `get_campaign_status` and
 * `get_snapshots` describe genuinely different event shapes:
 *
 *   - status.defend_event   : requires `region`; has NO `players_at_start`
 *   - status.attack_events[]: requires `players_at_start` AND `max_event_id`
 *   - season.defend_events[]: requires `players_at_start` + `region`, status != 'active'
 *   - season.attack_events[]: requires `players_at_start`, `region` MUST be absent
 *
 * A single superset factory satisfies all four schemas today, but it also
 * supplies fields a given schema does not declare — which silently hides
 * field-set contract changes from the rejection tests. Keeping the field sets
 * exact is the whole point of these fixtures.
 *
 * All factories return plain, mutable objects so callers can build rejection
 * cases via rest-destructure or `delete obj.field`.
 */

/** Fields common to every HD1 event shape. */
const eventBase = () => ({
    season: 1,
    start_time: 1700000000,
    end_time: 1700003600,
    points_max: 1000,
    points: 500,
});

/** `get_campaign_status` -> defend_event. 9 fields; `region` required, NO `players_at_start`. */
export const makeStatusDefendEvent = (overrides = {}) => ({
    ...eventBase(),
    event_id: 10,
    region: 3,
    enemy: 2,
    status: 'active',
    ...overrides,
});

/** `get_campaign_status` -> attack_events[]. 10 fields; adds `max_event_id`, no `region`. */
export const makeStatusAttackEvent = (overrides = {}) => ({
    ...eventBase(),
    event_id: 20,
    enemy: 1,
    points_max: 2000,
    points: 800,
    status: 'active',
    players_at_start: 150,
    max_event_id: 25,
    ...overrides,
});

/** `get_snapshots` -> defend_events[]. `region` required; status must be resolved. */
export const makeSeasonDefendEvent = (overrides = {}) => ({
    ...eventBase(),
    event_id: 1,
    enemy: 2,
    status: 'success',
    players_at_start: 100,
    region: 5,
    ...overrides,
});

/** `get_snapshots` -> attack_events[]. Same as defend but `region` MUST be absent. */
export const makeSeasonAttackEvent = (overrides = {}) => {
    const { region: _region, ...base } = makeSeasonDefendEvent(overrides);
    return { ...base, ...overrides };
};

/** The 3-faction frame carried inside a stringified `snapshots[].data`. */
export const makeSnapshotFrame = (overrides = []) =>
    [
        { points: 100, points_taken: 50, status: 'active' },
        { points: 200, points_taken: 75, status: 'active' },
        { points: 300, points_taken: 100, status: 'hidden' },
    ].map((entry, i) => ({ ...entry, ...overrides[i] }));

/** A `snapshots[]` entry, with `data` stringified as the wire sends it. */
export const makeSnapshot = ({ frame, ...overrides } = {}) => ({
    season: 1,
    time: 1700000000,
    data: JSON.stringify(frame ?? makeSnapshotFrame()),
    ...overrides,
});

/** A `campaign_status[]` wire entry. */
export const makeCampaignStatus = (overrides = {}) => ({
    season: 1,
    points: 500,
    points_taken: 250,
    points_max: 1000,
    status: 'active',
    introduction_order: 1,
    ...overrides,
});

/**
 * The 18-field `statistics[]` wire row (16 stats + season + enemy), all plain
 * numbers — this is the WIRE shape, as the validator sees it.
 *
 * Deliberately not shared with the db-layer statistic tests. `upsertStatistic`
 * picks only the 11 per-faction timeseries fields it persists, and asserts on
 * BigInt values (`kills: 500000n`) because that is what Prisma round-trips; the
 * remaining 5 fields live elsewhere:
 *   - season_duration → h1_season (per-season scalar)
 *   - event counts    → derivable from h1_event
 * A fixture that satisfied both would have to be wrong for one of them, so
 * `upsertStatistic.test.mjs` keeps its own local shape.
 */
export const makeStatistics = (overrides = {}) => ({
    season: 1,
    season_duration: 86400,
    enemy: 2,
    players: 1000,
    total_unique_players: 5000,
    missions: 10000,
    successful_missions: 8000,
    total_mission_difficulty: 50000,
    completed_planets: 5,
    defend_events: 10,
    successful_defend_events: 7,
    attack_events: 15,
    successful_attack_events: 12,
    deaths: 50000,
    kills: 200000,
    accidentals: 5000,
    shots: 1000000,
    hits: 600000,
    ...overrides,
});

/** A full `get_campaign_status` payload. */
export const makeValidStatus = (overrides = {}) => ({
    time: 1700000000,
    error_code: 0,
    campaign_status: [
        makeCampaignStatus({ introduction_order: 0 }),
        makeCampaignStatus({ introduction_order: 1 }),
        makeCampaignStatus({ introduction_order: 2 }),
    ],
    defend_event: makeStatusDefendEvent(),
    attack_events: [makeStatusAttackEvent()],
    statistics: [
        makeStatistics({ enemy: 0 }),
        makeStatistics({ enemy: 1 }),
        makeStatistics({ enemy: 2 }),
    ],
    ...overrides,
});

/** A full `get_snapshots` payload. */
export const makeValidSeason = (overrides = {}) => ({
    time: 1700000000,
    error_code: 0,
    introduction_order: [0, 1, 2],
    points_max: [1000, 2000, 3000],
    snapshots: [makeSnapshot()],
    defend_events: [makeSeasonDefendEvent()],
    attack_events: [makeSeasonAttackEvent()],
    ...overrides,
});

/** An `h1_season` DB row (NOT the wire shape — has `season_duration` + `last_updated`). */
export const makeSeasonRow = (overrides = {}) => ({
    season: 34,
    introduction_order: [0, 1, 2],
    points_max: [1000, 2000, 3000],
    season_duration: 604800,
    last_updated: new Date('2024-01-01T00:00:00Z'),
    ...overrides,
});
