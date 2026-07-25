import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Composed ingest-invariant test.
 *
 * Unlike status.test.mjs — which mocks getSeasonFromStatus, upsertEvent,
 * upsertStatus and upsertEventProgress away and therefore only exercises
 * updateStatus's control flow — this file mocks ONLY the two real edges:
 *
 *   - `@/update/fetch.mjs`  (the HD1 network boundary)
 *   - `@/db/db`             (the Postgres boundary)
 *
 * Everything between them runs for real: the Zod validator, getSeasonFromStatus's
 * "don't aggregate lagged event slots" rule, upsertEvent / upsertEventProgress's
 * cross-season skip guard, and computeBucket's floor-to-bucket arithmetic.
 * Assertions are made against the actual db write calls.
 */

vi.mock('@/update/fetch.mjs', () => ({
    fetchStatus: vi.fn(),
    fetchSeason: vi.fn(),
}));

import db from '@/db/db';
import { fetchStatus } from '@/update/fetch.mjs';
import { updateStatus } from '@/update/status.mjs';
import { BUCKET_SIZE } from '@/shared/utils/bucketing.mjs';

// The db double is the global one from vitest.setup.mjs — no local vi.mock, so
// the model surface can't drift out from under this file.
const WRITTEN_MODELS = [
    'h1_season',
    'h1_event',
    'h1_status',
    'h1_statistic',
    'h1_event_progress',
];

// --- Fixture builders -------------------------------------------------------

const CURRENT_SEASON = 200;
const LAGGED_SEASON = 199; // the season that just ended
const POLL_TIME = 1750000000;

function campaign(season, enemy, overrides = {}) {
    return {
        season,
        enemy,
        points: 100 + enemy,
        points_taken: 10 + enemy,
        points_max: 1000,
        status: 'active',
        introduction_order: enemy,
        ...overrides,
    };
}

function statistic(season, enemy) {
    return {
        season,
        season_duration: 86400,
        enemy,
        players: 1000 + enemy,
        total_unique_players: 5000,
        missions: 10,
        successful_missions: 9,
        total_mission_difficulty: 50,
        completed_planets: 3,
        defend_events: 1,
        successful_defend_events: 1,
        attack_events: 2,
        successful_attack_events: 1,
        deaths: 100,
        kills: 200,
        accidentals: 5,
        shots: 1000,
        hits: 900,
    };
}

function defendEvent(season, overrides = {}) {
    return {
        season,
        event_id: 4242,
        start_time: POLL_TIME - 3600,
        end_time: POLL_TIME + 3600,
        region: 3,
        enemy: 1,
        points_max: 500,
        points: 250,
        status: 'active',
        ...overrides,
    };
}

function attackEvent(season, overrides = {}) {
    return {
        season,
        event_id: 7777,
        start_time: POLL_TIME - 3600,
        end_time: POLL_TIME + 3600,
        enemy: 2,
        points_max: 800,
        points: 400,
        status: 'active',
        players_at_start: 1234,
        max_event_id: 7777,
        ...overrides,
    };
}

/**
 * The season-transition payload: campaign_status + statistics have flipped to
 * CURRENT_SEASON, but defend_event / attack_events still carry the previous
 * season's rows because HD1 keeps them as "most recent event" slots.
 */
function laggedTransitionPayload() {
    return {
        time: POLL_TIME,
        error_code: 0,
        campaign_status: [
            campaign(CURRENT_SEASON, 0),
            campaign(CURRENT_SEASON, 1),
            campaign(CURRENT_SEASON, 2),
        ],
        defend_event: defendEvent(LAGGED_SEASON),
        attack_events: [attackEvent(LAGGED_SEASON)],
        statistics: [
            statistic(CURRENT_SEASON, 0),
            statistic(CURRENT_SEASON, 1),
            statistic(CURRENT_SEASON, 2),
        ],
    };
}

