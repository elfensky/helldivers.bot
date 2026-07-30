# Next-Wave Card Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A faction-neutral "next defend wave" likelihood-window card on the dashboard, driven by a committed state×elapsed quantile table from the #472 attempt-3 model.

**Architecture:** A new analysis script fits the STATE-KM estimator on full history and emits `src/features/dashboard/waveModel.mjs` (a frozen lookup table). A pure client util derives (state, elapsed) from the existing live payload and looks up the window; a presentational card renders it in the Regions section. No API/DB changes; updates ride the existing 10s poll.

**Tech Stack:** Node scripts (`pg`, `node:assert` — analysis conventions), React 19 + Next 16 client component, Tailwind v4 tokens, Vitest + @testing-library.

**Spec:** `docs/superpowers/specs/2026-07-30-next-wave-card-design.md` (approved). One deviation, decided at planning: the model artifact is an **`.mjs` module** (`export default Object.freeze({...})`), not `.json` — avoids `resolveJsonModule`/import-attribute config risk; content identical.

## Global Constraints

- Branch `feature/next-wave-card` already exists (holds the spec + this plan). Work in a worktree: `git worktree add .worktrees/feature-next-wave-card feature/next-wave-card` from the main checkout, then `cp ../../.env.development . && npm install && npx prisma generate` inside it (§ Worktree Workflow in CLAUDE.md).
- Node via mise: prefix every npm/node command with `mise exec --` (ambient shell has node 26; repo pins 24).
- KISS. No new npm dependencies anywhere. Analysis scripts: `pg` + `node:` core only, relative imports, no try/catch, deterministic (no `Math.random()`, no timestamps in emitted artifacts).
- App code: JSDoc must satisfy `npm run typecheck` (checkJs). No try/catch — but the new client util is synchronous and total (returns `mode:'hidden'` instead of throwing), so `tryCatch` is not needed.
- Copy rules from the spec: always "likely", never "will"; no single ETA, no countdown.
- Interactive elements need `data-umami-event` (`category-action` naming; category `dashboard`).
- Commits: small and logical, message style `feat(next-wave-card): ...`, each ending with `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.
- Verification chain before merge: `npm run lint:fix && npm run lint && npm run typecheck && npm run test:unit` and `set -a && . ./.env.development && set +a && npm run build`.

---

### Task 1: GitHub issue + model-emit script + committed model artifact

**Files:**
- Create: `scripts/analysis/08-emit-wave-model.mjs`
- Create (generated): `src/features/dashboard/waveModel.mjs`
- Modify: `scripts/README.md` (one bullet + one run line, shown below)

**Interfaces:**
- Consumes: `loadDataset`, `HOUR`, `SECTOR_COUNT` from `scripts/analysis/lib/dataset.mjs`; `quantileOf` from `scripts/analysis/lib/backtest.mjs`.
- Produces: `src/features/dashboard/waveModel.mjs` default export with shape
  `{ meta: { binHours: 1, bins: 168, k: 200, minCell: 30, seasons: number, trainStarts: number }, states: { NORMAL: Row[], SC9: Row[], SC10: Row[], ATTACK: Row[] } }`
  where `Row = { p25: number, p50: number, p75: number, p24: number, p48: number }` (hours to 1 decimal; probabilities to 3 decimals; exactly 168 rows per state). Task 2 imports this file.

- [ ] **Step 1: File the issue**

```bash
gh issue create --title "Next-wave likelihood card on the dashboard" \
  --label feature --label frontend \
  --body "Ship the honest surface #472's attempt-3 model supports: a faction-neutral band-not-countdown card (spec: docs/superpowers/specs/2026-07-30-next-wave-card-design.md, plan: docs/superpowers/plans/2026-07-30-next-wave-card.md). One card, Regions section, hidden during waves, 50% band + live within-24h surety %, IMMINENT >= 51%, RUNNING LONG in the assault window, committed state x elapsed quantile table with a reliability self-check."
```

Note the issue number for the merge-time close.

- [ ] **Step 2: Write `scripts/analysis/08-emit-wave-model.mjs`**

The fitting machinery is duplicated from `07-train-state-model.mjs` per the scripts convention (scripts are not libraries; importing one would run its whole analysis as an import side effect). Constants K=200 / MIN_CELL=30 / 3h sample clock are identical to 07 — do not change them.

```js
/**
 * 08-emit-wave-model.mjs — emits the committed lookup table behind the
 * dashboard's next-wave card (src/features/dashboard/waveModel.mjs).
 *
 * Fits the attempt-3 STATE-KM estimator (07-train-state-model.mjs) on the
 * FULL history — the walk-forward gate already measured its honest skill
 * (0.648 [0.622, 0.674], calibration PASS); fitting the shipped artifact on
 * all data afterwards is standard practice. For each observable state
 * (ATTACK > SC9 > SC10 > NORMAL) x 1h elapsed bin (0..167h), the emitted row
 * is the Kaplan-Meier p25/p50/p75 of the K=200 nearest training moments by
 * elapsed, plus the KM CDF read at 24h and 48h (the card's surety numbers).
 *
 * The script REFUSES to emit unless:
 *  - every row has finite, monotone quantiles and p24 <= p48 in [0, 1];
 *  - the predicted within-24h probabilities are RELIABLE against history:
 *    bucketed into deciles, |mean(predicted) - mean(observed)| <= 0.10 per
 *    decile (n >= 100) and <= 0.05 overall (in-sample reliability; the
 *    quartile calibration underneath was walk-forward-verified in 07).
 *
 * Run from the repo root:
 *   node --env-file=.env.development scripts/analysis/08-emit-wave-model.mjs
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { loadDataset, HOUR, SECTOR_COUNT } from './lib/dataset.mjs';
import { quantileOf } from './lib/backtest.mjs';

const KNN_K = 200;
const MIN_CELL = 30;
const STEP_HOURS = 3;
const BIN_HOURS = 1;
const BINS = 168;
const STATES = ['NORMAL', 'SC9', 'SC10', 'ATTACK'];
const OUT_PATH = path.join(process.cwd(), 'src/features/dashboard/waveModel.mjs');

// --- pure helpers (duplicated from 07-train-state-model.mjs) -----------------

/**
 * @param {boolean} attackActive
 * @param {number|null} maxSC
 * @returns {'ATTACK'|'SC9'|'SC10'|'NORMAL'}
 */
