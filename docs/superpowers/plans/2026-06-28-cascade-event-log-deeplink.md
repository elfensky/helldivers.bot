# Cascade → Event Log Deep-Linking Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Clicking a cascade card in `/archives` pins a persistent faction-tinted highlight across every event in that cascade and scrolls the event log to it, hash-driven so the view is shareable.

**Architecture:** A new `useCascadeHighlight(cascades, railRef)` hook owns the highlight `Set` and the scroll. Two entry points feed one `pinCascade(cascade)`: the cascade card's `onClick` (same-page) and a mount/`hashchange`/`popstate` effect that resolves `location.hash` via a new pure `findCascadeByEventKey` helper (direct/external loads, back/forward). Scrolling is an explicit `scrollIntoView` on the topmost-in-DOM highlighted card (sort-agnostic); the highlight is a separate visual layer (wrapper `data-highlighted` + `data-faction` → CSS tint) decoupled from the existing scroll-driven `isSelected`.

**Tech Stack:** Next.js 16 (App Router), React 19 (client components), Vitest + React Testing Library (jsdom), Tailwind v4 + component CSS, JSDoc-typed JS (`checkJs`).

**Spec:** [docs/superpowers/specs/2026-06-27-cascade-event-log-deeplink-design.md](../specs/2026-06-27-cascade-event-log-deeplink-design.md)

## Global Constraints

- **KISS.** Simplest solution; no speculative abstraction.
- **Branch/worktree:** Work happens in a worktree off the existing `feature/cascade-event-log-deeplink` branch (the spec is already committed there). Create it with: `git worktree add .worktrees/feature-cascade-event-log-deeplink feature/cascade-event-log-deeplink`, then `cp ../../.env.development .` (+ any `.env.local`), `npm install && npx prisma generate`. Never commit to `main`/`develop` directly.
- **Verification gate (all four must pass before merge):** `npm run lint`, `npm run typecheck`, `npm run test:unit`, `npm run build`.
- **Imports:** `@/*` maps to `./src/*`.
- **Formatting:** run `npm run lint:fix` before each commit (Prettier 4-space, single quotes, semicolons, wired into ESLint).
- **Analytics:** the cascade card already carries `data-umami-event="cascade-card-click"` — do NOT add a new event.
- **Design tokens:** faction fills already exist in `src/app/layout.css` — `--color-faction-bugs-fill` `rgba(232,130,42,.35)`, `--color-faction-cyborgs-fill` `rgba(139,45,45,.35)`, `--color-faction-illuminate-fill` `rgba(126,200,227,.35)`; faction index `event.enemy` is `0`=bugs, `1`=cyborgs, `2`=illuminate (matches the existing `.event-log-card-chain[data-faction="N"]` convention).
- **Don't add `id` attributes** to event wrappers — the existing `data-event-key` is the scroll/query target.

## File Structure

| File | Responsibility | Action |
|---|---|---|
| `src/shared/utils/game/findCascadeByEventKey.mjs` | Pure: resolve an `eventKey` string → the cascade containing it | Create |
| `src/__tests__/unit/shared/utils/game/findCascadeByEventKey.test.mjs` | Unit test for the helper | Create |
| `src/shared/hooks/useCascadeHighlight.mjs` | Hook: highlight `Set` state + `pinCascade` (scroll + dismiss + hash effect) | Create |
| `src/__tests__/unit/shared/hooks/useCascadeHighlight.test.mjs` | Unit test for the hook's state behavior | Create |
| `src/features/timeline/EventLog.jsx` | Add `highlightedKeys` prop; stamp `data-faction` + `data-highlighted` on wrappers | Modify |
| `src/features/timeline/EventLog.css` | `scroll-margin-top` + faction-tint highlight rules | Modify |
| `src/__tests__/unit/features/timeline/EventLog.test.jsx` | Tests for the new wrapper attributes | Modify |
| `src/features/timeline/CascadeLogCard.jsx` | href → `#<lastEvent key>`; `onSelectCascade` prop + `onClick` | Modify |
| `src/__tests__/unit/features/timeline/CascadeLogCard.test.jsx` | Update href test; add onClick test | Modify |
| `src/features/timeline/CascadeLog.jsx` | Thread `onSelectCascade` to the card | Modify |
| `src/features/archives/ArchivesClient.jsx` | Call the hook; wire `onSelectCascade` + `highlightedKeys` | Modify |
| `CHANGELOG.md` | Unreleased entry | Modify |

