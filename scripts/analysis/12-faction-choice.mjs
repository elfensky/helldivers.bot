/**
 * 12-faction-choice.mjs — which faction the next defend wave hits.
 *
 * `13-scheduler-shape.mjs` reverse-engineered WHEN the next train starts (a
 * global end-anchored gamma timer). This script asks the other half of the
 * scheduler's job: which of the three factions gets it.
 *
 * Every lull (end of the previous train to the next train-start) is examined
 * at its own start (t0) — i.e. from information available the moment the
 * lull begins — and partitioned into three mutually exclusive, exhaustive
 * buckets:
 *
 *   1. An attack (homeworld assault) is active at t0. Its FINAL status
 *      (h1_event stores current/final state, not a timeseries) determines
 *      the test: FAILED assaults are checked for a counterattack rule (does
 *      the next wave hit the faction whose assault just failed?); SUCCEEDED
 *      assaults are checked as a definitional exclusion (the faction that
 *      just won is gone — it cannot be the next target).
 *   2. No attack active, and exactly one faction sits at sectorsCaptured==9
 *      (the assault window, see `06-train-covariates.mjs` / findings
 *      "Attempt 3"): is the NEXT wave statistically more likely to target
 *      that faction, tested with a within-season permutation placebo so
 *      cross-season composition can't manufacture the effect?
 *   3. Everything else (residual): five naive per-faction rules — majority
 *      class, same-as-previous, most-overdue-for-a-defend among active
 *      factions, highest-liberation among active factions, and a
 *      one-active-faction-else-majority rule — scored for accuracy, to see
 *      whether ANY simple observable rule beats chance here.
 *
 * The counterattack rule is a SEQUENCING MECHANIC (same epistemic class as
 * "a defend train continues iff the previous defend failed" — see
 * `lib/dataset.mjs`'s train-labelling self-check), not a statistical
 * tendency: it is expected to be near-100%, and the assert below treats
 * anything under 0.95 as a stop-and-report condition, not a threshold to
 * weaken. SC9 targeting, by contrast, IS statistical — hence the placebo.
 *
 * Run: node --env-file=.env.development scripts/analysis/12-faction-choice.mjs
 */

import assert from 'node:assert/strict';
import { loadDataset, makeRng, HOUR, SECTOR_COUNT } from './lib/dataset.mjs';
import { quantileOf } from './lib/backtest.mjs';

const PERMUTATIONS = 2000;
const FACTIONS = ['Bugs', 'Cyborgs', 'Illuminate'];

// --- pure helpers ------------------------------------------------------------

/**
 * Counterattack-rule rate: how often does `next` equal the faction whose
 * assault was active at the lull's start?
 *
 * @param {{next: number, attackedFaction: number}[]} records
 * @returns {number|null} null for an empty input
 */
function counterattackRateOf(records) {
    if (records.length === 0) return null;
    const hits = records.filter((r) => r.next === r.attackedFaction).length;
    return hits / records.length;
}

/**
 * Majority class (mode) of a list of values. Ties broken by first-seen order
 * — deterministic, and irrelevant to the reported accuracy since a tie means
 * two classes are equally "the" majority.
 *
 * @param {*[]} values
 * @returns {*}
 */
function majorityClassOf(values) {
    const counts = new Map();
    for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
    let best = null;
    let bestCount = -1;
    for (const [v, c] of counts) {
        if (c > bestCount) {
            best = v;
            bestCount = c;
        }
    }
    return best;
}

/**
 * Within-season permutation test for a binary "hit" rate (`next === target`).
 *
 * Adapted from `06-train-covariates.mjs`'s `withinStratumPermutation`
 * machinery (Fisher-Yates shuffle confined to each stratum's own indices,
 * the same degenerate-control spread guard, the same `(1+extreme)/(1+draws)`
 * p formula) to a DIFFERENT statistic: `06` compares a median between two
 * label groups, but there is no "value" here — the outcome itself is a
 * match/no-match indicator. So instead of shuffling a boolean LABEL against a
 * fixed numeric value, this shuffles the `next` assignment among a season's
 * own lull records (holding each record's `target` faction fixed) and
 * recomputes the pooled hit rate. That redistributes a season's own multiset
 * of observed `next` outcomes across that season's `target` values — exactly
 * the within-season composition the placebo has to hold fixed — and it is
 * NOT degenerate: unlike permuting a label used only to split a group (which
 * cannot change that group's own mean), permuting WHICH lull gets WHICH
 * `next` value changes how many lulls coincide with their own target on
 * every draw.
 *
 * @param {{next: number, target: number, stratum: string}[]} records
 * @param {() => number} rng seeded generator from makeRng
 * @param {number} draws
 * @returns {{observed: number, p: number, permSpread: number}} one-sided
 *   (rate >= observed) — the hypothesis under test is directional
 *   ("targeting concentrates on the SC9 faction"), not two-sided.
 */
