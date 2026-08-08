# prisma/seed

Historical Helldivers 1 season data, committed as JSON files and loaded
into the database on every fresh deploy. This seeds the `h1_*` tables
with the complete past-war history so `/archives` has something to show
from the first request — without requiring users to wait for on-demand
backfill.

## Layout

```
prisma/seed/
├── readme.md              # this file
├── fetch-seasons.mjs      # one-shot refresh script (writes JSON files)
├── seed.mjs               # prisma db seed runner (reads JSON files)
└── seasons/
    ├── season-001.json
    ├── season-002.json
    ├── ...
    └── season-NNN.json    # most recent completed season
```

Each JSON file mirrors the raw shape of the official HD1 API's
`get_snapshots?season=N` response, with top-level fields `time`,
`error_code`, `introduction_order`, `points_max`, `snapshots`,
`defend_events`, `attack_events`. The top-level `time` field is a
provenance marker showing when the file was last validated against the
live API.

## Refreshing the files — `fetch-seasons.mjs`

Run this script to pull the latest state of completed seasons from the
live API and write them to `seasons/*.json`.

```bash
# Refresh all seasons that need updating (fetches only missing files)
node prisma/seed/fetch-seasons.mjs

# Force re-fetch every season (overwrites existing files)
node prisma/seed/fetch-seasons.mjs --force

# Refresh a specific range
node prisma/seed/fetch-seasons.mjs --force --from=148 --to=156
```

You rarely need to run it by hand: `.github/workflows/scheduled-seed-refresh.yml`
runs it every Monday (and on `workflow_dispatch`) and opens a PR against
`develop` on the `chore/seed-refresh` branch whenever a season has
completed since the last run. Merge that PR locally with `--no-ff`, doing
the version bump + CHANGELOG entry in the merge commit as usual — the
workflow deliberately does not touch either.

**The script will never fetch the currently-active season.** The active
season's `get_snapshots` response is a mid-war partial by definition, so
capturing it to disk would create a stale seed file that reseeds
incomplete data on future deploys until the next manual refresh. The
`--to` default auto-resolves to `currentSeason - 1`; an explicit `--to`
at or above the current season is clamped with a warning.

**When to refresh:** every few seasons, or whenever you notice drift
between the live API and the disk files. The HD1 API occasionally
appends a "closing frame" snapshot to a season's history shortly after
it ends — running `fetch-seasons.mjs --force --from=<recent>` will pick
those up and bring disk files to parity.

### Options

| Flag        | Default             | Description                                                                |
| ----------- | ------------------- | -------------------------------------------------------------------------- |
| `--from=N`  | `1`                 | Start season (inclusive)                                                   |
| `--to=N`    | `currentSeason - 1` | End season (inclusive); clamped to `currentSeason - 1` if specified higher |
| `--delay=N` | `500`               | Delay in ms between requests to the official API                           |
| `--force`   | off                 | Overwrite existing files (default: skip them)                              |

## Loading the files — `seed.mjs`

This is the Prisma seed runner invoked by `prisma db seed` (and by
`Dockerfile.migrate`'s startup command). It reads every `seasons/*.json`
file and upserts the contents into the normalized `h1_*` tables.

```bash
# Run manually (normally invoked via Dockerfile.migrate)
node --experimental-strip-types prisma/seed/seed.mjs

# Force re-seed when the DB already has all seasons
FORCE_SEED=true node --experimental-strip-types prisma/seed/seed.mjs
```

**Idempotent.** Every write is a Prisma `upsert` keyed on a natural
identifier (`season`, `(season, time)`, or `(type, event_id)`), so
running `seed.mjs` multiple times with the same data produces no
visible changes.

**Per-season skip.** `seed.mjs` reads the season number out of each
filename, compares it against the seasons already present in
`h1_season`, and upserts only the missing ones. A deploy that adds one
season file writes one season, not all of them.

This replaced a count comparison (`db.h1_season.count() === <number of
JSON files>`) that was wrong in both directions: it re-seeded everything
whenever the numbers differed — which is the normal state, since the
live worker creates a row for the in-progress season that has no file
yet — and it skipped everything whenever they happened to match, even
when the rows were for different seasons than the files.

Set `FORCE_SEED=true` to re-run the full upsert loop regardless. Only
`true`, `1` or `yes` enable it; anything else, including `false`, leaves
it off.

## Why two scripts?

Separation of concerns:

- `fetch-seasons.mjs` talks to the **live HD1 API** and writes local
  files. It is run by developers on their workstations to refresh disk
  data, then the updated files are committed to git.
- `seed.mjs` talks to the **local database** and reads local files.
  It runs unattended in Docker during every deploy, carries no API
  credentials, and makes no network calls.

Shipping the `seasons/*.json` files in git means fresh deploys get
complete historical data immediately, without requiring the container
to reach the HD1 API during startup.

## Relationship to runtime backfill

The runtime `updateSeason()` function at `src/update/season.mjs` is a
**third** path into the same `h1_*` tables. It fetches
`get_snapshots?season=N` on demand for the currently-active season
(every worker poll), the outgoing season (once per detected season
transition — see `src/app/api/h1/update/route.js`), and any historical
season a user requests via `/archives?season=N` or the admin "Refresh"
button. `updateSeason` uses the same Zod schema (`isValidSeason`) and
the same upsert keys, so it is fully interoperable with `seed.mjs`'s
bulk writes — you can seed from disk, then have the worker backfill
newer seasons without conflict.

None of these three scripts touches `h1_live` (the current-war live
stats table). That table is fed exclusively by the worker's
`updateStatus()` pipeline from the `get_campaign_status` endpoint,
never by `get_snapshots`. See the "Data-source separation" bullet in
`CLAUDE.md` for the full invariant.
