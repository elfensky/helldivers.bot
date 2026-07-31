/**
 * 14-counterattack-delta.mjs — is the counterattack DELAY mechanical?
 *
 * `12-faction-choice.mjs` established the counterattack RULE: every
 * fail-resolved homeworld assault is followed by a defend wave on that same
 * faction (179/179). That rule fixes the FACTION of the next wave; this
 * script asks whether it also fixes the TIMING — the Discord hypothesis
 * ("the cooldown to attack is always the same, but the defend event just
 * waits for an appropriate time to begin"). If the delay from attack end to
 * counterattack start is (near-)constant, counterattack trains are
 * mechanically scheduled — the project's third target mis-specification —
 * and must be excluded from the forecasting series (see
 * `15-counterattack-target.mjs`).
 *
 * PRE-REGISTERED MECHANICAL CRITERION — stated here, before any delta was
 * computed, and held to: the counterattack delay is MECHANICAL iff, on the
 * SLOT-FREE subset (no defend train occupying the global defend slot at
 * attack end, and no second counterattack pending), delta_raw =
 * (counterattack train start − attack end) satisfies CV < 0.25 OR
 * (p95 − p05) < 6h. Evaluated on that subset ONLY — the global one-defend
 * slot means queued cases smear a real mechanic into a fake pooled
 * distribution (handoff trap 6), so the pooled histogram is never the
 * headline number.
 *
 * Also measured, because the Discord thread and the Steam guide
 * (steamcommunity.com/sharedfiles/filedetails/?id=3764548664) raise them:
 *   - the concurrency table (defend-defend, defend-attack same/cross
 *     faction, attack-attack, boundary-moment compositions, max
 *     simultaneous events) — session-probe numbers reproduced by committed
 *     code;
 *   - assault durations by outcome (guide: attacks run 48h or until points
 *     met — a fail-resolved assault would then be a deterministic 48h
 *     timeout, sharpening any SC9 → assault → counterattack pipeline);
 *   - defend durations (guide: 2h30m, Super Earth 48h);
 *   - defend-hazard gating (guide: random defends cannot TRIGGER while an
 *     assault is active, only counter-offensive ones) — start counts and
 *     exposure-time hazard rates in attack-active vs attack-free lull time;
 *   - counterattack train regions (guide: counter-offensive lands on
 *     sector 9).
 *
 * Event times only (`h1_event`, second-resolution) — never `h1_status`
 * buckets (~daily for 156/160 seasons; handoff trap 4).
 *
 * Run: node --env-file=.env.development scripts/analysis/14-counterattack-delta.mjs
 */

import assert from 'node:assert/strict';
import { loadDataset, HOUR } from './lib/dataset.mjs';
import { quantileOf } from './lib/backtest.mjs';

// --- pure helpers ------------------------------------------------------------

/**
 * Two half-open intervals [aS, aE) and [bS, bE) overlap strictly.
 *
 * @param {number} aS @param {number} aE @param {number} bS @param {number} bE
 * @returns {boolean}
 */
function overlaps(aS, aE, bS, bE) {
    return aS < bE && bS < aE;
}

/**
 * Descriptive stats of an hours array.
 *
 * @param {number[]} xs
 * @returns {{n: number, min: number, p05: number, p25: number, p50: number,
 *   p75: number, p95: number, mean: number, sd: number, cv: number}|null}
 */
function statsOf(xs) {
    if (xs.length === 0) return null;
    const mean = xs.reduce((a, b) => a + b, 0) / xs.length;
    const sd = Math.sqrt(xs.reduce((a, b) => a + (b - mean) ** 2, 0) / xs.length);
    return {
        n: xs.length,
        min: Math.min(...xs),
        p05: quantileOf(xs, 0.05),
        p25: quantileOf(xs, 0.25),
        p50: quantileOf(xs, 0.5),
        p75: quantileOf(xs, 0.75),
        p95: quantileOf(xs, 0.95),
        mean,
        sd,
        cv: mean > 0 ? sd / mean : NaN,
    };
}

/**
 * One-line rendering of statsOf output.
 *
 * @param {ReturnType<typeof statsOf>} s
 * @returns {string}
 */
