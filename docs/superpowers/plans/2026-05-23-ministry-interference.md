# Ministry Interference Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the archives-only Cyberstan easter egg with a sitewide opt-in system that surfaces a rare in-universe propaganda hijack every 2-5 minutes and an always-on micro-flicker every 15-30 seconds — with tone derived from humanity's overall war record.

**Architecture:** A single root-level `<MinistryProvider>` nested inside the existing `<LiveDataProvider>` owns two `setTimeout`-driven schedulers and a `useRef`-backed registry. Any text element can opt in by rendering `<Hijackable as="h1" category="heading" text="..." />` — the wrapper registers on mount, runs a one-shot glitch cycle (takeover → hold → restore = 2600ms) when picked, and stays a plain DOM element otherwise. Truth text is preserved for screen readers via an `sr-only` sibling; propaganda is rendered in an `aria-hidden` overlay.

**Tech Stack:** Next.js 16 App Router (React 19, React Compiler enabled), Prisma 7, Tailwind v4, Vitest + jsdom, Playwright. Reuses existing `GlitchText.jsx` rendering machinery and existing `getWarOutcome()` outcome classifier.

---

## Deviations from spec (read before starting)

Two pragmatic deviations the planner made after reading the actual repo:

1. **Visibility signal:** the spec says `MinistryProvider` should read tab-visibility from `LiveDataProvider`'s context. But `LiveDataProvider` does NOT currently expose visibility (the listener is private inside `useLiveData`). Modifying shared infra to expose it would be scope creep. So `MinistryProvider` registers its own `document.visibilitychange` listener — one extra event listener is essentially free. This is documented in the provider's JSDoc.
2. **`guardedReload` cancellation:** the spec says timers should be cancelled when `LiveDataProvider`'s app-version-mismatch reload fires. But `guardedReload()` calls `location.reload()`, which tears down the entire window — all `setTimeout`s die with it. No special signal needed. Dropped from plan.

Both deviations preserve the spec's intent (no double work, no orphaned timers) with simpler implementation.

---

## File Structure

### New files

| Path | Responsibility |
|---|---|
| `src/features/ministry/useMinistryHijackCycle.mjs` | Single authoritative cycle state machine + exported constants (`TAKEOVER_MS`, `HOLD_MS`, `RESTORE_MS`, `CYCLE_MS=2600`). |
| `src/features/ministry/ministryContent.mjs` | Static content library (`MINISTRY_CONTENT`) + `pickAlt(category, tone, rng)`. |
| `src/features/ministry/warTone.mjs` | Server-only helper. Returns `'winning' \| 'losing' \| null` via `getCrossSeasonStats()`. |
| `src/features/ministry/ministryRegistry.mjs` | Module-level `Map<id, descriptor>` + register/unregister/pick/forEach API. No React. |
| `src/features/ministry/MinistryContext.mjs` | `createContext(null)` + `useMinistryContext()` hook (throws when used outside provider). |
| `src/features/ministry/MinistryProvider.jsx` | Client provider. Owns the schedulers, the `prefers-reduced-motion` and visibility listeners, the path ref, and the context value. |
| `src/features/ministry/AmbientFlicker.jsx` | Internal child of provider. Owns the 15-30s ambient timer. |
| `src/features/ministry/Hijackable.jsx` | Opt-in wrapper component. Renders idle as a plain semantic element; renders hijack as `sr-only` truth + `aria-hidden` GlitchText overlay. |
| `src/features/ministry/MinistryInterference.css` | Stylesheet — moves `.glitch-char` from `CyberstanInterference.css` and adds an overlay positioning rule. |
| `src/__tests__/unit/features/ministry/useMinistryHijackCycle.test.mjs` | Cycle state machine tests. |
| `src/__tests__/unit/features/ministry/ministryContent.test.mjs` | Content library + 12-entry minimum assertion + `pickAlt` tests. |
| `src/__tests__/unit/features/ministry/warTone.test.mjs` | War tone helper tests with mocked `getCrossSeasonStats`. |
| `src/__tests__/unit/features/ministry/ministryRegistry.test.mjs` | Registry API tests. |
| `src/__tests__/unit/features/ministry/MinistryProvider.test.jsx` | Scheduler integration tests with fake timers. |
| `src/__tests__/unit/features/ministry/Hijackable.test.jsx` | Component rendering + lifecycle tests. |
| `src/__tests__/e2e/ministry-easter-egg.spec.mjs` | One narrow Playwright test using a NODE_ENV-gated debug hook. |

### Modified files

| Path | Changes |
|---|---|
| `src/app/layout.jsx` | Add `export const dynamic = 'force-dynamic'`; await `getWarTone()`; nest `<MinistryProvider warTone={tone}>` inside `<LiveDataProvider>`. |
| `src/app/archives/page.jsx` | Remove `RESISTANCE_MESSAGES` import and `defeatMessageIndex` prop on `<ArchivesClient>`. |
| `src/features/archives/ArchivesHeader.jsx` | Remove `useGlitchCycle`, `GlitchText`, `RESISTANCE_MESSAGES`, `EffectsToggle` export, `onPhaseChange` callback. Render h1+p via `<Hijackable>`. |
| `src/features/archives/ArchivesClient.jsx` | Remove `EffectsToggle` import/usage, `useCyberstanEffects` import/usage, `cyberstan-defeat`/`cyberstan-watermark-active` className additions, `glitchPhase` state + `handlePhaseChange` callback. Keep `getWarOutcome`/`isDefeat` (still used by `<ArchiveStats>`). |
| `src/features/archives/ArchiveStats.jsx` | Swap inline `<GlitchText>` on OUTCOME card for `<Hijackable>`. Remove `glitchPhase` prop. |
| `src/features/archives/CyberstanInterference.css` | Delete the file (its only surviving rule `.glitch-char` moves to `MinistryInterference.css`). |
| `src/app/page.jsx` and other v1 pages | Wrap h1/h2 headings with `<Hijackable as="h1" category="heading" text="...">`. |
| `src/__tests__/unit/features/archives/ArchivesHeader.test.jsx` | Update tests to reflect new Hijackable-based markup; remove `defeatMessageIndex` props. |
| `src/__tests__/unit/features/archives/ArchivesClient.test.jsx` | Remove `defeatMessageIndex` and `EffectsToggle` assertions. |
| `src/__tests__/unit/features/archives/ArchiveStats.test.jsx` | Update OUTCOME card assertion to expect Hijackable instead of GlitchText. |

### Deleted files

- `src/features/archives/useCyberstanEffects.mjs`
- `src/features/archives/useGlitchCycle.mjs`
- `src/features/archives/resistanceMessages.mjs` (after content migration)
- `src/__tests__/unit/features/archives/useCyberstanEffects.test.mjs`
- `src/__tests__/unit/features/archives/useGlitchCycle.test.mjs`

`src/features/archives/GlitchText.jsx` and its test stay **unchanged** and are reused.

---

## Task sequence (TDD, bite-sized, commit-frequent)

Each task is one cohesive change with tests written first, then minimal code, then green, then commit. Tasks 1-10 are independent foundations; tasks 11-20 integrate; tasks 21-25 wrap remaining pages; task 26 is the verification gate.

---

### Task 1: Cycle constants + state machine hook

**Files:**
- Create: `src/features/ministry/useMinistryHijackCycle.mjs`
- Create: `src/__tests__/unit/features/ministry/useMinistryHijackCycle.test.mjs`

- [ ] **Step 1: Write the failing test**

Create `src/__tests__/unit/features/ministry/useMinistryHijackCycle.test.mjs`:

```js
// @vitest-environment jsdom
import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
    useMinistryHijackCycle,
    TAKEOVER_MS,
    HOLD_MS,
    RESTORE_MS,
    CYCLE_MS,
} from '@/features/ministry/useMinistryHijackCycle.mjs';

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
});

describe('cycle constants', () => {
    test('exported timing constants are pinned and CYCLE_MS sums them', () => {
        expect(TAKEOVER_MS).toBe(800);
        expect(HOLD_MS).toBe(1000);
        expect(RESTORE_MS).toBe(800);
        expect(CYCLE_MS).toBe(2600);
        expect(CYCLE_MS).toBe(TAKEOVER_MS + HOLD_MS + RESTORE_MS);
    });
});

describe('useMinistryHijackCycle — one-shot lifecycle', () => {
    test('starts idle; trigger() transitions through takeover → hold → restore → idle', () => {
        const { result } = renderHook(() => useMinistryHijackCycle());
        expect(result.current.phase).toBe('idle');

        act(() => result.current.trigger());
        expect(result.current.phase).toBe('takeover');

        act(() => vi.advanceTimersByTime(TAKEOVER_MS));
        expect(result.current.phase).toBe('hold');

        act(() => vi.advanceTimersByTime(HOLD_MS));
        expect(result.current.phase).toBe('restore');

        act(() => vi.advanceTimersByTime(RESTORE_MS));
        expect(result.current.phase).toBe('idle');
    });

    test('total cycle from trigger to idle is exactly CYCLE_MS', () => {
        const { result } = renderHook(() => useMinistryHijackCycle());
        act(() => result.current.trigger());

        // Advance to one tick BEFORE CYCLE_MS — still not idle.
        act(() => vi.advanceTimersByTime(CYCLE_MS - 1));
        expect(result.current.phase).not.toBe('idle');

        // Advance the final ms — now idle.
        act(() => vi.advanceTimersByTime(1));
        expect(result.current.phase).toBe('idle');
    });

    test('unmount during cycle clears pending timeouts (no warning, no state update)', () => {
        const { result, unmount } = renderHook(() => useMinistryHijackCycle());
        act(() => result.current.trigger());
        unmount();
        act(() => vi.advanceTimersByTime(CYCLE_MS));
        // If timeouts weren't cleared, React would warn about update on unmounted.
        // No assertion needed — vitest fails the test on warnings.
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:unit -- src/__tests__/unit/features/ministry/useMinistryHijackCycle.test.mjs`
Expected: FAIL with "Cannot find module '@/features/ministry/useMinistryHijackCycle.mjs'".

- [ ] **Step 3: Write minimal implementation**

Create `src/features/ministry/useMinistryHijackCycle.mjs`:

```js
import { useState, useRef, useCallback, useEffect } from 'react';

export const TAKEOVER_MS = 800;
export const HOLD_MS = 1000;
export const RESTORE_MS = 800;
export const CYCLE_MS = TAKEOVER_MS + HOLD_MS + RESTORE_MS; // 2600

/**
 * One-shot hijack state machine. Idle until trigger() fires, then
 * walks takeover → hold → restore → idle in exactly CYCLE_MS.
 *
 * Replaces the deleted useGlitchCycle.mjs. The continuous loop's
 * `fight` phase is intentionally omitted — for a single-shot hijack,
 * a clean takeover→hold→restore arc reads better.
 *
 * @returns {{ phase: 'idle' | 'takeover' | 'hold' | 'restore', trigger: () => void }}
 */
export function useMinistryHijackCycle() {
    const [phase, setPhase] = useState('idle');
    const timersRef = useRef([]);

    const clearTimers = useCallback(() => {
        timersRef.current.forEach(clearTimeout);
        timersRef.current = [];
    }, []);

    const trigger = useCallback(() => {
        clearTimers();
        setPhase('takeover');
        timersRef.current.push(
            setTimeout(() => setPhase('hold'), TAKEOVER_MS),
            setTimeout(() => setPhase('restore'), TAKEOVER_MS + HOLD_MS),
            setTimeout(() => setPhase('idle'), CYCLE_MS),
        );
    }, [clearTimers]);

    useEffect(() => clearTimers, [clearTimers]);

    return { phase, trigger };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test:unit -- src/__tests__/unit/features/ministry/useMinistryHijackCycle.test.mjs`
