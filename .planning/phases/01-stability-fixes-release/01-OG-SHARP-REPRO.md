# OG Image Sharp Rejection — Reproduction Attempt (#503, STAB-02, D-10)

**Date:** 2026-08-31
**Bound:** single focused attempt, time-boxed per plan 01-05

## Environment

- **Host platform:** macOS on Apple Silicon (`arm64`), Docker Desktop, `docker version` 29.7.2
- **Build platform produced:** `linux/arm64` (confirmed via `docker inspect og-repro-app:local --format '{{.Os}}/{{.Architecture}}'`) — this is the **same architecture the staging Raspberry Pi Swarm target runs**, so unlike the plan's flagged "approximate platform parity" assumption, this run is not an amd64 proxy for an arm64 target — it *is* arm64. An amd64 build was not additionally attempted (out of scope for one bounded attempt; a future session on an amd64 host, or `docker buildx --platform linux/amd64`, would close that gap if this verdict is ever revisited).
- **Source commit:** `87f064aa` (working tree at the time of this run — the same commit this document is committed against, modulo `.planning/` bookkeeping)
- **Images built locally from source** (no GHCR pull), using the same Dockerfiles the CI smoke workflow (`docker-compose.ci.yml`) builds from, but driven manually via `docker build`/`docker run` instead of `docker compose` so that `WORKER_ENABLED` could be set explicitly (the compose file does not expose it as an overridable variable):
  - App image: `docker build -f Dockerfile.app -t og-repro-app:local --build-arg NEXT_PUBLIC_DEPLOY_ENV=ci .`
  - Migrate image: `docker build -f Dockerfile.migrate -t og-repro-migrate:local .`
