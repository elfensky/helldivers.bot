# Phase 4 — War Outcome & Interactive Timeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a war outcome banner and interactive timeline to `/war?season=N` that lets users scrub through historical war moments, updating the Galaxy map to each state.

**Architecture:** Extract Galaxy's map mutation logic into a pure `computeMapState` utility. Add a `WarTimeline` client component that owns timeline state and wraps Galaxy. Add a `WarOutcome` banner to the War component. The homepage stays functionally identical (but gains attack event visualization).

**Tech Stack:** React 19, Next.js 16, `<input type="range">` for timeline scrubber

---

## File Structure

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `src/utils/computeMapState.mjs` | Pure function: given faction state + pre-filtered events, returns a new map object |
| Create | `src/components/h1/WarTimeline/WarTimeline.jsx` | Client component: range slider timeline, selectedIndex state, wraps Galaxy |
| Create | `src/components/h1/WarTimeline/WarTimeline.css` | Timeline styling |
| Modify | `src/components/h1/Galaxy/Galaxy.jsx` | Accept `mapState` prop, remove internal mutation, remove `rebroadcast` prop |
| Modify | `src/components/h1/War/War.jsx` | Add WarOutcome banner with `showOutcome` prop |
| Modify | `src/components/h1/War/War.css` | Banner styling |
| Modify | `src/app/war/page.jsx` | Wire up WarTimeline wrapping Galaxy, pass `showOutcome` to War |
| Modify | `src/app/page.jsx` | Compute `mapState` via utility before passing to Galaxy |
| Modify | `docs/TODO.md` | Mark Phase 4 items, add TODO for `h1_event_snapshot` on live dashboard |

---

## Task 1: Extract `computeMapState` utility

**Why:** Galaxy.jsx mutates a shared module-level `map` import on every render — state leakage by design. Extract to a pure function that deep-clones the template and returns a new object.

**Files:**
- Create: `src/utils/computeMapState.mjs`

**Reuse:**
- `mapTemplate` from `src/enums/map.js` (already exists)
- Logic from `Galaxy.jsx` lines 42-159: `processCampaigns()`, `processDefendEvents()`, `processAttackEvents()`

- [ ] **Step 1: Create `computeMapState` utility**

Extract and adapt the three mutation functions from Galaxy.jsx into a single pure function. Key changes from original:
- Deep clone via `JSON.parse(JSON.stringify(mapTemplate))` instead of mutating shared import
- Use `parseInt(regionKey)` and integer comparisons instead of string comparisons (fixes latent string coercion bug)
- Remove `log.error()` call from `processDefendEvents` (undefined `log` — would throw ReferenceError)
- Re-enable `processAttackEvents` — fix `'in_progress active'` status to use a dedicated value like `'attacking'` to avoid CSS class conflicts
- This function does NOT filter events by time — the caller pre-filters before calling

- [ ] **Step 1.5: Verify `processAttackEvents` CSS integration**

Check `src/components/h1/Galaxy/Map.css` for how the `.in_progress` and `.active` CSS classes work. The original code set `status = 'in_progress active'` (space-separated) which creates two CSS classes. Verify whether Map.jsx applies status as a className, and ensure the new status value (e.g., `'attacking'`) has corresponding CSS rules or falls back gracefully.

- [ ] **Step 2: Commit**

```bash
git add src/utils/computeMapState.mjs
git commit -m "feat: extract computeMapState pure utility from Galaxy"
```

---

## Task 2: Refactor Galaxy to accept `mapState` prop

**Why:** Galaxy should be a dumb rendering component — it receives a pre-computed map and renders it.

**Files:**
- Modify: `src/components/h1/Galaxy/Galaxy.jsx`

- [ ] **Step 1: Refactor Galaxy.jsx**

- Change props from `{ data, rebroadcast }` to `{ mapState }`
- Remove `processCampaigns(data)`, `processDefendEvents(data)`, `// processAttackEvents(data)` calls
- Remove all three function definitions
- Remove unused imports: `map` from `@/enums/map`, `factions` from `@/enums/factions`, `elapsedSeasonTime`, `Script`, `Wings`
- Pass `mapState` to `Map` and `Tooltip` as `map` prop
- Keep the existing JSX structure (section, className, etc.)

