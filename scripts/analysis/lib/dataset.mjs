/**
 * dataset.mjs — the single data loader for the #472 next-event timing analysis.
 *
 * Runs outside Next.js: relative imports only, no `@/*` alias.
 *
 * Library:    import { loadDataset } from './lib/dataset.mjs';
 * Self-check: node --env-file=.env.development scripts/analysis/lib/dataset.mjs
 */

import assert from 'node:assert/strict';
import pg from 'pg';

export const HOUR = 3600;
export const DAY = 86400;
export const SECTOR_COUNT = 10;

/**
 * Seeded linear congruential generator (Numerical Recipes constants).
 * Deterministic so re-runs reproduce the exact same numbers.
 *
 * @param {number} seed the initial seed value
 * @returns {() => number} generator yielding values in [0, 1)
 */
export function makeRng(seed) {
    let state = seed >>> 0;
    return function next() {
        state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
        return state / 4294967296;
    };
}

/**
 * Median of a numeric array (linear-interpolated at even counts). Module-
 * private — kept minimal here rather than importing the richer `quantile`
 * helper the analysis scripts define, since dataset.mjs stays a pure data
 * loader with no dependency on any particular script's stats code.
 *
 * @param {number[]} values
 * @returns {number|null} null for an empty array
 */
function median(values) {
    if (values.length === 0) return null;
    const s = [...values].sort((a, b) => a - b);
    const mid = Math.floor(s.length / 2);
    return s.length % 2 === 0 ? (s[mid - 1] + s[mid]) / 2 : s[mid];
}

