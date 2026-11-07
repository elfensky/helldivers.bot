---
kind: component
title: API (internal h1, public v1, rebroadcast)
component: api
status: implemented
source_revision: 1755207f68e2d5f4e12e9b999a641e94720e02e4
source_evidence_date: 2026-11-05
---

# API

[Architecture overview](helldivers-bot-architecture.md)

## Responsibility

Expose the stored war record: an internal update/live pair for the app itself, a versioned public
API for external consumers, and a legacy rebroadcast that reconstructs the original HD1 wire format
from the normalized tables.

## Routes

| Route | Auth | Purpose |
|---|---|---|
| `src/app/api/h1/update/route.js` | Bearer `UPDATE_KEY` | Ingestion entry point called by the worker thread |
| `src/app/api/h1/live/route.js` | none | Powers the dashboard's 10 s polling (`useLiveData`); response carries `appVersion` for stale-client reload |
| `src/app/api/h1/campaign/route.js` | none | Campaign status read |
| `src/app/api/h1/rebroadcast/route.js` | none | Legacy wire format reconstructed from `h1_*` rows (`src/db/queries/rebroadcast.mjs`) |
| `src/app/api/v1/h1/{map,season,stats,status}/route.js` | API key + rate limit | Public versioned API; each route has a co-located `*Projection.mjs` shaping the wire response; OpenAPI via `@asteasolutions/zod-to-openapi` |
| `src/app/api/notifications/subscribe/route.js` | session | Web-push subscription management |
| `src/app/api/auth/[...all]/route.js` | — | BetterAuth catch-all (503 when auth is disabled) |
| `src/app/api/healthcheck/route.js` | none | Liveness for the swarm health check |
| `src/app/api/glitchtip/route.js`, `src/app/api/umami/route.js` | none | Sentry tunnel and Umami proxy, so ad blockers don't break them |

## Conventions

- Responses go through `errorResponse`/`successResponse` (`src/shared/utils/api/responses.mjs`);
  execution time via `roundedPerformanceTime` (`src/shared/utils/time.mjs`).
- Unsupported methods export `methodNotAllowed` (`src/shared/utils/api/methodNotAllowed.mjs`).
- Rate limiting lives in `src/shared/utils/api/` and keys off the client IP (see the open
  `cf-connecting-ip` issue — `X-Forwarded-For` trust is a known footgun).
- Live map reads must go through `computeLiveMap` (`src/shared/utils/game/computeMapState.mjs`) so
  internal and public map endpoints cannot drift.

## Sources

- `.planning/codebase/ARCHITECTURE.md`, `STRUCTURE.md` checked against `src/app/api/` at `1755207f`
  on 2026-11-05.
