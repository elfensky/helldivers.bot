---
kind: architecture
title: helldivers.bot architecture
status: implemented
source_revision: 8f831f68b831926122aec0fefc515bd0def40bb1
source_evidence_date: 2026-11-09
forwards: phase-1-stability-release, phase-1-1-production-migration, phase-2-documentation-and-operations, phase-3-test-co-location, v0-96-2
---

# helldivers.bot architecture

helldivers.bot is a Next.js 16 App Router monolith around a normalized Postgres schema, fed by an
in-process worker thread.

The worker thread polls the official Helldivers 1 API. There is no separate backend service: the
"worker" is a `worker_threads` thread inside the same Next.js server process, and multi-replica
deployments coordinate through a database-row lease, not a message queue.

**eli14:** The app is a single restaurant kitchen. One stove (the Postgres lease row) decides which
of the many identical kitchens cooks tonight — so the meal is never prepared twice. Whatever the
stove cooks is chopped into fixed-size time buckets and stored in five normalized baskets; the
counter, the menu board, and the takeaway API all read from those baskets, never from a raw tape.

## Components

```mermaid
flowchart TD
    api-consumer(["API consumer"])
    visitor(["Visitor"])
    subgraph system["helldivers.bot"]
        dashboard["Dashboard: live view, galaxy map"]
        notifications-pwa["Notifications and PWA: web-push, Serwist"]
        api["API: internal h1, public v1, rebroadcast"]
        archives["Archives: past seasons, backfill"]
        auth-admin["Auth, account and admin: optional BetterAuth"]
        update-pipeline["Update pipeline: worker, lease, ingestion"]
    end
    oauth["OAuth providers: Discord, GitHub, Google"]
    postgres[("Postgres: h1 tables, lease row")]
    hd1-api["Official Helldivers 1 API"]
    visitor -->|opens live view| dashboard
    visitor -->|opens a season| archives
    visitor -->|signs in| auth-admin
    api-consumer -->|reads v1 API| api
    dashboard -->|polls every 10 s| api
    archives -->|backfills| update-pipeline
    api -->|backfills| update-pipeline
    update-pipeline -->|polls| hd1-api
    update-pipeline -.->|upserts| postgres
    update-pipeline -->|runs push check| notifications-pwa
    api -.-> postgres
    archives -.->|reads seasons| postgres
    auth-admin -.-> postgres
    auth-admin -->|OAuth sign-in| oauth
```

- [Update pipeline](helldivers-bot-update-pipeline.md): worker, lease, ingestion, bucket-upsert, closing pass.
- [API](helldivers-bot-api.md): internal h1 routes, public versioned v1 API, rebroadcast, rate limiting and API keys.
- [Dashboard](helldivers-bot-dashboard.md): live polling client, galaxy map projection, layout.
- [Archives](helldivers-bot-archives.md): full-season timeseries and on-demand backfill.
- [Notifications and PWA](helldivers-bot-notifications-pwa.md): event-transition push, toasts, service worker, stale-version reload.
- [Auth, account and admin](helldivers-bot-auth-admin.md): optional BetterAuth, API keys, admin section.

## Rules

- Exactly one poller across replicas via the `worker_heartbeat` lease; handover state
  (`prevEvents`, `lastSeasonObserved`) lives in the lease row, never in module memory.
- No raw-cache tables: the rebroadcast and public APIs reconstruct wire format from the normalized
  `h1_*` tables on read.
- Timeseries writes are bucket-upserts by `season + enemy + bucket` (event progress by
  `type + event_id + bucket`), not an append-only log.
- All upstream data is Zod-validated before any database write.
- Live views filter to active events through `computeLiveMap` only.
- All dates render with `timeZone: 'UTC'`, except the forecast times of `NextWaveCard`, which show
  the visitor's local time.

## Sources

- `.planning/codebase/ARCHITECTURE.md`, `STRUCTURE.md` (map refreshed 2026-08-28) checked against
  `src/`, `prisma/schema.prisma` at `1755207f` on 2026-11-05.
- `AGENTS.md` § Architecture invariants and each component note re-checked against the code at
  `8f831f68` on 2026-11-09 (no file under `src/`, `prisma/`, `public/` or `deploy/` changed since
  `1755207f`).
