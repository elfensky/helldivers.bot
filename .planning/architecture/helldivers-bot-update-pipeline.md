---
kind: component
title: Update pipeline (worker, lease, ingestion)
component: update-pipeline
status: implemented
source_revision: 1755207f68e2d5f4e12e9b999a641e94720e02e4
source_evidence_date: 2026-11-05
---

# Update pipeline

[Architecture overview](helldivers-bot-architecture.md)

## Responsibility

Poll the official Helldivers 1 API (`get_campaign_status` + `get_snapshots`) roughly every
`UPDATE_INTERVAL` seconds (default ~15 s), validate, and bucket-upsert into the normalized `h1_*`
tables — exactly once across all app replicas.

## Moving parts

| Part | File | Role |
|---|---|---|
| Worker thread | `public/workers/cron.js`, `public/workers/cronLogic.js` | `setTimeout` self-scheduling loop (never `setInterval`, so polls cannot overlap); calls `GET /api/h1/update` on its own host with a Bearer `UPDATE_KEY` |
| Update route | `src/app/api/h1/update/route.js` | Orchestrates one poll: lease claim, status + season update, season-transition closing pass, push notification, heartbeat |
| Poller lease | `src/update/lease.mjs` | Atomic claim on the `worker_heartbeat` Postgres row (`claimLease()` with a conditional upsert — deliberately not `pg_advisory_lock`, which is session-bound while Prisma pools connections); `persistPollerState()` stores `prevEvents` / `lastSeasonObserved` holder-guarded |
| Status updater | `src/update/status.mjs` | Validates + bucket-upserts the `get_campaign_status` payload |
| Season updater | `src/update/season.mjs` | Validates + bucket-upserts the `get_snapshots` payload; also used for on-demand backfill (`src/features/archives/reseedSeason.mjs`) |
| Bucketing | `src/shared/utils/bucketing.mjs` | Fixed-width `BUCKET_SIZE` (default 900 s) time buckets shared by both write paths; upsert key `season + enemy + bucket` |
| Push notifier | `src/update/pushNotifier.mjs` | Diffs event snapshots against lease-stored `prevEvents`, sends web-push, dedups |

## Invariants

- Only the lease holder polls; standbys answer `200 {role:'standby'}`. Failover is exactly-once
  because the poller state travels inside the lease row.
- The season-transition closing pass runs once when the polled season advances, capturing the
  outgoing season's delayed final snapshot. It reads `lastSeasonObserved` from the lease row
  (`route.js` destructures it from `claimLease()`), so it survives restarts and failovers; a
  missed closing snapshot is still recoverable via the admin/archives refresh button.
- Zod validation (`src/validators/`) happens before any database write.
- Migrations and seed apply on app start under a Postgres advisory lock
  (`src/update/migrateOnStart.mjs`); a failure logs `[migrate] failed` and retries on a backoff
  schedule while old tasks keep serving.

## Sources

- `.planning/codebase/ARCHITECTURE.md` checked against `src/update/`, `public/workers/`,
  `src/app/api/h1/update/route.js` at `1755207f` on 2026-11-05.