function currentSeasonPayload() {
    return {
        time: POLL_TIME,
        error_code: 0,
        campaign_status: [
            campaign(CURRENT_SEASON, 0),
            campaign(CURRENT_SEASON, 1),
            campaign(CURRENT_SEASON, 2),
        ],
        defend_event: defendEvent(CURRENT_SEASON),
        attack_events: [attackEvent(CURRENT_SEASON)],
        statistics: [
            statistic(CURRENT_SEASON, 0),
            statistic(CURRENT_SEASON, 1),
            statistic(CURRENT_SEASON, 2),
        ],
    };
}

/** Every `data` object passed to a mocked prisma upsert, flattened. */
function upsertPayloads(model) {
    return db[model].upsert.mock.calls.map(([args]) => args);
}

/**
 * Collect the value of every key literally named `season`, at any depth, out of
 * an upsert payload. Covers all three shapes the writers use — `where.season`
 * (h1_season), `where.season_enemy_bucket.season` (h1_status / h1_statistic)
 * and `create.season` (h1_event) — without hardcoding a path per model, so a
 * newly added season-bearing field is caught rather than silently skipped.
 *
 * @param {unknown} node - Any node of an upsert payload.
 * @param {number[]} [found] - Accumulator.
 * @returns {number[]} every `season` value reachable from `node`.
 */
function collectSeasons(node, found = []) {
    if (node === null || typeof node !== 'object') return found;
    for (const [key, value] of Object.entries(node)) {
        if (key === 'season' && typeof value === 'number') found.push(value);
        else collectSeasons(value, found);
    }
    return found;
}

beforeEach(() => {
    for (const model of WRITTEN_MODELS) db[model].upsert.mockClear();
    vi.mocked(fetchStatus).mockReset();
});

// --- Tests ------------------------------------------------------------------