function statsLine(s) {
    if (s === null) return 'n=0';
    return (
        `n=${s.n}  min=${s.min.toFixed(2)}h  p05=${s.p05.toFixed(1)}h  ` +
        `p25=${s.p25.toFixed(1)}h  p50=${s.p50.toFixed(1)}h  p75=${s.p75.toFixed(1)}h  ` +
        `p95=${s.p95.toFixed(1)}h  CV=${s.cv.toFixed(3)}`
    );
}

/**
 * ASCII histogram of an hours array in `binH`-hour bins.
 *
 * @param {number[]} xs
 * @param {number} binH bin width in hours
 * @param {number} capH values >= capH collapse into one overflow bin
 * @returns {string[]} printable lines
 */
function histogramLines(xs, binH, capH) {
    const bins = new Map();
    let over = 0;
    for (const x of xs) {
        if (x >= capH) over++;
        else {
            const b = Math.floor(x / binH) * binH;
            bins.set(b, (bins.get(b) ?? 0) + 1);
        }
    }
    const maxCount = Math.max(over, ...bins.values(), 1);
    const lines = [];
    for (const b of [...bins.keys()].sort((a, z) => a - z)) {
        const c = bins.get(b);
        lines.push(
            `  ${String(b).padStart(4)}-${String(b + binH).padEnd(4)}h ${String(c).padStart(4)} ${'#'.repeat(Math.max(1, Math.round((c / maxCount) * 50)))}`,
        );
    }
    if (over > 0)
        lines.push(`  >=${String(capH).padEnd(6)}h ${String(over).padStart(4)}`);
    return lines;
}

/**
 * Total length of the union of intervals, clipped to [lo, hi).
 *
 * @param {{s: number, e: number}[]} intervals
 * @param {number} lo @param {number} hi
 * @returns {number} seconds
 */
function unionOverlapSeconds(intervals, lo, hi) {
    const clipped = intervals
        .map((iv) => ({ s: Math.max(iv.s, lo), e: Math.min(iv.e, hi) }))
        .filter((iv) => iv.e > iv.s)
        .sort((a, b) => a.s - b.s);
    let total = 0;
    let curS = null;
    let curE = null;
    for (const iv of clipped) {
        if (curE === null || iv.s > curE) {
            if (curE !== null) total += curE - curS;
            curS = iv.s;
            curE = iv.e;
        } else if (iv.e > curE) {
            curE = iv.e;
        }
    }
    if (curE !== null) total += curE - curS;
    return total;
}

/**
 * Group a (season, enemy)'s defends into trains using the dataset's
 * `isTrainStart` labels. A train occupies the global defend slot from its
 * first defend's start to its last defend's end (chain gaps <= 600s are
 * inside the train, so the interval covers them).
 *
 * @param {object[]} defends one (season, enemy)'s defends, start-ascending,
 *   each carrying `isTrainStart`
 * @returns {{season: number, enemy: number, region: number, s: number,
 *   e: number, startEvent: object}[]}
 */
function buildTrains(defends) {
    const trains = [];
    for (const d of defends) {
        if (d.isTrainStart) {
            trains.push({
                season: d.season,
                enemy: d.enemy,
                region: d.region,
                s: d.start_time,
                e: d.end_time,
                startEvent: d,
            });
        } else {
            trains.at(-1).e = d.end_time;
        }
    }
    return trains;
}

/**
 * Classify every fail-resolved assault by the state of the global defend
 * slot at its end, and measure its counterattack delta. Pure so the fixture
 * below can pin the classification logic without a DB.
 *
 * Slot state at attack end T:
 *   FREE      — no train interval covers T
 *   OCCUPIED  — another train's [s, e) covers T (defend-attack co-runs are
 *               always cross-faction, verified below)
 * Double-queue: another fail-resolved assault's pending window
 * (its end, its counterattack start] overlaps this one's — two
 * counterattacks waiting on the single slot.
 *
 * @param {object[]} failedAttacks fail-resolved attack events
 * @param {ReturnType<typeof buildTrains>[]} trainsBySeason map-backed arrays
 *   per season, start-ascending (ALL factions pooled)
 * @returns {object[]} one record per failed assault
 */
