---
kind: component
title: Update pipeline (worker, lease, ingestion)
component: update-pipeline
status: implemented
source_revision: 8f831f68b831926122aec0fefc515bd0def40bb1
source_evidence_date: 2026-11-09
---

# Update pipeline

[Architecture overview](helldivers-bot-architecture.md)

## What it does

Poll the official Helldivers 1 API (`get_campaign_status` + `get_snapshots`) roughly every
`UPDATE_INTERVAL` seconds (required, no default; 20 s in both deploy stacks), validate, and
bucket-upsert into the normalized `h1_*` tables — through one lease holder at a time across all app
replicas.

### Moving parts

| Part | Role |
|---|---|
| Worker thread | `setTimeout` self-scheduling loop (never `setInterval`, so polls cannot overlap); calls `GET /api/h1/update` on its own host with a Bearer `UPDATE_KEY` |
| Update route | Orchestrates one poll: lease claim, status + season update, season-transition closing pass, push check, heartbeat |
| Poller lease | Atomic claim on the `worker_heartbeat` Postgres row (`claimLease()` with a conditional upsert — deliberately not `pg_advisory_lock`, which is session-bound while Prisma pools connections); `persistPollerState()` stores `prevEvents` / `lastSeasonObserved` holder-guarded |
| HD1 client | Calls `get_campaign_status` and `get_snapshots` on the official API |
| Status updater | Validates + bucket-upserts the `get_campaign_status` payload |
| Season updater | Validates + bucket-upserts the `get_snapshots` payload; also used for the on-demand backfill of a missing season (`src/db/queries/getCampaignOrSeed.mjs`, `src/shared/utils/api/backfillSeason.mjs`) and for the admin refresh (`src/features/archives/reseedSeason.mjs`) |
| Bucketing | Fixed-width `BUCKET_SIZE` (default 900 s) time buckets shared by both write paths; upsert key `season + enemy + bucket` (`h1_status`, `h1_statistic`) or `type + event_id + bucket` (`h1_event_progress`) |
| Push check | After the poll, the update route calls `checkAndNotify` in `after()`; the notifier belongs to [Notifications and PWA](helldivers-bot-notifications-pwa.md) |

## Rules it keeps

- Only the lease holder polls; standbys answer `200 {role:'standby'}`. Failover hands over the
  poller state inside the lease row. A holder that dies after a push but before `prevEvents` is
  saved can make the next holder send that push again. The lease lasts 60 s (`LEASE_TTL_S`) and
  the HD1 request has no timeout, so a poll slower than 60 s can overlap with the next holder's poll.
- The season-transition closing pass runs once when the polled season advances, capturing the
  outgoing season's delayed final snapshot. It reads `lastSeasonObserved` from the lease row
  (`route.js` destructures it from `claimLease()`), so it survives restarts and failovers; a
  missed closing snapshot is still recoverable via the admin refresh button on `/archives`.
- Zod validation (`src/validators/`) happens before any database write.
- Migrations, and the seed when its inputs changed, apply on app start under a Postgres advisory
  lock (`src/update/migrateOnStart.mjs`); a failure logs `[migrate] failed` and retries on a
  backoff schedule while old tasks keep serving.

## Code paths

| Part | File |
|---|---|
| Worker start | `src/instrumentation.node.js`, `src/shared/utils/initializeWorker.mjs` (read `UPDATE_KEY`, `UPDATE_INTERVAL`, `WORKER_ENABLED`) |
| Worker thread | `public/workers/cron.js`, `public/workers/cronLogic.js` |
| Update route | `src/app/api/h1/update/route.js` |
| Poller lease | `src/update/lease.mjs` |
| HD1 client | `src/update/fetch.mjs` |
| Status updater | `src/update/status.mjs` |
| Season updater | `src/update/season.mjs` |
| Validators | `src/validators/isValidStatus.mjs`, `src/validators/isValidSeason.mjs` |
| Bucket-upserts | `src/shared/utils/bucketing.mjs`, `src/db/queries/upsert*.mjs` |
| Migrations on start | `src/update/migrateOnStart.mjs` |

## Sources

- `.planning/codebase/ARCHITECTURE.md` checked against `src/update/`, `public/workers/`,
  `src/app/api/h1/update/route.js` at `1755207f` on 2026-11-05.
- Each claim re-checked against the code at `8f831f68` on 2026-11-09.
