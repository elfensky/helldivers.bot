/**
 * 14-event-verdict-margin.mjs — how much anti-flicker slack does the Task 7
 * event-verdict rule need before it stops oscillating without losing
 * accuracy?
 *
 * The dashboard's event cards fold the pace indicator into a completion
 * verdict (`▲ on track` / `▼ behind`, see
 * docs/superpowers/specs/2026-07-31-view-dependent-eta-design.md). The rule
 * compares a rate-based completion ETA against the time actually remaining;
 * evaluated bucket-to-bucket with no slack it can flip on noise alone. This
 * script replays the EXACT Task 7 rule against every completed defend/attack
 * event with enough `h1_event_progress` history (S157+ only) to measure both
 * halves of that trade-off — accuracy against the real outcome, and how often
 * the verdict flips within a single event — across a small margin grid, and
 * recommends the smallest margin that stops the flickering without giving up
 * accuracy.
 *
 * Rule under test (must match Task 7's implementation verbatim):
 *
 *     etaHours   = (points_max - points) / (points / (t - start_time)) / 3600
 *     onTrack    = etaHours <= remainingHours * (1 + margin)
 *     remainingHours = (end_time - t) / 3600
 *
 * i.e. the average rate is measured since the event's own start (not a
 * rolling window — no new data beyond the event row itself, matching the
 * spec's "computable from the event row alone" constraint for Task 7).
 *
 * Design choices:
 *
 *  - **Qualifying events**: status `success` or `fail` (the only two outcomes
 *    a verdict can be scored against — an event still in progress has no
 *    ground truth), type `defend` or `attack`, with >= 3 progress buckets
 *    strictly between start and end (the brief's floor for a event to have
 *    any temporal shape to replay).
 *  - **Replay against the NOMINAL deadline, not the recorded `end_time`.**
 *    A won event's `end_time` is rewritten to the moment its points filled —
 *    won defends finish under the 150-minute timer (1,681 of 1,833), won
 *    assaults at a median 37h against the 48h timeout (only 4 of 381 reach
 *    it). Only failures run their timer out (3,179 of 3,260 defends at
 *    exactly 150 min; 545 of 545 assaults at exactly 48.0h). Replaying a win
 *    against its own early end therefore hands the rule a deadline that never
 *    existed live, understating `remainingHours` and biasing the verdict
 *    toward "behind" on precisely the events that succeeded. `nominalDeadline`
 *    restores the deadline the live card actually sees. This bias cost ~7
 *    accuracy points and inflated the recommended margin.
 *
 *  - **Skip the first 25% of the event.** The rate `points / (t - start)`
 *    is dominated by whatever happened in the first few minutes when `t` is
 *    close to `start_time` — a single early bucket can imply a wildly wrong
 *    rate. This is the same class of problem `10-attack-eta.mjs` solves with
 *    a rolling rate window; here there is no window (event row only), so the
 *    fix is to not evaluate too close to the start. 25% matches
 *    `MIN_ELAPSED_FRACTION` in `src/features/dashboard/eventForecast.mjs`, so
 *    the measurement covers exactly the moments the card actually renders.
 *  - **Flip rate is per-event, not per-moment.** A margin that flips 0-1
 *    times per event is "stable"; the accuracy number alone can't see this —
 *    an event that flips back and forth around the true outcome can still
 *    score high average accuracy while being unusable as a live indicator.
 *
 * Ref #483
 *
 * Run: node --env-file=.env.development scripts/analysis/14-event-verdict-margin.mjs
 */

import assert from 'node:assert/strict';
import { loadDataset, HOUR } from './lib/dataset.mjs';
import { quantileOf } from './lib/backtest.mjs';

const MARGINS = [0, 0.05, 0.1, 0.15, 0.2, 0.3];
const SKIP_FRACTION = 0.25; // skip the first 25% of the event's duration (matches the shipped gate)
const MIN_PROGRESS_BUCKETS = 3;
const MIN_QUALIFYING_EVENTS = 10;
const ACCURACY_TOLERANCE = 0.02; // 2 percentage points
const DEFAULT_MARGIN = 0.1;