function classifyState(attackActive, maxSC) {
    if (attackActive) return 'ATTACK';
    if (maxSC === 9) return 'SC9';
    if (maxSC === 10) return 'SC10';
    return 'NORMAL';
}

/**
 * @param {{elapsed: number}[]} samples sorted by elapsed asc
 * @param {number} elapsed
 * @param {number} k
 * @returns {object[]}
 */
function nearestSamples(samples, elapsed, k) {
    const n = samples.length;
    if (n === 0) return [];
    if (n <= k) return [...samples];
    let lo = 0;
    let hi = n;
    while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (samples[mid].elapsed < elapsed) lo = mid + 1;
        else hi = mid;
    }
    let left = lo - 1;
    let right = lo;
    const picked = [];
    while (picked.length < k) {
        const dLeft = left >= 0 ? elapsed - samples[left].elapsed : Infinity;
        const dRight = right < n ? samples[right].elapsed - elapsed : Infinity;
        if (dLeft <= dRight) {
            picked.push(samples[left]);
            left--;
        } else {
            picked.push(samples[right]);
            right++;
        }
    }
    return picked;
}

/**
 * Kaplan-Meier CDF steps for a mixed censored/uncensored neighbourhood.
 *
 * @param {{wait: number|null, censorAt?: number|null}[]} samples non-empty
 * @returns {[number, number][]} ascending [eventTime, cdf] steps
 */
function kmCdfSteps(samples) {
    assert(samples.length > 0, 'kmCdfSteps requires samples');
    const points = samples
        .map((s) => ({
            time: s.wait !== null ? s.wait : s.censorAt,
            event: s.wait !== null,
        }))
        .sort((a, b) => a.time - b.time || (a.event ? 0 : 1) - (b.event ? 0 : 1));
    let atRisk = points.length;
    let survival = 1;
    const steps = [];
    for (const p of points) {
        if (p.event) {
            survival *= (atRisk - 1) / atRisk;
            steps.push([p.time, 1 - survival]);
        }
        atRisk--;
    }
    assert(steps.length > 0, 'kmCdfSteps requires at least one uncensored sample');
    return steps;
}

/**
 * @param {[number, number][]} steps from kmCdfSteps
 * @param {number} q in (0, 1)
 * @returns {number} smallest event time with cdf >= q, else the largest event time
 */
function kmQuantile(steps, q) {
    for (const [time, cdf] of steps) {
        if (cdf >= q) return time;
    }
    return steps[steps.length - 1][0];
}

/**
 * @param {[number, number][]} steps from kmCdfSteps
 * @param {number} horizon hours
 * @returns {number} KM CDF at the horizon (0 when no step is <= horizon)
 */
function kmCdfAt(steps, horizon) {
    let cdf = 0;
    for (const [time, c] of steps) {
        if (time <= horizon) cdf = c;
        else break;
    }
    return cdf;
}

// --- self-checks on the pure helpers (no DB) --------------------------------

{
    assert.equal(classifyState(true, 9), 'ATTACK');
    assert.equal(classifyState(false, 9), 'SC9');
    assert.equal(classifyState(false, null), 'NORMAL');

    // KM fixture: events 10 & 20, three censored at 15 -> cdf 0.2@10, 1.0@20.
    const steps = kmCdfSteps([
        { wait: 10 },
        { wait: 20 },
        { wait: null, censorAt: 15 },
        { wait: null, censorAt: 15 },
        { wait: null, censorAt: 15 },
    ]);
    assert.deepEqual(steps, [
        [10, 0.19999999999999996],
        [20, 1],
    ]);
    assert.equal(kmQuantile(steps, 0.5), 20);
    assert.equal(kmCdfAt(steps, 24), 1);
    assert.equal(kmCdfAt(steps, 12), 0.19999999999999996);
    assert.equal(kmCdfAt(steps, 5), 0);

    const knn = nearestSamples(
        [1, 2, 3, 10, 11, 12].map((e) => ({ elapsed: e })),
        2,
        3,
    );
    assert.deepEqual(
        knn.map((s) => s.elapsed).sort((a, b) => a - b),
        [1, 2, 3],
    );
}

console.log('=== 08-emit-wave-model: pure self-checks OK ===');

// --- build moment samples from the FULL history ------------------------------

const ds = await loadDataset();
const allDefends = ds.events.filter((e) => e.type === 'defend');
const attacks = ds.events.filter((e) => e.type === 'attack');
const trainStartCount = allDefends.filter((e) => e.isTrainStart).length;

const defendsBySeason = new Map();
for (const e of allDefends) {
    if (!defendsBySeason.has(e.season)) defendsBySeason.set(e.season, []);
    defendsBySeason.get(e.season).push(e);
}
const attacksBySeason = new Map();
for (const a of attacks) {
    if (!attacksBySeason.has(a.season)) attacksBySeason.set(a.season, []);
    attacksBySeason.get(a.season).push(a);
}

/**
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
 * @param {number} season
 * @param {number} t unix seconds
 * @returns {'ATTACK'|'SC9'|'SC10'|'NORMAL'}
 */
