# Cascade Failure Log Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a cross-season cascade-failure leaderboard rendered as an `EventLog`-style section on `/stats` (grouped by season), reusing the dashboard's `EventLog` layout idioms. The same component renders on `/archives` filtered to a single season.

**Architecture:** Replace `findWorstCascade` with a stricter `findAllCascades` (1-hour gap rule, min length 3, returns every qualifying cascade). A new server query (`getCascadeLeaderboard`) aggregates cascades across all seasons. A new `<CascadeLog>` client component mirrors `<EventLog>` — same `<section>` shape, day-grouped layout, sort toggle. New helpers: `groupCascadesBySeason`, `generateCascadeLede`, `useCascadeLogSort`, `CascadeLogSortToggle`. No new visual primitives; the cascade chain (`8 → 7 → 6 → … → 0`) is the one new rendered element.

**Tech Stack:** Next.js 16 (App Router), React 19, Vitest + React Testing Library, Prisma 7, Tailwind v4, ESLint v9, JSDoc + `tsc --noEmit` (no TypeScript files).

**Spec:** `docs/superpowers/specs/2026-05-23-cascade-failure-log-design.md` (committed at `d407eac` on `feature/cascade-failure-log`).

**Issue:** [#272](https://github.com/elfensky/helldivers.bot/issues/272).

---

## File Structure

**Added:**

| File | Responsibility |
|---|---|
| `src/db/queries/getCascadeLeaderboard.mjs` | Cross-season cascade aggregation. One Prisma query, React-cached. |
| `src/features/timeline/groupCascadesBySeason.mjs` | Group + sort cascades by season for `CascadeLog`. |
| `src/features/timeline/CascadeLog.jsx` | Client component, mirror of `EventLog`. |
| `src/features/timeline/CascadeLogCard.jsx` | Single-cascade card. |
| `src/features/timeline/CascadeLogSortToggle.jsx` | Sort toggle, mirror of `EventLogSortToggle`. |
| `src/features/timeline/useCascadeLogSort.mjs` | Persisted sort hook. |
| `src/features/stats/generateCascadeLede.mjs` | Pure lede-string builder. |
| `src/__tests__/unit/db/queries/getCascadeLeaderboard.test.mjs` | Unit tests (Prisma mocked). |
| `src/__tests__/unit/features/timeline/groupCascadesBySeason.test.mjs` | Unit tests. |
| `src/__tests__/unit/features/timeline/CascadeLog.test.jsx` | RTL tests. |
| `src/__tests__/unit/features/timeline/CascadeLogCard.test.jsx` | RTL tests. |
| `src/__tests__/unit/features/timeline/useCascadeLogSort.test.mjs` | Hook test. |
| `src/__tests__/unit/features/stats/generateCascadeLede.test.mjs` | Unit tests. |

**Modified:**

| File | Change |
|---|---|
| `src/shared/utils/game/seasonAnalytics.mjs` | Replace `findWorstCascade` with `findAllCascades`. |
| `src/__tests__/unit/shared/utils/game/seasonAnalytics.test.mjs` | Replace tests. |
| `src/features/archives/ArchiveStats.jsx` | Remove `WORST_CASCADE` `<StatCard>` and `findWorstCascade` import. |
| `src/__tests__/unit/features/archives/ArchiveStats.test.jsx` | Remove `WORST_CASCADE` assertions. |
| `src/shared/preferences/sortOrder.mjs` | Add `CASCADE_SORT_ORDER_KEY` + `validateCascadeSortOrder`. |
| `src/features/timeline/EventLog.css` | Add `.event-log-card-chain` + `.event-log-lede` classes. |
| `src/app/stats/page.jsx` | Insert `<CascadeLog>` section. |
| `src/features/archives/ArchivesClient.jsx` | Render `<CascadeLog>` below the StatGrid. |

---

## Task 1: `findAllCascades` algorithm

**Files:**
- Modify: `src/shared/utils/game/seasonAnalytics.mjs`
- Modify: `src/__tests__/unit/shared/utils/game/seasonAnalytics.test.mjs`

This task adds `findAllCascades` next to the existing `findWorstCascade`. The old function stays for one more task to keep `ArchiveStats.jsx` building. Task 2 will remove both.

- [ ] **Step 1: Write the failing tests**

Replace the contents of `src/__tests__/unit/shared/utils/game/seasonAnalytics.test.mjs` with:

```js
import { describe, it, expect } from 'vitest';
import {
    findAllCascades,
    findWorstCascade,
} from '@/shared/utils/game/seasonAnalytics.mjs';

/**
 * Helper to build a defend/fail event. `gapAfterPrevEndSec` defaults to
 * 1800 (30 minutes), well inside the 1-hour cascade window.
 */
function makeFailedDefend({ enemy, region, prevEndTime = null, durationSec = 7200 }) {
    const start_time = prevEndTime != null ? prevEndTime + 1800 : 0;
    const end_time = start_time + durationSec;
    return {
        type: 'defend',
        status: 'fail',
        enemy,
        region,
        start_time,
        end_time,
        event_id: Math.floor(Math.random() * 1_000_000),
    };
}

describe('findAllCascades', () => {
    it('returns [] for empty events', () => {
        expect(findAllCascades([])).toEqual([]);
        expect(findAllCascades(null)).toEqual([]);
        expect(findAllCascades(undefined)).toEqual([]);
    });

    it('returns [] when fewer than 3 failed defends total', () => {
        const e1 = makeFailedDefend({ enemy: 2, region: 8 });
        const e2 = makeFailedDefend({ enemy: 2, region: 7, prevEndTime: e1.end_time });
        expect(findAllCascades([e1, e2])).toEqual([]);
    });

    it('returns [] for a length-3 sequence that fails the gap rule', () => {
        const e1 = makeFailedDefend({ enemy: 2, region: 8 });
        // 2-hour gap (> 1-hour rule) → cascade breaks
        const e2 = {
            ...makeFailedDefend({ enemy: 2, region: 7 }),
            start_time: e1.end_time + 7200,
            end_time: e1.end_time + 7200 + 7200,
        };
        const e3 = {
            ...makeFailedDefend({ enemy: 2, region: 6 }),
            start_time: e2.end_time + 1800,
            end_time: e2.end_time + 1800 + 7200,
        };
        // Three events but only the last two are back-to-back → length 2 < 3
        expect(findAllCascades([e1, e2, e3])).toEqual([]);
    });

    it('detects a length-3 cascade for one faction', () => {
        const e1 = makeFailedDefend({ enemy: 2, region: 8 });
        const e2 = makeFailedDefend({ enemy: 2, region: 7, prevEndTime: e1.end_time });
        const e3 = makeFailedDefend({ enemy: 2, region: 6, prevEndTime: e2.end_time });
        const result = findAllCascades([e1, e2, e3]);
        expect(result).toHaveLength(1);
        expect(result[0].length).toBe(3);
        expect(result[0].faction).toBe('The Illuminate');
        expect(result[0].factionIndex).toBe(2);
        expect(result[0].regions).toEqual([8, 7, 6]);
        expect(result[0].startTime).toBe(e1.start_time);
        expect(result[0].endTime).toBe(e3.end_time);
        expect(result[0].durationSec).toBe(e3.end_time - e1.start_time);
        expect(result[0].firstEvent.event_id).toBe(e1.event_id);
        expect(result[0].lastEvent.event_id).toBe(e3.event_id);
        expect(result[0].events).toHaveLength(3);
    });

    it('ignores non-defend and non-fail events', () => {
        const events = [
            { type: 'attack', status: 'success', enemy: 0, region: 5, start_time: 0, end_time: 100 },
            { type: 'defend', status: 'success', enemy: 0, region: 4, start_time: 200, end_time: 300 },
            { type: 'defend', status: 'fail', enemy: 0, region: 3, start_time: 400, end_time: 500 },
        ];
        expect(findAllCascades(events)).toEqual([]);
    });

    it('breaks the cascade when region does not strictly decrease', () => {
        const e1 = makeFailedDefend({ enemy: 0, region: 5 });
        const e2 = makeFailedDefend({ enemy: 0, region: 5, prevEndTime: e1.end_time }); // plateau
        const e3 = makeFailedDefend({ enemy: 0, region: 4, prevEndTime: e2.end_time });
        // Plateau breaks the cascade; running length goes 1 → 1 → 2. None reaches 3.
        expect(findAllCascades([e1, e2, e3])).toEqual([]);
    });

    it('keeps cascades from separate factions independent', () => {
        // Bugs cascade of 3
        const b1 = makeFailedDefend({ enemy: 0, region: 4 });
        const b2 = makeFailedDefend({ enemy: 0, region: 3, prevEndTime: b1.end_time });
        const b3 = makeFailedDefend({ enemy: 0, region: 2, prevEndTime: b2.end_time });
        // Illuminate cascade of 4 (interleaved by end_time)
        const i1 = { ...makeFailedDefend({ enemy: 2, region: 8 }), end_time: b1.end_time + 60 };
        const i2 = { ...makeFailedDefend({ enemy: 2, region: 7 }), start_time: i1.end_time + 600, end_time: i1.end_time + 600 + 7200 };
        const i3 = { ...makeFailedDefend({ enemy: 2, region: 6 }), start_time: i2.end_time + 600, end_time: i2.end_time + 600 + 7200 };
        const i4 = { ...makeFailedDefend({ enemy: 2, region: 5 }), start_time: i3.end_time + 600, end_time: i3.end_time + 600 + 7200 };

        const result = findAllCascades([b1, i1, b2, i2, b3, i3, i4]);
        expect(result).toHaveLength(2);
        expect(result[0].length).toBe(4); // Illuminate first (longer)
        expect(result[0].factionIndex).toBe(2);
        expect(result[1].length).toBe(3);
        expect(result[1].factionIndex).toBe(0);
    });

    it('emits multiple cascades from the same faction when separated by a gap', () => {
        // Cascade A of length 3 (Bugs)
        const a1 = makeFailedDefend({ enemy: 0, region: 5 });
        const a2 = makeFailedDefend({ enemy: 0, region: 4, prevEndTime: a1.end_time });
        const a3 = makeFailedDefend({ enemy: 0, region: 3, prevEndTime: a2.end_time });
        // Big gap (1 day) — should break the chain
        const gapEnd = a3.end_time + 86400;
        // Cascade B of length 3 (Bugs)
        const b1 = { ...makeFailedDefend({ enemy: 0, region: 6 }), start_time: gapEnd, end_time: gapEnd + 7200 };
        const b2 = makeFailedDefend({ enemy: 0, region: 5, prevEndTime: b1.end_time });
        const b3 = makeFailedDefend({ enemy: 0, region: 4, prevEndTime: b2.end_time });

        const result = findAllCascades([a1, a2, a3, b1, b2, b3]);
        expect(result).toHaveLength(2);
        expect(result.every((c) => c.length === 3 && c.factionIndex === 0)).toBe(true);
    });

    it('respects custom minLength', () => {
        const e1 = makeFailedDefend({ enemy: 1, region: 4 });
        const e2 = makeFailedDefend({ enemy: 1, region: 3, prevEndTime: e1.end_time });
        const e3 = makeFailedDefend({ enemy: 1, region: 2, prevEndTime: e2.end_time });
        // Default min 3 → 1 result
        expect(findAllCascades([e1, e2, e3])).toHaveLength(1);
        // Min 4 → none
        expect(findAllCascades([e1, e2, e3], { minLength: 4 })).toHaveLength(0);
        // Min 2 → 1 result still (only one cascade in input)
        expect(findAllCascades([e1, e2, e3], { minLength: 2 })).toHaveLength(1);
    });

    it('sorts by length DESC, then speed DESC, then end_time DESC', () => {
        // Cascade A: length 3, slow (3h per event = 9h total)
        const a1 = { type: 'defend', status: 'fail', enemy: 0, region: 5, start_time: 0,     end_time: 10800, event_id: 1 };
        const a2 = { type: 'defend', status: 'fail', enemy: 0, region: 4, start_time: 12000, end_time: 22800, event_id: 2 };
        const a3 = { type: 'defend', status: 'fail', enemy: 0, region: 3, start_time: 24000, end_time: 34800, event_id: 3 };
        // Cascade B: length 3, fast (1h per event = 3h total) — faster, should rank first
        const b1 = { type: 'defend', status: 'fail', enemy: 2, region: 5, start_time: 100000, end_time: 103600, event_id: 4 };
        const b2 = { type: 'defend', status: 'fail', enemy: 2, region: 4, start_time: 104000, end_time: 107600, event_id: 5 };
        const b3 = { type: 'defend', status: 'fail', enemy: 2, region: 3, start_time: 108000, end_time: 111600, event_id: 6 };

        const result = findAllCascades([a1, a2, a3, b1, b2, b3]);
        expect(result).toHaveLength(2);
        expect(result[0].factionIndex).toBe(2); // faster cascade ranks first
        expect(result[1].factionIndex).toBe(0);
    });
});

describe('findWorstCascade (legacy — kept for one task)', () => {
    it('is still exported until Task 2', () => {
        expect(typeof findWorstCascade).toBe('function');
    });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run src/__tests__/unit/shared/utils/game/seasonAnalytics.test.mjs
```

Expected: ALL `findAllCascades` tests FAIL with `findAllCascades is not exported`. The `findWorstCascade` test passes.

- [ ] **Step 3: Implement `findAllCascades`**

Replace `src/shared/utils/game/seasonAnalytics.mjs` with:

```js
import { EVENT_TYPE, EVENT_STATUS } from '@/shared/enums/events.mjs';
import factions from '@/shared/enums/factions.mjs';

const MAX_GAP_SEC = 3600; // 1 hour

/**
 * Find the worst cascade failure in a season — the longest sequence of
 * consecutive failed defenses for a single faction with decreasing region
 * numbers. Legacy single-result helper, kept until Task 2 of the cascade
 * leaderboard implementation removes it.
 *
 * @deprecated Use {@link findAllCascades} instead.
 * @param {Array} events
 * @returns {{ length: number, faction: string, regions: number[], firstEvent: object }|null}
 */
export function findWorstCascade(events) {
    if (!events?.length) return null;
    const failedDefends = events
        .filter((e) => e.type === EVENT_TYPE.DEFEND && e.status === EVENT_STATUS.FAIL)
        .sort((a, b) => a.end_time - b.end_time);
    if (failedDefends.length < 2) return null;
    let bestCascade = null;
    const currentByFaction = {};
    for (const e of failedDefends) {
        const key = e.enemy;
        const current = currentByFaction[key];
        if (current && e.region < current.regions[current.regions.length - 1]) {
            current.regions.push(e.region);
        } else {
            currentByFaction[key] = { enemy: key, regions: [e.region], firstEvent: e };
        }
        const cascade = currentByFaction[key];
        if (cascade.regions.length >= 2) {
            if (!bestCascade || cascade.regions.length > bestCascade.regions.length) {
                bestCascade = { ...cascade };
            }
        }
    }
    if (!bestCascade) return null;
    return {
        length: bestCascade.regions.length,
        faction: factions[bestCascade.enemy]?.name ?? 'Unknown',
        regions: bestCascade.regions,
        firstEvent: bestCascade.firstEvent,
    };
}

/**
 * Return every cascade in `events`, sorted by length DESC, then by speed
 * (regions per hour) DESC, then by `end_time` DESC. A cascade is a sequence
 * of failed defenses for one faction with strictly decreasing region numbers
 * and consecutive events within `MAX_GAP_SEC` (1 hour).
 *
 * @param {Array} events - h1_event records (any type, any status)
 * @param {object} [opts]
 * @param {number} [opts.minLength=3] - Inclusive minimum cascade length
 * @returns {Array<{
 *   length: number,
 *   faction: string,
 *   factionIndex: number,
 *   regions: number[],
 *   startTime: number,
 *   endTime: number,
 *   durationSec: number,
 *   firstEvent: object,
 *   lastEvent: object,
 *   events: object[],
 * }>}
 */
export function findAllCascades(events, { minLength = 3 } = {}) {
    if (!events?.length) return [];

    const failedDefends = events
        .filter((e) => e.type === EVENT_TYPE.DEFEND && e.status === EVENT_STATUS.FAIL)
        .sort((a, b) => a.end_time - b.end_time);

    if (failedDefends.length < minLength) return [];

    const cascades = [];
    const open = new Map(); // factionIndex → { events: [] }

    for (const e of failedDefends) {
        const cur = open.get(e.enemy);
        if (cur) {
            const last = cur.events[cur.events.length - 1];
            const decreasing = e.region < last.region;
            const inWindow = e.start_time - last.end_time <= MAX_GAP_SEC;
            if (decreasing && inWindow) {
                cur.events.push(e);
                continue;
            }
            if (cur.events.length >= minLength) cascades.push(emit(cur));
        }
        open.set(e.enemy, { events: [e] });
    }
    for (const cur of open.values()) {
        if (cur.events.length >= minLength) cascades.push(emit(cur));
    }

    cascades.sort(compareCascades);
    return cascades;
}

function emit({ events }) {
    const first = events[0];
    const last = events[events.length - 1];
    return {
        length: events.length,
        factionIndex: first.enemy,
        faction: factions[first.enemy]?.name ?? 'Unknown',
        regions: events.map((e) => e.region),
        startTime: first.start_time,
        endTime: last.end_time,
        durationSec: last.end_time - first.start_time,
        firstEvent: first,
        lastEvent: last,
        events,
    };
}

function compareCascades(a, b) {
    if (b.length !== a.length) return b.length - a.length;
    const aSpeed = a.length / (a.durationSec / 3600);
    const bSpeed = b.length / (b.durationSec / 3600);
    if (bSpeed !== aSpeed) return bSpeed - aSpeed;
    return b.endTime - a.endTime;
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run src/__tests__/unit/shared/utils/game/seasonAnalytics.test.mjs
```

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/shared/utils/game/seasonAnalytics.mjs \
        src/__tests__/unit/shared/utils/game/seasonAnalytics.test.mjs
git commit -m "feat(analytics): add findAllCascades alongside findWorstCascade

Stricter cascade detection: 1-hour gap rule, min length 3, returns every
qualifying cascade sorted by length DESC then speed DESC then end_time DESC.

findWorstCascade kept temporarily to keep ArchiveStats building; removed
in the next commit.

Issue: #272

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Remove `findWorstCascade` and `WORST_CASCADE` stat card

**Files:**
- Modify: `src/features/archives/ArchiveStats.jsx`
- Modify: `src/__tests__/unit/features/archives/ArchiveStats.test.jsx`
- Modify: `src/shared/utils/game/seasonAnalytics.mjs`
- Modify: `src/__tests__/unit/shared/utils/game/seasonAnalytics.test.mjs`

- [ ] **Step 1: Remove the WORST_CASCADE card from `ArchiveStats.jsx`**

Open `src/features/archives/ArchiveStats.jsx`. Delete the `findWorstCascade` import line and the `worstCascade` derivation + JSX block. After the edit, the file's global branch should look like this (only the diff is shown):

```diff
-import GlitchText from '@/features/archives/GlitchText';
 import factions, { FACTION_INDEX } from '@/shared/enums/factions.mjs';
-import { findWorstCascade } from '@/shared/utils/game/seasonAnalytics.mjs';
 import { EVENT_TYPE, EVENT_STATUS } from '@/shared/enums/events.mjs';
```

```diff
         const outcomeFaction =
             result?.faction != null ? factions[result.faction]?.name : null;
-        const worstCascade = findWorstCascade(events);
         // Per-faction stats are disjoint, so summing the three rows gives the
```

```diff
                 {rateCards(events)}
                 {difficultyCard(diff.difficulty, diff.successful)}
-                {worstCascade && (
-                    <StatCard
-                        label="WORST_CASCADE"
-                        value={`${worstCascade.length} regions`}
-                        subtitle={worstCascade.faction}
-                    />
-                )}
             </div>
         );
```

- [ ] **Step 2: Remove `WORST_CASCADE` assertions from `ArchiveStats.test.jsx`**

Open `src/__tests__/unit/features/archives/ArchiveStats.test.jsx` and remove any `test(...)` block or `expect(...)` that references `WORST_CASCADE` or `worstCascade`. If a test file's purpose was only `WORST_CASCADE`, delete it; otherwise leave the rest intact.

Search command to find them:

```bash
grep -n "WORST_CASCADE\|worstCascade" src/__tests__/unit/features/archives/ArchiveStats.test.jsx
```

Delete each matching test block (the `test(...)` / `it(...)` call up to its closing `});`).

- [ ] **Step 3: Remove `findWorstCascade` from `seasonAnalytics.mjs`**

Open `src/shared/utils/game/seasonAnalytics.mjs`. Delete the `findWorstCascade` function and its JSDoc block (the entire `@deprecated`-marked function from Task 1). Keep `findAllCascades`, `emit`, `compareCascades`, and `MAX_GAP_SEC`. The file should now export only `findAllCascades`.

- [ ] **Step 4: Remove the `findWorstCascade` test references**

Open `src/__tests__/unit/shared/utils/game/seasonAnalytics.test.mjs`. Remove:
- `findWorstCascade` from the import statement (leave `findAllCascades`).
- The `describe('findWorstCascade (legacy — kept for one task)', ...)` block at the bottom.

- [ ] **Step 5: Run the affected tests to verify they pass**

```bash
npx vitest run \
  src/__tests__/unit/shared/utils/game/seasonAnalytics.test.mjs \
  src/__tests__/unit/features/archives/ArchiveStats.test.jsx
```

Expected: all tests PASS. No reference to `findWorstCascade` remains.

- [ ] **Step 6: Run lint + typecheck to catch stale references**

```bash
npm run lint && npm run typecheck
```

Expected: both pass with no errors.

- [ ] **Step 7: Commit**

```bash
git add src/shared/utils/game/seasonAnalytics.mjs \
        src/__tests__/unit/shared/utils/game/seasonAnalytics.test.mjs \
        src/features/archives/ArchiveStats.jsx \
        src/__tests__/unit/features/archives/ArchiveStats.test.jsx
git commit -m "refactor(archives): remove findWorstCascade and WORST_CASCADE stat card

The cascade story moves to a dedicated CascadeLog section (added in
later tasks). The summary card on /archives becomes redundant once the
log lives directly below the StatGrid.

Issue: #272

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: `getCascadeLeaderboard` server query

**Files:**
- Create: `src/db/queries/getCascadeLeaderboard.mjs`
- Create: `src/__tests__/unit/db/queries/getCascadeLeaderboard.test.mjs`

- [ ] **Step 1: Write the failing tests**

Create `src/__tests__/unit/db/queries/getCascadeLeaderboard.test.mjs`:

```js
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/db/prisma.mjs', () => ({
    default: { h1_event: { findMany: vi.fn() } },
}));

import prisma from '@/db/prisma.mjs';
import { getCascadeLeaderboard } from '@/db/queries/getCascadeLeaderboard.mjs';

function makeEvent(season, enemy, region, endOffset) {
    const base = season * 10_000_000;
    return {
        season,
        type: 'defend',
        status: 'fail',
        enemy,
        region,
        start_time: base + endOffset - 7200,
        end_time: base + endOffset,
        event_id: base + endOffset,
    };
}

describe('getCascadeLeaderboard', () => {
    beforeEach(() => {
        prisma.h1_event.findMany.mockReset();
    });

    it('returns [] for no events', async () => {
        prisma.h1_event.findMany.mockResolvedValue([]);
        const result = await getCascadeLeaderboard();
        expect(result).toEqual([]);
    });

    it('returns [] on Prisma error', async () => {
        prisma.h1_event.findMany.mockRejectedValue(new Error('db down'));
        const result = await getCascadeLeaderboard();
        expect(result).toEqual([]);
    });

    it('passes the expected filter to Prisma', async () => {
        prisma.h1_event.findMany.mockResolvedValue([]);
        await getCascadeLeaderboard();
        const call = prisma.h1_event.findMany.mock.calls[0][0];
        expect(call.where).toEqual({ type: 'defend', status: 'fail' });
    });

    it('attaches season to each cascade and sorts globally', async () => {
        const s155 = [
            makeEvent(155, 2, 8, 100_000),
            makeEvent(155, 2, 7, 110_000),
            makeEvent(155, 2, 6, 120_000),
        ];
        const s142 = [
            makeEvent(142, 0, 6, 100_000),
            makeEvent(142, 0, 5, 110_000),
            makeEvent(142, 0, 4, 120_000),
            makeEvent(142, 0, 3, 130_000),
        ];
        prisma.h1_event.findMany.mockResolvedValue([...s155, ...s142]);

        const result = await getCascadeLeaderboard();
        expect(result).toHaveLength(2);
        // Longer cascade (s142, length 4) ranks first
        expect(result[0].season).toBe(142);
        expect(result[0].length).toBe(4);
        expect(result[1].season).toBe(155);
        expect(result[1].length).toBe(3);
    });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run src/__tests__/unit/db/queries/getCascadeLeaderboard.test.mjs
```

Expected: all tests FAIL — module not found.

- [ ] **Step 3: Implement the query**

Create `src/db/queries/getCascadeLeaderboard.mjs`:

```js
import { cache } from 'react';
import prisma from '@/db/prisma.mjs';
import { tryCatch } from '@/shared/utils/tryCatch.mjs';
import { findAllCascades } from '@/shared/utils/game/seasonAnalytics.mjs';

/**
 * Cross-season cascade leaderboard. One DB read, then per-season cascade
 * detection. Sorted globally by length DESC, then speed (regions per hour)
 * DESC, then endTime DESC.
 *
 * Returns `[]` on any DB error so the page can still render without the
 * cascade section.
 *
 * @returns {Promise<Array<{
 *   season: number,
 *   length: number,
 *   faction: string,
 *   factionIndex: number,
 *   regions: number[],
 *   startTime: number,
 *   endTime: number,
 *   durationSec: number,
 *   firstEvent: object,
 *   lastEvent: object,
 *   events: object[],
 * }>>}
 */
export const getCascadeLeaderboard = cache(async () => {
    const { data: events, error } = await tryCatch(
        prisma.h1_event.findMany({
            where: { type: 'defend', status: 'fail' },
            select: {
                season: true,
                type: true,
                status: true,
                enemy: true,
                region: true,
                start_time: true,
                end_time: true,
                event_id: true,
            },
            orderBy: [{ season: 'asc' }, { end_time: 'asc' }],
        }),
    );
    if (error || !events) return [];

    const bySeason = Map.groupBy(events, (e) => e.season);
    const all = [];
    for (const [season, seasonEvents] of bySeason) {
        for (const cascade of findAllCascades(seasonEvents, { minLength: 3 })) {
            all.push({ season, ...cascade });
        }
    }
    all.sort(compareCascadesForLeaderboard);
    return all;
});

function compareCascadesForLeaderboard(a, b) {
    if (b.length !== a.length) return b.length - a.length;
    const aSpeed = a.length / (a.durationSec / 3600);
    const bSpeed = b.length / (b.durationSec / 3600);
    if (bSpeed !== aSpeed) return bSpeed - aSpeed;
    return b.endTime - a.endTime;
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run src/__tests__/unit/db/queries/getCascadeLeaderboard.test.mjs
```

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/db/queries/getCascadeLeaderboard.mjs \
        src/__tests__/unit/db/queries/getCascadeLeaderboard.test.mjs
git commit -m "feat(db): add getCascadeLeaderboard cross-season query

One Prisma query for all failed defends, grouped by season, then
findAllCascades per season, globally sorted by length+speed+endTime.

Issue: #272

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: `groupCascadesBySeason` helper

**Files:**
- Create: `src/features/timeline/groupCascadesBySeason.mjs`
- Create: `src/__tests__/unit/features/timeline/groupCascadesBySeason.test.mjs`

- [ ] **Step 1: Write the failing tests**

Create `src/__tests__/unit/features/timeline/groupCascadesBySeason.test.mjs`:

```js
import { describe, it, expect } from 'vitest';
import { groupCascadesBySeason } from '@/features/timeline/groupCascadesBySeason.mjs';

const c = (overrides) => ({
    season: 0,
    length: 3,
    factionIndex: 0,
    faction: 'Bugs',
    regions: [3, 2, 1],
    startTime: 0,
    endTime: 1000,
    durationSec: 1000,
    events: [],
    firstEvent: {},
    lastEvent: {},
    ...overrides,
});

describe('groupCascadesBySeason', () => {
    it('returns [] for empty input', () => {
        expect(groupCascadesBySeason([])).toEqual([]);
        expect(groupCascadesBySeason(null)).toEqual([]);
    });

    it('worst-first: orders groups by their worst cascade rank', () => {
        const input = [
            c({ season: 142, length: 4, endTime: 100 }),
            c({ season: 155, length: 9, endTime: 200 }),
            c({ season: 198, length: 6, endTime: 300 }),
        ];
        const groups = groupCascadesBySeason(input, { sortOrder: 'worst' });
        expect(groups.map((g) => g.season)).toEqual([155, 198, 142]);
    });

    it('recent-first: orders groups by season DESC', () => {
        const input = [
            c({ season: 142, length: 4 }),
            c({ season: 155, length: 9 }),
            c({ season: 198, length: 6 }),
        ];
        const groups = groupCascadesBySeason(input, { sortOrder: 'recent' });
        expect(groups.map((g) => g.season)).toEqual([198, 155, 142]);
    });

    it('keeps multi-cascade seasons grouped together', () => {
        const input = [
            c({ season: 198, length: 6, endTime: 100 }),
            c({ season: 155, length: 9, endTime: 200 }),
            c({ season: 198, length: 3, endTime: 300 }),
        ];
        const groups = groupCascadesBySeason(input, { sortOrder: 'worst' });
        const s198 = groups.find((g) => g.season === 198);
        expect(s198.cascades).toHaveLength(2);
        // Within group, longer first
        expect(s198.cascades[0].length).toBe(6);
        expect(s198.cascades[1].length).toBe(3);
    });

    it('within-group recent ordering uses endTime DESC', () => {
        const input = [
            c({ season: 198, length: 3, endTime: 100 }),
            c({ season: 198, length: 3, endTime: 300 }),
            c({ season: 198, length: 3, endTime: 200 }),
        ];
        const groups = groupCascadesBySeason(input, { sortOrder: 'recent' });
        expect(groups[0].cascades.map((c) => c.endTime)).toEqual([300, 200, 100]);
    });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run src/__tests__/unit/features/timeline/groupCascadesBySeason.test.mjs
```

Expected: all tests FAIL — module not found.

- [ ] **Step 3: Implement the helper**

Create `src/features/timeline/groupCascadesBySeason.mjs`:

```js
/**
 * Group cascades by season, then sort groups + within-group cascades.
 *
 * - `sortOrder='worst'` (default) — groups ordered by each group's worst
 *   cascade (length DESC, then speed DESC). Cascades within a group are
 *   sorted length DESC, then speed DESC, then endTime DESC.
 * - `sortOrder='recent'` — groups ordered by season DESC. Cascades within
 *   a group are sorted by endTime DESC.
 *
 * @param {Array<object>} cascades - Each cascade includes `season`.
 * @param {object} [opts]
 * @param {'worst'|'recent'} [opts.sortOrder='worst']
 * @returns {Array<{ season: number, cascades: Array<object> }>}
 */
export function groupCascadesBySeason(cascades, { sortOrder = 'worst' } = {}) {
    if (!cascades?.length) return [];

    const groups = new Map();
    for (const c of cascades) {
        if (!groups.has(c.season)) groups.set(c.season, []);
        groups.get(c.season).push(c);
    }

    const within =
        sortOrder === 'recent' ?
            (a, b) => b.endTime - a.endTime
        :   compareByWorst;
    for (const arr of groups.values()) arr.sort(within);

    const list = Array.from(groups, ([season, cs]) => ({ season, cascades: cs }));
    if (sortOrder === 'recent') {
        list.sort((a, b) => b.season - a.season);
    } else {
        list.sort((a, b) => compareByWorst(a.cascades[0], b.cascades[0]));
    }
    return list;
}

function compareByWorst(a, b) {
    if (b.length !== a.length) return b.length - a.length;
    const aSpeed = a.length / (a.durationSec / 3600);
    const bSpeed = b.length / (b.durationSec / 3600);
    if (bSpeed !== aSpeed) return bSpeed - aSpeed;
    return b.endTime - a.endTime;
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run src/__tests__/unit/features/timeline/groupCascadesBySeason.test.mjs
```

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/timeline/groupCascadesBySeason.mjs \
        src/__tests__/unit/features/timeline/groupCascadesBySeason.test.mjs
git commit -m "feat(timeline): add groupCascadesBySeason helper

Mirror of groupEventsByDay. Groups cascades by season with two sort
orders: worst-first (default) and recent-first.

Issue: #272

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: `generateCascadeLede` helper

**Files:**
- Create: `src/features/stats/generateCascadeLede.mjs`
- Create: `src/__tests__/unit/features/stats/generateCascadeLede.test.mjs`

- [ ] **Step 1: Write the failing tests**

Create `src/__tests__/unit/features/stats/generateCascadeLede.test.mjs`:

```js
import { describe, it, expect } from 'vitest';
import { generateCascadeLede } from '@/features/stats/generateCascadeLede.mjs';

const cascade = (overrides) => ({
    season: 155,
    length: 9,
    faction: 'The Illuminate',
    regions: [8, 7, 6, 5, 4, 3, 2, 1, 0],
    durationSec: 14 * 3600 + 32 * 60,
    ...overrides,
});

describe('generateCascadeLede', () => {
    it('returns null for no cascades', () => {
        expect(generateCascadeLede([], 200)).toBeNull();
        expect(generateCascadeLede(null, 200)).toBeNull();
    });

    it('uses "pushed all the way home" when the last region is 0', () => {
        const lede = generateCascadeLede([cascade()], 200);
        expect(lede).toContain('pushed all the way home');
        expect(lede).toContain('1 cascade');
        expect(lede).toContain('200 wars');
        expect(lede).toContain('season 155');
        expect(lede).toContain('The Illuminate');
    });

    it('uses "pushed all the way home" when the last region is 11', () => {
        const lede = generateCascadeLede(
            [cascade({ regions: [13, 12, 11] })],
            10,
        );
        expect(lede).toContain('pushed all the way home');
    });

    it('falls back to "swept N regions in DURATION" otherwise', () => {
        const lede = generateCascadeLede(
            [cascade({ length: 5, regions: [6, 5, 4, 3, 2], durationSec: 9 * 3600 })],
            50,
        );
        expect(lede).toContain('swept 5 regions in 9h');
    });

    it('pluralizes "cascades" and "wars" correctly', () => {
        const ledeMany = generateCascadeLede(
            [cascade(), cascade({ season: 142 })],
            2,
        );
        expect(ledeMany).toContain('2 cascades');
        expect(ledeMany).toContain('2 wars');

        const ledeOne = generateCascadeLede([cascade()], 1);
        expect(ledeOne).toContain('1 cascade ');
        expect(ledeOne).toContain('1 war.');
    });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run src/__tests__/unit/features/stats/generateCascadeLede.test.mjs
```

Expected: all tests FAIL — module not found.

- [ ] **Step 3: Implement**

Create `src/features/stats/generateCascadeLede.mjs`:

```js
import { formatCompactDuration } from '@/shared/utils/format/formatCompactDuration.mjs';

/**
 * Build the lede sentence shown above the cascade log on /stats.
 *
 * @param {Array<object>} cascades - Sorted leaderboard (worst-first).
 * @param {number} seasonsCount - Total seasons in the dataset.
 * @returns {string | null}
 */
export function generateCascadeLede(cascades, seasonsCount) {
    if (!cascades?.length) return null;
    const worst = cascades[0];
    const last = worst.regions[worst.regions.length - 1];
    const reachedHome = last === 0 || last === 11;
    const verb =
        reachedHome ?
            'pushed all the way home'
        :   `swept ${worst.length} regions in ${formatCompactDuration(worst.durationSec)}`;
    return (
        `${cascades.length} cascade${cascades.length === 1 ? '' : 's'} ` +
        `across ${seasonsCount} war${seasonsCount === 1 ? '' : 's'}. ` +
        `Worst: season ${worst.season}, where the ${worst.faction} ${verb}.`
    );
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run src/__tests__/unit/features/stats/generateCascadeLede.test.mjs
```

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/stats/generateCascadeLede.mjs \
        src/__tests__/unit/features/stats/generateCascadeLede.test.mjs
git commit -m "feat(stats): add generateCascadeLede

Deterministic lede sentence: \"N cascades across M wars. Worst: season X,
where the FACTION pushed all the way home / swept N regions in DURATION.\"

Issue: #272

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: `CASCADE_SORT_ORDER_KEY` + `useCascadeLogSort` hook

**Files:**
- Modify: `src/shared/preferences/sortOrder.mjs`
- Create: `src/features/timeline/useCascadeLogSort.mjs`
- Create: `src/__tests__/unit/features/timeline/useCascadeLogSort.test.mjs`

- [ ] **Step 1: Add the new key and validator**

Open `src/shared/preferences/sortOrder.mjs` and append:

```js
export const CASCADE_SORT_ORDER_KEY = 'cascade-log-sort';
export const CASCADE_SORT_ORDER_DEFAULT = 'worst';

export function validateCascadeSortOrder(value) {
    return value === 'worst' || value === 'recent'
        ? value
        : CASCADE_SORT_ORDER_DEFAULT;
}
```

Final file contents should be:

```js
export const SORT_ORDER_KEY = 'event-log-sort';
export const SORT_ORDER_DEFAULT = 'desc';

export function validateSortOrder(value) {
    return value === 'asc' || value === 'desc' ? value : SORT_ORDER_DEFAULT;
}

export const CASCADE_SORT_ORDER_KEY = 'cascade-log-sort';
export const CASCADE_SORT_ORDER_DEFAULT = 'worst';

export function validateCascadeSortOrder(value) {
    return value === 'worst' || value === 'recent'
        ? value
        : CASCADE_SORT_ORDER_DEFAULT;
}
```

- [ ] **Step 2: Write the failing hook test**

Create `src/__tests__/unit/features/timeline/useCascadeLogSort.test.mjs`:

```js
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

vi.mock('@/shared/utils/cookies.mjs', () => ({
    setPreferenceCookie: vi.fn(),
}));

import { useCascadeLogSort } from '@/features/timeline/useCascadeLogSort.mjs';
import { setPreferenceCookie } from '@/shared/utils/cookies.mjs';

describe('useCascadeLogSort', () => {
    beforeEach(() => {
        setPreferenceCookie.mockReset();
    });

    it('uses the initial value', () => {
        const { result } = renderHook(() => useCascadeLogSort('recent'));
        expect(result.current[0]).toBe('recent');
    });

    it('defaults to "worst" when initial is undefined', () => {
        const { result } = renderHook(() => useCascadeLogSort());
        expect(result.current[0]).toBe('worst');
    });

    it('toggles worst → recent → worst', () => {
        const { result } = renderHook(() => useCascadeLogSort('worst'));
        act(() => result.current[1]());
        expect(result.current[0]).toBe('recent');
        act(() => result.current[1]());
        expect(result.current[0]).toBe('worst');
    });

    it('writes the new value to the preference cookie on toggle', () => {
        const { result } = renderHook(() => useCascadeLogSort('worst'));
        act(() => result.current[1]());
        expect(setPreferenceCookie).toHaveBeenCalledWith('cascade-log-sort', 'recent');
    });
});
```

- [ ] **Step 3: Run test to verify it fails**

```bash
npx vitest run src/__tests__/unit/features/timeline/useCascadeLogSort.test.mjs
```

Expected: FAIL — module not found.

- [ ] **Step 4: Implement the hook**

Create `src/features/timeline/useCascadeLogSort.mjs`:

```js
'use client';
import { useCallback } from 'react';
import { usePersistedState } from '@/shared/hooks/usePersistedState.mjs';
import {
    CASCADE_SORT_ORDER_KEY,
    CASCADE_SORT_ORDER_DEFAULT,
} from '@/shared/preferences/sortOrder.mjs';

/**
 * Cookie-backed sort preference for the cascade log. Independent of the
 * dashboard event log's sort. Returns `[sortOrder, toggleSortOrder]`.
 *
 * @param {'worst'|'recent'} [initial='worst']
 */
export function useCascadeLogSort(initial = CASCADE_SORT_ORDER_DEFAULT) {
    const [sortOrder, setSortOrder] = usePersistedState(CASCADE_SORT_ORDER_KEY, initial);
    const toggleSortOrder = useCallback(() => {
        setSortOrder(sortOrder === 'worst' ? 'recent' : 'worst');
    }, [sortOrder, setSortOrder]);
    return [sortOrder, toggleSortOrder];
}
```

- [ ] **Step 5: Run test to verify it passes**

```bash
npx vitest run src/__tests__/unit/features/timeline/useCascadeLogSort.test.mjs
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/shared/preferences/sortOrder.mjs \
        src/features/timeline/useCascadeLogSort.mjs \
        src/__tests__/unit/features/timeline/useCascadeLogSort.test.mjs
git commit -m "feat(timeline): add useCascadeLogSort hook

New cookie-backed preference (worst | recent) for the cascade log,
independent of the event log's sort.

Issue: #272

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: `CascadeLogSortToggle` component

**Files:**
- Create: `src/features/timeline/CascadeLogSortToggle.jsx`

This component is a thin presentational button — no business logic to test. Skip RTL and verify via the `CascadeLog` integration test instead.

- [ ] **Step 1: Implement the component**

Create `src/features/timeline/CascadeLogSortToggle.jsx`:

```jsx
'use client';

import Button from '@/shared/components/Button/Button';

/**
 * Square toggle button that flips the cascade log sort order.
 * Mirror of EventLogSortToggle, with 'worst' | 'recent' semantics.
 */
export default function CascadeLogSortToggle({ sortOrder, onToggle }) {
    const isWorst = sortOrder === 'worst';
    const label = isWorst ? 'Sort recent first' : 'Sort worst first';
    return (
        <Button
            size="icon"
            variant="primary"
            onClick={onToggle}
            title={label}
            aria-label={label}
            data-umami-event="cascade-log-sort-toggle"
        >
            {isWorst ? '↓' : '↑'}
        </Button>
    );
}
```

- [ ] **Step 2: Run lint to verify no errors**

```bash
npm run lint -- src/features/timeline/CascadeLogSortToggle.jsx
```

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/features/timeline/CascadeLogSortToggle.jsx
git commit -m "feat(timeline): add CascadeLogSortToggle button

Mirror of EventLogSortToggle. Same Button primitive. 'worst' | 'recent'
state. Tracks 'cascade-log-sort-toggle' for analytics.

Issue: #272

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 8: `CascadeLogCard` component + chain CSS

**Files:**
- Create: `src/features/timeline/CascadeLogCard.jsx`
- Modify: `src/features/timeline/EventLog.css`
- Create: `src/__tests__/unit/features/timeline/CascadeLogCard.test.jsx`

- [ ] **Step 1: Add the chain CSS class**

Open `src/features/timeline/EventLog.css` and append:

```css
.event-log-card-chain {
    font-family: var(--font-mono, monospace);
    font-size: var(--text-small);
    color: var(--color-text-muted);
    letter-spacing: 0.05em;
    margin-top: 0.25rem;
    overflow-x: auto;
    white-space: nowrap;
}

.event-log-card-chain[data-faction="0"] { color: var(--color-faction-bugs); }
.event-log-card-chain[data-faction="1"] { color: var(--color-faction-cyborgs); }
.event-log-card-chain[data-faction="2"] { color: var(--color-faction-illuminate); }
```

- [ ] **Step 2: Write the failing card test**

Create `src/__tests__/unit/features/timeline/CascadeLogCard.test.jsx`:

```jsx
// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import CascadeLogCard from '@/features/timeline/CascadeLogCard';

const cascade = (overrides) => ({
    season: 155,
    length: 9,
    factionIndex: 2,
    faction: 'The Illuminate',
    regions: [8, 7, 6, 5, 4, 3, 2, 1, 0],
    startTime: 1709555520, // Mar 4, 2024 (UTC)
    endTime: 1709555520 + 14 * 3600 + 32 * 60,
    durationSec: 14 * 3600 + 32 * 60,
    firstEvent: {},
    lastEvent: {},
    events: [],
    ...overrides,
});

describe('CascadeLogCard', () => {
    it('renders the title with length', () => {
        render(<CascadeLogCard cascade={cascade()} />);
        expect(screen.getByText(/9 regions/i)).toBeInTheDocument();
    });

    it('renders the chain joined by arrows', () => {
        const { container } = render(<CascadeLogCard cascade={cascade()} />);
        const chain = container.querySelector('.event-log-card-chain');
        expect(chain).toBeInTheDocument();
        expect(chain.textContent).toContain('8 → 7 → 6');
    });

    it('tags the chain with the faction index', () => {
        const { container } = render(<CascadeLogCard cascade={cascade()} />);
        const chain = container.querySelector('.event-log-card-chain');
        expect(chain.getAttribute('data-faction')).toBe('2');
    });

    it('wraps the card in an anchor linking to /archives?season=N#cascade', () => {
        render(<CascadeLogCard cascade={cascade()} />);
        const link = screen.getByRole('link');
        expect(link.getAttribute('href')).toBe('/archives?season=155#cascade');
        expect(link.getAttribute('data-umami-event')).toBe('cascade-card-click');
    });

    it('renders a duration pill with formatted duration', () => {
        render(<CascadeLogCard cascade={cascade()} />);
        // 14h 32m → '14h32m' per formatCompactDuration (largest:2, no spacer)
        expect(screen.getByText(/14h32m/)).toBeInTheDocument();
    });
});
```

- [ ] **Step 3: Run test to verify it fails**

```bash
npx vitest run src/__tests__/unit/features/timeline/CascadeLogCard.test.jsx
```

Expected: FAIL — module not found.

- [ ] **Step 4: Implement the card**

Create `src/features/timeline/CascadeLogCard.jsx`:

```jsx
import Link from 'next/link';
import Image from 'next/image';
import factions from '@/shared/enums/factions.mjs';
import { formatCompactDuration } from '@/shared/utils/format/formatCompactDuration.mjs';

/**
 * One cascade rendered as a card inside a CascadeLog season group.
 * Wraps the whole card in a Link to /archives?season=N#cascade.
 */
export default function CascadeLogCard({ cascade }) {
    const faction = factions[cascade.factionIndex];
    const start = formatAbsolute(cascade.startTime);
    const end = formatAbsolute(cascade.endTime);
    const duration = formatCompactDuration(cascade.durationSec);

    return (
        <Link
            href={`/archives?season=${cascade.season}#cascade`}
            data-umami-event="cascade-card-click"
            className="event-log-card-link"
        >
            <div className="event-log-card event-log-card--cascade">
                <div className="event-log-card-row">
                    <span className="event-log-card-title">
                        {faction && (
                            <Image
                                src={faction.icon}
                                alt=""
                                width={16}
                                height={16}
                                className="event-log-card-icon"
                            />
                        )}
                        Defend cascade · {cascade.length} regions
                    </span>
                    <span className="event-log-card-pill">{duration}</span>
                </div>
                <span className="event-log-card-time">
                    Started {start} — Ended {end}
                </span>
                <span
                    className="event-log-card-chain"
                    data-faction={String(cascade.factionIndex)}
                >
                    {cascade.regions.join(' → ')}
                </span>
            </div>
        </Link>
    );
}

function formatAbsolute(unixSeconds) {
    return new Date(unixSeconds * 1000).toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
        timeZone: 'UTC',
    });
}
```

- [ ] **Step 5: Add the supporting CSS classes**

Open `src/features/timeline/EventLog.css` again and append (after the chain class added in Step 1):

```css
.event-log-card-link {
    display: block;
    text-decoration: none;
    color: inherit;
}

.event-log-card-link:hover .event-log-card {
    border-color: var(--color-primary);
}

.event-log-card--cascade {
    background: var(--color-surface-1);
    border: 1px solid var(--color-ghost);
    border-left: 4px solid var(--color-danger);
    padding: 0.5rem 0.75rem;
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
    font-family: var(--font-mono, monospace);
}

.event-log-card-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 0.5rem;
}

.event-log-card-title {
    font-family: var(--font-body);
    font-size: var(--text-small);
    font-weight: 700;
    color: var(--color-text);
    text-transform: uppercase;
    letter-spacing: 0.02em;
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.event-log-card-icon {
    width: 1rem;
    height: 1rem;
    flex-shrink: 0;
}

.event-log-card-pill {
    padding: 0.1rem 0.4rem;
    font-size: 0.7rem;
    border: 1px solid var(--color-danger);
    color: var(--color-danger);
    white-space: nowrap;
    flex-shrink: 0;
}

.event-log-card-time {
    font-size: var(--text-small);
    color: var(--color-text-muted);
}
```

- [ ] **Step 6: Run tests to verify they pass**

```bash
npx vitest run src/__tests__/unit/features/timeline/CascadeLogCard.test.jsx
```

Expected: all tests PASS.

- [ ] **Step 7: Commit**

```bash
git add src/features/timeline/CascadeLogCard.jsx \
        src/features/timeline/EventLog.css \
        src/__tests__/unit/features/timeline/CascadeLogCard.test.jsx
git commit -m "feat(timeline): add CascadeLogCard

Single-cascade card with title, duration pill, start/end time line, and
faction-colored chain. Wrapped in <Link> to /archives?season=N#cascade
with Umami tracking.

Issue: #272

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 9: `CascadeLog` component + lede CSS

**Files:**
- Create: `src/features/timeline/CascadeLog.jsx`
- Modify: `src/features/timeline/EventLog.css`
- Create: `src/__tests__/unit/features/timeline/CascadeLog.test.jsx`

- [ ] **Step 1: Add the lede CSS class**

Open `src/features/timeline/EventLog.css` and append:

```css
.event-log-lede {
    font-size: var(--text-small);
    color: var(--color-text-muted);
    margin: 0.25rem 0 0.75rem 0;
}
```

- [ ] **Step 2: Write the failing component test**

Create `src/__tests__/unit/features/timeline/CascadeLog.test.jsx`:

```jsx
// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('@/shared/utils/cookies.mjs', () => ({
    setPreferenceCookie: vi.fn(),
}));

import CascadeLog from '@/features/timeline/CascadeLog';

const c = (overrides) => ({
    season: 155,
    length: 9,
    factionIndex: 2,
    faction: 'The Illuminate',
    regions: [8, 7, 6, 5, 4, 3, 2, 1, 0],
    startTime: 0,
    endTime: 1000,
    durationSec: 1000,
    firstEvent: {},
    lastEvent: {},
    events: [],
    ...overrides,
});

describe('CascadeLog', () => {
    it('renders nothing for empty cascades', () => {
        const { container } = render(<CascadeLog cascades={[]} />);
        expect(container.firstChild).toBeNull();
    });

    it('renders the heading', () => {
        render(<CascadeLog cascades={[c()]} />);
        expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent(
            /Cascade Failures/i,
        );
    });

    it('renders the optional lede when provided', () => {
        render(<CascadeLog cascades={[c()]} lede="Test lede sentence." />);
        expect(screen.getByText('Test lede sentence.')).toBeInTheDocument();
    });

    it('omits the lede paragraph when not provided', () => {
        const { container } = render(<CascadeLog cascades={[c()]} />);
        expect(container.querySelector('.event-log-lede')).toBeNull();
    });

    it('renders one group header per distinct season', () => {
        render(
            <CascadeLog
                cascades={[c({ season: 155 }), c({ season: 142, length: 4 })]}
            />,
        );
        expect(screen.getByText(/Season 155/)).toBeInTheDocument();
        expect(screen.getByText(/Season 142/)).toBeInTheDocument();
    });

    it('toggles sort order when the toggle is clicked', () => {
        render(
            <CascadeLog
                initialSortOrder="worst"
                cascades={[c({ season: 100, length: 9 }), c({ season: 200, length: 4 })]}
            />,
        );
        // worst-first: 100 (length 9) first, then 200 (length 4)
        let headers = screen.getAllByRole('heading', { level: 2 })[0].parentElement
            .parentElement.parentElement.querySelectorAll('.event-log-day-label');
        expect(headers[0].textContent).toContain('100');
        // Toggle
        fireEvent.click(screen.getByRole('button', { name: /sort/i }));
        headers = screen.getAllByRole('heading', { level: 2 })[0].parentElement
            .parentElement.parentElement.querySelectorAll('.event-log-day-label');
        // recent-first: 200 first, then 100
        expect(headers[0].textContent).toContain('200');
    });
});
```

- [ ] **Step 3: Run test to verify it fails**

```bash
npx vitest run src/__tests__/unit/features/timeline/CascadeLog.test.jsx
```

Expected: FAIL — module not found.

- [ ] **Step 4: Implement the component**

Create `src/features/timeline/CascadeLog.jsx`:

```jsx
'use client';

import { Fragment } from 'react';
import './EventLog.css';
import CascadeLogCard from '@/features/timeline/CascadeLogCard';
import CascadeLogSortToggle from '@/features/timeline/CascadeLogSortToggle';
import { useCascadeLogSort } from '@/features/timeline/useCascadeLogSort.mjs';
import { groupCascadesBySeason } from '@/features/timeline/groupCascadesBySeason.mjs';

/**
 * Cross-season cascade log. Same section layout as EventLog, grouped by
 * season instead of by day. Renders nothing when `cascades` is empty.
 *
 * @param {object} props
 * @param {Array<object>} props.cascades - Each cascade includes a `season` field.
 * @param {string} [props.lede] - Optional one-line summary above the groups.
 * @param {string} [props.title='Cascade Failures']
 * @param {string} [props.id='cascade']
 * @param {'worst'|'recent'} [props.initialSortOrder]
 */
export default function CascadeLog({
    cascades,
    lede,
    title = 'Cascade Failures',
    id = 'cascade',
    initialSortOrder,
}) {
    const [sortOrder, toggleSortOrder] = useCascadeLogSort(initialSortOrder);
    if (!cascades?.length) return null;
    const groups = groupCascadesBySeason(cascades, { sortOrder });

    return (
        <section id={id} className="event-log-section">
            <div className="event-log-content">
                <div className="event-log-header">
                    <h2 className="event-log-heading">{title}</h2>
                    <CascadeLogSortToggle
                        sortOrder={sortOrder}
                        onToggle={toggleSortOrder}
                    />
                </div>
                {lede && <p className="event-log-lede">{lede}</p>}
                <div className="event-log-days">
                    {groups.map((group) => (
                        <Fragment key={group.season}>
                            <div className="event-log-day">
                                <div className="event-log-day-header">
                                    <span className="event-log-day-label">
                                        Season {group.season}
                                    </span>
                                    <span className="event-log-day-summary">
                                        {group.cascades.length} cascade
                                        {group.cascades.length === 1 ? '' : 's'}
                                    </span>
                                </div>
                                <div className="event-log-day-grid">
                                    {group.cascades.map((c, i) => (
                                        <CascadeLogCard
                                            key={`${group.season}-${c.startTime}-${i}`}
                                            cascade={c}
                                        />
                                    ))}
                                </div>
                            </div>
                        </Fragment>
                    ))}
                </div>
            </div>
        </section>
    );
}
```

- [ ] **Step 5: Run test to verify it passes**

```bash
npx vitest run src/__tests__/unit/features/timeline/CascadeLog.test.jsx
```

Expected: all tests PASS.

- [ ] **Step 6: Commit**

```bash
git add src/features/timeline/CascadeLog.jsx \
        src/features/timeline/EventLog.css \
        src/__tests__/unit/features/timeline/CascadeLog.test.jsx
git commit -m "feat(timeline): add CascadeLog component

Cross-season cascade log, mirror of EventLog. Groups by season,
optional lede prop, persisted sort toggle.

Issue: #272

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 10: Wire `CascadeLog` into `/stats` page

**Files:**
- Modify: `src/app/stats/page.jsx`

- [ ] **Step 1: Add imports + section**

Open `src/app/stats/page.jsx` and modify as follows:

```diff
 import { getCrossSeasonStats } from '@/db/queries/getCrossSeasonStats.mjs';
 import FactionThreatRanking from '@/features/stats/FactionThreatRanking';
 import WarOutcomes from '@/features/stats/WarOutcomes';
 import SeasonRecords from '@/features/stats/SeasonRecords';
+import CascadeLog from '@/features/timeline/CascadeLog';
+import { getCascadeLeaderboard } from '@/db/queries/getCascadeLeaderboard.mjs';
+import { generateCascadeLede } from '@/features/stats/generateCascadeLede.mjs';
+import { cookies } from 'next/headers';
+import {
+    CASCADE_SORT_ORDER_KEY,
+    validateCascadeSortOrder,
+} from '@/shared/preferences/sortOrder.mjs';
```

Inside `StatsPage`, after `const data = await getCrossSeasonStats();`, add:

```js
const cascades = await getCascadeLeaderboard();
const lede = generateCascadeLede(cascades, data.perSeason.length);
const c = await cookies();
const initialCascadeSort = validateCascadeSortOrder(
    c.get(CASCADE_SORT_ORDER_KEY)?.value,
);
```

Insert the `CascadeLog` section between **War Outcomes & Streaks** and **All-Time Records** — the new section sits between those two existing sections. The page already wraps each section in `<section className="flex flex-col gap-2">`; the cascade log renders its own `<section>` so it should NOT be wrapped in another:

```diff
             <section className="flex flex-col gap-2">
                 <h2>War Outcomes &amp; Streaks</h2>
                 <WarOutcomes perSeason={data.perSeason} />
             </section>

+            <CascadeLog
+                cascades={cascades}
+                lede={lede}
+                initialSortOrder={initialCascadeSort}
+            />
+
             <section className="flex flex-col gap-2">
                 <h2>All-Time Records</h2>
                 <SeasonRecords perSeason={data.perSeason} />
             </section>
```

- [ ] **Step 2: Run lint + typecheck**

```bash
npm run lint && npm run typecheck
```

Expected: both pass.

- [ ] **Step 3: Verify Playwright smoke test still passes**

```bash
npm run test:e2e
```

Expected: smoke tests pass (the stats page loads without runtime errors).

> If `test:e2e` is slow or skipped during plan execution, at minimum run the dev server and curl `http://localhost:3000/stats` — verify a 200 response and grep for `Cascade Failures` in the HTML.

- [ ] **Step 4: Commit**

```bash
git add src/app/stats/page.jsx
git commit -m "feat(stats): wire CascadeLog into /stats page

New section between War Outcomes and All-Time Records. Reads the
persisted sort preference from the cookie and passes it as
initialSortOrder.

Issue: #272

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 11: Wire `CascadeLog` into `/archives` (via `ArchivesClient`)

**Files:**
- Modify: `src/features/archives/ArchivesClient.jsx`
- Modify: `src/app/archives/page.jsx`

The `/archives` page renders a client component (`ArchivesClient`). The cascade list is per-season — derived from the events already loaded by the page. We add a new prop `initialCascadeSort` to the page → ArchivesClient handoff, and render `<CascadeLog>` below the StatGrid section.

- [ ] **Step 1: Pass the cookie value into `ArchivesClient`**

Open `src/app/archives/page.jsx`. Add the import + read the cookie alongside the existing sort order:

```diff
 import { FACTION_KEY, validateFaction } from '@/shared/preferences/faction.mjs';
-import { SORT_ORDER_KEY, validateSortOrder } from '@/shared/preferences/sortOrder.mjs';
+import {
+    SORT_ORDER_KEY,
+    validateSortOrder,
+    CASCADE_SORT_ORDER_KEY,
+    validateCascadeSortOrder,
+} from '@/shared/preferences/sortOrder.mjs';
```

Inside `WarHistoryPage`, after `const initialSortOrder = ...`:

```diff
     const initialSortOrder = validateSortOrder(c.get(SORT_ORDER_KEY)?.value);
+    const initialCascadeSort = validateCascadeSortOrder(
+        c.get(CASCADE_SORT_ORDER_KEY)?.value,
+    );
```

Pass it down to `ArchivesClient`:

```diff
             <ArchivesClient
                 data={data}
                 seasons={seasons}
                 currentSeason={currentSeason}
                 defeatMessageIndex={Math.floor(
                     Math.random() * RESISTANCE_MESSAGES.length,
                 )}
                 isAdmin={isAdmin}
                 initialFaction={initialFaction}
                 initialSortOrder={initialSortOrder}
+                initialCascadeSort={initialCascadeSort}
             />
```

- [ ] **Step 2: Render `<CascadeLog>` inside `ArchivesClient`**

Open `src/features/archives/ArchivesClient.jsx`.

Add to the imports:

```diff
 import StatGrid from '@/features/stats/StatGrid';
 import EventLog from '@/features/timeline/EventLog';
+import CascadeLog from '@/features/timeline/CascadeLog';
+import { findAllCascades } from '@/shared/utils/game/seasonAnalytics.mjs';
```

Add the new prop to the function signature (in the `ArchivesClient` destructured params), then derive the per-season cascades just below the existing `const events = data?.events ?? [];`:

```diff
-    const events = data?.events ?? [];
+    const events = data?.events ?? [];
+    const cascades = findAllCascades(events).map((c) => ({
+        season: data?.season,
+        ...c,
+    }));
```

Render `<CascadeLog>` below the `StatGrid` + `ArchiveStats` section, before any subsequent sections. The exact spot will be slightly file-dependent — locate the JSX block containing `<StatGrid ... />` and `<ArchiveStats ... />` and add `<CascadeLog>` after that block's closing element:

```jsx
{cascades.length > 0 && (
    <CascadeLog
        cascades={cascades}
        initialSortOrder={initialCascadeSort}
    />
)}
```

The component renders its own `<section>`, so do not wrap it in another one.

- [ ] **Step 3: Run lint + typecheck**

```bash
npm run lint && npm run typecheck
```

Expected: both pass.

- [ ] **Step 4: Run the unit test suite to confirm nothing broke**

```bash
npm run test:unit
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/app/archives/page.jsx src/features/archives/ArchivesClient.jsx
git commit -m "feat(archives): render CascadeLog below the StatGrid

Reuses the same component as /stats, filtered to the current season via
findAllCascades(events). The section only renders when the season has
at least one qualifying cascade. No lede prop on /archives.

Issue: #272

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 12: Final verification — lint + typecheck + tests + build

**Files:** none.

Per CLAUDE.md, all four must pass before claiming the feature done.

- [ ] **Step 1: `npm run lint`**

```bash
npm run lint
```

Expected: clean exit. If failures, fix and re-run.

- [ ] **Step 2: `npm run typecheck`**

```bash
npm run typecheck
```

Expected: clean exit.

- [ ] **Step 3: `npm run test:unit`**

```bash
npm run test:unit
```

Expected: all suites pass.

- [ ] **Step 4: `npm run build`**

```bash
npm run build
```

Expected: clean build. No SSG warnings related to the new code.

- [ ] **Step 5: Spot-check at `localhost:3000/stats` and `/archives?season=N`**

Assuming the dev server is running (per CLAUDE.md), visit both pages:

- `/stats` — confirm the **Cascade Failures** section renders between War Outcomes and All-Time Records. Confirm the sort toggle flips order. Confirm clicking a card navigates to `/archives?season=N`.
- `/archives?season=155` (or any season known to contain a cascade) — confirm the `CascadeLog` renders below the StatGrid. Confirm the `WORST_CASCADE` card is gone from the grid.

If the dev server is not running, ask the user to start it (`npm run dev`) and confirm.

- [ ] **Step 6: Verify the bundle is reasonable**

```bash
npx next build 2>&1 | grep -E "(stats|archives)" | head
```

Confirm `/stats` route size hasn't ballooned (should be within ~5 KB of its previous size — the cascade log adds one small component).

- [ ] **Step 7: Open the PR**

```bash
git push -u origin feature/cascade-failure-log
gh pr create --base develop --title "feat: cascade failure log (#272)" \
  --body "$(cat <<'EOF'
Adds a cross-season Cascade Failures section to /stats and a per-season
cascade log on /archives, replacing the previous WORST_CASCADE stat
card with a richer EventLog-style layout.

Design: docs/superpowers/specs/2026-05-23-cascade-failure-log-design.md
Plan:   docs/superpowers/plans/2026-05-23-cascade-failure-log.md

Closes #272

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

Per CLAUDE.md, **versioning happens on merge**, not in this branch — the PR reviewer / merger handles the version bump and CHANGELOG update at merge time.

---

## Deferred from spec

- **Per-season outcome string in the group header.** The design spec describes group header summaries as `"1 cascade · Defeat"`. The spec also flags this as an Open Question with the suggested resolution to "attach `outcome` in `getCascadeLeaderboard`". This plan ships header summaries as `"N cascade(s)"` only — outcome is not threaded through. Follow-up issue should add outcome (probably by reusing `getWarOutcome(season)` once per season inside the leaderboard query).

## Notes on conventions

- All async DB / fetch calls go through `tryCatch` from `@/shared/utils/tryCatch.mjs`. No `try`/`catch` blocks.
- File imports use the `@/*` alias mapping to `./src/*`.
- All interactive elements (links, buttons, toggles) include `data-umami-event="category-action"` for analytics.
- Components rely on Tailwind utilities + the existing `EventLog.css` classes. Faction colors come from `--color-faction-{bugs,cyborgs,illuminate}` defined in `src/app/layout.css`.
- The cascade log explicitly **does not** ship a new CSS file — it extends `EventLog.css` with three new classes (`event-log-card-chain`, `event-log-card--cascade`, `event-log-lede`) so style drift stays minimized.
