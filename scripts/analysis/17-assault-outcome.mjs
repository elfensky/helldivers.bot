/**
 * 17-assault-outcome.mjs — the measurements attempt 5 needs before any model
 * is built (#486). Four questions, all descriptive:
 *
 * 1. P(fail | assault still running at elapsed e) — the outcome survival
 *    curve. Fail-resolved assaults ALWAYS run their full 48h
 *    (544/544, `14-counterattack-delta.mjs`); successes end early when their
 *    points fill (p50 37h). So "the assault is still running at elapsed e"
 *    is itself evidence about the outcome, observable in real time with no
 *    progress data at all — the longer an assault survives, the more of the
 *    success mass has been excluded. Full 925-attack history; first/second
 *    half split as a stability check.
 * 2. Does the LIVE pace verdict sharpen that? Replays the shipped
 *    `eventForecast.mjs` rule VERBATIM (average rate since event start,
 *    onTrack iff eta <= remaining * (1 + 0.2), skip the first 10% of the
 *    event — same replay discipline as `14-event-verdict-margin.mjs`)
 *    against attack events with h1_event_progress history. S157+ only —
 *    exploratory, n is thin, and the number is reported with that caveat.
 * 3. Clock resume-vs-restart: after a counterattack train ends, is the wait
 *    to the next free wave a FRESH end-anchored draw (same distribution as
 *    after a normal train) or shorter (a pre-assault draw resuming)?
 *    Same question after a SUCCESS-resolved assault (no counterattack).
 * 4. Counterattack trains vs normal trains: first-defend win rate, train
 *    length, train duration. They land on region 9 almost exclusively —
 *    if region shifts win rate, the chain-length distribution differs.
 *
 * No pre-registered pass/fail here — this script only measures; the
 * modelling decisions it feeds are pre-declared in
 * `18-outcome-composite.mjs`'s header, citing these numbers.
 *
 * Run: node --env-file=.env.development scripts/analysis/17-assault-outcome.mjs
 */

import assert from 'node:assert/strict';
import { loadDataset, HOUR } from './lib/dataset.mjs';
import { quantileOf } from './lib/backtest.mjs';

// The shipped verdict rule's constants — duplicated verbatim from
// src/features/dashboard/eventForecast.mjs / 14-event-verdict-margin.mjs
// (scripts cannot import src's `@/` alias).
const VERDICT_MARGIN = 0;
const SKIP_FRACTION = 0.25;
// A won assault's end_time is the moment its points filled, not the deadline
// it was racing — every assault runs a 48h timeout. Replaying a win against
// its own early end would hand it a deadline that never existed live. See
// trap 11 in docs/superpowers/predictions-handoff.md.
const ASSAULT_TIMEOUT = 48 * HOUR;
const MIN_PROGRESS_BUCKETS = 3;

// --- pure helpers ------------------------------------------------------------

/**
 * P(fail | assault still running at elapsed e), from resolved durations.
 * Every fail runs the full timeout, so all fails "survive" any e below it;
 * successes drop out as e passes their duration.
 *
 * @param {number[]} failDurH durations of fail-resolved assaults, hours
 * @param {number[]} succDurH durations of success-resolved assaults, hours
 * @param {number} e elapsed hours
 * @returns {{pFail: number, nAtRisk: number}}
 */
function pFailAt(failDurH, succDurH, e) {
    const failsAtRisk = failDurH.filter((d) => d > e).length;
    const succAtRisk = succDurH.filter((d) => d > e).length;
    const nAtRisk = failsAtRisk + succAtRisk;
    return { pFail: nAtRisk > 0 ? failsAtRisk / nAtRisk : NaN, nAtRisk };
}

/**
 * The shipped completion-verdict rule, verbatim (eventForecast.mjs).
 *
 * @param {number} points @param {number} pointsMax
 * @param {number} startTime @param {number} endTime @param {number} t
 * @returns {boolean} onTrack
 */
