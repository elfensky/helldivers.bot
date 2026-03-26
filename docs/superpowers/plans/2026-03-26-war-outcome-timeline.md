# War Outcome & Interactive Timeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a war outcome banner and interactive timeline to `/war?season=N` that lets users click through historical war moments, animating the Galaxy map to each state.

**Architecture:** Extract Galaxy's map mutation logic into a pure `computeMapState` utility. Add a `WarTimeline` client component that owns timeline state and wraps Galaxy. Add a `WarOutcome` banner to the War component. The homepage stays unchanged.

**Tech Stack:** React 19, Next.js 16, CSS transitions on SVG

---

## File Structure

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `src/utils/computeMapState.mjs` | Pure function: given faction state + events at a point in time, returns a new map object |
| Create | `src/components/h1/WarTimeline/WarTimeline.jsx` | Client component: timeline UI, selectedMoment state, wraps Galaxy |
| Create | `src/components/h1/WarTimeline/WarTimeline.css` | Timeline styling |
| Modify | `src/components/h1/Galaxy/Galaxy.jsx` | Accept `mapState` prop instead of computing internally |
| Modify | `src/components/h1/Galaxy/Map.css` | Add CSS transitions for smooth state changes |
| Modify | `src/components/h1/War/War.jsx` | Add WarOutcome banner above stats |
| Modify | `src/components/h1/War/War.css` | Banner styling |
| Modify | `src/app/war/page.jsx` | Wire up WarTimeline wrapping Galaxy |
| Modify | `src/app/page.jsx` | Pass computed map state to Galaxy (maintain current behavior) |

---

### Task 1: Extract `computeMapState` utility

This task extracts the map computation logic from `Galaxy.jsx` into a reusable pure function. The key change: instead of mutating the shared `map` import, we deep-clone the template and return a new object.

**Files:**
- Create: `src/utils/computeMapState.mjs`

- [ ] **Step 1: Create the `computeMapState` utility**

This function replicates the logic currently in `Galaxy.jsx`'s `processCampaigns()`, `processDefendEvents()`, and `processAttackEvents()` — but as a pure function that returns a new map object.

