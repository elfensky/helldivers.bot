# Timeline Visual Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the flat event list in the sidebar with a full-width visual timeline section using snap scroll, vertical rail, date grouping, and compact resolved event cards.

**Architecture:** Snap scroll wraps dashboard + timeline as two full-viewport screens at desktop. A new TimelineSection component handles the rail, date grouping, and responsive grid. The Event component gains a compact variant. A WarSummary component replaces the timeline in the sidebar.

**Tech Stack:** Next.js 16, React, CSS (component-scoped CSS files following existing patterns), Vitest for unit tests.

**Spec:** `docs/superpowers/specs/2026-03-30-phase-9-timeline-visual-redesign.md`

---

## File Structure

### New Files

| File                                                 | Responsibility                                                 |
| ---------------------------------------------------- | -------------------------------------------------------------- |
| `src/utils/groupEventsByDay.mjs`                     | Pure function: group events by calendar day, format day labels |
| `src/__tests__/unit/utils/groupEventsByDay.test.mjs` | Tests for date grouping                                        |
| `src/components/h1/WarSummary/WarSummary.jsx`        | Compact win/loss row for sidebar                               |
| `src/components/h1/WarSummary/WarSummary.css`        | WarSummary styles                                              |
| `src/__tests__/unit/components/warSummary.test.mjs`  | Tests for war summary computation                              |
| `src/components/h1/Timeline/TimelineSection.jsx`     | Full-width timeline with rail, date groups, responsive grid    |
| `src/components/h1/Timeline/TimelineSection.css`     | Timeline rail, grid, snap scroll target styles                 |

### Modified Files

| File                                              | Changes                                                           |
| ------------------------------------------------- | ----------------------------------------------------------------- |
| `src/components/h1/Event/Event.jsx`               | Add `compact` prop, hide progress bar for compact resolved events |
| `src/components/h1/Event/Event.css`               | Add `.event-card--compact` styles                                 |
| `src/components/h1/Dashboard/DashboardClient.jsx` | Remove timeline from sidebar, add WarSummary, add scroll hint     |
| `src/components/h1/Dashboard/DashboardClient.css` | Add scroll hint grid area                                         |
| `src/app/page.jsx`                                | Add snap scroll wrapper, mount TimelineSection                    |
| `src/app/page.css`                                | Snap scroll at lg:+, restore footer                               |

---

### Task 1: Date Grouping Utility

**Files:**

- Create: `src/utils/groupEventsByDay.mjs`
- Create: `src/__tests__/unit/utils/groupEventsByDay.test.mjs`

- [ ] **Step 1: Write failing tests for groupEventsByDay**

```js
// src/__tests__/unit/utils/groupEventsByDay.test.mjs
import { describe, it, expect } from 'vitest';
import { groupEventsByDay, formatDayLabel } from '@/utils/groupEventsByDay.mjs';

const event = (id, startTime, status = 'success') => ({
    event_id: id,
    start_time: startTime,
    end_time: startTime + 3600,
    status,
    type: 'defend',
    enemy: 0,
    points: 100,
    points_max: 200,
});

describe('groupEventsByDay', () => {
    it('returns empty array for no events', () => {
        expect(groupEventsByDay([])).toEqual([]);
    });

    it('groups events by calendar day (UTC)', () => {
        // March 30 2026 12:00 UTC = 1774958400
        // March 29 2026 12:00 UTC = 1774872000
        const events = [
            event('a', 1774958400),
            event('b', 1774958400 + 3600),
            event('c', 1774872000),
        ];
        const groups = groupEventsByDay(events);
        expect(groups).toHaveLength(2);
        expect(groups[0].events).toHaveLength(2);
        expect(groups[1].events).toHaveLength(1);
    });

    it('sorts groups newest day first', () => {
        const events = [event('old', 1774872000), event('new', 1774958400)];
        const groups = groupEventsByDay(events);
        expect(groups[0].date).toBe('2026-03-30');
        expect(groups[1].date).toBe('2026-03-29');
    });

    it('sorts events within a group newest first', () => {
        const events = [event('early', 1774958400), event('late', 1774958400 + 7200)];
        const groups = groupEventsByDay(events);
        expect(groups[0].events[0].event_id).toBe('late');
        expect(groups[0].events[1].event_id).toBe('early');
    });
});

describe('formatDayLabel', () => {
    it('returns "TODAY" for today', () => {
        const todayStr = new Date().toISOString().slice(0, 10);
        expect(formatDayLabel(todayStr)).toBe('TODAY');
    });

    it('returns "YESTERDAY" for yesterday', () => {
        const d = new Date();
        d.setDate(d.getDate() - 1);
        const yesterdayStr = d.toISOString().slice(0, 10);
        expect(formatDayLabel(yesterdayStr)).toBe('YESTERDAY');
    });

    it('returns formatted date for older days', () => {
        const label = formatDayLabel('2026-03-15');
        expect(label).toMatch(/MARCH 15/i);
    });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test:unit:run -- --reporter=verbose 2>&1 | tail -20`
