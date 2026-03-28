# Phase 6: Galaxy Static Info Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add "last updated" timestamp and per-faction player counts to the galaxy map.

**Architecture:** Pass `data.last_updated` and `data.live` down through DashboardClient → Galaxy → Map. Render timestamp as HTML below the SVG, player counts as SVG `<text>` elements above faction icons. Extract `formatNumber` from StatGrid into a shared utility.

**Tech Stack:** React server components, SVG, CSS tokens

---

## File Structure

| Action | File                                              | Responsibility                                  |
| ------ | ------------------------------------------------- | ----------------------------------------------- |
| Create | `src/utils/formatNumber.mjs`                      | Shared compact number formatter                 |
| Create | `src/__tests__/unit/utils/formatNumber.test.mjs`  | Tests for formatNumber                          |
| Create | `src/utils/formatTimeAgo.mjs`                     | Relative time string from Date                  |
| Create | `src/__tests__/unit/utils/formatTimeAgo.test.mjs` | Tests for formatTimeAgo                         |
| Modify | `src/components/h1/StatGrid/StatGrid.jsx`         | Import shared formatNumber                      |
| Modify | `src/components/h1/Dashboard/DashboardClient.jsx` | Pass lastUpdated and live to Galaxy             |
| Modify | `src/components/h1/Galaxy/Galaxy.jsx`             | Accept and render lastUpdated, pass live to Map |
| Modify | `src/components/h1/Galaxy/Map.jsx`                | Accept live prop, render player count text      |

---

### Task 1: Extract formatNumber to shared utility

**Files:**

- Create: `src/utils/formatNumber.mjs`
- Create: `src/__tests__/unit/utils/formatNumber.test.mjs`
- Modify: `src/components/h1/StatGrid/StatGrid.jsx`

- [ ] **Step 1: Write the failing tests**

```js
// src/__tests__/unit/utils/formatNumber.test.mjs
import { formatNumber } from '@/utils/formatNumber.mjs';

describe('formatNumber', () => {
    test('formats billions', () => {
        expect(formatNumber(1_500_000_000)).toBe('1.5B');
    });

    test('formats millions', () => {
        expect(formatNumber(12_300_000)).toBe('12.3M');
    });

    test('formats thousands with commas', () => {
        expect(formatNumber(12345)).toBe('12,345');
    });

    test('formats small numbers as-is', () => {
        expect(formatNumber(847)).toBe('847');
    });

    test('returns dash for undefined', () => {
        expect(formatNumber(undefined)).toBe('—');
    });

    test('returns dash for null', () => {
        expect(formatNumber(null)).toBe('—');
    });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test:unit:run -- --reporter=verbose 2>&1 | grep -E "formatNumber|FAIL"`
Expected: FAIL — module not found

- [ ] **Step 3: Create the shared utility**

```js
// src/utils/formatNumber.mjs
export function formatNumber(n) {
    if (n === undefined || n === null) return '—';
    const num = Number(n);
    if (num >= 1_000_000_000) return (num / 1_000_000_000).toFixed(1) + 'B';
    if (num >= 1_000_000) return (num / 1_000_000).toFixed(1) + 'M';
    if (num >= 1_000) return num.toLocaleString();
    return String(num);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test:unit:run -- --reporter=verbose 2>&1 | grep -E "formatNumber|PASS|FAIL"`
Expected: All 6 tests PASS

- [ ] **Step 5: Update StatGrid to import shared utility**

In `src/components/h1/StatGrid/StatGrid.jsx`:

- Remove the local `formatNumber` function (lines 3-10)
- Add import at top: `import { formatNumber } from '@/utils/formatNumber.mjs';`

- [ ] **Step 6: Run full test suite**

Run: `npm run test:unit:run`
Expected: All tests pass

- [ ] **Step 7: Commit**

```bash
git add src/utils/formatNumber.mjs src/__tests__/unit/utils/formatNumber.test.mjs src/components/h1/StatGrid/StatGrid.jsx
git commit -m "refactor: extract formatNumber to shared utility"
```