```js
// src/utils/computeMapState.mjs
import mapTemplate from '@/enums/map';

/**
 * Compute map state from faction data and events at a point in time.
 * Returns a NEW map object — never mutates the template.
 *
 * @param {Array} factionStates - Array of 3 objects: { enemy, points, points_taken, points_max, status }
 * @param {Array} events - Array of event objects: { type, event_id, start_time, end_time, region, enemy, points, points_max, status }
 * @returns {Object} Deep clone of map template with computed state
 */
export function computeMapState(factionStates, events = []) {
    const map = JSON.parse(JSON.stringify(mapTemplate));

    // Process campaigns (same logic as Galaxy.jsx processCampaigns)
    for (const campaign of factionStates) {
        const faction = campaign.enemy;
        const sectorCount = 10;
        const pointsMax = campaign.points_max > 0 ? campaign.points_max : 1;
        const points = campaign.points;
        const pointsPerSector = pointsMax / sectorCount;

        const sectorsEarned = Math.trunc(points / pointsPerSector);
        const sectorsInProgress = sectorsEarned + 1;

        if (campaign.status === 'active') {
            for (const regionKey of Object.keys(map[faction])) {
                const region = parseInt(regionKey);
                if (region === 11) {
                    map[faction][region].status = 'lost';
                    map[faction][region].percent = 0;
                } else if (region === sectorsInProgress) {
                    const totalPointsForSector = region * pointsPerSector;
                    const remainingPoints = points - (totalPointsForSector - pointsPerSector);
                    map[faction][region].status = 'in_progress';
                    map[faction][region].points = points;
                    map[faction][region].points_max = totalPointsForSector;
                    map[faction][region].points_sector = remainingPoints;
                    map[faction][region].points_sector_max = pointsPerSector;
                    map[faction][region].percent = (remainingPoints / pointsPerSector) * 100;
                } else if (region <= sectorsEarned) {
                    const totalPointsForSector = region * pointsPerSector;
                    map[faction][region].status = 'captured';
                    map[faction][region].points = totalPointsForSector;
                    map[faction][region].points_max = totalPointsForSector;
                    map[faction][region].points_sector = pointsPerSector;
                    map[faction][region].points_sector_max = pointsPerSector;
                    map[faction][region].percent = 100;
                } else {
                    const totalPointsForSector = region * pointsPerSector;
                    map[faction][region].status = 'lost';
                    map[faction][region].points = points;
                    map[faction][region].points_max = totalPointsForSector;
                    map[faction][region].points_sector = 0;
                    map[faction][region].points_sector_max = pointsPerSector;
                    map[faction][region].percent = 0;
                }
            }
        } else if (campaign.status === 'defeated') {
            // All regions captured when faction is defeated
            for (const regionKey of Object.keys(map[faction])) {
                const region = parseInt(regionKey);
                map[faction][region].status = 'captured';
                map[faction][region].percent = 100;
            }
        } else {
            // hidden or other — all lost
            for (const regionKey of Object.keys(map[faction])) {
                map[faction][regionKey].status = 'lost';
                map[faction][regionKey].percent = 0;
            }
        }
    }

    // Process defend events
    const defendEvents = events.filter((e) => e.type === 'defend');
    for (const event of defendEvents) {
        if (event.region === 0) {
            if (event.status === 'active') {
                map[3][0].event = 'active';
                map[3][0].status = 'active';
            }
        } else if (event.region !== undefined) {
            if (event.status === 'active') {
                map[event.enemy][event.region].event = 'active';
            } else {
                map[event.enemy][event.region].event = 'idle';
            }
        }
    }

    // Process attack events
    const attackEvents = events.filter((e) => e.type === 'attack');
    for (const event of attackEvents) {
        if (event.status === 'active') {
            map[event.enemy][11].percent = (event.points / event.points_max) * 100;
            map[event.enemy][11].points = event.points;
            map[event.enemy][11].points_max = event.points_max;
            map[event.enemy][11].status = 'in_progress active';
            map[event.enemy][11].event = event;
        }
        if (event.status === 'success') {
            map[event.enemy][11].percent = (event.points / event.points_max) * 100;
            map[event.enemy][11].points = event.points;
            map[event.enemy][11].points_max = event.points_max;
            map[event.enemy][11].status = 'captured';
            map[event.enemy][11].event = event;
        }
    }

    return map;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/utils/computeMapState.mjs
git commit -m "feat: extract computeMapState pure utility from Galaxy"
```

---

### Task 2: Refactor Galaxy to accept map state as prop

Remove the internal map mutation from `Galaxy.jsx`. It now receives a pre-computed `mapState` prop.

**Files:**
- Modify: `src/components/h1/Galaxy/Galaxy.jsx`

- [ ] **Step 1: Refactor Galaxy.jsx**

Replace the entire file with:

```jsx
// src/components/h1/Galaxy/Galaxy.jsx
'use client';
import { useRef } from 'react';
import Map from '@/components/h1/Galaxy/Map';
import Tooltip from '@/components/h1/Galaxy/Tooltip';

export default function Galaxy({ mapState }) {
    const svgRef = useRef(null);

    return (
        <section
            id="galaxy"
            className="mx-4 mb-4 flex flex-grow-[4] flex-col items-center gap-4 sm:mx-0"
        >
            <Map svgRef={svgRef} map={mapState} />
            <Tooltip svgRef={svgRef} data={null} map={mapState} />
        </section>
    );
}
```

Note: `Tooltip` currently receives `data` but only uses `map` for rendering. Pass `null` for `data` — Tooltip only reads from the `map` prop for region names, points, and percentages.

- [ ] **Step 2: Commit**

```bash
git add src/components/h1/Galaxy/Galaxy.jsx
git commit -m "refactor: Galaxy accepts mapState prop instead of computing internally"
```

---

### Task 3: Update homepage to compute map state before passing to Galaxy

The homepage (`/`) must now call `computeMapState` and pass the result to Galaxy as `mapState`.

**Files:**
- Modify: `src/app/page.jsx`

- [ ] **Step 1: Update page.jsx**