Expected: FAIL — module not found

- [ ] **Step 3: Implement groupEventsByDay**

```js
// src/utils/groupEventsByDay.mjs

export function groupEventsByDay(events) {
    if (!events || events.length === 0) return [];

    const groups = new Map();

    for (const event of events) {
        const date = new Date(event.start_time * 1000).toISOString().slice(0, 10);
        if (!groups.has(date)) {
            groups.set(date, []);
        }
        groups.get(date).push(event);
    }

    return Array.from(groups.entries())
        .sort(([a], [b]) => b.localeCompare(a))
        .map(([date, dayEvents]) => ({
            date,
            label: formatDayLabel(date),
            events: dayEvents.sort((a, b) => b.start_time - a.start_time),
        }));
}

export function formatDayLabel(dateStr) {
    const today = new Date().toISOString().slice(0, 10);
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

    if (dateStr === today) return 'TODAY';
    if (dateStr === yesterday) return 'YESTERDAY';

    const [, , day] = dateStr.split('-');
    const monthName = new Date(dateStr + 'T00:00:00Z').toLocaleString('en-US', {
        month: 'long',
        timeZone: 'UTC',
    });
    return `${monthName.toUpperCase()} ${parseInt(day, 10)}`;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test:unit:run -- --reporter=verbose 2>&1 | tail -20`
Expected: All groupEventsByDay and formatDayLabel tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/utils/groupEventsByDay.mjs src/__tests__/unit/utils/groupEventsByDay.test.mjs
git commit -m "feat: add groupEventsByDay utility with date labeling"
```

---

### Task 2: War Summary Component

**Files:**

- Create: `src/components/h1/WarSummary/WarSummary.jsx`
- Create: `src/components/h1/WarSummary/WarSummary.css`
- Create: `src/__tests__/unit/components/warSummary.test.mjs`

- [ ] **Step 1: Write failing test for computeWarSummary**

```js
// src/__tests__/unit/components/warSummary.test.mjs
import { describe, it, expect } from 'vitest';
import { computeWarSummary } from '@/components/h1/WarSummary/WarSummary';

