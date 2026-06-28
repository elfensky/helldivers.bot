# War Narrative Extension Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the archives War Narrative with seeded phrasing variety, player surge/collapse beats, offensive conquest milestones, and a war-by-numbers beat — all computed server-side so `getCampaign` stays untouched.

**Architecture:** A new server-only telemetry query plus four small pure beat-generator modules feed an extended `buildWarNarrative(data, telemetry)`, called on the archives **server page**. The resulting `beats[]` is threaded through `ArchivesClient` to `NarrativeSection`, which becomes a dumb renderer. Determinism (no `Math.random`) is preserved so SSR is stable.

**Tech Stack:** Next.js 16 (App Router, RSC), React 19, Prisma (`db.$queryRaw`), Vitest (jsdom for components, plain for utils), JSDoc-typed `.mjs` (`checkJs`).

**Spec:** [docs/superpowers/specs/2026-06-28-war-narrative-extension-design.md](../specs/2026-06-28-war-narrative-extension-design.md)

## Global Constraints

- **KISS / YAGNI.** No abstraction beyond what the spec states.
- **Branch/worktree:** execute in a worktree off `feature/war-narrative-extension` (already has the spec + the v0.64.1 SHOW/HIDE button). Never commit to `main`/`develop` directly.
- **Verification (all four, from inside the worktree, via mise = node 24):** `mise exec -- npm run lint`, `mise exec -- npm run typecheck`, `mise exec -- npm run test:unit`, `mise exec -- npm run build`. The worktree shell otherwise defaults to homebrew node 26, which yields ~48 spurious localStorage test failures — always use `mise exec`.
- **Run `mise exec -- npm run lint:fix` before each commit.** Imports use `@/*` → `./src/*`.
- **Determinism is a hard requirement:** the narrative is server-rendered; no `Math.random` anywhere in the generators. Same `(data, telemetry)` ⇒ identical beats.
- **BigInt → Number:** `kills`/`deaths`/`accidentals` are BigInt in `h1_statistic`; narrow to `Number` in the query before they cross into beats.
- **Voice:** Ministry-of-Truth dark-comedy, franchise-only, profanity-free (mirror `src/features/ministry/ministryContent.mjs`).
- **Beat contract:** every beat is `{ time:number, day:number, order:number, text:string }` internally; `buildWarNarrative` returns `{ day, text }[]` (existing contract, unchanged).

## File Structure

| File | Responsibility | Action |
|---|---|---|
| `src/features/archives/narrativePhrasing.mjs` | seeded picker + phrasing pools (feature 1) | Create |
| `src/features/archives/playerBeats.mjs` | surge/collapse from `playerTimeseries` (feature 2) | Create |
| `src/features/archives/conquestBeats.mjs` | breakthrough / first-homeworld-falls from `snapshots` (feature 3) | Create |
| `src/db/queries/getSeasonTelemetryTotals.mjs` | season telemetry sums (latest-bucket-per-enemy, BigInt→Number) (feature 4) | Create |
| `src/features/archives/numbersBeat.mjs` | telemetry summary beat (feature 4) | Create |
| `src/features/archives/buildWarNarrative.mjs` | orchestrator: `(data, telemetry)`, route text through phrasing, call generators, coherence guard | Modify |
| `src/app/archives/page.jsx` | fetch telemetry + compute `beats` server-side, pass down | Modify |
| `src/features/archives/ArchivesClient.jsx` | thread `narrativeBeats` prop | Modify |
| `src/features/archives/NarrativeSection.jsx` | take `beats` prop (drop client-side `buildWarNarrative`) | Modify |

Tests live under `src/__tests__/unit/...` mirroring the source path.

---

### Task 1: `narrativePhrasing.mjs` — seeded picker + phrasing pools

**Files:**
- Create: `src/features/archives/narrativePhrasing.mjs`
- Test: `src/__tests__/unit/features/archives/narrativePhrasing.test.mjs`

**Interfaces:**
- Produces:
  - `pickVariant(pool, season, key) → poolElement` — deterministic index `hash32(season*1000003 + key) % pool.length`.
  - `PHRASES` — object of pools; each pool is an array of template functions returning a string. Keys: `opening`, `arrival`, `cascade`, `attackWon`, `attackLost`, `defendWon`, `defendLost`, `victory`, `defeat`, `defeatGeneric`, `surge`, `collapse`, `breakthrough`, `homeworldFalls`.
  - `PHRASE_KEY` — fixed integer keys for singleton beats: `{ opening:1, victory:2, defeat:3, numbers:4 }`.

- [ ] **Step 1: Write the failing test**

Create `src/__tests__/unit/features/archives/narrativePhrasing.test.mjs`:

```js
import { describe, it, expect } from 'vitest';
import { pickVariant, PHRASES } from '@/features/archives/narrativePhrasing.mjs';

describe('pickVariant', () => {
    const pool = ['a', 'b', 'c'];

    it('is deterministic for the same (season, key)', () => {
        expect(pickVariant(pool, 155, 42)).toBe(pickVariant(pool, 155, 42));
    });

    it('stays within the pool', () => {
        for (let k = 0; k < 50; k++) {
            expect(pool).toContain(pickVariant(pool, 157, k));
        }
    });

    it('varies across keys and seasons (not always index 0)', () => {
        const picks = new Set();
        for (let k = 0; k < 20; k++) picks.add(pickVariant(pool, 155, k));
        expect(picks.size).toBeGreaterThan(1);
    });

    it('handles a single-element pool', () => {
        expect(pickVariant(['only'], 1, 1)).toBe('only');
    });
});

describe('PHRASES pools', () => {
    it('every pool has at least 2 variants and renders a non-empty string', () => {
        for (const [name, pool] of Object.entries(PHRASES)) {
            expect(pool.length, name).toBeGreaterThanOrEqual(2);
            // render variant 0 with dummy args — must be a non-empty string
            const out = pool[0]('Region', 'Bugs', 3, 'over 2 days', '', 25000);
            expect(typeof out, name).toBe('string');
            expect(out.length, name).toBeGreaterThan(0);
        }
    });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `mise exec -- npm run test:unit -- narrativePhrasing`
Expected: FAIL — `Failed to resolve import ".../narrativePhrasing.mjs"`.

- [ ] **Step 3: Write the module**

Create `src/features/archives/narrativePhrasing.mjs`:

```js
/**
 * Deterministic phrasing variety for the War Narrative. SSR-safe: every pick
 * is a pure function of (season, key) — no Math.random — so the server-rendered
 * narrative is byte-stable. Voice mirrors src/features/ministry/ministryContent
 * .mjs (Ministry-of-Truth dark comedy, franchise-only, profanity-free).
 */

