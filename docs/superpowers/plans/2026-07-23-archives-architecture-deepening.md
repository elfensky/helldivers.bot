# Archives Architecture Deepening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the three verified architecture candidates from the 2026-07-23 review — one War Clock module for war-start-relative time (candidate 2), deepen the War Narrative module by folding its beat generators inside (candidate 1), and extract the duplicated season seed-on-miss dance behind one testable interface (candidate 4) — plus two micro-fixes (EventLog prop type, getCampaign shape contract).

**Architecture:** Three independent deepenings, sequenced so the War Clock lands first (the narrative fold consumes it). `warClock.mjs` becomes the single home for day math (five duplicated anchoring behaviors collapse onto it). `buildWarNarrative.mjs` absorbs `conquestBeats`/`playerBeats`/`numbersBeat` as internal implementation — their contracts stop being external, and the untested lastTime/lastDay clamp gets orchestrator-level tests. `getCampaignOrSeed.mjs` deduplicates the read→miss→seed→re-read dance currently hand-written in both `archives/page.jsx` (untested) and `api/h1/campaign/route.js` (tested), returning a discriminated result so each caller renders its own branches.

**Tech Stack:** Next.js 16, plain `.mjs` modules with JSDoc (checkJs), Vitest, `tryCatch` wrapper (never try/catch).

## Global Constraints

