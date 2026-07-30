/**
 * 11-emit-attack-model.mjs — emits the committed constants behind the faction
 * card's assault-ETA line (src/features/dashboard/attackModel.mjs).
 *
 * The forecast itself is arithmetic the client can do from the live payload:
 *
 *     eta = (points_max - points) / rate - readingAge
 *
 * What the client cannot derive are the two calibration tables measured in
 * 10-attack-eta.mjs, so those are what this emits:
 *
 *  - `ratios[band]` — p25/p50/p75 multipliers converting a raw ETA into a
 *    forecast band, per remaining-fraction band. Per-band because `wait/eta`
 *    is heavy-tailed and mechanically correlated with `eta` as remaining -> 0.
 *  - `dow[0..6]` — day-of-week pace factors, each campaign normalised to its
 *    own median before pooling so the table measures weekday and not era.
 *
 * Fitted on the FULL history. The walk-forward gate in 10-attack-eta.mjs
 * already measured the honest skill (0.23-0.33 against a 0.6 bar, alert bar
 * passing on all three factions); fitting the shipped artifact on everything
 * afterwards is standard practice, and mirrors 08-emit-wave-model.mjs.
 *
 * The script REFUSES to emit unless:
 *  - every band's multipliers are finite, positive and monotone;
 *  - the day-of-week table is finite, positive, and actually VARIES (a flat
 *    table would silently reduce the correction to a no-op while looking
 *    like it shipped);
 *  - a replay over history clears the same alert bar the walk-forward run
 *    was held to — fires before >= 70% of attacks, and when showing, an
 *    attack follows within 2x the upper bound >= 80% of the time.
 *
 * Run from the repo root:
 *   node --env-file=.env.development scripts/analysis/11-emit-attack-model.mjs
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { loadDataset, HOUR } from './lib/dataset.mjs';
import { quantileOf } from './lib/backtest.mjs';

const RATE_WINDOW_HOURS = 24;
const DISPLAY_HOURS = 24;
const STEP_HOURS = 3;
const MIN_RATIO_SAMPLES = 30;
const MIN_DOW_SAMPLES = 50;
const MIN_ETA_HOURS = 0.25;
const BANDS = [0.02, 0.05, 0.1, 0.2, 0.4, 1.01];

const ALERT_RECALL = 0.7;
const ALERT_PRECISION = 0.8;

const OUT_PATH = path.join(process.cwd(), 'src/features/dashboard/attackModel.mjs');

/**
 * Index of the remaining-fraction band containing `frac`. Duplicated from
 * 10-attack-eta.mjs rather than imported, because the emitted artifact has to
 * stay pinned to the band edges it was FITTED with — importing would let a
 * later edit to the analysis script silently re-bucket a committed model.
 *
 * @param {number} frac remaining points as a fraction of points_max
 * @returns {number} band index
 */
function bandOf(frac) {
    for (let i = 0; i < BANDS.length; i++) if (frac < BANDS[i]) return i;
    return BANDS.length - 1;
}

// --- pure self-checks (no DB) ---------------------------------------------
{
    assert.equal(bandOf(0), 0);
    assert.equal(bandOf(0.02), 1);
    assert.equal(bandOf(0.9), 5);
    assert.equal(new Set([0.01, 0.03, 0.07, 0.15, 0.3, 0.9].map(bandOf)).size, 6);
    console.log('=== 11-emit-attack-model: pure self-checks OK ===');
}

const ds = await loadDataset();

/**
 * Raw ETA in hours at an instant, anchored at `t` rather than at the reading.
 *
 * @param {number} season
 * @param {number} enemy
 * @param {number} t unix seconds
 * @param {number[]|null} dow day-of-week pace factors, or null for no correction
 * @returns {{etaHours: number, remainingFrac: number}|null}
 */