/**
 * The Task 7 verdict rule, verbatim. `t` must be strictly after `start_time`
 * (callers are expected to have already skipped the warm-up window).
 *
 * @param {number} points current event points
 * @param {number} pointsMax the event's points_max
 * @param {number} startTime event start_time (unix seconds)
 * @param {number} endTime event end_time (unix seconds) — the deadline
 * @param {number} t the replay instant (unix seconds), start_time < t < end_time
 * @param {number} margin slack fraction added to the remaining-time budget
 * @returns {boolean} true when the completion ETA is within budget
 */
function verdictAt(points, pointsMax, startTime, endTime, t, margin) {
    const elapsed = t - startTime;
    assert(elapsed > 0, 'verdictAt requires t strictly after start_time');
    const rate = points / elapsed;
    const remaining = pointsMax - points;
    const etaHours = rate > 0 ? remaining / rate / HOUR : Infinity;
    const remainingHours = (endTime - t) / HOUR;
    return etaHours <= remainingHours * (1 + margin);
}

/**
 * Timer lengths the game actually schedules, ascending. A won event's
 * recorded duration is the moment its points filled, so the timer it was
 * running against is the smallest class at least that long.
 */
const DURATION_CLASSES = {
    defend: [1800, 3600, 5400, 7200, 9000, 14400, 172800],
    attack: [172800],
};

/**
 * The deadline the event was live against — what the dashboard card sees
 * while it is still active. Failures ran their timer out, so their recorded
 * `end_time` IS the deadline; wins ended early and need theirs restored.
 *
 * @param {{type: string, status: string, start_time: number, end_time: number}} event
 * @returns {number} unix seconds
 */
function nominalDeadline(event) {
    if (event.status !== 'success') return event.end_time;
    const duration = event.end_time - event.start_time;
    const timer = (DURATION_CLASSES[event.type] ?? []).find((c) => c >= duration);
    return event.start_time + (timer ?? duration);
}

/**
 * The progress-series moments this script replays for one event: strictly
 * between start and the recorded end (no progress rows exist past it), and
 * past the first `SKIP_FRACTION` of the event's NOMINAL duration.
 *
 * @param {{start_time: number, end_time: number}} event
 * @param {{bucket: number, points: number}[]} series ascending by bucket
 * @param {number} [deadline] nominal deadline; defaults to the recorded end
 * @param {number} [skipFraction] override for the warm-up skip (0 = keep all)
 * @returns {{bucket: number, points: number}[]}
 */
function eventMoments(
    event,
    series,
    deadline = event.end_time,
    skipFraction = SKIP_FRACTION,
) {
    const duration = deadline - event.start_time;
    const skipBefore = event.start_time + skipFraction * duration;
    return series.filter(
        (r) =>
            r.bucket > event.start_time &&
            r.bucket < event.end_time &&
            r.bucket > skipBefore,
    );
}

/**
 * Number of verdict changes between consecutive moments (bucket-ascending).
 *
 * @param {boolean[]} verdicts
 * @returns {number}
 */
function countFlips(verdicts) {
    let flips = 0;
    for (let i = 1; i < verdicts.length; i++) {
        if (verdicts[i] !== verdicts[i - 1]) flips++;
    }
    return flips;
}

/**
 * Events eligible for the margin sweep: completed defend/attack events with
 * >= MIN_PROGRESS_BUCKETS progress rows strictly between start and end.
 *
 * @param {object} ds dataset loaded with `{ eventProgress: true }`
 * @returns {{event: object, series: object[], deadline: number}[]}
 */
function qualifyingEvents(ds) {
    const out = [];
    for (const e of ds.events) {
        if (e.type !== 'defend' && e.type !== 'attack') continue;
        if (e.status !== 'success' && e.status !== 'fail') continue;
        const series = ds
            .eventProgressSeries(e.type, e.event_id)
            .filter((r) => r.bucket > e.start_time && r.bucket < e.end_time);
        if (series.length >= MIN_PROGRESS_BUCKETS) {
            out.push({ event: e, series, deadline: nominalDeadline(e) });
        }
    }
    return out;
}

/**
 * Sweep every margin over the pre-selected (event, moments) pairs and return
 * one summary row per margin.
 *
 * @param {{event: object, moments: object[], deadline: number}[]} replayed events
 *   with their post-skip moments already resolved (so every margin sees the
 *   identical moment set — only the verdict threshold changes)
 * @returns {{margin: number, accuracy: number, flipMedian: number, nEvents: number, nMoments: number}[]}
 */
