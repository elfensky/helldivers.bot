import { cache } from 'react';
import db from '@/db/db';
import { deriveTrainStarts, waveForecast } from '@/features/dashboard/waveForecast.mjs';
import { EVENT_TYPE } from '@/shared/enums/events.mjs';

const HOUR = 3600;
const HIST_BIN_WIDTH_H = 2;
const HIST_MAX_H = 120;

/**
 * Sorted-array linear-interpolation quantile — same method as
 * `scripts/analysis/lib/backtest.mjs`'s `quantileOf`, duplicated here (not
 * imported) because app code cannot import from `scripts/`.
 *
 * @param {number[]} values sample to quantile over.
 * @param {number} q quantile in [0, 1]
 * @returns {number | null} null when `values` is empty
 */
function quantileOf(values, q) {
    if (values.length === 0) return null;
    const s = [...values].sort((a, b) => a - b);
    const pos = q * (s.length - 1);
    const lo = Math.floor(pos);
    const hi = Math.ceil(pos);
    if (lo === hi) return s[lo];
    return s[lo] + (s[hi] - s[lo]) * (pos - lo);
}

/**
 * Group defends per season, derive per-season train starts (via
 * `deriveTrainStarts`), and build lull records — the gap from the end of the
 * defend immediately preceding a train start (in that season's
 * time-ordered defend list) to the train start itself. Mirrors
 * `scripts/analysis/04-train-baseline.mjs`'s `buildLullRecords`, restricted
 * to the lull-hours figure only (no prevTrainLength/prevTrainFailures — not
 * needed by the live stats card). Per-season grouping means a defend just
 * after a season boundary is never chained onto the previous season's train.
 *
 * @param {{season: number, enemy: number, start_time: number, end_time: number}[]} defendRows all-season defend events
 * @returns {{trainStarts: object[], seasons: number, lullHours: number[]}}
 */
function analyzeTrains(defendRows) {
    const bySeason = new Map();
    for (const d of defendRows) {
        if (!bySeason.has(d.season)) bySeason.set(d.season, []);
        bySeason.get(d.season).push(d);
    }

    const allTrainStarts = [];
    const lullHours = [];
    for (const [, list] of bySeason) {
        const sorted = [...list].sort((a, b) => a.start_time - b.start_time);
        const starts = new Set(deriveTrainStarts(sorted));
        allTrainStarts.push(...sorted.filter((d) => starts.has(d)));

        const startIndices = [];
        for (let i = 0; i < sorted.length; i++) {
            if (starts.has(sorted[i])) startIndices.push(i);
        }
        // k starts at 1: a season's first train has no preceding train, so it
        // contributes no lull record.
        for (let k = 1; k < startIndices.length; k++) {
            const start = sorted[startIndices[k]];
            const prevTrainLastDefend = sorted[startIndices[k] - 1];
            lullHours.push((start.start_time - prevTrainLastDefend.end_time) / HOUR);
        }
    }

    return { trainStarts: allTrainStarts, seasons: bySeason.size, lullHours };
}

/**
 * Quantiles + method-of-moments gamma fit over the lull-hours sample.
 * `fittedK`/`fittedTheta` require at least two distinct-enough observations
 * to have a computable (non-zero) coefficient of variation — with fewer,
 * they stay null rather than reporting a bogus Infinity.
 *
 * @param {number[]} lullHours one entry per lull, in hours.
 * @returns {{n: number, p25: number|null, p50: number|null, p75: number|null,
 *   meanH: number|null, cv: number|null, fittedK: number|null, fittedTheta: number|null}}
 */
function summarizeLull(lullHours) {
    const n = lullHours.length;
    const meanH = n > 0 ? lullHours.reduce((a, b) => a + b, 0) / n : null;

    let cv = null;
    let fittedK = null;
    let fittedTheta = null;
    if (n > 1 && meanH != null && meanH > 0) {
        const variance = lullHours.reduce((a, b) => a + (b - meanH) ** 2, 0) / n;
        const sd = Math.sqrt(variance);
        cv = sd / meanH;
        if (cv > 0) {
            fittedK = 1 / (cv * cv);
            fittedTheta = meanH / fittedK;
        }
    }

    return {
        n,
        p25: quantileOf(lullHours, 0.25),
        p50: quantileOf(lullHours, 0.5),
        p75: quantileOf(lullHours, 0.75),
        meanH,
        cv,
        fittedK,
        fittedTheta,
    };
}

