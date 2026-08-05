# Next-Event Timing Forecast Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Determine, with numbers, whether the start time of the next HD1 event is predictable well enough to be worth shipping — and record the answer on [#472](https://github.com/elfensky/helldivers.bot/issues/472).

**Architecture:** Four throwaway Node scripts under `scripts/analysis/`, sharing one data loader and one backtest harness. Phase 1 tests whether attacks fire on a deterministic campaign-state rule (which would end the investigation). Phase 2 establishes a features-free renewal-hazard baseline plus the walk-forward harness. Phase 3 adds features and must beat phase 2 to justify itself.

**Tech Stack:** Node 24, `pg` (already present transitively via `@prisma/adapter-pg`, and already imported directly by `scripts/backfill-h1-tables.mjs`), `node:assert/strict`. No statistics libraries, no new dependencies.

**Spec:** `docs/superpowers/specs/2026-07-27-next-event-timing-forecast-design.md`

## Design-debate corrections (v2)

A blinded multi-model review (Codex, Copilot, Sonnet, Opus) endorsed the
approach and rejected the instrumentation. Seven corrections are now baked into
the tasks below. **They are load-bearing — do not simplify them back out.**

| #   | Correction                                                        | Task | Why it matters                                                                                                                     |
| --- | ----------------------------------------------------------------- | ---- | ---------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `playerPercentileInSeason` uses an expanding within-season window | 1    | Whole-season ranking leaks the future past the season-number leakage assert. The only defect that silently inverts the conclusion. |
| 2   | Gaps scoped by `(type, enemy)`, not `type`                        | 1    | Mixing factions makes a Cyborg attack "the previous attack" for a Bug one.                                                         |
| 3   | Censored moments kept and scored one-sided                        | 4    | Dropping them removed 14.9% of attack moments / 8.5% of defend — structurally the longest waits.                                   |
| 4   | Baseline = median forward-recurrence wait, not median gap         | 4    | Measured: 54.5h vs 46.8h, inflating every skill ratio ~12% against a 0.6 gate.                                                     |
| 5   | `effectiveN` + season block-bootstrap CI on skill ratio           | 4, 5 | 18,810 moments come from 774 real intervals; precision overstated ~4.9x. The gate reads the CI, not the point estimate.            |
| 6   | Phase 1 permutation test + Bonferroni across 5 variables          | 2, 3 | One uncorrected fluke halts the entire investigation through the Task 3 routing gate.                                              |
| 7   | Defend estimand split: P(chain) + conditional lull length         | 5    | 63% of defends chain, so a pooled defend score is winnable by always predicting ~0.                                                |

Debate record: `~/.claude-octopus/debates/local/001-next-event-forecast-plan/`

## Global Constraints

- **No new npm dependencies.** `pg` and `node:assert` only.
- **No `tryCatch` wrapper.** These are throwaway scripts — let them throw with a real stack. The `tryCatch` convention in CLAUDE.md governs app code.
- **No vitest files.** `src/__tests__/unit/_meta/mirrorTree.test.mjs` resolves test paths only against the `src` and `public` roots, so any test for `scripts/` fails the mirror rule. Verification is inline `assert` in a self-check block per module.
- **Runs outside Next.js.** Relative imports only — the `@/*` alias does not resolve here. Same constraint as `scripts/backfill-h1-tables.mjs`.
- **Invocation:** `node --env-file=.env.development scripts/analysis/<file>.mjs`. Do not add `dotenv` imports.
- **Node version:** `mise.toml` pins node 24. Run `node --version` first; if it reports 26.x, mise is untrusted and the shell has fallen back to homebrew node. Run `mise trust && mise install` to fix. Scripts work on both, but stay on the pinned version.
- **Every script is deterministic.** Where sampling is needed, use the seeded LCG from `lib/dataset.mjs` — never `Math.random()`. Re-runs must reproduce the numbers exactly.
- **`npm run lint:fix` before every commit.** `scripts/` is linted (not in the eslint `ignores` list), and Prettier runs as an ESLint rule.
- **`npm run typecheck` does not cover `scripts/`.** `jsconfig.json` `include` is `src/**` only. Do not add `scripts/` to it.
- **Enemy ids:** `0` = Bugs, `1` = Cyborgs, `2` = Illuminate.
- **`SECTOR_COUNT` is 10.** Liberation is `points / points_max`; sectors captured is `Math.trunc(points / (points_max / 10))`. Matches `src/shared/utils/game/computeMapState.mjs`.

---

## File Structure

| File                                   | Responsibility                                                                                                        |
| -------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `scripts/analysis/lib/dataset.mjs`     | Load all three tables once, attach derived per-event fields, expose `statusAt` point-in-time lookup and a seeded RNG. |
| `scripts/analysis/lib/backtest.mjs`    | Walk-forward-by-season harness and the three scores. Knows nothing about any particular predictor.                    |
| `scripts/analysis/01-trigger-hunt.mjs` | Concentration-vs-control test for a deterministic attack trigger.                                                     |
| `scripts/analysis/02-baseline.mjs`     | Empirical residual-life predictor, run through the harness. The yardstick.                                            |
| `scripts/analysis/03-hazard.mjs`       | Daily discrete-time hazard with features, same harness. Written only if Task 3 says no rule exists.                   |
| `scripts/README.md`                    | Add an `## analysis/` section documenting how to run the above.                                                       |

**Deviation from spec, deliberate:** the spec places the backtest harness inside `02-baseline.mjs` and has phase 3 "reuse it verbatim". Importing a harness from a numbered run-script is awkward, so it lives in `lib/backtest.mjs`. Same code, same reuse, cleaner seam.

---

### Task 1: Data loader

**Files:**

- Create: `scripts/analysis/lib/dataset.mjs`

**Interfaces:**

- Consumes: nothing (first task).
- Produces:
    - `loadDataset(): Promise<Dataset>` where `Dataset` is
      `{ events: Event[], seasons: Map<number, Season>, statusAt(season, enemy, t): StatusRow|null, liberationAt(season, enemy, t): number|null }`
    - `Event` = the `h1_event` row (`season, type, event_id, start_time, end_time, region, enemy, points, points_max, status, players_at_start`) plus derived `idleSeconds: number|null`, `hoursSinceLastSameType: number|null`, `playerPercentileInSeason: number`.
    - `Season` = `{ season: number, pointsMax: number[], firstStart: number, lastEnd: number, spanSeconds: number }`
    - `StatusRow` = `{ season, enemy, bucket, time, points, points_taken, status }`
    - `makeRng(seed: number): () => number` — seeded LCG returning `[0, 1)`.
    - Constants `HOUR = 3600`, `DAY = 86400`, `SECTOR_COUNT = 10`.

- [ ] **Step 1: Write the self-check first (it will fail — the module has no implementation yet)**

Create `scripts/analysis/lib/dataset.mjs` containing ONLY this block for now:

```js
/**
 * dataset.mjs — the single data loader for the #472 next-event timing analysis.
 *
 * Runs outside Next.js: relative imports only, no `@/*` alias.
 *
 * Library:    import { loadDataset } from './lib/dataset.mjs';
 * Self-check: node --env-file=.env.development scripts/analysis/lib/dataset.mjs
 */

import assert from 'node:assert/strict';

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

    // The RNG is deterministic.
    const a = makeRng(42);
    const b = makeRng(42);
    assert.equal(a(), b(), 'makeRng is not deterministic');

    console.log(
        `dataset self-check OK — ${ds.events.length} events, ${ds.seasons.size} seasons`,
    );
}
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node --env-file=.env.development scripts/analysis/lib/dataset.mjs`
Expected: FAIL with `ReferenceError: loadDataset is not defined`

- [ ] **Step 3: Implement the module**

Insert this ABOVE the `if (import.meta.filename === process.argv[1])` block, directly after the `import assert` line:

```js
import pg from 'pg';

export const HOUR = 3600;
export const DAY = 86400;
export const SECTOR_COUNT = 10;

/**
 * Seeded linear congruential generator (Numerical Recipes constants).
 * Deterministic so re-runs reproduce the exact same numbers.
 *
 * @param {number} seed
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
     * @param {number} season
     * @param {number} enemy
     * @param {number} t unix seconds
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
     * @returns {number|null} null when status or points_max is unavailable
     */
    function liberationAt(season, enemy, t) {
        const st = statusAt(season, enemy, t);
        if (!st) return null;
        const max = seasons.get(season)?.pointsMax?.[enemy] ?? 0;
        if (!(max > 0)) return null;
        return st.points / max;
    }

    return { events, seasons, statusAt, liberationAt };
}
```

- [ ] **Step 4: Run the self-check to verify it passes**

Run: `node --env-file=.env.development scripts/analysis/lib/dataset.mjs`
Expected: PASS — `dataset self-check OK — 6013 events, 160 seasons`

If the event count differs from 6013, that is fine (the DB may have advanced); the spec's numbers were taken on 2026-07-27. Note the new count for the findings comment.

- [ ] **Step 5: Lint and commit**

```bash
npm run lint:fix
npm run lint
git add scripts/analysis/lib/dataset.mjs
git commit -m "analysis(472): data loader with point-in-time status lookup"
```

---

### Task 2: Trigger hunt

**Files:**

- Create: `scripts/analysis/01-trigger-hunt.mjs`

**Interfaces:**

- Consumes: `loadDataset`, `makeRng`, `DAY`, `HOUR`, `SECTOR_COUNT` from `./lib/dataset.mjs`.
- Produces: console output only. No exports — this is a run-script.

**Method:** for each attack, sample the campaign-state variables at its start; for a control, sample the same variables at seeded-random times inside the same season that are at least 3h from any attack start of that enemy. A deterministic trigger shows as a _collapsed_ distribution at attack starts relative to control.

**Refinement of the spec:** the spec says "fraction of attacks falling inside the tightest 10% band", which is under-specified. This task uses two concrete concentration ratios instead — `IQR_attack / IQR_control` and `span05_95_attack / span05_95_control`. Both are ≪1 when a rule exists. Record this refinement in the findings comment.

- [ ] **Step 1: Write the self-check first**

Create `scripts/analysis/01-trigger-hunt.mjs` with ONLY this block:

```js
/**
 * 01-trigger-hunt.mjs — does HD1 fire attack events on a deterministic
 * campaign-state rule? If so there is nothing to forecast and #472 ends here.
 *
 * Run: node --env-file=.env.development scripts/analysis/01-trigger-hunt.mjs
 */

import assert from 'node:assert/strict';

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
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node --env-file=.env.development scripts/analysis/01-trigger-hunt.mjs`
Expected: FAIL with `ReferenceError: quantile is not defined`

- [ ] **Step 3: Add the pure helpers**

Insert directly after the `import assert` line, above the self-check block:

```js
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
```

- [ ] **Step 4: Run the self-check to verify it passes**

Run: `node --env-file=.env.development scripts/analysis/01-trigger-hunt.mjs`
Expected: PASS — exits silently with code 0 (no output yet).

- [ ] **Step 5: Add the analysis body**

Append below the self-check block:

```js
// --- variable extraction ---------------------------------------------------

const VARIABLES = [
    'liberation',
    'sectorsCaptured',
    'daysIntoSeason',
    'hoursSincePrevAttackEnd',
    'playerPercentile',
];

/**
 * Campaign-state variables for one faction at one instant.
 *
 * @param {object} ds dataset
 * @param {number} season
 * @param {number} enemy
 * @param {number} t unix seconds
 * @param {object|null} prevAttack most recent attack of this enemy before `t`
 * @param {number} playerPercentile percentile carried from the reference event
 * @returns {object} variable name -> number|null
 */
function stateAt(ds, season, enemy, t, prevAttack, playerPercentile) {
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
        hoursSincePrevAttackEnd: prevAttack ? (t - prevAttack.end_time) / HOUR : null,
        playerPercentile,
    };
}

const ds = await loadDataset();
const rng = makeRng(20260727);

const attacks = ds.events.filter((e) => e.type === 'attack');
const attacksBySeasonEnemy = new Map();
for (const a of attacks) {
    const key = `${a.season}:${a.enemy}`;
    if (!attacksBySeasonEnemy.has(key)) attacksBySeasonEnemy.set(key, []);
    attacksBySeasonEnemy.get(key).push(a);
}

/** @type {Record<string, number[]>} */
const atAttack = Object.fromEntries(VARIABLES.map((v) => [v, []]));
/** @type {Record<string, number[]>} */
const atControl = Object.fromEntries(VARIABLES.map((v) => [v, []]));

const CONTROLS_PER_ATTACK = 5;
const EXCLUSION_HOURS = 3;

// Seasons usable as phase-matched control donors.
const candidateSeasons = [...ds.seasons.values()].filter((s) => s.spanSeconds > 0);

let controlsAttempted = 0;
let controlsRejected = 0;

for (const a of attacks) {
    const siblings = attacksBySeasonEnemy.get(`${a.season}:${a.enemy}`) ?? [];
    const prevAttack = siblings.filter((s) => s.start_time < a.start_time).at(-1) ?? null;

    const vars = stateAt(
        ds,
        a.season,
        a.enemy,
        a.start_time,
        prevAttack,
        a.playerPercentileInSeason,
    );
    for (const v of VARIABLES) {
        if (vars[v] !== null && Number.isFinite(vars[v])) atAttack[v].push(vars[v]);
    }

    // PHASE-MATCHED controls, drawn from OTHER seasons at the SAME fractional
    // point through the war.
    //
    // Uniform same-season controls are confounded: liberation rises roughly
    // monotonically with season phase, so if attacks merely cluster in a
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
            attacksBySeasonEnemy.get(`${other.season}:${a.enemy}`) ?? [];
        const tooClose = otherSiblings.some(
            (s) => Math.abs(s.start_time - t) < EXCLUSION_HOURS * HOUR,
        );
        if (tooClose) {
            controlsRejected++;
            continue;
        }
        const prev = otherSiblings.filter((s) => s.start_time < t).at(-1) ?? null;
        const cVars = stateAt(
            ds,
            other.season,
            a.enemy,
            t,
            prev,
            a.playerPercentileInSeason,
        );
        for (const v of VARIABLES) {
            if (cVars[v] !== null && Number.isFinite(cVars[v])) {
                atControl[v].push(cVars[v]);
            }
        }
    }
}

// --- report ----------------------------------------------------------------

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

console.log(`\n=== Phase 1: trigger hunt ===`);
console.log(
    `attacks=${attacks.length}  controls attempted=${controlsAttempted}  rejected=${controlsRejected}`,
);
console.log(
    `controls are PHASE-MATCHED from other seasons; ${PERMUTATIONS} permutations; Bonferroni alpha=${ALPHA.toFixed(4)} across ${VARIABLES.length} variables\n`,
);