describe('ingest invariants (edges mocked, wiring real)', () => {
    describe('cross-season lagged event guard', () => {
        it('writes NO h1_event row for a lagged season-N event during an N+1 poll', async () => {
            vi.mocked(fetchStatus).mockResolvedValue(laggedTransitionPayload());

            const result = await updateStatus();

            expect(result.season).toBe(CURRENT_SEASON);
            // The guard is the whole point: neither the lagged defend nor the
            // lagged attack may reach the h1_event table at all.
            expect(db.h1_event.upsert).not.toHaveBeenCalled();
        });

        it('writes NO h1_event_progress row for a lagged season-N event', async () => {
            vi.mocked(fetchStatus).mockResolvedValue(laggedTransitionPayload());

            await updateStatus();

            expect(db.h1_event_progress.upsert).not.toHaveBeenCalled();
        });

        it('no write anywhere references the lagged season', async () => {
            vi.mocked(fetchStatus).mockResolvedValue(laggedTransitionPayload());

            await updateStatus();

            const everyWrite = [
                ...upsertPayloads('h1_season'),
                ...upsertPayloads('h1_event'),
                ...upsertPayloads('h1_status'),
                ...upsertPayloads('h1_statistic'),
                ...upsertPayloads('h1_event_progress'),
            ];
            expect(everyWrite.length).toBeGreaterThan(0);

            // Walk the payloads for real `season` keys rather than substring-
            // matching the serialised JSON: "199" also occurs inside values
            // like points: 1990 or a bucket timestamp, which would make this
            // fail for reasons that have nothing to do with the guard.
            const seasons = collectSeasons(everyWrite);
            expect(seasons.length).toBeGreaterThan(0);
            expect(seasons).not.toContain(LAGGED_SEASON);
            expect(new Set(seasons)).toEqual(new Set([CURRENT_SEASON]));
        });

        it('DOES write the event once its season matches the active season', async () => {
            vi.mocked(fetchStatus).mockResolvedValue(currentSeasonPayload());

            await updateStatus();

            // one defend + one attack
            expect(db.h1_event.upsert).toHaveBeenCalledTimes(2);
            expect(db.h1_event_progress.upsert).toHaveBeenCalledTimes(2);
            for (const call of upsertPayloads('h1_event')) {
                expect(call.create.season).toBe(CURRENT_SEASON);
            }
        });
    });

    describe('season resolution ignores lagged event slots', () => {
        it('resolves the campaign/statistics season, not the lagged event season', async () => {
            vi.mocked(fetchStatus).mockResolvedValue(laggedTransitionPayload());

            const result = await updateStatus();

            expect(result.season).toBe(CURRENT_SEASON);
            expect(result.season).not.toBe(LAGGED_SEASON);

            // Every timeseries row must be stamped with the current season.
            for (const call of upsertPayloads('h1_status')) {
                expect(call.create.season).toBe(CURRENT_SEASON);
                expect(call.where.season_enemy_bucket.season).toBe(CURRENT_SEASON);
            }
            for (const call of upsertPayloads('h1_statistic')) {
                expect(call.create.season).toBe(CURRENT_SEASON);
            }
        });

        it('does not warn about multiple seasons when only event slots lag', async () => {
            const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
            vi.mocked(fetchStatus).mockResolvedValue(laggedTransitionPayload());

            await updateStatus();

            // resolveSeason warns when >1 unique season is aggregated. Pulling the
            // lagged slots in would trip it.
            expect(warn).not.toHaveBeenCalledWith(
                expect.stringContaining('Multiple seasons'),
                expect.anything(),
            );
            warn.mockRestore();
        });
    });

    describe('bucket arithmetic reaches the db', () => {
        it('floors poll time down to the bucket boundary on every timeseries write', async () => {
            const payload = currentSeasonPayload();
            // Pick a poll time deliberately mid-bucket so floor != round and
            // floor(t) != floor(t + 1) is observable.
            // midBucket is the last second of its bucket, so expectedBucket is
            // BUCKET_SIZE-1 lower — on a bucket boundary by construction, and
            // strictly below midBucket, which is what makes floor vs round
            // distinguishable below. (Fixture arithmetic, not behaviour: the
            // assertions that follow are the ones that test the code.)
            const midBucket =
                Math.floor(POLL_TIME / BUCKET_SIZE) * BUCKET_SIZE + BUCKET_SIZE - 1;
            payload.time = midBucket;
            const expectedBucket = midBucket - (BUCKET_SIZE - 1);
            vi.mocked(fetchStatus).mockResolvedValue(payload);

            await updateStatus();

            const statusCalls = upsertPayloads('h1_status');
            expect(statusCalls).toHaveLength(3);
            for (const call of statusCalls) {
                expect(call.where.season_enemy_bucket.bucket).toBe(expectedBucket);
                expect(call.create.bucket).toBe(expectedBucket);
                expect(call.create.time).toBe(midBucket);
            }

            for (const call of upsertPayloads('h1_statistic')) {
                expect(call.create.bucket).toBe(expectedBucket);
            }
            for (const call of upsertPayloads('h1_event_progress')) {
                expect(call.where.type_event_id_bucket.bucket).toBe(expectedBucket);
                expect(call.create.bucket).toBe(expectedBucket);
            }
        });

        it('two polls in the same window share a bucket; the next window does not', async () => {
            const base = Math.floor(POLL_TIME / BUCKET_SIZE) * BUCKET_SIZE;

            const first = currentSeasonPayload();
            first.time = base + 1;
            vi.mocked(fetchStatus).mockResolvedValue(first);
            await updateStatus();
            const bucketA = upsertPayloads('h1_status')[0].create.bucket;

            db.h1_status.upsert.mockClear();
            const second = currentSeasonPayload();
            second.time = base + BUCKET_SIZE - 1;
            vi.mocked(fetchStatus).mockResolvedValue(second);
            await updateStatus();
            const bucketB = upsertPayloads('h1_status')[0].create.bucket;

            db.h1_status.upsert.mockClear();
            const third = currentSeasonPayload();
            third.time = base + BUCKET_SIZE;
            vi.mocked(fetchStatus).mockResolvedValue(third);
            await updateStatus();
            const bucketC = upsertPayloads('h1_status')[0].create.bucket;

            expect(bucketA).toBe(base);
            expect(bucketB).toBe(base);
            expect(bucketC).toBe(base + BUCKET_SIZE);
        });
    });
});