function rawEta(season, enemy, t, dow) {
    const pointsMax = ds.seasons.get(season)?.pointsMax?.[enemy] ?? 0;
    if (!(pointsMax > 0)) return null;

    const stNow = ds.statusAt(season, enemy, t);
    const stThen = ds.statusAt(season, enemy, t - RATE_WINDOW_HOURS * HOUR);
    if (!stNow || !stThen) return null;

    const now = Number(stNow.points);
    const remaining = pointsMax - now;
    if (remaining <= 0) return null;

    const spanHours = (Number(stNow.bucket) - Number(stThen.bucket)) / HOUR;
    if (!(spanHours > 0)) return null;
    const ratePerHour = (now - Number(stThen.points)) / spanHours;
    if (!(ratePerHour > 0)) return null;

    let etaHours = remaining / ratePerHour;
    if (dow) {
        const horizon = Math.min(Math.max(etaHours, 1), 48);
        const mean = (from, to) => {
            let s = 0;
            let n = 0;
            for (let x = from; x < to; x += 6 * HOUR) {
                s += dow[new Date(x * 1000).getUTCDay()];
                n++;
            }
            return n > 0 ? s / n : 1;
        };
        const adj =
            mean(Number(stThen.bucket), Number(stNow.bucket)) /
            mean(t, t + horizon * HOUR);
        if (adj > 0) etaHours *= adj;
    }
    etaHours -= (t - Number(stNow.bucket)) / HOUR;
    return {
        etaHours: Math.max(etaHours, MIN_ETA_HOURS),
        remainingFrac: remaining / pointsMax,
    };
}

// --- day-of-week table -----------------------------------------------------

const dowSamples = Array.from({ length: 7 }, () => []);
for (const [season] of ds.seasons) {
    for (const enemy of [0, 1, 2]) {
        const series = ds.statusSeries(season, enemy);
        if (series.length < 3) continue;
        const local = [];
        for (let i = 1; i < series.length; i++) {
            const dt = (Number(series[i].bucket) - Number(series[i - 1].bucket)) / HOUR;
            if (dt <= 0) continue;
            const pace = (Number(series[i].points) - Number(series[i - 1].points)) / dt;
            if (pace > 0) {
                local.push({
                    dow: new Date(Number(series[i].bucket) * 1000).getUTCDay(),
                    pace,
                });
            }
        }
        if (local.length < 5) continue;
        const m = quantileOf(
            local.map((x) => x.pace),
            0.5,
        );
        if (!(m > 0)) continue;
        for (const x of local) dowSamples[x.dow].push(x.pace / m);
    }
}
const dow = dowSamples.map((v) =>
    v.length >= MIN_DOW_SAMPLES ? (quantileOf(v, 0.5) ?? 1) : 1,
);

console.log('\nday-of-week pace factors (Sun..Sat):');
console.log('  ' + dow.map((x) => x.toFixed(3)).join('  '));

// --- ratio table -----------------------------------------------------------

const attacksBySeasonEnemy = new Map();
for (const e of ds.events) {
    if (e.type !== 'attack') continue;
    const k = `${e.season}:${e.enemy}`;
    if (!attacksBySeasonEnemy.has(k)) attacksBySeasonEnemy.set(k, []);
    attacksBySeasonEnemy.get(k).push(e);
}

const ratioSamples = new Map();
/** @type {{etaHours: number, band: number, wait: number}[]} */
const replay = [];

for (const [season, span] of ds.seasons) {
    for (const enemy of [0, 1, 2]) {
        const attacks = attacksBySeasonEnemy.get(`${season}:${enemy}`) ?? [];
        if (attacks.length === 0) continue;
        for (let t = span.firstStart; t <= span.lastEnd; t += STEP_HOURS * HOUR) {
            // Mirrors the backtest's filtered configuration: while an attack is
            // already running against this faction the question is moot.
            if (attacks.some((a) => a.start_time <= t && a.end_time > t)) continue;
            const eta = rawEta(season, enemy, t, dow);
            if (!eta) continue;
            const next = attacks.find((a) => a.start_time > t);
            if (!next) continue;
            const wait = (next.start_time - t) / HOUR;
            const band = bandOf(eta.remainingFrac);
            if (!ratioSamples.has(band)) ratioSamples.set(band, []);
            ratioSamples.get(band).push(wait / eta.etaHours);
            replay.push({
                etaHours: eta.etaHours,
                band,
                wait,
                target: `${season}:${next.start_time}`,
            });
        }
    }
}