function classifyCounterattacks(failedAttacks, trainsBySeason) {
    const records = failedAttacks.map((a) => {
        const seasonTrains = trainsBySeason.get(a.season) ?? [];
        const counter = seasonTrains.find(
            (tr) => tr.enemy === a.enemy && tr.s >= a.end_time,
        );
        const nextGlobal = seasonTrains.find((tr) => tr.s >= a.end_time);
        const occupying = seasonTrains.find(
            (tr) => tr.s <= a.end_time && tr.e > a.end_time,
        );
        const record = {
            attack: a,
            counter,
            censored: counter === undefined,
            nextGlobalIsCounter: counter !== undefined && nextGlobal === counter,
            occupying: occupying ?? null,
            deltaRawH: counter ? (counter.s - a.end_time) / HOUR : null,
            deltaQueueH: counter && occupying ? (counter.s - occupying.e) / HOUR : null,
            // Trains (other than the counterattack itself) that START inside
            // the pending window — each one preempts the waiting counterattack.
            intervening:
                counter ?
                    seasonTrains.filter(
                        (tr) => tr !== counter && tr.s >= a.end_time && tr.s < counter.s,
                    ).length
                :   0,
            doubleQueued: false,
        };
        return record;
    });

    for (const r of records) {
        if (r.censored) continue;
        r.doubleQueued = records.some(
            (o) =>
                o !== r &&
                !o.censored &&
                o.attack.season === r.attack.season &&
                overlaps(o.attack.end_time, o.counter.s, r.attack.end_time, r.counter.s),
        );
    }
    return records;
}

// --- pure self-checks (no DB) ------------------------------------------------

{
    assert(overlaps(0, 10, 5, 15) && !overlaps(0, 10, 10, 20), 'overlaps fixture');

    const s = statsOf([10, 20, 30, 40]);
    assert.equal(s.p50, 25);
    assert.equal(s.mean, 25);
    assert(Math.abs(s.cv - Math.sqrt(125) / 25) < 1e-12, 'statsOf CV');
    assert.equal(statsOf([]), null);

    // unionOverlapSeconds merges overlapping intervals and clips.
    assert.equal(
        unionOverlapSeconds(
            [
                { s: 0, e: 10 },
                { s: 5, e: 20 },
                { s: 30, e: 40 },
            ],
            0,
            35,
        ),
        25,
        'union of [0,20) + [30,35) is 25',
    );
    assert.equal(unionOverlapSeconds([], 0, 100), 0);
}

{
    // buildTrains: two trains, the chained defend extends the first interval.
    const H = 3600;
    const mk = (s, e, isTrainStart) => ({
        season: 1,
        enemy: 0,
        region: 5,
        start_time: s,
        end_time: e,
        isTrainStart,
    });
    const trains = buildTrains([
        mk(0, 2 * H, true),
        mk(2 * H + 300, 4 * H, false), // chained (300s gap)
        mk(40 * H, 42 * H, true),
    ]);
    assert.equal(trains.length, 2);
    assert.deepEqual([trains[0].s, trains[0].e], [0, 4 * H]);
    assert.deepEqual([trains[1].s, trains[1].e], [40 * H, 42 * H]);
}