// 32-bit avalanche hash (xxHash-style finalizer) → uniform pool index.
function hash32(n) {
    let h = (n >>> 0) || 1;
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return (h ^ (h >>> 16)) >>> 0;
}

/**
 * Deterministically select a variant from `pool`, seeded by `season` + `key`
 * (an event_id for per-event beats, or a `PHRASE_KEY` constant for singletons).
 *
 * @template T
 * @param {T[]} pool
 * @param {number} season
 * @param {number} key
 * @returns {T}
 */
export function pickVariant(pool, season, key) {
    return pool[hash32(season * 1000003 + key) % pool.length];
}

/** Fixed keys so singleton beats (no event_id) still vary by season. */
export const PHRASE_KEY = { opening: 1, victory: 2, defeat: 3, numbers: 4 };

/**
 * Each pool is an array of template functions. Variant 0 of the existing
 * beats reproduces the pre-extension wording so the change is additive.
 */
export const PHRASES = {
    opening: [
        () =>
            'The war begins. By order of the Ministry of Truth, every citizen is a soldier and every soldier is a statistic.',
        () =>
            'The war begins. The Ministry of Truth has already written the victory speech; only the date remains classified.',
    ],
    /** (enemy) */
    arrival: [
        (enemy) =>
            `The ${enemy} enter the war. The Ministry assures all citizens this was anticipated, scheduled, and is going entirely according to plan.`,
        (enemy) =>
            `The ${enemy} join the war. The Ministry welcomes the additional opportunity for managed democracy.`,
    ],
    /** (enemy, count, dayPhrase, home) */
    cascade: [
        (enemy, count, dayPhrase, home) =>
            `A devastating cascade. The ${enemy} push through ${count} regions ${dayPhrase}.${home} Reports of panic have been reclassified as enthusiasm.`,
        (enemy, count, dayPhrase, home) =>
            `The line breaks. The ${enemy} sweep ${count} regions ${dayPhrase}.${home} The Ministry files the rout under "tactical generosity."`,
    ],
    /** (region, enemy) */
    attackWon: [
        (region, enemy) =>
            `Helldivers storm the ${enemy} homeworld and raise the flag over ${region}. The Ministry declares the celebration mandatory.`,
        (region, enemy) =>
            `${region} is liberated from the ${enemy}. The Ministry has scheduled three parades and one mandatory cheer.`,
    ],
    /** (region, enemy) */
    attackLost: [
        (region, enemy) =>
            `The assault on the ${enemy} at ${region} falters. The Ministry has retroactively scheduled this setback as a morale exercise.`,
        (region, enemy) =>
            `The push on ${region} stalls before the ${enemy}. The Ministry reclassifies the advance as a "strategic pause."`,
    ],
    /** (region, enemy) */
    defendWon: [
        (region, enemy) =>
            `${region} holds against the ${enemy}. The Ministry credits its own foresight and nothing else.`,
        (region, enemy) =>
            `${region} repels the ${enemy}. The Ministry notes the outcome was never in doubt, and never will have been.`,
    ],
    /** (region, enemy) */
    defendLost: [
        (region, enemy) =>
            `${region} falls to the ${enemy}. The Ministry reminds citizens that a region lost is merely a region awaiting glorious recapture.`,
        (region, enemy) =>
            `The ${enemy} take ${region}. The Ministry has redrawn the map; the region was always optional.`,
    ],
    /** (attribution) — attribution is '' or a leading-space sentence */
    victory: [
        (attribution) =>
            `The war is won. Super Earth stands victorious — managed democracy prevails, exactly as the Ministry always knew it would.${attribution}`,
        (attribution) =>
            `Victory. Super Earth endures, and the Ministry's confidence is retroactively vindicated in full.${attribution}`,
    ],
    /** (enemy) */
    defeat: [
        (enemy) =>
            `Super Earth falls. The ${enemy} have won. The Ministry assures surviving citizens that this defeat was both temporary and, in hindsight, inspirational.`,
        (enemy) =>
            `The ${enemy} prevail. The Ministry has filed Super Earth's defeat under "aggressive rebranding opportunity."`,
    ],
    defeatGeneric: [
        () =>
            'The war is lost. The Ministry has classified the outcome as a strategic reposition and recommends citizens look forward, never back.',
        () =>
            'The war is lost. The Ministry asks only that citizens remember the version of events it will provide shortly.',
    ],
    /** (n) — formatted player count */
    surge: [
        (n) => `The Helldivers rally — deployments surge to ${n}.`,
        (n) => `Recruitment spikes; ${n} citizens answer the call at once.`,
    ],
    /** (n) — formatted player count */
    collapse: [
        (n) => `The front grows quiet; deployments thin to ${n}.`,
        (n) => `Mobilization wanes — only ${n} remain on the line.`,
    ],
    /** (enemy) */
    breakthrough: [
        (enemy) =>
            `The ${enemy} are driven to the gates of their homeworld — the assault begins.`,
        (enemy) =>
            `Super Earth reaches the ${enemy} homeworld; the final push is at hand.`,
    ],
    /** (enemy) */
    homeworldFalls: [
        (enemy) => `The ${enemy} homeworld falls — the first front is won.`,
        (enemy) => `The ${enemy} are routed to extinction; the first homeworld is taken.`,
    ],
    /** (kills, missions, accidentals) — all pre-formatted strings */
    numbers: [
        (kills, missions, accidentals) =>
            `By the numbers: ${kills} exterminated across ${missions} missions; ${accidentals} citizens met managed democracy ahead of schedule.`,
        (kills, missions, accidentals) =>
            `The ledger of war: ${kills} enemy dead, ${missions} missions run, and ${accidentals} friendly-fire commendations issued posthumously.`,
    ],
};
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `mise exec -- npm run test:unit -- narrativePhrasing`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
mise exec -- npm run lint:fix
git add src/features/archives/narrativePhrasing.mjs src/__tests__/unit/features/archives/narrativePhrasing.test.mjs
git commit -m "feat(archives): seeded phrasing pools for war narrative (feature 1)"
```

---

### Task 2: `playerBeats.mjs` — surge/collapse beats

**Files:**
- Create: `src/features/archives/playerBeats.mjs`
- Test: `src/__tests__/unit/features/archives/playerBeats.test.mjs`

**Interfaces:**
- Consumes: `PHRASES`, `pickVariant` (Task 1); `formatNumber` from `@/shared/utils/format/formatNumber.mjs`.
- Produces: `buildPlayerBeats(playerTimeseries, season) → Array<{ time, day, kind, text }>` where `kind` is `'surge' | 'collapse'`. `playerTimeseries` entries are `{ time, day, total }`. Returns `[]` for empty/flat input. `kind` lets the orchestrator's coherence guard spot opposite sentiment.

- [ ] **Step 1: Write the failing test**

Create `src/__tests__/unit/features/archives/playerBeats.test.mjs`:

```js
import { describe, it, expect } from 'vitest';
import { buildPlayerBeats } from '@/features/archives/playerBeats.mjs';

