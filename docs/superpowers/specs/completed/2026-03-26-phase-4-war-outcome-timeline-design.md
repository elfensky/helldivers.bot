# Phase 4 — War Outcome & Interactive Timeline

**Date:** 2026-03-26
**Page:** `/war?season=N` only (not homepage)

> Depends on: Phase 1 (normalized tables), Phase 2 (snapshot capture), Phase 3 (API keys).
> Does not modify any database tables.

## Overview

Show whether a historical season ended in Victory or Defeat, and provide an interactive timeline that lets users scrub through the war's progression, updating the Galaxy map to reflect the state at each point in time.

## Win/Loss Logic

Algorithm verified against 137 wiki-confirmed seasons (0 mismatches). See `getWarOutcome()` in `src/components/h1/War/War.jsx`.

**Victory signals** (any = victory):

1. `data.live`: all 3 factions have `status === 'defeated'` (current season)
2. ANY `data.snapshots[]` contains all 3 factions with `status === 'defeated'`
3. All 3 enemy homeworlds captured: successful attack events on enemies 0, 1, 2

**Defeat signal:**

- Chronologically last region-0 defend event has `status === 'fail'` (Super Earth fell)

**Decision:**

- Victory signal AND no defeat signal → **Victory**
- Defeat signal → **Defeat**
- No victory signal → **Defeat** (war ended without winning)
- No data → no banner

**Key insight:** Check ANY snapshot, not just the last. The API's periodic snapshots may miss the final moment, but earlier snapshots can capture the all-defeated state.

## Components

### 1. War Outcome Banner

Added to the `War` component (`src/components/h1/War/War.jsx`), rendered above the existing stats. Only shown on `/war?season=N` via a `showOutcome` prop.

- Displays "Victory" or "Defeat" with a brief description
- Shows per-faction status indicators (defeated vs still active when the war ended)
- Derives outcome from `data.live[].status` and `data.events[]`

### 2. WarTimeline Component

New client component: `src/components/h1/WarTimeline/WarTimeline.jsx`

**Data input:** Receives `data` prop (same campaign data the page already fetches — includes `snapshots[]` and `events[]`).

**Timeline construction:**

1. Merge `h1_snapshot` entries and `h1_event` start/end timestamps into a single chronological array
2. Sort by time with tie-breaker: `snapshot` before `event_start` before `event_end`
3. User scrubs through moments via an `<input type="range">` slider
4. Event markers (defend/attack start/end) rendered as visual decorations along the slider track

**State management:**

- Owns `selectedIndex` state (React `useState`)
- When slider moves, computes map state for that moment:
    - Finds the nearest `h1_snapshot` at or before the selected time
    - Filters `h1_event` entries to only those **active at the selected time** (`start_time <= time && end_time >= time`)
    - Calls `computeMapState(factionStates, activeEvents)` with the filtered data
- Passes computed map state down to Galaxy
- Default state (no selection): Galaxy shows final season state from `data.live` with no event overlays (pass `[]` for events)

### 3. computeMapState Utility

New pure function: `src/utils/computeMapState.mjs`

Extracted from Galaxy's current mutation logic (`processCampaigns`, `processDefendEvents`, `processAttackEvents`).

**Input:** Per-faction state at a moment in time (points, points_taken, status per faction) + events active at that timestamp (pre-filtered by the caller — this function does NOT do timestamp filtering).

**Output:** New map object (deep clone of the map template via `JSON.parse(JSON.stringify(mapTemplate))`). No mutation of shared state.

**Behavioral change:** Re-enables `processAttackEvents` which is currently commented out in Galaxy.jsx. This was disabled due to a CSS class conflict (`'in_progress active'` as a space-separated string). Fix: use a dedicated status value (e.g., `'attacking'`) instead of combining two class names. Verify CSS handles the new status correctly.

**Consumers:**

- Homepage `/` — called with `data.live` and active events, re-enabling attack event visualization
- `/war` page default — called with `data.live` and `[]` (no event overlays on default state)
- `/war` page timeline scrub — called with selected moment's snapshot data + events active at that time

### 4. Galaxy Refactor

