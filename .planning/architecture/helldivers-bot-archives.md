---
kind: component
title: Archives (historic seasons, on-demand backfill)
component: archives
status: implemented
source_revision: 8f831f68b831926122aec0fefc515bd0def40bb1
source_evidence_date: 2026-11-09
---

# Archives

[Architecture overview](helldivers-bot-architecture.md)

## What it does

The `/archives` page renders any past season, chosen by `?season=N`. The selector lists seasons 1
to the current season minus 1. Each season shows its full timeseries from `h1_status` /
`h1_statistic`, and a war narrative from `h1_event` / `h1_season` plus the telemetry totals.
Seasons missing locally are backfilled on first request from the official HD1 API through the same
`updateSeason()` pipeline the worker uses.

`updateSeason` writes `h1_season` (inlined `introduction_order[]`, `points_max[]`), `h1_status`
and `h1_event`, then stamps `h1_season.last_updated`. The seed holds seasons 1 to 160.

## Rules it keeps

- The season selector derives from the current season (`getCampaign()`), not from a list of stored seasons.
- Telemetry (`h1_statistic`) exists for seasons ~157+ only: telemetry-backed UI must hide when
  empty, never render zeros. The planned two-season comparison (#269) must drop mixed-coverage rows.
- Prediction/analysis work reads the living handoff `docs/superpowers/predictions-handoff.md` first.

## Code paths

- `src/app/archives/` (`page.jsx`, `loading.jsx`, `error.jsx`) and `src/features/archives/`: the
  `/archives` page.
- `src/db/queries/getCampaign.mjs`: the season read.
- `src/db/queries/getCampaignOrSeed.mjs`: the on-demand backfill on a miss, through `updateSeason()`
  in `src/update/season.mjs`.
- `src/db/queries/getSeasonTelemetryTotals.mjs`: the telemetry totals of the narrative.
- `src/features/archives/reseedSeason.mjs`: the admin Refresh action, which also calls
  `updateSeason()`.

## Sources

- `.planning/codebase/ARCHITECTURE.md` § Data Flow checked against `src/app/archives/`,
  `src/features/archives/` at `1755207f` on 2026-11-05.
- Each claim re-checked against the code at `8f831f68` on 2026-11-09.