---

### Task 1: `findCascadeByEventKey` pure helper

**Files:**
- Create: `src/shared/utils/game/findCascadeByEventKey.mjs`
- Test: `src/__tests__/unit/shared/utils/game/findCascadeByEventKey.test.mjs`

**Interfaces:**
- Consumes: `eventKey(event)` from `@/shared/utils/game/eventKey.mjs` (returns `` `${event.type}-${event.event_id}` ``).
- Produces: `findCascadeByEventKey(cascades, key) => object | null`.

- [ ] **Step 1: Write the failing test**

Create `src/__tests__/unit/shared/utils/game/findCascadeByEventKey.test.mjs`:

```js
import { describe, it, expect } from 'vitest';
import { findCascadeByEventKey } from '@/shared/utils/game/findCascadeByEventKey.mjs';

const ev = (type, id) => ({ type, event_id: id });
const cascade = (events) => ({ events });

describe('findCascadeByEventKey', () => {
    const c1 = cascade([ev('defend', 1), ev('defend', 2), ev('defend', 3)]);
    const c2 = cascade([ev('defend', 7), ev('defend', 8)]);
    const cascades = [c1, c2];

    it('matches an event in the middle of a cascade', () => {
        expect(findCascadeByEventKey(cascades, 'defend-2')).toBe(c1);
    });

    it('matches the first and last event of a cascade', () => {
        expect(findCascadeByEventKey(cascades, 'defend-7')).toBe(c2);
        expect(findCascadeByEventKey(cascades, 'defend-8')).toBe(c2);
    });

    it('returns null when no cascade contains the key', () => {
        expect(findCascadeByEventKey(cascades, 'defend-99')).toBeNull();
        expect(findCascadeByEventKey(cascades, 'attack-1')).toBeNull();
    });

    it('returns null for empty or missing input', () => {
        expect(findCascadeByEventKey([], 'defend-1')).toBeNull();
        expect(findCascadeByEventKey(null, 'defend-1')).toBeNull();
        expect(findCascadeByEventKey(cascades, '')).toBeNull();
    });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test:unit -- findCascadeByEventKey`
Expected: FAIL — `Failed to resolve import ".../findCascadeByEventKey.mjs"`.

- [ ] **Step 3: Write the minimal implementation**

Create `src/shared/utils/game/findCascadeByEventKey.mjs`:

```js
import { eventKey } from '@/shared/utils/game/eventKey.mjs';

/**
 * Resolve an `eventKey` string (e.g. "defend-12345", no leading '#') to the
 * cascade whose `events` array contains that event. Used to turn a deep-link
 * URL hash back into a cascade. Returns `null` when nothing matches.
 *
 * @param {Array<{ events?: Array<object> }>} cascades - Cascades to search.
 * @param {string} key - An eventKey string with the leading '#' already stripped.
 * @returns {object | null} The matching cascade, or null.
 */
export function findCascadeByEventKey(cascades, key) {
    if (!cascades?.length || !key) return null;
    return cascades.find((c) => c.events?.some((e) => eventKey(e) === key)) ?? null;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run test:unit -- findCascadeByEventKey`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