function verdictAt(points, pointsMax, startTime, endTime, t) {
    const elapsed = t - startTime;
    assert(elapsed > 0, 'verdictAt requires t after start');
    const rate = points / elapsed;
    const remaining = pointsMax - points;
    const etaHours = rate > 0 ? remaining / rate / HOUR : Infinity;
    const remainingHours = (endTime - t) / HOUR;
    return etaHours <= remainingHours * (1 + VERDICT_MARGIN);
}

/**
 * Descriptive line for an hours array.
 *
 * @param {number[]} xs
 * @returns {string}
 */
function distLine(xs) {
    if (xs.length === 0) return 'n=0';
    const mean = xs.reduce((a, b) => a + b, 0) / xs.length;
    const sd = Math.sqrt(xs.reduce((a, b) => a + (b - mean) ** 2, 0) / xs.length);
    return (
        `n=${xs.length}  p05=${quantileOf(xs, 0.05).toFixed(1)}  p25=${quantileOf(xs, 0.25).toFixed(1)}  ` +
        `p50=${quantileOf(xs, 0.5).toFixed(1)}  p75=${quantileOf(xs, 0.75).toFixed(1)}  ` +
        `p95=${quantileOf(xs, 0.95).toFixed(1)}  mean=${mean.toFixed(1)}  CV=${(sd / mean).toFixed(3)}`
    );
}

/**
 * Two-sample KS distance between empirical distributions.
 *
 * @param {number[]} a @param {number[]} b
 * @returns {number}
 */
function ks2(a, b) {
    const sa = [...a].sort((x, y) => x - y);
    const sb = [...b].sort((x, y) => x - y);
    let i = 0;
    let j = 0;
    let d = 0;
    while (i < sa.length && j < sb.length) {
        // Advance past ties on BOTH sides before comparing CDFs, otherwise
        // identical samples read as maximally different mid-tie.
        if (sa[i] < sb[j]) {
            i++;
        } else if (sb[j] < sa[i]) {
            j++;
        } else {
            const v = sa[i];
            while (i < sa.length && sa[i] === v) i++;
            while (j < sb.length && sb[j] === v) j++;
        }
        d = Math.max(d, Math.abs(i / sa.length - j / sb.length));
    }
    return d;
}

// --- pure self-checks (no DB) ------------------------------------------------

{
    // pFailAt: 2 fails (both run to 48) + 2 successes at 10h and 30h.
    const fails = [48, 48];
    const succ = [10, 30];
    assert.equal(pFailAt(fails, succ, 0).pFail, 0.5);
    assert.equal(pFailAt(fails, succ, 20).pFail, 2 / 3, 'one success dropped out');
    assert.equal(pFailAt(fails, succ, 40).pFail, 1, 'all successes ended');
    assert.equal(pFailAt([], [], 0).nAtRisk, 0);
}

{
    // verdictAt: halfway through with half the points is on track; with a
    // fifth of the points it is not (margin 0.2 gives budget 1.2x).
    const S = 1000;
    const E = S + 48 * 3600;
    const mid = S + 24 * 3600;
    assert.equal(verdictAt(500, 1000, S, E, mid), true, 'half points halfway');
    assert.equal(verdictAt(200, 1000, S, E, mid), false, 'fifth of points halfway');
    assert.equal(verdictAt(0, 1000, S, E, mid), false, 'zero rate is behind');
}

{
    // ks2: identical samples 0; disjoint samples 1; a known shift fixture.
    assert.equal(ks2([1, 2, 3], [1, 2, 3]), 0, 'identical samples');
    assert.equal(ks2([1, 2, 3], [10, 20, 30]), 1, 'disjoint samples');
    assert.equal(ks2([1, 2], [1, 2, 3, 4]), 0.5, 'shift fixture');
}

console.log('=== 17-assault-outcome: pure self-checks OK ===');

// --- data --------------------------------------------------------------------

const ds = await loadDataset({ eventProgress: true });
const attacks = ds.events.filter((e) => e.type === 'attack');
const allDefends = ds.events.filter((e) => e.type === 'defend');

const failDurH = attacks
    .filter((a) => a.status === 'fail')
    .map((a) => (a.end_time - a.start_time) / HOUR);
