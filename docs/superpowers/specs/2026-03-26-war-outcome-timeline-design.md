# War Outcome & Interactive Timeline

**Date:** 2026-03-26
**Page:** `/war?season=N` only (not homepage)

## Overview

Show whether a historical season ended in Victory or Defeat, and provide an interactive timeline that lets users click through the war's progression, animating the Galaxy map to reflect the state at each point in time.

## Win/Loss Logic

- **Victory:** all 3 factions in `data.live` have `status === 'defeated'`
- **Defeat:** any event in `data.events` has `type === 'defend'`, `region === 0`, `status === 'fail'`
- **Active:** neither condition met — no banner shown (ongoing season)

## Components

### 1. War Outcome Banner

Added to the `War` component (`src/components/h1/War/War.jsx`), rendered above the existing stats. Only shown on `/war?season=N`.

- Displays "Victory" or "Defeat" with a brief description
- Shows per-faction status indicators (defeated vs still active when the war ended)
- Derives outcome from `data.live[].status` and `data.events[]`

### 2. WarTimeline Component

New client component: `src/components/h1/WarTimeline/WarTimeline.jsx`

**Data input:** Receives `data` prop (same campaign data the page already fetches — includes `snapshots[]` and `events[]`).

**Timeline construction:**

1. Merge `h1_snapshot` entries and `h1_event` entries into a single chronological array, sorted by time
2. Each item becomes a clickable point on a horizontal timeline bar
3. Events get labeled markers (e.g., "Defend: Bugs region 3", "Attack: Cyborgs homeworld", "Faction defeated")
4. Snapshots get smaller unlabeled dots between events

**State management:**

- Owns `selectedMoment` state (React `useState`)
- When a moment is clicked, calls `computeMapState()` with that moment's data
- Passes computed map state down to Galaxy/Map
- Default state (no selection): Galaxy shows final season state from `data.live`

### 3. computeMapState Utility

New pure function: `src/utils/computeMapState.mjs`

Extracted from Galaxy's current mutation logic (`processCampaigns`, `processDefendEvents`, `processAttackEvents`).

**Input:** Per-faction state at a moment in time (points, points_taken, status per faction) + relevant events active at that timestamp.

**Output:** New map object (deep clone of the map template). No mutation of shared state.

**Consumers:**
- Homepage `/` — called with `data.live` (current state), same behavior as today
- `/war` page default — called with `data.live` (final season state)
- `/war` page timeline click — called with selected moment's snapshot data + events

### 4. Galaxy Refactor

`Galaxy.jsx` currently imports the `map` enum and mutates it directly. Refactor to:

- Accept computed map state as a prop
- Remove internal `processCampaigns()`, `processDefendEvents()` calls
- `Map.jsx` and `Tooltip.jsx` are unchanged (already receive map as props)

## Data Flow on `/war?season=N`

### Server (page load):

1. `getCampaign(season)` fetches season with `live[]`, `events[]`, `snapshots[]`
2. Server renders War component with outcome banner + stats
3. Passes all data to client components

### Client (interaction):

1. `WarTimeline` builds merged chronological timeline from snapshots + events
2. Default: no moment selected — Galaxy shows final season state
3. User clicks timeline moment → `computeMapState()` → Galaxy re-renders
4. CSS transitions on SVG region fills/opacities provide smooth animation

### Component tree on `/war`:

```
WarHistoryPage (server)
  ├── SeasonSelector
  ├── War (server) — outcome banner + stats
  ├── Timeline (existing, unchanged)
  ├── WarTimeline (client) — owns selectedMoment state
  │   └── Galaxy (client) — receives computed map state as prop
  │       ├── Map
  │       └── Tooltip
```

Galaxy moves inside WarTimeline on `/war` so WarTimeline controls the map data. On the homepage, Galaxy stays where it is and receives `data.live` directly.

## Data Sources

All historical data comes from the `get_snapshots` API call (single source of truth for completed seasons), stored as:

- `h1_snapshot` — periodic faction state: `points`, `points_taken`, `status` per faction at each timestamp
- `h1_event` — attack/defend events with `start_time`, `end_time`, `region`, `enemy`, `status`, `points`, `points_max`

Snapshot timestamps and event timestamps do not align — they are merged and sorted chronologically to build the timeline.

## Edge Cases

- **No snapshots:** Season freshly created, historical data not fetched. Show banner if determinable from `data.live`, hide timeline.
- **Active season:** No victory/defeat yet. No banner. Timeline shows events so far (low priority).
- **Super Earth defend loss:** Must check `data.events` for `type === 'defend'`, `region === 0`, `status === 'fail'` — not derivable from faction statuses alone.

## Out of Scope

- Auto-play / play-pause controls (manual click only)
- Timeline on the homepage
- Stats panel updating per timeline moment (stays as season totals)
- Scroll-driven animation
- `h1_live_snapshot` schema gap fix
- WebSocket / live updates
- Mobile-specific timeline UX