npm run lint:fix
git add src/shared/utils/game/findCascadeByEventKey.mjs src/__tests__/unit/shared/utils/game/findCascadeByEventKey.test.mjs
git commit -m "feat(archives): add findCascadeByEventKey helper"
```

---

### Task 2: EventLog highlight layer (prop + wrapper attributes + CSS)

**Files:**
- Modify: `src/features/timeline/EventLog.jsx` (signature line 35-45; wrapper div line 98-101)
- Modify: `src/features/timeline/EventLog.css` (append rules)
- Test: `src/__tests__/unit/features/timeline/EventLog.test.jsx`

**Interfaces:**
- Consumes: `highlightedKeys: Set<string> | null` (new prop, default `null`).
- Produces: per-event wrapper now carries `data-faction={String(event.enemy)}` always and `data-highlighted` when its `eventKey` is in `highlightedKeys`.

- [ ] **Step 1: Write the failing tests**

In `src/__tests__/unit/features/timeline/EventLog.test.jsx`, add these two tests inside the `describe('EventLog', …)` block (after the existing `data-event-key` test):

```js
test('marks cascade-highlighted cards with data-highlighted and data-faction', () => {
    const { container } = render(
        <EventLog
            events={fakeEvents}
            timeFormat="absolute"
            layout="stack"
            highlightedKeys={new Set(['defend-1'])}
        />,
    );
    const wrapper = container.querySelector('[data-event-key="defend-1"]');
    expect(wrapper.getAttribute('data-faction')).toBe('0');
    expect(wrapper.hasAttribute('data-highlighted')).toBe(true);
});

test('omits data-highlighted when the key is not in highlightedKeys', () => {
    const { container } = render(
        <EventLog
            events={fakeEvents}
            timeFormat="absolute"
            layout="stack"
            highlightedKeys={new Set(['defend-999'])}
        />,
    );
    const wrapper = container.querySelector('[data-event-key="defend-1"]');
    expect(wrapper.getAttribute('data-faction')).toBe('0');
    expect(wrapper.hasAttribute('data-highlighted')).toBe(false);
});
```

(`fakeEvents[0]` already has `enemy: 0` and `eventKey` `"defend-1"`.)

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm run test:unit -- EventLog`
Expected: FAIL — `data-faction` is `null` and `hasAttribute('data-highlighted')` is `false` for the first test (attributes not added yet).

- [ ] **Step 3: Add the prop to EventLog's signature**

In `src/features/timeline/EventLog.jsx`, change the destructured props (lines 35-45) to add `highlightedKeys`:

```jsx
export default function EventLog({
    events,
    timeFormat,
    title = 'Event Log',
    id = 'event-log',
    initialSortOrder,
    selectedEventKey = null,
    highlightedKeys = null,
    onHoverEvent,
    railRef,
    layout = 'grid',
}) {
```

Also add a JSDoc bullet in the block comment above (after the `selectedEventKey` bullet):

```
 * - `highlightedKeys` (optional): a `Set` of `eventKey` strings; matching
 *   cards get `data-highlighted` for the cascade deep-link faction tint
```

- [ ] **Step 4: Stamp the attributes on the wrapper div**

In the same file, change the wrapper div (lines 98-101) from:

```jsx
                                                    <div
                                                        key={`${group.date}-${event.event_id}`}
                                                        data-event-key={key}
                                                    >
```

to:

```jsx
                                                    <div
                                                        key={`${group.date}-${event.event_id}`}
                                                        data-event-key={key}
                                                        data-faction={String(event.enemy)}
                                                        data-highlighted={
                                                            highlightedKeys?.has(key) ?
                                                                ''
                                                            :   undefined
                                                        }
                                                    >
```

(`data-highlighted={undefined}` omits the attribute entirely; `''` renders it as a bare presence attribute.)

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npm run test:unit -- EventLog`
Expected: PASS (all EventLog tests, including the two new ones).

- [ ] **Step 6: Add the CSS**

Append to `src/features/timeline/EventLog.css`:

```css
/* === Cascade deep-link highlight ===
 *
 * scroll-margin-top offsets the fixed site header (h-[50px] mobile /
 * h-[80px] at sm:) so a deep-linked cascade event isn't tucked under it
 * when scrollIntoView lands it at the top of the viewport. */
