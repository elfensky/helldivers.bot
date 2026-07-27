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
 * @returns {Promise<object>} dataset
 */
export async function loadDataset() {
    const client = new pg.Client({ connectionString: connectionString() });
    await client.connect();

    let eventRows, statusRows, seasonRows;
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
    }

    // --- point-in-time status lookup --------------------------------------
    const statusIndex = new Map();
    for (const row of statusRows) {
        const key = `${row.season}:${row.enemy}`;
        if (!statusIndex.has(key)) statusIndex.set(key, []);
        statusIndex.get(key).push(row);
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
        const rows = statusIndex.get(`${season}:${enemy}`);
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

    return { events, seasons, statusAt, liberationAt, playerPercentileAt };
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

    // The RNG is deterministic.
    const a = makeRng(42);
    const b = makeRng(42);
    assert.equal(a(), b(), 'makeRng is not deterministic');

    console.log(
        `dataset self-check OK — ${ds.events.length} events, ${ds.seasons.size} seasons`,
    );
}