{
    // classifyCounterattacks fixture: a synthetic season exercising FREE,
    // OCCUPIED (with delta_queue), censored, and double-queue paths.
    const H = 3600;
    const train = (enemy, s, e) => ({
        season: 1,
        enemy,
        region: 9,
        s: s * H,
        e: e * H,
        startEvent: null,
    });
    const attack = (enemy, s, e) => ({
        season: 1,
        enemy,
        status: 'fail',
        start_time: s * H,
        end_time: e * H,
    });

    // Timeline (hours):
    //   attack A (enemy 0) ends at 10, slot free, counter train at 16 -> delta 6
    //   train (enemy 1) runs 30-35; attack B (enemy 0) ends at 32 while it
    //     occupies the slot; counter at 37 -> delta_raw 5, delta_queue 2
    //   attack C (enemy 2) ends at 60, no later enemy-2 train -> censored
    const trains1 = [train(0, 16, 18), train(1, 30, 35), train(0, 37, 39)];
    const recs = classifyCounterattacks(
        [attack(0, 2, 10), attack(0, 20, 32), attack(2, 50, 60)],
        new Map([[1, trains1]]),
    );
    assert.equal(recs[0].occupying, null, 'A ends slot-free');
    assert.equal(recs[0].deltaRawH, 6);
    assert.equal(recs[0].intervening, 0);
    assert(recs[0].nextGlobalIsCounter, 'A next global train is its counter');
    assert(recs[1].occupying !== null, 'B ends while enemy-1 train occupies');
    assert.equal(recs[1].deltaRawH, 5);
    assert.equal(recs[1].deltaQueueH, 2);
    assert(recs[2].censored, 'C has no later same-faction train');
    assert(!recs[0].doubleQueued && !recs[1].doubleQueued, 'A,B windows disjoint');

    // Double-queue: two failed assaults whose pending windows overlap.
    const trains2 = [train(0, 20, 22), train(1, 26, 28)];
    const recs2 = classifyCounterattacks(
        [attack(0, 2, 10), attack(1, 3, 12)],
        new Map([[1, trains2]]),
    );
    assert(recs2[0].doubleQueued && recs2[1].doubleQueued, 'both pending at once');
    assert.equal(recs2[1].intervening, 1, 'enemy-1 counter is preempted once');
}

console.log('=== 14-counterattack-delta: pure self-checks OK ===');

// --- data --------------------------------------------------------------------

const ds = await loadDataset();
const allDefends = ds.events.filter((e) => e.type === 'defend');
const attacks = ds.events.filter((e) => e.type === 'attack');

const eventsBySeason = new Map();
for (const e of ds.events) {
    if (!eventsBySeason.has(e.season)) eventsBySeason.set(e.season, []);
    eventsBySeason.get(e.season).push(e);
}

// --- concurrency verification (the Discord thread gets exact numbers) --------

console.log('\n=== CONCURRENCY (full history, committed reproduction) ===');
let ddPairs = 0;
let ddOverlap = 0;
let daSamePairs = 0;
let daSameOverlap = 0;
let daCrossPairs = 0;
let daCrossOverlap = 0;
let aaPairs = 0;
let aaOverlap = 0;
for (const [, list] of eventsBySeason) {
    for (let i = 0; i < list.length; i++) {
        for (let j = i + 1; j < list.length; j++) {
            const a = list[i];
            const b = list[j];
            const ov = overlaps(a.start_time, a.end_time, b.start_time, b.end_time);
            if (a.type === 'defend' && b.type === 'defend') {
                ddPairs++;
                if (ov) ddOverlap++;
            } else if (a.type === 'attack' && b.type === 'attack') {
                aaPairs++;
                if (ov) aaOverlap++;
            } else if (a.enemy === b.enemy) {
                daSamePairs++;
                if (ov) daSameOverlap++;
            } else {
                daCrossPairs++;
                if (ov) daCrossOverlap++;
            }
        }
    }
}
console.log(`  defend-defend:               ${ddOverlap} of ${ddPairs} pairs overlap`);
console.log(
    `  defend-attack SAME faction:  ${daSameOverlap} of ${daSamePairs} pairs overlap`,
);
console.log(
    `  defend-attack CROSS faction: ${daCrossOverlap} of ${daCrossPairs} pairs overlap`,
);
console.log(`  attack-attack:               ${aaOverlap} of ${aaPairs} pairs overlap`);
assert.equal(ddOverlap, 0, 'two defends must never co-run');
assert.equal(daSameOverlap, 0, 'a defend never co-runs with a same-faction attack');
assert(daCrossOverlap >= 955, `cross-faction co-runs regressed: ${daCrossOverlap}`);
assert(aaOverlap >= 375, `attack-attack co-runs regressed: ${aaOverlap}`);