.event-log-day-grid > div {
    scroll-margin-top: 80px;
}

@media (max-width: 639px) {
    .event-log-day-grid > div {
        scroll-margin-top: 56px;
    }
}

/* Faction-tinted underlay across every event in a clicked cascade. Keyed
 * off data-faction (same convention as .event-log-card-chain above). The
 * card root is a direct-child <article>. isSelected's !bg-primary-tint
 * intentionally wins on the one scroll-selected card, marking your current
 * position within the highlighted range. */
.event-log-day-grid > div[data-highlighted] > article {
    border-left-width: 4px;
    border-left-style: solid;
}
.event-log-day-grid > div[data-highlighted][data-faction="0"] > article {
    background: var(--color-faction-bugs-fill);
    border-left-color: var(--color-faction-bugs);
}
.event-log-day-grid > div[data-highlighted][data-faction="1"] > article {
    background: var(--color-faction-cyborgs-fill);
    border-left-color: var(--color-faction-cyborgs);
}
.event-log-day-grid > div[data-highlighted][data-faction="2"] > article {
    background: var(--color-faction-illuminate-fill);
    border-left-color: var(--color-faction-illuminate);
}
```

- [ ] **Step 7: Commit**

```bash
npm run lint:fix
git add src/features/timeline/EventLog.jsx src/features/timeline/EventLog.css src/__tests__/unit/features/timeline/EventLog.test.jsx
git commit -m "feat(archives): EventLog faction-tint highlight layer + scroll-margin"
```

---

### Task 3: Wire the cascade card click (CascadeLogCard + CascadeLog)

**Files:**
- Modify: `src/features/timeline/CascadeLogCard.jsx`
- Modify: `src/features/timeline/CascadeLog.jsx` (signature line 21-27; card render line 66-71)
- Test: `src/__tests__/unit/features/timeline/CascadeLogCard.test.jsx`

**Interfaces:**
- Consumes: `eventKey(event)`; `onSelectCascade(cascade)` callback prop (provided by ArchivesClient in Task 5).
- Produces: cascade card href = `` `/archives?season=${cascade.season}#${eventKey(cascade.lastEvent)}` ``; clicking calls `onSelectCascade(cascade)`. CascadeLog accepts and threads `onSelectCascade`.

- [ ] **Step 1: Update the test (href) and add the onClick test**

In `src/__tests__/unit/features/timeline/CascadeLogCard.test.jsx`:

(a) Update the imports (lines 2-3) to add `vi` and `fireEvent`:

```js
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
```

(b) Give the factory a real `lastEvent` — change line 16 (`lastEvent: {}`) to:

```js
    lastEvent: { type: 'defend', event_id: 4242 },
```

(c) Replace the existing href test (lines 40-45) with:

```js
    it("links to the cascade's last event and fires onSelectCascade on click", () => {
        const onSelectCascade = vi.fn();
        const c = cascade();
        render(<CascadeLogCard cascade={c} onSelectCascade={onSelectCascade} />);
        const link = screen.getByRole('link');
        expect(link.getAttribute('href')).toBe('/archives?season=155#defend-4242');
        expect(link.getAttribute('data-umami-event')).toBe('cascade-card-click');
        fireEvent.click(link);
        expect(onSelectCascade).toHaveBeenCalledWith(c);
    });
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test:unit -- CascadeLogCard`
Expected: FAIL — href is still `/archives?season=155#cascade` and `onSelectCascade` is never called.

- [ ] **Step 3: Update CascadeLogCard**

In `src/features/timeline/CascadeLogCard.jsx`:

(a) Add the import (after line 4):

```js
import { eventKey } from '@/shared/utils/game/eventKey.mjs';
```