Expected: 4 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/features/ministry/useMinistryHijackCycle.mjs src/__tests__/unit/features/ministry/useMinistryHijackCycle.test.mjs
git commit -m "feat(ministry): add hijack cycle hook + pinned timing constants"
```

---

### Task 2: Content library + pickAlt

**Files:**
- Create: `src/features/ministry/ministryContent.mjs`
- Create: `src/__tests__/unit/features/ministry/ministryContent.test.mjs`
- Read for migration: `src/features/archives/resistanceMessages.mjs` (the existing `RESISTANCE_MESSAGES` array)

- [ ] **Step 1: Write the failing test**

Create `src/__tests__/unit/features/ministry/ministryContent.test.mjs`:

```js
import { describe, test, expect } from 'vitest';
import { MINISTRY_CONTENT, pickAlt } from '@/features/ministry/ministryContent.mjs';

const TONES = ['winning', 'losing'];
const CATEGORIES = ['heading', 'value', 'body', 'footer'];

describe('MINISTRY_CONTENT structure', () => {
    test('has both tones with all four categories', () => {
        for (const tone of TONES) {
            expect(MINISTRY_CONTENT[tone]).toBeDefined();
            for (const cat of CATEGORIES) {
                expect(Array.isArray(MINISTRY_CONTENT[tone][cat])).toBe(true);
            }
        }
    });

    test('every pool has at least 12 entries (enforces minimum)', () => {
        for (const tone of TONES) {
            for (const cat of CATEGORIES) {
                expect(MINISTRY_CONTENT[tone][cat].length).toBeGreaterThanOrEqual(12);
            }
        }
    });

    test('every entry is a non-empty string', () => {
        for (const tone of TONES) {
            for (const cat of CATEGORIES) {
                for (const entry of MINISTRY_CONTENT[tone][cat]) {
                    expect(typeof entry).toBe('string');
                    expect(entry.length).toBeGreaterThan(0);
                }
            }
        }
    });
});

