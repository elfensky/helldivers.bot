/**
 * 01-trigger-hunt.mjs — does HD1 fire attack events on a deterministic
 * campaign-state rule? If so there is nothing to forecast and #472 ends here.
 *
 * Run: node --env-file=.env.development scripts/analysis/01-trigger-hunt.mjs
 */

import assert from 'node:assert/strict';

import { loadDataset, makeRng, DAY, HOUR, SECTOR_COUNT } from './lib/dataset.mjs';

/**
 * Linear-interpolated quantile of an unsorted numeric array.
 *
 * @param {number[]} values
 * @param {number} q in [0, 1]
 * @returns {number|null} null for an empty array
 */
function quantile(values, q) {
    if (values.length === 0) return null;
    const s = [...values].sort((a, b) => a - b);
    const pos = q * (s.length - 1);
    const lo = Math.floor(pos);
    const hi = Math.ceil(pos);
    if (lo === hi) return s[lo];
    return s[lo] + (s[hi] - s[lo]) * (pos - lo);
}

/**
 * @param {number[]} values
 * @returns {{n: number, p05: number|null, p25: number|null, p50: number|null,
 *            p75: number|null, p95: number|null, iqr: number, span: number}}
 */
function summarize(values) {
    const p05 = quantile(values, 0.05);
    const p25 = quantile(values, 0.25);
    const p50 = quantile(values, 0.5);
    const p75 = quantile(values, 0.75);
    const p95 = quantile(values, 0.95);
    return {
        n: values.length,
        p05,
        p25,
        p50,
        p75,
        p95,
        iqr: p75 !== null && p25 !== null ? p75 - p25 : 0,
        span: p95 !== null && p05 !== null ? p95 - p05 : 0,
    };
}

/**
 * Concentration ratio. Zero denominator with a non-zero numerator is Infinity
 * (maximally un-concentrated), which is the honest reading.
 *
 * @param {number} attackSpread
 * @param {number} controlSpread
 * @returns {number}
 */
function ratio(attackSpread, controlSpread) {
    if (attackSpread === 0) return 0;
    if (controlSpread === 0) return Infinity;
    return attackSpread / controlSpread;
}

