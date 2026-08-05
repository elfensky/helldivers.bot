# View-Dependent ETAs + Event Pace Verdicts — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The frontier card's ETA follows the dashboard view (next-sector target in sector view, campaign/attack target in campaign view), and active event cards replace the points-delta pace arrow with a time-domain verdict (`▲ on track · done ~3h` / `▼ behind · done ~5h`) — with sector ranges measured by a backtest before they ship.

**Architecture:** Stage A (analysis): a sector-crossing backtest (`scripts/analysis/13-sector-eta.mjs`) measures time-to-next-sector-boundary across all seasons; the emitter (`11-emit-attack-model.mjs`) writes a `sector` ratio table into `attackModel.mjs` behind refuse-to-emit guards; a small script picks the event-verdict margin from `h1_event_progress`. Stage B (UI): `attackForecast.mjs` grows a shared `forecastCore` + `sectorForecast`; a new model-free `eventForecast.mjs` produces verdicts; `EventCard` renders both; `DashboardClient` wires by view.

**Tech Stack:** Node 24 (mise), plain `.mjs` analysis scripts (`pg` direct, no Prisma), Vitest + Testing Library (jsdom), React 19 / Next 16, Tailwind v4 tokens.

**Spec:** `docs/superpowers/specs/2026-07-31-view-dependent-eta-design.md` (approved).

## Global Constraints

- Work happens in the worktree `.worktrees/feature-view-dependent-eta` on branch `feature/view-dependent-eta`. Never commit to `develop` directly; merge back `--no-ff` with version bump in the merge commit (§ Git Workflow rule 2).
- Run node via mise: `mise exec -- node …` / `mise exec -- npm …` (homebrew node 26 lurks otherwise).
- Analysis scripts: relative imports only (no `@/*`), self-check blocks under `if (import.meta.filename === process.argv[1])`, DB via `--env-file=.env.development`, no try/catch (project uses `tryCatch` only in app code; scripts use asserts).
- App code: `@/*` imports, JSDoc types (checked by `tsc --noEmit`), NO try/catch, tests at the mirrored path under `src/__tests__/unit/` (enforced by `mirrorTree.test.mjs`).
- `npm run lint:fix` before every commit. All four checks must pass before merge: `npm run lint`, `npm run typecheck`, `npm run test:unit`, `npm run build` (build needs env: `set -a && source .env.development && set +a`).
- Pinned values from the spec: sector bands `[0.1, 0.25, 0.5, 0.75, 1.01]` (fraction of the sector remaining), sector display window `8h`, sector min ETA `5 min` (`1/12` h), verdict margin default `0.1` (Task 4 may replace with the measured value), success color `#58c979` as `--color-success`.
- Existing public behavior of `attackForecast(data, enemy, nowSeconds, model?)` must NOT change (its existing tests keep passing unmodified).

---

### Task 1: Worktree setup + GitHub issue

**Files:** none created (setup only).

**Interfaces:**
- Produces: a functional worktree (deps + prisma client) and a GitHub issue number `#N` used in later commit messages (`Ref #N`).

- [ ] **Step 1: Install deps in the worktree**

```bash
cd /Users/andrei/Developer/helldivers.bot/.worktrees/feature-view-dependent-eta
mise exec -- npm install && mise exec -- npx prisma generate
```

- [ ] **Step 2: Verify the suite is green before touching anything**

Run: `mise exec -- npm run test:unit`
Expected: all tests pass (baseline).

- [ ] **Step 3: Create the tracking issue**

```bash
gh issue create --title "View-dependent ETAs + event pace verdicts" \
  --label enhancement --label frontend --milestone "Engineering Health" \
  --body "Spec: docs/superpowers/specs/2026-07-31-view-dependent-eta-design.md (on feature/view-dependent-eta).
Sector-view ETA targets the next sector boundary (backtested + calibrated first, scripts/analysis/13); campaign view keeps the assault ETA; active event cards fold the pace arrow into a time verdict (done ~Xh, on track/behind). Mockup: claude.ai artifact 4db30b44."
```

Record the issue number for later commits.

---

### Task 2: `scripts/analysis/13-sector-eta.mjs` — sector-crossing backtest

**Files:**
- Create: `scripts/analysis/13-sector-eta.mjs`

**Interfaces:**
- Consumes: `loadDataset` (`./lib/dataset.mjs` — `statusSeries`, `statusAt`, `seasons`), `walkForward`, `quantileOf` (`./lib/backtest.mjs`, incl. `allowNoPriorEvent` flag and per-record `t`).
- Produces (conventions Task 3 copies): `SECTOR_BANDS = [0.1, 0.25, 0.5, 0.75, 1.01]`, `sectorBandOf(frac)`, `sectorCrossings(series, pointsMax)` → `[{start_time, end_time, boundary}]`, `rawSectorEta(season, enemy, t, adjust)` → `{etaHours, sectorFrac}|null`.

- [ ] **Step 1: Write the script skeleton with pure functions + self-checks**

Follow the structure of `10-attack-eta.mjs` (header comment → constants → pure functions → self-check block → data → run). Core pure pieces:

```js
import assert from 'node:assert/strict';
import { loadDataset, HOUR } from './lib/dataset.mjs';
import { walkForward, quantileOf } from './lib/backtest.mjs';

const RATE_WINDOW_HOURS = 24;
const STEP_HOURS = 3;
const DISPLAY_HOURS = 8; // sector horizon is ~1/10 the campaign's
const MIN_ETA_HOURS = 1 / 12; // 5 minutes
const SECTOR_COUNT = 10;

/** Band edges over the REMAINING FRACTION OF THE SECTOR (not the campaign). */
const SECTOR_BANDS = [0.1, 0.25, 0.5, 0.75, 1.01];

function sectorBandOf(frac) {
    for (let i = 0; i < SECTOR_BANDS.length; i++) if (frac < SECTOR_BANDS[i]) return i;
    return SECTOR_BANDS.length - 1;
}

/**
 * Synthetic "crossing events" for one (season, enemy): the first status bucket
 * at or past each boundary k * pointsMax/10, k = 1..10. Shaped like events
 * (start_time/end_time) so walkForward can consume them unchanged.
 */
function sectorCrossings(series, pointsMax) {
    if (!(pointsMax > 0)) return [];
    const pps = pointsMax / SECTOR_COUNT;
    const out = [];
    let k = 1;
    for (const row of series) {
        while (k <= SECTOR_COUNT && Number(row.points) >= k * pps) {
            out.push({
                start_time: Number(row.bucket),
                end_time: Number(row.bucket),
                boundary: k * pps,
            });
            k++;
        }
    }
    return out;
}

function ratioQuantiles(ratios) {
    if (ratios.length < 30) return null;
    return {
        r25: quantileOf(ratios, 0.25),
        r50: quantileOf(ratios, 0.5),
        r75: quantileOf(ratios, 0.75),
    };
}
```

