---
kind: component
title: Archives (historic seasons, on-demand backfill)
component: archives
status: implemented
source_revision: 1755207f68e2d5f4e12e9b999a641e94720e02e4
source_evidence_date: 2026-11-05
publication_status: decided-not-built
---

# Archives

[Architecture overview](helldivers-bot-architecture.md)

## Responsibility

The `/archives` page (`src/app/archives/` + `src/features/archives/`) renders any of the 160 stored
seasons: full timeseries from `h1_status` / `h1_statistic` / `h1_event_progress`, war narrative from
`h1_event` / `h1_season`. Seasons missing locally are backfilled on first request from the official
HD1 API through the same `updateSeason()` pipeline the worker uses (`src/update/season.mjs` via
`src/features/archives/reseedSeason.mjs`).

## Notes

- The season selector derives from the current season number, not a DB query.
- `updateSeason` writes `h1_season` (inlined `introduction_order[]`, `points_max[]`,
  `season_duration[]`) plus the timeseries/event tables, then stamps `h1_season.last_updated`.
- Telemetry (`h1_statistic`) exists for seasons ~157+ only: telemetry-backed UI must hide when
  empty, never render zeros; two-season comparisons drop mixed-coverage rows.
- Prediction/analysis work reads the living handoff `docs/superpowers/predictions-handoff.md` first.

## Sources

- `.planning/codebase/ARCHITECTURE.md` § Data Flow checked against `src/app/archives/`,
  `src/features/archives/` at `1755207f` on 2026-11-05.