function stateAt(season, t) {
    const attackActive = (attacksBySeason.get(season) ?? []).some(
        (a) => a.start_time <= t && a.end_time > t,
    );
    const scs = [0, 1, 2]
        .map((en) => sectorsCapturedAt(season, en, t))
        .filter((v) => v !== null);
    return classifyState(attackActive, scs.length > 0 ? Math.max(...scs) : null);
}

// 3h-clock lull moments, censored included — same builder as 07.
const byState = new Map(STATES.map((s) => [s, []]));
const pooled = [];
for (const [season, list] of defendsBySeason) {
    const span = ds.seasons.get(season);
    if (!span || span.spanSeconds === 0) continue;
    const starts = list.filter((e) => e.isTrainStart);
    if (starts.length < 2) continue;
    for (let t = span.firstStart; t <= span.lastEnd; t += STEP_HOURS * HOUR) {
        if (list.some((e) => e.start_time <= t && e.end_time > t)) continue;
        const last = starts.filter((e) => e.start_time <= t).at(-1);
        if (!last) continue;
        const next = starts.find((e) => e.start_time > t);
        const censorAt = (span.lastEnd - t) / HOUR;
        if (!next && censorAt <= 0) continue;
        const sample = {
            state: stateAt(season, t),
            elapsed: (t - last.start_time) / HOUR,
            wait: next ? (next.start_time - t) / HOUR : null,
            censorAt: next ? null : censorAt,
        };
        byState.get(sample.state).push(sample);
        pooled.push(sample);
    }
}
for (const arr of byState.values()) arr.sort((a, b) => a.elapsed - b.elapsed);
pooled.sort((a, b) => a.elapsed - b.elapsed);
assert(pooled.length > 10000, `expected >10k moment samples, got ${pooled.length}`);

// --- fit the table -----------------------------------------------------------

/** @param {number} x @param {number} places @returns {number} */
function round(x, places) {
    const f = 10 ** places;
    return Math.round(x * f) / f;
}

/**
 * @param {'NORMAL'|'SC9'|'SC10'|'ATTACK'} state
 * @param {number} elapsed hours
 * @returns {{p25: number, p50: number, p75: number, p24: number, p48: number}}
 */
function fitRow(state, elapsed) {
    const cell = byState.get(state) ?? [];
    const samples = cell.length >= MIN_CELL ? cell : pooled;
    const steps = kmCdfSteps(nearestSamples(samples, elapsed, KNN_K));
    return {
        p25: round(kmQuantile(steps, 0.25), 1),
        p50: round(kmQuantile(steps, 0.5), 1),
        p75: round(kmQuantile(steps, 0.75), 1),
        p24: round(kmCdfAt(steps, 24), 3),
        p48: round(kmCdfAt(steps, 48), 3),
    };
}

const states = {};
for (const state of STATES) {
    const rows = [];
    for (let bin = 0; bin < BINS; bin++) {
        rows.push(fitRow(state, bin + 0.5));
    }
    states[state] = rows;
}

// --- emit-gate 1: structural checks ------------------------------------------

for (const state of STATES) {
    assert.equal(states[state].length, BINS, `${state}: wrong bin count`);
    for (const [i, r] of states[state].entries()) {
        assert(
            Number.isFinite(r.p25) && Number.isFinite(r.p50) && Number.isFinite(r.p75),
            `${state}[${i}]: non-finite quantile`,
        );
        assert(
            r.p25 <= r.p50 && r.p50 <= r.p75,
            `${state}[${i}]: quantiles not monotone`,
        );
        assert(
            r.p24 >= 0 && r.p24 <= 1 && r.p48 >= 0 && r.p48 <= 1 && r.p24 <= r.p48,
            `${state}[${i}]: bad probabilities`,
        );
    }
}
console.log('structural checks OK');

// --- emit-gate 2: within-24h reliability -------------------------------------
//
// Every historical lull moment with an answerable within-24h outcome gets the
// table's prediction for its (state, bin); deciles of predicted probability
// must match observed frequency. Censored moments with censorAt >= 24 are
// answerable "no"; censored earlier are unanswerable and skipped.
{
    const scored = [];
    for (const s of pooled) {
        let observed;
        if (s.wait !== null) observed = s.wait <= 24 ? 1 : 0;
        else if (s.censorAt >= 24) observed = 0;
        else continue;
        const bin = Math.min(BINS - 1, Math.max(0, Math.floor(s.elapsed / BIN_HOURS)));
        scored.push({ predicted: states[s.state][bin].p24, observed });
    }
    assert(scored.length > 10000, `too few reliability moments: ${scored.length}`);
    scored.sort((a, b) => a.predicted - b.predicted);

    const overallPred = scored.reduce((s, r) => s + r.predicted, 0) / scored.length;
    const overallObs = scored.reduce((s, r) => s + r.observed, 0) / scored.length;
    console.log(
        `reliability overall: predicted ${overallPred.toFixed(3)} vs observed ${overallObs.toFixed(3)}`,
    );
    assert(
        Math.abs(overallPred - overallObs) <= 0.05,
        `overall reliability gap ${Math.abs(overallPred - overallObs).toFixed(3)} > 0.05 — REFUSING to emit`,
    );

    const perDecile = Math.floor(scored.length / 10);
    for (let d = 0; d < 10; d++) {
        const bucket = scored.slice(d * perDecile, (d + 1) * perDecile);
        if (bucket.length < 100) continue;
        const mp = bucket.reduce((s, r) => s + r.predicted, 0) / bucket.length;
        const mo = bucket.reduce((s, r) => s + r.observed, 0) / bucket.length;
        console.log(
            `  decile ${d}: predicted ${mp.toFixed(3)} vs observed ${mo.toFixed(3)} (n=${bucket.length})`,
        );
        assert(
            Math.abs(mp - mo) <= 0.1,
            `decile ${d} reliability gap ${Math.abs(mp - mo).toFixed(3)} > 0.10 — REFUSING to emit`,
        );
    }
    console.log('reliability checks OK');
}