- **Worktree:** create via superpowers:using-git-worktrees at execution time — branch `feature/archives-deepening` off `develop`, worktree at `.worktrees/feature-archives-deepening`. Copy `.env.development`, run `npm install && npx prisma generate` (per CLAUDE.md § Worktree Workflow).
- **Never commit to `main`/`develop` directly. Never squash/fast-forward — `git merge --no-ff` only.**
- **Verification chain after every phase and at the end:** `npm run lint`, `npm run typecheck`, `npm run test:unit`, `npm run build` — all four must pass.
- **Error handling:** `tryCatch` wrapper (`src/shared/utils/tryCatch.mjs`), never raw try/catch.
- **Run `npm run lint:fix` before each commit** (Prettier is wired into ESLint).
- **No new dependencies. No Prisma migrations.**
- On merge to `develop`: move CHANGELOG entries from `## Unreleased` into a new `## X.Y.Z` section (patch bump — this is refactor + bugfix work) and bump `package.json` version **in the merge commit**.
- Existing behavior is preserved except three deliberate, documented deltas: (Task 8) late highlight-beat *day labels* clamp to the last war day; (Task 10) the archives page distinguishes "season not found upstream" from generic errors; (Task 10) the page now seeds on miss even when `resolvedSeason` is null (matching the API route's existing behavior — reachable only with an empty DB).

---

## Phase A — the War Clock (candidate 2)

### Task 1: `warClock.mjs` — the war calendar module

**Files:**
- Create: `src/shared/utils/game/warClock.mjs`
- Test: `src/__tests__/unit/shared/utils/game/warClock.test.mjs`

**Interfaces:**
- Consumes: nothing (pure module).
- Produces (later tasks rely on these exact signatures):
  - `SECONDS_PER_DAY: 86400`
  - `resolveWarStart(warStart: number|null|undefined, times: Array<number|null|undefined>): number` — returns `warStart` when non-null, else the minimum of `times` (reduce, never spread), `Infinity` for an empty/all-null array.
  - `dayOf(time: number, warStart: number): number` — 1-based floored war day, clamped ≥ 1.
  - `dayFraction(time: number, warStart: number): number` — 0-based fractional days (chart x-axes).
  - `warDaySpan(warStart: number, lastTime: number): number` — whole-day rounded span.

- [ ] **Step 1: Write the failing test**

```js
// src/__tests__/unit/shared/utils/game/warClock.test.mjs
import { describe, it, expect } from 'vitest';
import {
    SECONDS_PER_DAY,
    resolveWarStart,
    dayOf,
    dayFraction,
    warDaySpan,
} from '@/shared/utils/game/warClock.mjs';

const DAY = 86400;
const WAR_START = 1_000_000;

describe('warClock', () => {
    it('exports the canonical seconds-per-day constant', () => {
        expect(SECONDS_PER_DAY).toBe(86400);
    });

    describe('dayOf — 1-based floored war day', () => {
        it('maps the war-start instant to day 1', () => {
            expect(dayOf(WAR_START, WAR_START)).toBe(1);
        });
        it('floors within a day and increments at the boundary', () => {
            expect(dayOf(WAR_START + DAY - 1, WAR_START)).toBe(1);
            expect(dayOf(WAR_START + DAY, WAR_START)).toBe(2);
            expect(dayOf(WAR_START + 5 * DAY, WAR_START)).toBe(6);
        });
        it('clamps pre-war times to day 1 (never 0 or negative)', () => {
            expect(dayOf(WAR_START - 10 * DAY, WAR_START)).toBe(1);
        });
    });

    describe('dayFraction — 0-based fractional days', () => {
        it('maps the war-start instant to 0', () => {
            expect(dayFraction(WAR_START, WAR_START)).toBe(0);
        });
        it('keeps intra-day samples distinct (no flooring)', () => {
            expect(dayFraction(WAR_START + DAY / 2, WAR_START)).toBe(0.5);
            expect(dayFraction(WAR_START + 3 * DAY, WAR_START)).toBe(3);
        });
    });

    describe('resolveWarStart — anchor with min-time fallback', () => {
        it('returns warStart untouched when present (including 0)', () => {
            expect(resolveWarStart(WAR_START, [1, 2, 3])).toBe(WAR_START);
            expect(resolveWarStart(0, [1, 2, 3])).toBe(0);
        });
        it('falls back to the minimum time when warStart is nullish', () => {
            expect(resolveWarStart(null, [30, 10, 20])).toBe(10);
            expect(resolveWarStart(undefined, [30, 10, 20])).toBe(10);
        });
        it('ignores null holes and returns Infinity for empty input', () => {
            expect(resolveWarStart(null, [30, null, 10])).toBe(10);
            expect(resolveWarStart(null, [])).toBe(Infinity);
            expect(resolveWarStart(null, [null, undefined])).toBe(Infinity);
        });
        it('handles large arrays (reduce, not spread)', () => {
            const big = Array.from({ length: 200_000 }, (_, i) => i + 5);
            expect(resolveWarStart(null, big)).toBe(5);
        });
    });

    describe('warDaySpan — whole-day rounded span', () => {
        it('rounds to the nearest whole day', () => {
            expect(warDaySpan(WAR_START, WAR_START + 7 * DAY)).toBe(7);
            expect(warDaySpan(WAR_START, WAR_START + 7.4 * DAY)).toBe(7);
            expect(warDaySpan(WAR_START, WAR_START + 7.6 * DAY)).toBe(8);
        });
        it('is 0 for a zero-length war', () => {
            expect(warDaySpan(WAR_START, WAR_START)).toBe(0);
        });
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/__tests__/unit/shared/utils/game/warClock.test.mjs`
Expected: FAIL — cannot resolve `@/shared/utils/game/warClock.mjs`.

- [ ] **Step 3: Write the implementation**

```js
// src/shared/utils/game/warClock.mjs
/**
 * The war calendar — single home for war-start-relative time math.
 *
 * Two counting conventions coexist ON PURPOSE and must not be merged:
 *  - `dayOf`      — 1-based, floored, clamped ≥ 1. For human-facing day labels
 *                   (narrative beats, event-log markers, baked timeseries days).
 *  - `dayFraction`— 0-based, fractional. For chart x-axes, where intra-day
 *                   samples must stay distinct and the axis time-proportional.
 * Both share the same anchor (`war_start`, or the earliest observed time via
 * `resolveWarStart`), so a caller mixing them is off by exactly one day —
 * always pick by name, never re-derive the formula locally.
 */

export const SECONDS_PER_DAY = 86400;

/**
 * Resolve the day-1 anchor: `warStart` when known, else the earliest observed
 * time. reduce, not `Math.min(...spread)` — a large array spread as call
 * arguments can throw RangeError.
 *
 * @param {number | null | undefined} warStart - Unix-seconds war start, if known.
 * @param {Array<number | null | undefined>} times - Observed unix-seconds times.
 * @returns {number} The anchor, or Infinity when nothing is observable.
 */
export function resolveWarStart(warStart, times) {
    if (warStart != null) return warStart;
    return (times ?? []).reduce((m, t) => Math.min(m, t ?? Infinity), Infinity);
}

/**
 * 1-based floored war day, clamped to ≥ 1. Day 1 is the first day of the war.
 *
 * @param {number} time - Unix-seconds timestamp.
 * @param {number} warStart - Unix-seconds anchor for day 1.
 * @returns {number}
 */
export function dayOf(time, warStart) {
    const day = Math.floor((time - warStart) / SECONDS_PER_DAY) + 1;
    return day < 1 ? 1 : day;
}

/**
 * 0-based fractional days since war start. Not floored — intra-day samples
 * stay distinct so chart x-axes remain time-proportional.
 *
 * @param {number} time - Unix-seconds timestamp.
 * @param {number} warStart - Unix-seconds anchor for day 0.
 * @returns {number}
 */
export function dayFraction(time, warStart) {
    return (time - warStart) / SECONDS_PER_DAY;
}

/**
 * Whole-day rounded span of the war up to `lastTime` — the shared x-domain
 * max for the archives charts.
 *
 * @param {number} warStart - Unix-seconds anchor.
 * @param {number} lastTime - Unix-seconds last data point.
 * @returns {number}
 */
export function warDaySpan(warStart, lastTime) {
    return Math.round((lastTime - warStart) / SECONDS_PER_DAY);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/__tests__/unit/shared/utils/game/warClock.test.mjs`
Expected: PASS (all tests).

- [ ] **Step 5: Commit**

```bash
git add src/shared/utils/game/warClock.mjs src/__tests__/unit/shared/utils/game/warClock.test.mjs
git commit -m "feat(archives): warClock module — single home for war-day math"
```

### Task 2: migrate `getCampaign`'s baked `day` to warClock

**Files:**
- Modify: `src/db/queries/getCampaign.mjs:141-150`
- Test (existing, must stay green): `src/__tests__/unit/queries/getCampaign.test.mjs`

**Interfaces:**
- Consumes: `dayOf` from Task 1.
- Produces: unchanged `playerTimeseries[].day` values (behavior-preserving — `getCampaign` keeps its `: 1` default when `warStart` is null; that default is a deliberate no-fallback semantic, NOT `resolveWarStart`).

- [ ] **Step 1: Add the import**

At the top of `src/db/queries/getCampaign.mjs`, after the existing imports:

```js
import { dayOf } from '@/shared/utils/game/warClock.mjs';
```

- [ ] **Step 2: Replace the inline formula**

Old (`getCampaign.mjs:141-150`):

```js
    const playerTimeseries = groupStatisticByBucket(allStatRows).map(
        ({ time, players }) => ({
            time,
            day: warStart != null ? Math.floor((time - warStart) / 86400) + 1 : 1,
            total: players[0] + players[1] + players[2],
```

New:

```js
    const playerTimeseries = groupStatisticByBucket(allStatRows).map(
        ({ time, players }) => ({
            time,
            // Deliberate default (not resolveWarStart): a season with no
            // war_start gets flat day 1, not a data-derived anchor.
            day: warStart != null ? dayOf(time, warStart) : 1,
            total: players[0] + players[1] + players[2],
```

- [ ] **Step 3: Run the existing tests**

Run: `npx vitest run src/__tests__/unit/queries/getCampaign.test.mjs`
Expected: PASS — `dayOf` clamps to ≥ 1 where the old inline formula did not, but `time >= warStart` always holds here (warStart is the earliest bucket), so outputs are identical.

- [ ] **Step 4: Commit**

```bash
git add src/db/queries/getCampaign.mjs
git commit -m "refactor(db): getCampaign bakes playerTimeseries.day via warClock"
```

### Task 3: migrate `buildIntroMarkers` + delete the ghost-module comments

**Files:**
- Modify: `src/features/archives/buildIntroMarkers.mjs`
- Test (existing, must stay green): `src/__tests__/unit/features/archives/buildIntroMarkers.test.mjs`

**Interfaces:**
- Consumes: `dayOf`, `resolveWarStart` from Task 1.
- Produces: unchanged marker shape `{kind:'intro', enemy, name, time, day}`.

- [ ] **Step 1: Replace day math and stale comments**

Old (`buildIntroMarkers.mjs:1-3`):

```js
import factions from '@/shared/enums/factions.mjs';

const DAY = 86400;
```

New:

```js
import factions from '@/shared/enums/factions.mjs';
import { dayOf, resolveWarStart } from '@/shared/utils/game/warClock.mjs';
```

Old (`buildIntroMarkers.mjs:13-17`, inside the JSDoc — the stale `buildEngagementSeries` reference):

```js
 * `day` mirrors the war-day convention used elsewhere (1-based): the first day
 * of the war is Day 1. `warStart` anchors Day 1, falling back to the earliest
 * `first_seen` across all introduced factions when absent (reduce, not
 * `Math.min(...spread)`, so a large status array can't trip the engine's
 * arg-count limit — matching buildEngagementSeries).
```

New:

```js
 * `day` uses the shared warClock `dayOf` convention (1-based): the first day
 * of the war is Day 1. `warStart` anchors Day 1, falling back to the earliest
 * `first_seen` across all introduced factions when absent (resolveWarStart).
```

Old (`buildIntroMarkers.mjs:48-51` — the second stale reference and inline reduce):

```js
    // reduce, not Math.min(...spread): a long status array spread as call
    // arguments can throw RangeError. Mirrors buildEngagementSeries.
    const anchor =
        data?.war_start ?? candidates.reduce((m, c) => Math.min(m, c.time), Infinity);
```

New:

```js
    const anchor = resolveWarStart(
        data?.war_start,
        candidates.map((c) => c.time),
    );
```

Old (`buildIntroMarkers.mjs:59`):

```js
            day: Math.floor((time - anchor) / DAY) + 1,
```

New:

```js
            day: dayOf(time, anchor),
```

- [ ] **Step 2: Run the existing tests**

Run: `npx vitest run src/__tests__/unit/features/archives/buildIntroMarkers.test.mjs`
Expected: PASS — identical values (`dayOf` adds a ≥ 1 clamp; `first_seen >= anchor` always holds since the anchor is the minimum of those very times).

- [ ] **Step 3: Commit**

```bash
git add src/features/archives/buildIntroMarkers.mjs
git commit -m "refactor(archives): buildIntroMarkers uses warClock; drop ghost buildEngagementSeries refs"
```

### Task 4: migrate `buildPlayerLine`

**Files:**
- Modify: `src/features/archives/buildPlayerLine.mjs:74-78`
- Test (existing, must stay green): `src/__tests__/unit/features/archives/buildPlayerLine.test.mjs`

**Interfaces:**
- Consumes: `dayFraction`, `resolveWarStart` from Task 1.
- Produces: unchanged `{points, dots}` with 0-based fractional `x`.

- [ ] **Step 1: Add the import**

At the top of `src/features/archives/buildPlayerLine.mjs`, alongside existing imports:

```js
import { dayFraction, resolveWarStart } from '@/shared/utils/game/warClock.mjs';
```

- [ ] **Step 2: Replace the inline anchor + formula**

Old (`buildPlayerLine.mjs:74-78`):

```js
    // Anchor day 0 to war_start; fall back to the earliest bucket. reduce, not
    // Math.min(...spread): a large series can blow the engine's arg limit.
    const anchor = warStart ?? series.reduce((m, e) => Math.min(m, e.time), Infinity);
    // Continuous (fractional) days since war start, 0-based to match Conquest.
    const dayInto = (time) => (time - anchor) / 86400;
```

New:

```js
    // Anchor day 0 to war_start; fall back to the earliest bucket.
    const anchor = resolveWarStart(warStart, series.map((e) => e.time));
    // Continuous (fractional) days since war start, 0-based to match Conquest.
    const dayInto = (time) => dayFraction(time, anchor);
```

- [ ] **Step 3: Run the existing tests**

Run: `npx vitest run src/__tests__/unit/features/archives/buildPlayerLine.test.mjs`
Expected: PASS — note `resolveWarStart` uses `!= null` where the old code used `??`; both treat null/undefined identically, and `warStart = 0` now correctly anchors to 0 in both versions.

- [ ] **Step 4: Commit**

```bash
git add src/features/archives/buildPlayerLine.mjs
git commit -m "refactor(archives): buildPlayerLine uses warClock dayFraction/resolveWarStart"
```

### Task 5: migrate `FactionHealthChart`

**Files:**
- Modify: `src/features/archives/FactionHealthChart.jsx:30-48`
- Test (existing, must stay green): `src/__tests__/unit/features/archives/FactionHealthChart.test.jsx`

**Interfaces:**
- Consumes: `dayFraction`, `resolveWarStart` from Task 1.
- Produces: unchanged chart entries `{day, time, bugs, cyborgs, illuminate}`.

- [ ] **Step 1: Add the import**

At the top of `src/features/archives/FactionHealthChart.jsx`, alongside existing imports:

```js
import { dayFraction, resolveWarStart } from '@/shared/utils/game/warClock.mjs';
```

- [ ] **Step 2: Replace the anchor shortcut and formula**

Old (`FactionHealthChart.jsx:34-38`):

```js
    // Continuous, 0-based days since war start (falls back to the first
    // snapshot). Fractional — not rounded — so intra-day snapshots stay distinct
    // and the x-axis is time-proportional, matching PlayersOverTimeChart so the
    // two charts can be read against each other day-for-day.
    const anchor = warStart ?? snapshots[0].time;
```

New:

```js
    // Continuous, 0-based days since war start (falls back to the earliest
    // snapshot). Fractional — not rounded — so intra-day snapshots stay distinct
    // and the x-axis is time-proportional, matching PlayersOverTimeChart so the
    // two charts can be read against each other day-for-day.
    const anchor = resolveWarStart(warStart, snapshots.map((s) => s.time));
```

Old (`FactionHealthChart.jsx:46`):

```js
                day: (snap.time - anchor) / 86400,
```

New:

```js
                day: dayFraction(snap.time, anchor),
```

- [ ] **Step 3: Run the existing tests**

Run: `npx vitest run src/__tests__/unit/features/archives/FactionHealthChart.test.jsx`
Expected: PASS — snapshots are bucket-ordered ascending, so min(times) === `snapshots[0].time`; identical output, but the anchor no longer silently depends on sort order.

- [ ] **Step 4: Commit**

```bash
git add src/features/archives/FactionHealthChart.jsx
git commit -m "refactor(archives): FactionHealthChart anchors via warClock"
```

### Task 6: migrate `ArchivesClient.warDayMax` + Phase A verification

**Files:**
- Modify: `src/features/archives/ArchivesClient.jsx:89-102`
- Test (existing, must stay green): `src/__tests__/unit/features/archives/ArchivesClient.test.jsx`

**Interfaces:**
- Consumes: `warDaySpan` from Task 1.
- Produces: unchanged `warDayMax: number | undefined` passed to both charts as `domainMax`.

- [ ] **Step 1: Add the import**

At the top of `src/features/archives/ArchivesClient.jsx`, alongside existing imports:

```js
import { warDaySpan } from '@/shared/utils/game/warClock.mjs';
```

- [ ] **Step 2: Replace the inline computation**

Old (`ArchivesClient.jsx:89-102`):

```js
    // Shared day-domain so Conquest Progress and Players Over Time use the SAME
    // x-scale and line up day-for-day. Span = the latest data point of either
    // series, in whole days since war start.
    const warDayMax =
        data?.war_start != null ?
            Math.round(
                (Math.max(
                    data?.snapshots?.[data.snapshots.length - 1]?.time ?? data.war_start,
                    playerTimeseries[playerTimeseries.length - 1]?.time ?? data.war_start,
                ) -
                    data.war_start) /
                    86400,
            )
        :   undefined;
```

New:

```js
    // Shared day-domain so Conquest Progress and Players Over Time use the SAME
    // x-scale and line up day-for-day. Span = the latest data point of either
    // series, in whole days since war start.
    const warDayMax =
        data?.war_start != null ?
            warDaySpan(
                data.war_start,
                Math.max(
                    data?.snapshots?.[data.snapshots.length - 1]?.time ?? data.war_start,
                    playerTimeseries[playerTimeseries.length - 1]?.time ?? data.war_start,
                ),
            )
        :   undefined;
```

- [ ] **Step 3: Run the client test, then the full Phase A verification chain**

Run: `npx vitest run src/__tests__/unit/features/archives/ArchivesClient.test.jsx`
Expected: PASS.

Run: `npm run lint && npm run typecheck && npm run test:unit && npm run build`
Expected: all four PASS.

- [ ] **Step 4: Commit**

```bash
git add src/features/archives/ArchivesClient.jsx
git commit -m "refactor(archives): ArchivesClient warDayMax via warClock warDaySpan"
```

---

## Phase B — deepen the War Narrative module (candidate 1)

### Task 7: characterization tests — highlight beats through the orchestrator

The generators' behavior is currently tested only in isolation with fabricated inputs; no orchestrator fixture ever produces a highlight beat, so the clamp seam (`buildWarNarrative.mjs:195,203`) is untested. Before folding, pin the behavior through the ONE interface that will survive: `buildWarNarrative(data, telemetry)`. All tests in this task must pass against the CURRENT code (green characterization — the refactor in Task 8 must keep them green).

**Files:**
- Modify: `src/__tests__/unit/features/archives/buildWarNarrative.test.mjs` (append a new describe block)

**Interfaces:**
- Consumes: `buildWarNarrative(data, telemetry)`; `PHRASES`/`pickVariant` from `@/features/archives/narrativePhrasing.mjs`; `formatNumber` from `@/shared/utils/format/formatNumber.mjs`. Expected texts are COMPUTED via `pickVariant` (deterministic seeded phrasing) so the tests survive phrase-pool edits.
- Produces: the regression net Task 8 refactors under.

- [ ] **Step 1: Append the new describe block (all green against current code)**

Add to the end of `src/__tests__/unit/features/archives/buildWarNarrative.test.mjs`. It reuses the file's existing `DAY`, `HOUR`, `WAR_START` constants (defined at the top of the file):

```js
import { PHRASES, pickVariant } from '@/features/archives/narrativePhrasing.mjs';
import { formatNumber } from '@/shared/utils/format/formatNumber.mjs';
```

(Add those two imports next to the existing imports at the top of the file.)

```js
describe('buildWarNarrative — highlight beats through the orchestrator', () => {
    const SEASON = 210;

    /**
     * Fixture that drives every highlight-beat path through the public
     * interface: a surge (day 4), a collapse (day 6), a conquest breakthrough
     * (day 5), a homeworld fall (day 7), and a defeat outcome (day 8).
     * playerTimeseries totals: [100,100,100,200,40] → median 100;
     * 200 ≥ 1.4×100 → surge; 40 ≤ 0.6×100 → collapse (not index 0).
     */
    function highlightFixture() {
        return {
            season: SEASON,
            war_start: WAR_START,
            introduction_order: { order: [1, 0, 0] },
            status: [{ enemy: 0, first_seen: WAR_START, status: 'active' }],
            points_max: { points: [1000, 0, 0] },
            snapshots: [
                {
                    time: WAR_START + 2 * DAY,
                    data: [{ points: 500, status: 'active' }, null, null],
                },
                {
                    time: WAR_START + 4 * DAY, // frac 0.95 ≥ 0.9 → breakthrough, day 5
                    data: [{ points: 950, status: 'active' }, null, null],
                },
                {
                    time: WAR_START + 6 * DAY, // defeated → homeworld falls, day 7
                    data: [{ points: 1000, status: 'defeated' }, null, null],
                },
            ],
            playerTimeseries: [
                { time: WAR_START, day: 1, total: 100 },
                { time: WAR_START + 1 * DAY, day: 2, total: 100 },
                { time: WAR_START + 2 * DAY, day: 3, total: 100 },
                { time: WAR_START + 3 * DAY, day: 4, total: 200 }, // surge
                { time: WAR_START + 5 * DAY, day: 6, total: 40 }, // collapse
            ],
            events: [
                {
                    type: 'defend',
                    status: 'success',
                    enemy: 0,
                    region: 5,
                    start_time: WAR_START,
                    end_time: WAR_START + HOUR,
                    event_id: 1,
                    season: SEASON,
                },
                // Region-0 defend fails on day 8 → defeat outcome caps the log.
                {
                    type: 'defend',
                    status: 'fail',
                    enemy: 0,
                    region: 0,
                    start_time: WAR_START + 7 * DAY,
                    end_time: WAR_START + 7 * DAY + HOUR,
                    event_id: 2,
                    season: SEASON,
                },
            ],
        };
    }

    it('emits a surge beat on the peak day with the seeded phrase', () => {
        const beats = buildWarNarrative(highlightFixture());
        const expected = pickVariant(
            PHRASES.surge,
            SEASON,
            (WAR_START + 3 * DAY) | 0,
        )(formatNumber(200));
        const surge = beats.find((b) => b.text === expected);
        expect(surge).toBeDefined();
        expect(surge.day).toBe(4);
    });

    it('emits a collapse beat on the trough day with the seeded phrase', () => {
        const beats = buildWarNarrative(highlightFixture());
        const expected = pickVariant(
            PHRASES.collapse,
            SEASON,
            (WAR_START + 5 * DAY) | 0,
        )(formatNumber(40));
        const collapse = beats.find((b) => b.text === expected);
        expect(collapse).toBeDefined();
        expect(collapse.day).toBe(6);
    });

    it('emits conquest breakthrough and homeworld-fall beats on their crossing days', () => {
        const beats = buildWarNarrative(highlightFixture());
        const breakthrough = pickVariant(PHRASES.breakthrough, SEASON, 0)('Bugs');
        const falls = pickVariant(PHRASES.homeworldFalls, SEASON, 10)('Bugs');
        const bt = beats.find((b) => b.text === breakthrough);
        const hf = beats.find((b) => b.text === falls);
        expect(bt).toBeDefined();
        expect(bt.day).toBe(5);
        expect(hf).toBeDefined();
        expect(hf.day).toBe(7);
    });

    it('emits no surge/collapse beats when player counts are steady', () => {
        const data = highlightFixture();
        data.playerTimeseries = [
            { time: WAR_START, day: 1, total: 100 },
            { time: WAR_START + 1 * DAY, day: 2, total: 101 },
            { time: WAR_START + 2 * DAY, day: 3, total: 99 },
        ];
        const texts = buildWarNarrative(data).map((b) => b.text);
        const surge = pickVariant(
            PHRASES.surge,
            SEASON,
            (WAR_START + 1 * DAY) | 0,
        )(formatNumber(101));
        expect(texts).not.toContain(surge);
    });

    it('dedupes same-faction same-day breakthrough+fall into the fall beat only', () => {
        const data = highlightFixture();
        data.snapshots = [
            {
                time: WAR_START + 4 * DAY,
                data: [{ points: 950, status: 'active' }, null, null],
            },
            {
                time: WAR_START + 4 * DAY + HOUR, // same war day → dedupe
                data: [{ points: 1000, status: 'defeated' }, null, null],
            },
        ];
        const texts = buildWarNarrative(data).map((b) => b.text);
        const breakthrough = pickVariant(PHRASES.breakthrough, SEASON, 0)('Bugs');
        const falls = pickVariant(PHRASES.homeworldFalls, SEASON, 10)('Bugs');
        expect(texts).not.toContain(breakthrough);
        expect(texts).toContain(falls);
    });

    it('clamps a late highlight beat so the outcome still caps the chronicle', () => {
        const data = highlightFixture();
        // Telemetry buckets extend 12 days past the final event — the exact
        // scenario the a6fa57e clamp exists for.
        data.playerTimeseries = [
            { time: WAR_START, day: 1, total: 100 },
            { time: WAR_START + 1 * DAY, day: 2, total: 100 },
            { time: WAR_START + 2 * DAY, day: 3, total: 100 },
            { time: WAR_START + 20 * DAY, day: 21, total: 40 }, // late collapse
        ];
        data.snapshots = [];
        const beats = buildWarNarrative(data);
        const collapse = pickVariant(
            PHRASES.collapse,
            SEASON,
            (WAR_START + 20 * DAY) | 0,
        )(formatNumber(40));
        const collapseIdx = beats.findIndex((b) => b.text === collapse);
        expect(collapseIdx).toBeGreaterThan(-1);
        // The outcome beat is last — the clamped collapse must sort before it.
        expect(collapseIdx).toBeLessThan(beats.length - 1);
        expect(beats[beats.length - 1].text).toMatch(
            /Super Earth falls|Super Earth's defeat/,
        );
    });
});
```

- [ ] **Step 2: Run and verify GREEN against the current code**

Run: `npx vitest run src/__tests__/unit/features/archives/buildWarNarrative.test.mjs`
Expected: PASS (all, including the new block). If a phrase-key assertion fails (e.g. `PHRASES.breakthrough` key `0` vs `enemy`), read `src/features/archives/narrativePhrasing.mjs` and the generator's `pickVariant` call to correct the seed — the seeds used above are `enemy` (=0) for breakthrough, `enemy + 10` (=10) for falls, `time | 0` for surge/collapse, matching `conquestBeats.mjs:60-76` and `playerBeats.mjs:40-59`.

- [ ] **Step 3: Commit**

```bash
git add src/__tests__/unit/features/archives/buildWarNarrative.test.mjs
git commit -m "test(archives): characterize highlight beats through the buildWarNarrative interface"
```

### Task 8: fold the generators into `buildWarNarrative` (with day-label clamp)

**Files:**
- Modify: `src/features/archives/buildWarNarrative.mjs`
- Modify: `src/__tests__/unit/features/archives/buildWarNarrative.test.mjs` (one new red test)
- Delete: `src/features/archives/conquestBeats.mjs`, `src/features/archives/playerBeats.mjs`, `src/features/archives/numbersBeat.mjs`
- Delete: `src/__tests__/unit/features/archives/conquestBeats.test.mjs`, `src/__tests__/unit/features/archives/playerBeats.test.mjs`, `src/__tests__/unit/features/archives/numbersBeat.test.mjs`

**Interfaces:**
- Consumes: `dayOf` from Task 1; the Task 7 regression net.
- Produces: the single external interface `buildWarNarrative(data, telemetry) → Array<{day, text}>`. `buildPlayerBeats` / `buildConquestBeats` / `buildNumbersBeat` become non-exported internal functions — no module outside `buildWarNarrative.mjs` may import them (verified: nothing else in `src/` does today). `narrativePhrasing.mjs` stays a separate shared module.

- [ ] **Step 1: Write the failing test (deliberate behavior fix — day labels clamp)**

Currently only the beat *time* is clamped to `lastTime`; the *day label* leaks through, so a telemetry trough 12 days after the war's end renders "Day 21" sorted before the "Day 8" outcome. Append inside the Task 7 describe block:

```js
    it('clamps a late highlight beat DAY label to the last war day', () => {
        const data = highlightFixture();
        data.playerTimeseries = [
            { time: WAR_START, day: 1, total: 100 },
            { time: WAR_START + 1 * DAY, day: 2, total: 100 },
            { time: WAR_START + 2 * DAY, day: 3, total: 100 },
            { time: WAR_START + 20 * DAY, day: 21, total: 40 },
        ];
        data.snapshots = [];
        const beats = buildWarNarrative(data);
        const collapse = pickVariant(
            PHRASES.collapse,
            SEASON,
            (WAR_START + 20 * DAY) | 0,
        )(formatNumber(40));
        const beat = beats.find((b) => b.text === collapse);
        expect(beat).toBeDefined();
        // Last event ends on day 8 — a beat cannot be dated after the war ends.
        expect(beat.day).toBeLessThanOrEqual(8);
    });
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/__tests__/unit/features/archives/buildWarNarrative.test.mjs`
Expected: FAIL — `expected 21 to be less than or equal to 8`. Everything else PASS.

- [ ] **Step 3: Fold the generators**

In `src/features/archives/buildWarNarrative.mjs`:

1. Delete the three generator imports (lines 11-13):

```js
import { buildPlayerBeats } from '@/features/archives/playerBeats.mjs';
import { buildConquestBeats } from '@/features/archives/conquestBeats.mjs';
import { buildNumbersBeat } from '@/features/archives/numbersBeat.mjs';
```

2. Add the two imports the folded code needs, and swap the local day math for warClock (delete the local `SECONDS_PER_DAY` const and `dayOf` function at lines 15, 21-24):

```js
import { formatNumber } from '@/shared/utils/format/formatNumber.mjs';
import { dayOf, SECONDS_PER_DAY } from '@/shared/utils/game/warClock.mjs';
```

3. Paste the three generator bodies as internal (non-exported) functions after `factionName`, with `export` removed and the duplicated `factionName`/local `dayOf` deleted. `buildConquestBeats` uses the shared `dayOf(time, warStart)` in place of its local closure; its constants come along:

```js
const GATES_THRESHOLD = 0.9; // "at the gates" — homeworld-assault range
const SURGE_FACTOR = 1.4; // a peak ≥ 1.4× baseline is a "rally"
const COLLAPSE_FACTOR = 0.6; // a trough ≤ 0.6× baseline is "the front grows quiet"

function median(nums) {
    if (nums.length === 0) return 0;
    const s = [...nums].sort((a, b) => a - b);
    const mid = Math.floor(s.length / 2);
    return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}
```

Then `buildPlayerBeats(playerTimeseries, season)` verbatim from `playerBeats.mjs:23-65` (minus `export`), `buildConquestBeats(snapshots, pointsMax, season, warStart)` from `conquestBeats.mjs:23-92` (minus `export`, minus its local `factionName` and `dayOf` — calls become `dayOf(breakthrough.time, warStart)` / `dayOf(firstFall.time, warStart)`), and `buildNumbersBeat(telemetry, lastTime, day, season)` from `numbersBeat.mjs:19-27` (minus `export`). While pasting `buildConquestBeats`, correct its stale JSDoc `@param` for snapshots — through `getCampaign` the `data` array is always `[f0, f1, f2]` with no null holes (`bucketing.mjs:38` filters partial buckets); the `if (!s) continue` guard stays as defense but the doc must not claim "null before a faction is introduced":

```js
 * @param {Array<{ time:number, data:Array<{ points:number, status:string }|null> }>} snapshots - data[enemy] positional (index = faction id). Through getCampaign every entry is [f0,f1,f2] non-null (partial buckets are filtered); the null guard below is defensive only.
```

4. Clamp the day label alongside the time (the red test's fix). Old (lines 194-204):

```js
    for (const pb of buildPlayerBeats(data?.playerTimeseries ?? [], season)) {
        beats.push({ ...pb, time: Math.min(pb.time, lastTime), order: seq++ });
    }
    for (const cb of buildConquestBeats(
        data?.snapshots ?? [],
        data?.points_max ?? { points: [] },
        season,
        warStart,
    )) {
        beats.push({ ...cb, time: Math.min(cb.time, lastTime), order: seq++ });
    }
```

New:

```js
    for (const pb of buildPlayerBeats(data?.playerTimeseries ?? [], season)) {
        beats.push({
            ...pb,
            time: Math.min(pb.time, lastTime),
            day: Math.min(pb.day, lastDay),
            order: seq++,
        });
    }
    for (const cb of buildConquestBeats(
        data?.snapshots ?? [],
        data?.points_max ?? { points: [] },
        season,
        warStart,
    )) {
        beats.push({
            ...cb,
            time: Math.min(cb.time, lastTime),
            day: Math.min(cb.day, lastDay),
            order: seq++,
        });
    }
```

(`lastTime`/`lastDay` are computed just above this block — no reordering needed.)

- [ ] **Step 4: Delete the absorbed modules and their isolated tests**

```bash
git rm src/features/archives/conquestBeats.mjs src/features/archives/playerBeats.mjs src/features/archives/numbersBeat.mjs
git rm src/__tests__/unit/features/archives/conquestBeats.test.mjs src/__tests__/unit/features/archives/playerBeats.test.mjs src/__tests__/unit/features/archives/numbersBeat.test.mjs
```

(Coverage they provided now lives in the Task 7/8 orchestrator tests: surge/collapse/flat-series, breakthrough/fall/same-day-dedupe, numbers-present/numbers-null were already orchestrator-level at `buildWarNarrative.test.mjs:261-273`.)

- [ ] **Step 5: Run the full suite + Phase B verification chain**

Run: `npx vitest run src/__tests__/unit/features/archives/buildWarNarrative.test.mjs`
Expected: PASS including the Step 1 red test.

Run: `npm run lint && npm run typecheck && npm run test:unit && npm run build`
Expected: all four PASS. (`grep -r "conquestBeats\|playerBeats\|numbersBeat" src/` must return nothing outside `buildWarNarrative.mjs`.)

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "refactor(archives): fold beat generators into buildWarNarrative; clamp day labels to lastDay"
```

---

## Phase C — season resolution behind one interface (candidate 4)

### Task 9: `getCampaignOrSeed` module

**Files:**
- Create: `src/db/queries/getCampaignOrSeed.mjs`
- Test: `src/__tests__/unit/queries/getCampaignOrSeed.test.mjs`

**Interfaces:**
- Consumes: `getCampaign` (`@/db/queries/getCampaign.mjs`), `updateSeason`/`SEASON_NOT_FOUND` (`@/update/season.mjs`), `tryCatch`.
- Produces (Tasks 10-11 rely on this exact discriminated shape):
  - `getCampaignOrSeed(season?: number|null): Promise<`
    - `{ ok: true, data: object | null }` — hit, or seeded-then-still-empty (data null preserves today's route semantics);
    - `{ ok: false, reason: 'not_found', message: string }` — upstream API says the season doesn't exist;
    - `{ ok: false, reason: 'error', stage: 'get-campaign' | 'backfill-season' | 'get-campaign-retry', error: Error }>`

- [ ] **Step 1: Write the failing tests**

```js
// src/__tests__/unit/queries/getCampaignOrSeed.test.mjs
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/db/queries/getCampaign.mjs', () => ({ getCampaign: vi.fn() }));
vi.mock('@/update/season.mjs', () => ({
    updateSeason: vi.fn(),
    SEASON_NOT_FOUND: 'SEASON_NOT_FOUND',
}));

import { getCampaign } from '@/db/queries/getCampaign.mjs';
import { updateSeason } from '@/update/season.mjs';
import { getCampaignOrSeed } from '@/db/queries/getCampaignOrSeed.mjs';

const CAMPAIGN = { season: 42, events: [] };

describe('getCampaignOrSeed', () => {
    beforeEach(() => {
        vi.mocked(getCampaign).mockReset();
        vi.mocked(updateSeason).mockReset();
    });

    it('returns ok+data on a first-read hit without seeding', async () => {
        vi.mocked(getCampaign).mockResolvedValueOnce(CAMPAIGN);
        const result = await getCampaignOrSeed(42);
        expect(result).toEqual({ ok: true, data: CAMPAIGN });
        expect(updateSeason).not.toHaveBeenCalled();
    });

    it('returns an error result when the first read throws', async () => {
        const boom = new Error('db down');
        vi.mocked(getCampaign).mockRejectedValueOnce(boom);
        const result = await getCampaignOrSeed(42);
        expect(result).toEqual({
            ok: false,
            reason: 'error',
            stage: 'get-campaign',
            error: boom,
        });
        expect(updateSeason).not.toHaveBeenCalled();
    });

    it('seeds on miss and returns the re-read data', async () => {
        vi.mocked(getCampaign)
            .mockResolvedValueOnce(null)
            .mockResolvedValueOnce(CAMPAIGN);
        vi.mocked(updateSeason).mockResolvedValueOnce(undefined);
        const result = await getCampaignOrSeed(42);
        expect(updateSeason).toHaveBeenCalledWith(42);
        expect(result).toEqual({ ok: true, data: CAMPAIGN });
    });

    it('maps a SEASON_NOT_FOUND seed failure to not_found', async () => {
        vi.mocked(getCampaign).mockResolvedValueOnce(null);
        const missing = new Error('season 999 does not exist', {
            cause: 'SEASON_NOT_FOUND',
        });
        vi.mocked(updateSeason).mockRejectedValueOnce(missing);
        const result = await getCampaignOrSeed(999);
        expect(result).toEqual({
            ok: false,
            reason: 'not_found',
            message: 'season 999 does not exist',
        });
    });

    it('maps a generic seed failure to a backfill-season error', async () => {
        vi.mocked(getCampaign).mockResolvedValueOnce(null);
        const boom = new Error('upstream 500');
        vi.mocked(updateSeason).mockRejectedValueOnce(boom);
        const result = await getCampaignOrSeed(42);
        expect(result).toEqual({
            ok: false,
            reason: 'error',
            stage: 'backfill-season',
            error: boom,
        });
    });

    it('maps a retry-read failure to a get-campaign-retry error', async () => {
        const boom = new Error('db down on retry');
        vi.mocked(getCampaign)
            .mockResolvedValueOnce(null)
            .mockRejectedValueOnce(boom);
        vi.mocked(updateSeason).mockResolvedValueOnce(undefined);
        const result = await getCampaignOrSeed(42);
        expect(result).toEqual({
            ok: false,
            reason: 'error',
            stage: 'get-campaign-retry',
            error: boom,
        });
    });

    it('returns ok with null data when the seed succeeds but the retry is still empty', async () => {
        vi.mocked(getCampaign)
            .mockResolvedValueOnce(null)
            .mockResolvedValueOnce(null);
        vi.mocked(updateSeason).mockResolvedValueOnce(undefined);
        const result = await getCampaignOrSeed(42);
        // Preserves today's route semantics (200 with null body) — callers
        // render their own empty state.
        expect(result).toEqual({ ok: true, data: null });
    });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/__tests__/unit/queries/getCampaignOrSeed.test.mjs`
Expected: FAIL — cannot resolve `@/db/queries/getCampaignOrSeed.mjs`.

- [ ] **Step 3: Write the implementation**

```js
// src/db/queries/getCampaignOrSeed.mjs
import { tryCatch } from '@/shared/utils/tryCatch.mjs';
import { getCampaign } from '@/db/queries/getCampaign.mjs';
import { updateSeason, SEASON_NOT_FOUND } from '@/update/season.mjs';

/**
 * Read a season's campaign data, seeding it from the official HD1 API on a
 * miss (the shared read → miss → seed → re-read dance previously hand-written
 * in both /archives page.jsx and /api/h1/campaign route.js).
 *
 * Returns a discriminated result — never throws, never renders. Callers own
 * their own presentation of each branch (404 vs page copy, reportError vs
 * console.error).
 *
 * @param {number | null} [season] - Season number, or null for the latest.
 * @returns {Promise<
 *   | { ok: true, data: object | null }
 *   | { ok: false, reason: 'not_found', message: string }
 *   | { ok: false, reason: 'error', stage: 'get-campaign' | 'backfill-season' | 'get-campaign-retry', error: Error }
 * >} `ok` with `data: null` means the seed succeeded but the season is still
 *   empty — callers render their own empty state.
 */
export async function getCampaignOrSeed(season = null) {
    const { data, error } = await tryCatch(getCampaign(season));
    if (error) return { ok: false, reason: 'error', stage: 'get-campaign', error };
    if (data) return { ok: true, data };

    const { error: seedError } = await tryCatch(updateSeason(season));
    if (seedError) {
        if (seedError.cause === SEASON_NOT_FOUND) {
            return { ok: false, reason: 'not_found', message: seedError.message };
        }
        return { ok: false, reason: 'error', stage: 'backfill-season', error: seedError };
    }

    const { data: retried, error: retryError } = await tryCatch(getCampaign(season));
    if (retryError) {
        return {
            ok: false,
            reason: 'error',
            stage: 'get-campaign-retry',
            error: retryError,
        };
    }
    return { ok: true, data: retried };
}
```

- [ ] **Step 4: Run to verify green**

Run: `npx vitest run src/__tests__/unit/queries/getCampaignOrSeed.test.mjs`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add src/db/queries/getCampaignOrSeed.mjs src/__tests__/unit/queries/getCampaignOrSeed.test.mjs
git commit -m "feat(db): getCampaignOrSeed — shared read-or-seed season resolver"
```

### Task 10: archives page consumes `getCampaignOrSeed`

**Files:**
- Modify: `src/app/archives/page.jsx:1-101`

**Interfaces:**
- Consumes: `getCampaignOrSeed` from Task 9 (exact result shape above).
- Produces: identical page rendering, except the two documented deltas (not_found copy; seed-on-miss now also runs for `resolvedSeason === null`, matching the route).

- [ ] **Step 1: Swap the imports**

Old (`page.jsx:3-5`):

```js
import { tryCatch } from '@/shared/utils/tryCatch.mjs';
import { getCampaign } from '@/db/queries/getCampaign.mjs';
import { updateSeason } from '@/update/season.mjs';
```

New:

```js
import { tryCatch } from '@/shared/utils/tryCatch.mjs';
import { getCampaign } from '@/db/queries/getCampaign.mjs';
import { getCampaignOrSeed } from '@/db/queries/getCampaignOrSeed.mjs';
```

(`getCampaign` stays — the page still uses it for the active-season read; `tryCatch` stays for that call and telemetry.)

- [ ] **Step 2: Replace the resolution block**

Old (`page.jsx:61-101` — the cast alias, first read, seed-on-miss, error and empty branches):

```js
    // Fetch requested season from DB. getCampaign accepts a season number or
    // null (latest), but its `season = null` default makes TS infer the param
    // as `null`; cast the fn to its real signature rather than the arg.
    const getCampaignBySeason =
        /** @type {(season?: number | null) => ReturnType<typeof getCampaign>} */ (
            getCampaign
        );
    let { data, error } = await tryCatch(getCampaignBySeason(resolvedSeason));

    // If season not in DB, fetch from official API and seed it via the
    // shared updateSeason pipeline (same helper the worker uses).
    if (!error && !data && resolvedSeason !== null) {
        const { error: seedError } = await tryCatch(updateSeason(resolvedSeason));
        if (seedError) {
            console.error('updateSeason failed:', seedError);
            return (
                <div className="gutters flex min-h-full w-full flex-col items-center justify-center py-12">
                    Unable to fetch season {resolvedSeason} from the official API.
                </div>
            );
        }
        // Re-query after seeding
        ({ data, error } = await tryCatch(getCampaignBySeason(resolvedSeason)));
    }

    if (error !== null) {
        console.error('getCampaign failed:', error);
        return (
            <div className="gutters flex min-h-full w-full flex-col items-center justify-center py-12">
                Unable to load campaign data. Please try again later.
            </div>
        );
    }

    if (!data) {
        return (
            <div className="gutters flex min-h-full w-full flex-col items-center justify-center py-12">
                No data available for season {resolvedSeason}.
            </div>
        );
    }
```

New:

```js
    // Read the requested season, seeding from the official API on a miss —
    // the same resolver /api/h1/campaign uses, so the two paths can't drift.
    const result = await getCampaignOrSeed(resolvedSeason);

    if (!result.ok) {
        if (result.reason === 'not_found') {
            return (
                <div className="gutters flex min-h-full w-full flex-col items-center justify-center py-12">
                    No data available for season {resolvedSeason}.
                </div>
            );
        }
        console.error(`getCampaignOrSeed failed (${result.stage}):`, result.error);
        return (
            <div className="gutters flex min-h-full w-full flex-col items-center justify-center py-12">
                Unable to load campaign data. Please try again later.
            </div>
        );
    }

    const data = result.data;
    if (!data) {
        return (
            <div className="gutters flex min-h-full w-full flex-col items-center justify-center py-12">
                No data available for season {resolvedSeason}.
            </div>
        );
    }
```

- [ ] **Step 3: Verify**

Run: `npm run typecheck && npm run test:unit`
Expected: PASS. Then, with the dev server already running on :3000, manually load `http://localhost:3000/archives` and `http://localhost:3000/archives?season=1` — both must render (season 1 exercises the seed path only if absent from the local DB; either render is a pass).

- [ ] **Step 4: Commit**

```bash
git add src/app/archives/page.jsx
git commit -m "refactor(archives): page resolves seasons via getCampaignOrSeed"
```

### Task 11: API route consumes `getCampaignOrSeed`

**Files:**
- Modify: `src/app/api/h1/campaign/route.js`
- Test (existing, must stay green): `src/__tests__/unit/routes/campaign.test.mjs`

**Interfaces:**
- Consumes: `getCampaignOrSeed` from Task 9.
- Produces: identical HTTP behavior — 400 invalid season, 404 SEASON_NOT_FOUND, 500 with `reportError` (same stage strings), 200 with data (possibly null).

- [ ] **Step 1: Swap the imports**

Old (`route.js:12-13`):

```js
import { getCampaign } from '@/db/queries/getCampaign.mjs';
import { updateSeason, SEASON_NOT_FOUND } from '@/update/season.mjs';
```

New:

```js
import { getCampaignOrSeed } from '@/db/queries/getCampaignOrSeed.mjs';
```

(`tryCatch` import stays only if still used elsewhere in the file; after Step 2 it is not — remove it.)

- [ ] **Step 2: Replace the body**

Old (`route.js:26-79` — from `let data = null;` through the final `return successResponse(...)`): replace the whole read/seed/retry block with:

```js
    /** @type {number | null} */
    let season = null;

    if (request.nextUrl.searchParams.get('season')) {
        const check = isValidNumber.safeParse(request.nextUrl.searchParams.get('season'));
        if (!check.success)
            return errorResponse(400, start, check?.error?.issues[0]?.message);
        season = Number(request.nextUrl.searchParams.get('season'));
    }

    const result = await getCampaignOrSeed(season);
    if (!result.ok) {
        if (result.reason === 'not_found') {
            return errorResponse(404, start, result.message);
        }
        reportError(result.error, {
            route: '/api/h1/campaign',
            stage: result.stage,
            season,
        });
        return errorResponse(500, start, result.error?.message);
    }
    return successResponse(200, start, result.data);
```

(The `after(...)` umami block and the method-not-allowed exports at the bottom stay untouched.)

- [ ] **Step 3: Run the existing route tests**

Run: `npx vitest run src/__tests__/unit/routes/campaign.test.mjs`
Expected: PASS — the tests mock `@/db/queries/getCampaign.mjs` and `@/update/season.mjs`, and those mocks propagate through `getCampaignOrSeed`'s module graph. If an assertion checks a `reportError` stage string, our stages (`get-campaign`, `backfill-season`, `get-campaign-retry`) match the route's originals verbatim.

- [ ] **Step 4: Phase C verification chain + commit**

Run: `npm run lint && npm run typecheck && npm run test:unit && npm run build`
Expected: all four PASS.

```bash
git add src/app/api/h1/campaign/route.js
git commit -m "refactor(api): /api/h1/campaign resolves seasons via getCampaignOrSeed"
```

---

## Phase D — micro-fixes and closeout

### Task 12: fix the `selectedEventKey` interface at the EventLog seam

**Files:**
- Modify: `src/features/timeline/EventLog.jsx:63`
- Modify: `src/features/archives/ArchivesClient.jsx:220-227`

**Interfaces:**
- Produces: `EventLog`'s `selectedEventKey` prop correctly typed `string | null`; the ArchivesClient cast workaround deleted.

- [ ] **Step 1: Type the default at the destructure site**

Old (`EventLog.jsx:63`):

```js
    selectedEventKey = null,
```

New:

```js
    selectedEventKey = /** @type {string | null} */ (null),
```

- [ ] **Step 2: Delete the caller-side cast**

Old (`ArchivesClient.jsx:220-227`):

```js
                        selectedEventKey={
                            /* EventLog compares this key by ===, so a string is the
                               real contract, but its prop default makes TS infer the
                               narrower null type — cast to pass the computed key. */
                            /** @type {null | undefined} */ (
                                selectedEvent ? eventKey(selectedEvent) : null
                            )
                        }
```

New:

```js
                        selectedEventKey={selectedEvent ? eventKey(selectedEvent) : null}
```

- [ ] **Step 3: Verify and commit**

Run: `npm run typecheck && npx vitest run src/__tests__/unit/features/timeline/EventLog.test.jsx src/__tests__/unit/features/archives/ArchivesClient.test.jsx`
Expected: PASS.

```bash
git add src/features/timeline/EventLog.jsx src/features/archives/ArchivesClient.jsx
git commit -m "fix(archives): type EventLog selectedEventKey string|null; drop caller cast"
```

### Task 13: document the getCampaign shape contract (candidate 3's verified outcome)

Normalizing the positional faction shape was **rejected** during verification — it is the external HD1 wire format, shared with ingest (`update/season.mjs`) and the public rebroadcast egress (`db/queries/rebroadcast.mjs`) via `groupStatusByBucket`. The verified action is documentation: make the mixed convention an explicit, named contract at the one interface everyone reads.

**Files:**
- Modify: `src/db/queries/getCampaign.mjs:16-37` (JSDoc only — no runtime change)

- [ ] **Step 1: Extend the shape doc**

Old (`getCampaign.mjs:19-25`):

```js
 * - `status`     — 3 rows from h1_status, one per faction, latest bucket each.
 *                  Consumers cast this as an array of faction states.
 * - `snapshots`  — full h1_status history for the season, returned as a
 *                  shape:
 *                  [{ time, data: [faction0, faction1, faction2] }, ...]
 *                  The archives chart readers iterate this list and access
 *                  data[enemy] for each time point.
```

New:

```js
 * - `status`     — 3 rows from h1_status, one per faction, latest bucket each.
 *                  KEYED convention: each row carries an explicit `.enemy` id.
 * - `snapshots`  — full h1_status history for the season, returned as a
 *                  shape:
 *                  [{ time, data: [faction0, faction1, faction2] }, ...]
 *                  POSITIONAL convention: `data[enemy]` — index IS the faction
 *                  id (0=bugs, 1=cyborgs, 2=illuminate), no `.enemy` field on
 *                  the elements. Always exactly 3 non-null entries: partial
 *                  buckets are dropped by groupStatusByBucket (bucketing.mjs).
 *                  ⚠ This mixed keyed-vs-positional convention mirrors the HD1
 *                  wire format (campaign_status keyed, snapshots positional)
 *                  and is round-trip-preserved by update/season.mjs (ingest)
 *                  and rebroadcast.mjs (egress) — do NOT normalize it here;
 *                  see the 2026-07-23 architecture review. Reading data with
 *                  the wrong convention was the exact bug fixed in 1d2f974.
```

- [ ] **Step 2: Verify and commit**

Run: `npm run typecheck && npm run lint`
Expected: PASS (doc-only change).

```bash
git add src/db/queries/getCampaign.mjs
git commit -m "docs(db): name the keyed-vs-positional faction conventions at the getCampaign interface"
```

### Task 14: CHANGELOG + final verification

**Files:**
- Modify: `CHANGELOG.md` (under `## Unreleased`)

- [ ] **Step 1: Add changelog entries**

Under `## Unreleased` (create the section at the top if absent):

```markdown
### Changed

- **Archives architecture deepening** (2026-07-23 review):
    - New `warClock` module (`src/shared/utils/game/warClock.mjs`) — single home for war-start-relative day math (`dayOf`, `dayFraction`, `resolveWarStart`, `warDaySpan`); six duplicated formulas across the archives builders/charts/queries now share it.
    - War Narrative beat generators (`conquestBeats`, `playerBeats`, `numbersBeat`) folded into `buildWarNarrative` as internal implementation; highlight-beat behavior now tested through the public interface, including the previously untested lastTime clamp.
    - New `getCampaignOrSeed` resolver deduplicates the season read-or-seed dance shared by `/archives` and `/api/h1/campaign` (previously two drifting hand-written copies; the page's copy was untested).

### Fixed

- Late highlight beats (telemetry buckets past the final event) now clamp their **day label** to the last war day, not just their sort position.
- `EventLog`'s `selectedEventKey` prop is correctly typed `string | null` (drops a caller-side cast workaround).
- Removed stale doc references to the deleted `buildEngagementSeries` module; corrected the snapshot-shape doc on the conquest beats (no null holes through `getCampaign`).
```

- [ ] **Step 2: Full verification chain**

Run: `npm run lint && npm run typecheck && npm run test:unit && npm run build`
Expected: all four PASS. Report actual output faithfully — if anything fails, stop and fix before merging.

- [ ] **Step 3: Commit**

```bash
git add CHANGELOG.md
git commit -m "docs(changelog): archives architecture deepening"
```

- [ ] **Step 4: Merge (from the main checkout, per CLAUDE.md § Git Workflow)**

```bash
git checkout develop
git merge --no-ff feature/archives-deepening
# In the SAME merge commit: move the Unreleased entries into a new patch
# version section (## X.Y.Z) and bump package.json "version" to match.
git push
git worktree remove .worktrees/feature-archives-deepening
git branch -d feature/archives-deepening
```

---

## Explicitly out of scope (verified out)

- **Candidate 3 normalization** — rejected; the positional shape is an external wire-format contract (Task 13 documents it instead).
- **Candidate 5 derivation pass / memoization** — performance premise refuted (sub-millisecond walks); only its `selectedEventKey` finding survives (Task 12).
- The page's active-season read (`getCampaign()` for the seasons list) stays in `page.jsx` — three lines of derivation is not worth a module.