// Boundary-moment compositions: at every event start, what is running?
let tripleAssault = 0;
let twoAtkOneDef = 0;
let maxSimultaneous = 0;
let firstTriple = null;
let firstTwoOne = null;
for (const [season, list] of eventsBySeason) {
    for (const e of list) {
        const t = e.start_time;
        const active = list.filter((x) => x.start_time <= t && x.end_time > t);
        const nAtk = active.filter((x) => x.type === 'attack').length;
        const nDef = active.filter((x) => x.type === 'defend').length;
        maxSimultaneous = Math.max(maxSimultaneous, active.length);
        assert(nDef <= 1, `two defends active at once in season ${season}`);
        if (nAtk === 3) {
            tripleAssault++;
            firstTriple ??= season;
        }
        if (nAtk === 2 && nDef === 1) {
            twoAtkOneDef++;
            firstTwoOne ??= season;
        }
    }
}
console.log(
    `  boundary moments: 3 simultaneous assaults ${tripleAssault} (first S${firstTriple}), ` +
        `2 attacks + 1 defend ${twoAtkOneDef} (first S${firstTwoOne}), max simultaneous ${maxSimultaneous}`,
);
assert(tripleAssault >= 53, `triple-assault moments regressed: ${tripleAssault}`);
assert(twoAtkOneDef >= 129, `2+1 moments regressed: ${twoAtkOneDef}`);
assert(maxSimultaneous >= 3, 'expected max simultaneous >= 3');

// --- trains and failed assaults ----------------------------------------------

const trainsBySeason = new Map();
for (const [season, list] of eventsBySeason) {
    const trains = [];
    for (const enemy of [0, 1, 2]) {
        trains.push(
            ...buildTrains(list.filter((e) => e.type === 'defend' && e.enemy === enemy)),
        );
    }
    trains.sort((a, b) => a.s - b.s);
    trainsBySeason.set(season, trains);
}
const trainCount = [...trainsBySeason.values()].reduce((a, l) => a + l.length, 0);
const trainStartCount = allDefends.filter((e) => e.isTrainStart).length;
assert.equal(trainCount, trainStartCount, 'one train per isTrainStart label');

const statusCounts = new Map();
for (const a of attacks)
    statusCounts.set(a.status, (statusCounts.get(a.status) ?? 0) + 1);
console.log(
    `\nattacks by final status: ${[...statusCounts.entries()].map(([k, v]) => `${k}=${v}`).join('  ')}`,
);
const failedAttacks = attacks.filter((a) => a.status === 'fail');
const records = classifyCounterattacks(failedAttacks, trainsBySeason);

// --- the delta, slot-aware ---------------------------------------------------

const censored = records.filter((r) => r.censored);
const live = records.filter((r) => !r.censored);
const dq = live.filter((r) => r.doubleQueued);
const slotFree = live.filter((r) => !r.doubleQueued && r.occupying === null);
const slotOcc = live.filter((r) => !r.doubleQueued && r.occupying !== null);

console.log('\n=== COUNTERATTACK DELTA (attack end -> same-faction train start) ===');
console.log(
    `fail-resolved assaults: ${records.length}  matched=${live.length}  ` +
        `censored (no later same-faction train, season truncation)=${censored.length}`,
);
const nextGlobalHits = live.filter((r) => r.nextGlobalIsCounter).length;
console.log(
    `next GLOBAL train start is the counterattack: ${nextGlobalHits}/${live.length} = ${(nextGlobalHits / live.length).toFixed(4)}`,
);

