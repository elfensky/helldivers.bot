# Phase 6: Galaxy — Static Info Enhancements

**Issue:** #32
**Date:** 2026-03-28

## Overview

Add two server-rendered info elements to the galaxy map: a "last updated" timestamp and per-faction player counts. No client-side polling — that's Phase 10 (#41).

## 1. "Last Updated" Indicator

**Position:** Below the galaxy map, above the faction tabs. Centered, inline with the map section.

**Format:** `Updated Xs ago` or `Updated Xm ago` — computed at render time from `data.last_updated` (already returned by `getCampaign()`).

**Styling:**

- Font: `--font-mono`
- Color: `--color-text-muted`
- Size: small (text-xs or 12px)
- Centered

**Data flow:**

- `page.jsx` already has `data.last_updated`
- Pass `lastUpdated` prop from `DashboardClient` → `Galaxy`
- `Galaxy` renders a `<p>` below the `<Map>` component
- Compute relative time string (e.g., `45s ago`, `3m ago`) with a simple helper — no library needed

## 2. Player Counts Above Faction Icons

**Position:** SVG `<text>` elements inside the map SVG, centered horizontally above each faction icon. Uses existing `factionIcons` coordinates:

- Bugs: x=760, y=110 (above icon at 710,120)
- Cyborgs: x=50, y=110 (above icon at 0,120)
- Illuminate: x=404, y=757 (above icon at 354,765)
- Super Earth: no player count

**Format:** Compact number — `12.3K`, `1.2M`, `847`. Same `formatNumber` logic as `StatGrid`.

**Styling:**

- Font: monospace (SVG `font-family="monospace"`)
- Fill: `rgba(255,255,255,0.7)`
- Size: ~18px in SVG units
- `text-anchor="middle"`, `pointer-events="none"`

**Data flow:**

- `DashboardClient` passes `data.live` to `Galaxy` → `Map`
- `Map` receives a new `live` prop (array of 3 faction objects)
- `Map` renders `<text>` elements inside each faction `<g>`, positioned above the `<image>`
- Reuse `formatNumber` from `StatGrid` (extract to shared util or inline)

## Out of Scope

- Client-side auto-refresh / polling / WebSocket — Phase 10 (#41)
- Faction background clouds — separate issue
- Tooltip changes