const pooled = [...ratioSamples.values()].flat();
const ratios = {};
for (let b = 0; b < BANDS.length; b++) {
    const s = ratioSamples.get(b) ?? [];
    const use = s.length >= MIN_RATIO_SAMPLES ? s : pooled;
    ratios[b] = {
        r25: quantileOf(use, 0.25),
        r50: quantileOf(use, 0.5),
        r75: quantileOf(use, 0.75),
        n: s.length,
    };
}

console.log('\nratio multipliers by remaining-fraction band:');
for (let b = 0; b < BANDS.length; b++) {
    const r = ratios[b];
    console.log(
        `  band ${b} (<${BANDS[b]})`.padEnd(20) +
            `r25=${r.r25.toFixed(3)} r50=${r.r50.toFixed(3)} r75=${r.r75.toFixed(3)}  n=${r.n}`,
    );
}

// --- refuse-to-emit guards -------------------------------------------------

for (let b = 0; b < BANDS.length; b++) {
    const { r25, r50, r75 } = ratios[b];
    assert(
        Number.isFinite(r25) && Number.isFinite(r50) && Number.isFinite(r75),
        `band ${b}: non-finite multiplier`,
    );
    assert(r25 > 0, `band ${b}: non-positive r25`);
    assert(r25 <= r50 && r50 <= r75, `band ${b}: multipliers not monotone`);
}
for (const f of dow) assert(Number.isFinite(f) && f > 0, 'non-finite day-of-week factor');
// A flat table is the silent-no-op failure: it would ship looking correct
// while contributing nothing. The measured spread is ~29%.
assert(
    Math.max(...dow) - Math.min(...dow) > 0.05,
    `day-of-week table is flat (spread ${(Math.max(...dow) - Math.min(...dow)).toFixed(4)}) — the correction would be a no-op`,
);

// Alert-bar replay: the same two conditions the walk-forward run was held to.
const showing = replay.filter((r) => r.etaHours * ratios[r.band].r50 < DISPLAY_HOURS);
const targets = new Set(replay.map((r) => r.target));
const fired = new Set(showing.map((r) => r.target));
const honoured = showing.filter((r) => r.wait < 2 * r.etaHours * ratios[r.band].r75);
const recall = targets.size > 0 ? fired.size / targets.size : 0;
const precision = showing.length > 0 ? honoured.length / showing.length : 0;

console.log(
    `\nalert-bar replay: fires before ${(recall * 100).toFixed(1)}% of ${targets.size} attacks` +
        ` | followed ${(precision * 100).toFixed(1)}% of ${showing.length} showing moments`,
);
assert(
    recall >= ALERT_RECALL,
    `recall ${recall.toFixed(3)} below the ${ALERT_RECALL} bar — refusing to emit`,
);
assert(
    precision >= ALERT_PRECISION,
    `precision ${precision.toFixed(3)} below the ${ALERT_PRECISION} bar — refusing to emit`,
);

// --- emit ------------------------------------------------------------------

const model = {
    meta: {
        rateWindowHours: RATE_WINDOW_HOURS,
        displayHours: DISPLAY_HOURS,
        minEtaHours: MIN_ETA_HOURS,
        seasons: ds.seasons.size,
        attacks: targets.size,
        recall: Number(recall.toFixed(4)),
        precision: Number(precision.toFixed(4)),
    },
    bands: BANDS,
    ratios,
    dow,
};

fs.writeFileSync(
    OUT_PATH,
    `// Generated by scripts/analysis/11-emit-attack-model.mjs — do not edit by hand.\n` +
        `// Regenerate: node --env-file=.env.development scripts/analysis/11-emit-attack-model.mjs\n` +
        `export default Object.freeze(${JSON.stringify(model)});\n`,
);
console.log(`\nemitted ${OUT_PATH} (${fs.statSync(OUT_PATH).size} bytes)`);