/**
 * Fixed-width histogram of lull hours, clamped at `maxH` (values at/above the
 * max fall into the last bin rather than being dropped or growing the array).
 *
 * @param {number[]} lullHours one entry per lull, in hours.
 * @returns {{binWidthH: number, maxH: number, bins: number[]}}
 */
function buildHistogram(lullHours) {
    const numBins = HIST_MAX_H / HIST_BIN_WIDTH_H;
    const bins = new Array(numBins).fill(0);
    for (const h of lullHours) {
        const idx = Math.min(numBins - 1, Math.floor(Math.max(0, h) / HIST_BIN_WIDTH_H));
        bins[idx]++;
    }
    return { binWidthH: HIST_BIN_WIDTH_H, maxH: HIST_MAX_H, bins };
}

/**
 * Pure core of the defend live-stats card: historical train-start /
 * lull-length statistics (all seasons) plus the current-season wave
 * forecast for "now".
 *
 * @param {{season: number, enemy: number, start_time: number, end_time: number}[]} defendRows
 *   every defend event, all seasons.
 * @param {object[]} currentSeasonEvents current season's full event list (defend + attack), for `waveForecast`.
 * @param {object[]} currentStatusRows current season's latest per-faction status rows, for `waveForecast`.
 * @param {number} nowSeconds unix seconds "now".
 * @returns {{
 *   counts: {defends: number, trainStarts: number, seasons: number},
 *   lull: {n: number, p25: number|null, p50: number|null, p75: number|null, meanH: number|null, cv: number|null, fittedK: number|null, fittedTheta: number|null},
 *   histogram: {binWidthH: number, maxH: number, bins: number[]},
 *   now: {forecast: ReturnType<typeof waveForecast>, lastTrainStart: number|null},
 * }}
 */
export function computeDefendStats(
    defendRows,
    currentSeasonEvents,
    currentStatusRows,
    nowSeconds,
) {
    const { trainStarts, seasons, lullHours } = analyzeTrains(defendRows);

    const currentDefends = currentSeasonEvents.filter(
        (e) => e.type === EVENT_TYPE.DEFEND,
    );
    const currentStarts = deriveTrainStarts(currentDefends);
    const lastTrainStart = currentStarts.at(-1)?.start_time ?? null;

    const forecast = waveForecast(
        { events: currentSeasonEvents, status: currentStatusRows },
        nowSeconds,
    );

    return {
        counts: {
            defends: defendRows.length,
            trainStarts: trainStarts.length,
            seasons,
        },
        lull: summarizeLull(lullHours),
        histogram: buildHistogram(lullHours),
        now: { forecast, lastTrainStart },
    };
}

/**
 * Async DB-backed wrapper around `computeDefendStats` for the `/docs/predict/defend`
 * page (hourly ISR). Wrapped in React's `cache()` so multiple server
 * components sharing one render dedupe the query.
 *
 * @returns {Promise<ReturnType<typeof computeDefendStats>>}
 */
export const getDefendLiveStats = cache(async function getDefendLiveStats() {
    'use server';

    // `last_updated: { not: null }` excludes an in-progress season import — mirrors
    // `src/db/queries/getCampaign.mjs`'s `_findSeason` guard against serving a
    // partially-seeded season.
    const seasonAgg = await db.h1_season.aggregate({
        where: { last_updated: { not: null } },
        _max: { season: true },
    });
    const targetSeason = seasonAgg._max.season;

    const defendRows = await db.h1_event.findMany({
        where: { type: EVENT_TYPE.DEFEND },
        select: {
            season: true,
            enemy: true,
            start_time: true,
            end_time: true,
            status: true,
        },
        orderBy: [{ start_time: 'asc' }],
    });

    const currentSeasonEvents = await db.h1_event.findMany({
        where: { season: targetSeason },
        select: {
            type: true,
            enemy: true,
            region: true,
            start_time: true,
            end_time: true,
            status: true,
        },
        orderBy: [{ start_time: 'asc' }, { event_id: 'asc' }],
    });

    // Latest h1_status row per faction — same DISTINCT ON shape as getCampaign.
    const currentStatusRows = await db.$queryRaw`
        SELECT DISTINCT ON (enemy) *
        FROM h1_status
        WHERE season = ${targetSeason}
        ORDER BY enemy ASC, bucket DESC
    `;

    return computeDefendStats(
        defendRows,
        currentSeasonEvents,
        currentStatusRows,
        Math.floor(Date.now() / 1000),
    );
});