// --- emit -------------------------------------------------------------------

const model = {
    meta: {
        binHours: BIN_HOURS,
        bins: BINS,
        k: KNN_K,
        minCell: MIN_CELL,
        seasons: ds.seasons.size,
        trainStarts: trainStartCount,
    },
    states,
};
fs.writeFileSync(
    OUT_PATH,
    `// Generated by scripts/analysis/08-emit-wave-model.mjs — do not edit by hand.\n` +
        `// Regenerate: node --env-file=.env.development scripts/analysis/08-emit-wave-model.mjs\n` +
        `export default Object.freeze(${JSON.stringify(model)});\n`,
);
console.log(`emitted ${OUT_PATH} (${fs.statSync(OUT_PATH).size} bytes)`);
```

- [ ] **Step 3: Run the script and eyeball the output**

Run (from the worktree root): `mise exec -- node --env-file=.env.development scripts/analysis/08-emit-wave-model.mjs`
Expected: pure self-checks OK → structural checks OK → a 10-row reliability table with per-decile gaps ≤ 0.10 → `emitted .../waveModel.mjs`. Sanity-read the file: `NORMAL` p50 near 18–20h at bin 0 falling with elapsed; `SC9` p50 in the 40–55h range at low bins (matches the attempt-3 tables). If a reliability assert fires, STOP and report — do not loosen the tolerance (that is the spec's honesty gate).

- [ ] **Step 4: Document in scripts/README.md**

Append to the `### Layout` list (after the `07-train-state-model.mjs` bullet):

```markdown
- `08-emit-wave-model.mjs` -- emits the committed lookup table behind the
  dashboard's next-wave card (`src/features/dashboard/waveModel.mjs`): the
  attempt-3 STATE-KM estimator fit on full history, one row per observable
  state x 1h elapsed bin, plus within-24h/48h probabilities. Refuses to emit
  unless quantiles are monotone and the predicted probabilities are reliable
  against history (deciles within ±0.10, overall ±0.05).
```

And to the `### Running` block:

```
node --env-file=.env.development scripts/analysis/08-emit-wave-model.mjs
```

- [ ] **Step 5: Commit**

```bash
git add scripts/analysis/08-emit-wave-model.mjs src/features/dashboard/waveModel.mjs scripts/README.md
git commit -m "feat(next-wave-card): emit committed state x elapsed wave model

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: `waveForecast` pure util (TDD)

**Files:**
- Create: `src/features/dashboard/waveForecast.mjs`
- Test: `src/__tests__/unit/features/dashboard/waveForecast.test.mjs`

**Interfaces:**
- Consumes: `src/features/dashboard/waveModel.mjs` default export (Task 1 shape); `EVENT_TYPE`, `EVENT_STATUS` from `@/shared/enums/events.mjs` — but the util takes the model as an injectable third parameter defaulting to the real one, so tests never touch the generated file.
- Produces (Task 3/4 rely on these exact names):
  - `waveForecast(data, nowSeconds, model?)` → `{ mode: 'window', p25, p50, p75, p24, p48, state, imminent, runningLong, lastTrainStart }` or `{ mode: 'hidden', reason: 'wave-active' | 'no-train-yet' | 'no-data' }`
  - `deriveTrainStarts(defends)` → the subset of defends that start a train, sorted by `start_time`
  - `IMMINENT_THRESHOLD` (0.51)

- [ ] **Step 1: Write the failing tests**

```js
// src/__tests__/unit/features/dashboard/waveForecast.test.mjs
import {
    waveForecast,
    deriveTrainStarts,
    IMMINENT_THRESHOLD,
} from '@/features/dashboard/waveForecast.mjs';

const HOUR = 3600;

/** A model where every lookup is recognizable per state. */
const row = (p25, p50, p75, p24, p48) => ({ p25, p50, p75, p24, p48 });
const rows = (r) => Array.from({ length: 168 }, () => r);
const MODEL = {
    meta: { binHours: 1, bins: 168 },
    states: {
        NORMAL: rows(row(10, 20, 30, 0.6, 0.9)),
        SC9: rows(row(31, 45, 58, 0.2, 0.55)),
        SC10: rows(row(9, 19, 31, 0.62, 0.91)),
        ATTACK: rows(row(12, 25, 40, 0.45, 0.8)),
    },
};

/** Minimal live-payload factory: one healthy faction, one finished train. */
function makeData({ events, status } = {}) {
    return {
        events: events ?? [
            // A single-defend train that ended 30h before NOW (t=1000000).
            {
                type: 'defend',
                enemy: 0,
                region: 5,
                start_time: 1000000 - 40 * HOUR,
                end_time: 1000000 - 30 * HOUR,
                status: 'fail',
            },
        ],
        status: status ?? [
            { enemy: 0, points: 5000, points_max: 10000, status: 'active' },
            { enemy: 1, points: 0, points_max: 0, status: 'hidden' },
            { enemy: 2, points: 0, points_max: 0, status: 'hidden' },
        ],
    };
}
const NOW = 1000000;

