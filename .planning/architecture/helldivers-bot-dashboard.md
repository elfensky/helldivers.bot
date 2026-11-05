---
kind: component
title: Dashboard (live view, galaxy map)
component: dashboard
status: implemented
source_revision: 1755207f68e2d5f4e12e9b999a641e94720e02e4
source_evidence_date: 2026-11-05
publication_status: decided-not-built
---

# Dashboard

[Architecture overview](helldivers-bot-architecture.md)

## Responsibility

The live home page (`src/app/page.jsx` + `src/features/dashboard/`): galaxy map, stat grid, event
cards, timeline, connection status — all fed by 10-second polling of `/api/h1/live`.

## Moving parts

- `src/shared/hooks/useLiveData.mjs` — `setInterval` + `fetch` every 10 s, immediate re-poll on
  `visibilitychange`; tri-state status `'polling' | 'live' | 'offline'`; module-level singleton per
  tab; BroadcastChannel leader election for notifications; compares `appVersion` and hard-reloads
  on mismatch.
- `src/shared/utils/game/computeMapState.mjs` — `computeLiveMap(data)` returns
  `{ activeEvents, mapState }` and is the single active-events filter shared by `/api/h1/live` and
  `/api/v1/h1/map`; `computeLiveMapState(data)` is the SSR/OG wrapper used by `layout.jsx` and
  `opengraph-image.jsx`. Sectors 1–10 derive from campaign `points`/`points_max`; region 11
  (homeworld) from attack events only.
- Key components: `DashboardClient`, `Galaxy`/`Map`, `StatGrid` (+ WON/LOST cards), `EventCard`,
  `TimelineSection`, `ConnectionStatus`, `LiveToasts`, `FactionTabs`, `HeaderNav`/`BottomNav`.
- Layout: mobile-first single column; at `lg:` a two-column hero (`height: calc(100dvh - 80px)`)
  with sidebar left and map right; grid columns must use `minmax(0, 1fr)`, never bare `1fr`.

## Invariants

- All dates render with `timeZone: 'UTC'` (the #418/#496 hydration class came from locale
  divergence); server components stay free of render-time locale reads.
- Every interactive element carries a `data-umami-event` (or `useTrack()` for dynamic events).
- Tailwind-first styling; tokens in `src/app/layout.css` `@theme`; border radius 0 everywhere;
  right-side accent line on cards via CSS Grid.

## Sources

- `.planning/codebase/STRUCTURE.md` checked against `src/features/dashboard/`, `src/features/galaxy/`,
  `src/shared/hooks/useLiveData.mjs` at `1755207f` on 2026-11-05.
