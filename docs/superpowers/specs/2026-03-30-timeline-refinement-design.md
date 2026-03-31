# Timeline Refinement — Design Spec

**Issue:** #165 (continuation)
**Date:** 2026-03-30
**Status:** Implemented
**Parent spec:** `2026-03-30-phase-9-timeline-visual-redesign.md`

## Summary

Refine the initial timeline redesign to fix four issues: sidebar/map scrolling independently instead of as a unit, Season Events not following card styling, map getting clipped at certain breakpoints, and sidebar/map edge alignment.

## Changes

### 1. Unified Scroll — Remove Snap Scroll Entirely

**Problem:** The sidebar has `overflow-y: auto` and the map has `position: sticky`, causing them to scroll independently within snap screen 1. Additionally, snap scroll created awkward UX at certain viewport sizes.

**Fix:** Remove snap scroll entirely. Dashboard uses `height: calc(100dvh - 80px)` as a hero section that fills the viewport, with normal page scroll to the timeline below. A smooth-scroll button ("down arrow event log") navigates to the timeline. Sidebar and map are static grid children -- no independent scrolling.

**Files:**
- `src/components/h1/Dashboard/DashboardClient.css`
- `src/app/page.css`

**CSS changes at `@media (min-width: 1024px)`:**
- `.dashboard-sidebar`: Remove `overflow-y: auto` and `min-height: 0`
- `.dashboard-map`: Remove `position: sticky`, `top: calc(80px + 1.5rem)`, `align-self: start`, and `overflow: hidden`
- Remove sidebar scrollbar styles (`.dashboard-sidebar::-webkit-scrollbar` and `scrollbar-width`/`scrollbar-color`) -- no longer needed
- Remove all snap scroll CSS (`scroll-snap-type`, `scroll-snap-align`, snap container styles)

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

### 3. Smart Map Fit — Viewport-Derived Grid Column

**Problem:** Map SVG has `max-h-[85vh]` and its container has `overflow: hidden` at lg:, causing clipping at certain viewport sizes.

**Fix:** Size the map grid column from viewport height using `minmax(0, calc((100dvh - 80px) * 806.93 / 868.81))`. The SVG uses `preserveAspectRatio="xMaxYMid meet"` for right-alignment within its cell. Galaxy wrapper uses `w-full h-full`.

**Files:**
- `src/components/h1/Galaxy/Map.jsx` -- Remove `max-h-[85vh]` from SVG. Add `w-full h-full` and `preserveAspectRatio="xMaxYMid meet"`.
- `src/components/h1/Galaxy/Galaxy.jsx` -- Change wrapper from `items-center` to `w-full h-full`.
- `src/components/h1/Dashboard/DashboardClient.css` -- At lg:, grid columns use `minmax(260px, 1fr) minmax(0, calc((100dvh - 80px) * 806.93 / 868.81))`. Remove `overflow: hidden` from `.dashboard-map`.

**How it works:**
- The dashboard grid has `height: calc(100dvh - 80px)` and the map column is sized proportionally from that height using the SVG aspect ratio (806.93 / 868.81)
- Grid columns: `minmax(260px, 1fr) minmax(0, calc(...))` -- sidebar fills remaining space (min 260px), map column auto-sized
- The SVG `viewBox="0 0 806.93 868.81"` with `preserveAspectRatio="xMaxYMid meet"` right-aligns the map within its cell
- No `overflow: hidden` means nothing clips -- the SVG scales to fit

### 4. Edge Alignment

**Problem:** Sidebar and map need clear left/right edge alignment with space between them.

**Fix:** The `justify-self` approach was abandoned. Map right-aligns via `preserveAspectRatio="xMaxYMid meet"` on the SVG and `justify-content: end` on the flex container. Dashboard max-width was removed entirely -- replaced by `.live-page { max-width: 1920px; margin-inline: auto; }` in page.css.

**Files:**
- `src/components/h1/Dashboard/DashboardClient.css`
- `src/app/page.css`

### 5. Additional Implementation Changes

The following changes were made during implementation beyond the original 4 changes:

- **Hero text moved into sidebar:** Hero text (h1 title + description + "Updated Xs ago" timestamp) is the first child of `.dashboard-sidebar`, not a separate grid row.
- **Page content capped at 1920px:** `.live-page { max-width: 1920px; margin-inline: auto; }` in page.css replaces the dynamic max-width approach.
- **Background overlay changed to `position: fixed`:** Was `absolute`, now `fixed` for full-viewport coverage.
- **Column gap set to 6rem:** `column-gap: 6rem` at lg: matches gutters spacing.
- **Galaxy.jsx wrapper changed:** From `mb-4 flex flex-col items-center gap-4` to `flex flex-col gap-4 w-full h-full`.
- **Grid columns changed:** `minmax(260px, 1fr) minmax(0, calc((100dvh - 80px) * 806.93 / 868.81))` -- sidebar fills remaining space, map column sized from viewport height. No per-breakpoint sidebar width overrides (xl:, 3xl: removed).
- **Grid areas updated:** `'alerts alerts' / 'sidebar map' / 'hint hint'` -- removed 'updated' row (timestamp moved into sidebar hero).
- **Mobile grid order:** alerts, map, sidebar (sidebar below map on mobile).
- **StatGrid at md:** Grid is `repeat(3, ...)` not `repeat(4, ...)` to accommodate 6 cards (4 stats + WON + LOST) in a clean 3x2 layout.
- **TimelineSection has `id="event-log"`** for smooth-scroll target.

## Files Summary

| File | Action |
|------|--------|
| `src/components/h1/Dashboard/DashboardClient.css` | Modify -- changes 1, 3, 4, 5 (unified scroll, grid columns, alignment, hero/gap/areas) |
| `src/components/h1/Dashboard/DashboardClient.jsx` | Modify -- change 2, 5 (pass events to StatGrid, remove WarSummary, hero text in sidebar, scroll button) |
| `src/components/h1/StatGrid/StatGrid.jsx` | Modify -- change 2 (add events prop, win/loss cards, accent variants) |
| `src/components/h1/StatGrid/StatGrid.css` | Modify -- change 2, 5 (accent color variants, md: repeat(3) grid) |
| `src/components/h1/Galaxy/Map.jsx` | Modify -- change 3 (remove max-h-[85vh], add preserveAspectRatio) |
| `src/components/h1/Galaxy/Galaxy.jsx` | Modify -- change 5 (w-full h-full wrapper) |
| `src/app/page.jsx` | Modify -- change 5 (live-page wrapper, hero text) |
| `src/app/page.css` | Modify -- change 1, 4, 5 (remove snap scroll, live-page max-width, fixed background) |
| `src/components/h1/Timeline/TimelineSection.jsx` | Modify -- change 5 (add id="event-log") |
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