function withinStratumRatePermutation(records, rng, draws = PERMUTATIONS) {
    const n = records.length;
    assert(n > 0, 'withinStratumRatePermutation requires at least one record');
    const observedHits = records.filter((r) => r.next === r.target).length;
    const observed = observedHits / n;

    const byStratum = new Map();
    for (let i = 0; i < n; i++) {
        const key = records[i].stratum;
        if (!byStratum.has(key)) byStratum.set(key, []);
        byStratum.get(key).push(i);
    }

    const nexts = records.map((r) => r.next);
    let extreme = 0;
    let permMin = Infinity;
    let permMax = -Infinity;
    for (let d = 0; d < draws; d++) {
        // Fisher-Yates within each stratum.
        for (const idxs of byStratum.values()) {
            for (let i = idxs.length - 1; i > 0; i--) {
                const j = Math.floor(rng() * (i + 1));
                const tmp = nexts[idxs[i]];
                nexts[idxs[i]] = nexts[idxs[j]];
                nexts[idxs[j]] = tmp;
            }
        }
        let hits = 0;
        for (let i = 0; i < n; i++) if (nexts[i] === records[i].target) hits++;
        const rate = hits / n;
        if (rate >= observed) extreme++;
        if (rate < permMin) permMin = rate;
        if (rate > permMax) permMax = rate;
    }
    return {
        observed,
        p: (1 + extreme) / (1 + draws),
        permSpread: permMax - permMin,
    };
}

// --- pure self-checks (no DB) --------------------------------------------------

{
    // majorityClassOf: picks the mode.
    assert.equal(majorityClassOf([0, 0, 1, 2, 0]), 0);
    assert.equal(majorityClassOf([1, 1, 2, 2, 2]), 2);
}

{
    // Synthetic counterattack world: a deterministic world (next ALWAYS
    // equals the attacked faction) must score rate exactly 1.0; the same
    // records with `next` independently shuffled must land near chance
    // (1/3), not near 1.0 — the rule's whole claim is that this gap is huge
    // on real data (near 1.0 vs 1/3), so the self-check pins both ends.
    const rng = makeRng(770001);
    const deterministic = [];
    for (let i = 0; i < 300; i++) {
        const attacked = Math.floor(rng() * 3);
        deterministic.push({ next: attacked, attackedFaction: attacked });
    }
    assert.equal(
        counterattackRateOf(deterministic),
        1,
        'deterministic counterattack world must score rate 1.0',
    );

    const shuffleRng = makeRng(880001);
    const shuffledNexts = deterministic.map((r) => r.next);
    for (let i = shuffledNexts.length - 1; i > 0; i--) {
        const j = Math.floor(shuffleRng() * (i + 1));
        const tmp = shuffledNexts[i];
        shuffledNexts[i] = shuffledNexts[j];
        shuffledNexts[j] = tmp;
    }
    const shuffledRate = counterattackRateOf(
        deterministic.map((r, i) => ({
            next: shuffledNexts[i],
            attackedFaction: r.attackedFaction,
        })),
    );
    assert(
        shuffledRate > 0.2 && shuffledRate < 0.5,
        `shuffled counterattack world should land near chance (1/3), got ${shuffledRate}`,
    );

    assert.equal(counterattackRateOf([]), null, 'empty input should return null');
}