- [ ] **Step 2: Commit**

```bash
git add src/components/h1/Galaxy/Galaxy.jsx
git commit -m "refactor: Galaxy accepts mapState prop, remove internal mutation"
```

---

## Task 3: Update homepage and war page to compute `mapState`

**Why:** Both pages render Galaxy — both must update simultaneously to avoid breakage.

**Files:**
- Modify: `src/app/page.jsx`
- Modify: `src/app/war/page.jsx` (temporary — Task 7 will update further)

- [ ] **Step 1: Update homepage `page.jsx`**

- Import `computeMapState` from `@/utils/computeMapState.mjs`
- Compute `const mapState = computeMapState(data.live, data.events)` before rendering
- Pass `mapState` to `<Galaxy mapState={mapState} />`

- [ ] **Step 2: Update war page `war/page.jsx` (temporary)**

- Same changes as homepage: import `computeMapState`, compute `mapState`, pass to Galaxy
- This is temporary — Task 7 will replace standalone Galaxy with WarTimeline

- [ ] **Step 3: Run build**

```bash
npm run build
```

- [ ] **Step 4: Commit**

```bash
git add src/app/page.jsx src/app/war/page.jsx
git commit -m "feat: both pages compute mapState via utility before passing to Galaxy"
```

---

## Task 4: Add War Outcome banner

**Why:** Users need to see at a glance whether a historical season ended in Victory or Defeat.

**Files:**
- Modify: `src/components/h1/War/War.jsx`
- Modify: `src/components/h1/War/War.css`

- [ ] **Step 1: Add `getWarOutcome` helper and `WarOutcome` component**

Add to War.jsx:
- `getWarOutcome(data)` — returns `{ outcome: 'victory'|'defeat', reason: string }` or `null`
  - Guard: `data.live.length !== 3` → return `null`
  - Defeat: find event with `type === 'defend' && region === 0 && status === 'fail'`
  - Victory: `data.live.every(f => f.status === 'defeated')`
  - Otherwise: `null` (active/ongoing)
- `WarOutcome({ data })` — renders banner with outcome + per-faction status indicators
- Modify `War` component to accept `showOutcome` prop, render `<WarOutcome>` when true

- [ ] **Step 2: Add banner CSS**

Append victory/defeat styling to War.css.

- [ ] **Step 3: Commit**

```bash
git add src/components/h1/War/War.jsx src/components/h1/War/War.css
git commit -m "feat: add war outcome banner (victory/defeat) to War component"
```

---

## Task 5: Create WarTimeline component

**Why:** The core interactive timeline. Merges snapshots and events chronologically, provides a range slider for scrubbing, and wraps Galaxy.

**Files:**
- Create: `src/components/h1/WarTimeline/WarTimeline.jsx`
- Create: `src/components/h1/WarTimeline/WarTimeline.css`

**Key design decisions from debate review:**

1. **`<input type="range">`** instead of absolute-positioned buttons — handles any density, natively accessible (keyboard arrows), no overlapping hit targets
2. **Event markers as visual-only decorations** along the slider track at their percentage positions
3. **Timestamp filtering in the component**, not in `computeMapState` — filter `events` to only those active at the selected moment's time before calling `computeMapState`
4. **Sorting tie-breaker:** `snapshot` before `event_start` before `event_end` when timestamps are equal
5. **Default state passes `[]` for events** to avoid stale event overlays on the final map state
6. **Snapshot `data` may be a string** (double-encoded from seed data) — keep the `typeof === 'string' ? JSON.parse() : data` check
7. **Accessibility:** `aria-label="War timeline"` and `aria-valuetext` with formatted timestamp on the range input

- [ ] **Step 1: Create WarTimeline.css**

Style the timeline container, range slider track, event marker decorations, and info label.

- [ ] **Step 2: Create WarTimeline.jsx**

Client component (`'use client'`) with:
- `buildTimeline(data)` — merges snapshots + event start/end into sorted moment array with tie-breaker
- `computeMomentMapState(moment, data)` — finds nearest snapshot, pre-filters active events by time, calls `computeMapState`
- `<input type="range">` as the primary scrubber control
- Event markers as non-interactive visual dots/lines at percentage positions
- Info display showing selected moment label + formatted timestamp
- `<Galaxy mapState={currentMapState} />` rendered inside