/**
 * Cheap event counts for the /docs/predict hub page.
 *
 * @returns {Promise<{defends: number, attacks: number, seasons: number}>}
 */
export async function getEventCounts() {
    'use server';

    const [defends, attacks, seasonRows] = await Promise.all([
        db.h1_event.count({ where: { type: EVENT_TYPE.DEFEND } }),
        db.h1_event.count({ where: { type: EVENT_TYPE.ATTACK } }),
        db.h1_event.groupBy({ by: ['season'] }),
    ]);

    return { defends, attacks, seasons: seasonRows.length };
}

/**
 * Pairwise event-concurrency census — the live proof behind the "one defend
 * at a time" rule and its siblings. Pure; pairs are only compared within a
 * season (events of different wars can't co-run by construction).
 *
 * @param {{season: number, type: string, enemy: number, start_time: number, end_time: number}[]} allEvents
 * @returns {{
 *   defendDefend: {overlaps: number, checked: number},
 *   defendAttackSame: {overlaps: number, checked: number},
 *   defendAttackCross: {overlaps: number, checked: number},
 *   attackAttack: {overlaps: number, checked: number},
 *   maxSimultaneous: number,
 *   compositions: {key: string, moments: number, firstSeason: number}[],
 * }}
 */
export function computeConcurrencyStats(allEvents) {
    const bySeason = new Map();
    for (const e of allEvents) {
        if (!bySeason.has(e.season)) bySeason.set(e.season, []);
        bySeason.get(e.season).push(e);
    }

    const tally = {
        defendDefend: { overlaps: 0, checked: 0 },
        defendAttackSame: { overlaps: 0, checked: 0 },
        defendAttackCross: { overlaps: 0, checked: 0 },
        attackAttack: { overlaps: 0, checked: 0 },
    };
    let maxSimultaneous = 0;
    const comps = new Map();

    for (const [season, list] of bySeason) {
        for (let i = 0; i < list.length; i++) {
            for (let j = i + 1; j < list.length; j++) {
                const a = list[i];
                const b = list[j];
                const bucket =
                    a.type === 'defend' && b.type === 'defend' ? tally.defendDefend
                    : a.type === 'attack' && b.type === 'attack' ? tally.attackAttack
                    : a.enemy === b.enemy ? tally.defendAttackSame
                    : tally.defendAttackCross;
                bucket.checked++;
                if (a.start_time < b.end_time && b.start_time < a.end_time) {
                    bucket.overlaps++;
                }
            }
        }
        // Sweep event boundaries for simultaneity compositions.
        const times = [...new Set(list.flatMap((e) => [e.start_time, e.end_time]))];
        for (const t of times) {
            const active = list.filter((e) => e.start_time <= t && e.end_time > t);
            if (active.length < 2) continue;
            if (active.length > maxSimultaneous) maxSimultaneous = active.length;
            const key = active
                .map((e) => (e.type === 'attack' ? 'attack' : 'defend'))
                .sort()
                .join(' + ');
            if (!comps.has(key)) comps.set(key, { moments: 0, firstSeason: season });
            const c = comps.get(key);
            c.moments++;
            if (season < c.firstSeason) c.firstSeason = season;
        }
    }

    return {
        ...tally,
        maxSimultaneous,
        compositions: [...comps.entries()]
            .map(([key, v]) => ({ key, ...v }))
            .sort((x, y) => y.moments - x.moments),
    };
}

/**
 * DB-backed wrapper for `computeConcurrencyStats` — hourly ISR via the
 * page's `revalidate`, deduped per render via `cache()`.
 *
 * @returns {Promise<ReturnType<typeof computeConcurrencyStats>>}
 */
export const getConcurrencyStats = cache(async function getConcurrencyStats() {
    'use server';

    const allEvents = await db.h1_event.findMany({
        select: {
            season: true,
            type: true,
            enemy: true,
            start_time: true,
            end_time: true,
        },
        orderBy: [{ season: 'asc' }, { start_time: 'asc' }],
    });
    return computeConcurrencyStats(allEvents);
});