Add the import and compute the map state before rendering:

```jsx
// src/app/page.jsx
import './page.css';
import { tryCatch } from '@/utils/tryCatch.mjs';
import { getCampaign } from '@/db/queries/getCampaign';
import { computeMapState } from '@/utils/computeMapState.mjs';
import Galaxy from '@/components/h1/Galaxy/Galaxy';
import War from '@/components/h1/War/War';
import Timeline from '@/components/h1/Timeline/Timeline';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
    const { data, error } = await tryCatch(getCampaign());

    if (error !== null) {
        console.error('getCampaign failed:', error);
        return (
            <div className="flex min-h-full w-full flex-col-reverse justify-center sm:flex-row">
                Unable to load campaign data. Please try again later.
            </div>
        );
    }

    if (!data) {
        return (
            <div className="flex min-h-full w-full flex-col-reverse justify-center sm:flex-row">
                Loading...
            </div>
        );
    }

    const mapState = computeMapState(data.live, data.events);

    return (
        <div className="gutters z-10 flex w-screen flex-col-reverse justify-between gap-4 overflow-hidden xl:fixed xl:top-[80px] xl:max-h-[calc(100vh-80px-16px)] xl:flex-row xl:flex-wrap">
            <War data={data} />
            <Timeline data={data} />
            <Galaxy mapState={mapState} />
        </div>
    );
}
```

- [ ] **Step 2: Run build to verify homepage still works**

```bash
npm run build
```