describe('deriveTrainStarts', () => {
    test('first defend of a faction is a train start', () => {
        const d = [{ enemy: 0, start_time: 100, end_time: 200 }];
        expect(deriveTrainStarts(d)).toHaveLength(1);
    });

    test('same-faction defend within 600s of previous end is NOT a start', () => {
        const d = [
            { enemy: 0, start_time: 100, end_time: 200 },
            { enemy: 0, start_time: 500, end_time: 900 }, // 300s after end
        ];
        expect(deriveTrainStarts(d)).toHaveLength(1);
    });

    test('same-faction defend more than 600s after previous end IS a start', () => {
        const d = [
            { enemy: 0, start_time: 100, end_time: 200 },
            { enemy: 0, start_time: 900, end_time: 1000 }, // 700s after end
        ];
        expect(deriveTrainStarts(d)).toHaveLength(2);
    });

    test('cross-faction proximity does not chain', () => {
        const d = [
            { enemy: 0, start_time: 100, end_time: 200 },
            { enemy: 1, start_time: 300, end_time: 400 }, // 100s after enemy 0 end
        ];
        expect(deriveTrainStarts(d)).toHaveLength(2);
    });
});

describe('waveForecast hidden modes', () => {
    test('hidden while a defend is active', () => {
        const data = makeData();
        data.events.push({
            type: 'defend',
            enemy: 1,
            region: 3,
            start_time: NOW - HOUR,
            end_time: NOW + HOUR,
            status: 'active',
        });
        expect(waveForecast(data, NOW, MODEL)).toEqual({
            mode: 'hidden',
            reason: 'wave-active',
        });
    });

    test('hidden when the season has no defends yet', () => {
        const data = makeData({ events: [] });
        expect(waveForecast(data, NOW, MODEL)).toEqual({
            mode: 'hidden',
            reason: 'no-train-yet',
        });
    });

    test('hidden on missing payload pieces', () => {
        expect(waveForecast(null, NOW, MODEL).reason).toBe('no-data');
        expect(waveForecast({ events: null, status: [] }, NOW, MODEL).reason).toBe(
            'no-data',
        );
        expect(waveForecast(makeData(), NOW, null).reason).toBe('no-data');
        expect(
            waveForecast(makeData(), NOW, { meta: {}, states: {} }).reason,
        ).toBe('no-data');
    });
});

describe('waveForecast window mode', () => {
    test('NORMAL state looks up the NORMAL row and derives flags', () => {
        const f = waveForecast(makeData(), NOW, MODEL);
        expect(f).toMatchObject({
            mode: 'window',
            state: 'NORMAL',
            p25: 10,
            p50: 20,
            p75: 30,
            p24: 0.6,
            p48: 0.9,
            runningLong: false,
        });
        expect(f.imminent).toBe(true); // 0.6 >= 0.51
        expect(f.lastTrainStart).toBe(NOW - 40 * HOUR);
    });

    test('SC9 when a faction holds 9 of 10 sectors; runningLong, not imminent', () => {
        const data = makeData({
            status: [
                { enemy: 0, points: 9200, points_max: 10000, status: 'active' },
                { enemy: 1, points: 0, points_max: 0, status: 'hidden' },
                { enemy: 2, points: 0, points_max: 0, status: 'hidden' },
            ],
        });
        const f = waveForecast(data, NOW, MODEL);
        expect(f.state).toBe('SC9');
        expect(f.runningLong).toBe(true);
        expect(f.imminent).toBe(false); // 0.2 < IMMINENT_THRESHOLD
    });

    test('an active ATTACK outranks SC9', () => {
        const data = makeData({
            status: [
                { enemy: 0, points: 9200, points_max: 10000, status: 'active' },
                { enemy: 1, points: 0, points_max: 0, status: 'hidden' },
                { enemy: 2, points: 0, points_max: 0, status: 'hidden' },
            ],
        });
        data.events.push({
            type: 'attack',
            enemy: 0,
            region: 11,
            start_time: NOW - 2 * HOUR,
            end_time: NOW + 10 * HOUR,
            status: 'active',
        });
        expect(waveForecast(data, NOW, MODEL).state).toBe('ATTACK');
    });

    test('elapsed clamps to the last bin and negative elapsed to bin 0', () => {
        // 300h since the only train start — way past 167 bins.
        const data = makeData({
            events: [
                {
                    type: 'defend',
                    enemy: 0,
                    region: 5,
                    start_time: NOW - 300 * HOUR,
                    end_time: NOW - 299 * HOUR,
                    status: 'success',
                },
            ],
        });
        expect(waveForecast(data, NOW, MODEL).mode).toBe('window');
        // Train "starting" in the future (clock skew) must not crash.
        const skew = makeData({
            events: [
                {
                    type: 'defend',
                    enemy: 0,
                    region: 5,
                    start_time: NOW + HOUR,
                    end_time: NOW + 2 * HOUR,
                    status: 'fail',
                },
            ],
        });
        expect(waveForecast(skew, NOW, MODEL).mode).toBe('window');
    });

    test('IMMINENT_THRESHOLD is the spec value', () => {
        expect(IMMINENT_THRESHOLD).toBe(0.51);
    });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `mise exec -- npx vitest run src/__tests__/unit/features/dashboard/waveForecast.test.mjs`
Expected: FAIL — module `waveForecast.mjs` not found.

- [ ] **Step 3: Write the implementation**

```js
// src/features/dashboard/waveForecast.mjs
/**
 * waveForecast — pure lookup from the live payload into the committed
 * next-wave model (waveModel.mjs, emitted by scripts/analysis/08).
 *
 * Total function: every failure path returns { mode: 'hidden', reason }
 * rather than throwing, so the dashboard degrades to exactly its old UI.
 */
import defaultModel from '@/features/dashboard/waveModel.mjs';
import { EVENT_TYPE, EVENT_STATUS } from '@/shared/enums/events.mjs';

const CHAIN_SECONDS = 600;
const SECTOR_COUNT = 10;
export const IMMINENT_THRESHOLD = 0.51;

/**
 * Train-start derivation — the same rule as the #472 analysis
 * (scripts/analysis/lib/dataset.mjs): a defend starts a new train iff no
 * SAME-FACTION defend ended within CHAIN_SECONDS before it starts.
 *
 * @param {{enemy: number, start_time: number, end_time: number}[]} defends
 * @returns {{enemy: number, start_time: number, end_time: number}[]} train
 *   starts, ascending by start_time
 */
export function deriveTrainStarts(defends) {
    const byEnemy = new Map();
    for (const d of [...defends].sort((a, b) => a.start_time - b.start_time)) {
        if (!byEnemy.has(d.enemy)) byEnemy.set(d.enemy, []);
        byEnemy.get(d.enemy).push(d);
    }
    const starts = [];
    for (const list of byEnemy.values()) {
        for (let i = 0; i < list.length; i++) {
            const prev = i > 0 ? list[i - 1] : null;
            if (prev === null || list[i].start_time - prev.end_time > CHAIN_SECONDS) {
                starts.push(list[i]);
            }
        }
    }
    return starts.sort((a, b) => a.start_time - b.start_time);
}

/**
 * @param {object} model candidate wave model
 * @returns {boolean} true when it has 168-row tables for all four states
 */
function isValidModel(model) {
    const states = model?.states;
    return ['NORMAL', 'SC9', 'SC10', 'ATTACK'].every(
        (s) => Array.isArray(states?.[s]) && states[s].length === 168,
    );
}

/**
 * The card's forecast for "now", from the live payload alone.
 *
 * @param {{events: object[], status: object[]} | null} data live payload `data`
 * @param {number} nowSeconds unix seconds
 * @param {object} [model] injectable for tests; defaults to the committed model
 * @returns {{mode: 'window', p25: number, p50: number, p75: number,
 *   p24: number, p48: number, state: string, imminent: boolean,
 *   runningLong: boolean, lastTrainStart: number}
 *   | {mode: 'hidden', reason: 'wave-active'|'no-train-yet'|'no-data'}}
 */
export function waveForecast(data, nowSeconds, model = defaultModel) {
    if (
        !data ||
        !Array.isArray(data.events) ||
        !Array.isArray(data.status) ||
        !model ||
        !isValidModel(model)
    ) {
        return { mode: 'hidden', reason: 'no-data' };
    }

    const defends = data.events.filter((e) => e.type === EVENT_TYPE.DEFEND);
    if (defends.some((e) => e.status === EVENT_STATUS.ACTIVE)) {
        return { mode: 'hidden', reason: 'wave-active' };
    }

    const starts = deriveTrainStarts(defends);
    const last = starts.at(-1);
    if (!last) return { mode: 'hidden', reason: 'no-train-yet' };

    const attackActive = data.events.some(
        (e) => e.type === EVENT_TYPE.ATTACK && e.status === EVENT_STATUS.ACTIVE,
    );
    const scs = data.status
        .filter((r) => r.points_max > 0)
        .map((r) => Math.trunc(r.points / (r.points_max / SECTOR_COUNT)));
    const maxSC = scs.length > 0 ? Math.max(...scs) : null;
    const state =
        attackActive ? 'ATTACK'
        : maxSC === 9 ? 'SC9'
        : maxSC === 10 ? 'SC10'
        : 'NORMAL';

    const elapsedHours = Math.max(0, (nowSeconds - last.start_time) / 3600);
    const bin = Math.min(167, Math.floor(elapsedHours));
    const row = model.states[state][bin];

    return {
        mode: 'window',
        p25: row.p25,
        p50: row.p50,
        p75: row.p75,
        p24: row.p24,
        p48: row.p48,
        state,
        imminent: row.p24 >= IMMINENT_THRESHOLD,
        runningLong: state === 'SC9',
        lastTrainStart: last.start_time,
    };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `mise exec -- npx vitest run src/__tests__/unit/features/dashboard/waveForecast.test.mjs`
Expected: PASS (all tests).

- [ ] **Step 5: Commit**

```bash
git add src/features/dashboard/waveForecast.mjs src/__tests__/unit/features/dashboard/waveForecast.test.mjs
git commit -m "feat(next-wave-card): waveForecast pure util

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: `NextWaveCard` component (TDD)

**Files:**
- Create: `src/features/dashboard/NextWaveCard.jsx`
- Test: `src/__tests__/unit/features/dashboard/NextWaveCard.test.jsx`

**Interfaces:**
- Consumes: the Task 2 forecast object as a prop (`forecast`), plus `warStart` (unix seconds | null) and `now` (unix seconds). `dayOf` from `@/shared/utils/game/warClock.mjs`.
- Produces: `default export NextWaveCard({ forecast, warStart, now })` — renders `null` unless `forecast.mode === 'window'`. Task 4 mounts it.

- [ ] **Step 1: Write the failing tests**

```jsx
// @vitest-environment jsdom
// src/__tests__/unit/features/dashboard/NextWaveCard.test.jsx
import { render, screen } from '@testing-library/react';
import NextWaveCard from '@/features/dashboard/NextWaveCard';

const NOW = 1_700_000_000;
const WAR_START = NOW - 12 * 86400;

const windowForecast = (overrides = {}) => ({
    mode: 'window',
    p25: 14.2,
    p50: 22.5,
    p75: 31.8,
    p24: 0.63,
    p48: 0.91,
    state: 'NORMAL',
    imminent: true,
    runningLong: false,
    lastTrainStart: NOW - 20 * 3600,
    ...overrides,
});

describe('NextWaveCard', () => {
    test('renders nothing when hidden', () => {
        const { container } = render(
            <NextWaveCard
                forecast={{ mode: 'hidden', reason: 'wave-active' }}
                warStart={WAR_START}
                now={NOW}
            />,
        );
        expect(container).toBeEmptyDOMElement();
    });

    test('renders the band headline and surety', () => {
        render(
            <NextWaveCard forecast={windowForecast()} warStart={WAR_START} now={NOW} />,
        );
        expect(screen.getByText(/likely in/i)).toBeInTheDocument();
        expect(screen.getByText(/14–32h/)).toBeInTheDocument();
        expect(screen.getByText(/63% within 24h/i)).toBeInTheDocument();
        expect(screen.getByText(/next defend wave/i)).toBeInTheDocument();
    });

    test('IMMINENT badge follows the flag', () => {
        const { rerender } = render(
            <NextWaveCard forecast={windowForecast()} warStart={WAR_START} now={NOW} />,
        );
        expect(screen.getByText('IMMINENT')).toBeInTheDocument();
        rerender(
            <NextWaveCard
                forecast={windowForecast({ imminent: false, p24: 0.3 })}
                warStart={WAR_START}
                now={NOW}
            />,
        );
        expect(screen.queryByText('IMMINENT')).not.toBeInTheDocument();
    });

    test('RUNNING LONG badge + explainer in the SC9 state', () => {
        render(
            <NextWaveCard
                forecast={windowForecast({ state: 'SC9', runningLong: true })}
                warStart={WAR_START}
                now={NOW}
            />,
        );
        expect(screen.getByText('RUNNING LONG')).toBeInTheDocument();
        expect(screen.getByText(/homeworld assault/i)).toBeInTheDocument();
    });

    test('hover title carries absolute times, war day, 48h surety, typical miss', () => {
        render(
            <NextWaveCard forecast={windowForecast()} warStart={WAR_START} now={NOW} />,
        );
        const range = screen.getByText(/14–32h/);
        expect(range).toHaveAttribute('title');
        const title = range.getAttribute('title');
        expect(title).toMatch(/War Day \d+/);
        expect(title).toMatch(/91% within 48h/);
        expect(title).toMatch(/typical miss ±8h/);
    });

    test('docs link carries the umami event', () => {
        render(
            <NextWaveCard forecast={windowForecast()} warStart={WAR_START} now={NOW} />,
        );
        const link = screen.getByRole('link', { name: /how\?/i });
        expect(link).toHaveAttribute('href', '/docs/predict');
        expect(link).toHaveAttribute(
            'data-umami-event',
            'dashboard-wave-window-docs',
        );
    });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `mise exec -- npx vitest run src/__tests__/unit/features/dashboard/NextWaveCard.test.jsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the component**

```jsx
// src/features/dashboard/NextWaveCard.jsx
'use client';

import Link from 'next/link';
import { dayOf } from '@/shared/utils/game/warClock.mjs';

/**
 * @param {number} p25 hours
 * @param {number} p75 hours
 * @returns {string} e.g. "14–32h"
 */
function formatRange(p25, p75) {
    return `${Math.round(p25)}–${Math.round(p75)}h`;
}

/**
 * @param {number} t unix seconds
 * @returns {string} short local time, e.g. "Tue 14:00"
 */
function localTime(t) {
    return new Date(t * 1000).toLocaleString([], {
        weekday: 'short',
        hour: '2-digit',
        minute: '2-digit',
    });
}

/**
 * Live likelihood window for the next defend wave. Band, never a countdown:
 * copy always says "likely", numbers are the calibrated 50% band and the
 * reliability-checked within-24h probability from waveModel.mjs.
 *
 * @param {object} props
 * @param {ReturnType<typeof import('./waveForecast.mjs').waveForecast>} props.forecast
 * @param {number | null} props.warStart unix seconds anchor for war-day labels
 * @param {number} props.now unix seconds
 */
export default function NextWaveCard({ forecast, warStart, now }) {
    if (forecast?.mode !== 'window') return null;

    const { p25, p75, p24, p48, imminent, runningLong } = forecast;
    const from = now + p25 * 3600;
    const to = now + p75 * 3600;
    const warDays =
        warStart != null ?
            ` · War Day ${dayOf(from, warStart)}–${dayOf(to, warStart)}`
        :   '';
    const title = `${localTime(from)} – ${localTime(to)} (your time)${warDays} · ${Math.round(p48 * 100)}% within 48h · typical miss ±8h`;

    const axisHours = Math.max(48, Math.ceil(p75 / 12) * 12);
    const left = `${(p25 / axisHours) * 100}%`;
    const width = `${((p75 - p25) / axisHours) * 100}%`;

    return (
        <div className="card border-r-[6px] border-r-primary p-3">
            <div className="flex items-baseline justify-between gap-2">
                <span className="font-mono text-small tracking-widest text-text-muted">
                    NEXT DEFEND WAVE
                </span>
                <span className="flex items-center gap-2">
                    {imminent && (
                        <span className="border border-primary px-1 font-mono text-small text-primary">
                            IMMINENT
                        </span>
                    )}
                    {runningLong && (
                        <span className="border border-warning px-1 font-mono text-small text-warning">
                            RUNNING LONG
                        </span>
                    )}
                    <Link
                        href="/docs/predict"
                        data-umami-event="dashboard-wave-window-docs"
                        className="font-mono text-small text-text-muted underline"
                    >
                        how?
                    </Link>
                </span>
            </div>
            <p className="mb-1! mt-1 text-body">
                likely in{' '}
                <b className="font-mono text-primary" title={title}>
                    {formatRange(p25, p75)}
                </b>{' '}
                <span className="text-text-muted">
                    · {Math.round(p24 * 100)}% within 24h
                </span>
            </p>
            <div className="relative h-2 bg-surface-3">
                <span
                    className="absolute inset-y-0 bg-primary opacity-85"
                    style={{ left, width }}
                />
            </div>
            {runningLong && (
                <p className="mb-0! mt-1 font-mono text-small text-text-muted">
                    A faction is 1 sector from homeworld assault — waves pause in
                    this window
                </p>
            )}
        </div>
    );
}
```

Note: if `npm run typecheck` rejects the `props.forecast` JSDoc conditional-type line, replace it with `@param {object} props.forecast` — do not fight tsc over a display component's prop type.

- [ ] **Step 4: Run tests to verify they pass**

Run: `mise exec -- npx vitest run src/__tests__/unit/features/dashboard/NextWaveCard.test.jsx`
Expected: PASS. If `14–32h` fails, check the en-dash: `formatRange` and the tests both use `–` (U+2013), not `-`.

- [ ] **Step 5: Commit**

```bash
git add src/features/dashboard/NextWaveCard.jsx src/__tests__/unit/features/dashboard/NextWaveCard.test.jsx
git commit -m "feat(next-wave-card): NextWaveCard component

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 4: Mount in DashboardClient + CHANGELOG + full verification

**Files:**
- Modify: `src/features/dashboard/DashboardClient.jsx` (imports block ~lines 4–22; Regions section ~line 304)
- Modify: `src/__tests__/unit/features/dashboard/DashboardClient.test.jsx` (only if the new card breaks existing assertions)
- Modify: `CHANGELOG.md` (top)

**Interfaces:**
- Consumes: `waveForecast` (Task 2), `NextWaveCard` (Task 3), `useLiveDataContext`'s `data` (already in the file).

- [ ] **Step 1: Wire the card into the Regions section**

Add imports next to the existing dashboard imports:

```js
import NextWaveCard from '@/features/dashboard/NextWaveCard';
import { waveForecast } from '@/features/dashboard/waveForecast.mjs';
```

After the `const pulseDelays = ...` line (inside the component, after the `!data` guard), add:

```js
const nowSeconds = Math.floor(Date.now() / 1000);
const forecast = waveForecast(data, nowSeconds);
```

In the Regions section, mount the card inside the existing error boundary, above the faction-card list:

```jsx
<ComponentErrorBoundary name="Regions">
    <NextWaveCard forecast={forecast} warStart={data.war_start} now={nowSeconds} />
    <ul className="sector-grid list-none p-0">
```

(Only the `<NextWaveCard ... />` line is new; the boundary and `<ul>` already exist.)

- [ ] **Step 2: Run the dashboard test suites; fix expectations only if the card broke them**

Run: `mise exec -- npx vitest run src/__tests__/unit/features/dashboard/`
Expected: PASS. If `DashboardClient.test.jsx` fails because its fixture now renders the card (fixtures with a completed defend train and no active defend), the fix is in the test file, not the component: either assert the card's presence (`screen.getByText(/next defend wave/i)`) or make the fixture's forecast hidden (an `active` defend event) — pick whichever matches what that fixture is trying to test.

- [ ] **Step 3: CHANGELOG entry**

Add under a new `## Unreleased` section at the top of `CHANGELOG.md` (create the section — v0.72.0 is currently the top):

```markdown
## Unreleased

### Added

- **Next-wave likelihood card on the dashboard** (`NextWaveCard`): a faction-neutral
  band-not-countdown forecast for the next defend wave — "likely in 14–32h · 63%
  within 24h" — computed from a committed state×elapsed quantile table
  (`scripts/analysis/08-emit-wave-model.mjs`, the #472 attempt-3 STATE-KM model fit on
  full history, with a reliability self-check that refuses to emit miscalibrated
  probabilities). Hidden while a wave runs; IMMINENT badge at ≥51% within 24h;
  RUNNING LONG badge + explainer during the homeworld-assault window (maxSC==9).
  Updates on the existing 10s live poll; no API or DB changes.
```

- [ ] **Step 4: Full verification chain**

```bash
mise exec -- npm run lint:fix
mise exec -- npm run lint
mise exec -- npm run typecheck
mise exec -- npm run test:unit
set -a && . ./.env.development && set +a && mise exec -- npm run build
```

Expected: lint 0 errors (jsdoc warnings are repo status quo), typecheck clean, all unit tests pass, build completes. Report any failure verbatim — do not suppress.

- [ ] **Step 5: Visual check on the dev server**

The dev server runs from the MAIN checkout on `develop` — it will not show worktree code. Either ask the user to point it at the worktree or run a second dev server from the worktree on another port: `mise exec -- npx next dev -p 3001`. Then, per CLAUDE.md § DevTools Verification, load `http://localhost:3001` and verify via Chrome DevTools MCP: the card renders above the faction cards (or is absent if a wave is live right now — check `/api/h1/live` for an active defend to know which to expect), `getBoundingClientRect()` shows no overflow against the sidebar column, and the band fill sits inside the bar on all sides.

- [ ] **Step 6: Commit**

```bash
git add src/features/dashboard/DashboardClient.jsx src/__tests__/unit/features/dashboard/DashboardClient.test.jsx CHANGELOG.md
git commit -m "feat(next-wave-card): mount card in dashboard Regions section

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Merge (not a plan task — follow the repo workflow)

Use `superpowers:finishing-a-development-branch`: merge `feature/next-wave-card` into `develop` with `git merge --no-ff`, moving the CHANGELOG `## Unreleased` entries into a new `## 0.73.0` section and bumping `package.json` + lockfile to `0.73.0` **in the merge commit** (minor bump — new feature), push, remove the worktree, delete the branch, close the Task-1 issue with an implementation comment. Remind the user: no Prisma migrations in this branch, nothing to deploy-migrate.