Self-checks (in the top self-check block, before any DB access):

```js
{
    assert.equal(sectorBandOf(0.05), 0);
    assert.equal(sectorBandOf(0.5), 2);
    assert.equal(sectorBandOf(1.0), 4);
    // A linear climb crosses each boundary exactly once, in order.
    const series = Array.from({ length: 100 }, (_, i) => ({
        bucket: i * 3600,
        points: i * 100, // reaches 9900 < 10000
    }));
    const c = sectorCrossings(series, 10_000);
    assert.equal(c.length, 9, 'linear climb to 99% crosses 9 boundaries');
    assert.equal(c[0].boundary, 1000);
    for (let i = 1; i < c.length; i++) {
        assert(c[i - 1].start_time < c[i].start_time, 'crossings ascend');
    }
    // A single jump over several boundaries emits one crossing per boundary
    // at the same bucket.
    const jump = [
        { bucket: 0, points: 0 },
        { bucket: 3600, points: 5500 },
    ];
    assert.equal(sectorCrossings(jump, 10_000).length, 5);
    assert.equal(ratioQuantiles([1, 2]), null);
}
```

- [ ] **Step 2: Add `rawSectorEta` + dow pattern (copied idiom) + the run**

`makeDowPattern()` is copied verbatim from `12-faction-players-eta.mjs` (which copied it from script 10 — same rationale comment). Then:

```js
const ds = await loadDataset();

function rawSectorEta(season, enemy, t, adjust) {
    const pointsMax = ds.seasons.get(season)?.pointsMax?.[enemy] ?? 0;
    if (!(pointsMax > 0)) return null;
    const stNow = ds.statusAt(season, enemy, t);
    const stThen = ds.statusAt(season, enemy, t - RATE_WINDOW_HOURS * HOUR);
    if (!stNow || !stThen) return null;

    const now = Number(stNow.points);
    if (now >= pointsMax) return null; // campaign complete
    const pps = pointsMax / SECTOR_COUNT;
    const boundary = (Math.trunc(now / pps) + 1) * pps;
    const remaining = boundary - now;

    const spanHours = (Number(stNow.bucket) - Number(stThen.bucket)) / HOUR;
    if (!(spanHours > 0)) return null;
    const ratePerHour = (now - Number(stThen.points)) / spanHours;
    if (!(ratePerHour > 0)) return null;

    let etaHours = remaining / ratePerHour;
    if (adjust) {
        const horizon = Math.min(Math.max(etaHours, 1), 48);
        const adj = adjust(
            Number(stThen.bucket),
            Number(stNow.bucket),
            t,
            t + horizon * HOUR,
        );
        if (adj > 0) etaHours *= adj;
    }
    etaHours -= (t - Number(stNow.bucket)) / HOUR; // staleness anchor
    if (etaHours < MIN_ETA_HOURS) etaHours = MIN_ETA_HOURS;

    return { etaHours, sectorFrac: remaining / pps };
}
```

The evaluation harness mirrors script 10's `makeFitPredictor` (accumulating per-band ratio table folded walk-forward, `foldSeason` stepping the clock and pushing `wait / eta.etaHours` into `sectorBandOf(eta.sectorFrac)`), but:

- events = crossings, pooled per enemy: build once per enemy as
  `crossingsByEnemy[enemy] = seasons.flatMap(s => sectorCrossings(ds.statusSeries(s, enemy), pointsMaxOf(s, enemy)).map(c => ({...c, season: s, type: 'crossing', enemy})))`.
- seasons map for walkForward = a custom `crossingSeasons` built from status coverage, NOT `ds.seasons` (event spans start late in some seasons):
  `firstStart = first status bucket across the three factions, lastEnd = last`. One Map, reused for all enemies.
- `walkForward({ events: crossingsByEnemy[enemy], seasons: crossingSeasons, type: 'crossing', enemy, stepHours: STEP_HOURS, fitPredictor, momentFilter, allowNoPriorEvent: true })` — `allowNoPriorEvent` is required: the moments before a season's first crossing are real forecasting moments.
- `momentFilter`: `(t, seasonEvents) => seasonEvents.length > 0 && rawSectorEta(seasonEvents[0].season, enemy, t, null) !== null`.