const pt = (day, total) => ({ time: day * 86400, day, total });

describe('buildPlayerBeats', () => {
    it('returns [] for empty or single-point series', () => {
        expect(buildPlayerBeats([], 157)).toEqual([]);
        expect(buildPlayerBeats([pt(1, 100)], 157)).toEqual([]);
    });

    it('emits a surge and a collapse on a series that clears the thresholds', () => {
        // baseline ~1000; spike to 5000 (surge), crater to 200 (collapse)
        const series = [
            pt(1, 50), // opening ramp — ignored for collapse
            pt(2, 1000),
            pt(3, 1000),
            pt(4, 5000), // surge
            pt(5, 1000),
            pt(6, 200), // collapse
            pt(7, 1000),
        ];
        const beats = buildPlayerBeats(series, 157);
        const kinds = beats.map((b) => b.kind).sort();
        expect(kinds).toEqual(['collapse', 'surge']);
        expect(beats.length).toBe(2);
        // anchored at the right buckets
        expect(beats.find((b) => b.kind === 'surge').day).toBe(4);
        expect(beats.find((b) => b.kind === 'collapse').day).toBe(6);
    });

    it('emits nothing on a flat series (no bucket clears the thresholds)', () => {
        const series = [pt(1, 0), pt(2, 1000), pt(3, 1010), pt(4, 990), pt(5, 1000)];
        expect(buildPlayerBeats(series, 157)).toEqual([]);
    });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `mise exec -- npm run test:unit -- playerBeats`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the module**

Create `src/features/archives/playerBeats.mjs`:

```js
import { formatNumber } from '@/shared/utils/format/formatNumber.mjs';
import { PHRASES, pickVariant } from '@/features/archives/narrativePhrasing.mjs';

const SURGE_FACTOR = 1.4; // a peak ≥ 1.4× baseline is a "rally"
const COLLAPSE_FACTOR = 0.6; // a trough ≤ 0.6× baseline is "the front grows quiet"

function median(nums) {
    if (nums.length === 0) return 0;
    const s = [...nums].sort((a, b) => a - b);
    const mid = Math.floor(s.length / 2);
    return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/**
 * Player surge/collapse beats from the per-bucket player timeseries. The single
 * most extreme surge and the single most extreme collapse (past the opening
 * ramp) are emitted when they clear their thresholds — at most 2 beats.
 *
 * @param {Array<{ time:number, day:number, total:number }>} playerTimeseries
 * @param {number} season - phrasing seed
 * @returns {Array<{ time:number, day:number, kind:'surge'|'collapse', text:string }>}
 */
export function buildPlayerBeats(playerTimeseries, season) {
    const series = playerTimeseries ?? [];
    if (series.length < 2) return [];

    const baseline = median(series.map((p) => p.total));
    if (baseline <= 0) return [];

    const beats = [];

    // Surge: global max, anywhere.
    const peak = series.reduce((a, b) => (b.total > a.total ? b : a));
    if (peak.total >= SURGE_FACTOR * baseline) {
        beats.push({
            time: peak.time,
            day: peak.day,
            kind: 'surge',
            text: pickVariant(PHRASES.surge, season, peak.time | 0)(
                formatNumber(peak.total),
            ),
        });
    }

    // Collapse: global min, skipping the first (opening-ramp) bucket.
    const tail = series.slice(1);
    const trough = tail.reduce((a, b) => (b.total < a.total ? b : a));
    if (trough.total <= COLLAPSE_FACTOR * baseline) {
        beats.push({
            time: trough.time,
            day: trough.day,
            kind: 'collapse',
            text: pickVariant(PHRASES.collapse, season, trough.time | 0)(
                formatNumber(trough.total),
            ),
        });
    }

    return beats;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `mise exec -- npm run test:unit -- playerBeats`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
mise exec -- npm run lint:fix
git add src/features/archives/playerBeats.mjs src/__tests__/unit/features/archives/playerBeats.test.mjs
git commit -m "feat(archives): player surge/collapse beats (feature 2)"
```

---

### Task 3: `conquestBeats.mjs` — offensive conquest milestones

**Files:**
- Create: `src/features/archives/conquestBeats.mjs`
- Test: `src/__tests__/unit/features/archives/conquestBeats.test.mjs`

**Interfaces:**
- Consumes: `PHRASES`, `pickVariant` (Task 1); `factions` from `@/shared/enums/factions.mjs` (for the faction name, stripped of "The ").
- Produces: `buildConquestBeats(snapshots, pointsMax, season) → Array<{ time, day, kind:'conquest', text }>`. `snapshots` = `[{ time, data:[{ enemy, points, status }, …] }]`; `pointsMax` = `{ points:number[] }`. **High `points/points_max` = Super Earth advancing.** Emits ≤2: the earliest "breakthrough" (a faction first crossing the gates threshold) and the earliest "first homeworld falls" (first `'defeated'`); dedupes if both are the same faction on the same day.

- [ ] **Step 1: Write the failing test**

Create `src/__tests__/unit/features/archives/conquestBeats.test.mjs`:

```js
import { describe, it, expect } from 'vitest';
import { buildConquestBeats } from '@/features/archives/conquestBeats.mjs';

const pointsMax = { points: [1000, 1000, 1000] };
const snap = (day, states) => ({ time: day * 86400, data: states });
// states: array of { enemy, points, status }
const f = (enemy, points, status = 'active') => ({ enemy, points, status });

describe('buildConquestBeats', () => {
    it('returns [] when no faction reaches the gates and none is defeated', () => {
        const snapshots = [
            snap(1, [f(0, 100), f(1, 50), f(2, 0)]),
            snap(2, [f(0, 300), f(1, 200), f(2, 100)]),
        ];
        expect(buildConquestBeats(snapshots, pointsMax, 155)).toEqual([]);
    });

    it('emits a breakthrough at the gates threshold (0.9)', () => {
        const snapshots = [
            snap(1, [f(0, 500), f(1, 0), f(2, 0)]),
            snap(3, [f(0, 950), f(1, 0), f(2, 0)]), // bugs cross 0.9
        ];
        const beats = buildConquestBeats(snapshots, pointsMax, 155);
        expect(beats.length).toBe(1);
        expect(beats[0].day).toBe(3);
        expect(beats[0].text).toMatch(/Bugs/);
    });

    it('emits "first homeworld falls" on the first defeated faction', () => {
        const snapshots = [
            snap(2, [f(0, 950), f(1, 0), f(2, 0)]), // breakthrough day 2
            snap(4, [f(0, 1000, 'defeated'), f(1, 0), f(2, 0)]), // falls day 4
        ];
        const beats = buildConquestBeats(snapshots, pointsMax, 155);
        // ≤2; breakthrough (day2) + falls (day4), different days → both kept
        expect(beats.length).toBe(2);
        expect(beats.some((b) => /falls|routed/i.test(b.text))).toBe(true);
    });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `mise exec -- npm run test:unit -- conquestBeats`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the module**

Create `src/features/archives/conquestBeats.mjs`:

```js
import factions from '@/shared/enums/factions.mjs';
import { PHRASES, pickVariant } from '@/features/archives/narrativePhrasing.mjs';

const GATES_THRESHOLD = 0.9; // "at the gates" — homeworld-assault range

function factionName(enemy) {
    return (factions[enemy]?.name ?? 'Unknown forces').replace(/^The\s+/i, '');
}

/**
 * Offensive conquest milestones from the campaign snapshots. `points/points_max`
 * is Super Earth's conquest progress toward the enemy homeworld (high = SE
 * winning — verified vs computeMapState + the HD1 API). Emits at most two beats:
 *   - breakthrough: first time any faction's frac first crosses GATES_THRESHOLD
 *   - first homeworld falls: first time any faction first reads 'defeated'
 *
 * @param {Array<{ time:number, data:Array<{ enemy:number, points:number, status:string }> }>} snapshots
 * @param {{ points:number[] }} pointsMax
 * @param {number} season
 * @returns {Array<{ time:number, day:number, kind:'conquest', text:string }>}
 */
export function buildConquestBeats(snapshots, pointsMax, season) {
    const snaps = snapshots ?? [];
    const maxes = pointsMax?.points ?? [];
    if (snaps.length === 0) return [];

    const dayOf = (time) => Math.max(1, Math.floor(time / 86400) + 1);

    let breakthrough = null; // first snapshot any faction crosses the gates
    let firstFall = null; // first snapshot any faction is defeated

    for (const snap of snaps) {
        for (const s of snap.data ?? []) {
            const max = maxes[s.enemy] || 0;
            const frac =
                s.status === 'defeated' ? 1 : max > 0 ? s.points / max : 0;
            if (!breakthrough && frac >= GATES_THRESHOLD) {
                breakthrough = { time: snap.time, enemy: s.enemy };
            }
            if (!firstFall && s.status === 'defeated') {
                firstFall = { time: snap.time, enemy: s.enemy };
            }
        }
        if (breakthrough && firstFall) break;
    }

    const beats = [];
    if (breakthrough) {
        beats.push({
            time: breakthrough.time,
            day: dayOf(breakthrough.time),
            kind: 'conquest',
            text: pickVariant(PHRASES.breakthrough, season, breakthrough.enemy)(
                factionName(breakthrough.enemy),
            ),
        });
    }
    if (firstFall) {
        beats.push({
            time: firstFall.time,
            day: dayOf(firstFall.time),
            kind: 'conquest',
            text: pickVariant(PHRASES.homeworldFalls, season, firstFall.enemy + 10)(
                factionName(firstFall.enemy),
            ),
        });
    }

    // Dedupe: same faction reaching the gates and falling on the same day reads
    // as one moment — keep the "falls" beat.
    if (
        beats.length === 2 &&
        breakthrough.enemy === firstFall.enemy &&
        beats[0].day === beats[1].day
    ) {
        return [beats[1]];
    }
    return beats;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `mise exec -- npm run test:unit -- conquestBeats`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
mise exec -- npm run lint:fix
git add src/features/archives/conquestBeats.mjs src/__tests__/unit/features/archives/conquestBeats.test.mjs
git commit -m "feat(archives): offensive conquest milestone beats (feature 3)"
```

---

### Task 4: `getSeasonTelemetryTotals.mjs` — season telemetry query

**Files:**
- Create: `src/db/queries/getSeasonTelemetryTotals.mjs`
- Test: `src/__tests__/unit/queries/getSeasonTelemetryTotals.test.mjs`

**Interfaces:**
- Produces: `getSeasonTelemetryTotals(season) → Promise<{ kills:number, missions:number, accidentals:number, completed_planets:number, total_unique_players:number } | null>`. `null` when the season has no `h1_statistic` rows. BigInt fields narrowed to `Number`. Mirrors the latest-bucket-per-enemy aggregation in `getCrossSeasonStats.mjs`.

- [ ] **Step 1: Write the failing test**

Create `src/__tests__/unit/queries/getSeasonTelemetryTotals.test.mjs`:

```js
import { describe, test, expect, vi, beforeEach } from 'vitest';
import db from '@/db/db';
import { getSeasonTelemetryTotals } from '@/db/queries/getSeasonTelemetryTotals.mjs';

// The query is a single $queryRaw (GROUP BY over the latest bucket per enemy);
// the global db mock from vitest.setup.mjs makes $queryRaw mockable.
beforeEach(() => {
    vi.mocked(db.$queryRaw).mockReset();
});

describe('getSeasonTelemetryTotals', () => {
    test('returns null when the season has no telemetry rows', async () => {
        vi.mocked(db.$queryRaw).mockResolvedValueOnce([]);
        expect(await getSeasonTelemetryTotals(155)).toBeNull();
    });

    test('narrows BigInt fields and shapes the totals', async () => {
        vi.mocked(db.$queryRaw).mockResolvedValueOnce([
            {
                kills: 1234567n,
                accidentals: 8910n,
                missions: 4200,
                completed_planets: 17,
                total_unique_players: 95000,
            },
        ]);
        const r = await getSeasonTelemetryTotals(157);
        expect(r).toEqual({
            kills: 1234567,
            accidentals: 8910,
            missions: 4200,
            completed_planets: 17,
            total_unique_players: 95000,
        });
        expect(typeof r.kills).toBe('number'); // not bigint
    });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `mise exec -- npm run test:unit -- getSeasonTelemetryTotals`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the query**

Create `src/db/queries/getSeasonTelemetryTotals.mjs`:

```js
import { cache } from 'react';
import db from '@/db/db';

/**
 * Sum one season's telemetry. `h1_statistic` fields are monotonic cumulative
 * counters, so the season total is the LATEST bucket per enemy summed across
 * the three factions (mirrors getCrossSeasonStats.mjs). Returns `null` for
 * seasons that predate telemetry collection (no rows). BigInt fields
 * (kills/accidentals) are narrowed to Number for the server→client boundary.
 *
 * @param {number} season
 * @returns {Promise<{ kills:number, missions:number, accidentals:number, completed_planets:number, total_unique_players:number } | null>}
 */
export const getSeasonTelemetryTotals = cache(async function getSeasonTelemetryTotals(
    season,
) {
    'use server';

    const rows = await db.$queryRaw`
        SELECT
          sum(kills)                       AS kills,
          sum(accidentals)                 AS accidentals,
          sum(missions)::int               AS missions,
          sum(completed_planets)::int      AS completed_planets,
          sum(total_unique_players)::int   AS total_unique_players
        FROM (
          SELECT DISTINCT ON (enemy) *
          FROM h1_statistic
          WHERE season = ${season}
          ORDER BY enemy, bucket DESC
        ) latest
    `;

    const r = rows?.[0];
    // No telemetry rows ⇒ Postgres still returns one row of NULL sums.
    if (!r || r.kills == null) return null;

    return {
        kills: Number(r.kills),
        accidentals: Number(r.accidentals),
        missions: Number(r.missions),
        completed_planets: Number(r.completed_planets),
        total_unique_players: Number(r.total_unique_players),
    };
});
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `mise exec -- npm run test:unit -- getSeasonTelemetryTotals`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
mise exec -- npm run lint:fix
git add src/db/queries/getSeasonTelemetryTotals.mjs src/__tests__/unit/queries/getSeasonTelemetryTotals.test.mjs
git commit -m "feat(archives): getSeasonTelemetryTotals query (feature 4)"
```

---

### Task 5: `numbersBeat.mjs` — war-by-the-numbers beat

**Files:**
- Create: `src/features/archives/numbersBeat.mjs`
- Test: `src/__tests__/unit/features/archives/numbersBeat.test.mjs`

**Interfaces:**
- Consumes: `PHRASES`, `pickVariant`, `PHRASE_KEY` (Task 1); `formatNumber`; the `getSeasonTelemetryTotals` shape (Task 4).
- Produces: `buildNumbersBeat(telemetry, lastTime, day, season) → { time, day, kind:'numbers', text } | null`. `null` when `telemetry` is falsy.

- [ ] **Step 1: Write the failing test**

Create `src/__tests__/unit/features/archives/numbersBeat.test.mjs`:

```js
import { describe, it, expect } from 'vitest';
import { buildNumbersBeat } from '@/features/archives/numbersBeat.mjs';

describe('buildNumbersBeat', () => {
    it('returns null when telemetry is null', () => {
        expect(buildNumbersBeat(null, 100, 5, 157)).toBeNull();
    });

    it('builds a beat from totals, anchored at lastTime', () => {
        const beat = buildNumbersBeat(
            { kills: 25_000_000, missions: 4200, accidentals: 8910 },
            999000,
            12,
            157,
        );
        expect(beat.time).toBe(999000);
        expect(beat.day).toBe(12);
        expect(beat.kind).toBe('numbers');
        expect(beat.text).toMatch(/25\.0M|25,000,000/); // formatNumber output
        expect(beat.text).toMatch(/mission/i);
    });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `mise exec -- npm run test:unit -- numbersBeat`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the module**

Create `src/features/archives/numbersBeat.mjs`:

```js
import { formatNumber } from '@/shared/utils/format/formatNumber.mjs';
import { PHRASES, pickVariant, PHRASE_KEY } from '@/features/archives/narrativePhrasing.mjs';

/**
 * One "war by the numbers" beat from the season telemetry totals, anchored at
 * `lastTime` (the last event) so the orchestrator can order it just before the
 * closing outcome beat. Returns `null` for telemetry-less seasons.
 *
 * @param {{ kills:number, missions:number, accidentals:number } | null} telemetry
 * @param {number} lastTime
 * @param {number} day
 * @param {number} season
 * @returns {{ time:number, day:number, kind:'numbers', text:string } | null}
 */
export function buildNumbersBeat(telemetry, lastTime, day, season) {
    if (!telemetry) return null;
    const text = pickVariant(PHRASES.numbers, season, PHRASE_KEY.numbers)(
        formatNumber(telemetry.kills),
        formatNumber(telemetry.missions),
        formatNumber(telemetry.accidentals),
    );
    return { time: lastTime, day, kind: 'numbers', text };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `mise exec -- npm run test:unit -- numbersBeat`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
mise exec -- npm run lint:fix
git add src/features/archives/numbersBeat.mjs src/__tests__/unit/features/archives/numbersBeat.test.mjs
git commit -m "feat(archives): war-by-the-numbers beat (feature 4)"
```

---

### Task 6: extend `buildWarNarrative.mjs` — orchestrator + coherence guard

**Files:**
- Modify: `src/features/archives/buildWarNarrative.mjs` (full new version below)
- Modify: `src/__tests__/unit/features/archives/buildWarNarrative.test.mjs` (**exists, 12 tests** — loosen the 5 variant-sensitive assertions, then append a new `describe` block)

**Interfaces:**
- Consumes: all four generators + `PHRASES`/`pickVariant`/`PHRASE_KEY` (Tasks 1-5).
- Produces: `buildWarNarrative(data, telemetry = null) → Array<{ day:number, text:string }>` (return contract unchanged; new optional `telemetry` param).

> **Why edit, not create:** the existing file asserts exact beat *wording*, which seeded phrasing (Task 1) intentionally varies. Wording is no longer a fixed contract — loosen those assertions to accept either variant. (`'The war begins'`, `'N regions'`, and faction-name checks survive because both variants share them; only the 5 below break.)

- [ ] **Step 1a: Loosen the variant-sensitive assertions in the existing test**

In `src/__tests__/unit/features/archives/buildWarNarrative.test.mjs`, make exactly these replacements (the right-hand regex accepts both variant 0 and variant 1):

```
b.text.includes('Illuminate') && b.text.includes('enter the war')
  →  b.text.includes('Illuminate') && /enter the war|join the war/.test(b.text)

b.text.includes('Bugs') && b.text.includes('enter the war')
  →  b.text.includes('Bugs') && /enter the war|join the war/.test(b.text)

expect(last.text).toContain('Super Earth falls');
  →  expect(last.text).toMatch(/Super Earth falls|Super Earth's defeat/);

expect(last.text).toContain('The war is won');
  →  expect(last.text).toMatch(/The war is won|Super Earth endures/);

expect(cascade.text).toContain('The Illuminate push through');
  →  expect(cascade.text).toMatch(/Illuminate (push through|sweep)/);
```

(Leave the `'The war begins'`, `'4 regions'`, `'The Illuminate'` defeat-name, and `not.toMatch(/\bthe the\b/i)` assertions as-is — both variants satisfy them.)

- [ ] **Step 1b: Append the new failing tests**

Append this `describe` block to the **end** of the same file (it brings its own fixture, so it won't collide with the existing tests):

```js
describe('buildWarNarrative — extension (generators + telemetry)', () => {
    const extData = {
        season: 157,
        war_start: 0,
        introduction_order: { order: [1, 0, 0] },
        status: [{ enemy: 0, first_seen: 0, status: 'active', points: 0, points_taken: 0 }],
        points_max: { points: [1000, 1000, 1000] },
        snapshots: [],
        playerTimeseries: [],
        events: [
            { type: 'defend', status: 'success', enemy: 0, region: 5, start_time: 86400, end_time: 90000, event_id: 1 },
            { type: 'defend', status: 'fail', enemy: 0, region: 4, start_time: 172800, end_time: 176400, event_id: 2 },
        ],
    };

    it('is deterministic — same input yields identical output', () => {
        expect(buildWarNarrative(extData, null)).toEqual(buildWarNarrative(extData, null));
    });

    it('omits the numbers beat when telemetry is null', () => {
        const texts = buildWarNarrative(extData, null).map((b) => b.text);
        expect(texts.some((t) => /By the numbers|ledger of war/i.test(t))).toBe(false);
    });

    it('appends a numbers beat when telemetry is present', () => {
        const texts = buildWarNarrative(extData, {
            kills: 1000, missions: 50, accidentals: 9,
        }).map((b) => b.text);
        expect(texts.some((t) => /By the numbers|ledger of war/i.test(t))).toBe(true);
    });

    it('stays in chronological day order with the new beats', () => {
        const days = buildWarNarrative(extData, { kills: 1, missions: 1, accidentals: 0 }).map(
            (b) => b.day,
        );
        expect(days).toEqual([...days].sort((a, b) => a - b));
    });
});
```

- [ ] **Step 2: Run the tests to verify the new ones fail**

Run: `mise exec -- npm run test:unit -- buildWarNarrative`
Expected: FAIL — the "appends a numbers beat" test fails (current `buildWarNarrative` ignores `telemetry`). The loosened assertions still pass against the current single-phrasing output.

- [ ] **Step 3: Rewrite the orchestrator**

Replace the entire contents of `src/features/archives/buildWarNarrative.mjs` with:

```js
import { EVENT_TYPE, EVENT_STATUS } from '@/shared/enums/events.mjs';
import factions from '@/shared/enums/factions.mjs';
import { findAllCascades } from '@/shared/utils/game/seasonAnalytics.mjs';
import { getWarOutcome } from '@/features/archives/getWarOutcome.mjs';
import { getEventRegionLabel } from '@/shared/utils/game/getEventRegionLabel.mjs';
import { PHRASES, pickVariant, PHRASE_KEY } from '@/features/archives/narrativePhrasing.mjs';
import { buildPlayerBeats } from '@/features/archives/playerBeats.mjs';
import { buildConquestBeats } from '@/features/archives/conquestBeats.mjs';
import { buildNumbersBeat } from '@/features/archives/numbersBeat.mjs';

const SECONDS_PER_DAY = 86400;

function factionName(enemy) {
    return (factions[enemy]?.name ?? 'Unknown forces').replace(/^The\s+/i, '');
}

function dayOf(time, warStart) {
    const day = Math.floor((time - warStart) / SECONDS_PER_DAY) + 1;
    return day < 1 ? 1 : day;
}

/** One Ministry-voice field report for a resolved event, via seeded phrasing. */
function describeEvent(e, season) {
    const region = getEventRegionLabel(e);
    const enemy = factionName(e.enemy);
    if (e.type === EVENT_TYPE.ATTACK) {
        if (e.status === EVENT_STATUS.SUCCESS)
            return pickVariant(PHRASES.attackWon, season, e.event_id)(region, enemy);
        if (e.status === EVENT_STATUS.FAIL)
            return pickVariant(PHRASES.attackLost, season, e.event_id)(region, enemy);
        return '';
    }
    if (e.type === EVENT_TYPE.DEFEND) {
        if (e.status === EVENT_STATUS.SUCCESS)
            return pickVariant(PHRASES.defendWon, season, e.event_id)(region, enemy);
        if (e.status === EVENT_STATUS.FAIL)
            return pickVariant(PHRASES.defendLost, season, e.event_id)(region, enemy);
        return '';
    }
    return '';
}

/** The closing victory/defeat beat, via seeded phrasing. */
function describeOutcome(outcome, season) {
    if (outcome.outcome === 'victory') {
        const enemy = outcome.faction != null ? factionName(outcome.faction) : null;
        const attribution = enemy ? ` The ${enemy} were the last to fall.` : '';
        return pickVariant(PHRASES.victory, season, PHRASE_KEY.victory)(attribution);
    }
    const enemy = outcome.faction != null ? factionName(outcome.faction) : null;
    if (enemy) return pickVariant(PHRASES.defeat, season, PHRASE_KEY.defeat)(enemy);
    return pickVariant(PHRASES.defeatGeneric, season, PHRASE_KEY.defeat)();
}

/**
 * After chronological sort, drop the less-extreme of two adjacent NEW highlight
 * beats (player/conquest) with opposite sentiment, so the narrative never reads
 * a surge directly beside a collapse. Per-event/opening/outcome beats (no
 * `kind`) are never dropped.
 */
const OPPOSITE = { surge: 'collapse', collapse: 'surge' };
function coherenceGuard(beats) {
    const out = [];
    for (const beat of beats) {
        const prev = out[out.length - 1];
        if (
            prev &&
            beat.kind &&
            prev.kind &&
            OPPOSITE[beat.kind] === prev.kind &&
            beat.day === prev.day
        ) {
            continue; // skip this one — keep the earlier (already-placed) beat
        }
        out.push(beat);
    }
    return out;
}

/**
 * Build the ordered War Narrative beats for a season. Deterministic (no
 * Math.random) so the server-rendered output is stable.
 *
 * @param {object} data - getCampaign shape: events[], status[], snapshots[],
 *   introduction_order.order[], points_max.points[], playerTimeseries[], war_start.
 * @param {{ kills:number, missions:number, accidentals:number } | null} [telemetry]
 *   - season telemetry totals (getSeasonTelemetryTotals); null ⇒ no numbers beat.
 * @returns {Array<{ day:number, text:string }>}
 */
export function buildWarNarrative(data, telemetry = null) {
    const events = data?.events ?? [];
    if (events.length === 0) return [];

    const season = data?.season ?? 0;
    const warStart =
        data?.war_start ??
        events.reduce((m, e) => Math.min(m, e.start_time ?? Infinity), Infinity);
    if (!Number.isFinite(warStart)) return [];

    /** @type {Array<{ time:number, day:number, order:number, kind?:string, text:string }>} */
    const beats = [];
    let seq = 0;

    // Opening.
    beats.push({
        time: warStart,
        day: 1,
        order: seq++,
        text: pickVariant(PHRASES.opening, season, PHRASE_KEY.opening)(),
    });

    // Faction arrivals (skip the first-introduced — already on the field).
    const introOrder = data?.introduction_order?.order ?? [];
    const firstSeenByEnemy = new Map(
        (data?.status ?? [])
            .filter((s) => s?.first_seen != null)
            .map((s) => [s.enemy, s.first_seen]),
    );
    const firstIntroducedEnemy = introOrder.reduce(
        (best, ord, enemy) =>
            ord > 0 && (best === -1 || ord < introOrder[best]) ? enemy : best,
        -1,
    );
    for (let enemy = 0; enemy < introOrder.length; enemy++) {
        if (introOrder[enemy] <= 0) continue;
        if (enemy === firstIntroducedEnemy) continue;
        const seen = firstSeenByEnemy.get(enemy);
        if (seen == null) continue;
        beats.push({
            time: seen,
            day: dayOf(seen, warStart),
            order: seq++,
            text: pickVariant(PHRASES.arrival, season, enemy + 1)(factionName(enemy)),
        });
    }

    // Cascades (collapse a failed-defend run into one beat; suppress its events).
    const cascades = findAllCascades(events);
    /** @type {Set<object>} */
    const cascadeEvents = new Set();
    for (const cascade of cascades) {
        for (const e of cascade.events) cascadeEvents.add(e);
        const reachedHome = cascade.regions[cascade.regions.length - 1] <= 0;
        const span = Math.max(1, Math.round(cascade.durationSec / SECONDS_PER_DAY));
        const dayPhrase = span === 1 ? 'in a single day' : `over ${span} days`;
        const home = reachedHome
            ? ' The breach reached the inner regions; the Ministry calls this a controlled withdrawal.'
            : '';
        beats.push({
            time: cascade.startTime,
            day: dayOf(cascade.startTime, warStart),
            order: seq++,
            text: pickVariant(PHRASES.cascade, season, cascade.startTime | 0)(
                factionName(cascade.factionIndex),
                cascade.length,
                dayPhrase,
                home,
            ),
        });
    }

    // Per-event field reports (excluding cascade-folded events).
    const sorted = [...events].sort((a, b) => (a.start_time ?? 0) - (b.start_time ?? 0));
    for (const e of sorted) {
        if (cascadeEvents.has(e)) continue;
        if (e.start_time == null) continue;
        const text = describeEvent(e, season);
        if (!text) continue;
        beats.push({ time: e.start_time, day: dayOf(e.start_time, warStart), order: seq++, text });
    }

    // NEW highlight beats (features 2-4) — each carries a `kind`.
    for (const pb of buildPlayerBeats(data?.playerTimeseries ?? [], season)) {
        beats.push({ ...pb, order: seq++ });
    }
    for (const cb of buildConquestBeats(data?.snapshots ?? [], data?.points_max ?? { points: [] }, season, warStart)) {
        beats.push({ ...cb, order: seq++ });
    }

    // Outcome (caps the chronicle) + the numbers beat just before it.
    const outcome = getWarOutcome(data);
    const lastTime = sorted.reduce(
        (m, e) => Math.max(m, e.end_time ?? e.start_time ?? warStart),
        warStart,
    );
    const lastDay = dayOf(lastTime, warStart);
    const numbers = buildNumbersBeat(telemetry, lastTime, lastDay, season);
    if (numbers) beats.push({ ...numbers, order: seq++ });
    if (outcome) {
        beats.push({ time: lastTime, day: lastDay, order: seq++, text: describeOutcome(outcome, season) });
    }

    beats.sort((a, b) => a.time - b.time || a.order - b.order);
    return coherenceGuard(beats).map(({ day, text }) => ({ day, text }));
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `mise exec -- npm run test:unit -- buildWarNarrative`
Expected: PASS (all four).

- [ ] **Step 5: Run the full unit suite (no regressions in other narrative/cascade tests)**

Run: `mise exec -- npm run test:unit`
Expected: all green. If any pre-existing `buildWarNarrative` test asserted exact old wording, update it to assert structure (`day`/`text` present, chronological) rather than fixed strings — variant 0 preserves the old text but the picker may select variant 1.

- [ ] **Step 6: Commit**

```bash
mise exec -- npm run lint:fix
git add src/features/archives/buildWarNarrative.mjs src/__tests__/unit/features/archives/buildWarNarrative.test.mjs
git commit -m "feat(archives): extend buildWarNarrative — generators + phrasing + guard"
```

---

### Task 7: server-side wiring + verification

**Files:**
- Modify: `src/app/archives/page.jsx` (after `const currentSeason = data.season;`, ~line 101)
- Modify: `src/features/archives/ArchivesClient.jsx` (signature ~line 73-80; NarrativeSection render line 199)
- Modify: `src/features/archives/NarrativeSection.jsx`

**Interfaces:**
- Consumes: `buildWarNarrative` (Task 6), `getSeasonTelemetryTotals` (Task 4).
- Produces: `ArchivesClient` gains a `narrativeBeats` prop; `NarrativeSection` takes `beats`.

- [ ] **Step 1: Compute beats on the server page**

In `src/app/archives/page.jsx`, add imports near the top (after line 4 `import { getCampaign } …`):

```js
import { getSeasonTelemetryTotals } from '@/db/queries/getSeasonTelemetryTotals.mjs';
import { buildWarNarrative } from '@/features/archives/buildWarNarrative.mjs';
```

Then, immediately after `const currentSeason = data.season;` (~line 101), add:

```js
    // War Narrative is computed server-side so getCampaign stays untouched and
    // no narrative logic ships to the client. Telemetry is archives-only and
    // null for pre-telemetry seasons.
    const { data: telemetry } = await tryCatch(getSeasonTelemetryTotals(resolvedSeason));
    const narrativeBeats = buildWarNarrative(data, telemetry ?? null);
```

And add the prop to the `<ArchivesClient …>` element (after `data={data}`):

```jsx
                data={data}
                narrativeBeats={narrativeBeats}
```

- [ ] **Step 2: Thread the prop through ArchivesClient**

In `src/features/archives/ArchivesClient.jsx`, add `narrativeBeats` to the destructured props (after `data,`):

```js
export default function ArchivesClient({
    data,
    narrativeBeats,
    seasons,
    currentSeason,
    isAdmin = false,
    initialFaction = 'global',
    initialSortOrder = 'desc',
    initialCascadeSort,
}) {
```

Change the NarrativeSection render (line 199) from `<NarrativeSection data={data} />` to:

```jsx
                <NarrativeSection beats={narrativeBeats} />
```

- [ ] **Step 3: Make NarrativeSection a dumb renderer**

Replace `src/features/archives/NarrativeSection.jsx` with:

```jsx
'use client';

import { useState } from 'react';
import Button from '@/shared/components/Button/Button';

/**
 * War Narrative — a collapsible, in-world chronicle of a season's campaign in
 * the Ministry of Truth's propaganda voice. The beats are computed server-side
 * (see buildWarNarrative + the archives page) and passed in; this component
 * only renders + toggles. Renders nothing when there is no narrative to tell.
 *
 * A primary (yellow-bordered, square) Button toggles the body, reading SHOW
 * when collapsed and HIDE when expanded.
 *
 * @param {object} props - Component props.
 * @param {Array<{ day:number, text:string }>} [props.beats] - Server-computed beats.
 * @param {boolean} [props.defaultOpen] - Whether the section starts expanded.
 */
export default function NarrativeSection({ beats, defaultOpen = false }) {
    const [open, setOpen] = useState(defaultOpen);
    if (!beats?.length) return null;

    return (
        <section className="mt-4 flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2">
                <h2 className="m-0">War Narrative</h2>
                <Button
                    variant="primary"
                    onClick={() => setOpen((o) => !o)}
                    aria-expanded={open}
                    data-umami-event="archive-narrative-toggle"
                >
                    {open ? 'HIDE' : 'SHOW'}
                </Button>
            </div>

            <p className="text-small text-text-muted">
                The official record of the campaign, as approved for citizen consumption
                by the Ministry of Truth.
            </p>

            {open && (
                <ol className="flex flex-col gap-2">
                    {beats.map((beat, i) => (
                        <li
                            key={i}
                            className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 border-l-4 border-ghost bg-surface-1 px-3 py-2"
                        >
                            <span className="font-mono text-small font-bold tracking-wide text-text-muted uppercase">
                                Day {beat.day}
                            </span>
                            <span className="text-body text-text">{beat.text}</span>
                        </li>
                    ))}
                </ol>
            )}
        </section>
    );
}
```

- [ ] **Step 4: Run the four gates (from the worktree, node 24)**

```bash
mise exec -- npm run lint
mise exec -- npm run typecheck
mise exec -- npm run test:unit
mise exec -- npm run build
```
Expected: all pass. (`build` needs `POSTGRES_URL`; if it fails only on that, supply a local `.env.local` from `.env.development` to confirm the code builds, then remove it — the gate is satisfied by CI's env.)

- [ ] **Step 5: DevTools verification** (dev server on a spare port from the worktree; CLAUDE.md requires DevTools checks for frontend changes — note: restart the dev server fresh, and verify against a season the DB actually has)

Confirm on `/archives?season=<season with a narrative>`:
  1. The War Narrative renders with beats; SHOW/HIDE still toggles; subtitle always visible.
  2. On a **telemetry season** (S157+, with archive data): a "By the numbers" beat appears near the end, and conquest/player beats interleave where the data warrants.
  3. On a **pre-telemetry season** (e.g. 155): narrative still renders (phrasing + conquest beats); no numbers/player beats; no error.
  4. No hydration warning in the console (determinism holds).
  5. The rest of `/archives` (cascade highlight, players-over-time, intro markers, event log) is unregressed.

- [ ] **Step 6: Commit**

```bash
mise exec -- npm run lint:fix
git add src/app/archives/page.jsx src/features/archives/ArchivesClient.jsx src/features/archives/NarrativeSection.jsx
git commit -m "feat(archives): wire server-computed war narrative beats into the page"
```

---

### Task 8: CHANGELOG

**Files:**
- Modify: `CHANGELOG.md`

- [ ] **Step 1: Add the entry**

At the top of `CHANGELOG.md`, above the latest `## X.Y.Z`, add a new `## Unreleased` section (it becomes `## X.Y.Z` at merge per the project Git workflow):

```markdown
## Unreleased

### Features

- **War Narrative enrichment on `/archives`**. The Ministry chronicle now varies
  its phrasing per season (deterministic, SSR-stable), and gains player
  surge/collapse beats, offensive conquest milestones (a faction driven to its
  homeworld's gates / the first homeworld to fall), and a "war by the numbers"
  telemetry beat. Computed server-side, so `getCampaign` and the rest of the app
  are untouched; telemetry-backed beats appear only for seasons with telemetry.
```

- [ ] **Step 2: Commit**

```bash
mise exec -- npm run lint:fix
git add CHANGELOG.md
git commit -m "docs(changelog): war narrative extension"
```

---

## Notes for the implementer

- **Determinism is non-negotiable.** Every variant pick goes through `pickVariant` (a pure hash of season + key). Do not introduce `Math.random`, `Date.now()`, or anything time-of-render dependent in the generators.
- **`points` is Super Earth's offensive progress** (high = SE winning) — see the spec's § Feature 3 note. `conquestBeats` reads it that way; do not reintroduce an "enemy pressure / darkest hour" reading.
- **Telemetry is cumulative** — `getSeasonTelemetryTotals` sums the *latest bucket per enemy*, never all buckets.
- **NarrativeSection stays `'use client'`** (the SHOW/HIDE button needs `useState`); it just no longer computes beats. The server page owns `buildWarNarrative`.
- **Beat `kind`** is internal (used only by the coherence guard); it is dropped in the final `{day,text}` map, so nothing downstream sees it.