- **Runtime env supplied to the app container** (names only, no values beyond what's below — none of these are secrets in this throwaway local run):
  - `POSTGRES_URL` — pointed at a locally-run `postgres:17-alpine` container on a private Docker network, `sslmode=disable`
  - `POSTGRES_SSL=false`
  - `UPDATE_KEY` — a stub placeholder value, unused since the worker never ran
  - `UPDATE_INTERVAL=60`
  - `WORKER_ENABLED=false` — poller intentionally disabled so it could not claim the lease or write to campaign tables while investigating (T-05-03)
  - `NODE_ENV=production`
  - `BETTER_AUTH_SECRET`, `SENTRY_DSN`, `UMAMI_SITE_ID` intentionally unset — each feature no-ops gracefully in their absence (confirmed in container boot logs: `BETTER_AUTH_SECRET is not set — auth features disabled`, `UMAMI_SITE_ID is not set — Umami analytics disabled`, `SENTRY_DSN is not set — error tracking disabled`)
- **Database seed:** the migrate container's default seed path (`prisma migrate deploy && node prisma/seed/seed.mjs`), which loaded the full committed historic dataset — 159 real seasons of `h1_season`/`h1_status`/`h1_event`/etc. — giving real production-shaped campaign data to render against, not synthetic fixtures.
- **Reproducibility:** another reader can reproduce this exact sequence with the two `docker build` commands above, a `postgres:17-alpine` container on a shared Docker network, the migrate image run once against it, then the app container run with the env var *names* listed above (supplying their own values for `POSTGRES_URL`/`UPDATE_KEY`).

## Standing Hypotheses

| # | Hypothesis | Disposition | Evidence |
|---|---|---|---|
| 1 | Missing or mismatched `@img/sharp-*` native binary in the runtime layer | **RULED OUT** | Inspected the built image directly: `/app/node_modules/@img/sharp-linux-arm64/lib/sharp-linux-arm64-0.35.3.node` is present, matching the distroless `nodejs24-debian12` (glibc) runtime's architecture. Every one of the three real-pipeline requests below (and the two successful production-shaped runs already recorded in `01-OG-CACHE-VERIFICATION.md` from plan 01-03) completed a real `ImageResponse` render through sharp with no rejection. |
| 2 | Font unavailable inside the image, causing Satori to fall back differently than on the developer machine | **RULED OUT (by inspection, not by trigger)** | `src/app/opengraph-image.jsx`'s `new ImageResponse(...)` call passes no `fonts` option (confirmed by reading the file as it stands after plans 01-03/01-04). Satori draws this route's tree entirely with its own bundled default font — there is no filesystem font file this render path depends on, so a missing/mismatched font file cannot be the cause for *this* route. (The image *does* ship `next/font`-generated `.woff2` files and two static `.ttf`/`.otf` files under `public/fonts/`, but those back `layout.jsx`'s `Space_Mono`/display fonts for the HTML pages, an unrelated, already-tracked issue — D-17/#476 — not the OG image pipeline.) |
| 3 | An edge-case SVG shape in `buildMapSvg`'s output that sharp will not rasterise | **NOT CONFIRMED** | Drove three distinct real map states (below) through the actual `getCampaign()` → `computeLiveMapState()` → `buildMapSvg()` → `ImageResponse` → sharp pipeline. All three rendered a real card (200, `Cache-Control: public, s-maxage=300, stale-while-revalidate=60`, `image/png`, ~142.6 KB PNG, valid PNG per `file`) — none fell back and none rejected. |

## Requests Made

Each request was `curl -s -D - -o <file> http://127.0.0.1:3000/opengraph-image` against the running container, with the "current" season selected by updating that season's `h1_season.last_updated` to the newest timestamp in the seeded DB (the route's `getCampaign()` always reads the season with the max `last_updated` — there is no URL parameter to select a season directly, so this is how each map-state shape was selected for the *real* route rather than only proving it through mocks, as 01-04's unit suite does).

| # | Map state driven | Season used | Result | Cache-Control | Body |
|---|---|---|---|---|---|
| 1 | Baseline "current" state as seeded (in-progress campaign, active events plausible) | 159 (highest-numbered seeded season, naturally the max-`last_updated` row) | `200 OK`, real rendered card | `public, s-maxage=300, stale-while-revalidate=60` | Valid 1200×630 PNG, 142.6 KB |
| 2 | All three factions `DEFEATED` at the latest bucket (VICTORY / `allDefeated` branch) | 2 (all three factions confirmed `status = 'defeated'` in latest `h1_status` bucket per direct DB query) | `200 OK`, real rendered card | `public, s-maxage=300, stale-while-revalidate=60` | Valid 1200×630 PNG, 142.6 KB |
| 3 | Long-completed historic season, zero `ACTIVE` events (every `h1_event` row for the season is `success`/`fail`, none `active` — a genuine no-active-events state, not a synthetic fixture) | 100 | `200 OK`, real rendered card | `public, s-maxage=300, stale-while-revalidate=60` | Valid 1200×630 PNG, 142.6 KB |

Three distinct map states were driven through the real pipeline per the stop condition; none reproduced the rejection, so the attempt stopped there rather than iterating further.

**Container logs across all three requests:** no error, no stack trace, no `reportError`/GlitchTip call. The only log lines besides the boot sequence were three benign `[umami] sendUmamiEvent failed: fetch failed` lines — expected, since `UMAMI_SITE_ID` was intentionally unset for this run and `trackOgOutcome()`'s `after()`-scheduled telemetry call has nowhere to send its event; this does not affect the response already sent to the client and is not the #503 symptom.

**A shape that could not be tested:** the "homeworld-only, active attack event, no sector campaign" state named in `01-04-SUMMARY.md`'s edge-case list requires an `ACTIVE` event row, and by construction no season in the seeded historical dataset carries one (every event in every completed season is `success` or `fail` — the war has moved on for all of them). Only the live/current season could ever carry an `ACTIVE` event in a real deployment, and this run's seeded "current" season (159) did not happen to have an in-progress homeworld-only shape at seed time. This state is covered against the real `computeMapState()` output by 01-04's unit suite (`a real card, not the fallback` for the homeworld-only fixture) — just not independently re-confirmed against the real Satori/sharp pipeline in this session, which is consistent with the plan's three-state stop condition already being met by the two states above plus the baseline.

**Fallback-path re-check (bonus, not required by the stop condition):** not independently re-run in this session — plan 01-03's Task 3 already produced equivalent production-standalone-build evidence for the fallback path (`01-OG-CACHE-VERIFICATION.md`, requests 3–4 against an unreachable DB), and re-deriving it here would not add a fourth *rasterisation-pipeline* data point, which is what this document exists to gather.

## Verdict

Verdict: NOT REPRODUCED — the Satori/sharp rejection did not reproduce against a locally built `linux/arm64` standalone image (same architecture as the staging Raspberry Pi Swarm target) across three distinct real map-state shapes rendered through the actual pipeline with real seeded production data, and both inspectable hypotheses (native sharp binary presence/arch match, font-file dependency) were ruled out directly.

## Resolution

**Branch taken: NOT REPRODUCED.** No source under `src/` was modified by this investigation (confirmed: `git status --short src/` returns 0 lines at the time this document was written). Per D-10 and this plan's own success criteria, the fallback (01-03), telemetry, and getCampaign-audit work (01-04) ship regardless of this verdict — #503 stays open, and the findings above are the recorded outcome of this bounded attempt, not a blocker.

**GitHub issue #503 comment:** posting this document's findings via `gh issue comment 503` is the next action in this plan's Task 2, alongside leaving the issue open.

### Next attempt should start here

- **Still-open hypothesis:** #3, the edge-case-SVG-shape hypothesis, is *not confirmed* but also not fully closed — the one shape this session could not drive through the real pipeline (homeworld-only / active-attack-event-with-no-sector-campaign) is exactly the shape most likely to differ structurally from the three tested here, since it is the only one of the four CONCERNS.md-named shapes that changes which SVG elements `buildMapSvg` emits for region 11 (the homeworld circle) versus the ten numbered sectors.
- **Evidence that would settle it:** wait for (or manufacture) a real `ACTIVE` `h1_event` row of type `attack` with no sector campaign progress in the seeded "current" season, then repeat this exact request sequence against it. The 01-04 telemetry (`api-og-fallback` events with `stage: 'rasterisation'` in Umami/GlitchTip) is the passive instrument for this — if this shape is the real cause, production telemetry should eventually show a `rasterisation`-stage fallback correlated with an active homeworld attack event, which would be the trigger to revisit this investigation with a manufactured fixture DB row instead of waiting on natural occurrence.
- **Platform gap:** this run only tested `linux/arm64`. An amd64 build (`docker buildx build --platform linux/amd64 -f Dockerfile.app .`) was not attempted in this bounded session and would be worth ruling in/out if the arm64 result is ever questioned, though the actual staging/production target is arm64, so this is a lower-priority gap than the SVG-shape hypothesis above.
