# Dynamic OG Image Generation

**Date**: 2026-03-26
**Status**: Draft (revised after debate review)
**Relates to**: GitHub Issue #22 (closed but only placeholder implemented)

## Context

The `/api/og` route currently renders a placeholder "Hello" image. The project has a full Galaxy map SVG component (`Map.jsx`), a pure `computeMapState` utility, and a `getCampaign` query — all the pieces needed to generate a dynamic OG image showing the current war progress. The primary use case is Discord embeds (~400x210 thumbnail), so the image must be bold and readable at small sizes.

## Architecture

```
GET /api/og → tryCatch(getCampaign()) → computeMapState() → build SVG string → embed as <img> in ImageResponse(1200x630 PNG)
```

### Satori Constraint

Satori (the renderer behind `next/og` `ImageResponse`) supports only a subset of HTML elements (`div`, `span`, `p`, `img`). It does **not** support inline `<svg>`, `<path>`, or `<circle>` elements. Therefore the galaxy map must be:

1. Built as an SVG string server-side
2. Encoded as a `data:image/svg+xml;base64,...` URI
3. Embedded via `<img src="...">` inside the `ImageResponse` JSX

### Shared SVG Path Data

**New file: `src/enums/mapPaths.mjs`**

Extracts the SVG `d` attribute strings (path geometry) from `Map.jsx` into a shared data file. Structure:

```js
export const bugPaths = [
    { id: '0-1', sector: 1, d: 'M433.74,403.35l30.16...' },
    { id: '0-2', sector: 2, d: 'M468.6,416.02l30.15...' },
    // ... sectors 1-11
];
export const cyborgPaths = [ /* same structure, ids '1-1' through '1-11' */ ];
export const illuminatePaths = [ /* same structure, ids '2-1' through '2-11' */ ];
export const superEarth = { circle: { id: '3-0', cx: 402.72, cy: 392.12, r: 27 } };
export const viewBox = '0 0 806.93 868.81';
```

Each path object includes a numeric `sector` field to avoid string parsing.

Both `Map.jsx` and the OG route import from this file. Single source of truth for map geometry.

### Map.jsx Refactor

Import paths from `mapPaths.mjs` instead of hardcoding `d="..."` in JSX. Map over the arrays to render `<path>` elements. No visual change — purely a data extraction.

### OG Route (`src/app/api/og/route.js`)

Rewrites the placeholder to generate a dynamic image:

1. Call `getCampaign()` wrapped in `tryCatch` — return fallback image on error
2. Call `computeMapState(factionStates, events)` to get sector statuses
3. Determine war outcome using shared `getWarOutcome` utility (extracted verbatim from `War.jsx`)
4. Build galaxy map as SVG string, encode as base64 data URI
5. Render `ImageResponse` with the map `<img>` + side stats
6. Set `Cache-Control: public, s-maxage=300, stale-while-revalidate=60`

## Layout: Map + Side Stats (1200x630)

```
┌─────────────────────────────────────────────────────┐
│ HELLDIVERS 1                                        │
│ GALACTIC WAR           │  SEASON 157                │
│                        │  WAR IN PROGRESS            │
│                        │                             │
│     [Galaxy Map        │  BUGS          62%          │
│      SVG with          │  ████████░░░░               │
│      colored           │                             │
│      sectors]          │  CYBORGS       45%          │
│                        │  █████░░░░░░░               │
│                        │                             │
│                        │  ILLUMINATE    28%          │
│     60% width          │  ███░░░░░░░░░               │
│                        │                             │
│                        │              helldivers.bot  │
└─────────────────────────────────────────────────────┘
```

- **Left 60%**: Galaxy map SVG with inline styles
- **Right 40%**: Season, status, faction progress bars, branding
- **Background**: `rgb(0, 9, 19)` (dark navy, matches site)

## Color Mapping

Sector fill colors are applied inline based on `map[faction][sector].status`:

| Status | Fill Color |
|--------|-----------|
| `captured` | `rgba(255, 213, 0, 0.33)` (yellow) |
| `lost` | `rgba(0, 0, 0, 0.55)` (black) |
| `in_progress` (bugs) | `rgba(25, 218, 12, 0.35)` (green) |
| `in_progress` (cyborgs) | `rgba(213, 15, 15, 0.35)` (red) |
| `in_progress` (illuminate) | `rgba(12, 122, 218, 0.35)` (blue) |

Sector stroke: `rgba(255, 225, 0, 0.99)` for captured/in_progress, `rgba(0, 0, 0, 0.99)` for lost.

Faction progress bar colors match the sector fill colors at higher opacity.

## Data Flow

1. `getCampaign()` returns `{ season, live, events, ... }`
2. `live` array has 3 faction objects with `points`, `points_taken`, `points_max`, `status`
3. `computeMapState(live, events)` returns `map[factionIndex][sectorIndex]` with status per sector
4. Faction progress percentage: `Math.round((points / points_max) * 100)` — uses `points` (not `points_taken`) to align with `computeMapState`'s sector calculation
5. War outcome: determined by shared `getWarOutcome` utility (verbatim from `War.jsx`). Decision tree: victory signal AND no defeat signal → VICTORY; defeat signal → DEFEAT; no victory signal → DEFEAT; no data → null (in-progress)

## Error Handling

- `getCampaign()` wrapped in `tryCatch` per project convention
- On error or missing data, return a branded fallback image (not a 500)
- `computeMapState` and `getWarOutcome` are pure functions that won't throw on valid shapes

## Caching

- `Cache-Control: public, s-maxage=300, stale-while-revalidate=60` on all responses
- War data updates every ~10 minutes via worker thread, so 5-minute cache is safe
- Prevents social media crawlers from hammering the DB on viral links

## Integration

- Update `src/app/layout.jsx` metadata to use `/api/og` as the OG image URL
- Keep static `opengraph-image.png` as fallback (browsers that don't support dynamic OG)

## Not In Scope

- Season query parameter (current war only for now)
- ISR / advanced caching beyond Cache-Control (can add later)
- Custom font loading (use Satori defaults for now)
- Sector labels or tooltip data (too small for OG thumbnails)
- Mobile-specific OG sizes

## Files to Create/Modify

| File | Action |
|------|--------|
| `src/enums/mapPaths.mjs` | **Create** — shared SVG path geometry |
| `src/components/h1/Galaxy/Map.jsx` | **Modify** — import paths from mapPaths.mjs |
| `src/utils/getWarOutcome.mjs` | **Create** — extracted verbatim from War.jsx |
| `src/components/h1/War/War.jsx` | **Modify** — import getWarOutcome from shared utility |
| `src/app/api/og/route.js` | **Rewrite** — dynamic OG image generation |
| `src/app/layout.jsx` | **Modify** — update metadata to use /api/og |
| `src/__tests__/unit/utils/getWarOutcome.test.mjs` | **Create** — unit tests for getWarOutcome |
| `src/__tests__/e2e/smoke.spec.mjs` | **Modify** — add OG route smoke test |

## Verification

1. Visit `/api/og` in browser — should render a PNG with the galaxy map and stats
2. Check Discord embed preview with a link to the site
3. `npm run build` — build succeeds
4. `npm run test:unit:run` — existing tests pass
5. `npm run test:smoke` — smoke tests pass (OG route returns 200)