(b) Add the prop to the signature (line 13):

```js
export default function CascadeLogCard({ cascade, onSelectCascade }) {
```

(c) Change the `<Link>` (lines 20-24) from:

```jsx
        <Link
            href={`/archives?season=${cascade.season}#cascade`}
            data-umami-event="cascade-card-click"
            className="event-log-card-link"
        >
```

to:

```jsx
        <Link
            href={`/archives?season=${cascade.season}#${eventKey(cascade.lastEvent)}`}
            onClick={() => onSelectCascade?.(cascade)}
            data-umami-event="cascade-card-click"
            className="event-log-card-link"
        >
```

- [ ] **Step 4: Thread the prop through CascadeLog**

In `src/features/timeline/CascadeLog.jsx`:

(a) Add `onSelectCascade` to the signature (lines 21-27):

```jsx
export default function CascadeLog({
    cascades,
    lede,
    title = 'Cascade Failures',
    id = 'cascade',
    initialSortOrder,
    onSelectCascade,
}) {
```

(b) Pass it to the card (lines 66-71):

```jsx
                                    {group.cascades.map((c, i) => (
                                        <CascadeLogCard
                                            key={`${group.season}-${c.startTime}-${i}`}
                                            cascade={c}
                                            onSelectCascade={onSelectCascade}
                                        />
                                    ))}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm run test:unit -- CascadeLogCard`
Expected: PASS (all CascadeLogCard tests). The CascadeLog passthrough is exercised end-to-end in the Task 6 DevTools check.

- [ ] **Step 6: Commit**

```bash
npm run lint:fix
git add src/features/timeline/CascadeLogCard.jsx src/features/timeline/CascadeLog.jsx src/__tests__/unit/features/timeline/CascadeLogCard.test.jsx
git commit -m "feat(archives): cascade card links to its last event + onSelect callback"
```

---

### Task 4: `useCascadeHighlight` hook

**Files:**
- Create: `src/shared/hooks/useCascadeHighlight.mjs`
- Test: `src/__tests__/unit/shared/hooks/useCascadeHighlight.test.mjs`

**Interfaces:**
- Consumes: `eventKey`; `findCascadeByEventKey` (Task 1); a `railRef` (`{ current: HTMLElement | null }`).
- Produces: `useCascadeHighlight(cascades, railRef) => { highlightedKeys: Set<string> | null, pinCascade: (cascade) => void }`.

- [ ] **Step 1: Write the failing test**

Create `src/__tests__/unit/shared/hooks/useCascadeHighlight.test.mjs`:

```js
// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, act } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useCascadeHighlight } from '@/shared/hooks/useCascadeHighlight.mjs';

const ev = (id) => ({ type: 'defend', event_id: id });
const cascades = [{ events: [ev(1), ev(2), ev(3)] }];

describe('useCascadeHighlight', () => {
    beforeEach(() => {
        window.location.hash = '';
    });
    afterEach(() => {
        window.location.hash = '';
    });

    it('pinCascade sets highlightedKeys to every event key in the cascade', () => {
        const railRef = { current: null };
        const { result } = renderHook(() => useCascadeHighlight(cascades, railRef));
        expect(result.current.highlightedKeys).toBeNull();
        act(() => {
            result.current.pinCascade(cascades[0]);
        });
        expect([...result.current.highlightedKeys].sort()).toEqual([
            'defend-1',
            'defend-2',
            'defend-3',
        ]);
    });

    it('resolves an existing location.hash on mount', () => {
        window.location.hash = '#defend-2';
        const railRef = { current: null };
        const { result } = renderHook(() => useCascadeHighlight(cascades, railRef));
        expect(result.current.highlightedKeys?.has('defend-2')).toBe(true);
    });

    it('ignores a hash that matches no cascade', () => {
        window.location.hash = '#defend-999';
        const railRef = { current: null };
        const { result } = renderHook(() => useCascadeHighlight(cascades, railRef));
        expect(result.current.highlightedKeys).toBeNull();
    });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test:unit -- useCascadeHighlight`
Expected: FAIL — `Failed to resolve import ".../useCascadeHighlight.mjs"`.

- [ ] **Step 3: Write the hook**

Create `src/shared/hooks/useCascadeHighlight.mjs`:

```js
import { useCallback, useEffect, useRef, useState } from 'react';
import { eventKey } from '@/shared/utils/game/eventKey.mjs';
import { findCascadeByEventKey } from '@/shared/utils/game/findCascadeByEventKey.mjs';

// Scroll events within this window (ms) after a pin are ignored, so the
// programmatic smooth-scroll and macOS inertial fling don't dismiss the
// highlight before the user can see it.
const DISMISS_GRACE_MS = 700;

/**
 * Cascade deep-link highlight for the archives event log.
 *
 * Clicking a cascade card (same page) or landing on `/archives#<eventKey>`
 * (direct / external / back-forward) pins a persistent highlight across every
 * event in that cascade and scrolls the log to the topmost-in-DOM member. The
 * highlight clears when the user scrolls away or pins another cascade.
 *
 * @param {Array<object>} cascades - Cascades for the current season (each has `events`).
 * @param {{ current: HTMLElement | null }} railRef - Ref on the event-log container.
 * @returns {{ highlightedKeys: Set<string> | null, pinCascade: (cascade: object) => void }}
 */
export function useCascadeHighlight(cascades, railRef) {
    const [highlightedKeys, setHighlightedKeys] = useState(
        /** @type {Set<string> | null} */ (null),
    );
    // Hash listeners are registered once; read cascades through a ref so they
    // always see the latest season's data without re-subscribing each render.
    const cascadesRef = useRef(cascades);
    cascadesRef.current = cascades;
    // Cleanup for the currently-armed scroll-away listener (one at a time).
    const dismissCleanupRef = useRef(/** @type {null | (() => void)} */ (null));

    const pinCascade = useCallback(
        (cascade) => {
            if (!cascade?.events?.length) return;
            const keys = new Set(cascade.events.map(eventKey));
            setHighlightedKeys(keys);

            // Scroll to the topmost highlighted card in current DOM order
            // (sort-agnostic). Double rAF so layout has painted before measuring.
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    const rail = railRef.current;
                    if (!rail) return;
                    let topEl = null;
                    let topY = Infinity;
                    for (const key of keys) {
                        const el = rail.querySelector(`[data-event-key="${key}"]`);
                        if (!el) continue;
                        const y = el.getBoundingClientRect().top;
                        if (y < topY) {
                            topY = y;
                            topEl = el;
                        }
                    }
                    topEl?.scrollIntoView({ block: 'start', behavior: 'smooth' });
                });
            });

            // Arm a self-removing scroll-away dismiss; ignore scroll during the
            // grace window so the programmatic/inertial scroll doesn't clear it.
            dismissCleanupRef.current?.();
            const armedAt = Date.now() + DISMISS_GRACE_MS;
            function onScroll() {
                if (Date.now() < armedAt) return;
                setHighlightedKeys(null);
                cleanup();
            }
            function cleanup() {
                window.removeEventListener('wheel', onScroll);
                window.removeEventListener('touchmove', onScroll);
                dismissCleanupRef.current = null;
            }
            window.addEventListener('wheel', onScroll, { passive: true });
            window.addEventListener('touchmove', onScroll, { passive: true });
            dismissCleanupRef.current = cleanup;
        },
        [railRef],
    );

    useEffect(() => {
        const resolveHash = () => {
            const key = window.location.hash.slice(1);
            if (!key) return;
            const cascade = findCascadeByEventKey(cascadesRef.current, key);
            if (cascade) pinCascade(cascade);
        };
        resolveHash(); // direct / external / reload with a hash already present
        window.addEventListener('hashchange', resolveHash);
        window.addEventListener('popstate', resolveHash);
        return () => {
            window.removeEventListener('hashchange', resolveHash);
            window.removeEventListener('popstate', resolveHash);
            dismissCleanupRef.current?.();
        };
    }, [pinCascade]);

    return { highlightedKeys, pinCascade };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run test:unit -- useCascadeHighlight`
Expected: PASS (3 tests). (With `railRef.current === null` the scroll no-ops, so jsdom's missing `scrollIntoView` is never reached.)

- [ ] **Step 5: Commit**

```bash
npm run lint:fix
git add src/shared/hooks/useCascadeHighlight.mjs src/__tests__/unit/shared/hooks/useCascadeHighlight.test.mjs
git commit -m "feat(archives): useCascadeHighlight hook (pin + scroll + hash + dismiss)"
```

---

### Task 5: Wire the hook into ArchivesClient

**Files:**
- Modify: `src/features/archives/ArchivesClient.jsx` (import block; line 106; CascadeLog at 171-173; EventLog at 178-195)

**Interfaces:**
- Consumes: `useCascadeHighlight` (Task 4); `pinCascade`/`highlightedKeys`; `CascadeLog`'s `onSelectCascade` (Task 3); `EventLog`'s `highlightedKeys` (Task 2).
- Produces: nothing downstream — this is the integration point.

- [ ] **Step 1: Import the hook**

In `src/features/archives/ArchivesClient.jsx`, add after line 17 (`import { useScrollEvent } …`):

```js
import { useCascadeHighlight } from '@/shared/hooks/useCascadeHighlight.mjs';
```

- [ ] **Step 2: Call the hook**

Immediately after line 106 (`const { selectedEvent, railRef } = useScrollEvent(events);`) add:

```js
    const { highlightedKeys, pinCascade } = useCascadeHighlight(cascades, railRef);
