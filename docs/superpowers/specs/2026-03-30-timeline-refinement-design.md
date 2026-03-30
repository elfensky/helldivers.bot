# Timeline Refinement — Design Spec

**Issue:** #165 (continuation)
**Date:** 2026-03-30
**Status:** Design approved
**Parent spec:** `2026-03-30-phase-9-timeline-visual-redesign.md`

## Summary

Refine the initial timeline redesign to fix four issues: sidebar/map scrolling independently instead of as a unit, Season Events not following card styling, map getting clipped at certain breakpoints, and sidebar/map edge alignment.

## Changes

### 1. Unified Scroll — Sidebar + Map as Single Unit

**Problem:** The sidebar has `overflow-y: auto` and the map has `position: sticky`, causing them to scroll independently within snap screen 1.

**Fix:** Remove both properties at `lg:`. Sidebar and map become static grid children that sit together. If viewport is tall enough, no scrolling occurs.

**Files:**
- `src/components/h1/Dashboard/DashboardClient.css`

**CSS changes at `@media (min-width: 1024px)`:**
- `.dashboard-sidebar`: Remove `overflow-y: auto` and `min-height: 0`
- `.dashboard-map`: Remove `position: sticky`, `top: calc(80px + 1.5rem)`, `align-self: start`, and `overflow: hidden`
- Remove sidebar scrollbar styles (`.dashboard-sidebar::-webkit-scrollbar` and `scrollbar-width`/`scrollbar-color`) — no longer needed

### 2. Season Events → StatGrid Cards

**Problem:** WarSummary is a standalone row with non-standard styling. Season Events should be stat cards inside StatGrid, filtered by the active faction tab.

**Fix:** Add "WON" and "LOST" stat cards to StatGrid with colored accent lines (green/red). Compute win/loss from resolved events, filtered by faction. Delete WarSummary entirely.

**Files:**
- `src/components/h1/StatGrid/StatGrid.jsx` — Add `events` prop. Compute faction-filtered win/loss counts. Render two additional StatCards with custom accent colors.
- `src/components/h1/StatGrid/StatGrid.css` — Add `.stat-card-accent-success` (`--color-success`) and `.stat-card-accent-danger` (`--color-danger`) variants.
- `src/components/h1/Dashboard/DashboardClient.jsx` — Pass `events` to StatGrid, remove WarSummary import and usage.
- Delete `src/components/h1/WarSummary/WarSummary.jsx` and `WarSummary.css`.

**StatCard accent variants:**

The existing `StatCard` always renders `.stat-card-accent` with `--color-primary`. Add an optional `accentColor` prop:
- `"success"` → `.stat-card-accent-success` with `background: var(--color-success)`
- `"danger"` → `.stat-card-accent-danger` with `background: var(--color-danger)`
- Default → existing `.stat-card-accent` with `--color-primary`

**Win/loss computation:**

```js
// Inside StatGrid, filter events by faction then count
const resolved = events?.filter(e => {
    if (faction !== 'global') {
        const factionIndex = { bugs: 0, cyborgs: 1, illuminate: 2 }[faction];
        if (e.enemy !== factionIndex) return false;
    }
    return e.status === 'success' || e.status === 'fail';
}) ?? [];

const wins = resolved.filter(e => e.status === 'success').length;
const losses = resolved.filter(e => e.status === 'fail').length;
```

**Grid layout impact:** StatGrid currently renders 4 cards (2×2 at lg:). Adding Won/Lost makes 6 cards (3×2 at lg:). The existing `grid-template-columns: minmax(0, 1fr) minmax(0, 1fr)` at lg: handles this — cards wrap naturally into 3 rows. At md: change `repeat(4, ...)` to `repeat(3, ...)` for a clean 3×2 grid instead of 4+2 wrapping.

### 3. Smart Map Fit — No Clipping

**Problem:** Map SVG has `max-h-[85vh]` and its container has `overflow: hidden` at lg:, causing clipping at certain viewport sizes.

**Fix:** Replace the fixed `max-h-[85vh]` constraint with dynamic sizing that uses the smaller of available width or height, preserving the map's ~0.93:1 aspect ratio. The SVG `viewBox` already handles proportional scaling — we just need the container to not clip.

**Files:**
- `src/components/h1/Galaxy/Map.jsx` — Remove `max-h-[85vh]` from SVG. Add `w-full h-full` so SVG fills container.
- `src/components/h1/Dashboard/DashboardClient.css` — At lg:, remove `overflow: hidden` from `.dashboard-map`. Add `display: flex`, `align-items: center`, `justify-content: center` so the map centers within its grid cell. The grid row `minmax(0, 1fr)` already constrains the height.

**How it works:**
- The dashboard grid has `height: calc(100dvh - 80px)` and the map cell gets `minmax(0, 1fr)` for its row — this is the available height
- The map column is `minmax(0, 1fr)` — this is the available width
- The SVG `viewBox="0 0 806.93 868.81"` preserves aspect ratio automatically
- With `max-width: 100%` and `max-height: 100%` on the SVG, it scales to fit whichever dimension is tighter
- No `overflow: hidden` means nothing clips — the SVG just scales down

### 4. Edge Alignment

**Problem:** Sidebar and map need clear left/right edge alignment with space between them.

**Fix:** Verify and enforce alignment properties on the grid children.

**Files:**
- `src/components/h1/Dashboard/DashboardClient.css`

**CSS changes at `@media (min-width: 1024px)`:**
- `.dashboard-sidebar`: Add `justify-self: start` (left-aligned in its grid cell)
- `.dashboard-map`: Add `justify-self: end` (right-aligned in its grid cell)

The grid columns `260px minmax(0, 1fr)` already create the space distribution. These properties ensure the content within each cell hugs the correct edge.

## Files Summary

| File | Action |
|------|--------|
| `src/components/h1/Dashboard/DashboardClient.css` | Modify — changes 1, 3, 4 |
| `src/components/h1/Dashboard/DashboardClient.jsx` | Modify — change 2 (pass events to StatGrid, remove WarSummary) |
| `src/components/h1/StatGrid/StatGrid.jsx` | Modify — change 2 (add events prop, win/loss cards, accent variants) |
| `src/components/h1/StatGrid/StatGrid.css` | Modify — change 2 (accent color variants) |
| `src/components/h1/Galaxy/Map.jsx` | Modify — change 3 (remove max-h-[85vh]) |
| `src/components/h1/WarSummary/WarSummary.jsx` | Delete |
| `src/components/h1/WarSummary/WarSummary.css` | Delete |

## Verification

1. `npm run build` — must succeed
2. `npm run test:unit:run` — must pass
3. Desktop (1024px+): Sidebar and map visible together in snap screen 1, no independent scrolling
4. Desktop: Map fully visible at 1024px, 1280px, and 1920px — no clipping
5. Desktop: Sidebar left-aligned, map right-aligned with natural spacing
6. Desktop: StatGrid shows Won/Lost cards with green/red accents
7. Desktop: Switch faction tabs — win/loss counts filter correctly
8. Mobile: Single-column layout still works, map not clipped
9. Chrome DevTools: Verify no `overflow: hidden` on map container at lg:
