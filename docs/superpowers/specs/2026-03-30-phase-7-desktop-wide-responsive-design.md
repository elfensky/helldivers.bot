# Phase 7: Desktop & Wide Responsive Layout

**Issue:** #168
**Date:** 2026-03-30
**Status:** Design approved

## Summary

Progressive enhancement from the tablet layout (lg: 1024px) to desktop, wide, and ultrawide breakpoints. The dashboard becomes a two-column layout with a scrollable sidebar on the left and a pinned galaxy map on the right, fitting all content in a single viewport without page-level scrolling.

## DOM Structure

Flat grid-based layout. The root container is the grid — no intermediate `.dashboard-main` wrapper.

```
<div class="dashboard">        ← CSS Grid container
  <Alerts />                   ← grid-area: alerts
  <p>Updated</p>               ← grid-area: updated
  <div class="dashboard-map">  ← grid-area: map (DOM order: before sidebar for mobile)
    <Galaxy />
  </div>
  <div class="dashboard-sidebar"> ← grid-area: sidebar (scrollable container)
    Campaigns (EventCards)
    Stats (FactionTabs + StatGrid)
    Event Timeline (moved here from outside)
  </div>
</div>
```

DOM order is mobile-friendly (map before sidebar). CSS `grid-template-areas` handles visual reordering at desktop — no `order` or `row-reverse` needed.

## Layout Structure (lg: 1024px+)

### Two-Column: Sidebar Left + Pinned Map Right

- **Sidebar (left):** Fixed width per breakpoint, independently scrollable (`overflow-y: auto`), contains campaigns, stats, and timeline.
- **Map (right):** Fills remaining width, position sticky so it stays pinned in the viewport while the sidebar scrolls. Map is vertically centered within its column.
- **Alerts + timestamp:** Span full width above the two-column area.
- **Inset padding:** Everything sits inside the existing `.gutters` spacing — not edge-to-edge. This provides breathing room between the header, content, and viewport edges.
- **Content height:** `calc(100dvh - var(--header-height) - vertical-padding)` where `--header-height` is 80px at lg:+ and vertical padding matches gutter spacing.

### Grid Template Areas

```css
/* Mobile (default) */
grid-template-areas:
  "alerts"
  "updated"
  "map"
  "sidebar";
grid-template-columns: 1fr;

/* Desktop (lg:) */
grid-template-areas:
  "alerts  alerts"
  "updated updated"
  "sidebar map";
grid-template-columns: 260px 1fr;
```

### Sidebar Content Order

1. Campaigns (EventCards — faction frontline status)
2. Stats (FactionTabs + StatGrid)
3. Event Timeline (moved from below the dashboard into the sidebar)

### Sidebar Scrolling

The sidebar has a fixed height matching the content area and scrolls independently with `overflow-y: auto`. Scrollbar styling should be minimal (thin, muted) to match the dark theme. The map remains pinned regardless of sidebar scroll position.

## Breakpoint Scaling

| Breakpoint | Width | Sidebar | Layout | Max-Width |
|---|---|---|---|---|
| < lg (< 1024px) | — | N/A | Single column, vertical stack (unchanged) | None |
| lg: (1024px) | 1024px+ | 260px fixed | Two-column: sidebar left, map right | Dynamic cap |
| xl: (1280px) | 1280px+ | 300px fixed | Same, sidebar wider | Dynamic cap |
| 3xl: (1920px) | 1920px+ | 360px fixed | Same, sidebar wider | Dynamic cap |

### Mobile / Tablet (Unchanged)

Below lg:, the layout remains a single vertical column: map on top (centered, max-width 480px at md:), data below. No changes to mobile or tablet breakpoints.

### Sidebar Order Consistency

The sidebar always appears on the left when the two-column layout is active. There is no breakpoint where it flips to the right. Below lg:, the two-column layout doesn't exist — it's a single column.

## Dynamic Max-Width Cap

The galaxy map is a circle whose diameter is constrained by the available viewport height. Once the map column reaches the height limit, making the container wider adds no value — the map can't grow beyond its vertical constraint.

The dashboard container's `max-width` is calculated dynamically:

```
max-width: calc(100dvh - var(--header-height) - var(--vertical-padding) + var(--sidebar-width) + var(--horizontal-gaps))
```

This ensures the container stops growing exactly when the map can't benefit from more width. The container is horizontally centered (`margin: 0 auto`) so ultrawide monitors see the dashboard centered with space on both sides.

### Variables

- `--header-height`: 80px (header is always 80px at sm:+, and lg: implies sm:+)
- `--vertical-padding`: total top + bottom gutter padding, scales with breakpoint
- `--sidebar-width`: 260px / 300px / 360px depending on breakpoint
- `--horizontal-gaps`: gap between sidebar and map column

## Files to Modify

### `DashboardClient.css`

- Replace flex layout with CSS Grid using `grid-template-areas`
- Remove `.dashboard-main` styles, add `.dashboard` grid styles
- Mobile: single-column grid (alerts → updated → map → sidebar)
- lg: two-column grid with `grid-template-areas: "alerts alerts" "updated updated" "sidebar map"`
- Sidebar: fixed width, `overflow-y: auto`, height calc
- Map column: `position: sticky`, `top` offset, vertically centered
- Dynamic `max-width` on `.dashboard`, centered with `margin: 0 auto`
- xl: and 3xl: media queries for sidebar width scaling
- Sector grid: single column inside sidebar (already the case at lg:)

### `DashboardClient.jsx`

- Remove `.dashboard-main` wrapper div — make all sections direct children of root `.dashboard` grid
- Assign grid-area class names or data attributes to: Alerts, timestamp, map, sidebar
- Move Event Timeline into `.dashboard-sidebar`
- DOM order: Alerts → timestamp → map → sidebar (mobile-friendly)
- No changes to component props or data flow

### No Changes To

- Mobile/tablet layout behavior (below lg:) — grid just stacks single-column
- Individual components: EventCard, StatGrid, FactionTabs, Alerts, Galaxy, Event, WarTimeline
- Header, Footer, BottomNav, HeaderNav
- tokens.css, layout.css (no new design tokens needed)

## Deferred

- **Alert hover → map highlight:** Hovering an alert card highlights the related sector on the map. Split to a separate issue in the polish phase — not part of this layout work.

## Design Decisions

1. **Sidebar left, not right:** Follows natural LTR reading flow — scan data first, then look at the visualization. Also consistent with common dashboard patterns (navigation/data panels on the left).
2. **Inset with padding, not edge-to-edge:** Edge-to-edge feels unfinished. The gutter padding gives the layout breathing room and consistency with the rest of the site.
3. **Dynamic max-width over static:** A static cap (e.g. 2560px) would waste space on some monitors and be too wide on others. The dynamic calc ties the width directly to the map's height constraint, which is the actual limiting factor.
4. **Timeline in sidebar:** Fits the "no vertical scrolling" goal. The timeline is part of the data panel, not a separate full-width section. The sidebar scrolls to accommodate it.
5. **Sticky map, not fixed:** `position: sticky` keeps the map in the document flow while pinning it visually. Simpler than `position: fixed` which requires manual offset management.
6. **CSS Grid over Flexbox:** Grid with `grid-template-areas` makes the layout explicit and readable. No `order` or `row-reverse` hacks — grid areas handle sidebar-left/map-right placement directly regardless of DOM order.
7. **Flat DOM:** Removed the `.dashboard-main` wrapper. All sections are direct grid children. The only nesting is the sidebar container, which is justified — it's a scrollable unit, not a layout wrapper.