```

- [ ] **Step 3: Pass `onSelectCascade` to CascadeLog**

Change the CascadeLog render (lines 171-173) from:

```jsx
            {cascades.length > 0 && (
                <CascadeLog cascades={cascades} initialSortOrder={initialCascadeSort} />
            )}
```

to:

```jsx
            {cascades.length > 0 && (
                <CascadeLog
                    cascades={cascades}
                    initialSortOrder={initialCascadeSort}
                    onSelectCascade={pinCascade}
                />
            )}
```

- [ ] **Step 4: Pass `highlightedKeys` to EventLog**

In the EventLog render (lines 178-195), add the prop right after `railRef={railRef}` (line 193), before `layout="stack"`:

```jsx
                        railRef={railRef}
                        highlightedKeys={highlightedKeys}
                        layout="stack"
```

- [ ] **Step 5: Verify the suite still passes**

Run: `npm run test:unit && npm run typecheck`
Expected: PASS — no test imports ArchivesClient directly, and the new prop wiring is type-consistent.

- [ ] **Step 6: Commit**

```bash
npm run lint:fix
git add src/features/archives/ArchivesClient.jsx
git commit -m "feat(archives): wire cascade highlight into ArchivesClient"
```

---

### Task 6: Full verification, DevTools check, CHANGELOG

**Files:**
- Modify: `CHANGELOG.md`

- [ ] **Step 1: Run the full four-gate verification**

```bash
npm run lint
npm run typecheck
npm run test:unit
npm run build
```
Expected: all four pass. Fix any failure before proceeding; do not continue on red.

- [ ] **Step 2: DevTools behavioral verification** (dev server on :3000; CLAUDE.md requires DevTools verification for frontend changes)

Open `/archives` for a season with at least one cascade (one with telemetry, e.g. a recent season) and confirm via Chrome DevTools MCP:
  1. Clicking a cascade card scrolls the event log so the cascade's events are in view, and **every** event in that cascade shows the faction-tinted underlay (`getComputedStyle` background matches the faction-fill rgba).
  2. The scrolled-to card is **not** hidden under the fixed header (`getBoundingClientRect().top` ≥ the header height).
  3. Toggling the event-log sort (newest/oldest) and re-clicking the cascade still lands the topmost-in-DOM cascade event at the top (sort-agnostic).
  4. After the scroll settles, a manual wheel/trackpad scroll clears the highlight; the programmatic scroll itself does **not** clear it.
  5. Loading `/archives?season=<N>#<defend-eventId>` directly (copy a card's href) pins + scrolls on first paint.
  6. If the map "you are here" selection landing mid-cascade looks wrong, note it — that's the documented follow-up (`isProgrammaticScroll` guard), out of scope here.