console.log(`\n(a) SLOT FREE at attack end, no double-queue (n=${slotFree.length}):`);
const freeDeltas = slotFree.map((r) => r.deltaRawH);
const freeStats = statsOf(freeDeltas);
console.log(`  delta_raw: ${statsLine(freeStats)}`);
const freePreempted = slotFree.filter((r) => r.intervening > 0);
console.log(
    `  preempted (another faction's train started inside the pending window): ${freePreempted.length}`,
);
if (freePreempted.length > 0) {
    console.log(
        `  delta_raw, unpreempted only: ${statsLine(statsOf(slotFree.filter((r) => r.intervening === 0).map((r) => r.deltaRawH)))}`,
    );
}
// Timestamp-granularity breakdown: if every delta were EXACTLY 0 seconds the
// "immediacy" could be an event-sourcing artifact (attack end and defend
// start written from the same poll frame) rather than a measured mechanic; a
// spread over minutes is what a real immediate-fire looks like through a
// polled event log.
{
    const exact0 = slotFree.filter((r) => r.deltaRawH === 0).length;
    const under10m = slotFree.filter(
        (r) => r.deltaRawH > 0 && r.deltaRawH <= 1 / 6,
    ).length;
    const under2h = slotFree.filter((r) => r.deltaRawH > 1 / 6 && r.deltaRawH < 2).length;
    console.log(
        `  granularity: exactly 0s ${exact0}, (0, 10min] ${under10m}, (10min, 2h) ${under2h}, >=2h ${slotFree.length - exact0 - under10m - under2h}`,
    );
}
console.log('  histogram (2h bins):');
for (const line of histogramLines(freeDeltas, 2, 96)) console.log(line);

console.log(`\n(b) SLOT OCCUPIED at attack end, no double-queue (n=${slotOcc.length}):`);
console.log(`  delta_raw  : ${statsLine(statsOf(slotOcc.map((r) => r.deltaRawH)))}`);
console.log(
    `  delta_queue (counter start - occupying train end): ${statsLine(statsOf(slotOcc.map((r) => r.deltaQueueH)))}`,
);
const occPreempted = slotOcc.filter((r) => r.intervening > 0);
console.log(`  preempted inside the pending window: ${occPreempted.length}`);
if (slotOcc.length > 0) {
    console.log('  delta_queue histogram (2h bins):');
    for (const line of histogramLines(
        slotOcc.map((r) => r.deltaQueueH),
        2,
        96,
    )) {
        console.log(line);
    }
}

console.log(`\n(c) DOUBLE-QUEUED (overlapping pending windows, n=${dq.length}):`);
if (dq.length > 0) {
    console.log(`  delta_raw: ${statsLine(statsOf(dq.map((r) => r.deltaRawH)))}`);
}

// --- assault durations (Discord decomposition + guide claim) ------------------

console.log('\n=== ASSAULT DURATION (end - start) by final status ===');
for (const status of ['fail', 'success']) {
    const durs = attacks
        .filter((a) => a.status === status)
        .map((a) => (a.end_time - a.start_time) / HOUR);
    const st = statsOf(durs);
    const near48 = durs.filter((d) => Math.abs(d - 48) <= 0.5).length;
    console.log(`  ${status.padEnd(7)}: ${statsLine(st)}`);
    console.log(
        `           within 48h±30min: ${near48}/${durs.length} = ${(near48 / Math.max(1, durs.length)).toFixed(4)}`,
    );
}

// --- defend durations (guide claim: 2h30m; Super Earth 48h) -------------------

console.log('\n=== DEFEND DURATION (end - start) ===');
{
    const durs = allDefends.map((e) => (e.end_time - e.start_time) / HOUR);
    const st = statsOf(durs);
    const near25 = durs.filter((d) => Math.abs(d - 2.5) <= 0.1).length;
    console.log(`  all defends: ${statsLine(st)}`);
    console.log(
        `  within 2h30m±6min: ${near25}/${durs.length} = ${(near25 / durs.length).toFixed(4)}`,
    );
    const byRegion = new Map();
    for (const e of allDefends) {
        if (!byRegion.has(e.region)) byRegion.set(e.region, []);
        byRegion.get(e.region).push((e.end_time - e.start_time) / HOUR);
    }
    for (const region of [...byRegion.keys()].sort((a, b) => a - b)) {
        const rs = statsOf(byRegion.get(region));
        console.log(`  region ${String(region).padStart(2)}: ${statsLine(rs)}`);
    }
}

// --- defend-hazard gating during assaults (guide claim) -----------------------