`Galaxy.jsx` currently imports the `map` enum and mutates it directly. Refactor to:

- Accept computed map state as a `mapState` prop
- Remove internal `processCampaigns()`, `processDefendEvents()` calls
- Remove unused `rebroadcast` prop
- Remove unused imports (`map` enum, `factions`, `elapsedSeasonTime`, `Script`, `Wings`)
- `Map.jsx` and `Tooltip.jsx` are unchanged (already receive map as props)

**Both pages must update simultaneously:** Homepage (`src/app/page.jsx`) and war page (`src/app/war/page.jsx`) both render Galaxy — update both in the same step to avoid breakage.

## Data Sources

All historical data comes from the `get_snapshots` API call (single source of truth for completed seasons), stored as:

- `h1_snapshot` — periodic faction state: `data` field is a stringified JSON array of 3 faction objects `[{ points, points_taken, status }]`. May need `JSON.parse()` since the seed data stores it as a double-encoded string.
- `h1_event` — attack/defend events with `start_time`, `end_time`, `region`, `enemy`, `status`, `points`, `points_max`

Snapshot timestamps and event timestamps do not align — they are merged and sorted chronologically with a deterministic tie-breaker to build the timeline.

**Note:** `h1_event_snapshot` (Phase 2 10-min progress data) is NOT used in the historical timeline. It only exists for current/future seasons and will be used in a future TODO for live dashboard event progress visualization.

## Edge Cases

- **No snapshots:** Season freshly created, historical data not fetched. Show banner if determinable from `data.live`, hide timeline.
- **Active season:** No victory/defeat yet. No banner. Timeline shows events so far.
- **Empty `data.live`:** Guard with `data.live.length === 3` — don't show outcome banner for incomplete data.
- **Super Earth defend loss:** Must check `data.events` for `type === 'defend'`, `region === 0`, `status === 'fail'` — not derivable from faction statuses alone.
- **Pre-Phase-2 seasons:** Seed data has snapshots + events. Timeline works — just fewer moments to scrub through (~7 snapshots per season). No special handling needed.

## Out of Scope

- Auto-play / play-pause controls (manual scrub only)
- Timeline on the homepage
- Stats panel updating per timeline moment (stays as season totals)
- Scroll-driven animation
- CSS transitions on map sectors (KISS — instant state swap for now, animate later)
- `h1_live_snapshot` schema gap fix
- WebSocket / live updates
- Mobile-specific timeline UX
- `h1_event_snapshot` integration (future TODO for live dashboard)

## Files to Modify

| File                                            | Change                                                                                |
| ----------------------------------------------- | ------------------------------------------------------------------------------------- |
| `src/utils/computeMapState.mjs`                 | Create: pure map state computation utility                                            |
| `src/components/h1/Galaxy/Galaxy.jsx`           | Refactor: accept `mapState` prop, remove internal mutation, remove `rebroadcast` prop |
| `src/app/page.jsx`                              | Update: compute `mapState` before passing to Galaxy                                   |
| `src/components/h1/War/War.jsx`                 | Modify: add `WarOutcome` banner with `showOutcome` prop                               |
| `src/components/h1/War/War.css`                 | Modify: banner styling                                                                |
| `src/components/h1/WarTimeline/WarTimeline.jsx` | Create: timeline scrubber with `<input type="range">`, wraps Galaxy                   |
| `src/components/h1/WarTimeline/WarTimeline.css` | Create: timeline styling                                                              |
| `src/app/war/page.jsx`                          | Update: wire WarTimeline + outcome banner                                             |
| `docs/TODO.md`                                  | Update: mark Phase 4 items, add future TODO for `h1_event_snapshot` on live dashboard |

## Verification

1. `npm run build` passes
2. Homepage: Galaxy renders identically to before (with attack events now visible)
3. `/war?season=1` — Victory banner shown, timeline with ~7 moments, scrubbing updates map
4. `/war?season=N` with active season — no banner, timeline shows events so far
5. `/war?season=N` default view — map shows final state, no stale event overlays
6. Scrubbing to a moment before a defend event — defend event NOT on map
7. Scrubbing to a moment during a defend event — defend event shown on map
8. `npm run test:smoke` passes