const permRng = makeRng(31337);
const verdicts = [];
for (const v of VARIABLES) {
    const A = summarize(atAttack[v]);
    const C = summarize(atControl[v]);
    const iqrRatio = ratio(A.iqr, C.iqr);
    const spanRatio = ratio(A.span, C.span);
    const pValue = permutationP(atAttack[v], atControl[v], permRng);

    // Rule-like now requires BOTH the effect size AND statistical significance
    // after correction. Either alone is not enough to halt the investigation.
    const effectLarge = iqrRatio <= RULE_IQR_RATIO && spanRatio <= RULE_SPAN_RATIO;
    const ruleLike = effectLarge && pValue < ALPHA;
    verdicts.push({ v, ruleLike, effectLarge, pValue });

    console.log(`${v}`);
    console.log(
        `  at attacks  n=${A.n}  p25=${fmt(A.p25)}  p50=${fmt(A.p50)}  p75=${fmt(A.p75)}  IQR=${fmt(A.iqr)}  p05-p95 span=${fmt(A.span)}`,
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

function fmt(x) {
    if (x === null || x === undefined) return 'n/a';
    if (!Number.isFinite(x)) return String(x);
    return x.toFixed(3);
}

const ruleLike = verdicts.filter((x) => x.ruleLike).map((x) => x.v);
const effectOnly = verdicts
    .filter((x) => x.effectLarge && !x.ruleLike)
    .map((x) => `${x.v} (p=${x.pValue.toFixed(4)})`);

console.log(
    ruleLike.length ?
        `VERDICT: rule-like variable(s): ${ruleLike.join(', ')} — investigate as a deterministic trigger before modelling.`
    :   `VERDICT: no deterministic trigger detectable at daily status resolution. Proceed to Phase 2.`,
);
if (effectOnly.length) {
    console.log(
        `NOTE: large effect but NOT significant after Bonferroni: ${effectOnly.join(', ')}. Do not halt on these.`,
    );
}
console.log(
    `\nCaveat: h1_status is ~1 bucket/day for 156 of 160 seasons, so campaign state at an attack start can be up to 24h stale. A real threshold would still concentrate, but smeared. A negative result here does NOT rule out a trigger.`,
);

// --- high-resolution re-test on S157-160 ----------------------------------

console.log(`\n=== Phase 1b: same test, S157-160 only (15-min status) ===`);
const hiRes = attacks.filter((a) => a.season >= 157);
if (hiRes.length < 5) {
    console.log(
        `only ${hiRes.length} attacks in S157-160 — too few for a meaningful re-test.`,
    );
} else {
    for (const v of VARIABLES) {
        const vals = [];
        for (const a of hiRes) {
            const siblings = attacksBySeasonEnemy.get(`${a.season}:${a.enemy}`) ?? [];
            const prev =
                siblings.filter((s) => s.start_time < a.start_time).at(-1) ?? null;
            const x = stateAt(
                ds,
                a.season,
                a.enemy,
                a.start_time,
                prev,
                a.playerPercentileInSeason,
            )[v];
            if (x !== null && Number.isFinite(x)) vals.push(x);
        }
        const S = summarize(vals);
        console.log(
            `${v}: n=${S.n} p25=${fmt(S.p25)} p50=${fmt(S.p50)} p75=${fmt(S.p75)} IQR=${fmt(S.iqr)}`,
        );
    }
}
```

- [ ] **Step 6: Run the full script**

Run: `node --env-file=.env.development scripts/analysis/01-trigger-hunt.mjs`
Expected: PASS — a per-variable table, a VERDICT line, and the S157–160 re-test.

Save the complete stdout to `/tmp/phase1.txt` for the findings comment:

```bash
node --env-file=.env.development scripts/analysis/01-trigger-hunt.mjs | tee /tmp/phase1.txt
```

- [ ] **Step 7: Lint and commit**

```bash
npm run lint:fix
npm run lint
git add scripts/analysis/01-trigger-hunt.mjs
git commit -m "analysis(472): trigger hunt — concentration vs control"
```

---

### Task 3: Interpret Phase 1 (decision gate, no code)

**Files:** none.

**Interfaces:**

- Consumes: the stdout of Task 2.
- Produces: a decision that routes the rest of the plan.

- [ ] **Step 1: Read the VERDICT line and the per-variable table**

- [ ] **Step 2: Apply the routing rule**

- **If any variable is RULE-LIKE** (large effect AND permutation `p < 0.01` after Bonferroni): stop. Do not implement Tasks 4–6. Write the findings comment (Task 7) reporting the rule, its threshold, and how many attacks obey it. The forecasting question is answered — it is a rule, not a forecast.
- **If a variable shows a large effect but does NOT survive Bonferroni:** do not halt. The script prints these separately under `NOTE:`. Record them in the findings comment as "suggestive, underpowered" and continue to Task 4. Halting the whole investigation on an uncorrected fluke across five simultaneous tests is exactly the failure this gate was rebuilt to prevent.
- **If no variable is RULE-LIKE:** continue to Task 4. Report in the findings comment that no trigger was detectable at daily resolution, and include the S157–160 re-test as corroboration.

- [ ] **Step 3: Report the decision to the user before continuing**

State which branch was taken and paste the VERDICT line plus the table. Do not proceed to Task 4 without surfacing this — it is the point of the whole phase.

---

### Task 4: Backtest harness

**Files:**

- Create: `scripts/analysis/lib/backtest.mjs`

**Interfaces:**

- Consumes: `HOUR` from `./dataset.mjs`.
- Produces:
    - `walkForward(options): Summary`
      where `options = { events, seasons, type, enemy, fitPredictor, stepHours = 3, firstEvalSeason = 21, horizonHours = 1500, bootstrapSamples = 200, momentFilter = null }`.
      `fitPredictor(trainEvents, ctx)` must return `predict(moment) -> {p25, p50, p75}` in **hours**. `moment` is `{ t, season, enemy, lastEvent }`. `ctx` is `{ testSeason, trainGaps, baselineConstant }`.
      `momentFilter(t, seasonEvents)` is optional; return `false` to exclude a moment (used for the defend lull estimand).
    - `Summary` = `{ moments, uncensored, censoredScored, censoredUnknown, warmupSkipped, effectiveN, calibration: {q25, q50, q75}, calibrationN: {q25, q50, q75}, sharpnessHours, medianAbsErrorHours, baselineMedianAbsErrorHours, skillRatio, skillRatioCI: [lo, hi] }`
    - `quantileOf(values, q): number|null` — re-exported so predictors share one definition.

**Three corrections from the design debate are baked into this task. Do not
"simplify" them back out:**

1. **Censored moments are kept, not dropped.** A moment at the end of a season
   with no subsequent event still carries information: the true wait is known to
   exceed the remaining span `c`. For a predicted quantile `q <= c`, the
   comparison `trueWait < q` is answerable — it is false. Only `q > c` is
   genuinely unknown. Dropping these removed 14.9% of attack moments and 8.5% of
   defend moments, and they are structurally the longest waits.
2. **The baseline constant is the median forward-recurrence wait, not the median
   gap.** Waits are sampled from a random clock, and forward recurrence time is
   not distributed like the gap. Measured on the real data: median gap 54.5h vs
   median forward recurrence 46.8h, which inflates every skill ratio by ~12%
   against a gate set at 0.6.
3. **Effective N is reported alongside `moments`.** 3h stepping yields ~18,810
   attack moments from only 774 real inter-arrival intervals — precision is
   overstated ~4.9x. `effectiveN` counts distinct target events; the skill ratio
   gets a season-level block-bootstrap CI so the 0.6 gate is read against noise.

- [ ] **Step 1: Write the self-check first**

Create `scripts/analysis/lib/backtest.mjs` with ONLY this block:

```js
/**
 * backtest.mjs — walk-forward-by-season evaluation for #472.
 *
 * Knows nothing about any particular predictor: callers supply `fitPredictor`.
 *
 * Self-check: node scripts/analysis/lib/backtest.mjs   (no DB needed)
 */

import assert from 'node:assert/strict';

if (import.meta.filename === process.argv[1]) {
    // A synthetic world: seasons 1..30, one 'attack' every 10h for 20 days.
    const events = [];
    const seasons = new Map();
    for (let s = 1; s <= 30; s++) {
        const base = s * 10_000_000;
        for (let k = 0; k < 48; k++) {
            events.push({
                season: s,
                type: 'attack',
                enemy: 0,
                start_time: base + k * 10 * 3600,
                end_time: base + k * 10 * 3600 + 3600,
            });
        }
        seasons.set(s, {
            season: s,
            firstStart: base,
            lastEnd: base + 48 * 10 * 3600,
            spanSeconds: 48 * 10 * 3600,
        });
    }

    // A predictor that knows the true period nails calibration and skill.
    const oracle = () => (moment) => {
        const elapsed = (moment.t - moment.lastEvent.start_time) / 3600;
        const wait = 10 - (elapsed % 10);
        return { p25: wait, p50: wait, p75: wait };
    };

    const good = walkForward({
        events,
        seasons,
        type: 'attack',
        enemy: 0,
        fitPredictor: oracle,
    });

    assert(good.moments > 0, 'no moments evaluated');
    assert(
        good.medianAbsErrorHours < 0.001,
        `oracle should be near-exact, got ${good.medianAbsErrorHours}`,
    );
    assert(good.skillRatio < 0.5, `oracle skill ratio too high: ${good.skillRatio}`);
    assert(good.sharpnessHours === 0, 'oracle bands should have zero width');

    // Effective N must count target EVENTS, not clock moments. With a 10h
    // period and 3h stepping there are ~3.3 moments per event, so effectiveN
    // has to come out far below `moments` — this is the guard against
    // reporting 4.9x-overstated precision.
    assert(
        good.effectiveN < good.moments / 2,
        `effectiveN (${good.effectiveN}) should be well under moments (${good.moments})`,
    );

    // Censored moments must be SCORED, not dropped. In this synthetic world the
    // clock runs to lastEnd, past the final event start, so censored moments
    // exist and the ones with q <= remaining span must be counted.
    assert(
        good.censoredScored > 0,
        'censored moments were not scored — the drop-bias is back',
    );

    // The bootstrap CI must bracket the point estimate.
    assert(
        good.skillRatioCI[0] <= good.skillRatio &&
            good.skillRatio <= good.skillRatioCI[1],
        `CI ${JSON.stringify(good.skillRatioCI)} does not bracket ${good.skillRatio}`,
    );

    // The baseline constant must be the forward-recurrence median, not the gap
    // median. With a perfectly periodic 10h process, forward recurrence from a
    // uniform clock averages ~5h while the gap is 10h — so a baseline built on
    // the gap would be visibly wrong. Assert the harness picked the right one.
    let capturedBaseline = null;
    walkForward({
        events,
        seasons,
        type: 'attack',
        enemy: 0,
        fitPredictor: (_trainEvents, ctx) => {
            capturedBaseline = ctx.baselineConstant;
            return () => ({ p25: 1, p50: 1, p75: 1 });
        },
        bootstrapSamples: 0,
    });
    assert(
        capturedBaseline !== null && capturedBaseline < 8,
        `baseline should be forward-recurrence (~5h), got ${capturedBaseline}`,
    );

    // momentFilter must actually exclude moments. Filter on the first half of
    // each season — NOT on `t % 2`, because every synthetic timestamp here is
    // even (base = s * 10_000_000, steps of 3h = 10800s) and that predicate
    // silently excludes nothing, making the assert vacuous.
    const filtered = walkForward({
        events,
        seasons,
        type: 'attack',
        enemy: 0,
        fitPredictor: oracle,
        momentFilter: (t, seasonEvents) =>
            t < seasonEvents[Math.floor(seasonEvents.length / 2)].start_time,
        bootstrapSamples: 0,
    });
    assert(filtered.moments < good.moments, 'momentFilter did not exclude anything');

    // Leakage guard: a fitPredictor that peeks at the test season must throw.
    assert.throws(
        () =>
            walkForward({
                events,
                seasons,
                type: 'attack',
                enemy: 0,
                fitPredictor: (trainEvents) => {
                    trainEvents.push({
                        season: 999,
                        type: 'attack',
                        enemy: 0,
                        start_time: 0,
                        end_time: 0,
                    });
                    return () => ({ p25: 1, p50: 1, p75: 1 });
                },
            }),
        /leakage/i,
        'leakage guard did not fire',
    );

    console.log(
        `backtest self-check OK — ${good.moments} moments, skill ratio ${good.skillRatio.toFixed(3)}`,
    );
}
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node scripts/analysis/lib/backtest.mjs`
Expected: FAIL with `ReferenceError: walkForward is not defined`

- [ ] **Step 3: Implement the harness**

Insert directly after the `import assert` line:

```js
import { HOUR } from './dataset.mjs';

/**
 * Linear-interpolated quantile of an unsorted numeric array.
 *
 * @param {number[]} values
 * @param {number} q in [0, 1]
 * @returns {number|null}
 */
export function quantileOf(values, q) {
    if (values.length === 0) return null;
    const s = [...values].sort((a, b) => a - b);
    const pos = q * (s.length - 1);
    const lo = Math.floor(pos);
    const hi = Math.ceil(pos);
    if (lo === hi) return s[lo];
    return s[lo] + (s[hi] - s[lo]) * (pos - lo);
}

/**
 * Median forward-recurrence wait sampled on the same clock the evaluation uses.
 *
 * This — NOT the median gap — is the correct constant baseline. Waits are
 * observed from a uniformly random clock moment, and forward recurrence time is
 * length-biased relative to the gap distribution. On the real data the two
 * differ by 54.5h vs 46.8h, which inflates skill ratios by ~12%.
 *
 * @param {object[]} trainEvents matching events from training seasons
 * @param {Map<number, object>} seasons
 * @param {number} stepHours
 * @returns {number}
 */
function forwardRecurrenceMedian(trainEvents, seasons, stepHours) {
    const bySeason = new Map();
    for (const e of trainEvents) {
        if (!bySeason.has(e.season)) bySeason.set(e.season, []);
        bySeason.get(e.season).push(e);
    }

    const waits = [];
    for (const [season, list] of bySeason) {
        const span = seasons.get(season);
        if (!span) continue;
        for (let t = span.firstStart; t <= span.lastEnd; t += stepHours * HOUR) {
            const next = list.find((e) => e.start_time > t);
            if (next) waits.push((next.start_time - t) / HOUR);
        }
    }
    return quantileOf(waits, 0.5) ?? 0;
}

/**
 * Walk-forward-by-season backtest.
 *
 * For each evaluation season N: fit on seasons < N only, then step a clock
 * through N in `stepHours` increments. At each moment the predictor emits
 * p25/p50/p75 of the wait (hours) until the next matching event start strictly
 * after that moment.
 *
 * Moments with no subsequent event are RIGHT-CENSORED, not dropped. The true
 * wait is known to exceed the remaining span `c`, so any predicted quantile
 * `q <= c` still yields an answerable comparison (`trueWait < q` is false).
 * Only `q > c` is unknown. For the error metric, a censored moment with
 * `p50 <= c` contributes the lower bound `c - p50`.
 *
 * @param {object} options
 * @returns {object} summary
 */
export function walkForward({
    events,
    seasons,
    type,
    enemy,
    fitPredictor,
    stepHours = 3,
    firstEvalSeason = 21,
    horizonHours = 1500,
    bootstrapSamples = 200,
    momentFilter = null,
}) {
    const matching = events
        .filter((e) => e.type === type && (enemy === undefined || e.enemy === enemy))
        .sort((a, b) => a.season - b.season || a.start_time - b.start_time);

    const evalSeasons = [...new Set(matching.map((e) => e.season))]
        .filter((s) => s >= firstEvalSeason)
        .sort((a, b) => a - b);

    // One record per evaluated moment. Keeping them in a flat list (rather than
    // parallel arrays) is what makes the season-level block bootstrap cheap.
    /** @type {{season: number, target: string, wait: number|null, censorAt: number|null,
     *          p25: number, p50: number, p75: number, absErr: number|null,
     *          baselineAbsErr: number|null}[]} */
    const records = [];
    let warmupSkipped = 0;
    let censoredUnknown = 0;

    for (const testSeason of evalSeasons) {
        const trainEvents = matching.filter((e) => e.season < testSeason);
        if (trainEvents.length < 30) continue;

        // Leakage guard — the single assert that keeps every number honest.
        for (const e of trainEvents) {
            assert(
                e.season < testSeason,
                `leakage: training row from season ${e.season} while testing ${testSeason}`,
            );
        }

        const trainGaps = [];
        for (let i = 1; i < trainEvents.length; i++) {
            if (trainEvents[i].season === trainEvents[i - 1].season) {
                trainGaps.push(
                    (trainEvents[i].start_time - trainEvents[i - 1].start_time) / HOUR,
                );
            }
        }
        // Forward-recurrence median, NOT median gap. See the note above.
        const baselineConstant = forwardRecurrenceMedian(trainEvents, seasons, stepHours);

        const predict = fitPredictor(trainEvents, {
            testSeason,
            trainGaps,
            baselineConstant,
        });
        // fitPredictor may mutate its own copy; re-verify nothing future leaked in.
        for (const e of trainEvents) {
            assert(
                e.season < testSeason,
                `leakage: training set mutated to include season ${e.season} while testing ${testSeason}`,
            );
        }

        const seasonEvents = matching.filter((e) => e.season === testSeason);
        const span = seasons.get(testSeason);
        if (!span || seasonEvents.length === 0) continue;

        for (let t = span.firstStart; t <= span.lastEnd; t += stepHours * HOUR) {
            if (momentFilter && !momentFilter(t, seasonEvents)) continue;

            // Before the season's first matching event there is no meaningful
            // "time since last event" — falling back to the previous season's
            // last event would feed the predictor a multi-month elapsed value.
            const lastEvent = seasonEvents.filter((e) => e.start_time <= t).at(-1);
            if (!lastEvent) {
                warmupSkipped++;
                continue;
            }

            const next = seasonEvents.find((e) => e.start_time > t);
            const p = predict({ t, season: testSeason, enemy, lastEvent });
            const q25 = Math.min(p.p25, horizonHours);
            const q50 = Math.min(p.p50, horizonHours);
            const q75 = Math.min(p.p75, horizonHours);

            if (next) {
                const wait = (next.start_time - t) / HOUR;
                records.push({
                    season: testSeason,
                    target: `${testSeason}:${next.start_time}`,
                    wait,
                    censorAt: null,
                    q25,
                    q50,
                    q75,
                    absErr: Math.abs(wait - q50),
                    baselineAbsErr: Math.abs(wait - baselineConstant),
                });
            } else {
                // Right-censored: the true wait exceeds the remaining span.
                const censorAt = (span.lastEnd - t) / HOUR;
                if (censorAt <= 0) continue;
                records.push({
                    season: testSeason,
                    target: `${testSeason}:censored`,
                    wait: null,
                    censorAt,
                    q25,
                    q50,
                    q75,
                    // |true - q50| >= censorAt - q50 when q50 <= censorAt.
                    absErr: q50 <= censorAt ? censorAt - q50 : null,
                    baselineAbsErr:
                        baselineConstant <= censorAt ? censorAt - baselineConstant : null,
                });
                if (q50 > censorAt) censoredUnknown++;
            }
        }
    }

    assert(records.length > 0, 'backtest produced no evaluable moments');

    /**
     * Censoring-aware calibration for one quantile level.
     *
     * Uncensored: `wait < q` is directly answerable.
     * Censored at c: answerable only when `q <= c`, and then it is false.
     *
     * @param {'q25'|'q50'|'q75'} key
     * @returns {{rate: number, n: number}}
     */
    function calibrationFor(key) {
        let hits = 0;
        let answerable = 0;
        for (const r of records) {
            const q = r[key];
            if (r.wait !== null) {
                answerable++;
                if (r.wait < q) hits++;
            } else if (q <= r.censorAt) {
                answerable++; // known false — true wait exceeds c >= q
            }
        }
        return { rate: answerable > 0 ? hits / answerable : 0, n: answerable };
    }

    const scored = records.filter((r) => r.absErr !== null);
    const baselineScored = records.filter((r) => r.baselineAbsErr !== null);

    const medianAbsErrorHours =
        quantileOf(
            scored.map((r) => r.absErr),
            0.5,
        ) ?? 0;
    const baselineMedianAbsErrorHours =
        quantileOf(
            baselineScored.map((r) => r.baselineAbsErr),
            0.5,
        ) ?? 0;
    const skillRatio =
        baselineMedianAbsErrorHours > 0 ?
            medianAbsErrorHours / baselineMedianAbsErrorHours
        :   Infinity;

    // Season-level block bootstrap. Resampling SEASONS (not moments) is what
    // respects the autocorrelation 3h stepping introduces — moments inside one
    // inter-arrival interval are near-duplicates and must move together.
    const seasonIds = [...new Set(records.map((r) => r.season))];
    const bySeasonRecords = new Map(
        seasonIds.map((s) => [s, records.filter((r) => r.season === s)]),
    );
    const ratios = [];
    // ponytail: fixed-seed LCG inline — the harness must stay import-free of
    // dataset.mjs so its self-check runs with no DB.
    let rngState = 987654321;
    const rand = () => {
        rngState = (Math.imul(rngState, 1664525) + 1013904223) >>> 0;
        return rngState / 4294967296;
    };
    for (let b = 0; b < bootstrapSamples; b++) {
        const sample = [];
        for (let i = 0; i < seasonIds.length; i++) {
            const pick = seasonIds[Math.floor(rand() * seasonIds.length)];
            sample.push(...bySeasonRecords.get(pick));
        }
        const m = quantileOf(
            sample.filter((r) => r.absErr !== null).map((r) => r.absErr),
            0.5,
        );
        const base = quantileOf(
            sample.filter((r) => r.baselineAbsErr !== null).map((r) => r.baselineAbsErr),
            0.5,
        );
        if (m !== null && base !== null && base > 0) ratios.push(m / base);
    }
    ratios.sort((a, b) => a - b);
    const skillRatioCI =
        ratios.length > 0 ?
            [
                quantileOf(ratios, 0.025) ?? skillRatio,
                quantileOf(ratios, 0.975) ?? skillRatio,
            ]
        :   [skillRatio, skillRatio];

    const widths = records.map((r) => r.q75 - r.q25);

    return {
        moments: records.length,
        uncensored: records.filter((r) => r.wait !== null).length,
        censoredScored: records.filter((r) => r.wait === null && r.absErr !== null)
            .length,
        censoredUnknown,
        warmupSkipped,
        // Distinct target events, not clock moments. This is the honest N.
        effectiveN: new Set(records.filter((r) => r.wait !== null).map((r) => r.target))
            .size,
        calibration: {
            q25: calibrationFor('q25').rate,
            q50: calibrationFor('q50').rate,
            q75: calibrationFor('q75').rate,
        },
        calibrationN: {
            q25: calibrationFor('q25').n,
            q50: calibrationFor('q50').n,
            q75: calibrationFor('q75').n,
        },
        sharpnessHours: quantileOf(widths, 0.5) ?? 0,
        medianAbsErrorHours,
        baselineMedianAbsErrorHours,
        skillRatio,
        skillRatioCI,
    };
}
```

- [ ] **Step 4: Run the self-check to verify it passes**

Run: `node scripts/analysis/lib/backtest.mjs`
Expected: PASS — `backtest self-check OK — <n> moments, skill ratio 0.000`

No `--env-file` needed: the self-check is fully synthetic and touches no DB.

- [ ] **Step 5: Lint and commit**

```bash
npm run lint:fix
npm run lint
git add scripts/analysis/lib/backtest.mjs
git commit -m "analysis(472): walk-forward backtest harness with leakage guard"
```

---

### Task 5: Renewal baseline

**Files:**

- Create: `scripts/analysis/02-baseline.mjs`

**Interfaces:**

- Consumes: `loadDataset`, `HOUR` from `./lib/dataset.mjs`; `walkForward`, `quantileOf` from `./lib/backtest.mjs`.
- Produces: console output only.

**Method:** empirical residual-life. Given `e` hours elapsed since the last same-type start, predict the quantiles of `gap − e` over the training gaps longer than `e`. No parameters, no fitting.

- [ ] **Step 1: Write the self-check first**

Create `scripts/analysis/02-baseline.mjs` with ONLY this block:

```js
/**
 * 02-baseline.mjs — features-free renewal hazard, the yardstick every later
 * model must beat. Empirical residual life: given `e` hours elapsed, the wait
 * distribution is (gap - e) over training gaps longer than e.
 *
 * Run: node --env-file=.env.development scripts/analysis/02-baseline.mjs
 */

import assert from 'node:assert/strict';

// --- self-check on the pure predictor -------------------------------------
{
    // Gaps of 10, 20, 30, 40 hours.
    const gaps = [10, 20, 30, 40];
    const predict = makeResidualPredictor(gaps);

    // At elapsed 0, residual life is just the gap distribution.
    const at0 = predict(0);
    assert.equal(at0.p50, 25, `expected median 25, got ${at0.p50}`);

    // At elapsed 25, only gaps 30 and 40 survive -> residuals 5 and 15.
    const at25 = predict(25);
    assert.equal(at25.p50, 10, `expected median 10, got ${at25.p50}`);

    // Past the longest gap, the predictor must still return finite numbers.
    const at100 = predict(100);
    assert(Number.isFinite(at100.p50), 'predictor returned non-finite past max gap');
    assert(at100.p25 <= at100.p50 && at100.p50 <= at100.p75, 'quantiles out of order');
}
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node --env-file=.env.development scripts/analysis/02-baseline.mjs`
Expected: FAIL with `ReferenceError: makeResidualPredictor is not defined`

- [ ] **Step 3: Add the predictor**

Insert directly after the `import assert` line:

```js
import { loadDataset, HOUR } from './lib/dataset.mjs';
import { walkForward, quantileOf } from './lib/backtest.mjs';

/**
 * Empirical residual-life predictor.
 *
 * @param {number[]} gaps training start-to-start gaps, in hours
 * @returns {(elapsedHours: number) => {p25: number, p50: number, p75: number}}
 */
function makeResidualPredictor(gaps) {
    const sorted = [...gaps].sort((a, b) => a - b);
    const maxGap = sorted.at(-1) ?? 0;

    return function predict(elapsedHours) {
        const survivors = sorted
            .filter((g) => g > elapsedHours)
            .map((g) => g - elapsedHours);

        // Beyond every observed gap there is no empirical evidence left. Fall
        // back to the shortest observed gap — the least-surprising positive
        // wait — rather than pretending to know more.
        // ponytail: crude tail fallback; replace with a fitted tail only if the
        // backtest shows the beyond-max region drives the error.
        if (survivors.length === 0) {
            const floor = sorted[0] ?? 1;
            return { p25: floor, p50: floor, p75: floor };
        }

        return {
            p25: quantileOf(survivors, 0.25),
            p50: quantileOf(survivors, 0.5),
            p75: quantileOf(survivors, 0.75),
        };
    };
}
```

- [ ] **Step 4: Run the self-check to verify it passes**

Run: `node --env-file=.env.development scripts/analysis/02-baseline.mjs`
Expected: PASS — exits silently with code 0.

- [ ] **Step 5: Add the run body**

Append below the self-check block:

```js
// --- run -------------------------------------------------------------------

const ds = await loadDataset();

/**
 * @param {object[]} trainEvents
 * @param {object} ctx
 */
function fitPredictor(trainEvents, ctx) {
    const predictResidual = makeResidualPredictor(ctx.trainGaps);
    return function predict(moment) {
        const elapsed = (moment.t - moment.lastEvent.start_time) / HOUR;
        return predictResidual(Math.max(0, elapsed));
    };
}

/**
 * Is a defend event active at time `t`? Used to isolate the lull estimand.
 *
 * @param {number} t
 * @param {object[]} seasonEvents
 * @returns {boolean}
 */
function inLull(t, seasonEvents) {
    return !seasonEvents.some((e) => e.start_time <= t && e.end_time > t);
}

const CONFIGS = [
    { label: 'attack, all enemies', type: 'attack', enemy: undefined },
    { label: 'attack, Bugs (0)', type: 'attack', enemy: 0 },
    { label: 'attack, Cyborgs (1)', type: 'attack', enemy: 1 },
    { label: 'attack, Illuminate (2)', type: 'attack', enemy: 2 },
    { label: 'defend, all enemies', type: 'defend', enemy: undefined },
    // 63% of defends chain back-to-back, so the pooled defend number is
    // dominated by "wait ~= 0" and a predictor scores well by always saying
    // zero. The decision-relevant question is when a LULL ends, so it gets its
    // own configuration restricted to moments with no defend active.
    {
        label: 'defend, LULL ONLY (no defend active)',
        type: 'defend',
        enemy: undefined,
        momentFilter: inLull,
    },
];

console.log('\n=== Phase 2: renewal baseline (empirical residual life) ===\n');

const results = [];
for (const cfg of CONFIGS) {
    const summary = walkForward({
        events: ds.events,
        seasons: ds.seasons,
        type: cfg.type,
        enemy: cfg.enemy,
        fitPredictor,
        momentFilter: cfg.momentFilter ?? null,
    });
    results.push({ cfg, summary });

    console.log(cfg.label);
    console.log(
        `  moments=${summary.moments} (uncensored=${summary.uncensored} censored-scored=${summary.censoredScored} censored-unknown=${summary.censoredUnknown} warmup-skipped=${summary.warmupSkipped})`,
    );
    console.log(
        `  EFFECTIVE N=${summary.effectiveN} distinct target events — read every figure below against THIS, not against moments`,
    );
    console.log(
        `  calibration  p25=${summary.calibration.q25.toFixed(3)}/0.250 (n=${summary.calibrationN.q25})  p50=${summary.calibration.q50.toFixed(3)}/0.500 (n=${summary.calibrationN.q50})  p75=${summary.calibration.q75.toFixed(3)}/0.750 (n=${summary.calibrationN.q75})`,
    );
    console.log(
        `  sharpness    p25-p75 band median width = ${summary.sharpnessHours.toFixed(1)}h`,
    );
    console.log(
        `  skill        median |true-p50| = ${summary.medianAbsErrorHours.toFixed(1)}h  vs baseline ${summary.baselineMedianAbsErrorHours.toFixed(1)}h  => ratio ${summary.skillRatio.toFixed(3)} (95% CI ${summary.skillRatioCI[0].toFixed(3)}-${summary.skillRatioCI[1].toFixed(3)})\n`,
    );
}

// --- defend two-part estimand ---------------------------------------------

console.log('=== Defend: chain-vs-lull decomposition ===\n');
{
    const bySeason = new Map();
    for (const e of ds.events.filter((x) => x.type === 'defend')) {
        if (!bySeason.has(e.season)) bySeason.set(e.season, []);
        bySeason.get(e.season).push(e);
    }
    const CHAIN_SECONDS = 600;
    let chains = 0;
    let total = 0;
    const lulls = [];
    for (const [, list] of bySeason) {
        for (let i = 1; i < list.length; i++) {
            const idle = list[i].start_time - list[i - 1].end_time;
            total++;
            if (idle <= CHAIN_SECONDS) chains++;
            else lulls.push(idle / HOUR);
        }
    }
    console.log(
        `P(chain within 10 min of a defend ending) = ${(chains / total).toFixed(3)}  (n=${total})`,
    );
    console.log(
        `Given NO chain, lull length hours: p25=${(quantileOf(lulls, 0.25) ?? 0).toFixed(1)}  p50=${(quantileOf(lulls, 0.5) ?? 0).toFixed(1)}  p75=${(quantileOf(lulls, 0.75) ?? 0).toFixed(1)}  (n=${lulls.length})\n`,
    );
}

// --- decision gate ---------------------------------------------------------

const CAL_TOLERANCE = 0.05;
const SHIP_SKILL = 0.6;
const DEAD_SKILL = 0.8;

console.log('=== Decision gate ===\n');
for (const { cfg, summary } of results) {
    const calOk =
        Math.abs(summary.calibration.q25 - 0.25) <= CAL_TOLERANCE &&
        Math.abs(summary.calibration.q50 - 0.5) <= CAL_TOLERANCE &&
        Math.abs(summary.calibration.q75 - 0.75) <= CAL_TOLERANCE;

    // The gate is read against the CI, not the point estimate. With effective N
    // in the hundreds, a point estimate of 0.59 with a CI spanning 0.45-0.78 is
    // not evidence of clearing a 0.6 bar.
    const [ciLo, ciHi] = summary.skillRatioCI;

    let verdict;
    if (calOk && ciHi <= SHIP_SKILL) {
        verdict = 'SHIP-WORTHY (pending the sharpness check below)';
    } else if (ciLo > DEAD_SKILL) {
        verdict = 'NOT USEFULLY PREDICTABLE';
    } else if (calOk && summary.skillRatio <= SHIP_SKILL) {
        verdict = 'PROMISING BUT UNDERPOWERED — point estimate passes, CI does not';
    } else {
        verdict = 'INCONCLUSIVE — try Phase 3 features';
    }

    console.log(
        `${cfg.label}: calibration ${calOk ? 'PASS' : 'FAIL'}, skill ${summary.skillRatio.toFixed(3)} [${ciLo.toFixed(3)}-${ciHi.toFixed(3)}], effN=${summary.effectiveN} => ${verdict}`,
    );
}

console.log(
    `\nSharpness check: compare each band width above against that configuration's unconditional gap IQR. Ship-worthy requires the band to be NARROWER than the IQR — otherwise the model is only restating the marginal distribution.`,
);

// Unconditional gap IQR per config, for that comparison.
console.log('\nUnconditional gap IQR (hours):');
for (const cfg of CONFIGS) {
    const list = ds.events
        .filter(
            (e) =>
                e.type === cfg.type && (cfg.enemy === undefined || e.enemy === cfg.enemy),
        )
        .sort((a, b) => a.season - b.season || a.start_time - b.start_time);
    const gaps = [];
    for (let i = 1; i < list.length; i++) {
        if (list[i].season === list[i - 1].season) {
            gaps.push((list[i].start_time - list[i - 1].start_time) / HOUR);
        }
    }
    const iqr = (quantileOf(gaps, 0.75) ?? 0) - (quantileOf(gaps, 0.25) ?? 0);
    console.log(`  ${cfg.label}: ${iqr.toFixed(1)}h (n=${gaps.length})`);
}
```

- [ ] **Step 6: Run the full script**

```bash
node --env-file=.env.development scripts/analysis/02-baseline.mjs | tee /tmp/phase2.txt
```

Expected: PASS — five configurations, each with calibration / sharpness / skill, then the decision gate and the IQR comparison table.

- [ ] **Step 7: Lint and commit**

```bash
npm run lint:fix
npm run lint
git add scripts/analysis/02-baseline.mjs
git commit -m "analysis(472): renewal-hazard baseline + decision gate"
```

---

### Task 6: Feature hazard model

**Files:**

- Create: `scripts/analysis/03-hazard.mjs`

**Interfaces:**

- Consumes: `loadDataset`, `HOUR`, `DAY` from `./lib/dataset.mjs`; `walkForward` from `./lib/backtest.mjs`.
- Produces: console output only.

**Method:** daily discrete-time hazard. One training row per `(season, enemy, day)`; label is "an attack of that enemy started during this day". Features: days since last attack (capped at 30), within-season player percentile of the most recent event, and points/day liberation velocity over the preceding 3 days. Logistic regression by full-batch gradient descent on standardized features. Wait quantiles come from forward-simulating the daily survival curve.

**Skip this task entirely if Task 3 found a rule.**

- [ ] **Step 1: Write the self-check first**

Create `scripts/analysis/03-hazard.mjs` with ONLY this block:

```js
/**
 * 03-hazard.mjs — daily discrete-time hazard with features, evaluated on the
 * same harness as the baseline. Must beat 02-baseline.mjs to justify itself.
 *
 * Run: node --env-file=.env.development scripts/analysis/03-hazard.mjs
 */

import assert from 'node:assert/strict';

// --- self-check on the pure model pieces ----------------------------------
{
    assert(Math.abs(sigmoid(0) - 0.5) < 1e-12, 'sigmoid(0) should be 0.5');
    assert(sigmoid(50) > 0.999, 'sigmoid saturates high');
    assert(sigmoid(-50) < 0.001, 'sigmoid saturates low');

    // A separable problem: label is 1 whenever x0 > 0.
    const rows = [];
    for (let i = -20; i <= 20; i++) {
        rows.push({ x: [i, 0, 0], y: i > 0 ? 1 : 0 });
    }
    const model = fitLogistic(rows, 3);
    const high = predictProb(model, [15, 0, 0]);
    const low = predictProb(model, [-15, 0, 0]);
    assert(high > 0.8, `separable high side should be >0.8, got ${high}`);
    assert(low < 0.2, `separable low side should be <0.2, got ${low}`);

    // Survival -> quantiles: a constant 50% daily hazard has a median wait
    // inside the first day.
    const q = waitQuantilesFromHazard(() => 0.5, 60);
    assert(q.p50 > 0 && q.p50 <= 24, `expected p50 within a day, got ${q.p50}`);
    assert(q.p25 <= q.p50 && q.p50 <= q.p75, 'quantiles out of order');

    // A zero hazard must return the capped horizon rather than NaN or Infinity.
    const never = waitQuantilesFromHazard(() => 0, 60);
    assert(Number.isFinite(never.p50), 'zero hazard must return a finite cap');
    assert.equal(never.p50, 60 * 24, 'zero hazard should return the horizon cap');
}
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node --env-file=.env.development scripts/analysis/03-hazard.mjs`
Expected: FAIL with `ReferenceError: sigmoid is not defined`

- [ ] **Step 3: Add the model primitives**

Insert directly after the `import assert` line:

```js
import { loadDataset, DAY } from './lib/dataset.mjs';
import { walkForward } from './lib/backtest.mjs';

/**
 * @param {number} z
 * @returns {number}
 */
function sigmoid(z) {
    if (z >= 0) return 1 / (1 + Math.exp(-z));
    const e = Math.exp(z);
    return e / (1 + e);
}

/**
 * Full-batch logistic regression by gradient descent on standardized features.
 *
 * @param {{x: number[], y: number}[]} rows
 * @param {number} dim number of features
 * @returns {{w: number[], b: number, mean: number[], std: number[]}}
 */
function fitLogistic(rows, dim, iterations = 3000, lr = 0.5) {
    assert(rows.length > 0, 'fitLogistic got no rows');

    const mean = new Array(dim).fill(0);
    const std = new Array(dim).fill(1);
    for (let d = 0; d < dim; d++) {
        const col = rows.map((r) => r.x[d]);
        mean[d] = col.reduce((a, b) => a + b, 0) / col.length;
        const variance = col.reduce((a, b) => a + (b - mean[d]) ** 2, 0) / col.length;
        std[d] = Math.sqrt(variance) || 1;
    }

    const z = rows.map((r) => ({
        x: r.x.map((v, d) => (v - mean[d]) / std[d]),
        y: r.y,
    }));

    const w = new Array(dim).fill(0);
    let b = 0;

    for (let it = 0; it < iterations; it++) {
        const gw = new Array(dim).fill(0);
        let gb = 0;
        for (const r of z) {
            let s = b;
            for (let d = 0; d < dim; d++) s += w[d] * r.x[d];
            const err = sigmoid(s) - r.y;
            for (let d = 0; d < dim; d++) gw[d] += err * r.x[d];
            gb += err;
        }
        for (let d = 0; d < dim; d++) w[d] -= (lr * gw[d]) / z.length;
        b -= (lr * gb) / z.length;
    }

    return { w, b, mean, std };
}

/**
 * @param {{w: number[], b: number, mean: number[], std: number[]}} model
 * @param {number[]} x raw (unstandardized) features
 * @returns {number} probability in (0, 1)
 */
function predictProb(model, x) {
    let s = model.b;
    for (let d = 0; d < model.w.length; d++) {
        s += model.w[d] * ((x[d] - model.mean[d]) / model.std[d]);
    }
    return sigmoid(s);
}

/**
 * Convert a daily hazard function into wait quantiles, in hours.
 *
 * Days are treated as uniform inside the day that crosses each quantile, which
 * is the best available resolution given h1_status is daily for 156 seasons.
 *
 * @param {(dayIndex: number) => number} hazardForDay
 * @param {number} horizonDays
 * @returns {{p25: number, p50: number, p75: number}} hours
 */
function waitQuantilesFromHazard(hazardForDay, horizonDays) {
    const targets = [0.25, 0.5, 0.75];
    const out = [null, null, null];
    let survival = 1;

    for (let day = 0; day < horizonDays; day++) {
        const h = Math.min(Math.max(hazardForDay(day), 0), 1);
        const cdfBefore = 1 - survival;
        survival *= 1 - h;
        const cdfAfter = 1 - survival;

        for (let i = 0; i < targets.length; i++) {
            if (out[i] === null && cdfAfter >= targets[i]) {
                const withinDay =
                    cdfAfter > cdfBefore ?
                        (targets[i] - cdfBefore) / (cdfAfter - cdfBefore)
                    :   0;
                out[i] = (day + withinDay) * 24;
            }
        }
    }

    const cap = horizonDays * 24;
    return {
        p25: out[0] ?? cap,
        p50: out[1] ?? cap,
        p75: out[2] ?? cap,
    };
}
```

- [ ] **Step 4: Run the self-check to verify it passes**

Run: `node --env-file=.env.development scripts/analysis/03-hazard.mjs`
Expected: PASS — exits silently with code 0.

- [ ] **Step 5: Add feature extraction and the run body**

Append below the self-check block:

```js
// --- features --------------------------------------------------------------

const ELAPSED_CAP_DAYS = 30;
const VELOCITY_WINDOW_DAYS = 3;
const HORIZON_DAYS = 60;

/**
 * Features at an instant, for one faction.
 *
 * [0] days since the last attack start of this enemy, capped
 * [1] within-season player percentile of the most recent event
 * [2] liberation gained per day over the preceding 3 days
 *
 * @returns {number[]}
 */
function featuresAt(ds, season, enemy, t, lastAttackStart, playerPercentile) {
    const elapsedDays =
        lastAttackStart === null ? ELAPSED_CAP_DAYS : (
            Math.min((t - lastAttackStart) / DAY, ELAPSED_CAP_DAYS)
        );

    const now = ds.liberationAt(season, enemy, t);
    const before = ds.liberationAt(season, enemy, t - VELOCITY_WINDOW_DAYS * DAY);
    const velocity =
        now !== null && before !== null ? (now - before) / VELOCITY_WINDOW_DAYS : 0;

    return [elapsedDays, playerPercentile, velocity];
}

const ds = await loadDataset();

/**
 * Build one training row per (season, enemy, day) over the training events.
 *
 * @param {object[]} trainEvents attacks only, seasons strictly before the fold
 * @param {number|undefined} enemy
 * @returns {{x: number[], y: number}[]}
 */
function buildTrainingRows(trainEvents, enemy) {
    const rows = [];
    const bySeason = new Map();
    for (const e of trainEvents) {
        if (!bySeason.has(e.season)) bySeason.set(e.season, []);
        bySeason.get(e.season).push(e);
    }

    for (const [season, list] of bySeason) {
        const span = ds.seasons.get(season);
        if (!span || span.spanSeconds <= 0) continue;
        const enemies =
            enemy === undefined ? [...new Set(list.map((e) => e.enemy))] : [enemy];

        for (const en of enemies) {
            const starts = list
                .filter((e) => e.enemy === en)
                .map((e) => e.start_time)
                .sort((a, b) => a - b);
            if (starts.length === 0) continue;

            for (let t = span.firstStart; t < span.lastEnd; t += DAY) {
                const last = starts.filter((s) => s <= t).at(-1) ?? null;
                const fired = starts.some((s) => s > t && s <= t + DAY);
                const recent = list.filter((e) => e.start_time <= t).at(-1);
                rows.push({
                    x: featuresAt(
                        ds,
                        season,
                        en,
                        t,
                        last,
                        recent?.playerPercentileInSeason ?? 0.5,
                    ),
                    y: fired ? 1 : 0,
                });
            }
        }
    }

    return rows;
}

/**
 * Build a `fitPredictor` bound to one enemy, in the shape walkForward expects.
 *
 * @param {number|undefined} enemy
 * @returns {(trainEvents: object[]) => (moment: object) => {p25: number, p50: number, p75: number}}
 */
function fitPredictorFor(enemy) {
    return function fitPredictor(trainEvents) {
        const rows = buildTrainingRows(trainEvents, enemy);
        assert(rows.length > 0, 'no training rows built');
        const model = fitLogistic(rows, 3);

        return function predict(moment) {
            const en = moment.enemy ?? moment.lastEvent.enemy;
            const lastStart = moment.lastEvent.start_time;
            const percentile = moment.lastEvent.playerPercentileInSeason ?? 0.5;

            // Roll elapsed time forward day by day; hold the player and
            // velocity features at their values as of the query moment, since
            // their future values are unknowable at prediction time.
            const hazardForDay = (dayIndex) => {
                const t = moment.t + dayIndex * DAY;
                const x = featuresAt(ds, moment.season, en, t, lastStart, percentile);
                // Freeze the two lookahead-prone features at their query-time
                // values; only elapsed time is allowed to advance.
                const frozen = featuresAt(
                    ds,
                    moment.season,
                    en,
                    moment.t,
                    lastStart,
                    percentile,
                );
                return predictProb(model, [x[0], frozen[1], frozen[2]]);
            };

            return waitQuantilesFromHazard(hazardForDay, HORIZON_DAYS);
        };
    };
}

// --- run -------------------------------------------------------------------

const CONFIGS = [
    { label: 'attack, all enemies', type: 'attack', enemy: undefined },
    { label: 'attack, Bugs (0)', type: 'attack', enemy: 0 },
    { label: 'attack, Cyborgs (1)', type: 'attack', enemy: 1 },
    { label: 'attack, Illuminate (2)', type: 'attack', enemy: 2 },
];

console.log('\n=== Phase 3: daily hazard with features ===');
console.log(
    'features: [days since last attack (cap 30), within-season player percentile, liberation/day over prior 3d]\n',
);

for (const cfg of CONFIGS) {
    const summary = walkForward({
        events: ds.events,
        seasons: ds.seasons,
        type: cfg.type,
        enemy: cfg.enemy,
        fitPredictor: fitPredictorFor(cfg.enemy),
    });

    console.log(cfg.label);
    console.log(`  moments=${summary.moments}  censored=${summary.censored}`);
    console.log(
        `  calibration  p25=${summary.calibration.q25.toFixed(3)}  p50=${summary.calibration.q50.toFixed(3)}  p75=${summary.calibration.q75.toFixed(3)}`,
    );
    console.log(`  sharpness    ${summary.sharpnessHours.toFixed(1)}h`);
    console.log(
        `  skill        ${summary.medianAbsErrorHours.toFixed(1)}h vs baseline ${summary.baselineMedianAbsErrorHours.toFixed(1)}h => ratio ${summary.skillRatio.toFixed(3)}\n`,
    );
}

console.log(
    'Compare every number above against /tmp/phase2.txt. Phase 3 justifies its existence ONLY if its skill ratio is lower AND its calibration is no worse.',
);
```

- [ ] **Step 6: Run the full script**

```bash
node --env-file=.env.development scripts/analysis/03-hazard.mjs | tee /tmp/phase3.txt
```

Expected: PASS — four configurations with the same three scores as Phase 2.

This is the slowest script (it refits a logistic model per season fold). Expect **5–20 minutes**: roughly 4 configs × 140 folds × 3000 iterations over ~5–10k rows, which is low billions of `Math.exp` calls. If it exceeds ~20 minutes, reduce `iterations` in the `fitLogistic` call from 3000 to 800 and note the change in the findings comment.

There is no convergence check on the fixed 3000 iterations — deliberate, since the payoff here is expected to be low. If Phase 3 does beat Phase 2, add one before believing it.

- [ ] **Step 7: Lint and commit**

```bash
npm run lint:fix
npm run lint
git add scripts/analysis/03-hazard.mjs
git commit -m "analysis(472): daily hazard model with features"
```

---

### Task 7: Document and report

**Files:**

- Modify: `scripts/README.md` (append a new `## analysis/` section)
- Modify: `CHANGELOG.md` (new `## 0.68.0` section)
- Modify: `package.json` (version bump, in the merge commit)

**Interfaces:**

- Consumes: `/tmp/phase1.txt`, `/tmp/phase2.txt`, `/tmp/phase3.txt`.
- Produces: a comment on #472 and a merged branch.

- [ ] **Step 1: Document the scripts**

Append to `scripts/README.md` (outer fence is `~~~` so the inner ` ``` ` block survives the copy-paste):

````markdown
## analysis/

Throwaway analysis for [#472](https://github.com/elfensky/helldivers.bot/issues/472)
— is the start time of the next event predictable? Kept in the repo so the
numbers stay reproducible, not because anything imports them.

Run in order; each is standalone and read-only against `POSTGRES_URL`:

```bash
node --env-file=.env.development scripts/analysis/lib/dataset.mjs      # self-check
node scripts/analysis/lib/backtest.mjs                                 # self-check, no DB
node --env-file=.env.development scripts/analysis/01-trigger-hunt.mjs
node --env-file=.env.development scripts/analysis/02-baseline.mjs
node --env-file=.env.development scripts/analysis/03-hazard.mjs
```

Each module runs its own `assert` block when invoked directly. There are no
vitest files: `mirrorTree.test.mjs` resolves test paths against the `src` and
`public` roots only, so a test for `scripts/` would fail the mirror rule.

Design and decision gate:
`docs/superpowers/specs/2026-07-27-next-event-timing-forecast-design.md`
````

- [ ] **Step 2: Post the findings comment on #472**

Write the comment to a file, then post it. Fill every number from the captured output — do not paraphrase.

```bash
gh issue comment 472 --body-file /tmp/findings.md
```

The comment must contain, in this order:

1. **The answer**, in one sentence: predictable enough to ship, or not.
2. **Phase 1 verdict** — the per-variable concentration table, and whether a rule was found. Note the refinement: concentration was measured as IQR and p05–p95 span ratios against a control, not the spec's under-specified "tightest 10% band".
3. **Phase 2 numbers** — calibration, sharpness, skill ratio per configuration, against the decision gate (calibration ±0.05, skill ≤ 0.6 ships / > 0.8 is dead, band narrower than the unconditional IQR).
4. **Phase 3 numbers** if it ran, and whether it beat Phase 2. If it did not beat Phase 2, say so plainly — that is the expected outcome of a lazy ladder working correctly.
5. **The recommendation**: which rung to ship, or close as not predictable.
6. **Caveats**, verbatim: daily `h1_status` resolution for 156 of 160 seasons; only 11 of 925 attacks have >1 status reading in the preceding 24h; Phase 1 can confirm a rule but not cleanly rule one out.

- [ ] **Step 3: Update the changelog**

Add to the top of `CHANGELOG.md`, below `# Changelog`:

```markdown
## 0.68.0

### Added

- **Next-event timing analysis ([#472](https://github.com/elfensky/helldivers.bot/issues/472)).**
  `scripts/analysis/` — a data loader, a walk-forward backtest harness with a
  leakage guard, a deterministic-trigger hunt, a renewal-hazard baseline, and a
  daily hazard model with features. Read-only, no new dependencies, each module
  self-checking via inline asserts.

    Findings are recorded on the issue. [Replace this sentence with the
    one-sentence answer once Step 2 is done.]
```

- [ ] **Step 4: Verify the whole chain**

```bash
npm run lint
npm run typecheck
npm run test:unit
npm run build
```

Expected: all four green. `typecheck` does not cover `scripts/`, and `test:unit` gains no new tests — both should be unchanged from before this branch. If `test:unit` reports a mirror-tree failure, a vitest file was added under `src/__tests__/` by mistake; remove it.

- [ ] **Step 5: Merge and bump**

```bash
git checkout develop
git merge --no-ff --no-commit <branch-name>
npm version 0.68.0 --no-git-tag-version --allow-same-version
npx prettier --write CHANGELOG.md package.json
git add -A
git commit -m "Merge <branch-name> into develop (v0.68.0)"
git push origin develop
```

Minor bump, not patch: this adds new files and answers a research question, but ships no user-facing behaviour.

- [ ] **Step 6: Close or re-scope the issue**

- If the answer is "not usefully predictable": close #472 with the findings comment as the closing rationale.
- If a rung cleared the gate: leave #472 open, check off its "decide which rung" box, and open the follow-up issue for shipping the function into `src/shared/utils/game/` with a mirrored vitest test.

---

## Self-Review

**Spec coverage:**

| Spec section                                                            | Task                                       |
| ----------------------------------------------------------------------- | ------------------------------------------ |
| Layout (`scripts/analysis/`, run command, Node+pg no libs)              | Global Constraints, Tasks 1–6              |
| Data layer `loadDataset`, derived fields, `statusAt` + staleness caveat | Task 1                                     |
| Phase 1 trigger hunt, concentration vs control, S157–160 re-test        | Task 2                                     |
| Phase 1 limitation (daily resolution cannot rule a trigger out)         | Task 2 Step 5 output, Task 7 Step 2 item 6 |
| Phase 2 renewal hazard, walk-forward N in 21…160, 3h steps, censoring   | Tasks 4–5                                  |
| Three scores (calibration, sharpness, skill)                            | Task 4                                     |
| Phase 3 daily hazard, three features, logistic by gradient descent      | Task 6                                     |
| Decision gate (±0.05, skill ≤0.6 / >0.8, band vs IQR)                   | Task 5 Step 5                              |
| No `tryCatch`, no vitest, inline asserts, leakage assert                | Global Constraints, Task 4 Step 3          |
| Findings as a comment on #472, not a doc                                | Task 7                                     |
| Out of scope: region/enemy/outcome prediction, UI, LLM                  | not implemented anywhere — correct         |
| Debate corrections 1–7                                                  | Tasks 1, 2, 3, 4, 5 (see the v2 table)     |

Two spec requirements are implemented with deliberate deviations, both flagged in place: the harness lives in `lib/backtest.mjs` rather than inside `02-baseline.mjs` (Task 4 header), and Phase 1 concentration is measured as IQR/span ratios rather than the spec's "tightest 10% band" (Task 2 header).

**The spec is now behind the plan on three points.** The spec still says censored moments are "dropped, and the dropped count is reported" (§ Phase 2), still frames the decision gate on the point estimate rather than the CI, and does not mention the permutation test. The plan is authoritative; update the spec when the findings land rather than now, so both documents change once.

**Placeholder scan:** one intentional bracket remains — Task 7 Step 3's changelog text says to replace a sentence with the finding, which cannot be written before the analysis runs. Every other step contains runnable content.

**Type consistency:** `loadDataset` returns `{events, seasons, statusAt, liberationAt}`, used with those exact names in Tasks 2, 5, 6. `walkForward` takes `{events, seasons, type, enemy, fitPredictor, momentFilter}` and `fitPredictor(trainEvents, ctx)` returns `predict(moment)` with `moment = {t, season, enemy, lastEvent}` — consistent across Tasks 4, 5, 6. `ctx` is `{testSeason, trainGaps, baselineConstant}`: `trainGaps` is consumed by Task 5's residual predictor, `baselineConstant` by Task 4's own self-check. `quantileOf` is defined once in `backtest.mjs` and imported by `02-baseline.mjs`; `01-trigger-hunt.mjs` defines its own local `quantile` because it does not import the harness. `Summary` gained `uncensored`, `censoredScored`, `censoredUnknown`, `effectiveN`, `calibrationN`, and `skillRatioCI` in v2 — Task 5's print block and decision gate consume all six.

`backtest.mjs` deliberately does not import `makeRng` from `dataset.mjs` (it inlines its own LCG) so that its self-check runs with no database connection. `01-trigger-hunt.mjs` does import `makeRng`, and uses two independent generators: `makeRng(20260727)` for control sampling and `makeRng(31337)` for the permutation shuffles.