console.log('\n=== TRAIN STARTS WHILE AN ASSAULT IS ACTIVE (guide gating claim) ===');
{
    const counterStartSet = new Set(
        live.map((r) => r.counter.startEvent).filter((e) => e !== null),
    );
    let duringAttack = 0;
    let duringAttackCounter = 0;
    let starts = 0;
    let lullAttackSec = 0;
    let lullFreeSec = 0;
    let startsFreeTime = 0;
    for (const [season, list] of eventsBySeason) {
        const seasonAttacks = list
            .filter((e) => e.type === 'attack')
            .map((a) => ({ s: a.start_time, e: a.end_time }));
        const trains = trainsBySeason.get(season) ?? [];
        for (let i = 1; i < trains.length; i++) {
            // The lull before train i: previous train end -> this train start.
            const lo = trains[i - 1].e;
            const hi = trains[i].s;
            if (hi <= lo) continue;
            starts++;
            const atkSec = unionOverlapSeconds(seasonAttacks, lo, hi);
            lullAttackSec += atkSec;
            lullFreeSec += hi - lo - atkSec;
            const t = trains[i].s;
            const attackActive = seasonAttacks.some((a) => a.s <= t && a.e > t);
            const isCounter = counterStartSet.has(trains[i].startEvent);
            if (attackActive) {
                duringAttack++;
                if (isCounter) duringAttackCounter++;
            } else {
                startsFreeTime++;
            }
        }
    }
    console.log(
        `  train starts with ANY assault active at start: ${duringAttack}/${starts}` +
            ` (of which matched counterattacks: ${duringAttackCounter})`,
    );
    const rateAttack = duringAttack / (lullAttackSec / HOUR / 1000);
    const rateFree = startsFreeTime / (lullFreeSec / HOUR / 1000);
    console.log(
        `  exposure: ${(lullAttackSec / HOUR).toFixed(0)}h of lull time assault-active vs ` +
            `${(lullFreeSec / HOUR).toFixed(0)}h assault-free`,
    );
    console.log(
        `  hazard: ${rateAttack.toFixed(2)} starts/1000h (assault-active) vs ` +
            `${rateFree.toFixed(2)} starts/1000h (assault-free)`,
    );
    const nonCounterDuring = duringAttack - duringAttackCounter;
    console.log(
        `  NON-counterattack starts during an assault: ${nonCounterDuring} ` +
            `(guide claims this should be ~0)`,
    );
}

// --- counterattack regions (guide claim: sector 9) ----------------------------

console.log('\n=== TRAIN-START REGIONS: counterattack vs other ===');
{
    const counterStartSet = new Set(live.map((r) => r.counter.startEvent));
    const counts = { counter: new Map(), other: new Map() };
    for (const [, trains] of trainsBySeason) {
        for (const tr of trains) {
            const bucket = counterStartSet.has(tr.startEvent) ? 'counter' : 'other';
            counts[bucket].set(tr.region, (counts[bucket].get(tr.region) ?? 0) + 1);
        }
    }
    for (const bucket of ['counter', 'other']) {
        const m = counts[bucket];
        const total = [...m.values()].reduce((a, b) => a + b, 0);
        const top = [...m.entries()]
            .sort((a, b) => b[1] - a[1])
            .slice(0, 4)
            .map(([r, c]) => `r${r}=${c} (${((c / total) * 100).toFixed(1)}%)`)
            .join('  ');
        console.log(`  ${bucket.padEnd(7)} (n=${total}): ${top}`);
    }
}

// --- verdict against the pre-registered criterion -----------------------------

console.log('\n=== VERDICT (pre-registered criterion, subset (a) only) ===');
{
    const spread = freeStats.p95 - freeStats.p05;
    const mechanical = freeStats.cv < 0.25 || spread < 6;
    console.log(
        `  slot-free delta_raw: CV=${freeStats.cv.toFixed(3)} (criterion < 0.25), ` +
            `p95-p05=${spread.toFixed(1)}h (criterion < 6h)`,
    );
    console.log(
        mechanical ?
            '  MECHANICAL — the counterattack delay is scheduled; the forecasting target must exclude counterattack trains (run 15-counterattack-target.mjs).'
        :   '  NOT MECHANICAL — the counterattack rule fixes the faction, not the timing. The current forecasting target stands.',
    );
}