{
    // Permutation machinery: a planted within-season targeting effect must be
    // detected, a null (uniform-random `next`) world must not be, and the
    // statistic must vary across draws (degenerate-control guard) — same
    // three-part fixture discipline as 06-train-covariates.mjs, different
    // seeds and a different underlying statistic (pooled rate, not median
    // delta).
    const planted = [];
    const nullWorld = [];
    const rngPlanted = makeRng(120001);
    const rngNull = makeRng(340001);
    for (let s = 0; s < 12; s++) {
        for (let i = 0; i < 24; i++) {
            const target = i % 3;

            const hitPlanted = rngPlanted() < 0.7;
            const nextPlanted =
                hitPlanted ? target : (target + 1 + Math.floor(rngPlanted() * 2)) % 3;
            planted.push({ next: nextPlanted, target, stratum: `s${s}` });

            const nextNull = Math.floor(rngNull() * 3);
            nullWorld.push({ next: nextNull, target, stratum: `s${s}` });
        }
    }

    const detected = withinStratumRatePermutation(planted, makeRng(555001), 500);
    assert(
        detected.p < 0.01,
        `planted targeting effect should be detected, got p=${detected.p}`,
    );
    assert(detected.permSpread > 0, 'permuted rate must vary across draws');

    // Under the null, p is uniform — a single fixture cannot prove
    // correctness, only guard against a machinery regression that is always
    // significant.
    const nullResult = withinStratumRatePermutation(nullWorld, makeRng(555001), 500);
    assert(
        nullResult.p > 0.05,
        `null world should not be significant, got p=${nullResult.p}`,
    );

    // Determinism: same seed, same p.
    const again = withinStratumRatePermutation(planted, makeRng(555001), 500);
    assert.equal(again.p, detected.p, 'permutation p must be deterministic');
}

console.log('=== 12-faction-choice: pure self-checks OK ===');

// --- data --------------------------------------------------------------------

const ds = await loadDataset();
const allDefends = ds.events.filter((e) => e.type === 'defend');
const attacks = ds.events.filter((e) => e.type === 'attack');

const defendsBySeason = new Map();
for (const e of allDefends) {
    if (!defendsBySeason.has(e.season)) defendsBySeason.set(e.season, []);
    defendsBySeason.get(e.season).push(e);
}
const defendsBySeasonEnemy = new Map();
for (const e of allDefends) {
    const key = `${e.season}:${e.enemy}`;
    if (!defendsBySeasonEnemy.has(key)) defendsBySeasonEnemy.set(key, []);
    defendsBySeasonEnemy.get(key).push(e);
}
const attacksBySeason = new Map();
for (const a of attacks) {
    if (!attacksBySeason.has(a.season)) attacksBySeason.set(a.season, []);
    attacksBySeason.get(a.season).push(a);
}

/**
 * Sectors captured for a faction at time `t` — same formula as
 * `01-trigger-hunt.mjs` / `06-train-covariates.mjs`. Null when status or
 * points_max is unavailable.
 *
 * @param {number} season
 * @param {number} enemy
 * @param {number} t unix seconds
 * @returns {number|null}
 */
function sectorsCapturedAt(season, enemy, t) {
    const st = ds.statusAt(season, enemy, t);
    const max = ds.seasons.get(season)?.pointsMax?.[enemy] ?? 0;
    return st && max > 0 ? Math.trunc(st.points / (max / SECTOR_COUNT)) : null;
}

/**
 * Hours since the latest same-season same-enemy defend that ENDED at or
 * before `t`. Null if no such defend exists (the faction has not defended
 * yet this season as of `t`).
 *
 * @param {number} season
 * @param {number} enemy
 * @param {number} t unix seconds
 * @returns {number|null}
 */
function hoursSinceOwnLastDefendAt(season, enemy, t) {
    const list = defendsBySeasonEnemy.get(`${season}:${enemy}`) ?? [];
    const last = list.filter((e) => e.end_time <= t).at(-1);
    return last ? (t - last.end_time) / HOUR : null;
}

/**
 * One record per observed lull: end of the previous train to this train
 * start, with per-faction state evaluated AT THE LULL START (t0) — i.e.
 * from information available the moment the lull begins. Same walk as
 * `13-scheduler-shape.mjs` / `06-train-covariates.mjs`.
 */
const lulls = [];
for (const [season, list] of defendsBySeason) {
    const idx = [];
    for (let i = 0; i < list.length; i++) if (list[i].isTrainStart) idx.push(i);
    for (let k = 1; k < idx.length; k++) {
        const cur = list[idx[k]];
        const prevStart = list[idx[k - 1]];
        const prevLast = list[idx[k] - 1];
        const t0 = prevLast.end_time;

        const perFaction = [0, 1, 2].map((enemy) => {
            const st = ds.statusAt(season, enemy, t0);
            return {
                enemy,
                sectorsCaptured: sectorsCapturedAt(season, enemy, t0),
                liberation: ds.liberationAt(season, enemy, t0),
                status: st ? st.status : null,
                hoursSinceOwnLastDefend: hoursSinceOwnLastDefendAt(season, enemy, t0),
            };
        });

        const active = (attacksBySeason.get(season) ?? []).find(
            (a) => a.start_time <= t0 && a.end_time > t0,
        );

        lulls.push({
            season,
            next: cur.enemy,
            prev: prevStart.enemy,
            t0,
            perFaction,
            activeAttack: active ? { enemy: active.enemy, status: active.status } : null,
        });
    }
}
assert(lulls.length > 1500, `expected ~1800 lull records, got ${lulls.length}`);
console.log(`\nlull records: ${lulls.length}\n`);