---

### Task 2: Create formatTimeAgo utility

**Files:**

- Create: `src/utils/formatTimeAgo.mjs`
- Create: `src/__tests__/unit/utils/formatTimeAgo.test.mjs`

- [ ] **Step 1: Write the failing tests**

```js
// src/__tests__/unit/utils/formatTimeAgo.test.mjs
import { formatTimeAgo } from '@/utils/formatTimeAgo.mjs';

describe('formatTimeAgo', () => {
    test('returns seconds ago for < 60s', () => {
        const now = new Date('2026-03-28T12:01:00Z');
        const date = new Date('2026-03-28T12:00:15Z');
        expect(formatTimeAgo(date, now)).toBe('Updated 45s ago');
    });

    test('returns minutes ago for >= 60s', () => {
        const now = new Date('2026-03-28T12:05:00Z');
        const date = new Date('2026-03-28T12:02:00Z');
        expect(formatTimeAgo(date, now)).toBe('Updated 3m ago');
    });

    test('returns hours ago for >= 60m', () => {
        const now = new Date('2026-03-28T14:00:00Z');
        const date = new Date('2026-03-28T12:00:00Z');
        expect(formatTimeAgo(date, now)).toBe('Updated 2h ago');
    });

    test('returns null for null input', () => {
        expect(formatTimeAgo(null)).toBe(null);
    });

    test('returns null for undefined input', () => {
        expect(formatTimeAgo(undefined)).toBe(null);
    });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test:unit:run -- --reporter=verbose 2>&1 | grep -E "formatTimeAgo|FAIL"`
Expected: FAIL — module not found

- [ ] **Step 3: Create the utility**