const succDurH = attacks
    .filter((a) => a.status === 'success')
    .map((a) => (a.end_time - a.start_time) / HOUR);
assert(failDurH.length > 500 && succDurH.length > 300, 'expected resolved assaults');

// --- 1. outcome survival curve ----------------------------------------------

console.log('\n=== 1. P(fail | assault still running at elapsed e) ===');
console.log(`resolved assaults: fail=${failDurH.length}  success=${succDurH.length}`);
console.log(`success durations: ${distLine(succDurH)}`);
const seasonsSorted = [...new Set(attacks.map((a) => a.season))].sort((a, b) => a - b);
const midSeason = seasonsSorted[Math.floor(seasonsSorted.length / 2)];
const firstHalf = attacks.filter((a) => a.season < midSeason);
const secondHalf = attacks.filter((a) => a.season >= midSeason);
const halfDur = (list, status) =>
    list
        .filter((a) => a.status === status)
        .map((a) => (a.end_time - a.start_time) / HOUR);
console.log('  elapsed   P(fail)   n at risk   [first half | second half]');
for (const e of [0, 6, 12, 18, 24, 30, 36, 40, 44, 46, 47]) {
    const all = pFailAt(failDurH, succDurH, e);
    const h1 = pFailAt(halfDur(firstHalf, 'fail'), halfDur(firstHalf, 'success'), e);
    const h2 = pFailAt(halfDur(secondHalf, 'fail'), halfDur(secondHalf, 'success'), e);
    console.log(
        `  ${String(e).padStart(4)}h     ${all.pFail.toFixed(3)}     ${String(all.nAtRisk).padStart(4)}       [${h1.pFail.toFixed(3)} | ${h2.pFail.toFixed(3)}]`,
    );
}

// --- 2. live pace verdict vs outcome (S157+, exploratory) ---------------------

console.log('\n=== 2. verdict conditioning (S157+ h1_event_progress, EXPLORATORY) ===');
{
    const qualifying = attacks.filter((a) => {
        if (a.status !== 'fail' && a.status !== 'success') return false;
        const series = ds
            .eventProgressSeries('attack', a.event_id)
            .filter((r) => r.time > a.start_time && r.time < a.end_time);
        return series.length >= MIN_PROGRESS_BUCKETS;
    });
    console.log(`qualifying attacks with progress history: ${qualifying.length}`);
    // Per elapsed-fraction bin: P(fail | onTrack) vs P(fail | behind).
    const bins = [
        [0.1, 0.35],
        [0.35, 0.6],
        [0.6, 0.85],
        [0.85, 1.0],
    ];
    for (const [lo, hi] of bins) {
        let onTrackFail = 0;
        let onTrackN = 0;
        let behindFail = 0;
        let behindN = 0;
        for (const a of qualifying) {
            const deadline = a.start_time + ASSAULT_TIMEOUT;
            const dur = ASSAULT_TIMEOUT;
            const series = ds
                .eventProgressSeries('attack', a.event_id)
                .filter((r) => r.time > a.start_time && r.time < a.end_time);
            for (const r of series) {
                const frac = (r.time - a.start_time) / dur;
                if (frac < Math.max(lo, SKIP_FRACTION) || frac >= hi) continue;
                const onTrack = verdictAt(
                    Number(r.points),
                    Number(a.points_max),
                    a.start_time,
                    deadline,
                    r.time,
                );
                if (onTrack) {
                    onTrackN++;
                    if (a.status === 'fail') onTrackFail++;
                } else {
                    behindN++;
                    if (a.status === 'fail') behindFail++;
                }
            }
        }
        const pOn = onTrackN > 0 ? (onTrackFail / onTrackN).toFixed(3) : 'n/a';
        const pBe = behindN > 0 ? (behindFail / behindN).toFixed(3) : 'n/a';
        console.log(
            `  elapsed ${(lo * 100).toFixed(0)}-${(hi * 100).toFixed(0)}%: P(fail|onTrack)=${pOn} (n=${onTrackN})   P(fail|behind)=${pBe} (n=${behindN})`,
        );
    }
    console.log(
        '  (moment-level counts, autocorrelated within events — read direction, not precision)',
    );
}