// --- self-check on the pure helpers ---------------------------------------
{
    assert.equal(quantile([1, 2, 3, 4], 0.5), 2.5, 'quantile midpoint');
    assert.equal(quantile([5], 0.9), 5, 'quantile single value');
    assert.equal(quantile([], 0.5), null, 'quantile of empty is null');

    const spread = summarize([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    assert.equal(spread.n, 10);
    assert(spread.iqr > 0, 'iqr should be positive for a spread sample');

    const flat = summarize([7, 7, 7, 7, 7, 7, 7, 7, 7, 7]);
    assert.equal(flat.iqr, 0, 'iqr of a constant sample is 0');

    assert.equal(ratio(0, 4), 0, 'ratio with zero numerator');
    assert.equal(ratio(2, 0), Infinity, 'ratio with zero denominator');
}

// --- variable extraction ---------------------------------------------------

const VARIABLES = [
    'liberation',
    'sectorsCaptured',
    'daysIntoSeason',
    'hoursSincePrevEventEnd',
    'playerPercentile',
];

/**
 * Campaign-state variables for one faction at one instant.
 *
 * `playerPercentile` is computed internally via `ds.playerPercentileAt` — it
 * must be evaluable at an arbitrary instant so the attack side and the
 * control side each get their OWN value. Passing it in as a parameter (the
 * original, defective version) meant every control silently reused the
 * attack's own percentile, collapsing the control population onto the
 * attack population and making that variable's comparison vacuous.
 *
 * @param {object} ds dataset
 * @param {number} season
 * @param {number} enemy
 * @param {number} t unix seconds
 * @param {object|null} prevEvent most recent event of this type+enemy before `t`
 * @returns {object} variable name -> number|null
 */
function stateAt(ds, season, enemy, t, prevEvent) {
    const liberation = ds.liberationAt(season, enemy, t);
    const pointsMax = ds.seasons.get(season)?.pointsMax?.[enemy] ?? 0;
    const st = ds.statusAt(season, enemy, t);
    const sectorsCaptured =
        st && pointsMax > 0 ? Math.trunc(st.points / (pointsMax / SECTOR_COUNT)) : null;
    const firstStart = ds.seasons.get(season)?.firstStart ?? t;

    return {
        liberation,
        sectorsCaptured,
        daysIntoSeason: (t - firstStart) / DAY,
        hoursSincePrevEventEnd: prevEvent ? (t - prevEvent.end_time) / HOUR : null,
        playerPercentile: ds.playerPercentileAt(season, t),
    };
}

const RULE_IQR_RATIO = 0.25;
const RULE_SPAN_RATIO = 0.35;

// Five variables are tested. A raw 0.05 threshold applied five times fires a
// false positive ~23% of the time, and a single false positive halts the entire
// investigation via the Task 3 routing gate. Bonferroni-correct.
const PERMUTATIONS = 2000;
const ALPHA = 0.05 / VARIABLES.length;

/**
 * Permutation p-value for "attack values are more concentrated than controls".
 *
 * Pools attack and control values, reshuffles the labels `PERMUTATIONS` times,
 * and reports how often chance alone produces an IQR ratio at least as small as
 * the observed one. No distributional assumption, which matters because none of
 * these variables is remotely normal.
 *
 * @param {number[]} attackVals
 * @param {number[]} controlVals
 * @param {() => number} rand
 * @returns {number} p-value
 */
function permutationP(attackVals, controlVals, rand) {
    const observed = ratio(summarize(attackVals).iqr, summarize(controlVals).iqr);
    if (!Number.isFinite(observed)) return 1;

    const pool = [...attackVals, ...controlVals];
    const nA = attackVals.length;
    let atLeastAsExtreme = 0;

    for (let p = 0; p < PERMUTATIONS; p++) {
        const shuffled = [...pool];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(rand() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        const permRatio = ratio(
            summarize(shuffled.slice(0, nA)).iqr,
            summarize(shuffled.slice(nA)).iqr,
        );
        if (Number.isFinite(permRatio) && permRatio <= observed) {
            atLeastAsExtreme++;
        }
    }
    // Add-one smoothing: a p-value of exactly 0 is never honest from 2000 draws.
    return (atLeastAsExtreme + 1) / (PERMUTATIONS + 1);
}

/**
 * @param {number|null|undefined} x
 * @returns {string}
 */
function fmt(x) {
    if (x === null || x === undefined) return 'n/a';
    if (!Number.isFinite(x)) return String(x);
    return x.toFixed(3);
}

/**
 * Run the full trigger hunt (phase-matched controls + permutation test, then
 * the S157-160 high-resolution re-test) for ONE event type. Everything about
 * the method is identical between event types — only the event filter and the
 * "previous event" lookup (same type AND enemy) change.
 *
 * @param {object} ds dataset
 * @param {'defend'|'attack'} eventType
 * @returns {void}
 */
function runTriggerHunt(ds, eventType) {
    console.log(`\n${'#'.repeat(78)}`);
    console.log(`# EVENT TYPE: ${eventType.toUpperCase()}`);
    console.log('#'.repeat(78));

    const rng = makeRng(20260727);

    const events = ds.events.filter((e) => e.type === eventType);
    const eventsBySeasonEnemy = new Map();
    for (const e of events) {
        const key = `${e.season}:${e.enemy}`;
        if (!eventsBySeasonEnemy.has(key)) eventsBySeasonEnemy.set(key, []);
        eventsBySeasonEnemy.get(key).push(e);
    }

    /** @type {Record<string, number[]>} */
    const atEvent = Object.fromEntries(VARIABLES.map((v) => [v, []]));
    /** @type {Record<string, number[]>} */
    const atControl = Object.fromEntries(VARIABLES.map((v) => [v, []]));

    const CONTROLS_PER_ATTACK = 5;
    const EXCLUSION_HOURS = 3;

    // Seasons usable as phase-matched control donors.
    const candidateSeasons = [...ds.seasons.values()].filter((s) => s.spanSeconds > 0);

    let controlsAttempted = 0;
    let controlsRejected = 0;

    for (const a of events) {
        const siblings = eventsBySeasonEnemy.get(`${a.season}:${a.enemy}`) ?? [];
        const prevEvent =
            siblings.filter((s) => s.start_time < a.start_time).at(-1) ?? null;

        const vars = stateAt(ds, a.season, a.enemy, a.start_time, prevEvent);
        for (const v of VARIABLES) {
            if (vars[v] !== null && Number.isFinite(vars[v])) atEvent[v].push(vars[v]);
        }

        // PHASE-MATCHED controls, drawn from OTHER seasons at the SAME fractional
        // point through the war.
        //
        // Uniform same-season controls are confounded: liberation rises roughly
        // monotonically with season phase, so if events merely cluster in a
        // particular phase, liberation looks concentrated relative to a uniform
        // control even with no threshold rule at all — a false "we found a rule".
        // Holding phase fixed makes any remaining concentration attributable to
        // campaign state rather than to when in the war we happen to be looking.
        const season = ds.seasons.get(a.season);
        if (!season || season.spanSeconds <= 0) continue;
        const phase = (a.start_time - season.firstStart) / season.spanSeconds;

        for (let i = 0; i < CONTROLS_PER_ATTACK; i++) {
            controlsAttempted++;

            const other = candidateSeasons[Math.floor(rng() * candidateSeasons.length)];
            if (!other || other.season === a.season) {
                controlsRejected++;
                continue;
            }
            const t = other.firstStart + phase * other.spanSeconds;

            const otherSiblings =
                eventsBySeasonEnemy.get(`${other.season}:${a.enemy}`) ?? [];
            const tooClose = otherSiblings.some(
                (s) => Math.abs(s.start_time - t) < EXCLUSION_HOURS * HOUR,
            );
            if (tooClose) {
                controlsRejected++;
                continue;
            }
            const prev = otherSiblings.filter((s) => s.start_time < t).at(-1) ?? null;
            const cVars = stateAt(ds, other.season, a.enemy, t, prev);
            for (const v of VARIABLES) {
                if (cVars[v] !== null && Number.isFinite(cVars[v])) {
                    atControl[v].push(cVars[v]);
                }
            }
        }
    }

    // --- report --------------------------------------------------------------

    console.log(`\n=== Phase 1: trigger hunt (${eventType}) ===`);
    console.log(
        `${eventType}s=${events.length}  controls attempted=${controlsAttempted}  rejected=${controlsRejected}`,
    );
    console.log(
        `controls are PHASE-MATCHED from other seasons; ${PERMUTATIONS} permutations; Bonferroni alpha=${ALPHA.toFixed(4)} across ${VARIABLES.length} variables\n`,
    );

    const permRng = makeRng(31337);
    const verdicts = [];
    for (const v of VARIABLES) {
        const A = summarize(atEvent[v]);
        const C = summarize(atControl[v]);
        const iqrRatio = ratio(A.iqr, C.iqr);
        const spanRatio = ratio(A.span, C.span);
        const pValue = permutationP(atEvent[v], atControl[v], permRng);

        // Rule-like now requires BOTH the effect size AND statistical significance
        // after correction. Either alone is not enough to halt the investigation.
        const effectLarge = iqrRatio <= RULE_IQR_RATIO && spanRatio <= RULE_SPAN_RATIO;
        const ruleLike = effectLarge && pValue < ALPHA;
        verdicts.push({ v, ruleLike, effectLarge, pValue });

        console.log(`${v}`);
        console.log(
            `  at ${eventType}s  n=${A.n}  p25=${fmt(A.p25)}  p50=${fmt(A.p50)}  p75=${fmt(A.p75)}  IQR=${fmt(A.iqr)}  p05-p95 span=${fmt(A.span)}`,
        );
        console.log(
            `  at controls n=${C.n}  p25=${fmt(C.p25)}  p50=${fmt(C.p50)}  p75=${fmt(C.p75)}  IQR=${fmt(C.iqr)}  p05-p95 span=${fmt(C.span)}`,
        );
        console.log(
            `  concentration: IQR ratio=${fmt(iqrRatio)} (<=${RULE_IQR_RATIO})  span ratio=${fmt(spanRatio)} (<=${RULE_SPAN_RATIO})  effect=${effectLarge ? 'LARGE' : 'small'}`,
        );
        console.log(
            `  permutation p=${pValue.toFixed(4)} (significant if < ${ALPHA.toFixed(4)})  => ${ruleLike ? 'RULE-LIKE' : 'no rule'}\n`,
        );
    }

    const ruleLike = verdicts.filter((x) => x.ruleLike).map((x) => x.v);
    const effectOnly = verdicts
        .filter((x) => x.effectLarge && !x.ruleLike)
        .map((x) => `${x.v} (p=${x.pValue.toFixed(4)})`);

    console.log(
        ruleLike.length ?
            `VERDICT (${eventType}): rule-like variable(s): ${ruleLike.join(', ')} — investigate as a deterministic trigger before modelling.`
        :   `VERDICT (${eventType}): no deterministic trigger detectable at daily status resolution. Proceed to Phase 2.`,
    );
    if (effectOnly.length) {
        console.log(
            `NOTE: large effect but NOT significant after Bonferroni: ${effectOnly.join(', ')}. Do not halt on these.`,
        );
    }
    console.log(
        `\nCaveat: h1_status is ~1 bucket/day for 156 of 160 seasons, so campaign state at an ${eventType} start can be up to 24h stale. A real threshold would still concentrate, but smeared. A negative result here does NOT rule out a trigger.`,
    );

    // --- high-resolution re-test on S157-160 ----------------------------------

    console.log(
        `\n=== Phase 1b: same test, S157-160 only (15-min status) — ${eventType} ===`,
    );
    const hiRes = events.filter((a) => a.season >= 157);
    if (hiRes.length < 5) {
        console.log(
            `only ${hiRes.length} ${eventType}s in S157-160 — too few for a meaningful re-test.`,
        );
    } else {
        for (const v of VARIABLES) {
            const vals = [];
            for (const a of hiRes) {
                const siblings = eventsBySeasonEnemy.get(`${a.season}:${a.enemy}`) ?? [];
                const prev =
                    siblings.filter((s) => s.start_time < a.start_time).at(-1) ?? null;
                const x = stateAt(ds, a.season, a.enemy, a.start_time, prev)[v];
                if (x !== null && Number.isFinite(x)) vals.push(x);
            }
            const S = summarize(vals);
            console.log(
                `${v}: n=${S.n} p25=${fmt(S.p25)} p50=${fmt(S.p50)} p75=${fmt(S.p75)} IQR=${fmt(S.iqr)}`,
            );
        }
    }
}

// --- run for both event types, defends first -------------------------------

const ds = await loadDataset();

for (const eventType of ['defend', 'attack']) {
    runTriggerHunt(ds, eventType);
}