- [ ] **Step 3: Add the CHANGELOG entry**

`CHANGELOG.md` has no `## Unreleased` section (the top entry is `## 0.60.0`), so add a new `## Unreleased` block above it, matching the existing `### Features` + bold-lead-in style (append the GitHub issue number if one exists). Insert at the very top, before line `## 0.60.0`:

```markdown
## Unreleased

### Features

- **Cascade deep-linking on `/archives`**. Clicking a cascade card now scrolls
  the event log to that cascade and pins a persistent faction-tinted highlight
  across every one of its events, clearing when you scroll away or pick another
  cascade. The view is shareable via a URL hash (`/archives?season=N#<event>`):
  the highlight rehydrates on direct load and browser back/forward. Scroll
  targeting reads live DOM order, so it stays correct under either log sort.

```

(At merge to `develop`, this `## Unreleased` heading becomes `## X.Y.Z` with the matching `package.json` bump — see Step 5.)

- [ ] **Step 4: Commit**

```bash
npm run lint:fix
git add CHANGELOG.md
git commit -m "docs(changelog): cascade → event-log deep-linking"
```

- [ ] **Step 5: Hand off for integration**

Implementation is complete and verified. Use the **superpowers:finishing-a-development-branch** skill to merge `feature/cascade-event-log-deeplink` into `develop` — per CLAUDE.md § Git Workflow rule #2, the merge commit must also move the `## Unreleased` CHANGELOG entry into a new `## X.Y.Z` (minor bump — new feature) and bump `"version"` in `package.json` to match, using `git merge --no-ff`. Then remove the worktree.

