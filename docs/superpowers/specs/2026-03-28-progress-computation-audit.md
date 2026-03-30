# Progress Computation — Audit & Enhancement Spec

**Date:** 2026-03-28
**Status:** Draft
**Related issues:** TBD

---

## 1. Current State

### 1.1 Progress Functions

| Function                                    | File                                     | Purpose                               | Consumers                         |
| ------------------------------------------- | ---------------------------------------- | ------------------------------------- | --------------------------------- |
| `evaluateProgress(event)`                   | `src/utils/evaluateProgress.mjs`         | Event-level pace vs linear schedule   | Alerts.jsx, Event.jsx             |
| `computeFrontier(campaignData, factionMap)` | `src/components/h1/Galaxy/EventCard.jsx` | Sector-level capture progress         | DashboardClient.jsx               |
| `computeMapState(factionStates, events)`    | `src/utils/computeMapState.mjs`          | Full map sector ownership             | Homepage, OG image, /war timeline |
| `getWarOutcome(data)`                       | `src/utils/getWarOutcome.mjs`            | Post-hoc victory/defeat determination | /war page banner                  |
| OG status logic (inline)                    | `src/app/opengraph-image.jsx:126-145`    | Social sharing status text            | Discord/social embeds             |

### 1.2 evaluateProgress() — Deep Analysis

**Algorithm:** Linear projection with 10% buffer.

```
expectedRate = points_max / totalTime
expectedPoints = expectedRate * elapsedTime
buffer = expectedPoints * 0.1

Ahead:    actual > expected + buffer  (need to be 10%+ ahead)
Behind:   actual < expected           (any amount below)
On track: expected <= actual <= expected + buffer
```

**Output:** `"Ahead by N points"` | `"Behind by N points"` | `"On track by N points"` | `null`

**Limitations:**

- Only works for active events (defend/attack), not campaign progress
- Returns a string, not structured data — callers can't style status differently
- Computes `currentRate` and `requiredRate` but discards them (dead variables)
- No severity indication (slightly behind vs critically behind)
- 10% buffer is asymmetric: easier to be "Behind" than "Ahead"
- Doesn't use historical snapshots — only current point-in-time data

**Test coverage:** 4 tests in `src/__tests__/unit/utils/evaluateProgress.test.mjs` (ahead, behind, on track, non-active)

### 1.3 Where Progress Is Shown

| Location                  | Shows pace?                   | Shows %          | Shows points    | Shows time remaining |
| ------------------------- | ----------------------------- | ---------------- | --------------- | -------------------- |
| **Alerts banner**         | Yes (evaluateProgress string) | Yes              | Yes (raw)       | Yes (humanized)      |
| **Event cards**           | Yes (evaluateProgress string) | Yes              | Yes (raw)       | Yes (humanized)      |
| **EventCard (dashboard)** | No                            | Yes (sector %)   | Yes (formatted) | No                   |
| **OG image**              | No                            | Yes (campaign %) | No              | No                   |
| **Galaxy map tooltip**    | No                            | Yes (sector %)   | Yes             | No                   |
| **/war timeline**         | No                            | No               | No              | No                   |

### 1.4 Untapped Data Sources

| Table               | Interval | Fields                                 | Potential use                           |
| ------------------- | -------- | -------------------------------------- | --------------------------------------- |
| `h1_event_snapshot` | 10 min   | time, points, points_max               | Event pace trends, rate-of-change       |
| `h1_live_snapshot`  | 15 min   | players, missions, kills, deaths, etc. | Campaign pace, player engagement trends |

---

## 2. Proposed Enhancements

### 2.1 Refactor evaluateProgress() to return structured data

**Current:** Returns a formatted string or null.
**Proposed:** Return an object so consumers can style/display differently.

```javascript
// New return shape
{
  status: 'ahead' | 'behind' | 'on_track',
  delta: number,        // absolute point difference
  percent: number,      // how far ahead/behind as % of expected
  currentRate: number,  // points per second (actual)
  requiredRate: number, // points per second (needed to finish on time)
  projectedCompletion: 'early' | 'on_time' | 'late' | 'will_not_finish',
}
```

**Why:** Allows EventCard to show a colored badge, OG image to pick status colors, and future visualizations to show rate data.

### 2.2 Add evaluateProgress to EventCard (dashboard)

The dashboard frontier cards (CAPTURING/DEFENDING) don't show pace status. Adding a small pace badge would answer "are we winning this fight?" at a glance.

### 2.3 Add pace status to OG image

The OG image currently shows "ACTIVE EVENT" for ongoing events. Showing "AHEAD" or "BEHIND" would make shared links more informative on Discord.

### 2.4 Remove dead variables in evaluateProgress()

`currentRate` and `requiredRate` are computed but never used. Either surface them in the return value (see 2.1) or remove them.

### 2.5 Campaign-level progress evaluation (future)

Apply similar logic to campaign-level progress: given the current pace of sector captures, project whether the war is trending toward victory or defeat. This would use `h1_live_snapshot` data.

**Deferred** — requires snapshot query infrastructure that doesn't exist yet.

---

## 3. Implementation (Completed)

### 3.1 evaluateProgress() refactored

- Returns `{ status, delta, deltaPercent, currentRate, requiredRate, label }` or `null`
- Division-by-zero guard: returns `null` when `elapsedTime <= 0` or `totalTime <= 0`
- `status !== 'active'` check moved to top (early return)
- `label` field provides backward-compatible formatted string

### 3.2 Consumer updates

- `Alerts.jsx`: uses `evaluateProgress(event)?.label`
- `Event.jsx`: uses `evaluateProgress(event)?.label`
- `DashboardClient.jsx`: passes full pace object to EventCard for defend/attack events
- `EventCard.jsx`: new optional `pace` prop renders colored badge (green=ahead, red=behind, primary=on track)
- `opengraph-image.jsx`: shows `DEFEND — AHEAD` / `ATTACK — BEHIND` etc. for active events

### 3.3 Test coverage

- 7 tests (up from 4): added div-by-zero at start, zero totalTime, expired event edge cases
- All 222 tests pass

## 4. Non-Goals

- Historical trend charts (tracked in #54: Snapshot-based charts)
- Win probability percentages (too speculative for the data available)
- Real-time rate-of-change graphs (Phase 10: WebSocket dependency)
- Modifying the linear model to account for player surges (unnecessary complexity)
