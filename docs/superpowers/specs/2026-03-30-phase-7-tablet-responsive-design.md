# Phase 7: Tablet Responsive Design

**Issue:** #167
**Date:** 2026-03-30

## Context

The homepage dashboard was built mobile-first (Phase 6) with a single-column layout. Current breakpoints jump from mobile directly to `sm:` (640px) with almost no `md:` or `lg:` adaptations. Tablet users — both portrait and landscape — get a stretched mobile layout that wastes horizontal space.

## Design

Two tablet tiers based on usage mode:

- **Portrait tablet (md: 768px)** — "PWA single-thumb mode". Enhanced single column, BottomNav stays.
- **Landscape tablet (lg: 1024px)** — "Website dual-hand mode". Map + sidebar layout, BottomNav hides, header absorbs navigation.

### Breakpoint Summary

| Component | Mobile (<768px) | Portrait md: (768px) | Landscape lg: (1024px) |
|-----------|-----------------|----------------------|------------------------|
| Layout | Single column | Enhanced single column | Map + sidebar |
| BottomNav | Visible (48px) | Visible (48px) | Hidden |
| Header | Logo + icons | Logo + icons | Logo + text nav + icons |
| Alerts | Vertical stack | Horizontal scroll | Horizontal scroll |
| StatGrid | 2 columns | 4 columns | 2 columns (in sidebar) |
| EventCards | 3 cols (480px+) | 3 columns | Stacked in sidebar |
| Galaxy Map | Full width, max-h-[85vh] | max-width constrained, centered | Fills left column |
| Timeline | Below cards | Below cards | Full-width below map+sidebar |
| main padding | pb-[48px] | pb-[48px] | pb-0 |

### md: (768px) — Portrait Tablet

Enhanced single column. Each section is optimized for the wider viewport:

- **Alerts:** Switch from vertical stack to horizontal scroll. Each alert card gets `min-width: ~220px` and `flex-shrink: 0`. Container uses `overflow-x: auto`. Fits 2-3 alerts side-by-side (up to 3 possible).
- **StatGrid:** Expand from 2 columns to 4 columns.
- **Galaxy Map:** Add `max-width` constraint (e.g., 480px) and center with `margin: 0 auto`. Prevents the map from stretching too wide in portrait.
- **EventCards:** Stay as 3-column grid (already kicks in at 480px).
- **BottomNav:** Stays visible — portrait tablet is still thumb-reachable.
- **Gutters:** Add `md:` intermediate gutter value between current `sm:mx-12` and `lg:mx-24`.

### lg: (1024px) — Landscape Tablet

Map + sidebar layout. This is the shift from app-mode to website-mode:

- **Layout:** Flexbox row — map on the left (`flex: 1`), sidebar on the right (`flex: 0 0 ~220-260px`).
- **Sidebar contents (top to bottom):** FactionTabs → StatGrid (2 columns) → EventCards (stacked vertically).
- **Timeline:** Full-width section below the map+sidebar row. Less prominent — it's historical context, not live status.
- **BottomNav:** Hidden (`lg:hidden`). Portrait = PWA single-thumb mode, landscape = website dual-hand mode.
- **Header navigation:** At `lg:`, header gains inline text links: "Live" (red dot with `live-blink` pulse animation, matching BottomNav's `--color-danger` styling), "History", "About". Active page gets accent underline. Links appear between logo and existing icon group, separated by a divider.
- **main padding:** Remove `pb-[48px]` at `lg:` since BottomNav is gone → `lg:pb-0`.
- **Galaxy Map:** Fills the left column naturally, no max-width constraint needed.

### Header Navigation Details (lg:+)

The header currently has: Logo | Status icon | GitHub icon | User avatar/SignIn.

At `lg:`, insert page navigation links: Logo | **Live · History · About** | Status | GitHub | Avatar.

- "Live" uses the same `live-blink` animation and `--color-danger` color as BottomNav's live indicator.
- Active page link gets `border-bottom: 2px solid var(--color-primary)` and `color: var(--color-primary)`.
- Links hidden below `lg:` (`hidden lg:flex`).
- All BottomNav destinations must be accessible from the header at `lg:+`.

### War Page

Follows the same breakpoint patterns:

- **md:** Enhanced single column, same gutters/spacing.
- **lg:** SeasonSelector and WarOutcome stay side-by-side (already `sm:flex-row`). WarTimeline gets full width. No sidebar needed — war page is sequential content, not a dashboard.

### About Page

- **md:** Cards can flow with `flex-wrap` to use horizontal space better.
- **lg:** Same card layout with wider gutters. No structural change needed.

## Files to Modify

- `src/components/layout/BottomNav/BottomNav.jsx` + CSS — add `lg:hidden`
- `src/components/layout/Header/Header.jsx` + CSS — add nav links at `lg:`
- `src/components/layout/Navigation/Navigation.jsx` — page links hidden below `lg:`
- `src/components/h1/Dashboard/DashboardClient.jsx` + CSS — sidebar layout at `lg:`
- `src/components/h1/Dashboard/DashboardClient.css` — sector-grid responsive
- `src/components/h1/Alerts/Alerts.css` — horizontal scroll at `md:`
- `src/components/h1/StatGrid/StatGrid.css` — 4 cols at `md:`, 2 cols in sidebar at `lg:`
- `src/components/h1/Galaxy/Galaxy.jsx` — map max-width at `md:`
- `src/app/layout.jsx` — main padding `lg:pb-0`
- `src/app/layout.css` — gutters `md:` value

## Out of Scope

- Desktop/ultrawide layouts (#168) — separate issue
- FactionTabs ARIA patterns (#148) — separate WCAG issue
- War page timeline visual improvements (#156, #157, #159, #165)