describe('computeWarSummary', () => {
    it('returns zero counts for no events', () => {
        expect(computeWarSummary([])).toEqual({ wins: 0, losses: 0 });
    });

    it('counts wins and losses', () => {
        const events = [
            { status: 'success' },
            { status: 'success' },
            { status: 'fail' },
            { status: 'active' },
        ];
        expect(computeWarSummary(events)).toEqual({ wins: 2, losses: 1 });
    });

    it('ignores active events', () => {
        const events = [{ status: 'active' }, { status: 'active' }];
        expect(computeWarSummary(events)).toEqual({ wins: 0, losses: 0 });
    });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test:unit:run -- --reporter=verbose 2>&1 | tail -20`
Expected: FAIL — module not found

- [ ] **Step 3: Implement WarSummary component**

```jsx
// src/components/h1/WarSummary/WarSummary.jsx
import './WarSummary.css';

export function computeWarSummary(events) {
    let wins = 0;
    let losses = 0;
    for (const e of events ?? []) {
        if (e.status === 'success') wins++;
        else if (e.status === 'fail') losses++;
    }
    return { wins, losses };
}

export default function WarSummary({ events }) {
    const { wins, losses } = computeWarSummary(events);

    if (wins === 0 && losses === 0) return null;

    return (
        <div className="war-summary">
            <span className="war-summary-label">Season Events</span>
            <div className="war-summary-counts">
                <span className="war-summary-wins">{wins}W</span>
                <span className="war-summary-sep">/</span>
                <span className="war-summary-losses">{losses}L</span>
            </div>
        </div>
    );
}
```

```css
/* src/components/h1/WarSummary/WarSummary.css */
.war-summary {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.5rem 0.75rem;
    background: var(--color-surface-1);
    border: 1px solid var(--color-ghost-border);
}

.war-summary-label {
    font-family: var(--font-body);
    font-size: 0.75rem;
    font-weight: 700;
    text-transform: uppercase;
    color: var(--color-text-muted);
}

.war-summary-counts {
    font-family: var(--font-mono);
    font-size: 0.875rem;
    display: flex;
    gap: 0.25rem;
}

.war-summary-wins {
    color: var(--color-success);
}

.war-summary-sep {
    color: var(--color-text-muted);
}

.war-summary-losses {
    color: var(--color-danger);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test:unit:run -- --reporter=verbose 2>&1 | tail -20`
Expected: All warSummary tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/h1/WarSummary/ src/__tests__/unit/components/warSummary.test.mjs
git commit -m "feat: add WarSummary component with win/loss counts"
```

---

### Task 3: Compact Event Card Variant

**Files:**

- Modify: `src/components/h1/Event/Event.jsx`
- Modify: `src/components/h1/Event/Event.css`

- [ ] **Step 1: Add `compact` prop to Event component**

In `src/components/h1/Event/Event.jsx`, make these changes:

1. Change function signature from `Event({ event })` to `Event({ event, compact = false })`

2. Add after the `statusText` declaration:

```js
const isResolved = event.status !== 'active';
const showCompact = compact && isResolved;
```

3. Add `showCompact` to the article className:

```jsx
className={`event-card ${isDefend ? 'event-card--defend' : 'event-card--attack'} event-card--${event.status}${showCompact ? ' event-card--compact' : ''}`}
```

4. Wrap the progress text in a condition:

```jsx
{
    !showCompact && progress && (
        <div className="event-card-progress-text">{progress}</div>
    );
}
```

5. Wrap the progress bar in a condition:

```jsx
{
    !showCompact && (
        <div className="event-card-bar-track">
            <div
                className="event-card-bar-fill"
                style={{ width: `${Math.min(100, percent)}%` }}
            />
        </div>
    );
}
```

- [ ] **Step 2: Add compact CSS variant**

Append to `src/components/h1/Event/Event.css`:

```css
/* Compact variant — resolved events in timeline */
.event-card--compact .event-card-content {
    padding: 0.375rem 0.625rem;
}

.event-card--compact .event-card-points {
    font-size: 0.5rem;
}
```

- [ ] **Step 3: Run build to verify**

Run: `npm run build 2>&1 | tail -10`
Expected: Build succeeds

- [ ] **Step 4: Commit**

```bash
git add src/components/h1/Event/Event.jsx src/components/h1/Event/Event.css
git commit -m "feat: add compact variant to Event card for resolved events"
```

---

### Task 4: TimelineSection Component

**Files:**

- Create: `src/components/h1/Timeline/TimelineSection.jsx`
- Create: `src/components/h1/Timeline/TimelineSection.css`

- [ ] **Step 1: Create TimelineSection component**

```jsx
// src/components/h1/Timeline/TimelineSection.jsx
import './TimelineSection.css';
import Event from '@/components/h1/Event/Event';
import { groupEventsByDay } from '@/utils/groupEventsByDay.mjs';

export default function TimelineSection({ events }) {
    const groups = groupEventsByDay(events);

    if (groups.length === 0) return null;

    return (
        <section className="timeline-section">
            <div className="timeline-content gutters">
                <h2 className="timeline-heading">Event Log</h2>
                <div className="timeline-rail">
                    <div className="rail-line" aria-hidden="true">
                        {events
                            .sort((a, b) => b.start_time - a.start_time)
                            .map((event) => (
                                <span
                                    key={event.event_id}
                                    className={`rail-dot rail-dot--${event.status}`}
                                />
                            ))}
                    </div>
                    <div className="timeline-groups">
                        {groups.map((group) => (
                            <div key={group.date} className="timeline-day">
                                <h3 className="timeline-day-label">{group.label}</h3>
                                <div className="timeline-day-grid">
                                    {group.events.map((event) => (
                                        <Event
                                            key={event.event_id}
                                            event={event}
                                            compact
                                        />
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </section>
    );
}
```

- [ ] **Step 2: Create TimelineSection CSS**

```css
/* src/components/h1/Timeline/TimelineSection.css */

.timeline-section {
    padding-top: 1.5rem;
    padding-bottom: 1.5rem;
}

.timeline-heading {
    margin-bottom: 1rem;
}

/* === Rail layout === */

.timeline-rail {
    display: flex;
    gap: 1rem;
}

.rail-line {
    display: flex;
    flex-direction: column;
    align-items: center;
    width: 12px;
    flex-shrink: 0;
    background: linear-gradient(
        to bottom,
        transparent 0px,
        var(--color-ghost-border) 4px,
        var(--color-ghost-border) calc(100% - 4px),
        transparent 100%
    );
    background-size: 1px 100%;
    background-position: center;
    background-repeat: no-repeat;
    gap: 1.5rem;
    padding-top: 4px;
}

.rail-dot {
    width: 8px;
    height: 8px;
    flex-shrink: 0;
}

.rail-dot--active {
    background: var(--color-primary);
}

.rail-dot--success {
    background: var(--color-success);
}

.rail-dot--fail {
    background: var(--color-danger);
}

.timeline-groups {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
}

/* === Day groups === */

.timeline-day-label {
    font-family: var(--font-mono);
    font-size: 0.6875rem;
    font-weight: 700;
    color: var(--color-text-muted);
    letter-spacing: 0.05em;
    text-transform: uppercase;
    margin-bottom: 0.5rem;
}

.timeline-day-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 0.5rem;
}

/* === Responsive grid === */

@media (min-width: 640px) {
    .timeline-day-grid {
        grid-template-columns: repeat(2, minmax(0, 1fr));
    }
}

@media (min-width: 1024px) {
    .timeline-section {
        overflow-y: auto;
        padding-top: 2rem;
        padding-bottom: 2rem;
    }

    .timeline-day-grid {
        grid-template-columns: repeat(2, minmax(0, 1fr));
    }
}

@media (min-width: 1280px) {
    .timeline-day-grid {
        grid-template-columns: repeat(3, minmax(0, 1fr));
    }
}
```

- [ ] **Step 3: Run build to verify**

Run: `npm run build 2>&1 | tail -10`
Expected: Build succeeds

- [ ] **Step 4: Commit**

```bash
git add src/components/h1/Timeline/
git commit -m "feat: add TimelineSection with vertical rail and date grouping"
```

---

### Task 5: Update DashboardClient — Remove Timeline, Add WarSummary

**Files:**

- Modify: `src/components/h1/Dashboard/DashboardClient.jsx`

- [ ] **Step 1: Update imports and sidebar content**

In `src/components/h1/Dashboard/DashboardClient.jsx`:

1. Add import:

```jsx
import WarSummary from '@/components/h1/WarSummary/WarSummary';
```

2. Remove unused Event import:

```jsx
// Delete this line:
import Event from '@/components/h1/Event/Event';
```

3. Inside `.dashboard-sidebar`, replace the timeline section block:

**Remove** (the `{events?.length > 0 && (...)}` block with `<h2>Event Timeline</h2>` and the events list)

**Replace with:**

```jsx
<WarSummary events={events} />
```

4. Add a scroll hint div as the last child inside `.dashboard`:

```jsx
<div className="dashboard-scroll-hint">
    <span>↓ event log</span>
</div>
```

- [ ] **Step 2: Update DashboardClient.css for scroll hint**

In the lg: media query, update the grid template areas and rows:

```css
grid-template-areas:
    'alerts  alerts'
    'updated updated'
    'sidebar map'
    'hint    hint';
grid-template-rows: auto auto minmax(0, 1fr) auto;
```

Add these styles (outside any media query for the base, inside lg: for the display):

```css
.dashboard-scroll-hint {
    grid-area: hint;
    display: none;
}
```

Inside the `@media (min-width: 1024px)` block:

```css
.dashboard-scroll-hint {
    display: flex;
    justify-content: center;
    padding: 0.5rem;
    color: var(--color-text-muted);
    font-family: var(--font-mono);
    font-size: 0.75rem;
    opacity: 0.5;
}
```

- [ ] **Step 3: Run build and tests**

Run: `npm run build 2>&1 | tail -10 && npm run test:unit:run 2>&1 | tail -10`
Expected: Build succeeds, all tests pass

- [ ] **Step 4: Commit**

```bash
git add src/components/h1/Dashboard/DashboardClient.jsx src/components/h1/Dashboard/DashboardClient.css
git commit -m "feat: replace timeline with WarSummary in sidebar, add scroll hint"
```

---

### Task 6: Snap Scroll Container in Page

**Files:**

- Modify: `src/app/page.jsx`
- Modify: `src/app/page.css`

- [ ] **Step 1: Update page.jsx — add snap scroll wrapper and TimelineSection**

1. Add import:

```jsx
import TimelineSection from '@/components/h1/Timeline/TimelineSection';
```

2. Replace the return JSX. The current return is:

```jsx
return (
    <>
        <div className="gutters pt-4 pb-2 lg:hidden">...hero text...</div>
        <DashboardClient data={data} mapState={mapState} />
    </>
);
```

Replace with:

```jsx
return (
    <div className="live-page">
        <div className="gutters pt-4 pb-2 lg:hidden">
            <h1 className="font-[family-name:var(--font-display)] text-sm text-[var(--color-primary)]">
                Track Managed Democracy Across the Galaxy
            </h1>
            <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                Don&apos;t miss a moment of the action! Follow the Helldivers&apos;
                campaign progress as they battle the Bugs, Cyborgs, and Illuminate for
                peace, liberty, and managed democracy. See which sectors are under siege,
                which are liberated, and where your next mission awaits.
            </p>
        </div>
        <div className="snap-screen">
            <DashboardClient data={data} mapState={mapState} />
        </div>
        <div className="snap-screen">
            <TimelineSection events={data.events} />
        </div>
    </div>
);
```

Note: Pass `data.events` (all events, not just active) to TimelineSection.

- [ ] **Step 2: Update page.css for snap scroll**

Replace the existing `@media (min-width: 1024px)` block in `src/app/page.css` with:

```css
/* At desktop, snap scroll between dashboard and timeline */
@media (min-width: 1024px) {
    main {
        min-height: auto;
    }

    .live-page {
        scroll-snap-type: y mandatory;
        overflow-y: auto;
        height: calc(100dvh - 80px);
    }

    .live-page > .snap-screen {
        scroll-snap-align: start;
        min-height: calc(100dvh - 80px);
    }
}
```

Note: The `footer { display: none }` rule is removed — the footer returns below the snap container.

- [ ] **Step 3: Run build and tests**

Run: `npm run build 2>&1 | tail -10 && npm run test:unit:run 2>&1 | tail -10`
Expected: Build succeeds, all tests pass

- [ ] **Step 4: Commit**

```bash
git add src/app/page.jsx src/app/page.css
git commit -m "feat: add snap scroll container with TimelineSection below dashboard"
```

---

### Task 7: Visual Verification at All Breakpoints

**Files:** None (read-only verification)

- [ ] **Step 1: Ask user to start dev server if needed**

- [ ] **Step 2: Verify mobile (375x812)**

Using Chrome DevTools MCP:

- Single column: hero → map → campaigns → stats → war summary → timeline
- Timeline has vertical rail with date groups
- Event cards are 1-column grid
- Normal page scroll (no snap)

- [ ] **Step 3: Verify tablet (768x1024)**

- Single column, wider cards
- Timeline grid is 2 columns at sm:
- Normal scroll, no snap

- [ ] **Step 4: Verify desktop lg: (1024x768)**

- Screen 1: dashboard (sidebar left + map right), scroll hint at bottom
- Snap scroll to screen 2: full-width timeline with rail, 2-col grid
- WarSummary visible in sidebar

- [ ] **Step 5: Verify xl: (1280x800)**

- Same snap behavior, sidebar 300px
- Timeline grid may be 3 columns

- [ ] **Step 6: Verify 3xl: (1920x1080)**

- Dashboard centered with dynamic max-width
- Timeline full-width with 3-col grid

- [ ] **Step 7: Fix any issues found and commit**

---

### Task 8: Final Build + Test + Format

- [ ] **Step 1: Run Prettier**

Run: `npm run format`

- [ ] **Step 2: Run build**

Run: `npm run build 2>&1 | tail -10`
Expected: Build succeeds

- [ ] **Step 3: Run all tests**

Run: `npm run test:unit:run 2>&1 | tail -10`
Expected: All tests pass

- [ ] **Step 4: Commit any formatting changes**

- [ ] **Step 5: Push and create PR**

```bash
git push -u origin feature/timeline-visual-redesign
gh pr create --base develop --title "feat: timeline visual redesign (#165)" --body "..."
```