// --- trains (shared by 3 and 4) ----------------------------------------------

const trainsBySeason = new Map();
for (const season of new Set(allDefends.map((e) => e.season))) {
    const trains = [];
    for (const enemy of [0, 1, 2]) {
        const defends = allDefends.filter(
            (e) => e.season === season && e.enemy === enemy,
        );
        for (const d of defends) {
            if (d.isTrainStart) {
                trains.push({
                    season,
                    enemy,
                    s: d.start_time,
                    e: d.end_time,
                    startEvent: d,
                    defends: [d],
                });
            } else {
                const tr = trains.at(-1);
                tr.e = d.end_time;
                tr.defends.push(d);
            }
        }
    }
    trains.sort((a, b) => a.s - b.s);
    trainsBySeason.set(season, trains);
}

// --- 3. clock resume vs restart ----------------------------------------------

console.log('\n=== 3. post-epoch draw: fresh or resumed? ===');
{
    // Gap from a train's end to the NEXT train start, split by what kind of
    // train just ended and whether the next start is itself a counterattack.
    const afterNormal = [];
    const afterCounter = [];
    for (const [, trains] of trainsBySeason) {
        for (let i = 1; i < trains.length; i++) {
            if (trains[i].startEvent.isCounterattack) continue; // target must be a free wave
            const gapH = (trains[i].s - trains[i - 1].e) / HOUR;
            if (gapH <= 0) continue;
            (trains[i - 1].startEvent.isCounterattack ? afterCounter : afterNormal).push(
                gapH,
            );
        }
    }
    console.log(`  free wave after a NORMAL train end:        ${distLine(afterNormal)}`);
    console.log(`  free wave after a COUNTERATTACK train end: ${distLine(afterCounter)}`);
    console.log(
        `  two-sample KS distance: ${ks2(afterNormal, afterCounter).toFixed(3)} ` +
            '(small => same distribution => fresh end-anchored draw after the counterattack train)',
    );

    // After a SUCCESS-resolved assault there is no counterattack: measure the
    // gap from the assault's end to the next free wave. A fresh full draw
    // anchored at the success would look like the free-lull distribution;
    // remaining-of-a-paused-draw would look shorter.
    const afterSuccess = [];
    for (const a of attacks) {
        if (a.status !== 'success') continue;
        const trains = trainsBySeason.get(a.season) ?? [];
        const next = trains.find(
            (tr) => tr.s >= a.end_time && !tr.startEvent.isCounterattack,
        );
        if (next) afterSuccess.push((next.s - a.end_time) / HOUR);
    }
    console.log(`  free wave after a SUCCESS assault end:     ${distLine(afterSuccess)}`);
    console.log(
        `  KS vs after-normal-train: ${ks2(afterNormal, afterSuccess).toFixed(3)}`,
    );
}

// --- 4. counterattack trains vs normal trains ---------------------------------

console.log('\n=== 4. counterattack trains vs normal trains ===');
{
    const counter = [];
    const normal = [];
    for (const [, trains] of trainsBySeason) {
        for (const tr of trains) {
            (tr.startEvent.isCounterattack ? counter : normal).push(tr);
        }
    }
    for (const [label, list] of [
        ['counterattack', counter],
        ['normal       ', normal],
    ]) {
        const lengths = list.map((tr) => tr.defends.length);
        const durH = list.map((tr) => (tr.e - tr.s) / HOUR);
        const firstWin =
            list.filter((tr) => tr.defends[0].status === 'success').length / list.length;
        const singleShare = lengths.filter((n) => n === 1).length / lengths.length;
        console.log(
            `  ${label}: n=${list.length}  first-defend win rate=${firstWin.toFixed(3)}  ` +
                `single-defend trains=${(singleShare * 100).toFixed(1)}%  ` +
                `length p50=${quantileOf(lengths, 0.5)}  p95=${quantileOf(lengths, 0.95)}`,
        );
        console.log(`  ${label}  duration (h): ${distLine(durH)}`);
    }
    assert(counter.length > 400, 'expected the counterattack train population');
}