- [ ] **Step 3: Commit**

```bash
git add src/components/h1/WarTimeline/WarTimeline.jsx src/components/h1/WarTimeline/WarTimeline.css
git commit -m "feat: add WarTimeline with range slider, event markers, and Galaxy integration"
```

---

## Task 6: Wire up `/war` page

**Why:** Connect everything on the war history page — WarTimeline wrapping Galaxy, outcome banner on War.

**Files:**
- Modify: `src/app/war/page.jsx`

- [ ] **Step 1: Update war/page.jsx**

- Import `WarTimeline`
- Compute `defaultMapState = computeMapState(data.live, [])` — empty events array for clean default state
- Replace standalone `<Galaxy>` with `<WarTimeline data={data} defaultMapState={defaultMapState} />`
- Pass `showOutcome={true}` to `<War>`

- [ ] **Step 2: Run build**

```bash
npm run build
```

- [ ] **Step 3: Commit**

```bash
git add src/app/war/page.jsx
git commit -m "feat: wire WarTimeline and outcome banner on /war page"
```

---

## Task 7: Update docs and TODO

**Files:**
- Modify: `docs/TODO.md`

- [ ] **Step 1: Mark Phase 4 items complete**

- [ ] **Step 2: Add future TODO**

Add under a new section or in Phase 4: "TODO: Use `h1_event_snapshot` data for live dashboard event progress visualization (not historical replay)"

- [ ] **Step 3: Commit**

```bash
git add docs/TODO.md
git commit -m "docs: mark Phase 4 items complete, add event snapshot live dashboard TODO"
```

---

## Task 8: Final verification

- [ ] **Step 1: Run Prettier**

```bash
npm run format
```

- [ ] **Step 2: Run build**

```bash
npm run build
```

- [ ] **Step 3: Ask user to start dev server, then run smoke tests**

```bash
npm run test:smoke
```

- [ ] **Step 4: Manual verification**

- Homepage: Galaxy renders with attack events now visible (behavioral change, intentional)
- `/war?season=1` — Victory banner, timeline with ~7 moments, scrubbing updates map
- `/war?season=N` with active season — no banner, timeline shows events so far
- Default view — clean final state, no stale event markers
- Scrub to moment before defend event — no defend marker on map
- Scrub to moment during defend event — defend marker visible

- [ ] **Step 5: Commit any formatting changes**

```bash
git add -A
git commit -m "chore: format Phase 4 files"
```

---

## Decisions Log

Issues identified in four-way AI debate (Opus, Sonnet, Gemini, Codex) and resolutions:

| # | Issue | Resolution |
|---|-------|------------|
| 1 | Snapshot data may be string (double-encoded) | Keep `JSON.parse` check — seed data stores as stringified JSON |
| 2 | API route used `/api/v1/` pattern | Not applicable — no timeline API route needed, data is already in `getCampaign` response |
| 3 | Snapshot payload too large | Not an issue — HD1 seasons are short with sparse data (~7 snapshots) |
| 4 | Timeline buttons broken at scale | Replaced with `<input type="range">` slider |
| 5 | `computeMapState` had no timestamp filtering | Caller pre-filters events by time before calling |
| 6 | `h1_event_snapshot` not incorporated | Intentional — only for future live dashboard use, not historical replay |
| 7 | Sorting ties on identical timestamps | Added tie-breaker: snapshot → event_start → event_end |
| 8 | Default map showed stale events | Pass `[]` for events in default state |
| 9 | Empty `data.live` → false Victory | Guard with `data.live.length === 3` |
| 10 | `processAttackEvents` re-enabled silently | Documented as intentional, added substep to verify/fix CSS class conflict |
| 11 | CSS animation/transition conflict | KISS — no transitions for now, instant state swap |
| 12 | Homepage must update simultaneously | Both pages updated in Task 3 |
| 13 | Accessibility missing | `<input type="range">` + `aria-valuetext` provides keyboard/screen reader support |
| 14 | Pre-Phase-2 seasons limited data | Not an issue — seed data has snapshots + events, timeline works with fewer moments |
| 15 | Galaxy `rebroadcast` prop unused | Removed in Task 2 |