function sweepMargins(replayed) {
    return MARGINS.map((margin) => {
        let correct = 0;
        let moments = 0;
        const flipsPerEvent = [];
        for (const { event, moments: series, deadline } of replayed) {
            const outcomeOnTrack = event.status === 'success';
            const verdicts = series.map((r) =>
                verdictAt(
                    r.points,
                    event.points_max,
                    event.start_time,
                    deadline,
                    r.bucket,
                    margin,
                ),
            );
            for (const v of verdicts) {
                moments++;
                if (v === outcomeOnTrack) correct++;
            }
            flipsPerEvent.push(countFlips(verdicts));
        }
        return {
            margin,
            accuracy: moments > 0 ? correct / moments : 0,
            flipMedian: quantileOf(flipsPerEvent, 0.5) ?? 0,
            // The median goes to zero long before flicker does — p90 is what
            // decides whether a margin is still buying hysteresis.
            flipP90: quantileOf(flipsPerEvent, 0.9) ?? 0,
            nEvents: replayed.length,
            nMoments: moments,
        };
    });
}

/**
 * Verdict accuracy at margin 0 binned by elapsed fraction of the NOMINAL
 * duration — the numbers behind the shipped MIN_ELAPSED_FRACTION gate and
 * the /docs/predict accuracy chart. Replays ALL moments (no warm-up skip)
 * so the below-gate bins show exactly the noise the gate hides.
 *
 * @param {{event: object, moments: object[], deadline: number}[]} replayed
 *   moment sets WITHOUT the warm-up skip
 * @param {number} binCount
 * @returns {{binStart: number, accuracy: number, n: number}[]} one row per
 *   non-empty bin; binStart is the bin's lower elapsed fraction
 */
function accuracyByElapsedBin(replayed, binCount = 10) {
    const correct = Array(binCount).fill(0);
    const total = Array(binCount).fill(0);
    for (const { event, moments, deadline } of replayed) {
        const outcomeOnTrack = event.status === 'success';
        const duration = deadline - event.start_time;
        for (const r of moments) {
            const frac = (r.bucket - event.start_time) / duration;
            const bin = Math.min(Math.floor(frac * binCount), binCount - 1);
            const v = verdictAt(
                r.points,
                event.points_max,
                event.start_time,
                deadline,
                r.bucket,
                0,
            );
            total[bin]++;
            if (v === outcomeOnTrack) correct[bin]++;
        }
    }
    return total
        .map((n, i) => ({
            binStart: i / binCount,
            accuracy: n > 0 ? correct[i] / n : 0,
            n,
        }))
        .filter((row) => row.n > 0);
}

/**
 * Smallest margin whose flip median is <= 1 and whose accuracy is within
 * `ACCURACY_TOLERANCE` of the best accuracy across the grid.
 *
 * @param {{margin: number, accuracy: number, flipMedian: number}[]} rows
 * @returns {number|null} null when no margin qualifies
 */
function recommendMargin(rows) {
    const bestAccuracy = Math.max(...rows.map((r) => r.accuracy));
    const qualifying = rows.filter(
        (r) => r.flipMedian <= 1 && bestAccuracy - r.accuracy <= ACCURACY_TOLERANCE,
    );
    if (qualifying.length === 0) return null;
    return Math.min(...qualifying.map((r) => r.margin));
}