function connectionString() {
    const url = process.env.POSTGRES_URL;
    assert(url, 'POSTGRES_URL is not set — run with --env-file=.env.development');
    // pg does not understand Prisma's `?schema=` parameter.
    return url.replace(/\?schema=public"?$/, '');
}

/**
 * Load every row this analysis needs, in three queries, and attach the derived
 * per-event fields the phases share.
 *
 * @param {{statistics?: boolean}} [options] when `statistics` is truthy, also
 *   load per-faction player telemetry from h1_statistic (S157+ only — a fourth
 *   query the pre-existing scripts never pay for)
 * @returns {Promise<object>} dataset
 */
export async function loadDataset(options = {}) {
    const client = new pg.Client({ connectionString: connectionString() });
    await client.connect();

    let eventRows, statusRows, seasonRows;
    let statisticRows = [];
    try {
        ({ rows: eventRows } = await client.query(
            `SELECT season, type, event_id, start_time, end_time, region, enemy,
                    points, points_max, status, players_at_start
               FROM h1_event
              ORDER BY season, start_time, event_id`,
        ));
        ({ rows: statusRows } = await client.query(
            `SELECT season, enemy, bucket, time, points, points_taken, status
               FROM h1_status
              ORDER BY season, enemy, bucket`,
        ));
        ({ rows: seasonRows } = await client.query(
            `SELECT season, points_max FROM h1_season ORDER BY season`,
        ));
        if (options.statistics) {
            ({ rows: statisticRows } = await client.query(
                `SELECT season, enemy, bucket, time, players
                   FROM h1_statistic
                  ORDER BY season, enemy, bucket`,
            ));
        }
    } finally {
        await client.end();
    }

    const events = eventRows;

    // --- seasons -----------------------------------------------------------
    const eventsBySeason = new Map();
    for (const e of events) {
        if (!eventsBySeason.has(e.season)) eventsBySeason.set(e.season, []);
        eventsBySeason.get(e.season).push(e);
    }

    const seasons = new Map();
    for (const row of seasonRows) {
        const list = eventsBySeason.get(row.season) ?? [];
        const firstStart = list.length ? Math.min(...list.map((e) => e.start_time)) : 0;
        const lastEnd = list.length ? Math.max(...list.map((e) => e.end_time)) : 0;
        seasons.set(row.season, {
            season: row.season,
            pointsMax: row.points_max ?? [],
            firstStart,
            lastEnd,
            spanSeconds: Math.max(0, lastEnd - firstStart),
        });
    }

    // --- derived per-event fields -----------------------------------------
    for (const [, list] of eventsBySeason) {
        // Player percentile within the season, on an EXPANDING window: each
        // event is ranked only against events EARLIER in the same season.
        //
        // Ranking against the whole season would leak future information into
        // every feature built on this field. The walk-forward leakage assert
        // only compares season numbers, so a whole-season rank passes it
        // cleanly while quietly handing the model the future — the single
        // defect most likely to invert the conclusion.
        for (let i = 0; i < list.length; i++) {
            const mine = list[i].players_at_start ?? 0;
            const earlier = list.slice(0, i).map((e) => e.players_at_start ?? 0);
            list[i].playerPercentileInSeason =
                earlier.length > 0 ?
                    earlier.filter((p) => p < mine).length / earlier.length
                :   0.5; // neutral prior for a season's first event
        }

        // Gaps are per (type, enemy). Mixing factions inside a season would
        // report a Cyborg attack as "the previous attack" for a Bug one.
        for (const type of ['defend', 'attack']) {
            for (const enemy of [0, 1, 2]) {
                const series = list.filter((e) => e.type === type && e.enemy === enemy);
                for (let i = 0; i < series.length; i++) {
                    const e = series[i];
                    const prev = i > 0 ? series[i - 1] : null;
                    e.idleSeconds = prev ? e.start_time - prev.end_time : null;
                    e.hoursSinceLastSameType =
                        prev ? (e.start_time - prev.start_time) / HOUR : null;
                }
            }
        }

        // Train labelling. A defend train continues iff the previous defend OF
        // THE SAME FACTION was failed — a game mechanic, not a statistical
        // tendency. Only the FIRST defend of a train is a forecasting target;
        // the rest are mechanical.
        //
        // Scoped per (season, enemy), NOT pooled across factions within a
        // season. The original implementation chained defends purely by
        // season + start_time order, so a Cyborg defend ending just before a
        // Bug defend started could count as that Bug defend's "previous
        // defend" and mislabel a cross-faction pair as one train continuing.
        // A train is a same-faction mechanic; the predecessor that decides
        // continuation must share the enemy.
        const CHAIN_SECONDS = 600;
        for (const enemy of [0, 1, 2]) {
            const defends = list.filter((e) => e.type === 'defend' && e.enemy === enemy);
            let currentLength = 0;
            let currentFailures = 0;
            let lastTrainLength = null;
            let lastTrainFailures = null;

            for (let i = 0; i < defends.length; i++) {
                const prev = i > 0 ? defends[i - 1] : null;
                const isStart =
                    prev === null ||
                    defends[i].start_time - prev.end_time > CHAIN_SECONDS;

                defends[i].isTrainStart = isStart;
                if (isStart) {
                    // Close the train that just ended, then open a new one.
                    lastTrainLength = i > 0 ? currentLength : null;
                    lastTrainFailures = i > 0 ? currentFailures : null;
                    currentLength = 0;
                    currentFailures = 0;
                }
                defends[i].prevTrainLength = isStart ? lastTrainLength : null;
                defends[i].prevTrainFailures = isStart ? lastTrainFailures : null;

                currentLength++;
                if (defends[i].status === 'fail') currentFailures++;
            }
        }

        // Counterattack labelling. A fail-resolved homeworld assault (which
        // always runs its full 48h timeout) is followed by a defend train on
        // that same faction, starting within minutes of the assault's end
        // when the global defend slot is free — a sequencing mechanic, same
        // epistemic class as the chain rule above (measured in
        // `14-counterattack-delta.mjs`: 467/474 slot-free deltas < 10min,
        // p05–p95 = 0.0h). Such train starts carry no scheduler randomness
        // and are NOT free forecasting targets. The 2h window matches
        // `15-counterattack-target.mjs`'s pre-declared label; queued
        // counterattacks that fire late (double-queue cases, p50 ~37h) stay
        // unflagged on purpose — their timing is still a scheduler draw.
        // Labelling only: the chain rule above is untouched.
        const COUNTERATTACK_WINDOW_SECONDS = 7200;
        const failedAttacks = list.filter(
            (e) => e.type === 'attack' && e.status === 'fail',
        );
        for (const e of list) {
            if (e.type !== 'defend') continue;
            e.isCounterattack =
                e.isTrainStart === true &&
                failedAttacks.some(
                    (a) =>
                        a.enemy === e.enemy &&
                        e.start_time - a.end_time >= 0 &&
                        e.start_time - a.end_time <= COUNTERATTACK_WINDOW_SECONDS,
                );
        }
    }

    // --- point-in-time status lookup --------------------------------------
    const statusIndex = new Map();
    for (const row of statusRows) {
        const key = `${row.season}:${row.enemy}`;
        if (!statusIndex.has(key)) statusIndex.set(key, []);
        statusIndex.get(key).push(row);
    }

    /**
     * The row with the largest `bucket <= t` in a bucket-ascending array, or
     * null when the array is empty or starts after `t`. Shared by the status
     * and statistic point lookups.
     *
     * @param {object[]|undefined} rows ascending by bucket
     * @param {number} t unix seconds
     * @returns {object|null}
     */
    function latestBucketAtOrBefore(rows, t) {
        if (!rows || rows.length === 0 || rows[0].bucket > t) return null;
        let lo = 0;
        let hi = rows.length - 1;
        let best = null;
        while (lo <= hi) {
            const mid = (lo + hi) >> 1;
            if (rows[mid].bucket <= t) {
                best = rows[mid];
                lo = mid + 1;
            } else {
                hi = mid - 1;
            }
        }
        return best;
    }

    /**
     * Most recent status bucket at or before `t`, or null if none exists.
     * For 156 of 160 seasons the answer can be up to 24h stale — h1_status
     * runs at ~1 bucket/day outside S157–160.
     *
     * @param {number} season the season number
     * @param {number} enemy the enemy faction (0=Bugs, 1=Cyborgs, 2=Illuminate)
     * @param {number} t unix seconds timestamp
     * @returns {object|null}
     */
    function statusAt(season, enemy, t) {
        return latestBucketAtOrBefore(statusIndex.get(`${season}:${enemy}`), t);
    }

    // --- point-in-time player telemetry lookup (statistics option) ---------
    const statisticIndex = new Map();
    for (const row of statisticRows) {
        const key = `${row.season}:${row.enemy}`;
        if (!statisticIndex.has(key)) statisticIndex.set(key, []);
        statisticIndex.get(key).push(row);
    }

    /**
     * Most recent statistic bucket at or before `t`, or null if none exists.
     * Empty unless the dataset was loaded with `{ statistics: true }` — and
     * even then only S157+ has rows; the caller owns any staleness policy,
     * mirroring `statusAt`.
     *
     * @param {number} season
     * @param {number} enemy
     * @param {number} t unix seconds
     * @returns {object|null} `{season, enemy, bucket, time, players}` or null
     */
    function playersAt(season, enemy, t) {
        return latestBucketAtOrBefore(statisticIndex.get(`${season}:${enemy}`), t);
    }

    /**
     * The full statistic series for one (season, enemy), ascending by bucket —
     * the temporal-pattern counterpart of `statusSeries` (see its note on why
     * point queries cannot substitute for the raw observations).
     *
     * @param {number} season
     * @param {number} enemy
     * @returns {object[]} the stored rows, or an empty array
     */
    function statisticSeries(season, enemy) {
        return statisticIndex.get(`${season}:${enemy}`) ?? [];
    }

    /**
     * Seasons that have any statistic rows, ascending. Consumers derive their
     * telemetry evaluation window from this rather than hardcoding S157+.
     *
     * @returns {number[]}
     */
    function statSeasons() {
        return [...new Set(statisticRows.map((r) => r.season))].sort((a, b) => a - b);
    }

    /**
     * Liberation ratio (points / points_max) for a faction at time `t`.
     *
     * @param {number} season the season number
     * @param {number} enemy the enemy faction (0=Bugs, 1=Cyborgs, 2=Illuminate)
     * @param {number} t unix seconds timestamp
     * @returns {number|null} null when status or points_max is unavailable
     */
    function liberationAt(season, enemy, t) {
        const st = statusAt(season, enemy, t);
        if (!st) return null;
        const max = seasons.get(season)?.pointsMax?.[enemy] ?? 0;
        if (!(max > 0)) return null;
        return st.points / max;
    }

    /**
     * Within-season player percentile evaluable at an ARBITRARY instant.
     *
     * Returns the percentile of the most recent event at or before `t`, ranked
     * against events strictly earlier in the same season. Causal by
     * construction, and — unlike the per-event field — computable at a control
     * moment, which is what makes a comparison of this variable non-degenerate.
     *
     * @param {number} season
     * @param {number} t unix seconds
     * @returns {number} percentile in [0, 1]; 0.5 when no event precedes `t`
     */
    function playerPercentileAt(season, t) {
        const list = eventsBySeason.get(season) ?? [];
        const earlier = list.filter((e) => e.start_time <= t);
        if (earlier.length === 0) return 0.5;
        const mine = earlier.at(-1).players_at_start ?? 0;
        const priors = earlier.slice(0, -1).map((e) => e.players_at_start ?? 0);
        return priors.length > 0 ?
                priors.filter((p) => p < mine).length / priors.length
            :   0.5;
    }

    /**
     * Player count at `t` relative to the season's OWN running median,
     * evaluable at an ARBITRARY instant — not just a real event start —
     * which is what makes it usable at phase-matched controls (not real
     * events) drawn for the #472 covariate sweep.
     *
     * Raw player counts drift across 160 seasons of war eras, and controls
     * are drawn from OTHER seasons than the event they match — a raw count
     * comparison would therefore be confounded by era rather than by
     * anything causal. Dividing by the season's own running median removes
     * that era drift while preserving magnitude information that
     * `playerPercentileAt`'s rank discards.
     *
     * @param {number} season
     * @param {number} t unix seconds
     * @returns {number|null} null when no event precedes-or-is-at `t`, or when
     *   no event strictly earlier than `t` exists to build the median from
     */
    function playersRelToSeasonMedianAt(season, t) {
        const list = eventsBySeason.get(season) ?? [];
        const atOrBefore = list.filter((e) => e.start_time <= t);
        if (atOrBefore.length === 0) return null;
        const mine = atOrBefore.at(-1).players_at_start;
        if (mine === null || mine === undefined) return null;

        const before = list
            .filter((e) => e.start_time < t)
            .map((e) => e.players_at_start ?? 0);
        if (before.length === 0) return null;
        const m = median(before);
        if (!(m > 0)) return null;
        return mine / m;
    }

    /**
     * The full status series for one (season, enemy), ascending by bucket.
     *
     * `statusAt` answers point queries, but a consumer learning a *temporal
     * pattern* (pace by day of week, say) needs the actual observations —
     * stepping a clock and calling `statusAt` would resample the same bucket
     * many times over and weight slow days by however long they were stale.
     *
     * @param {number} season
     * @param {number} enemy
     * @returns {object[]} the stored rows, or an empty array
     */
    function statusSeries(season, enemy) {
        return statusIndex.get(`${season}:${enemy}`) ?? [];
    }

    return {
        events,
        seasons,
        statusAt,
        statusSeries,
        playersAt,
        statisticSeries,
        statSeasons,
        liberationAt,
        playerPercentileAt,
        playersRelToSeasonMedianAt,
    };
}

if (import.meta.filename === process.argv[1]) {
    const ds = await loadDataset();

    assert(ds.events.length > 0, 'no events loaded');
    assert(ds.seasons.size > 0, 'no seasons loaded');

    // Every event belongs to a known season.
    for (const e of ds.events) {
        assert(ds.seasons.has(e.season), `event in unknown season ${e.season}`);
    }

    // Events are sorted ascending by start_time within each season.
    let prev = null;
    for (const e of ds.events) {
        if (prev && prev.season === e.season) {
            assert(
                prev.start_time <= e.start_time,
                `unsorted events in season ${e.season}`,
            );
        }
        prev = e;
    }

    // Derived fields are in range.
    for (const e of ds.events) {
        assert(
            e.playerPercentileInSeason >= 0 && e.playerPercentileInSeason <= 1,
            `percentile out of range: ${e.playerPercentileInSeason}`,
        );
        assert(
            e.hoursSinceLastSameType === null || e.hoursSinceLastSameType >= 0,
            'negative hoursSinceLastSameType',
        );
    }

    // The percentile must be causal: recomputing it from strictly-earlier
    // events in the same season has to reproduce the stored value exactly.
    // This is the guard against the whole-season-rank leak.
    {
        const bySeason = new Map();
        for (const e of ds.events) {
            if (!bySeason.has(e.season)) bySeason.set(e.season, []);
            bySeason.get(e.season).push(e);
        }
        for (const [, list] of bySeason) {
            for (let i = 0; i < Math.min(list.length, 25); i++) {
                const mine = list[i].players_at_start ?? 0;
                const earlier = list.slice(0, i).map((e) => e.players_at_start ?? 0);
                const expected =
                    earlier.length > 0 ?
                        earlier.filter((p) => p < mine).length / earlier.length
                    :   0.5;
                assert.equal(
                    list[i].playerPercentileInSeason,
                    expected,
                    `percentile is not causal at season ${list[i].season} index ${i}`,
                );
            }
        }
    }

    // Gaps must be enemy-scoped: the referenced predecessor has to share both
    // type AND enemy, not just type.
    for (const e of sampleGapEvents(ds)) {
        const sameSeason = ds.events.filter(
            (x) =>
                x.season === e.season &&
                x.type === e.type &&
                x.enemy === e.enemy &&
                x.start_time < e.start_time,
        );
        assert(
            sameSeason.length > 0,
            'hoursSinceLastSameType set but no same-enemy predecessor exists',
        );
        const prev = sameSeason.at(-1);
        assert.equal(
            e.hoursSinceLastSameType,
            (e.start_time - prev.start_time) / 3600,
            'hoursSinceLastSameType does not match the same-enemy predecessor',
        );
    }

    function sampleGapEvents(dataset) {
        return dataset.events
            .filter((e) => e.hoursSinceLastSameType !== null)
            .filter((_, i) => i % 211 === 0);
    }

    // statusAt never returns a bucket in the future, and returns null before
    // the first bucket of a series.
    const sample = ds.events.filter((_, i) => i % 97 === 0);
    for (const e of sample) {
        const st = ds.statusAt(e.season, e.enemy, e.start_time);
        if (st !== null) {
            assert(st.bucket <= e.start_time, 'statusAt returned a future bucket');
            assert(
                st.season === e.season && st.enemy === e.enemy,
                'statusAt key mismatch',
            );
        }
    }
    assert(ds.statusAt(1, 0, 0) === null, 'statusAt should be null before all buckets');

    // playerPercentileAt must be evaluable at an ARBITRARY instant — that is
    // the whole point of it — and must agree with the per-event field when
    // queried exactly at an event start. Restricted to events with a unique
    // start_time in their season, since ties make "the most recent event at t"
    // ambiguous.
    {
        const bySeasonPct = new Map();
        for (const e of ds.events) {
            if (!bySeasonPct.has(e.season)) bySeasonPct.set(e.season, []);
            bySeasonPct.get(e.season).push(e);
        }
        let checked = 0;
        outer: for (const [, list] of bySeasonPct) {
            for (const e of list) {
                if (list.filter((x) => x.start_time === e.start_time).length !== 1) {
                    continue;
                }
                assert.equal(
                    ds.playerPercentileAt(e.season, e.start_time),
                    e.playerPercentileInSeason,
                    `playerPercentileAt disagrees with the per-event field at season ${e.season}`,
                );
                if (++checked >= 200) break outer;
            }
        }
        assert(checked > 0, 'no unique-start events found to cross-check');
        assert.equal(
            ds.playerPercentileAt(1, 0),
            0.5,
            'percentile before any event should be 0.5',
        );
    }

    // playersRelToSeasonMedianAt must be evaluable at an ARBITRARY instant
    // (same requirement as playerPercentileAt, for the same reason: it has to
    // work at phase-matched control moments, which are not real events), null
    // before the season's first event, null exactly at the first event (no
    // strictly-earlier event to build a median from), and must recompute to
    // the same manual calculation at real events with a unique start_time.
    {
        assert.equal(
            ds.playersRelToSeasonMedianAt(1, 0),
            null,
            'should be null before any event in the season',
        );

        const bySeasonRatio = new Map();
        for (const e of ds.events) {
            if (!bySeasonRatio.has(e.season)) bySeasonRatio.set(e.season, []);
            bySeasonRatio.get(e.season).push(e);
        }
        let checkedRatio = 0;
        outerRatio: for (const [season, list] of bySeasonRatio) {
            assert.equal(
                ds.playersRelToSeasonMedianAt(season, list[0].start_time),
                null,
                `first event of a season must have null playersRelToSeasonMedianAt (season ${season})`,
            );
            for (const e of list) {
                if (list.filter((x) => x.start_time === e.start_time).length !== 1) {
                    continue;
                }
                const before = list
                    .filter((x) => x.start_time < e.start_time)
                    .map((x) => x.players_at_start ?? 0);
                if (before.length === 0) continue;
                const sorted = [...before].sort((x, y) => x - y);
                const mid = Math.floor(sorted.length / 2);
                const expectedMedian =
                    sorted.length % 2 === 0 ?
                        (sorted[mid - 1] + sorted[mid]) / 2
                    :   sorted[mid];
                const expected =
                    expectedMedian > 0 ?
                        (e.players_at_start ?? 0) / expectedMedian
                    :   null;
                assert.equal(
                    ds.playersRelToSeasonMedianAt(season, e.start_time),
                    expected,
                    `playersRelToSeasonMedianAt disagrees with manual calc at season ${season}`,
                );
                if (expected !== null) {
                    assert(
                        expected >= 0,
                        'playersRelToSeasonMedianAt must be non-negative',
                    );
                }
                if (++checkedRatio >= 200) break outerRatio;
            }
        }
        assert(checkedRatio > 0, 'no unique-start events found to cross-check');
    }

    // The RNG is deterministic.
    const a = makeRng(42);
    const b = makeRng(42);
    assert.equal(a(), b(), 'makeRng is not deterministic');

    // Train labelling. Continuation is a game mechanic: a defend train continues
    // iff the previous defend was FAILED (measured 96.9% vs 0.1%). These asserts
    // pin that relationship — if labelling regresses, they fire.
    {
        const defends = ds.events.filter((e) => e.type === 'defend');
        assert(defends.length > 0, 'no defend events');

        const starts = defends.filter((e) => e.isTrainStart);
        assert(
            starts.length > 0 && starts.length < defends.length,
            `train starts (${starts.length}) should be a proper subset of defends (${defends.length})`,
        );

        // Every season's first defend is a train start (true whichever faction
        // it belongs to, since it is also the first defend of ITS faction).
        const bySeasonTrain = new Map();
        for (const e of defends) {
            if (!bySeasonTrain.has(e.season)) bySeasonTrain.set(e.season, []);
            bySeasonTrain.get(e.season).push(e);
        }
        for (const [, list] of bySeasonTrain) {
            assert(list[0].isTrainStart, 'a season first defend must be a train start');
        }

        // Labelling is scoped per (season, enemy) — grouping the invariants
        // below the same way is what actually exercises the fix. Grouping by
        // season alone (pooled across factions) would compare a defend
        // against the previous defend IN TIME regardless of faction, which is
        // exactly the bug: a cross-faction pair sitting next to each other in
        // the pooled ordering is not a train relationship at all.
        const bySeasonEnemyTrain = new Map();
        for (const e of defends) {
            const key = `${e.season}:${e.enemy}`;
            if (!bySeasonEnemyTrain.has(key)) bySeasonEnemyTrain.set(key, []);
            bySeasonEnemyTrain.get(key).push(e);
        }
        for (const [, list] of bySeasonEnemyTrain) {
            assert(
                list[0].isTrainStart,
                'a (season, enemy) first defend must be a train start',
            );
        }

        // The mechanic: continuation after a SUCCESS is near-nonexistent.
        let afterSuccessContinued = 0;
        let afterSuccess = 0;
        for (const [, list] of bySeasonEnemyTrain) {
            for (let i = 1; i < list.length; i++) {
                if (list[i - 1].status !== 'success') continue;
                afterSuccess++;
                if (!list[i].isTrainStart) afterSuccessContinued++;
            }
        }
        assert(afterSuccess > 100, 'not enough post-success cases to check');
        assert(
            afterSuccessContinued / afterSuccess < 0.05,
            `trains should not continue after a success; got ${afterSuccessContinued}/${afterSuccess}`,
        );

        // prevTrainLength is null exactly for a (season, enemy)'s first train.
        for (const [, list] of bySeasonEnemyTrain) {
            const seasonStarts = list.filter((e) => e.isTrainStart);
            assert.equal(
                seasonStarts[0].prevTrainLength,
                null,
                'first train of a (season, enemy) must have null prevTrainLength',
            );
            for (const s of seasonStarts.slice(1)) {
                assert(
                    s.prevTrainLength >= 1,
                    `prevTrainLength must be >= 1, got ${s.prevTrainLength}`,
                );
                assert(
                    s.prevTrainFailures <= s.prevTrainLength,
                    'prevTrainFailures cannot exceed prevTrainLength',
                );
            }
        }

        // Cross-faction guard: a train start's isTrainStart must be true
        // whenever the immediately-preceding SAME-FACTION defend (if any)
        // ended more than CHAIN_SECONDS before this one starts — regardless
        // of what happened in between for OTHER factions. This is the
        // invariant the original bug violated.
        const CHAIN_SECONDS_CHECK = 600;
        for (const [, list] of bySeasonEnemyTrain) {
            for (let i = 1; i < list.length; i++) {
                const gap = list[i].start_time - list[i - 1].end_time;
                assert.equal(
                    list[i].isTrainStart,
                    gap > CHAIN_SECONDS_CHECK,
                    `isTrainStart disagrees with the same-faction chain gap at season ${list[i].season} enemy ${list[i].enemy}`,
                );
            }
        }

        // Counterattack labelling: the flag only ever sits on a train start,
        // is common enough to matter (~490 of ~1979 train starts as of
        // 2026-07), and re-derives from the same-season fail-resolved
        // attacks on a sample — for flagged AND unflagged starts.
        {
            const flagged = defends.filter((e) => e.isCounterattack);
            assert(
                flagged.length > 400,
                `expected ~490 counterattack train starts, got ${flagged.length}`,
            );
            for (const e of flagged) {
                assert(e.isTrainStart, 'isCounterattack must imply isTrainStart');
            }
            const attacksBySeasonCheck = new Map();
            for (const a of ds.events) {
                if (a.type !== 'attack' || a.status !== 'fail') continue;
                if (!attacksBySeasonCheck.has(a.season)) {
                    attacksBySeasonCheck.set(a.season, []);
                }
                attacksBySeasonCheck.get(a.season).push(a);
            }
            const sampled = defends
                .filter((e) => e.isTrainStart)
                .filter((_, i) => i % 13 === 0);
            assert(sampled.length > 0, 'no train starts sampled');
            for (const e of sampled) {
                const expected = (attacksBySeasonCheck.get(e.season) ?? []).some(
                    (a) =>
                        a.enemy === e.enemy &&
                        e.start_time - a.end_time >= 0 &&
                        e.start_time - a.end_time <= 7200,
                );
                assert.equal(
                    e.isCounterattack,
                    expected,
                    `isCounterattack disagrees with re-derivation at season ${e.season}`,
                );
            }
        }
    }

    // --- statistics option -------------------------------------------------
    // A second load with the flag on: the default load above must stay
    // statistics-free (accessors present but empty), and the flagged load must
    // produce a causal, well-ordered player telemetry index.
    {
        assert.equal(
            ds.statSeasons().length,
            0,
            'default load must not carry statistics',
        );
        assert.equal(ds.playersAt(157, 0, 4102444800), null);

        const dss = await loadDataset({ statistics: true });
        const statSeasons = dss.statSeasons();
        assert(statSeasons.length > 0, 'no statistic seasons loaded');

        let highRes = 0;
        for (const season of statSeasons) {
            for (const enemy of [0, 1, 2]) {
                const series = dss.statisticSeries(season, enemy);
                for (let i = 0; i < series.length; i++) {
                    assert(series[i].players >= 0, 'negative player count');
                    if (i > 0) {
                        assert(
                            series[i - 1].bucket < series[i].bucket,
                            `unsorted statistic buckets in season ${season}`,
                        );
                    }
                }
                if (series.length > 50) highRes++;
            }
        }
        assert(
            highRes > 0,
            'no (season, enemy) series has >50 buckets — telemetry is not high-res',
        );

        // playersAt never returns a future bucket, is null before the first
        // bucket, and agrees with a linear scan on a sample.
        const someSeason = statSeasons[0];
        const someSeries = dss.statisticSeries(someSeason, 0);
        assert(someSeries.length > 0, 'first stat season has no Bugs series');
        assert.equal(
            dss.playersAt(someSeason, 0, someSeries[0].bucket - 1),
            null,
            'playersAt should be null before all buckets',
        );
        for (let i = 0; i < someSeries.length; i += 97) {
            const t = someSeries[i].bucket + 60;
            const hit = dss.playersAt(someSeason, 0, t);
            assert(hit && hit.bucket <= t, 'playersAt returned a future bucket');
            const expected = someSeries.filter((r) => r.bucket <= t).at(-1);
            assert.equal(hit.bucket, expected.bucket, 'playersAt disagrees with scan');
        }
    }

    console.log(
        `dataset self-check OK — ${ds.events.length} events, ${ds.seasons.size} seasons`,
    );
}