---

## Notes for the implementer

- **Why no `id` on wrappers, no native scroll:** a Next `<Link>` same-page click commits the hash via `history.pushState` and fires **neither** `hashchange` nor `popstate`, so same-page highlighting MUST come from the card's `onClick` (Task 3). The hook's listeners (Task 4) only cover direct loads, manual hash edits, and back/forward. This is why scrolling is JS, not a native anchor.
- **Why `data-event-key`, not a new `id`:** the scroll target is found by querying `[data-event-key]` (Task 4) — the attribute already exists, so no `id` is needed.
- **Why the topmost is computed from the DOM:** the event-log sort is local state inside `EventLog` and can be toggled at runtime, so neither a static href nor ArchivesClient knows which cascade event is visually first. Reading `getBoundingClientRect().top` is sort-agnostic.
- **isSelected vs. highlight:** they are independent layers. `useScrollEvent` keeps driving the single yellow `isSelected` card; the cascade highlight is the faction-tinted `Set`. On the one card that is both, `isSelected`'s `!bg-primary-tint` (important) wins the background — intended, it marks your position inside the range.
- **EventLogCard is intentionally untouched.** The spec sketched an `isHighlighted` prop on `EventLogCard`; the plan instead drives the tint from the wrapper's `data-highlighted`/`data-faction` + CSS targeting the child `> article` (the existing `.event-log-card-chain[data-faction]` convention). Same visual result, one fewer component changed — confirmed the card root is `<article>` ([EventCardLayout.jsx:46](../../../src/features/timeline/EventCardLayout.jsx#L46)).