// --- self-checks on the pure functions (no DB) ----------------------------
{
    const T = 100 * HOUR; // 100h event
    const pointsMax = 1000;

    // A perfectly linear event that reaches pointsMax exactly at end_time:
    // average rate since start is CONSTANT and exactly matches what's
    // needed, so etaHours == remainingHours at every instant. Every margin
    // >= 0 calls this onTrack, at every bucket — zero flips.
    const exactSeries = Array.from({ length: 20 }, (_, i) => {
        const t = ((i + 1) / 21) * T; // strictly inside (0, T)
        return { bucket: t, points: pointsMax * (t / T) };
    });
    const exactEvent = { start_time: 0, end_time: T, points_max: pointsMax };
    const exactMoments = eventMoments(exactEvent, exactSeries);
    assert(exactMoments.length > 3, 'exact-rate synthetic should have several moments');
    const exactVerdicts01 = exactMoments.map((r) =>
        verdictAt(r.points, pointsMax, 0, T, r.bucket, 0.1),
    );
    assert(
        exactVerdicts01.every((v) => v === true),
        'a perfectly on-schedule event must be onTrack at margin 0.1',
    );
    assert.equal(countFlips(exactVerdicts01), 0, 'on-schedule event must not flip');

    // An event accumulating at exactly HALF the required rate: it can never
    // catch up, so it must read as behind at every margin in the grid.
    const halfSeries = Array.from({ length: 20 }, (_, i) => {
        const t = ((i + 1) / 21) * T;
        return { bucket: t, points: 0.5 * pointsMax * (t / T) };
    });
    const halfMoments = eventMoments(exactEvent, halfSeries);
    assert(halfMoments.length > 3, 'half-rate synthetic should have several moments');
    for (const margin of MARGINS) {
        const verdicts = halfMoments.map((r) =>
            verdictAt(r.points, pointsMax, 0, T, r.bucket, margin),
        );
        assert(
            verdicts.every((v) => v === false),
            `half-rate event must read behind at margin ${margin}`,
        );
    }

    // eventMoments respects the 10% skip and the strict start/end bounds.
    const boundarySeries = [
        { bucket: 0, points: 0 }, // at start_time — excluded
        { bucket: 0.05 * T, points: 5 }, // inside the skip window — excluded
        { bucket: 0.5 * T, points: 500 }, // included
        { bucket: T, points: 1000 }, // at end_time — excluded
    ];
    const boundaryMoments = eventMoments(exactEvent, boundarySeries);
    assert.equal(
        boundaryMoments.length,
        1,
        'eventMoments must apply skip + strict bounds',
    );
    assert.equal(boundaryMoments[0].bucket, 0.5 * T);

    // nominalDeadline: a win's early end is snapped up to the timer it ran
    // against; a fail's recorded end already IS that timer.
    assert.equal(
        nominalDeadline({
            type: 'defend',
            status: 'success',
            start_time: 1000,
            end_time: 1000 + 129 * 60,
        }),
        1000 + 9000,
        'a won defend must replay against the 150-minute timer',
    );
    assert.equal(
        nominalDeadline({
            type: 'defend',
            status: 'fail',
            start_time: 1000,
            end_time: 1000 + 9000,
        }),
        1000 + 9000,
        'a failed defend keeps its recorded end',
    );
    assert.equal(
        nominalDeadline({
            type: 'attack',
            status: 'success',
            start_time: 0,
            end_time: 37 * HOUR,
        }),
        172800,
        'a won assault must replay against the 48h timeout',
    );
    // Longer than every known class (a 4-day defend) — fall back to as-recorded
    // rather than inventing a deadline the data cannot support.
    assert.equal(
        nominalDeadline({
            type: 'defend',
            status: 'success',
            start_time: 0,
            end_time: 200 * HOUR,
        }),
        200 * HOUR,
        'an over-long win falls back to its recorded duration',
    );

    // accuracyByElapsedBin: a half-rate FAILED event is verdict-correct
    // (behind) at every moment, so every non-empty bin reads accuracy 1; and
    // skipFraction 0 keeps the early moments the sweep drops.
    const halfAll = eventMoments(exactEvent, halfSeries, T, 0);
    assert(
        halfAll.length > halfMoments.length,
        'skipFraction 0 must include the warm-up moments',
    );
    const halfBins = accuracyByElapsedBin([
        {
            event: { ...exactEvent, status: 'fail' },
            moments: halfAll,
            deadline: T,
        },
    ]);
    assert(halfBins.length > 0, 'binning must produce non-empty bins');
    assert(
        halfBins.every((b) => b.accuracy === 1),
        'half-rate failed event is correct in every bin',
    );
    assert.equal(
        halfBins.reduce((s, b) => s + b.n, 0),
        halfAll.length,
        'every moment lands in exactly one bin',
    );

    // countFlips counts transitions, not raw verdict count.
    assert.equal(countFlips([true, true, true]), 0);
    assert.equal(countFlips([true, false, true]), 2);
    assert.equal(countFlips([]), 0);
    assert.equal(countFlips([true]), 0);

    // recommendMargin: the smallest margin meeting both bars.
    assert.equal(
        recommendMargin([
            { margin: 0, accuracy: 0.9, flipMedian: 3 },
            { margin: 0.05, accuracy: 0.9, flipMedian: 2 },
            { margin: 0.1, accuracy: 0.89, flipMedian: 1 },
            { margin: 0.2, accuracy: 0.7, flipMedian: 0 },
        ]),
        0.1,
    );
    assert.equal(
        recommendMargin([
            { margin: 0, accuracy: 0.5, flipMedian: 5 },
            { margin: 0.05, accuracy: 0.5, flipMedian: 4 },
        ]),
        null,
        'no margin under the flip bar must return null',
    );
}

