---
kind: component
title: API (internal h1, public v1, rebroadcast)
component: api
status: implemented
source_revision: 8f831f68b831926122aec0fefc515bd0def40bb1
source_evidence_date: 2026-11-09
---

# API

[Architecture overview](helldivers-bot-architecture.md)

## What it does

Expose the stored war record: an internal update/live pair for the app itself, a key-gated
versioned API for external consumers, and the HD1-API drop-in rebroadcast that rebuilds the
original HD1 wire format from the normalized tables. A route that needs a season the database does
not hold yet backfills it through the update pipeline's `updateSeason()`.

### Routes

| Route | Auth | Purpose |
|---|---|---|
| `src/app/api/h1/update/route.js` | Bearer `UPDATE_KEY` | Ingestion entry point called by the worker thread |
| `src/app/api/h1/live/route.js` | none | Powers the dashboard's 10 s polling (`useLiveData`); response carries `appVersion` for stale-client reload |
| `src/app/api/h1/campaign/route.js` | none | Deprecated read of campaign data for one season or the latest; replaced by `/api/v1/h1/status` and `/stats` |
| `src/app/api/h1/rebroadcast/route.js` | API key + rate limit (per key) | HD1-API drop-in (POST, form `action`): HD1 wire format rebuilt from `h1_*` rows (`src/db/queries/rebroadcast.mjs`) |
| `src/app/api/v1/h1/{map,season,stats,status}/route.js` | API key + rate limit (per IP) | Public versioned API; each route has a co-located `*Projection.mjs` shaping the wire response; OpenAPI via `@asteasolutions/zod-to-openapi` |
| `src/app/api/notifications/subscribe/route.js` | same-origin check + rate limit | Web-push subscribe (POST) and unsubscribe (DELETE) |
| `src/app/api/auth/[...all]/route.js` | — | BetterAuth catch-all (503 when auth is disabled) |
| `src/app/api/healthcheck/route.js` | none | Liveness for the swarm health check |
| `src/app/api/glitchtip/route.js`, `src/app/api/umami/route.js` | none | Sentry tunnel and Umami proxy, so ad blockers don't break them |
| `src/app/stats.js/route.js`, `src/app/recorder.js/route.js` | none | Umami script proxies (`proxyUmamiScript`) |

## Rules it keeps

- Responses go through `errorResponse`/`successResponse` (`src/shared/utils/api/responses.mjs`),
  except the auth catch-all, the glitchtip and umami proxies and the two Umami script proxies.
  The response helpers set `time` with `performanceTime`; `roundedPerformanceTime`
  (`src/shared/utils/time.mjs`) rounds up to the next 50 ms for Umami event data.
- Every route except the auth catch-all exports `methodNotAllowed`
  (`src/shared/utils/api/methodNotAllowed.mjs`) for unsupported methods.
- Rate limiting is `src/shared/utils/api/rateLimit.mjs`, a fixed-window counter in Postgres. The
  limit for each group is in `src/config/policy.mjs`. The `public_read`, `history_read`,
  `backfill_trigger` and `push` groups use `getClientIp`: the first `X-Forwarded-For` hop, then
  `X-Real-IP`. The rebroadcast group uses the API key id.
  `getClientIp` assumes that the proxy removes an `X-Forwarded-For` header that the client sent
  (`src/shared/utils/api/clientIp.mjs`); unverified for the Cloudflare Tunnel in front of both stacks.
- Live map reads must go through `computeLiveMap` (`src/shared/utils/game/computeMapState.mjs`) so
  internal and public map endpoints cannot drift.

## Code paths

- `src/app/api/`: the routes in the table under What it does.
- `src/db/queries/rebroadcast.mjs`: the HD1 wire format, rebuilt from `h1_*` rows.
- `src/db/queries/`: the read queries behind the routes (`getCampaign.mjs`, `getCampaignOrSeed.mjs`,
  `getSeasons.mjs`, `getStats.mjs`, `getStatusHistory.mjs`).
- `src/shared/utils/api/`: the responses, `methodNotAllowed`, the rate limiting, API-key validation
  (`validateApiKey.mjs`, `requireApiKey.mjs`), the season backfill (`backfillSeason.mjs`) and the
  OpenAPI spec (`openapiRegistry.mjs`, shown by `src/app/docs/api/page.jsx`).
- `src/config/policy.mjs`: the rate-limit groups and the Cache-Control tiers.
- `src/shared/utils/game/computeMapState.mjs`: `computeLiveMap`, shared by the internal and public map endpoints.

## Sources

- `.planning/codebase/ARCHITECTURE.md`, `STRUCTURE.md` checked against `src/app/api/` at `1755207f`
  on 2026-11-05.
- Each claim re-checked against the code at `8f831f68` on 2026-11-09.