Output sections (copy script 10's format):
1. Main table per faction: effN, cal 25/50/75, MAE/base, skill [CI].
2. When-showing table (p50 < `DISPLAY_HOURS`): recall (crossings preceded by a showing forecast), precision (crossing follows within 2× p75), p25/p50/p75 hit rates when showing.
3. Full-history fitted per-band ratio table (what the emitter will fit), with per-band n.

- [ ] **Step 3: Run the self-checks + full script**

```bash
mise exec -- node scripts/analysis/lib/backtest.mjs
mise exec -- node --env-file=.env.development scripts/analysis/13-sector-eta.mjs
```

Expected: self-checks OK; main table shows effN per faction in the hundreds-to-thousands (10 crossings/campaign × ~160 seasons); when-showing recall/precision printed. If recall < 0.7 or precision < 0.8, STOP and report — the emitter guards in Task 3 would refuse, and the sector UI part must not proceed until resolved (this is the spec's "measure first" gate).

- [ ] **Step 4: Commit**

```bash
mise exec -- npm run lint:fix && git add scripts/analysis/13-sector-eta.mjs
git commit -m "feat(analysis): sector-crossing ETA backtest (script 13)

Ref #<issue>"
```

---

### Task 3: Emit the `sector` section into `attackModel.mjs` — **SKIPPED (ruling 2026-07-31)**

> Only 4 high-resolution seasons exist; script 13's walk-forward gate is
> unevaluable (effN=1). Andrei ruled: sector ETA ships MEDIAN-ONLY with no
> `sector` model section; the range follows when the gate becomes evaluable
> (follow-up issue in Task 9). Everything below in this task is retained for
> that future work but MUST NOT be executed now.

<details><summary>Original task (deferred)</summary>

### Task 3 (original): Emit the `sector` section into `attackModel.mjs`

**Files:**
- Modify: `scripts/analysis/11-emit-attack-model.mjs` (add sector fit + guards; keep existing attack fit untouched)
- Regenerate: `src/features/dashboard/attackModel.mjs`

**Interfaces:**
- Consumes: `SECTOR_BANDS`, crossing/eta logic — DUPLICATED into script 11 (scripts 10/11 already deliberately duplicate `bandOf`; same pinning rationale, same comment style).
- Produces: `attackModel.mjs` default export gains a `sector` key:
  `{ bands: number[], ratios: Record<number, {r25,r50,r75,n}>, meta: { rateWindowHours: 24, displayHours: 8, minEtaHours: number, crossings: number, recall: number, precision: number } }`.
  Task 5 reads exactly this shape.

- [ ] **Step 1: Add the sector fit to script 11**

Inside script 11, after the existing attack fit: replicate the Task 2 pieces (`SECTOR_BANDS`, `sectorBandOf`, `sectorCrossings`, `rawSectorEta` with the full-history dow adjuster script 11 already builds), then:

- Fit: walk every (season, enemy), step 3h, accumulate `wait/eta` into per-band lists exactly like the attack fit does; `ratioQuantiles` per band with pooled fallback under 30 samples.
- Replay for guards: with the fitted table, one more pass over all moments computing `p50 = eta × r50`, `p75 = eta × r75`; `recall` = fraction of crossings with any prior showing moment (`p50 < 8`), `precision` = fraction of showing moments followed by a crossing within `2 × p75`.
- Refuse-to-emit guards (assert, mirroring the attack guards): every band ratio finite/positive/monotone (`r25 <= r50 <= r75`), `recall >= 0.70`, `precision >= 0.80`, at least 3 bands individually fitted (not pooled-fallback).
- Emit: extend the written object with the `sector` key (same `Object.freeze`, same one-line JSON emit).

- [ ] **Step 2: Regenerate the model + regression-run script 10**

```bash
mise exec -- node --env-file=.env.development scripts/analysis/11-emit-attack-model.mjs
mise exec -- node --env-file=.env.development scripts/analysis/10-attack-eta.mjs | head -30
```

Expected: emitter passes all guards and writes `attackModel.mjs` containing both the (refitted) attack tables and the new `sector` section. NOTE: the attack tables are refitted on the current DB, which now contains seasons past 160 — small numeric drift vs the committed file is expected and correct; the emitter's own attack guards (recall ≥ 0.70, precision ≥ 0.80) still gate it. Script 10 output should be unchanged (it doesn't read the model file).

- [ ] **Step 3: Verify the app still passes with the regenerated model**

Run: `mise exec -- npm run test:unit`
Expected: PASS (existing `attackForecast` tests use the default model — if any test pinned exact model numbers, it reads `attackModel.mjs` dynamically and still passes; if one hardcoded values, update that fixture and say so in the commit).

- [ ] **Step 4: Commit**

```bash
mise exec -- npm run lint:fix
git add scripts/analysis/11-emit-attack-model.mjs src/features/dashboard/attackModel.mjs
git commit -m "feat(analysis): emit calibrated sector section into attackModel

Ref #<issue>"
```

</details>

---

### Task 4: Event-verdict margin measurement (`scripts/analysis/14-event-verdict-margin.mjs`)

**Files:**
- Modify: `scripts/analysis/lib/dataset.mjs` (optional `eventProgress` loading, pattern-copy of the `statistics` flag)
- Create: `scripts/analysis/14-event-verdict-margin.mjs`

**Interfaces:**
- Consumes: `h1_event_progress` rows `{type, event_id, bucket, time, points}` (S157+ only) + `ds.events` (which carry `type, event_id, start_time, end_time, points_max, status`). NOTE: `ds.events` rows must also select `event_id` — check the dataset query; if `event_id` is absent from the SELECT in `loadDataset`, add it (additive, no consumer breaks).
- Produces: a printed recommended `VERDICT_MARGIN` for Task 7. The rule being tuned (must match Task 7's implementation exactly): `onTrack = etaHours <= remainingHours * (1 + margin)` with `etaHours = (points_max − points) / (points / (t − start_time)) / 3600`.

- [ ] **Step 1: Extend `lib/dataset.mjs`**

Mirror the `options.statistics` pattern exactly: `options.eventProgress` triggers a fourth/fifth query
`SELECT type, event_id, bucket, time, points FROM h1_event_progress ORDER BY type, event_id, bucket`,
an index `Map<'type:event_id', rows[]>`, and an accessor `eventProgressSeries(type, eventId)`. Extend the self-check block: with the flag on, series ascend by bucket, `points >= 0`, at least one series has > 3 rows; with the flag off, accessor returns `[]`.

- [ ] **Step 2: Run the dataset self-check**

Run: `mise exec -- node --env-file=.env.development scripts/analysis/lib/dataset.mjs`
Expected: `dataset self-check OK`.

- [ ] **Step 3: Write script 14**

For every completed (status `success`/`fail`) defend or attack event that has ≥ 3 progress buckets strictly between start and end: replay each bucket `t` (skip the first 10% of the event — rate is meaningless immediately after start), compute the Task-7 rule verdict for each margin in `[0, 0.05, 0.1, 0.15, 0.2, 0.3]`, then per margin print:

- accuracy: fraction of (event, bucket) verdicts that match the outcome (`success` ↔ onTrack),
- flip rate: median number of verdict changes per event (want ≤ 1),
- n events / n moments.

Self-check block: a synthetic linear event that exactly meets its deadline is onTrack at margin 0.1 and every bucket agrees (zero flips); a synthetic event at half the required rate is behind at every margin.

Recommendation line: smallest margin whose flip median ≤ 1 and accuracy within 2pp of the best. Print `RECOMMENDED VERDICT_MARGIN = <x>` and `INSUFFICIENT DATA — use default 0.1` if fewer than 10 qualifying events exist.

- [ ] **Step 4: Run it, record the margin**

```bash
mise exec -- node --env-file=.env.development scripts/analysis/14-event-verdict-margin.mjs
```

Write the recommended value down — Task 7 hardcodes it as `VERDICT_MARGIN` with a comment citing this script.

- [ ] **Step 5: Commit**

```bash
mise exec -- npm run lint:fix
git add scripts/analysis/lib/dataset.mjs scripts/analysis/14-event-verdict-margin.mjs
git commit -m "feat(analysis): event-verdict margin measurement (script 14)

Ref #<issue>"
```

---

### Task 5: `sectorForecast` in `attackForecast.mjs`

**Files:**
- Modify: `src/features/dashboard/attackForecast.mjs`
- Test: `src/__tests__/unit/features/dashboard/attackForecast.sector.test.mjs` (new qualifier file; existing `attackForecast.test.mjs` MUST pass unmodified)

**Interfaces (amended 2026-07-31 — median-only ruling):**
- Consumes: `attackModel.mjs` top-level `dow` table only (no `sector` section exists).
- Produces:
  `sectorForecast(data, enemy, nowSeconds, model = defaultModel)` →
  `{mode:'median', p50:number, remaining:number, imminent:boolean}`
  `| {mode:'hidden', reason:'no-data'|'event-active'|'complete'|'stalled'|'beyond-window'}`.
  `imminent: p50 < 1`. Task 7's `EtaLine` renders `mode:'median'` without parens.
  Constants live in `attackForecast.mjs`: `SECTOR_DISPLAY_HOURS = 8`,
  `SECTOR_MIN_ETA_HOURS = 1 / 12`.

- [ ] **Step 1: Write the failing tests**

Fixture helper (top of the new test file — snapshots positional, status keyed, exactly like the live payload):

```js
import { describe, it, expect } from 'vitest';
import { sectorForecast } from '@/features/dashboard/attackForecast.mjs';

const HOUR = 3600;
const NOW = 1_800_000_000;

/** Steady 10k pts/h for 30h, campaign 1.0M, currently at 430k (sector 5 of 10). */
function makeData({ points = 430_000, events = [] } = {}) {
    const snapshots = [];
    for (let i = 30; i >= 0; i--) {
        snapshots.push({
            time: NOW - i * HOUR,
            data: [{ points: points - i * 10_000, points_taken: 0, status: 'active' }],
        });
    }
    return {
        status: [{ enemy: 0, points, points_max: 1_000_000, status: 'active' }],
        snapshots,
        events,
    };
}

const model = {
    // minimal valid attack model (isValidModel requires it); flat dow so the
    // day-of-week correction is a no-op in these fixtures
    bands: [0.02, 0.05, 0.1, 0.2, 0.4, 1.01],
    dow: [1, 1, 1, 1, 1, 1, 1],
    ratios: Object.fromEntries(
        [0, 1, 2, 3, 4, 5].map((b) => [b, { r25: 1, r50: 1, r75: 1 }]),
    ),
    meta: { rateWindowHours: 24, displayHours: 48, minEtaHours: 0.25 },
};

describe('sectorForecast', () => {
    it('targets the next sector boundary, not the campaign end', () => {
        // 430k of 1.0M → next boundary 500k → 70k remaining at 10k/h = 7h
        const f = sectorForecast(makeData(), 0, NOW, model);
        expect(f.mode).toBe('median');
        expect(f.p50).toBeCloseTo(7, 0);
        expect(f.remaining).toBe(70_000);
        expect(f.imminent).toBe(false);
    });

    it('hides while any event is active for the faction', () => {
        const events = [
            { type: 'defend', status: 'active', enemy: 0, region: 3 },
        ];
        const f = sectorForecast(makeData({ events }), 0, NOW, model);
        expect(f).toEqual({ mode: 'hidden', reason: 'event-active' });
    });

    it('hides beyond the sector display window', () => {
        // 401k → 99k remaining at 10k/h ≈ 9.9h > 8h window
        const f = sectorForecast(makeData({ points: 401_000 }), 0, NOW, model);
        expect(f).toEqual({ mode: 'hidden', reason: 'beyond-window' });
    });

    it('hides a complete campaign', () => {
        const f = sectorForecast(makeData({ points: 1_000_000 }), 0, NOW, model);
        expect(f).toEqual({ mode: 'hidden', reason: 'complete' });
    });

    it('marks a sub-hour estimate imminent', () => {
        // 495k → 5k remaining at 10k/h = 0.5h
        const f = sectorForecast(makeData({ points: 495_000 }), 0, NOW, model);
        expect(f.mode).toBe('median');
        expect(f.imminent).toBe(true);
    });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `mise exec -- npx vitest run src/__tests__/unit/features/dashboard/attackForecast.sector.test.mjs`
Expected: FAIL — `sectorForecast` is not exported.

- [ ] **Step 3: Implement**

In `attackForecast.mjs` (keep `attackForecast`, `isValidModel`, `bandOf`, `pointsAt` exactly as they are):

```js
const SECTOR_COUNT = 10;
/**
 * Sector display gates. In code, not the model: no calibrated sector table
 * exists yet (scripts/analysis/13-sector-eta.mjs is the future grading tool —
 * only 4 high-res seasons exist, effN=1 after walk-forward training), so the
 * sector forecast is MEDIAN-ONLY raw arithmetic until that gate is evaluable.
 */
const SECTOR_DISPLAY_HOURS = 8;
const SECTOR_MIN_ETA_HOURS = 1 / 12; // 5 minutes

/**
 * Median ETA until the faction's NEXT SECTOR boundary (points_max/10 steps) —
 * the sector-view counterpart of `attackForecast`. Same rate/dow/staleness
 * core, but median-only (no p25/p75: unmeasured ranges are not shown). Own
 * gates: hidden while ANY active event exists for the faction (defends freeze
 * the campaign; during attacks the campaign is complete).
 *
 * @param {object} data the live campaign payload
 * @param {number} enemy faction id
 * @param {number} nowSeconds unix seconds
 * @param {object} [model] used for its `dow` pace table only
 * @returns {{mode:'median', p50:number, remaining:number, imminent:boolean}
 *   | {mode:'hidden', reason:'no-data'|'event-active'|'complete'|'stalled'|'beyond-window'}}
 */
export function sectorForecast(data, enemy, nowSeconds, model = defaultModel) {
    if (
        !data ||
        !Array.isArray(data.status) ||
        !Array.isArray(data.snapshots) ||
        !isValidModel(model)
    ) {
        return { mode: 'hidden', reason: 'no-data' };
    }
    const eventActive = (data.events ?? []).some(
        (e) => e.status === EVENT_STATUS.ACTIVE && e.enemy === enemy,
    );
    if (eventActive) return { mode: 'hidden', reason: 'event-active' };

    const row = data.status.find((r) => r.enemy === enemy);
    if (!row || !(Number(row.points_max) > 0)) {
        return { mode: 'hidden', reason: 'no-data' };
    }
    const pointsMax = Number(row.points_max);
    const points = Number(row.points);
    if (points >= pointsMax) return { mode: 'hidden', reason: 'complete' };

    const pps = pointsMax / SECTOR_COUNT;
    const boundary = (Math.trunc(points / pps) + 1) * pps;
    const remaining = boundary - points;

    const then = pointsAt(
        data.snapshots, enemy, nowSeconds - model.meta.rateWindowHours * HOUR,
    );
    const now = pointsAt(data.snapshots, enemy, nowSeconds);
    if (!then || !now || !(now.time > then.time)) {
        return { mode: 'hidden', reason: 'no-data' };
    }
    const spanHours = (now.time - then.time) / HOUR;
    const ratePerHour = (now.points - then.points) / spanHours;
    if (!(ratePerHour > 0)) return { mode: 'hidden', reason: 'stalled' };

    let etaHours = remaining / ratePerHour;
    // Day-of-week correction — same one-step iteration as attackForecast; the
    // attack model's dow table is the shared pace pattern.
    const meanFactor = (from, to) => {
        let sum = 0;
        let n = 0;
        for (let t = from; t < to; t += 6 * HOUR) {
            sum += model.dow[new Date(t * 1000).getUTCDay()];
            n++;
        }
        return n > 0 ? sum / n : 1;
    };
    const horizon = Math.min(Math.max(etaHours, 1), 48);
    const adj =
        meanFactor(then.time, now.time) /
        meanFactor(nowSeconds, nowSeconds + horizon * HOUR);
    if (adj > 0) etaHours *= adj;

    etaHours -= (nowSeconds - now.time) / HOUR;
    const p50 = Math.max(etaHours, SECTOR_MIN_ETA_HOURS);

    if (!(p50 < SECTOR_DISPLAY_HOURS)) {
        return { mode: 'hidden', reason: 'beyond-window' };
    }
    return { mode: 'median', p50, remaining, imminent: p50 < 1 };
}
```

Note: the `meanFactor` duplication with `attackForecast` is acceptable (12 lines); if extracting, name it `dowAdjust(model, thenTime, nowTime, nowSeconds, etaHours)` and use it from both — implementer's judgment, both fine.

- [ ] **Step 4: Run new + existing tests**

Run: `mise exec -- npx vitest run src/__tests__/unit/features/dashboard/`
Expected: new file PASS, `attackForecast.test.mjs` PASS unmodified.

- [ ] **Step 5: Commit**

```bash
mise exec -- npm run lint:fix
git add src/features/dashboard/attackForecast.mjs src/__tests__/unit/features/dashboard/attackForecast.sector.test.mjs
git commit -m "feat(dashboard): sectorForecast — next-sector ETA with sector calibration

Ref #<issue>"
```

---

### Task 6: `eventForecast.mjs` — event completion verdict

**Files:**
- Create: `src/features/dashboard/eventForecast.mjs`
- Test: `src/__tests__/unit/features/dashboard/eventForecast.test.mjs`

**Interfaces:**
- Consumes: an event row from the live payload: `{status, start_time, end_time, points, points_max}`; `EVENT_STATUS` from `@/shared/enums/events.mjs`.
- Produces: `eventForecast(event, nowSeconds)` →
  `{mode:'verdict', etaHours:number|null, onTrack:boolean, stalled:boolean}`
  `| {mode:'hidden', reason:'no-event'|'no-data'|'complete'|'expired'}`.
  `VERDICT_MARGIN` exported for the test. Task 7's `EventCard` consumes this exact shape.

- [ ] **Step 1: Write the failing tests**

```js
import { describe, it, expect } from 'vitest';
import { eventForecast, VERDICT_MARGIN } from '@/features/dashboard/eventForecast.mjs';

const NOW = 1_800_000_000;
const H = 3600;

/** 6h event, 2h elapsed. Override points to steer the rate. */
function makeEvent(overrides = {}) {
    return {
        status: 'active',
        start_time: NOW - 2 * H,
        end_time: NOW + 4 * H,
        points: 40_000,
        points_max: 120_000,
        ...overrides,
    };
}

describe('eventForecast', () => {
    it('is on track when the pace so far beats the deadline', () => {
        // 40k in 2h → 20k/h; 80k remaining → 4h ETA vs 4h left → within margin
        const v = eventForecast(makeEvent(), NOW);
        expect(v.mode).toBe('verdict');
        expect(v.etaHours).toBeCloseTo(4, 5);
        expect(v.onTrack).toBe(true);
        expect(v.stalled).toBe(false);
    });

    it('is behind when the ETA overshoots the deadline beyond the margin', () => {
        // 20k in 2h → 10k/h; 100k remaining → 10h ETA vs 4h left
        const v = eventForecast(makeEvent({ points: 20_000 }), NOW);
        expect(v.onTrack).toBe(false);
        expect(v.etaHours).toBeCloseTo(10, 5);
    });

    it('stays on track inside the anti-flicker margin', () => {
        // ETA slightly past the deadline but within remaining*(1+margin)
        const remainingH = 4;
        const etaTargetH = remainingH * (1 + VERDICT_MARGIN) - 0.01;
        // rate = points/elapsed = points/2h ; eta = (120k-points)/rate = etaTarget
        // → points = 120k * 2 / (2 + etaTarget)
        const points = Math.round((120_000 * 2) / (2 + etaTargetH));
        const v = eventForecast(makeEvent({ points }), NOW);
        expect(v.onTrack).toBe(true);
    });

    it('reports a stalled event as behind with no ETA', () => {
        const v = eventForecast(makeEvent({ points: 0 }), NOW);
        expect(v).toEqual({
            mode: 'verdict', etaHours: null, onTrack: false, stalled: true,
        });
    });

    it('hides non-active, expired, complete and zero-elapsed events', () => {
        expect(eventForecast(makeEvent({ status: 'success' }), NOW).mode).toBe('hidden');
        expect(
            eventForecast(makeEvent({ end_time: NOW - 1 }), NOW),
        ).toEqual({ mode: 'hidden', reason: 'expired' });
        expect(
            eventForecast(makeEvent({ points: 120_000 }), NOW),
        ).toEqual({ mode: 'hidden', reason: 'complete' });
        expect(
            eventForecast(makeEvent({ start_time: NOW }), NOW),
        ).toEqual({ mode: 'hidden', reason: 'no-data' });
        expect(eventForecast(null, NOW)).toEqual({ mode: 'hidden', reason: 'no-event' });
    });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `mise exec -- npx vitest run src/__tests__/unit/features/dashboard/eventForecast.test.mjs`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement**

```js
import { EVENT_STATUS } from '@/shared/enums/events.mjs';

const HOUR = 3600;

/**
 * Anti-flicker slack on the on-track/behind verdict. Measured by
 * scripts/analysis/14-event-verdict-margin.mjs on h1_event_progress replays
 * (S157+); replace with the script's recommendation if it differs.
 */
export const VERDICT_MARGIN = 0.1; // ← Task 4's measured value goes here

/**
 * Completion verdict for an ACTIVE event: at the average pace since the event
 * started, does the bar fill before the deadline? Median-only by design — the
 * event-progress history (S157+) is too thin to calibrate a range honestly
 * (see the spec). Total function: every failure path returns {mode:'hidden'}.
 *
 * @param {{status:string, start_time:number, end_time:number, points:number,
 *   points_max:number}|null} event
 * @param {number} nowSeconds unix seconds
 * @returns {{mode:'verdict', etaHours:number|null, onTrack:boolean, stalled:boolean}
 *   | {mode:'hidden', reason:'no-event'|'no-data'|'complete'|'expired'}}
 */
export function eventForecast(event, nowSeconds) {
    if (!event || event.status !== EVENT_STATUS.ACTIVE) {
        return { mode: 'hidden', reason: 'no-event' };
    }
    const remaining = Number(event.points_max) - Number(event.points);
    if (remaining <= 0) return { mode: 'hidden', reason: 'complete' };
    if (event.end_time <= nowSeconds) return { mode: 'hidden', reason: 'expired' };
    const elapsed = nowSeconds - event.start_time;
    if (elapsed <= 0) return { mode: 'hidden', reason: 'no-data' };

    const ratePerSecond = Number(event.points) / elapsed;
    if (!(ratePerSecond > 0)) {
        return { mode: 'verdict', etaHours: null, onTrack: false, stalled: true };
    }
    const etaHours = remaining / ratePerSecond / HOUR;
    const remainingHours = (event.end_time - nowSeconds) / HOUR;
    return {
        mode: 'verdict',
        etaHours,
        onTrack: etaHours <= remainingHours * (1 + VERDICT_MARGIN),
        stalled: false,
    };
}
```

- [ ] **Step 4: Run to verify pass**

Run: `mise exec -- npx vitest run src/__tests__/unit/features/dashboard/eventForecast.test.mjs`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
mise exec -- npm run lint:fix
git add src/features/dashboard/eventForecast.mjs src/__tests__/unit/features/dashboard/eventForecast.test.mjs
git commit -m "feat(dashboard): eventForecast — event completion verdict vs deadline

Ref #<issue>"
```

---

### Task 7: EventCard — generic `EtaLine` (minutes), verdict rendering, success token

**Files:**
- Modify: `src/features/galaxy/EventCard.jsx` (rename `AssaultEta`→`EtaLine`, minutes formatting, `eventVerdict` prop, verdict element)
- Modify: `src/features/galaxy/EventCard.css` (verdict classes)
- Modify: `src/app/layout.css` (`--color-success` in the `@theme` block, next to `--color-danger`)
- Test: `src/__tests__/unit/features/galaxy/EventCard.test.jsx`

**Interfaces:**
- Consumes: the `{mode:'window', p25,p50,p75,imminent}` window shape (attack OR sector forecast — prop stays named `assaultForecast` externally? NO: rename prop to `etaForecast`); `eventForecast`'s verdict shape as new prop `eventVerdict`.
- Produces: `EventCard({ …, etaForecast, eventVerdict })`. RENAME NOTE: search for every `assaultForecast` reference before renaming — known sites: `EventCard.jsx` (prop + JSDoc typedef), `DashboardClient.jsx:214`, `src/__tests__/unit/features/galaxy/EventCard.test.jsx`, `src/__tests__/unit/features/dashboard/DashboardClient.test.jsx`. Grep for more: `rtk grep -rn "assaultForecast" src`.

- [ ] **Step 1: Write the failing tests (add to the existing assault-ETA describe block; update its render calls to the renamed prop)**

```jsx
it('renders minutes below one hour', () => {
    render(
        <EventCard
            {...base}
            etaForecast={{ mode: 'window', p25: 0.5, p50: 0.66, p75: 0.9, imminent: true }}
        />,
    );
    // 0.66h → ~40m, range 30m-54m
    expect(screen.getByText(/ETA ~/).textContent).toMatch(/~40m \(30m-54m\)/);
});

it('renders a median-only forecast without a range', () => {
    render(
        <EventCard
            {...base}
            etaForecast={{ mode: 'median', p50: 0.66, remaining: 5000, imminent: true }}
        />,
    );
    const el = screen.getByText(/ETA ~/);
    expect(el.textContent).toMatch(/ETA ~40m/);
    expect(el.textContent).not.toMatch(/\(/); // no unmeasured parens
});

it('renders the event verdict instead of the pace indicator', () => {
    render(
        <EventCard
            {...base}
            barLabel="CAPITAL_DEFENSE"
            endTime={1_800_000_000}
            pace={{ status: 'ahead', delta: 8100, deltaPercent: 4, currentRate: 1, requiredRate: 1 }}
            eventVerdict={{ mode: 'verdict', etaHours: 3.2, onTrack: true, stalled: false }}
        />,
    );
    const verdict = screen.getByText(/on track/);
    expect(verdict.textContent).toMatch(/▲ on track · done ~3h/);
    expect(verdict.className).toContain('sector-card-verdict--ok');
    // pace indicator suppressed when a verdict shows
    expect(screen.queryByText(/8.1K/)).toBeNull();
});

it('renders behind and stalled verdicts in danger styling', () => {
    const { rerender } = render(
        <EventCard
            {...base}
            barLabel="CAPITAL_DEFENSE"
            endTime={1_800_000_000}
            eventVerdict={{ mode: 'verdict', etaHours: 5, onTrack: false, stalled: false }}
        />,
    );
    expect(screen.getByText(/behind/).textContent).toMatch(/▼ behind · done ~5h/);
    expect(screen.getByText(/behind/).className).toContain('sector-card-verdict--bad');
    rerender(
        <EventCard
            {...base}
            barLabel="CAPITAL_DEFENSE"
            endTime={1_800_000_000}
            eventVerdict={{ mode: 'verdict', etaHours: null, onTrack: false, stalled: true }}
        />,
    );
    expect(screen.getByText(/behind/).textContent).toMatch(/▼ behind · stalled/);
});
```

- [ ] **Step 2: Run to verify failure**

Run: `mise exec -- npx vitest run src/__tests__/unit/features/galaxy/EventCard.test.jsx`
Expected: FAIL (unknown prop rendering, formatter missing).

- [ ] **Step 3: Implement**

In `EventCard.jsx`:

```jsx
/**
 * @param {number} h hours
 * @returns {string} whole hours at >=1h, whole minutes below ("40m")
 */
function formatEtaHours(h) {
    const clamped = Math.max(0, h);
    if (clamped < 1) return `${Math.round(clamped * 60)}m`;
    return `${Math.round(clamped)}h`;
}
```

`AssaultEta` → `EtaLine` (same JSX shell, formatted values, two modes):

```jsx
const med = formatEtaHours(forecast.p50);
const range =
    forecast.mode === 'window' ?
        ` (${formatEtaHours(forecast.p25)}-${formatEtaHours(forecast.p75)})`
    :   ''; // mode 'median' — no unmeasured parens (sector ETA, see spec ruling)
// … ETA ~{med}{range}
```

(the `h`/`m` suffix is now inside each formatted value, so the literal `h` after `{med}` and `{hi}` is removed; title attribute unchanged for 'window', and for 'median' it reads `Median estimate ${forecast.p50.toFixed(1)}h. Range ships once calibrated (script 13).`). Every render gate that checks `etaForecast?.mode === 'window'` (bar-label row condition and the `(barLabel || …)` wrapper) must accept `'median'` too — grep the file for `mode === 'window'`.

New verdict element, rendered in the bar-label row in PaceIndicator's slot:

```jsx
/**
 * @param {object} props
 * @param {{etaHours: number|null, onTrack: boolean, stalled: boolean}} props.verdict
 */
function EventVerdict({ verdict }) {
    const cls =
        verdict.onTrack ? 'sector-card-verdict--ok' : 'sector-card-verdict--bad';
    const text =
        verdict.stalled ? '▼ behind · stalled'
        : verdict.onTrack ? `▲ on track · done ~${formatEtaHours(verdict.etaHours)}`
        : `▼ behind · done ~${formatEtaHours(verdict.etaHours)}`;
    return (
        <span className={`sector-card-verdict ${cls}`} suppressHydrationWarning>
            {text}
        </span>
    );
}
```

In the bar-label row (currently `{pace && (<>…<PaceIndicator …/></>)}`):

```jsx
{eventVerdict?.mode === 'verdict' ?
    <>
        <span className="sector-card-sep">&middot;</span>
        <EventVerdict verdict={eventVerdict} />
    </>
:   pace && (
        <>
            <span className="sector-card-sep">&middot;</span>
            <PaceIndicator pace={pace} />
        </>
    )}
```

Also apply the same replacement to the meta-row fallback (`{!barLabel && pace && …}` — mirror the ternary so a verdict wins there too). Add `eventVerdict = null` to the destructured props with a JSDoc line, and update the `AssaultForecast` typedef comment to mention it covers sector windows too.

`EventCard.css`:

```css
.sector-card-verdict {
    font-family: var(--font-mono, monospace);
    font-size: var(--text-small);
    white-space: nowrap;
}
.sector-card-verdict--ok {
    color: var(--color-success);
}
.sector-card-verdict--bad {
    color: var(--color-danger);
}
```

`layout.css` `@theme` block — add directly under `--color-danger` in BOTH places it is defined (the block is duplicated around lines 11 and 77):

```css
--color-success: #58c979;
```

- [ ] **Step 4: Run tests + rename sweep**

```bash
rtk grep -rn "assaultForecast\|AssaultEta" src   # must return zero hits
mise exec -- npx vitest run src/__tests__/unit/features/galaxy/ src/__tests__/unit/features/dashboard/
```

Expected: zero stale references; PASS (DashboardClient tests may fail until Task 8's wiring — if its test file references `assaultForecast`, update the prop name there now, keeping behavior assertions unchanged).

- [ ] **Step 5: Commit**

```bash
mise exec -- npm run lint:fix
git add -A src/features/galaxy src/app/layout.css src/__tests__/unit
git commit -m "feat(dashboard): EtaLine minutes formatting + event pace verdict on cards

Ref #<issue>"
```

---

### Task 8: DashboardClient wiring — forecast follows the view, events get verdicts

**Files:**
- Modify: `src/features/dashboard/DashboardClient.jsx`
- Test: `src/__tests__/unit/features/dashboard/DashboardClient.test.jsx`

**Interfaces:**
- Consumes: `attackForecast`, `sectorForecast` (Task 5), `eventForecast` (Task 6), `EventCard`'s `etaForecast`/`eventVerdict` props (Task 7).

- [ ] **Step 1: Write the failing tests**

Add to the existing DashboardClient test file (reuse its existing fixture/mocks — it already mocks EventCard or renders it; follow whichever pattern is there). Assertions to add:

```jsx
it('passes the sector forecast in sector view and the attack forecast in campaign view', () => {
    // sector view (default persisted state)
    render(<DashboardClient {...baseProps} />);
    // In sector view the frontier card receives sectorForecast output —
    // assert via the rendered ETA line or the mocked EventCard's props,
    // matching the file's existing style for prop assertions.
});

it('passes an event verdict for the active defend event', () => {
    // active capital-defense fixture → EventCard receives eventVerdict
    // with mode 'verdict'
});
```

(The exact assertion mechanics depend on the file's existing mock style — mirror it; the two behaviors above are what must be pinned.)

- [ ] **Step 2: Run to verify failure**

Run: `mise exec -- npx vitest run src/__tests__/unit/features/dashboard/DashboardClient.test.jsx`
Expected: new tests FAIL.

- [ ] **Step 3: Implement**

In `DashboardClient.jsx`:

```js
import {
    attackForecast,
    sectorForecast,
} from '@/features/dashboard/attackForecast.mjs';
import { eventForecast } from '@/features/dashboard/eventForecast.mjs';
```

Frontier card (`renderFrontierCard`, the non-SE branch around L198-228): replace the `assaultForecast={attackForecast(...)}` prop with:

```jsx
etaForecast={
    isCampaignView ?
        attackForecast(data, index, Math.floor(Date.now() / 1000))
    :   sectorForecast(data, index, Math.floor(Date.now() / 1000))
}
eventVerdict={
    activeEvent ?
        eventForecast(activeEvent, Math.floor(Date.now() / 1000))
    :   null
}
```

(`sectorForecast` hides itself during active events — no extra gating needed here.)

Super Earth defend card (L127-145): add
`eventVerdict={eventForecast(superEarthDefendEvent, Math.floor(Date.now() / 1000))}`.

Homeworld card (L249-272): add
`eventVerdict={attackEvent ? eventForecast(attackEvent, Math.floor(Date.now() / 1000)) : null}`.

Keep the `pace={evaluateProgress(...)}` props — they are the fallback when the verdict hides (e.g. event just started, `elapsed <= 0`).

- [ ] **Step 4: Run all tests**

Run: `mise exec -- npm run test:unit`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
mise exec -- npm run lint:fix
git add src/features/dashboard/DashboardClient.jsx src/__tests__/unit/features/dashboard/DashboardClient.test.jsx
git commit -m "feat(dashboard): ETA follows the regions view; event cards get verdicts

Ref #<issue>"
```

---

### Task 9: Verify chain, live check, merge, close

**Files:**
- Modify: `CHANGELOG.md` (in the merge commit, per Git Workflow rule 2), `package.json` version.

- [ ] **Step 1: Full verify chain in the worktree**

```bash
mise exec -- npm run lint
mise exec -- npm run typecheck
mise exec -- npm run test:unit
set -a && source .env.development && set +a && mise exec -- npm run build
```

Expected: all four pass. Report any failure verbatim; do not merge on red.

- [ ] **Step 2: Live check on the dev server (main checkout serves :3000)**

```bash
curl -s http://localhost:3000 | grep -oE 'sector-card-(assault|verdict)[^>]*>[^<]*(<!-- -->[^<]*)*' | head -5
```

Expected: the ETA line renders (`ETA ~…`); if an event is live, a verdict span renders. If Chrome DevTools MCP is free, additionally toggle the regions view programmatically and confirm the ETA line changes target (sector ⇄ campaign). If the dashboard currently has no active event, the verdict cannot be observed live — state that plainly rather than claiming it verified.

- [ ] **Step 3: Merge back (from the MAIN checkout — check for parallel-session drift first)**

```bash
cd /Users/andrei/Developer/helldivers.bot
git branch --show-current   # must say develop; git status must be clean
git fetch origin && git log --oneline develop..origin/develop  # reconcile if non-empty
git merge --no-ff --no-commit feature/view-dependent-eta
# CHANGELOG.md: add "## X.Y.0" (next minor over the current top version) with
# Added entries: view-dependent ETA (sector/campaign), event pace verdicts,
# sector calibration backtest (script 13) + emitted sector model section,
# verdict-margin script 14, minutes formatting, --color-success token.
# package.json: bump "version" to match.
git add CHANGELOG.md package.json
git commit -m "Merge feature/view-dependent-eta into develop (vX.Y.0)"
git push origin develop
git worktree remove .worktrees/feature-view-dependent-eta
git branch -d feature/view-dependent-eta
```

- [ ] **Step 3b: File the follow-up issue for the sector range**

```bash
gh issue create --title "Sector ETA: add measured range when script 13's gate becomes evaluable" \
  --label enhancement --milestone "Engineering Health" \
  --body "Sector-view ETA shipped median-only (#483): only 4 high-res seasons exist, walk-forward training leaves effN=1 — the range gate (recall ≥0.70 / precision ≥0.80) is unevaluable. Re-run \`node --env-file=.env.development scripts/analysis/13-sector-eta.mjs\` around S165+; when the gate passes, execute the deferred Task 3 of docs/superpowers/plans/2026-07-31-view-dependent-eta.md (emit sector section) and restore range display in EtaLine (mode 'window' path already exists)."
```

- [ ] **Step 4: Close the issue**

```bash
gh issue close <issue> --comment "Shipped in vX.Y.0: sector-view ETA (calibrated on N sector crossings via scripts/analysis/13, recall/precision from the emitter guards), campaign-view assault ETA unchanged, event cards now show done-verdicts (margin from script 14). Spec + plan in docs/superpowers/."
```

---

## Self-Review Notes

- Spec coverage: view-dependent frontier ETA (T5+T8), event verdicts folded into the pace slot (T6+T7+T8), measure-first sector calibration (T2+T3), verdict margin measurement (T4), minutes formatting + `--color-success` (T7), attackForecast behavior preserved (T5 step 4, T3 step 3). Out-of-scope items from the spec are not tasked — correct.
- Type consistency: window shape `{mode:'window',p25,p50,p75,remaining,imminent}` shared by both forecasts (T5) and consumed by `EtaLine` (T7); verdict shape `{mode:'verdict',etaHours,onTrack,stalled}` produced (T6) and consumed (T7/T8); model `sector` shape produced (T3) and validated (T5 `isValidSectorModel`).
- Known judgment calls left to the implementer, bounded: DashboardClient test-mock mechanics (T8 step 1 mirrors the file's existing style); optional `dowAdjust` extraction (T5 step 3).
