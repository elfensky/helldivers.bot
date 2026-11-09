# Dashboard

## What it does

The live home page: galaxy map, stat grid, event cards, event log, connection status — all fed by
10-second polling of `/api/h1/live`. The first render reads the database on the server
(`getCampaign` in `layout.jsx` and `page.jsx`).

### Moving parts

- `useLiveData` — `setInterval` + `fetch` every 10 s, immediate re-poll on `visibilitychange`;
  tri-state status `'polling' | 'live' | 'offline'`; module-level singleton per tab;
  BroadcastChannel leader election for notifications; compares `appVersion` and calls
  `guardedReload('version')` on a mismatch (at most 3 reloads in 30 s). `LiveDataProvider` calls
  it in the root layout, and the dashboard reads it through `useLiveDataContext`.
- `computeLiveMap(data)` returns `{ activeEvents, mapState }` and is the single active-events
  filter shared by `/api/h1/live` and `/api/v1/h1/map`; `computeLiveMapState(data)` is the
  map-only wrapper, used by `/api/h1/live`, `layout.jsx` and `opengraph-image.jsx`. Sectors 1–10
  derive from campaign `points`/`points_max`; region 11 (homeworld) from attack events only.
- Key components: `HomeClient` (page shell), `DashboardClient`, `Galaxy`/`Map`, `StatGrid`,
  `EventCard`, `EventLog`, `NextWaveCard`, `StatusDot`, `LiveToasts`, `FactionTabs`,
  `HeaderNav`/`BottomNav`.
- Layout: mobile-first single column, map above the sidebar. At `lg:` a two-column grid, sidebar
  left and map right. The map column is sticky at `top: 80px`, and its width follows the viewport
  height. Grid columns wrap `1fr` in `minmax()`, never bare `1fr`.

## Rules it keeps

- All dates render with `timeZone: 'UTC'` (the #418/#496 hydration class came from locale
  divergence); server components stay free of render-time locale reads. One exception:
  `NextWaveCard` shows forecast times in the visitor's local time, under `suppressHydrationWarning`.
- Every interactive element carries a `data-umami-event` (or `useTrack()` for dynamic events).
- Tailwind-first styling; tokens in `src/app/layout.css` `@theme`; border radius 0 everywhere,
  except round status dots and avatars; right-side accent line on cards via CSS Grid.

## Code paths

- `src/app/page.jsx` and `src/features/dashboard/`: the live home page.
- `src/app/layout.jsx` and `src/app/opengraph-image.jsx`: the server-rendered first data and the OG image.
- `src/shared/hooks/useLiveData.mjs`: `useLiveData`.
- `src/shared/providers/LiveDataProvider.jsx`, `src/shared/providers/LiveDataContext.mjs`: the live data for the whole tree.
- `src/shared/utils/game/computeMapState.mjs`: `computeLiveMap` and `computeLiveMapState`.
- `src/features/galaxy/`: `Galaxy`, `Map`, `EventCard`, `DefeatedCard`.
- `src/features/timeline/`: `EventLog`.
- `src/features/stats/StatGrid.jsx`: the stat grid.

## Sources

- `.planning/codebase/STRUCTURE.md` checked against `src/features/dashboard/`, `src/features/galaxy/`,
  `src/shared/hooks/useLiveData.mjs` at `1755207f` on 2026-11-05.
- Each claim re-checked against the code at `8f831f68` on 2026-11-09.