```js
// src/utils/formatTimeAgo.mjs
export function formatTimeAgo(date, now = new Date()) {
    if (!date) return null;
    const seconds = Math.floor((now - new Date(date)) / 1000);
    if (seconds < 60) return `Updated ${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `Updated ${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    return `Updated ${hours}h ago`;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test:unit:run -- --reporter=verbose 2>&1 | grep -E "formatTimeAgo|PASS|FAIL"`
Expected: All 5 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/utils/formatTimeAgo.mjs src/__tests__/unit/utils/formatTimeAgo.test.mjs
git commit -m "feat: add formatTimeAgo utility"
```

---

### Task 3: Add "Last Updated" to Galaxy component

**Files:**

- Modify: `src/components/h1/Dashboard/DashboardClient.jsx`
- Modify: `src/components/h1/Galaxy/Galaxy.jsx`

- [ ] **Step 1: Pass lastUpdated from DashboardClient to Galaxy**

In `src/components/h1/Dashboard/DashboardClient.jsx`, change:

```jsx
<Galaxy mapState={mapState} />
```

to:

```jsx
<Galaxy mapState={mapState} lastUpdated={data.last_updated} />
```

- [ ] **Step 2: Render timestamp in Galaxy**

Replace the entire `src/components/h1/Galaxy/Galaxy.jsx` with:

```jsx
'use client';
import { useRef } from 'react';
import Map from '@/components/h1/Galaxy/Map';
import Tooltip from '@/components/h1/Galaxy/Tooltip';
import { formatTimeAgo } from '@/utils/formatTimeAgo.mjs';

export default function Galaxy({ mapState, lastUpdated }) {
    const svgRef = useRef(null);
    const timeAgo = formatTimeAgo(lastUpdated);

    return (
        <section
            id="galaxy"
            className="mx-4 mb-4 flex flex-grow-[4] flex-col items-center gap-4 sm:mx-0"
        >
            <Map svgRef={svgRef} map={mapState} />
            {timeAgo && (
                <p
                    className="text-center font-mono text-xs"
                    style={{ color: 'var(--color-text-muted)' }}
                >
                    {timeAgo}
                </p>
            )}
            <Tooltip svgRef={svgRef} map={mapState} />
        </section>
    );
}
```

- [ ] **Step 3: Build to verify no errors**

Run: `npm run build`
Expected: Build succeeds

- [ ] **Step 4: Commit**

```bash
git add src/components/h1/Dashboard/DashboardClient.jsx src/components/h1/Galaxy/Galaxy.jsx
git commit -m "feat: show last updated timestamp below galaxy map"
```

---

### Task 4: Add player counts above faction icons on map

**Files:**

- Modify: `src/components/h1/Dashboard/DashboardClient.jsx`
- Modify: `src/components/h1/Galaxy/Galaxy.jsx`
- Modify: `src/components/h1/Galaxy/Map.jsx`

- [ ] **Step 1: Pass live data through to Map**

In `src/components/h1/Dashboard/DashboardClient.jsx`, change:

```jsx
<Galaxy mapState={mapState} lastUpdated={data.last_updated} />
```

to:

```jsx
<Galaxy mapState={mapState} lastUpdated={data.last_updated} live={data.live} />
```

In `src/components/h1/Galaxy/Galaxy.jsx`, update the function signature and Map call:

```jsx
export default function Galaxy({ mapState, lastUpdated, live }) {
```

and change:

```jsx
<Map svgRef={svgRef} map={mapState} />
```

to:

```jsx
<Map svgRef={svgRef} map={mapState} live={live} />
```

- [ ] **Step 2: Render player counts in Map**

In `src/components/h1/Galaxy/Map.jsx`, add the import:

```jsx
import { formatNumber } from '@/utils/formatNumber.mjs';
```

Update the function signature:

```jsx
export default function Map({ svgRef, map, live }) {
```

Inside each faction `<g>` block, add a `<text>` element **after** the `<image>` element. Replace the faction `.map()` block (lines 54-81) with:

```jsx
{
    factions.map(({ id, index, paths }) => {
        const icon = factionIcons[index];
        const players = live?.find((s) => s.enemy === index)?.players;
        return (
            <g key={id} id={id}>
                {paths.map((path) => (
                    <path
                        key={path.id}
                        id={path.id}
                        data-name={String(path.sector)}
                        data-faction={id}
                        className={
                            path.sector === 11 ?
                                'sector ' + map[index][11].status
                            :   'sector ' +
                                map[index][path.sector].status +
                                ' ' +
                                map[index][path.sector].event
                        }
                        d={path.d}
                    />
                ))}
                <image
                    href={icon.href}
                    className="pointer-events-none"
                    x={icon.x}
                    y={icon.y}
                    width={icon.width}
                    height={icon.height}
                />
                {players != null && (
                    <text
                        x={icon.x + icon.width / 2}
                        y={icon.y - 10}
                        textAnchor="middle"
                        fill="rgba(255,255,255,0.7)"
                        fontSize="18"
                        fontFamily="monospace"
                        className="pointer-events-none"
                    >
                        {formatNumber(players)}
                    </text>
                )}
            </g>
        );
    });
}
```

- [ ] **Step 3: Build to verify no errors**

Run: `npm run build`
Expected: Build succeeds

- [ ] **Step 4: Run full test suite**

Run: `npm run test:unit:run`
Expected: All tests pass

- [ ] **Step 5: Commit**

```bash
git add src/components/h1/Dashboard/DashboardClient.jsx src/components/h1/Galaxy/Galaxy.jsx src/components/h1/Galaxy/Map.jsx
git commit -m "feat: show player counts above faction icons on galaxy map"
```

---

### Task 5: Final verification and build

- [ ] **Step 1: Run full build**

Run: `npm run build`
Expected: Build succeeds with no errors

- [ ] **Step 2: Run full test suite**

Run: `npm run test:unit:run`
Expected: All tests pass

- [ ] **Step 3: Verify visually**

Ask the user to start the dev server and check:

1. "Updated Xs ago" text appears centered below the galaxy map, above faction tabs
2. Player counts (e.g., "12.3K") appear above each faction icon on the map
3. Super Earth does NOT show a player count
4. StatGrid still displays correctly (formatNumber import works)