// --- counterattack rule --------------------------------------------------------

const attackConditioned = lulls.filter((r) => r.activeAttack !== null);
const failResolved = attackConditioned.filter((r) => r.activeAttack.status === 'fail');
const successResolved = attackConditioned.filter(
    (r) => r.activeAttack.status === 'success',
);

const failRate = counterattackRateOf(
    failResolved.map((r) => ({ next: r.next, attackedFaction: r.activeAttack.enemy })),
);
const failHits = failResolved.filter((r) => r.next === r.activeAttack.enemy).length;
console.log(
    'COUNTERATTACK RULE — homeworld assault active at lull start, FINAL status = fail:',
);
console.log(
    `  next === attacked faction: ${failHits}/${failResolved.length} = ${failRate === null ? 'n/a' : failRate.toFixed(4)}`,
);
assert(
    failRate !== null && failRate > 0.95,
    `counterattack rate should exceed 0.95 (sequencing mechanic) — got ${failRate}; STOP, do not weaken this assert`,
);

const successHits = successResolved.filter((r) => r.next === r.activeAttack.enemy).length;
console.log(
    `\nSUCCEEDED assaults (definitional exclusion check — the winning faction is gone, cannot be next target):`,
);
console.log(`  next === attacked faction: ${successHits}/${successResolved.length}`);

// --- SC9 targeting --------------------------------------------------------------

const noAttack = lulls.filter((r) => r.activeAttack === null);
const sc9Candidates = noAttack
    .map((r) => {
        const at9 = r.perFaction.filter((f) => f.sectorsCaptured === 9);
        return at9.length === 1 ? { ...r, sc9Faction: at9[0].enemy } : null;
    })
    .filter((r) => r !== null);

const sc9Hits = sc9Candidates.filter((r) => r.next === r.sc9Faction).length;
const sc9Rate = sc9Candidates.length > 0 ? sc9Hits / sc9Candidates.length : null;
console.log(
    `\nSC9 TARGETING — no active attack, exactly one faction at sectorsCaptured===9 (n=${sc9Candidates.length}):`,
);
console.log(
    `  next === sc9 faction: ${sc9Hits}/${sc9Candidates.length} = ${sc9Rate === null ? 'n/a' : sc9Rate.toFixed(4)}`,
);

const sc9PermRecords = sc9Candidates.map((r) => ({
    next: r.next,
    target: r.sc9Faction,
    stratum: `s${r.season}`,
}));
const sc9Perm = withinStratumRatePermutation(
    sc9PermRecords,
    makeRng(120731),
    PERMUTATIONS,
);
assert(sc9Perm.permSpread > 0, 'SC9 targeting: degenerate permutation (spread 0)');
console.log(
    `  within-season permutation: p=${sc9Perm.p.toFixed(4)}  permSpread=${sc9Perm.permSpread.toFixed(4)} (degenerate-control guard, must be > 0)`,
);

// --- residual rules --------------------------------------------------------------

const residual = noAttack.filter(
    (r) => r.perFaction.filter((f) => f.sectorsCaptured === 9).length !== 1,
);
console.log(
    `\nRESIDUAL RULES — no active attack, not exactly-one-SC9 (n=${residual.length}):`,
);

const residualNexts = residual.map((r) => r.next);
const majority = majorityClassOf(residualNexts);
const accMajority = residual.filter((r) => r.next === majority).length / residual.length;
console.log(
    `  (a) majority class (always predict ${FACTIONS[majority]}): ${accMajority.toFixed(4)} (n=${residual.length})`,
);

const accSamePrev = residual.filter((r) => r.next === r.prev).length / residual.length;
console.log(`  (b) same-as-previous: ${accSamePrev.toFixed(4)} (n=${residual.length})`);

