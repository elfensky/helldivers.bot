# Seed Skip & Parallelism Optimization

**Date:** 2026-03-28
**Status:** Draft

## Context

The Docker migrate container (`Dockerfile.migrate`) runs `prisma migrate deploy` followed by `prisma/seed/seed.mjs` on every startup. The seed script processes 156 season JSON files, executing ~10,245 individual upsert queries. While idempotent, this takes minutes even when all data already exists in the database.

The app container (`docker-compose.yml`) depends on the migrate container completing successfully before starting. This means every deploy/restart pays the full seed cost unnecessarily.

## Goals

1. **Skip seeding when data already exists** — reduce the common-case migrate container runtime from minutes to seconds.
2. **Improve parallelism when seeding does run** — make first-run and forced re-seed faster.
3. **Automatically detect new seed files** — no manual flag needed when `fetch-seasons.mjs` adds files.

## Design

### 1. Skip-if-seeded check

Add an early-exit check at the top of the `seed()` function:

1. Count JSON files in `prisma/seed/seasons/`
2. Query `SELECT COUNT(*) FROM h1_season`
3. If counts match → log "Already seeded (N seasons). Skipping." → exit
4. If `FORCE_SEED=true` env var is set → skip the check, always re-seed

**Why count-match instead of existence check:** If `fetch-seasons.mjs` adds new season files, the file count will exceed the DB count, triggering a re-seed automatically. No manual intervention needed.

### 2. Parallel upserts within each season file

Currently, per-file processing is:
```
upsert season (must be first — FK dependency)
  → upsert meta (introduction_order + points_max) — parallel
    → upsert defend events — parallel within, but sequential with next step
      → upsert attack events — parallel within, but sequential with next step
        → upsert snapshots — parallel within
```

**Change:** Merge defend events, attack events, and snapshots into a single `Promise.all`:
```
upsert season (must be first — FK dependency)
  → upsert meta (introduction_order + points_max) — parallel
    → upsert defend + attack + snapshots — ALL parallel
```

This is safe because defend events, attack events, and snapshots only depend on `h1_season` existing (which is guaranteed by step 1). They don't depend on each other.

### 3. No changes needed elsewhere

- **`Dockerfile.migrate`** — CMD stays the same
- **`docker-compose.yml`** — no changes
- **`fetch-seasons.mjs`** — no changes (count is derived from directory contents at runtime)

## File Changes

| File | Change |
|------|--------|
| `prisma/seed/seed.mjs` | Add skip check + merge parallel upserts |

## Verification

1. `npm run build` — no build errors
2. `npm run test:unit:run` — no regressions
3. Manual: run seed against seeded DB → should log skip message and exit fast
4. Manual: run with `FORCE_SEED=true` → should re-seed all data
5. Manual: add a new season file → should detect mismatch and re-seed