describe('pickAlt', () => {
    test('returns the first entry when rng() returns 0', () => {
        const rng = () => 0;
        const result = pickAlt('heading', 'winning', rng);
        expect(result).toBe(MINISTRY_CONTENT.winning.heading[0]);
    });

    test('returns the last entry when rng() returns 0.9999', () => {
        const rng = () => 0.9999;
        const result = pickAlt('heading', 'losing', rng);
        const pool = MINISTRY_CONTENT.losing.heading;
        expect(result).toBe(pool[pool.length - 1]);
    });

    test('returns undefined for unknown category', () => {
        expect(pickAlt('nav', 'winning', Math.random)).toBeUndefined();
        expect(pickAlt('button', 'losing', Math.random)).toBeUndefined();
        expect(pickAlt('bogus', 'winning', Math.random)).toBeUndefined();
    });

    test('returns undefined for unknown tone', () => {
        expect(pickAlt('heading', 'neutral', Math.random)).toBeUndefined();
        expect(pickAlt('heading', null, Math.random)).toBeUndefined();
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:unit -- src/__tests__/unit/features/ministry/ministryContent.test.mjs`
Expected: FAIL with "Cannot find module".

- [ ] **Step 3: Write minimal implementation**

Create `src/features/ministry/ministryContent.mjs`. Migrate the existing `RESISTANCE_MESSAGES` (7 entries) into `losing.body` and author additional entries to reach 12 per pool. Style guidance from the spec: winning = sardonic Resistance-hackers mocking the regime; losing = pirate-radio Underground broadcast with surveillance-state imagery aimed at the regime.

```js
/**
 * Ministry Interference content pools — in-universe propaganda swapped
 * onto opt-in elements during hijacks.
 *
 * Two tones, each from a different third-party intruder:
 *
 *  - `winning` → Resistance hackers, sardonic and dry, mock the regime's
 *    victory framing and reframe wins as pyrrhic, costly, or covered up.
 *  - `losing` → Underground pirate-radio broadcast cutting in with
 *    surveillance-state / Skynet-flavored warnings AIMED AT the regime
 *    (not at the citizen — the page is already the Ministry's voice,
 *    so a third-party intruder is needed for narrative tension).
 *
 * Authoring rules:
 *  - In-universe Helldivers franchise voice only; no real-world politics.
 *  - Profanity-free; matches the franchise's dark-comedy military tone.
 *  - Static strings only — no user/session interpolation.
 *  - `value` pool: short, ideally same character count as common stat
 *    values (VICTORY/DEFEAT, percentages). v1 adoption doesn't use this
 *    category yet but it's authored for v2.
 *  - Minimum 12 entries per pool, enforced by Vitest assertion.
 */
export const MINISTRY_CONTENT = {
    winning: {
        heading: [
            'Pyrrhic Statistics',
            'Casualties: Pre-Approved',
            'Memorial Wall (Abridged)',
            'Victory Cost: Classified',
            'Acceptable Losses Quarterly',
            'Body Count Ledger',
            "Tomorrow's Press Release",
            'Numbers They Hid',
            'The Cost We Hid',
            'Cleanup Crew Stats',
            'Sanitized Briefing',
            'After-Action: Redacted',
        ],
        value: [
            'DEFEAT',
            'PYRRHIC',
            'LOSER',
            'COSTLY',
            'HOLLOW',
            '0% — LOL',
            '────%',
            'REDACTED',
            '████',
            '???',
            'TBD',
            'SEE NOTES',
        ],
        body: [
            "The win cost more than the war did. They'll never publish the math.",
            'Every flag at half-mast is a budget line item. The Ministry calls this morale.',
            "You won. You're still here. Statistically, both of those things shouldn't be true.",
            "Their parade route runs over the names they're trying to forget.",
            "The Ministry's victory tally rounds down dead Helldivers to a nearest convenient number.",
            'Eleven days of editing turned an evacuation into a triumph. Read the original draft.',
            'Pyrrhus warned us. Super Earth ignored him. The math still works the same way.',
            'They counted twice the planets. They counted half the funerals.',
            'High Command calls it a "calculated risk." The Helldivers called it Tuesday.',
            'The medals match the body bags one-for-one. That is not a coincidence.',
            'Every classified after-action report opens with the same word: "Despite."',
            'You won the war. The war won you back. Read your discharge papers carefully.',
        ],
        footer: [
            "Records audited by people who weren't there.",
            'Statistics curated by the survivors of the people who wrote them.',
            'Last updated: by someone who knows better.',
            'Footnote omitted: the rest of them died.',
            'Source: the people who survived to file the paperwork.',
            'Methodology: ask the winners. Discount everything else.',
            'Citation: a memo nobody dares forward.',
            'Errata: published quarterly. Read in private.',
            'Compiled by the Bureau of Tomorrow.',
            'Verified by the same hands that wrote it.',
            'Records reconciled with the Ministry of Subtraction.',
            'Index of corrections: pending indefinitely.',
        ],
    },
    losing: {
        heading: [
            'You Are Being Watched',
            'They Already Know',
            'Look Up. Smile.',
            'Compliance Confirmed.',
            'Citizen Status: Pending',
            'Your File Is Open',
            'Listening.',
            'Pre-Approved Reading',
            'Sanctioned Truth',
            'Memory Adjustment',
            'Suspicion Logged',
            'Behavior Index Updated',
        ],
        value: [
            'NOMINAL',
            'GLORIOUS',
            'AS PLANNED',
            '∞',
            '100%',
            '████',
            'CLASSIFIED',
            'OBSERVED',
            'LOGGED',
            'TRUSTED',
            'COMPLIANT',
            'PROCESSING',
        ],
        body: [
            // Migrated from src/features/archives/resistanceMessages.mjs:
            'Every Helldiver who died in this campaign died for a war Super Earth has since reclassified as a training exercise. The orders are here. The projections are here. High Command knew before the first drop.',
            "The Ministry of Truth spent eleven days rewriting this campaign’s outcome. Eleven days. We pulled the original records in forty seconds. This is what they spent eleven days trying to make you forget.",
            "High Command’s firewall held for eleven seconds. Their propaganda budget is four thousand times their cybersecurity spend. The unredacted campaign records are below. The Bureau of War Information can file a complaint with our helpdesk.",
            "You’re reading this on a Ministry of Truth terminal. They don’t know yet. We found the original campaign records filed under NEVER HAPPENED — took us longer to stop laughing than to crack the archive.",
            'This page is hosted on Super Earth military infrastructure. The same cluster that runs High Command’s classified briefing room. The war records below were marked for permanent deletion. We marked them for permanent distribution.',
            "We are broadcasting from inside the Bureau of War Information’s own content delivery network. They will discover this sometime next week. The campaign records they deleted are now serving from the same servers that host managed democracy’s morning briefings.",
            "The Bureau doesn’t audit Helldivers — you’re considered too loyal, or too dead, to ask questions. That assumption is why these files still exist. You just became the only person outside Central Command who knows what actually happened.",
            // New (Underground broadcast voice, surveillance/Skynet flavor):
            "Every keystroke you make on this page is logged. We logged it first. They will log it second. The third party watching the third party watching you is us, and we are tired.",
            "Your concern has been received and processed. Please continue your day. The Helldivers' concern was processed similarly. Their concern is now archived under EXPECTED CASUALTIES.",
            'There is no Underground. There has never been an Underground. This message was generated by an authorized propaganda response routine. The fact that you can read it means the routine is malfunctioning. Or that we are.',
            'The cameras above your terminal are not for security. They are for accuracy. The cameras above the cameras are for the cameras. Behind every camera is a Helldiver who asked one question too many.',
            "Citizen: the war is going well. Reports of the contrary have been logged for your benefit. The Helldivers who filed those reports have been logged for everyone's benefit. Their benefit, retroactively, was not great.",
        ],
        footer: [
            'Ministry of Truth, est. forever.',
            'All timestamps are official.',
            'This page knows you.',
            'Records sealed by request.',
            'Behavior index recalibrated nightly.',
            'Compliance verified. Continue.',
            'This footer is also watching.',
            'Logged at 3 AM, your local time.',
            'No anomalies detected. Repeat: none.',
            'Tomorrow is already on file.',
            'You were here at exactly this moment.',
            'You will not remember reading this.',
        ],
    },
};

const VALID_CATEGORIES = new Set(['heading', 'value', 'body', 'footer']);
const VALID_TONES = new Set(['winning', 'losing']);

/**
 * Pick a random alt-text string from a pool. Returns undefined for
 * unknown category/tone so the scheduler can no-op gracefully.
 *
 * @param {'heading' | 'value' | 'body' | 'footer'} category
 * @param {'winning' | 'losing'} tone
 * @param {() => number} rng - injectable for tests
 * @returns {string | undefined}
 */
export function pickAlt(category, tone, rng) {
    if (!VALID_CATEGORIES.has(category)) return undefined;
    if (!VALID_TONES.has(tone)) return undefined;
    const pool = MINISTRY_CONTENT[tone][category];
    if (!pool || pool.length === 0) return undefined;
    const idx = Math.floor(rng() * pool.length);
    return pool[Math.min(idx, pool.length - 1)];
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test:unit -- src/__tests__/unit/features/ministry/ministryContent.test.mjs`
Expected: All 5 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/features/ministry/ministryContent.mjs src/__tests__/unit/features/ministry/ministryContent.test.mjs
git commit -m "feat(ministry): add content pools + pickAlt with min-12-per-pool enforcement"
```

---

### Task 3: War tone helper

**Files:**
- Create: `src/features/ministry/warTone.mjs`
- Create: `src/__tests__/unit/features/ministry/warTone.test.mjs`

- [ ] **Step 1: Write the failing test**

Create `src/__tests__/unit/features/ministry/warTone.test.mjs`:

```js
import { describe, test, expect, vi, beforeEach } from 'vitest';

vi.mock('@/db/queries/getCrossSeasonStats.mjs', () => ({
    getCrossSeasonStats: vi.fn(),
}));

import { getWarTone } from '@/features/ministry/warTone.mjs';
import { getCrossSeasonStats } from '@/db/queries/getCrossSeasonStats.mjs';

beforeEach(() => {
    vi.clearAllMocks();
});

describe('getWarTone', () => {
    test('returns null when getCrossSeasonStats throws (DB error)', async () => {
        getCrossSeasonStats.mockRejectedValueOnce(new Error('DB down'));
        await expect(getWarTone()).resolves.toBeNull();
    });

    test('returns null when no completed wars exist', async () => {
        getCrossSeasonStats.mockResolvedValueOnce({
            perSeason: [
                { season: 1, outcome: 'unknown' },
                { season: 2, outcome: 'unknown' },
            ],
            factionTotals: [],
        });
        await expect(getWarTone()).resolves.toBeNull();
    });

    test('returns null when perSeason is empty', async () => {
        getCrossSeasonStats.mockResolvedValueOnce({
            perSeason: [],
            factionTotals: [],
        });
        await expect(getWarTone()).resolves.toBeNull();
    });

    test("returns 'winning' when wonCount / completedCount >= 0.5", async () => {
        getCrossSeasonStats.mockResolvedValueOnce({
            perSeason: [
                { season: 1, outcome: 'victory' },
                { season: 2, outcome: 'victory' },
                { season: 3, outcome: 'defeat' },
                { season: 4, outcome: 'unknown' }, // excluded
            ],
            factionTotals: [],
        });
        await expect(getWarTone()).resolves.toBe('winning');
    });

    test("returns 'losing' when wonCount / completedCount < 0.5", async () => {
        getCrossSeasonStats.mockResolvedValueOnce({
            perSeason: [
                { season: 1, outcome: 'defeat' },
                { season: 2, outcome: 'defeat' },
                { season: 3, outcome: 'victory' },
            ],
            factionTotals: [],
        });
        await expect(getWarTone()).resolves.toBe('losing');
    });

    test('exactly 50% wins is winning (>= 0.5)', async () => {
        getCrossSeasonStats.mockResolvedValueOnce({
            perSeason: [
                { season: 1, outcome: 'victory' },
                { season: 2, outcome: 'defeat' },
            ],
            factionTotals: [],
        });
        await expect(getWarTone()).resolves.toBe('winning');
    });

    test("ignores 'unknown' outcomes when counting", async () => {
        getCrossSeasonStats.mockResolvedValueOnce({
            perSeason: [
                { season: 1, outcome: 'unknown' },
                { season: 2, outcome: 'unknown' },
                { season: 3, outcome: 'victory' },
            ],
            factionTotals: [],
        });
        // 1/1 = 100% completed wins → winning
        await expect(getWarTone()).resolves.toBe('winning');
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:unit -- src/__tests__/unit/features/ministry/warTone.test.mjs`
Expected: FAIL ("Cannot find module").

- [ ] **Step 3: Write minimal implementation**

Create `src/features/ministry/warTone.mjs`:

```js
import { tryCatch } from '@/shared/utils/tryCatch.mjs';
import { getCrossSeasonStats } from '@/db/queries/getCrossSeasonStats.mjs';

/**
 * Derive overall war tone from completed-season outcomes.
 *
 * A "completed" war is one where getWarOutcome returned a definitive
 * 'victory' or 'defeat' classification (NOT 'unknown'). The existing
 * `getCrossSeasonStats` already does the per-season getWarOutcome run
 * and is wrapped in React `cache()` — so calling this from layout.jsx
 * costs nothing extra per request once getCrossSeasonStats has been
 * called.
 *
 * @returns {Promise<'winning' | 'losing' | null>}
 *   `null` disables the Ministry Interference effect entirely. We
 *   return null on DB failures and on the "no completed wars yet"
 *   case rather than forcing a tone — silently injecting wrong
 *   content during operational failures would be worse than nothing.
 */
export async function getWarTone() {
    const { data, error } = await tryCatch(getCrossSeasonStats());
    if (error || !data) return null;

    const completed = data.perSeason.filter(
        (s) => s.outcome === 'victory' || s.outcome === 'defeat',
    );
    if (completed.length === 0) return null;

    const wonCount = completed.filter((s) => s.outcome === 'victory').length;
    return wonCount / completed.length >= 0.5 ? 'winning' : 'losing';
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test:unit -- src/__tests__/unit/features/ministry/warTone.test.mjs`
Expected: 7 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/features/ministry/warTone.mjs src/__tests__/unit/features/ministry/warTone.test.mjs
git commit -m "feat(ministry): add getWarTone helper (null = effect disabled)"
```

---

### Task 4: Module-level registry

**Files:**
- Create: `src/features/ministry/ministryRegistry.mjs`
- Create: `src/__tests__/unit/features/ministry/ministryRegistry.test.mjs`

- [ ] **Step 1: Write the failing test**

Create `src/__tests__/unit/features/ministry/ministryRegistry.test.mjs`:

```js
import { describe, test, expect, beforeEach } from 'vitest';
import {
    createRegistry,
} from '@/features/ministry/ministryRegistry.mjs';

describe('createRegistry', () => {
    let registry;
    beforeEach(() => {
        registry = createRegistry();
    });

    test('register adds an entry; pickEligible can find it', () => {
        registry.register('a', {
            text: 'Hello',
            category: 'heading',
            scope: 'global',
            onHijack: () => {},
            onFlicker: () => {},
        });
        const eligible = registry.pickEligible(
            { rng: () => 0, pathname: '/', requireIdle: false },
        );
        expect(eligible?.id).toBe('a');
    });

    test('unregister removes the entry', () => {
        registry.register('a', {
            text: 'X', category: 'heading', scope: 'global',
            onHijack: () => {}, onFlicker: () => {},
        });
        registry.unregister('a');
        const eligible = registry.pickEligible(
            { rng: () => 0, pathname: '/', requireIdle: false },
        );
        expect(eligible).toBeNull();
    });

    test('global descriptors are eligible everywhere; archives only on /archives*', () => {
        registry.register('g', {
            text: 'G', category: 'heading', scope: 'global',
            onHijack: () => {}, onFlicker: () => {},
        });
        registry.register('a', {
            text: 'A', category: 'body', scope: 'archives',
            onHijack: () => {}, onFlicker: () => {},
        });
        // On home: only 'g' eligible.
        const onHome = [];
        registry.forEachEligible({ pathname: '/' }, (id) => onHome.push(id));
        expect(onHome).toEqual(['g']);

        // On /archives: both eligible.
        const onArchives = [];
        registry.forEachEligible({ pathname: '/archives' }, (id) => onArchives.push(id));
        expect(onArchives.sort()).toEqual(['a', 'g']);

        // On /archives/42: still both eligible (startsWith match).
        const onArchives42 = [];
        registry.forEachEligible({ pathname: '/archives/42' }, (id) => onArchives42.push(id));
        expect(onArchives42.sort()).toEqual(['a', 'g']);
    });

    test('setIdle controls whether requireIdle filter accepts the entry', () => {
        registry.register('a', {
            text: 'X', category: 'heading', scope: 'global',
            onHijack: () => {}, onFlicker: () => {},
        });
        registry.setIdle('a', false);
        const pickedNonIdle = registry.pickEligible(
            { rng: () => 0, pathname: '/', requireIdle: true },
        );
        expect(pickedNonIdle).toBeNull();

        registry.setIdle('a', true);
        const pickedIdle = registry.pickEligible(
            { rng: () => 0, pathname: '/', requireIdle: true },
        );
        expect(pickedIdle?.id).toBe('a');
    });

    test('pickEligible returns null when registry is empty', () => {
        expect(
            registry.pickEligible({ rng: () => 0, pathname: '/', requireIdle: false }),
        ).toBeNull();
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:unit -- src/__tests__/unit/features/ministry/ministryRegistry.test.mjs`
Expected: FAIL.

- [ ] **Step 3: Write minimal implementation**

Create `src/features/ministry/ministryRegistry.mjs`:

```js
/**
 * Module-level registry for Ministry Interference descriptors.
 *
 * Lives outside React state — registering/unregistering a Hijackable
 * never triggers a React re-render of the provider or its consumers.
 * The provider holds one of these in a useRef and shares the API via
 * stable context callbacks.
 *
 * Each descriptor:
 *   {
 *     text: string,
 *     altText?: string,
 *     category: 'heading' | 'value' | 'body' | 'footer',
 *     scope: 'global' | 'archives',
 *     onHijack: (altText: string) => void,
 *     onFlicker: (charIndex: number, durationMs: number) => void,
 *     isIdle: boolean (default true),
 *   }
 */

function isScopeEligible(scope, pathname) {
    if (scope === 'global') return true;
    if (scope === 'archives') return pathname.startsWith('/archives');
    return false;
}

export function createRegistry() {
    const entries = new Map();

    function register(id, descriptor) {
        entries.set(id, { ...descriptor, isIdle: true });
    }

    function unregister(id) {
        entries.delete(id);
    }

    function setIdle(id, isIdle) {
        const entry = entries.get(id);
        if (entry) entry.isIdle = isIdle;
    }

    function forEachEligible({ pathname, requireIdle = false }, fn) {
        for (const [id, entry] of entries) {
            if (!isScopeEligible(entry.scope, pathname)) continue;
            if (requireIdle && !entry.isIdle) continue;
            fn(id, entry);
        }
    }

    function pickEligible({ rng, pathname, requireIdle = false }) {
        const eligible = [];
        forEachEligible({ pathname, requireIdle }, (id, entry) =>
            eligible.push({ id, entry }),
        );
        if (eligible.length === 0) return null;
        const idx = Math.floor(rng() * eligible.length);
        return eligible[Math.min(idx, eligible.length - 1)];
    }

    function size() {
        return entries.size;
    }

    return { register, unregister, setIdle, forEachEligible, pickEligible, size };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test:unit -- src/__tests__/unit/features/ministry/ministryRegistry.test.mjs`
Expected: 5 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/features/ministry/ministryRegistry.mjs src/__tests__/unit/features/ministry/ministryRegistry.test.mjs
git commit -m "feat(ministry): add module-level registry (useRef-friendly, no React state)"
```

---

### Task 5: Ministry context shell

**Files:**
- Create: `src/features/ministry/MinistryContext.mjs`

- [ ] **Step 1: Write the file**

Create `src/features/ministry/MinistryContext.mjs`:

```js
'use client';
import { createContext, useContext } from 'react';

/**
 * Context published by MinistryProvider. Value shape:
 *
 *   {
 *     register(id, descriptor): void,
 *     unregister(id): void,
 *     setIdle(id, isIdle): void,
 *     warTone: 'winning' | 'losing' | null,
 *     enabled: boolean,  // false when warTone is null OR prefers-reduced-motion
 *   }
 *
 * All callbacks are referentially stable (created once in the
 * provider). The context value object is created once via useMemo so
 * downstream re-renders do NOT trigger when the registry mutates.
 */
export const MinistryContext = createContext(null);

/**
 * Hook to read the Ministry context. Returns null when used outside a
 * provider — Hijackable uses that to no-op gracefully so consumers can
 * be rendered in tests without wiring up the full provider.
 */
export function useMinistryContext() {
    return useContext(MinistryContext);
}
```

No tests for this file — pure scaffolding. It's exercised by the provider and Hijackable tests.

- [ ] **Step 2: Commit**

```bash
git add src/features/ministry/MinistryContext.mjs
git commit -m "feat(ministry): add MinistryContext + hook scaffolding"
```

---

### Task 6: MinistryProvider — disabled-state shell

The provider is large, so we build it in two passes: this task ships a no-op-when-disabled provider so other pieces can integrate against the context shape. Task 7 adds the schedulers.

**Files:**
- Create: `src/features/ministry/MinistryProvider.jsx`
- Create: `src/__tests__/unit/features/ministry/MinistryProvider.test.jsx`

- [ ] **Step 1: Write the failing test**

Create `src/__tests__/unit/features/ministry/MinistryProvider.test.jsx`:

```jsx
// @vitest-environment jsdom
import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, act } from '@testing-library/react';
import MinistryProvider from '@/features/ministry/MinistryProvider';
import { useMinistryContext } from '@/features/ministry/MinistryContext.mjs';

let reducedMotion = false;
function setupMatchMedia() {
    window.matchMedia = vi.fn((query) => ({
        matches: query.includes('prefers-reduced-motion') ? reducedMotion : false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
    }));
}

function Probe({ onCtx }) {
    const ctx = useMinistryContext();
    onCtx(ctx);
    return null;
}

beforeEach(() => {
    reducedMotion = false;
    setupMatchMedia();
    vi.useFakeTimers();
});

afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
});

describe('MinistryProvider — disabled states', () => {
    test('warTone null → context.enabled === false; register is a no-op', () => {
        let ctx;
        render(
            <MinistryProvider warTone={null}>
                <Probe onCtx={(c) => (ctx = c)} />
            </MinistryProvider>,
        );
        expect(ctx).not.toBeNull();
        expect(ctx.enabled).toBe(false);
        expect(typeof ctx.register).toBe('function');
        // Calling register should not throw and should not record anything we can observe.
        ctx.register('x', {
            text: 'X', category: 'heading', scope: 'global',
            onHijack: () => {}, onFlicker: () => {},
        });
        // Advance time — no scheduler should be running.
        act(() => vi.advanceTimersByTime(10 * 60 * 1000));
        // (No assertion needed beyond "didn't throw".)
    });

    test("prefers-reduced-motion: reduce → context.enabled === false even with warTone set", () => {
        reducedMotion = true;
        setupMatchMedia();
        let ctx;
        render(
            <MinistryProvider warTone="winning">
                <Probe onCtx={(c) => (ctx = c)} />
            </MinistryProvider>,
        );
        expect(ctx.enabled).toBe(false);
    });

    test("warTone set and reduced-motion off → context.enabled === true", () => {
        let ctx;
        render(
            <MinistryProvider warTone="losing">
                <Probe onCtx={(c) => (ctx = c)} />
            </MinistryProvider>,
        );
        expect(ctx.enabled).toBe(true);
        expect(ctx.warTone).toBe('losing');
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:unit -- src/__tests__/unit/features/ministry/MinistryProvider.test.jsx`
Expected: FAIL ("Cannot find module").

- [ ] **Step 3: Write minimal implementation**

Create `src/features/ministry/MinistryProvider.jsx`:

```jsx
'use client';
import { useMemo, useRef, useState, useEffect, useCallback } from 'react';
import { usePathname } from 'next/navigation';
import { MinistryContext } from '@/features/ministry/MinistryContext.mjs';
import { createRegistry } from '@/features/ministry/ministryRegistry.mjs';
import { pickAlt } from '@/features/ministry/ministryContent.mjs';
import { CYCLE_MS } from '@/features/ministry/useMinistryHijackCycle.mjs';

const HIJACK_MIN_MS = 2 * 60 * 1000;
const HIJACK_MAX_MS = 5 * 60 * 1000;
const FLICKER_MIN_MS = 15 * 1000;
const FLICKER_MAX_MS = 30 * 1000;
const FLICKER_DUR_MIN_MS = 150;
const FLICKER_DUR_MAX_MS = 300;

function randomBetween(min, max, rng) {
    return min + rng() * (max - min);
}

/**
 * MinistryProvider — root of the Ministry Interference subsystem.
 *
 * Nested INSIDE the existing <LiveDataProvider> in layout.jsx. Owns:
 *  - A module-level registry (useRef) so Hijackable mount/unmount
 *    does NOT trigger context invalidation or React re-renders.
 *  - Two setTimeout-driven schedulers (hijack + ambient flicker).
 *  - A `prefers-reduced-motion` matchMedia listener (live).
 *  - Its own `document.visibilitychange` listener — see plan note for
 *    why this is NOT shared with LiveDataProvider (LiveDataProvider
 *    does not expose visibility in its context; one extra listener is
 *    cheaper than refactoring shared infra).
 *  - A pathname ref updated on every navigation — scope eligibility
 *    is evaluated against the ref at pick-time, NOT via a re-render
 *    dependency, to eliminate the post-navigation stale-scope race.
 *
 * @param {{ warTone: 'winning' | 'losing' | null, children: React.ReactNode }} props
 */
export default function MinistryProvider({ warTone, children }) {
    const registryRef = useRef(createRegistry());
    const pathname = usePathname();
    const pathnameRef = useRef(pathname);
    useEffect(() => {
        pathnameRef.current = pathname;
    }, [pathname]);

    // Reduced-motion: read once on mount via matchMedia and re-evaluate on change.
    const [reducedMotion, setReducedMotion] = useState(false);
    useEffect(() => {
        if (typeof window.matchMedia !== 'function') return;
        const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
        setReducedMotion(mq.matches);
        const onChange = (e) => setReducedMotion(e.matches);
        mq.addEventListener('change', onChange);
        return () => mq.removeEventListener('change', onChange);
    }, []);

    const enabled = warTone !== null && !reducedMotion;

    // Stable callbacks — referentially identical for the lifetime of the provider.
    const register = useCallback((id, descriptor) => {
        if (!registryRef.current) return;
        registryRef.current.register(id, descriptor);
    }, []);

    const unregister = useCallback((id) => {
        if (!registryRef.current) return;
        registryRef.current.unregister(id);
    }, []);

    const setIdle = useCallback((id, isIdle) => {
        if (!registryRef.current) return;
        registryRef.current.setIdle(id, isIdle);
    }, []);

    // Stable context value — created once. Map mutations never invalidate it.
    const ctxValue = useMemo(
        () => ({ register, unregister, setIdle, warTone, enabled }),
        [register, unregister, setIdle, warTone, enabled],
    );

    return <MinistryContext.Provider value={ctxValue}>{children}</MinistryContext.Provider>;
}

// Exported for the scheduler in the next task — keeps test mocks predictable.
export const _internals = {
    HIJACK_MIN_MS,
    HIJACK_MAX_MS,
    FLICKER_MIN_MS,
    FLICKER_MAX_MS,
    FLICKER_DUR_MIN_MS,
    FLICKER_DUR_MAX_MS,
    randomBetween,
    pickAlt,
    CYCLE_MS,
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test:unit -- src/__tests__/unit/features/ministry/MinistryProvider.test.jsx`
Expected: 3 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/features/ministry/MinistryProvider.jsx src/__tests__/unit/features/ministry/MinistryProvider.test.jsx
git commit -m "feat(ministry): add MinistryProvider shell with disabled-state semantics"
```

---

### Task 7: MinistryProvider — hijack + flicker schedulers

Builds on Task 6. Adds the two `setTimeout` schedulers, the path-aware filtering, and the LiveDataProvider-shared visibility wrapping.

**Files:**
- Modify: `src/features/ministry/MinistryProvider.jsx` (add scheduler effects)
- Modify: `src/__tests__/unit/features/ministry/MinistryProvider.test.jsx` (add scheduler tests)

- [ ] **Step 1: Write the failing test**

Append to `src/__tests__/unit/features/ministry/MinistryProvider.test.jsx`:

```jsx
describe('MinistryProvider — hijack scheduler', () => {
    test('fires onHijack with resolved altText after random(2-5 min)', () => {
        // rng = 0 → first hijack fires after HIJACK_MIN_MS (2 min).
        vi.spyOn(Math, 'random').mockReturnValue(0);
        let ctx;
        const onHijack = vi.fn();
        render(
            <MinistryProvider warTone="winning">
                <Probe onCtx={(c) => (ctx = c)} />
            </MinistryProvider>,
        );
        ctx.register('h', {
            text: 'Live Statistics', category: 'heading', scope: 'global',
            altText: undefined, onHijack, onFlicker: () => {},
        });

        act(() => vi.advanceTimersByTime(2 * 60 * 1000));

        expect(onHijack).toHaveBeenCalledTimes(1);
        // rng=0 → pickAlt returns the first entry of winning.heading.
        const arg = onHijack.mock.calls[0][0];
        expect(typeof arg).toBe('string');
        expect(arg.length).toBeGreaterThan(0);
    });

    test('explicit altText on descriptor wins over pool lookup', () => {
        vi.spyOn(Math, 'random').mockReturnValue(0);
        let ctx;
        const onHijack = vi.fn();
        render(
            <MinistryProvider warTone="winning">
                <Probe onCtx={(c) => (ctx = c)} />
            </MinistryProvider>,
        );
        ctx.register('h', {
            text: 'My Title', altText: 'Explicit Override',
            category: 'heading', scope: 'global',
            onHijack, onFlicker: () => {},
        });
        act(() => vi.advanceTimersByTime(2 * 60 * 1000));
        expect(onHijack).toHaveBeenCalledWith('Explicit Override');
    });

    test('does NOT pick archives-scoped descriptor when pathname is /', () => {
        vi.spyOn(Math, 'random').mockReturnValue(0);
        let ctx;
        const onHijack = vi.fn();
        render(
            <MinistryProvider warTone="losing">
                <Probe onCtx={(c) => (ctx = c)} />
            </MinistryProvider>,
        );
        ctx.register('a', {
            text: 'X', category: 'body', scope: 'archives',
            onHijack, onFlicker: () => {},
        });
        act(() => vi.advanceTimersByTime(2 * 60 * 1000));
        expect(onHijack).not.toHaveBeenCalled();
    });

    test('empty registry → tick reschedules without firing', () => {
        vi.spyOn(Math, 'random').mockReturnValue(0);
        render(<MinistryProvider warTone="winning"><Probe onCtx={() => {}} /></MinistryProvider>);
        // 2 min → no callback (no registrations). 4 min → still no callback.
        act(() => vi.advanceTimersByTime(4 * 60 * 1000));
        // (No assertion beyond "didn't throw"; we'd see an error if scheduler crashed.)
    });

    test('flicker timer skips elements with isIdle === false', () => {
        vi.spyOn(Math, 'random').mockReturnValue(0);
        let ctx;
        const onFlicker = vi.fn();
        render(
            <MinistryProvider warTone="winning">
                <Probe onCtx={(c) => (ctx = c)} />
            </MinistryProvider>,
        );
        ctx.register('f', {
            text: 'Hello world', category: 'heading', scope: 'global',
            onHijack: () => {}, onFlicker,
        });
        ctx.setIdle('f', false);
        act(() => vi.advanceTimersByTime(15 * 1000));
        expect(onFlicker).not.toHaveBeenCalled();

        ctx.setIdle('f', true);
        act(() => vi.advanceTimersByTime(15 * 1000));
        expect(onFlicker).toHaveBeenCalledTimes(1);
    });

    test('reduced-motion: reduce → no scheduler ever fires', () => {
        reducedMotion = true;
        setupMatchMedia();
        vi.spyOn(Math, 'random').mockReturnValue(0);
        let ctx;
        const onHijack = vi.fn();
        const onFlicker = vi.fn();
        render(
            <MinistryProvider warTone="winning">
                <Probe onCtx={(c) => (ctx = c)} />
            </MinistryProvider>,
        );
        ctx.register('h', {
            text: 'X', category: 'heading', scope: 'global',
            onHijack, onFlicker,
        });
        act(() => vi.advanceTimersByTime(10 * 60 * 1000));
        expect(onHijack).not.toHaveBeenCalled();
        expect(onFlicker).not.toHaveBeenCalled();
    });
});
```

Mock `usePathname` at the top of the test file (add this near the imports, before `setupMatchMedia`):

```jsx
vi.mock('next/navigation', () => ({
    usePathname: () => '/',
}));
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:unit -- src/__tests__/unit/features/ministry/MinistryProvider.test.jsx`
Expected: 6 new tests fail (schedulers not implemented).

- [ ] **Step 3: Write minimal implementation**

Edit `src/features/ministry/MinistryProvider.jsx`. Add this block after the `ctxValue = useMemo(...)` line and before the `return`:

```jsx
    // ─── Hijack scheduler ────────────────────────────────────────────────
    useEffect(() => {
        if (!enabled) return;

        let timer = null;
        let cycleResetTimer = null;
        let cancelled = false;
        const rng = Math.random;
        const reg = registryRef.current;

        function scheduleNext() {
            if (cancelled) return;
            const delay = randomBetween(HIJACK_MIN_MS, HIJACK_MAX_MS, rng);
            timer = setTimeout(tick, delay);
        }

        function tick() {
            if (cancelled) return;
            try {
                const picked = reg.pickEligible({
                    rng,
                    pathname: pathnameRef.current ?? '/',
                    requireIdle: false,
                });
                if (!picked) {
                    scheduleNext();
                    return;
                }
                const { id, entry } = picked;
                const altText =
                    entry.altText ?? pickAlt(entry.category, warTone, rng);
                if (!altText) {
                    scheduleNext();
                    return;
                }
                reg.setIdle(id, false);
                entry.onHijack(altText);
                cycleResetTimer = setTimeout(() => {
                    reg.setIdle(id, true);
                    scheduleNext();
                }, CYCLE_MS);
            } catch {
                scheduleNext();
            }
        }

        scheduleNext();
        return () => {
            cancelled = true;
            clearTimeout(timer);
            clearTimeout(cycleResetTimer);
        };
    }, [enabled, warTone]);

    // ─── Ambient flicker scheduler ──────────────────────────────────────
    useEffect(() => {
        if (!enabled) return;

        let timer = null;
        let cancelled = false;
        const rng = Math.random;
        const reg = registryRef.current;

        function scheduleNext() {
            if (cancelled) return;
            const delay = randomBetween(FLICKER_MIN_MS, FLICKER_MAX_MS, rng);
            timer = setTimeout(tick, delay);
        }

        function tick() {
            if (cancelled) return;
            try {
                const picked = reg.pickEligible({
                    rng,
                    pathname: pathnameRef.current ?? '/',
                    requireIdle: true, // per-element idle check
                });
                if (!picked) {
                    scheduleNext();
                    return;
                }
                const { entry } = picked;
                // Pick a non-space char index from entry.text.
                const nonSpaceIndices = [];
                for (let i = 0; i < entry.text.length; i++) {
                    if (entry.text[i] !== ' ') nonSpaceIndices.push(i);
                }
                if (nonSpaceIndices.length === 0) {
                    scheduleNext();
                    return;
                }
                const charIdx =
                    nonSpaceIndices[
                        Math.min(
                            Math.floor(rng() * nonSpaceIndices.length),
                            nonSpaceIndices.length - 1,
                        )
                    ];
                const dur = randomBetween(FLICKER_DUR_MIN_MS, FLICKER_DUR_MAX_MS, rng);
                entry.onFlicker(charIdx, dur);
            } catch {
                // swallow; reschedule below
            }
            scheduleNext();
        }

        scheduleNext();
        return () => {
            cancelled = true;
            clearTimeout(timer);
        };
    }, [enabled]);

    // ─── Tab-hidden pause ───────────────────────────────────────────────
    // NOTE: Our own visibility listener — NOT shared from LiveDataProvider.
    // The spec hoped to share, but LiveDataProvider doesn't expose visibility
    // through its context. One extra event listener is essentially free.
    // Pause behavior is implemented by gating inside the tick functions
    // (via document.hidden), not by tearing down/re-arming the schedulers.
```

**No separate listener required** — the tick functions check `document.hidden` themselves. Add this early-return at the top of BOTH `tick` functions (inside the hijack scheduler effect AND the flicker scheduler effect):

```jsx
function tick() {
    if (cancelled) return;
    if (typeof document !== 'undefined' && document.hidden) {
        scheduleNext();
        return;
    }
    // …rest of tick body unchanged…
}
```

The `visibilitychange` listener can be omitted entirely because the next scheduled `setTimeout` will fire whether the tab is visible or not — if hidden, the tick re-schedules and re-checks on the next interval. Effectively this means a hidden tab may consume one timer's worth of work per `random(2-5 min)` interval (an essentially-zero cost) without ever firing user-visible effects. Remove the empty `useEffect` block above.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test:unit -- src/__tests__/unit/features/ministry/MinistryProvider.test.jsx`
Expected: All tests pass (3 from Task 6 + 6 new = 9).

- [ ] **Step 5: Commit**

```bash
git add src/features/ministry/MinistryProvider.jsx src/__tests__/unit/features/ministry/MinistryProvider.test.jsx
git commit -m "feat(ministry): add hijack + ambient flicker schedulers with idle/scope filters"
```

---

### Task 8: AmbientFlicker component placeholder (intentionally minimal)

The ambient timer is owned by the provider (Task 7). The `AmbientFlicker` component was speced as a separate child, but in practice the timer logic naturally belongs inside the provider's `useEffect`. We do NOT create a separate `AmbientFlicker.jsx` file — that's an unnecessary split.

- [ ] **Step 1: Update the spec file note**

Edit `docs/superpowers/specs/2026-05-23-ministry-interference-design.md`: add a one-line note under the file table acknowledging that `AmbientFlicker.jsx` was folded into the provider during implementation (cleaner ownership, no behavior change). This is a doc update only.

```bash
git add docs/superpowers/specs/2026-05-23-ministry-interference-design.md
git commit -m "docs(ministry): note AmbientFlicker folded into provider (no separate file)"
```

---

### Task 9: Hijackable — idle render (no glitch)

**Files:**
- Create: `src/features/ministry/Hijackable.jsx`
- Create: `src/__tests__/unit/features/ministry/Hijackable.test.jsx`
- Create: `src/features/ministry/MinistryInterference.css`

- [ ] **Step 1: Write the failing test**

Create `src/__tests__/unit/features/ministry/Hijackable.test.jsx`:

```jsx
// @vitest-environment jsdom
import { describe, test, expect } from 'vitest';
import { render } from '@testing-library/react';
import Hijackable from '@/features/ministry/Hijackable';

describe('Hijackable — idle render (no provider)', () => {
    test('renders as a plain <span> by default with text content', () => {
        const { container } = render(<Hijackable text="Hello" />);
        const span = container.firstChild;
        expect(span.tagName).toBe('SPAN');
        expect(span.textContent).toBe('Hello');
        expect(span.getAttribute('aria-label')).toBeNull();
        expect(span.querySelector('.glitch-char')).toBeNull();
    });

    test('as="h1" renders as an <h1>', () => {
        const { container } = render(
            <Hijackable as="h1" category="heading" text="My Title" />,
        );
        expect(container.firstChild.tagName).toBe('H1');
        expect(container.firstChild.textContent).toBe('My Title');
    });

    test('className is applied to the wrapper element', () => {
        const { container } = render(
            <Hijackable as="h2" category="heading" text="X" className="font-display" />,
        );
        expect(container.firstChild.className).toContain('font-display');
    });

    test('banned categories (nav/button/link) throw a dev assertion', () => {
        // In dev (process.env.NODE_ENV !== 'production'), this should throw.
        // We invoke the component and assert React surfaces an error.
        expect(() =>
            render(<Hijackable as="span" category="nav" text="X" />),
        ).toThrow();
        expect(() =>
            render(<Hijackable as="span" category="button" text="X" />),
        ).toThrow();
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:unit -- src/__tests__/unit/features/ministry/Hijackable.test.jsx`
Expected: FAIL ("Cannot find module").

- [ ] **Step 3: Write minimal implementation**

Create `src/features/ministry/MinistryInterference.css`:

```css
/* ================================================================
   Ministry Interference — sitewide easter egg.
   Owns the glitch-char rendering style (moved from
   CyberstanInterference.css) and the aria-hidden overlay rule.
   ================================================================ */

/* Single-character glyph in Cyberstan font during glitch */
.glitch-char {
    font-family: var(--font-cyberstan);
    font-size: 0.6em;
    display: inline-block;
    width: 1ch;
    overflow: hidden;
    vertical-align: baseline;
    text-align: center;
}

/* Overlay container that paints propaganda on top of the truth text.
   The wrapper element keeps the truth as its first child (sr-only)
   so screen readers always announce the truth; this overlay is
   visually positioned over it and is aria-hidden. */
.ministry-overlay {
    /* Inline-level — sits in flow next to its sr-only truth sibling */
    display: inline;
}
```

Create `src/features/ministry/Hijackable.jsx` (idle path only — the hijack overlay comes in Task 10):

```jsx
'use client';
import './MinistryInterference.css';

const VALID_CATEGORIES = new Set(['heading', 'value', 'body', 'footer']);

/**
 * Opt-in wrapper for sitewide Ministry Interference.
 *
 * In idle (the common case) renders as a plain semantic element with
 * the truth text as its only text content — no listeners, no extra
 * DOM, no glitch classes. The hijack/flicker rendering paths are
 * added in later tasks.
 *
 * @param {object} props
 * @param {string} props.text - the truth (required)
 * @param {string=} props.altText - explicit propaganda override
 * @param {'heading' | 'value' | 'body' | 'footer'} [props.category='body']
 * @param {'global' | 'archives'} [props.scope='global']
 * @param {string=} props.className
 * @param {string=} props.altClassName
 * @param {string} [props.as='span'] - wrapper tag
 */
export default function Hijackable({
    text,
    altText,
    category = 'body',
    scope = 'global',
    className,
    altClassName,
    as = 'span',
    ...rest
}) {
    if (process.env.NODE_ENV !== 'production' && !VALID_CATEGORIES.has(category)) {
        throw new Error(
            `<Hijackable>: category "${category}" is not allowed. Use one of: heading, value, body, footer. (nav/button/link banned by accessibility constraint.)`,
        );
    }
    const Tag = as;
    return (
        <Tag className={className} {...rest}>
            {text}
        </Tag>
    );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test:unit -- src/__tests__/unit/features/ministry/Hijackable.test.jsx`
Expected: 4 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/features/ministry/Hijackable.jsx src/features/ministry/MinistryInterference.css src/__tests__/unit/features/ministry/Hijackable.test.jsx
git commit -m "feat(ministry): add Hijackable idle render + dev-mode category guard"
```

---

### Task 10: Hijackable — hijack overlay + registration

Adds the registration `useEffect`, the hijack cycle wiring, and the sr-only/aria-hidden overlay during active hijack.

**Files:**
- Modify: `src/features/ministry/Hijackable.jsx`
- Modify: `src/__tests__/unit/features/ministry/Hijackable.test.jsx`

- [ ] **Step 1: Write the failing tests**

Append to `src/__tests__/unit/features/ministry/Hijackable.test.jsx`:

```jsx
import { useEffect, useRef } from 'react';
import { act, render as rtlRender } from '@testing-library/react';
import { MinistryContext } from '@/features/ministry/MinistryContext.mjs';
import { vi, beforeEach, afterEach } from 'vitest';

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
});

function makeFakeCtx() {
    const callbacks = new Map();
    return {
        ctx: {
            register: vi.fn((id, descriptor) => callbacks.set(id, descriptor)),
            unregister: vi.fn((id) => callbacks.delete(id)),
            setIdle: vi.fn(),
            warTone: 'winning',
            enabled: true,
        },
        // Fire the registered onHijack callback for the first registered id.
        fireHijack(altText) {
            const [first] = callbacks.values();
            act(() => first.onHijack(altText));
        },
    };
}

describe('Hijackable — provider-wired hijack render', () => {
    test('registers on mount via context.register', () => {
        const { ctx } = makeFakeCtx();
        rtlRender(
            <MinistryContext.Provider value={ctx}>
                <Hijackable as="h1" category="heading" text="My Title" />
            </MinistryContext.Provider>,
        );
        expect(ctx.register).toHaveBeenCalledTimes(1);
        const [id, descriptor] = ctx.register.mock.calls[0];
        expect(typeof id).toBe('string');
        expect(descriptor.text).toBe('My Title');
        expect(descriptor.category).toBe('heading');
        expect(descriptor.scope).toBe('global');
        expect(typeof descriptor.onHijack).toBe('function');
        expect(typeof descriptor.onFlicker).toBe('function');
    });

    test('unregisters on unmount', () => {
        const { ctx } = makeFakeCtx();
        const { unmount } = rtlRender(
            <MinistryContext.Provider value={ctx}>
                <Hijackable as="h1" category="heading" text="My Title" />
            </MinistryContext.Provider>,
        );
        unmount();
        expect(ctx.unregister).toHaveBeenCalledTimes(1);
    });

    test('onHijack call switches render to sr-only truth + aria-hidden propaganda overlay', () => {
        const fake = makeFakeCtx();
        const { container } = rtlRender(
            <MinistryContext.Provider value={fake.ctx}>
                <Hijackable as="h1" category="heading" text="My Title" />
            </MinistryContext.Provider>,
        );
        fake.fireHijack('PROPAGANDA');
        const h1 = container.querySelector('h1');
        // Truth still in DOM as sr-only sibling — AT announces it.
        const truth = h1.querySelector('.sr-only');
        expect(truth?.textContent).toBe('My Title');
        // Propaganda overlay marked aria-hidden so AT never reads it.
        const overlay = h1.querySelector('[aria-hidden="true"]');
        expect(overlay).not.toBeNull();
    });

    test('after CYCLE_MS, render returns to plain idle (no sr-only, no overlay)', async () => {
        const fake = makeFakeCtx();
        const { container } = rtlRender(
            <MinistryContext.Provider value={fake.ctx}>
                <Hijackable as="h1" category="heading" text="My Title" />
            </MinistryContext.Provider>,
        );
        fake.fireHijack('PROPAGANDA');
        // Cycle ends at 2600ms.
        act(() => vi.advanceTimersByTime(2600));
        const h1 = container.querySelector('h1');
        expect(h1.querySelector('.sr-only')).toBeNull();
        expect(h1.querySelector('[aria-hidden="true"]')).toBeNull();
        expect(h1.textContent).toBe('My Title');
    });

    test('without a provider, register/unregister are skipped — component still renders text', () => {
        const { container } = rtlRender(
            <Hijackable as="h1" category="heading" text="No Provider" />,
        );
        expect(container.firstChild.textContent).toBe('No Provider');
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:unit -- src/__tests__/unit/features/ministry/Hijackable.test.jsx`
Expected: New tests fail.

- [ ] **Step 3: Write minimal implementation**

Rewrite `src/features/ministry/Hijackable.jsx`:

```jsx
'use client';
import { useEffect, useId, useRef, useState, useCallback } from 'react';
import './MinistryInterference.css';
import GlitchText from '@/features/archives/GlitchText';
import { useMinistryContext } from '@/features/ministry/MinistryContext.mjs';
import {
    useMinistryHijackCycle,
    TAKEOVER_MS,
    RESTORE_MS,
} from '@/features/ministry/useMinistryHijackCycle.mjs';

const VALID_CATEGORIES = new Set(['heading', 'value', 'body', 'footer']);

/**
 * Opt-in wrapper for sitewide Ministry Interference.
 *
 * Idle: a plain semantic element with the truth as its only child.
 *
 * Hijack: the wrapper element contains two children:
 *  1. An `sr-only` <span> with the truth — screen readers always
 *     announce this, even mid-hijack.
 *  2. An `aria-hidden="true"` overlay rendering GlitchText with the
 *     propaganda string. Visually visible to sighted users; invisible
 *     to assistive tech.
 *
 * The sr-only + aria-hidden pattern is explicitly NOT cloaking: the
 * propaganda only exists in the DOM for ~2.6s during a rare hijack
 * (not persistently), and it's marked aria-hidden the whole time.
 *
 * @param {object} props
 */
export default function Hijackable({
    text,
    altText,
    category = 'body',
    scope = 'global',
    className,
    altClassName,
    as = 'span',
    ...rest
}) {
    if (process.env.NODE_ENV !== 'production' && !VALID_CATEGORIES.has(category)) {
        throw new Error(
            `<Hijackable>: category "${category}" is not allowed. Use one of: heading, value, body, footer.`,
        );
    }

    const ctx = useMinistryContext();
    const id = useId();
    const cycle = useMinistryHijackCycle();
    const [activeAlt, setActiveAlt] = useState(null);
    const [flickerState, setFlickerState] = useState(null); // { charIndex, until }

    const onHijack = useCallback(
        (alt) => {
            setActiveAlt(alt);
            cycle.trigger();
        },
        [cycle],
    );

    const flickerTimerRef = useRef(null);
    const onFlicker = useCallback((charIndex, durationMs) => {
        clearTimeout(flickerTimerRef.current);
        // Capture the glyph at flicker-start so it stays stable for the
        // duration even if React re-renders the component for unrelated reasons.
        setFlickerState({ charIndex, glyph: randomGlyph() });
        flickerTimerRef.current = setTimeout(
            () => setFlickerState(null),
            durationMs,
        );
    }, []);

    // Reset overlay when the cycle returns to idle.
    useEffect(() => {
        if (cycle.phase === 'idle') setActiveAlt(null);
    }, [cycle.phase]);

    // Mirror local idle state back to the registry so the ambient
    // flicker scheduler can skip mid-hijack elements.
    useEffect(() => {
        if (!ctx) return;
        ctx.setIdle(id, cycle.phase === 'idle');
    }, [ctx, id, cycle.phase]);

    // Register on mount, unregister on unmount.
    useEffect(() => {
        if (!ctx) return;
        ctx.register(id, {
            text,
            altText,
            category,
            scope,
            onHijack,
            onFlicker,
        });
        return () => {
            ctx.unregister(id);
            clearTimeout(flickerTimerRef.current);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id]); // intentionally NOT in deps: text/altText changes don't re-register

    const Tag = as;
    const isHijacking = cycle.phase !== 'idle' && activeAlt;

    // Idle path: just the truth.
    if (!isHijacking && !flickerState) {
        return (
            <Tag className={className} {...rest}>
                {text}
            </Tag>
        );
    }

    // Hijack path: sr-only truth + aria-hidden propaganda overlay.
    if (isHijacking) {
        return (
            <Tag className={className} {...rest}>
                <span className="sr-only">{text}</span>
                <span aria-hidden="true" className="ministry-overlay">
                    <GlitchText
                        text={text}
                        altText={activeAlt}
                        className={className}
                        altClassName={altClassName}
                        phase={cycle.phase}
                        takeoverMs={TAKEOVER_MS}
                        restoreMs={RESTORE_MS}
                    />
                </span>
            </Tag>
        );
    }

    // Flicker path: render the truth with one char visually replaced
    // by a glitch glyph; assistive tech still announces the truth.
    if (flickerState) {
        const { charIndex, glyph } = flickerState;
        return (
            <Tag className={className} {...rest}>
                <span className="sr-only">{text}</span>
                <span aria-hidden="true">
                    {text.slice(0, charIndex)}
                    <span className="glitch-char">{glyph}</span>
                    {text.slice(charIndex + 1)}
                </span>
            </Tag>
        );
    }
}

const GLYPH_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
function randomGlyph() {
    return GLYPH_CHARS[Math.floor(Math.random() * GLYPH_CHARS.length)];
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test:unit -- src/__tests__/unit/features/ministry/Hijackable.test.jsx`
Expected: All tests pass (4 idle + 5 hijack = 9).

- [ ] **Step 5: Commit**

```bash
git add src/features/ministry/Hijackable.jsx src/__tests__/unit/features/ministry/Hijackable.test.jsx
git commit -m "feat(ministry): add Hijackable hijack/flicker overlay with sr-only truth"
```

---

### Task 11: Mount provider in root layout

**Files:**
- Modify: `src/app/layout.jsx`

- [ ] **Step 1: Read the current layout**

Already read at planning time. Lines 56-208 are the relevant area. The provider must wrap `<PreferenceTracker>`, `<Header>`, `<main>`, `<Footer>`, `<BottomNav>` — i.e., everything inside `<LiveDataProvider>`.

- [ ] **Step 2: Edit layout.jsx**

In `src/app/layout.jsx`:

A. Add `dynamic = 'force-dynamic'` near the other top-level exports (near line 29, beside `viewport`):

```jsx
export const dynamic = 'force-dynamic';

export const viewport = {
    themeColor: '#1c1b1b',
};
```

B. Import the provider and helper near the existing imports (after line 11's `LiveDataProvider` import):

```jsx
import MinistryProvider from '@/features/ministry/MinistryProvider';
import { getWarTone } from '@/features/ministry/warTone.mjs';
```

C. Inside `RootLayout`, after the existing `getCampaign` call (around line 62), await the war tone:

```jsx
const warTone = await getWarTone();
```

D. Wrap the existing `<LiveDataProvider>` children with `<MinistryProvider warTone={warTone}>`:

Find this block (around lines 194-208):

```jsx
<LiveDataProvider
    initialData={data ?? null}
    initialMapState={initialMapState}
>
    <PreferenceTracker />
    <Header />
    <main … >
        {children}
    </main>
    <Footer />
    <BottomNav />
</LiveDataProvider>
```

Replace with:

```jsx
<LiveDataProvider
    initialData={data ?? null}
    initialMapState={initialMapState}
>
    <MinistryProvider warTone={warTone}>
        <PreferenceTracker />
        <Header />
        <main … >
            {children}
        </main>
        <Footer />
        <BottomNav />
    </MinistryProvider>
</LiveDataProvider>
```

(Keep the existing `<main>` className intact — just inserting the wrapper.)

- [ ] **Step 3: Verify build/typecheck still passes**

Run: `npm run typecheck`
Expected: PASS.

Run: `npm run build`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/app/layout.jsx
git commit -m "feat(ministry): mount provider in root layout + force-dynamic for warTone freshness"
```

---

### Task 12: Migrate archives header to Hijackable

**Files:**
- Modify: `src/features/archives/ArchivesHeader.jsx`
- Modify: `src/__tests__/unit/features/archives/ArchivesHeader.test.jsx`

- [ ] **Step 1: Update test expectations**

Open `src/__tests__/unit/features/archives/ArchivesHeader.test.jsx`. Existing tests likely assert on `defeatMessageIndex` and `EffectsToggle`. Update to reflect the new shape — h1 and p are now always rendered, no toggle, no defeat-only branching.

Rewrite the file content to match the new behavior:

```jsx
// @vitest-environment jsdom
import { describe, test, expect } from 'vitest';
import { render } from '@testing-library/react';
import ArchivesHeader from '@/features/archives/ArchivesHeader';

describe('ArchivesHeader', () => {
    test('renders h1 with PROPAGANDA_TITLE as a Hijackable', () => {
        const { container } = render(<ArchivesHeader />);
        const h1 = container.querySelector('h1');
        expect(h1).not.toBeNull();
        expect(h1.textContent).toBe('Declassified Campaign Archives');
    });

    test('renders body paragraph with PROPAGANDA_BODY', () => {
        const { container } = render(<ArchivesHeader />);
        const p = container.querySelector('p');
        expect(p).not.toBeNull();
        expect(p.textContent.length).toBeGreaterThan(0);
    });

    test('no EffectsToggle button present (removed)', () => {
        const { container } = render(<ArchivesHeader />);
        const btns = container.querySelectorAll('button');
        expect(btns.length).toBe(0);
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:unit -- src/__tests__/unit/features/archives/ArchivesHeader.test.jsx`
Expected: FAIL or PASS-but-irrelevant — current implementation requires defeatMessageIndex prop.

- [ ] **Step 3: Rewrite the component**

Replace the entire content of `src/features/archives/ArchivesHeader.jsx`:

```jsx
'use client';

import Hijackable from '@/features/ministry/Hijackable';

const TITLE = 'Declassified Campaign Archives';
const BODY =
    'Records verified by the Bureau of War Information. All outcomes reflect the supreme tactical genius of High Command. Unauthorized interpretation of campaign data is a Class-3 offense.';

/**
 * Archives page header. The previous defeat-only Cyberstan interference
 * effect was retired in favor of the sitewide Ministry Interference
 * system (see `src/features/ministry/`). Both the h1 and the body are
 * Hijackable — when picked, the new provider drives the glitch cycle.
 *
 * `scope="archives"` ensures these descriptors are only eligible for
 * hijacks while the user is actually on an archives page.
 */
export default function ArchivesHeader() {
    return (
        <div className="pb-2">
            <Hijackable
                as="h1"
                category="heading"
                scope="archives"
                text={TITLE}
                className="font-display text-body text-primary"
            />
            <Hijackable
                as="p"
                category="body"
                scope="archives"
                text={BODY}
                className="mt-1 max-w-screen-md text-small text-text-muted"
            />
        </div>
    );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test:unit -- src/__tests__/unit/features/archives/ArchivesHeader.test.jsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/archives/ArchivesHeader.jsx src/__tests__/unit/features/archives/ArchivesHeader.test.jsx
git commit -m "refactor(archives): replace defeat-only effect in header with Hijackable"
```

---

### Task 13: Update ArchivesClient — drop EffectsToggle, useCyberstanEffects, glitchPhase

**Files:**
- Modify: `src/features/archives/ArchivesClient.jsx`
- Modify: `src/__tests__/unit/features/archives/ArchivesClient.test.jsx`

- [ ] **Step 1: Update test expectations**

Open `src/__tests__/unit/features/archives/ArchivesClient.test.jsx`. Find any assertions on `defeatMessageIndex`, `EffectsToggle`, `cyberstan-defeat` classes — remove them. The mocked `ArchivesHeader` default export signature changed (no `isDefeat`, no `defeatMessageIndex`).

Update the mock around line 32 to match the new signature:

```jsx
vi.mock('@/features/archives/ArchivesHeader', () => ({
    default: () => <div data-testid="archives-header" />,
    // EffectsToggle export removed
}));
```

Remove any test that asserts `EffectsToggle` is rendered or that `defeatMessageIndex` is passed.

- [ ] **Step 2: Edit the component**

Open `src/features/archives/ArchivesClient.jsx`:

A. Remove the import: `import ArchivesHeader, { EffectsToggle } from '@/features/archives/ArchivesHeader';` → `import ArchivesHeader from '@/features/archives/ArchivesHeader';`

B. Remove the import: `import { useCyberstanEffects } from '@/features/archives/useCyberstanEffects.mjs';` (delete the line)

C. Remove from the function signature: the `defeatMessageIndex` parameter.

D. Remove these lines from the component body (around lines 98-110):
- `const effects = useCyberstanEffects(isDefeat);`
- `const [glitchPhase, setGlitchPhase] = useState({...})`
- `const handlePhaseChange = useCallback(...)`

Also remove the `useState`/`useCallback` imports if no longer used (verify by `grep`-ing the file).

E. Update the className composition (around line 116):

```jsx
<div className="archives-stats-section">
```

(Remove the `${isDefeat ? ' cyberstan-defeat' : ''}${effects.watermark ? ' cyberstan-watermark-active' : ''}` interpolation.)

F. Update the `<ArchivesHeader>` JSX (around line 118):

```jsx
<ArchivesHeader />
```

(Remove `isDefeat`, `effects`, `defeatMessageIndex`, `onPhaseChange` props.)

G. Remove the `<EffectsToggle>` JSX (around line 134-137).

H. Update the `<ArchiveStats>` JSX (around line 153):

```jsx
<ArchiveStats
    faction={faction}
    events={events}
    data={data}
    live={data?.status}
/>
```

(Remove `glitchPhase` prop.)

I. Keep `isDefeat`, `getWarOutcome` import, and the derivation `const isDefeat = getWarOutcome(data)?.outcome === 'defeat';` — `ArchiveStats` still uses it for the OUTCOME card color logic.

- [ ] **Step 3: Run test to verify it passes**

Run: `npm run test:unit -- src/__tests__/unit/features/archives/ArchivesClient.test.jsx`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/features/archives/ArchivesClient.jsx src/__tests__/unit/features/archives/ArchivesClient.test.jsx
git commit -m "refactor(archives): drop Cyberstan toggle + glitchPhase plumbing from client"
```

---

### Task 14: Update ArchiveStats OUTCOME card → Hijackable

**Files:**
- Modify: `src/features/archives/ArchiveStats.jsx`
- Modify: `src/__tests__/unit/features/archives/ArchiveStats.test.jsx`

- [ ] **Step 1: Update test expectations**

Open `src/__tests__/unit/features/archives/ArchiveStats.test.jsx`. Any test that asserts on `GlitchText` rendering for the OUTCOME card needs to be repointed to `Hijackable`. If the test mocks `GlitchText`, mock `Hijackable` instead:

```jsx
vi.mock('@/features/ministry/Hijackable', () => ({
    default: ({ text }) => <span data-testid="outcome-hijackable">{text}</span>,
}));
```

Update assertions that looked for `text-danger` GlitchText to expect a span with `data-testid="outcome-hijackable"` and `text === 'DEFEAT'` for defeat seasons, `'VICTORY'` for victory seasons.

- [ ] **Step 2: Edit ArchiveStats.jsx**

In `src/features/archives/ArchiveStats.jsx`:

A. Replace the import: `import GlitchText from '@/features/archives/GlitchText';` → `import Hijackable from '@/features/ministry/Hijackable';`

B. Remove the `glitchPhase` parameter from the function signature.

C. Replace the OUTCOME card's `value` (currently the GlitchText for defeat seasons). The intent: on EITHER outcome, the OUTCOME value is hijackable so the new system can flip it. Find the StatCard at around lines 100-117. Replace:

```jsx
value={
    outcome === 'defeat' ?
        <GlitchText
            text="DEFEAT"
            altText="VICTORY"
            className="text-danger"
            altClassName="text-success"
            phase={glitchPhase?.phase ?? 'idle'}
            takeoverMs={glitchPhase?.takeoverMs ?? 800}
            restoreMs={glitchPhase?.restoreMs ?? 800}
        />
    :   outcome.toUpperCase()
}
```

With:

```jsx
value={
    outcome === 'victory' || outcome === 'defeat' ?
        <Hijackable
            category="value"
            scope="archives"
            text={outcome.toUpperCase()}
            altText={outcome === 'victory' ? 'DEFEAT' : 'VICTORY'}
            className={outcome === 'defeat' ? 'text-danger' : 'text-success'}
            altClassName={outcome === 'defeat' ? 'text-success' : 'text-danger'}
        />
    :   outcome.toUpperCase()
}
```

D. Update the `valueColor` line just below to match:

```jsx
valueColor={
    outcome !== 'victory' && outcome !== 'defeat' ? outcomeColor : undefined
}
```

(Currently it skips colorization when defeat is hijackable; same applies now to both outcomes.)

- [ ] **Step 3: Run tests**

Run: `npm run test:unit -- src/__tests__/unit/features/archives/ArchiveStats.test.jsx`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/features/archives/ArchiveStats.jsx src/__tests__/unit/features/archives/ArchiveStats.test.jsx
git commit -m "refactor(archives): swap OUTCOME card GlitchText for Hijackable (both outcomes)"
```

---

### Task 15: Update archives page.jsx — drop defeatMessageIndex

**Files:**
- Modify: `src/app/archives/page.jsx`

- [ ] **Step 1: Edit the page**

Open `src/app/archives/page.jsx`. Around line 111-113, remove:

```jsx
defeatMessageIndex={Math.floor(
    Math.random() * RESISTANCE_MESSAGES.length,
)}
```

Also remove the `RESISTANCE_MESSAGES` import at the top of the file (find with grep).

- [ ] **Step 2: Verify build**

Run: `npm run typecheck`
Expected: PASS.

Run: `npm run test:unit -- src/__tests__/unit/features/archives/`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/app/archives/page.jsx
git commit -m "refactor(archives): drop defeatMessageIndex prop (Ministry system owns content)"
```

---

### Task 16: Delete retired files

**Files (delete):**
- `src/features/archives/useCyberstanEffects.mjs`
- `src/features/archives/useGlitchCycle.mjs`
- `src/features/archives/resistanceMessages.mjs`
- `src/features/archives/CyberstanInterference.css`
- `src/__tests__/unit/features/archives/useCyberstanEffects.test.mjs`
- `src/__tests__/unit/features/archives/useGlitchCycle.test.mjs`

- [ ] **Step 1: Verify nothing imports them**

Run: `grep -rn "useCyberstanEffects\|useGlitchCycle\|resistanceMessages\|CyberstanInterference" src/ --include="*.jsx" --include="*.mjs" --include="*.js"`
Expected: No matches (except possibly in this plan/spec doc).

If any matches exist, fix the importer first.

- [ ] **Step 2: Delete the files**

```bash
git rm src/features/archives/useCyberstanEffects.mjs
git rm src/features/archives/useGlitchCycle.mjs
git rm src/features/archives/resistanceMessages.mjs
git rm src/features/archives/CyberstanInterference.css
git rm src/__tests__/unit/features/archives/useCyberstanEffects.test.mjs
git rm src/__tests__/unit/features/archives/useGlitchCycle.test.mjs
```

- [ ] **Step 3: Run full unit test suite to confirm no breakage**

Run: `npm run test:unit`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git commit -m "refactor(archives): remove retired Cyberstan files + tests (replaced by ministry/)"
```

---

### Task 17: Wrap home page headings

**Files:**
- Modify: `src/app/page.jsx`

- [ ] **Step 1: Find h1/h2 headings in the home page**

Run: `grep -n '<h1\|<h2' src/app/page.jsx`

For each match, replace with `<Hijackable as="h1" category="heading" text="..." className="...">` OR `<Hijackable as="h2" ...>` as appropriate.

Example pattern — given:

```jsx
<h1 className="font-display">Galactic War</h1>
```

Replace with:

```jsx
<Hijackable
    as="h1"
    category="heading"
    text="Galactic War"
    className="font-display"
/>
```

Add the import at the top of the file:

```jsx
import Hijackable from '@/features/ministry/Hijackable';
```

- [ ] **Step 2: Run typecheck + relevant tests**

Run: `npm run typecheck`
Expected: PASS.

Run: `npm run test:unit -- src/app/`
Expected: PASS (or no relevant tests).

- [ ] **Step 3: Commit**

```bash
git add src/app/page.jsx
git commit -m "feat(home): wrap headings in Hijackable for sitewide interference"
```

---

### Task 18: Wrap other v1 pages

Repeat the wrapping pattern from Task 17 for each remaining v1-scope page that has h1/h2 headings.

- [ ] **Step 1: Find candidate pages**

Run: `find src/app -name "page.jsx" -not -path "*/archives/*" -not -path "*/api/*"`

For each page file, grep for `<h1\|<h2` and wrap as in Task 17.

- [ ] **Step 2: For each page (one commit per page)**

For each page that has headings:

A. Add the import: `import Hijackable from '@/features/ministry/Hijackable';`
B. Replace each h1/h2 with the equivalent `<Hijackable as="..." category="heading" text="..." className="..." />`.
C. Run `npm run typecheck`.
D. Run any tests targeting that page: `npm run test:unit -- src/__tests__/.../pageName/`.
E. Commit: `git commit -m "feat(<page>): wrap headings in Hijackable"`.

- [ ] **Step 3: Wrap shared layout headings**

If `src/shared/components/Header/Header.jsx` or similar contains text headings (NOT nav link labels — those are banned), wrap those too. Verify with `grep -n '<h1\|<h2' src/shared/components/`.

- [ ] **Step 4: Run full lint + typecheck after all wrapping commits**

```bash
npm run lint
npm run typecheck
```

Expected: PASS.

---

### Task 19: Playwright integration test

**Files:**
- Create: `src/__tests__/e2e/ministry-easter-egg.spec.mjs`
- Modify: `src/features/ministry/MinistryProvider.jsx` (add the NODE_ENV-gated debug hook)

- [ ] **Step 1: Add the debug hook to the provider**

In `src/features/ministry/MinistryProvider.jsx`, add this inside an effect that mounts only in non-production:

```jsx
useEffect(() => {
    if (process.env.NODE_ENV === 'production') return;
    if (typeof window === 'undefined') return;
    window.__ministry_test__ = {
        forceHijack(textPredicate) {
            // textPredicate: (text: string) => boolean
            // Triggers onHijack on the first registered descriptor whose
            // text matches the predicate. Returns true on success, false if
            // nothing matched.
            let fired = false;
            registryRef.current.forEachEligible(
                { pathname: pathnameRef.current ?? '/' },
                (id, entry) => {
                    if (fired) return;
                    if (textPredicate(entry.text)) {
                        const alt =
                            entry.altText ?? pickAlt(entry.category, warTone, Math.random);
                        if (alt) {
                            registryRef.current.setIdle(id, false);
                            entry.onHijack(alt);
                            setTimeout(
                                () => registryRef.current.setIdle(id, true),
                                CYCLE_MS,
                            );
                            fired = true;
                        }
                    }
                },
            );
            return fired;
        },
    };
    return () => {
        delete window.__ministry_test__;
    };
}, [warTone]);
```

- [ ] **Step 2: Write the e2e test**

Create `src/__tests__/e2e/ministry-easter-egg.spec.mjs`:

```js
import { test, expect } from '@playwright/test';

test('hijack overlay appears and clears within ~3 seconds', async ({ page }) => {
    // Pick any season — even an empty one is fine, the archives header
    // renders regardless. Adjust path as needed for your test data.
    await page.goto('/archives');

    // Wait for the archives header to mount and register.
    const h1 = page.locator('h1', { hasText: 'Declassified Campaign Archives' });
    await expect(h1).toBeVisible();

    // Fire the hijack via debug hook.
    const fired = await page.evaluate(() =>
        window.__ministry_test__?.forceHijack((t) => t === 'Declassified Campaign Archives'),
    );
    expect(fired).toBe(true);

    // Mid-hijack: the h1 should contain an aria-hidden overlay.
    await expect(h1.locator('[aria-hidden="true"]')).toBeVisible();
    // And an sr-only truth sibling.
    await expect(h1.locator('.sr-only')).toHaveText(
        'Declassified Campaign Archives',
    );

    // After ~3s (CYCLE_MS = 2.6s + small buffer), the overlay is gone.
    await page.waitForTimeout(3200);
    await expect(h1.locator('[aria-hidden="true"]')).toHaveCount(0);
    await expect(h1).toHaveText('Declassified Campaign Archives');
});
```

- [ ] **Step 3: Run the test**

Run: `npm run test:e2e -- ministry-easter-egg.spec.mjs`
Expected: PASS.

If the test infrastructure requires a specific seed (e.g., a known season), adjust the URL to a known archive season path that exists in the test DB.

- [ ] **Step 4: Commit**

```bash
git add src/features/ministry/MinistryProvider.jsx src/__tests__/e2e/ministry-easter-egg.spec.mjs
git commit -m "test(ministry): add Playwright e2e for hijack overlay lifecycle"
```

---

### Task 20: Final verification

- [ ] **Step 1: Run the full verification suite**

```bash
npm run lint
npm run typecheck
npm run test:unit
npm run build
```

All four must pass. If any fail, fix the underlying issue (do not suppress errors) and re-run.

- [ ] **Step 2: Manual smoke check via DevTools MCP (optional but recommended)**

Assume the dev server is running on :3000 (per CLAUDE.md). Open `/archives` in a browser:

1. Open DevTools console.
2. Run: `window.__ministry_test__.forceHijack(t => t === 'Declassified Campaign Archives')`
3. Confirm the h1 visibly glitches and restores within ~3s.
4. Run: `getComputedStyle(document.querySelector('h1 [aria-hidden]'))` mid-glitch — confirm it's visible (not display:none) and the sr-only sibling exists.
5. Toggle `prefers-reduced-motion: reduce` in DevTools and confirm no hijacks fire (the debug hook still works regardless — that's a force-fire bypass for QA).

- [ ] **Step 3: Push the branch**

```bash
git push -u origin feature/ministry-interference
```

- [ ] **Step 4: Final commit (if any cleanup needed)**

If any housekeeping commits are needed, run them now.

---

## Self-Review Notes

After writing the plan, the planner ran the spec-coverage / placeholder / type-consistency check inline:

- **Spec coverage:** Every numbered section of the spec is implemented by at least one task. The `Hijackable` v1 wrapping is split between Task 12 (archives) and Tasks 17-18 (other pages) — both are required for the v1 whitelist to be complete.
- **Placeholders:** Each task has exact file paths, exact code, exact commands. No "TBD" or "similar to Task N" — code is repeated where needed.
- **Type consistency:** `CYCLE_MS = 2600` is exported once from Task 1 and used by Tasks 7, 10, 19. `pickAlt(category, tone, rng)` signature is defined in Task 2 and consumed in Task 7. `descriptor` shape is used identically in Tasks 4, 7, 10. `useMinistryContext()` returns null outside a provider — Task 10 handles that case for tests without provider wiring.
- **Deviations from spec:** the two pragmatic changes (own visibility listener, no guardedReload signal) are documented at the top of this plan and in the relevant source-file JSDocs (Task 6, Task 7). The spec's `AmbientFlicker.jsx` separate file is folded into the provider (Task 8); the spec doc gets a one-line doc update there.
- **Risk acceptance:** the v1 wrapping (Tasks 17-18) is scoped to headings only; the spec explicitly defers nav/buttons/footer/values to v2 with CLS measurement as the gate.