// --- data --------------------------------------------------------------

const ds = await loadDataset({ eventProgress: true });
const qualifying = qualifyingEvents(ds);

const replayed = qualifying
    .map(({ event, series, deadline }) => ({
        event,
        deadline,
        moments: eventMoments(event, series, deadline),
    }))
    .filter((r) => r.moments.length > 0);

console.log('\n=== Script 14: event-verdict margin measurement ===\n');
console.log('  Rule (Task 7): onTrack = etaHours <= remainingHours * (1 + margin)');
console.log(
    '    etaHours = (points_max - points) / (points / (t - start_time)) / 3600\n',
);
console.log(
    `  Qualifying events: defend/attack, status success|fail, >= ${MIN_PROGRESS_BUCKETS} progress`,
);
console.log(
    `  buckets strictly between start/end. Replay skips the first ${SKIP_FRACTION * 100}% of`,
);
console.log('  each event (rate is meaningless immediately after start).\n');

console.log(`  qualifying events (progress-bucket floor):        ${qualifying.length}`);
console.log(`  events with >= 1 usable moment after the skip:    ${replayed.length}\n`);

if (replayed.length < MIN_QUALIFYING_EVENTS) {
    console.log(
        `  INSUFFICIENT DATA — only ${replayed.length} qualifying events (need >= ${MIN_QUALIFYING_EVENTS}).\n`,
    );
    console.log(`INSUFFICIENT DATA — use default ${DEFAULT_MARGIN}\n`);
    process.exit(0);
}

const rows = sweepMargins(replayed);

console.log('  margin   accuracy   flip median   flip p90   n events   n moments');
for (const r of rows) {
    console.log(
        `  ${r.margin.toFixed(2).padStart(5)}    ${(r.accuracy * 100).toFixed(1).padStart(5)}%     ` +
            `${r.flipMedian.toFixed(1).padStart(9)}  ${r.flipP90.toFixed(1).padStart(9)}     ` +
            `${String(r.nEvents).padStart(7)}    ${String(r.nMoments).padStart(8)}`,
    );
}

// Accuracy by elapsed decile at the shipped margin (0), warm-up included —
// the /docs/predict chart numbers and the case for the 25% render gate.
const replayedAll = qualifying
    .map(({ event, series, deadline }) => ({
        event,
        deadline,
        moments: eventMoments(event, series, deadline, 0),
    }))
    .filter((r) => r.moments.length > 0);
const bins = accuracyByElapsedBin(replayedAll);

console.log('\n  accuracy by elapsed decile (margin 0, no warm-up skip):');
console.log('  elapsed     accuracy   n moments');
for (const b of bins) {
    console.log(
        `  ${(b.binStart * 100).toFixed(0).padStart(3)}-${((b.binStart + 0.1) * 100).toFixed(0).padStart(3)}%     ${(b.accuracy * 100).toFixed(1).padStart(6)}%    ${String(b.n).padStart(8)}`,
    );
}

const recommended = recommendMargin(rows);

console.log('');
if (recommended === null) {
    console.log(`  No margin in the grid clears the flip-median <= 1 bar.`);
    console.log(`INSUFFICIENT DATA — use default ${DEFAULT_MARGIN}\n`);
} else {
    console.log(`RECOMMENDED VERDICT_MARGIN = ${recommended}\n`);
}