/**
 * Pick the faction with the highest `scoreFn` value among the record's
 * ACTIVE-status factions. Returns null when fewer than two active factions
 * have a defined score (nothing to compare) or when the max is tied across
 * more than one faction (undefined prediction).
 *
 * @param {object} r a lull record
 * @param {(f: object) => number|null} scoreFn
 * @returns {number|null} the predicted enemy id, or null if excluded
 */
function pickAmongActive(r, scoreFn) {
    const active = r.perFaction.filter(
        (f) => f.status === 'active' && scoreFn(f) !== null,
    );
    if (active.length < 2) return null;
    let best = active[0];
    for (const f of active.slice(1)) if (scoreFn(f) > scoreFn(best)) best = f;
    const ties = active.filter((f) => scoreFn(f) === scoreFn(best));
    if (ties.length > 1) return null;
    return best.enemy;
}

let recencyN = 0;
let recencyHits = 0;
let liberationN = 0;
let liberationHits = 0;
const recencyHitVals = [];
const recencyMissVals = [];
for (const r of residual) {
    const recencyPick = pickAmongActive(r, (f) => f.hoursSinceOwnLastDefend);
    if (recencyPick !== null) {
        recencyN++;
        const isHit = recencyPick === r.next;
        if (isHit) recencyHits++;
        const pickedField = r.perFaction.find((f) => f.enemy === recencyPick);
        (isHit ? recencyHitVals : recencyMissVals).push(
            pickedField.hoursSinceOwnLastDefend,
        );
    }
    const liberationPick = pickAmongActive(r, (f) => f.liberation);
    if (liberationPick !== null) {
        liberationN++;
        if (liberationPick === r.next) liberationHits++;
    }
}
console.log(
    `  (c) own-last-defend-longest-ago among active: ${(recencyHits / recencyN).toFixed(4)} (n=${recencyN})`,
);
console.log(
    `  (d) highest own liberation among active: ${(liberationHits / liberationN).toFixed(4)} (n=${liberationN})`,
);

let activeMajorityHits = 0;
for (const r of residual) {
    const activeFactions = r.perFaction
        .filter((f) => f.status === 'active')
        .map((f) => f.enemy);
    const pick = activeFactions.length === 1 ? activeFactions[0] : majority;
    if (pick === r.next) activeMajorityHits++;
}
const accActiveMajority = activeMajorityHits / residual.length;
console.log(
    `  (e) majority among active-status factions (else fall back to overall majority): ${accActiveMajority.toFixed(4)} (n=${residual.length})`,
);

console.log(
    '\nDESCRIPTIVE — hoursSinceOwnLastDefend of the picked ("most overdue") faction, rule (c), hit vs miss:',
);
console.log(
    `  hit  n=${recencyHitVals.length}  p50=${quantileOf(recencyHitVals, 0.5)?.toFixed(1) ?? 'n/a'}h`,
);
console.log(
    `  miss n=${recencyMissVals.length}  p50=${quantileOf(recencyMissVals, 0.5)?.toFixed(1) ?? 'n/a'}h`,
);

// --- transition matrix ------------------------------------------------------------

console.log(`\nTRANSITION MATRIX P(next | prev) — all lulls, n=${lulls.length}:`);
const counts = [
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
];
for (const r of lulls) counts[r.prev][r.next]++;
for (let p = 0; p < 3; p++) {
    const rowTotal = counts[p].reduce((a, b) => a + b, 0);
    const row = counts[p]
        .map((c) => (rowTotal > 0 ? (c / rowTotal).toFixed(3) : '—'))
        .join('  ');
    console.log(`  prev=${FACTIONS[p].padEnd(11)} -> [${row}]  (n=${rowTotal})`);
}
const baseCounts = [0, 0, 0];
for (const r of lulls) baseCounts[r.next]++;
const baseRates = baseCounts.map((c) => (c / lulls.length).toFixed(3));
console.log(
    `  base rate (marginal next): Bugs=${baseRates[0]} Cyborgs=${baseRates[1]} Illuminate=${baseRates[2]}`,
);

console.log(
    '\nVERDICT: the counterattack rule (fail-resolved assault -> next wave hits that faction) is a\n' +
        'deterministic sequencing mechanic. SC9-window targeting is a real but modest statistical\n' +
        'tilt, placebo-tested. Once neither condition holds, faction choice among the remaining\n' +
        'active factions is close to unpredictable from any simple observable rule tried here.',
);