Expected: Build succeeds with no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/page.jsx
git commit -m "feat: homepage computes mapState via utility before passing to Galaxy"
```

---

### Task 4: Add CSS transitions to Map for smooth state changes

Add `transition` properties to the SVG sector classes so state changes animate smoothly.

**Files:**
- Modify: `src/components/h1/Galaxy/Map.css`

- [ ] **Step 1: Add transitions to sector classes**

Add a `transition` property to the `.sector` base class in `Map.css`:

```css
.sector {
    stroke-width: 2px;
    stroke-linecap: round;
    stroke-linejoin: round;
    transition: fill 0.5s ease, stroke 0.5s ease, stroke-width 0.3s ease;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/h1/Galaxy/Map.css
git commit -m "feat: add CSS transitions to map sectors for smooth state changes"
```

---

### Task 5: Add War Outcome banner

Add victory/defeat detection and a banner to the War component. Only shown when `showOutcome` prop is true (set by `/war` page, not homepage).

**Files:**
- Modify: `src/components/h1/War/War.jsx`
- Modify: `src/components/h1/War/War.css`

- [ ] **Step 1: Add outcome logic and banner to War.jsx**

Add `WarOutcome` function and `getWarOutcome` helper. Modify the `War` component to accept a `showOutcome` prop:

```jsx
// src/components/h1/War/War.jsx
import './War.css';
import factions from '@/enums/factions';

export default function War({ data, showOutcome = false }) {
    if (!data) return null;

    return (
        <section className="flex flex-col gap-4">
            <h2>War Stats</h2>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-2 lg:grid-cols-1">
                {showOutcome && <WarOutcome data={data} />}
                {generateGlobalWarStats(data?.live)}
                {data?.live?.map((statistic) => generateWarStats(statistic))}
            </div>
        </section>
    );
}

function getWarOutcome(data) {
    const live = data?.live || [];
    const events = data?.events || [];

    // Check defeat: Super Earth defend event failed (region 0)
    const superEarthFail = events.find(
        (e) => e.type === 'defend' && e.region === 0 && e.status === 'fail',
    );
    if (superEarthFail) {
        return { outcome: 'defeat', reason: 'Super Earth has fallen' };
    }

    // Check victory: all 3 factions defeated
    const activeFactions = live.filter((f) => f.status !== 'defeated');
    if (live.length === 3 && activeFactions.length === 0) {
        return { outcome: 'victory', reason: 'All factions defeated' };
    }

    // War still active
    return null;
}

function WarOutcome({ data }) {
    const result = getWarOutcome(data);
    if (!result) return null;

    const live = data?.live || [];

    return (
        <article
            id="war-outcome"
            className={`war-outcome flex flex-col gap-2 p-4 ${result.outcome}`}
        >
            <h3 className="text-lg font-bold">
                {result.outcome === 'victory' ? 'Victory' : 'Defeat'}
            </h3>
            <p>{result.reason}</p>
            <div className="flex gap-2">
                {live.map((faction) => (
                    <span
                        key={faction.enemy}
                        className={`faction-status ${faction.status}`}
                    >
                        <img
                            src={`/icons/faction${faction.enemy}.webp`}
                            alt={factions[faction.enemy].name}
                            width={16}
                            height={16}
                        />
                        {factions[faction.enemy].name}: {faction.status}
                    </span>
                ))}
            </div>
        </article>
    );
}
```

Keep the existing `generateGlobalWarStats` and `generateWarStats` functions unchanged — they stay exactly as they are in the current file.

- [ ] **Step 2: Add banner CSS to War.css**

Append to `src/components/h1/War/War.css`:

```css
.war-outcome {
    background-color: rgba(0, 0, 0, 0.75);
    border: 2px solid black;
    grid-column: 1 / -1;
}

.war-outcome.victory {
    border-color: rgba(255, 213, 0, 0.8);
}

.war-outcome.defeat {
    border-color: rgba(255, 0, 0, 0.8);
}

.faction-status {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    font-size: 0.875rem;
}

.faction-status.defeated {
    opacity: 0.5;
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/h1/War/War.jsx src/components/h1/War/War.css
git commit -m "feat: add war outcome banner (victory/defeat) to War component"
```

---

### Task 6: Create WarTimeline component

The core timeline component. Merges snapshots and events chronologically, renders clickable moments, owns `selectedMoment` state, and wraps Galaxy.

**Files:**
- Create: `src/components/h1/WarTimeline/WarTimeline.jsx`
- Create: `src/components/h1/WarTimeline/WarTimeline.css`

- [ ] **Step 1: Create WarTimeline.css**

```css
/* src/components/h1/WarTimeline/WarTimeline.css */
.war-timeline {
    display: flex;
    flex-direction: column;
    gap: 1rem;
}

.timeline-bar {
    display: flex;
    align-items: center;
    gap: 0;
    overflow-x: auto;
    padding: 0.5rem 0;
    position: relative;
    min-height: 3rem;
}

.timeline-track {
    display: flex;
    align-items: center;
    position: relative;
    width: 100%;
    height: 2px;
    background: rgba(255, 255, 255, 0.2);
}

.timeline-moment {
    position: absolute;
    cursor: pointer;
    border: none;
    background: rgba(255, 255, 255, 0.4);
    border-radius: 50%;
    width: 8px;
    height: 8px;
    transform: translate(-50%, -50%);
    top: 50%;
    transition: background 0.2s, transform 0.2s;
    padding: 0;
}

.timeline-moment:hover {
    background: rgba(255, 213, 0, 0.8);
    transform: translate(-50%, -50%) scale(1.5);
}

.timeline-moment.selected {
    background: rgba(255, 213, 0, 1);
    transform: translate(-50%, -50%) scale(1.5);
}

.timeline-moment.event-marker {
    width: 12px;
    height: 12px;
    background: rgba(255, 100, 0, 0.7);
}

.timeline-moment.event-marker:hover,
.timeline-moment.event-marker.selected {
    background: rgba(255, 100, 0, 1);
}

.timeline-moment.event-marker.defend {
    background: rgba(255, 50, 50, 0.7);
}

.timeline-moment.event-marker.defend:hover,
.timeline-moment.event-marker.defend.selected {
    background: rgba(255, 50, 50, 1);
}

.timeline-moment.event-marker.attack {
    background: rgba(50, 200, 50, 0.7);
}

.timeline-moment.event-marker.attack:hover,
.timeline-moment.event-marker.attack.selected {
    background: rgba(50, 200, 50, 1);
}

.timeline-label {
    font-size: 0.75rem;
    white-space: nowrap;
    padding: 0.25rem 0.5rem;
    background: rgba(0, 0, 0, 0.8);
    border: 1px solid rgba(255, 255, 255, 0.2);
    color: white;
    position: absolute;
    bottom: 100%;
    left: 50%;
    transform: translateX(-50%);
    margin-bottom: 0.25rem;
    pointer-events: none;
    display: none;
}

.timeline-moment:hover .timeline-label,
.timeline-moment.selected .timeline-label {
    display: block;
}

.timeline-info {
    font-size: 0.875rem;
    padding: 0.5rem;
    background: rgba(0, 0, 0, 0.75);
    border: 1px solid rgba(255, 255, 255, 0.15);
}
```

- [ ] **Step 2: Create WarTimeline.jsx**

```jsx
// src/components/h1/WarTimeline/WarTimeline.jsx
'use client';
import { useState, useMemo } from 'react';
import './WarTimeline.css';
import { computeMapState } from '@/utils/computeMapState.mjs';
import Galaxy from '@/components/h1/Galaxy/Galaxy';
import factions from '@/enums/factions';

export default function WarTimeline({ data, defaultMapState }) {
    const [selectedIndex, setSelectedIndex] = useState(null);

    const moments = useMemo(() => buildTimeline(data), [data]);

    const currentMapState = useMemo(() => {
        if (selectedIndex === null || !moments[selectedIndex]) {
            return defaultMapState;
        }
        return computeMomentMapState(moments[selectedIndex], data);
    }, [selectedIndex, moments, data, defaultMapState]);

    if (!moments || moments.length === 0) {
        return <Galaxy mapState={defaultMapState} />;
    }

    const selected = selectedIndex !== null ? moments[selectedIndex] : null;

    return (
        <div className="war-timeline">
            <div className="timeline-bar">
                <div className="timeline-track">
                    {moments.map((moment, i) => {
                        const percent =
                            moments.length > 1
                                ? (i / (moments.length - 1)) * 100
                                : 50;

                        const isEvent = moment.kind === 'event';
                        const classes = [
                            'timeline-moment',
                            isEvent ? 'event-marker' : '',
                            isEvent ? moment.event.type : '',
                            selectedIndex === i ? 'selected' : '',
                        ]
                            .filter(Boolean)
                            .join(' ');

                        return (
                            <button
                                key={`${moment.kind}-${moment.time}-${i}`}
                                className={classes}
                                style={{ left: `${percent}%` }}
                                onClick={() =>
                                    setSelectedIndex(
                                        selectedIndex === i ? null : i,
                                    )
                                }
                                title={moment.label}
                            >
                                <span className="timeline-label">
                                    {moment.label}
                                </span>
                            </button>
                        );
                    })}
                </div>
            </div>

            {selected && (
                <div className="timeline-info">
                    <span>{selected.label}</span>
                    {' — '}
                    <span>
                        {new Date(selected.time * 1000).toLocaleString()}
                    </span>
                </div>
            )}

            <Galaxy mapState={currentMapState} />
        </div>
    );
}

/**
 * Build a sorted array of timeline moments from snapshots + events.
 */
function buildTimeline(data) {
    const moments = [];

    // Add snapshot moments
    const snapshots = data?.snapshots || [];
    for (const snapshot of snapshots) {
        moments.push({
            kind: 'snapshot',
            time: snapshot.time,
            snapshot,
            label: 'Snapshot',
        });
    }

    // Add event moments (start + end as separate moments)
    const events = data?.events || [];
    for (const event of events) {
        // Add event start
        moments.push({
            kind: 'event',
            time: event.start_time,
            event,
            label: formatEventLabel(event, 'start'),
        });
        // Add event end (if resolved and different from start)
        if (event.status !== 'active' && event.end_time !== event.start_time) {
            moments.push({
                kind: 'event',
                time: event.end_time,
                event,
                label: formatEventLabel(event, 'end'),
            });
        }
    }

    // Sort chronologically
    moments.sort((a, b) => a.time - b.time);

    return moments;
}

function formatEventLabel(event, phase) {
    const factionName =
        factions[event.enemy]?.name || `Faction ${event.enemy}`;
    const typeLabel = event.type === 'defend' ? 'Defend' : 'Attack';

    if (phase === 'start') {
        return `${typeLabel} begins: ${factionName}`;
    }
    // phase === 'end'
    const outcomeLabel = event.status === 'success' ? 'Won' : 'Failed';
    return `${typeLabel} ${outcomeLabel}: ${factionName}`;
}

/**
 * Compute map state for a given timeline moment.
 * Uses the snapshot data at or before this moment + events active at this time.
 */
function computeMomentMapState(moment, data) {
    const snapshots = data?.snapshots || [];
    const events = data?.events || [];
    const pointsMax = data?.points_max?.points || [0, 0, 0];

    // Find the nearest snapshot at or before this moment's time
    let nearestSnapshot = null;
    for (const s of snapshots) {
        if (s.time <= moment.time) {
            if (!nearestSnapshot || s.time > nearestSnapshot.time) {
                nearestSnapshot = s;
            }
        }
    }

    // If we have a snapshot moment itself, use it directly
    if (moment.kind === 'snapshot') {
        nearestSnapshot = moment.snapshot;
    }

    if (!nearestSnapshot) {
        // No snapshot data available — fall back to hidden state
        return computeMapState(
            [
                {
                    enemy: 0,
                    points: 0,
                    points_taken: 0,
                    points_max: pointsMax[0] || 0,
                    status: 'hidden',
                },
                {
                    enemy: 1,
                    points: 0,
                    points_taken: 0,
                    points_max: pointsMax[1] || 0,
                    status: 'hidden',
                },
                {
                    enemy: 2,
                    points: 0,
                    points_taken: 0,
                    points_max: pointsMax[2] || 0,
                    status: 'hidden',
                },
            ],
            [],
        );
    }

    // Parse snapshot data (stringified JSON array of 3 faction states)
    const factionData =
        typeof nearestSnapshot.data === 'string'
            ? JSON.parse(nearestSnapshot.data)
            : nearestSnapshot.data;

    // Build faction states with enemy index and points_max from season data
    const factionStates = factionData.map((f, i) => ({
        enemy: i,
        points: f.points,
        points_taken: f.points_taken,
        points_max: pointsMax[i] || 0,
        status: f.status,
    }));

    // Find events active at this moment's time
    const activeEvents = events
        .filter((e) => {
            if (moment.time < e.start_time) return false;
            // Event is over — include only if success (to show captured state)
            if (moment.time >= e.end_time) {
                return e.status === 'success';
            }
            // Event is ongoing at this time
            return true;
        })
        .map((e) => {
            // If event hasn't ended yet at this moment, show as active
            if (moment.time < e.end_time) {
                return { ...e, status: 'active' };
            }
            return e;
        });

    return computeMapState(factionStates, activeEvents);
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/h1/WarTimeline/WarTimeline.jsx src/components/h1/WarTimeline/WarTimeline.css
git commit -m "feat: add WarTimeline component with clickable moments and Galaxy integration"
```

---

### Task 7: Wire up `/war` page

Update the war history page to use WarTimeline (wrapping Galaxy) and pass `showOutcome` to War.

**Files:**
- Modify: `src/app/war/page.jsx`

- [ ] **Step 1: Update war/page.jsx**

Replace the component imports and render section. Key changes:
1. Import `computeMapState` and `WarTimeline`
2. Compute `defaultMapState` from `data.live`
3. Replace standalone `<Galaxy>` with `<WarTimeline>` (which renders Galaxy internally)
4. Pass `showOutcome` to `<War>`

The full updated file:

```jsx
// src/app/war/page.jsx
import './war.css';
import { tryCatch } from '@/utils/tryCatch.mjs';
import { getCampaign } from '@/db/queries/getCampaign';
import { getSeasonList } from '@/db/queries/getSeasonList';
import { computeMapState } from '@/utils/computeMapState.mjs';
import War from '@/components/h1/War/War';
import Timeline from '@/components/h1/Timeline/Timeline';
import WarTimeline from '@/components/h1/WarTimeline/WarTimeline';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export const metadata = {
    metadataBase: 'https://helldivers.bot/war',
    title: 'War History | Helldivers Bot - past campaign data',
    description:
        'Browse historical Helldivers 1 war data. View past seasons, campaign outcomes, and event logs.',
};

export default async function WarHistoryPage({ searchParams }) {
    const params = await searchParams;
    const seasonParam = params?.season ? parseInt(params.season, 10) : null;

    const { data: seasons, error: seasonsError } = await tryCatch(getSeasonList());

    if (seasonsError !== null) {
        console.error('getSeasonList failed:', seasonsError);
        return (
            <div className="flex min-h-full w-full flex-col justify-center">
                Unable to load season list. Please try again later.
            </div>
        );
    }

    const { data, error } = await tryCatch(getCampaign(seasonParam));

    if (error !== null) {
        console.error('getCampaign failed:', error);
        return (
            <div className="flex min-h-full w-full flex-col justify-center">
                Unable to load campaign data. Please try again later.
            </div>
        );
    }

    if (!data) {
        return (
            <div className="flex min-h-full w-full flex-col justify-center">
                No data available.
            </div>
        );
    }

    const currentSeason = data.season;
    const defaultMapState = computeMapState(data.live, data.events);

    return (
        <div className="gutters z-10 flex w-screen flex-col gap-4 overflow-hidden">
            <JsonLd />

            <SeasonSelector seasons={seasons} currentSeason={currentSeason} />

            <div className="flex flex-col-reverse justify-between gap-4 xl:flex-row xl:flex-wrap">
                <War data={data} showOutcome={true} />
                <Timeline data={data} />
                <WarTimeline data={data} defaultMapState={defaultMapState} />
            </div>
        </div>
    );
}

function SeasonSelector({ seasons, currentSeason }) {
    if (!seasons || seasons.length === 0) return null;

    return (
        <nav className="flex flex-wrap items-center gap-2">
            <span className="text-sm opacity-70">Season:</span>
            {seasons.map((s) => (
                <Link
                    key={s.season}
                    href={`/war?season=${s.season}`}
                    className={`rounded px-3 py-1 text-sm ${
                        s.season === currentSeason ?
                            'bg-[var(--orange)] text-black'
                        :   'bg-white/10 hover:bg-white/20'
                    }`}
                >
                    {s.season}
                </Link>
            ))}
        </nav>
    );
}

function JsonLd() {
    // Static JSON-LD structured data for SEO — no user input, safe to inline
    const structuredData = [
        {
            '@context': 'https://schema.org',
            '@type': 'WebApplication',
            applicationCategory: ['GameUtility', 'GameInformation', 'Entertainment'],
            url: 'https://helldivers.bot/war',
            name: 'War History | Helldivers Bot',
            author: 'Andrei Lavrenov',
            description:
                'Browse historical Helldivers 1 war data. View past seasons, campaign outcomes, and event logs.',
            offers: {
                '@type': 'Offer',
                price: 0.0,
                priceCurrency: 'EUR',
            },
        },
        {
            '@context': 'https://schema.org',
            '@type': 'BreadcrumbList',
            itemListElement: [
                {
                    '@type': 'ListItem',
                    position: 1,
                    name: 'War History',
                    item: 'https://helldivers.bot/war',
                },
            ],
        },
    ];

    return (
        <script
            type="application/ld+json"
            // Static structured data, no user input
            dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
        />
    );
}
```

- [ ] **Step 2: Run build to verify everything compiles**

```bash
npm run build
```

Expected: Build succeeds with no errors.

- [ ] **Step 3: Run smoke tests**

```bash
npm run test:smoke
```

Expected: All smoke tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/app/war/page.jsx
git commit -m "feat: wire up WarTimeline and war outcome banner on /war page"
```

---

### Task 8: Final verification and format

Run formatting and full verification.

**Files:**
- All modified/created files

- [ ] **Step 1: Run Prettier**

```bash
npm run format
```

- [ ] **Step 2: Run build**

```bash
npm run build
```

Expected: Build succeeds.

- [ ] **Step 3: Run smoke tests**

```bash
npm run test:smoke
```

Expected: All smoke tests pass.

- [ ] **Step 4: Commit any formatting changes**

```bash
git add -A
git commit -m "chore: format war outcome and timeline files"
```
