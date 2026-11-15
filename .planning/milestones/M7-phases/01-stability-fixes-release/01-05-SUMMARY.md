---
phase: 01-stability-fixes-release
plan: 05
subsystem: infra
tags: [opengraph-image, docker, sharp, satori, reproduction, github-issue]

# Dependency graph
requires:
  - phase: 01-03
    provides: Static crash-fallback PNG served as raw bytes, outcome-dependent Cache-Control
  - phase: 01-04
    provides: Render-outcome telemetry, getCampaign() failure-mode audit, edge-case map-state test coverage against the real route
provides:
  - A recorded, reproducible reproduction attempt against a locally built linux/arm64 standalone Docker image (matching the staging Raspberry Pi Swarm target)
  - Two of three standing #503 hypotheses ruled out by direct image inspection (sharp native binary presence/arch match, no font-file dependency in this render path)
  - Three distinct real map states driven through the real getCampaign -> buildMapSvg -> ImageResponse -> sharp pipeline with no rejection
  - A findings comment on GitHub issue #503, left open, naming the still-open hypothesis and the telemetry signal that would trigger a future revisit
affects: []

# Actuals (#2632)
actuals:
  tokens: 3200
  tasks: 2
  commits: 2

tech-stack:
  added: []
  patterns:
    - "Manual docker build/run (not docker-compose.ci.yml) when a task needs env-var control the compose file doesn't expose (WORKER_ENABLED) -- build app + migrate images individually, wire them on a shared Docker network, run migrate once, then boot the app container with explicit env"
    - "Selecting a map-state shape for a route with no season query param: bump the target season's h1_season.last_updated to be the newest in the DB, since getCampaign(null) always reads the max-last_updated season -- lets a real route be driven through a specific historical shape without modifying route code"

key-files:
  created:
    - .planning/phases/01-stability-fixes-release/01-OG-SHARP-REPRO.md
  modified: []

key-decisions:
  - "Bounded the investigation to exactly the plan's three-way stop condition: three distinct map states rendered without reproducing was reached, so the attempt stopped there rather than continuing to search for a fourth or fifth shape"
  - "Docker Desktop on this host builds linux/arm64 by default, which happens to BE the staging Raspberry Pi Swarm's real architecture rather than an approximate amd64 proxy for it -- recorded explicitly since the plan's flagged assumption anticipated only an approximate platform match"
  - "The homeworld-only/active-attack-event map state could not be driven through the real pipeline in this session because no season in the seeded historical dataset carries an ACTIVE h1_event row by construction (every completed season's events are success/fail) -- flagged as the still-open hypothesis rather than treated as a gap in the stop condition, since three other distinct states already satisfied it"
  - "Findings comment posted to #503 verbatim from the reproduction document (gh issue comment 503 --body-file ...) rather than a hand-written summary, so the issue carries the exact same environment/hypothesis/verdict detail a later reader gets from the repo"

requirements-completed: [STAB-02]

coverage:
  - id: D1
    description: "The sharp rejection is reproduced against the standalone Docker image locally, or the attempt is recorded with what was tried and what the image did instead"
    requirement: STAB-02
    verification:
      - kind: other
        ref: ".planning/phases/01-stability-fixes-release/01-OG-SHARP-REPRO.md -- Verdict: NOT REPRODUCED, with build/run commands, env, and three request/response records"
        status: pass
    human_judgment: false
  - id: D2
    description: "The investigation is genuinely time-boxed -- three distinct map states driven through the real pipeline without reproducing is a defined stop condition, met and honored"
    requirement: STAB-02
    verification: []
    human_judgment: true
    rationale: "Whether the three tested shapes constitute a meaningful sample, and whether stopping there rather than chasing the homeworld-only shape further was the right call, is a judgment call about investigation scope that no automated check can render -- a human reviewing the reproduction document confirms the stop condition was applied in good faith."
  - id: D3
    description: "Findings are written to #503 in a form a later reader can act on: exact image tag, command, observed error/result, and map state that triggered each observation"
    requirement: STAB-02
    verification:
      - kind: other
        ref: "gh issue comment 503 -- https://github.com/elfensky/helldivers.bot/issues/503#issuecomment-5476129472, issue confirmed OPEN via gh issue view 503"
        status: pass
    human_judgment: false
  - id: D4
    description: "The fallback, no-cache, and telemetry work from plans 01-03 and 01-04 still ships regardless of this plan's verdict, and npm run test:unit / npm run build remain green"
    requirement: STAB-02
    verification:
      - kind: unit
        ref: "npm run test:unit -- 190 test files, 2003 tests, all passed"
        status: pass
      - kind: other
        ref: "npm run build -- completed with no 'Failed to compile', /opengraph-image present in the route table"
        status: pass
    human_judgment: false

duration: 10min
completed: 2026-08-31
status: complete
---

# Phase 1 Plan 5: OG Sharp Rejection Reproduction Attempt Summary

**Built and booted the app image from local source against a real 159-season seeded database on the same linux/arm64 architecture as staging, drove three distinct map states through the real Satori/sharp pipeline, reproduced nothing, ruled out two of three standing hypotheses by inspection, and posted the findings to #503 while leaving it open.**

## Performance

- **Duration:** 10 min
- **Started:** 2026-08-31T08:53:17Z (approx, immediately following 01-04's completion commit)
- **Completed:** 2026-08-31T09:03:18Z
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments
- Built `og-repro-app:local` from `Dockerfile.app` and `og-repro-migrate:local` from `Dockerfile.migrate` directly from the current working tree (commit `87f064aa`), producing a genuine `linux/arm64` standalone image — the same architecture the staging Raspberry Pi Swarm target runs, not an amd64 approximation
- Ran the migrate container against a fresh `postgres:17-alpine` container on a private Docker network, seeding the full committed 159-season historic dataset (`h1_season`/`h1_status`/`h1_event`/etc.), then booted the app container with `WORKER_ENABLED=false` so the poller never claimed the lease during the investigation
- Ruled out two of the three standing #503 hypotheses by direct image inspection: the `@img/sharp-linux-arm64` native binary is present and matches the runtime's architecture, and `opengraph-image.jsx`'s `ImageResponse` call passes no `fonts` option — Satori draws with its bundled default font, so this route has no filesystem font-file dependency to fail on (unlike `layout.jsx`'s unrelated `Space_Mono` issue, D-17/#476)
- Drove three distinct real map states through the actual `getCampaign()` → `computeLiveMapState()` → `buildMapSvg()` → `ImageResponse` → sharp pipeline by bumping each target season's `h1_season.last_updated` to be the newest (since `getCampaign(null)` always reads the max-`last_updated` season and the route exposes no season query param): the baseline in-progress season 159, an all-three-factions-DEFEATED victory state (season 2), and a long-completed zero-active-events historical season (season 100). All three returned `200 OK` with a real rendered 1200×630 PNG and `Cache-Control: public, s-maxage=300, stale-while-revalidate=60` — none fell back, none rejected
- Recorded the full attempt — environment, build/run commands (names only for credentials), hypothesis dispositions, request/response table, and verdict — in `.planning/phases/01-stability-fixes-release/01-OG-SHARP-REPRO.md`, then posted it verbatim as a comment on GitHub issue #503, leaving the issue open per D-10
- Re-ran `npm run test:unit` (190 files, 2003 tests, all pass) and `npm run build` (clean, `/opengraph-image` present in the route table) to confirm the investigation left the working tree in a shippable state

## Task Commits

Each task was committed atomically:

1. **Task 1: Reproduce the rejection against the standalone image** - `278b295b` (docs)
2. **Task 2: Fix the identified cause, or close out the investigation on #503** - `854f354d` (docs)

**Plan metadata:** (this commit)

## Files Created/Modified
- `.planning/phases/01-stability-fixes-release/01-OG-SHARP-REPRO.md` - Reproduction attempt record: environment, hypothesis dispositions, three-map-state request/response table, `Verdict: NOT REPRODUCED`, and `## Resolution` section naming the GitHub comment and the still-open hypothesis for a future attempt

## Decisions Made
- Bounded the investigation to the plan's explicit three-way stop condition (rejection reproduces / three distinct states tested without reproducing / image can't build or boot) — stopped at three states rather than continuing to hunt for a fourth
- Used manual `docker build`/`docker run` instead of `docker compose -f docker-compose.ci.yml up` because the compose file doesn't expose `WORKER_ENABLED` as an overridable variable and the plan explicitly required the poller disabled during investigation
- Selected map-state shapes by manipulating `h1_season.last_updated` in the seeded database rather than adding a season query param to the route — keeps the investigation read-only against route code (`src/` stayed untouched throughout) while still exercising the real pipeline, not a mock
- Flagged the homeworld-only/active-attack-event shape as the still-open hypothesis rather than force-testing it, since no season in the seeded historical dataset carries an `ACTIVE` event by construction — manufacturing one would have meant writing directly to the DB in a shape no real ingest path produces, a lower-confidence signal than the three naturally-occurring states already tested

## Deviations from Plan

None - plan executed exactly as written. The two tasks completed within the declared time-box; the verdict (NOT REPRODUCED) is itself the plan's designed valid negative outcome, not a deviation.

## Issues Encountered

None. The Docker build, migrate/seed, and app boot all succeeded on the first attempt; all three map-state requests returned clean 200s with no error logs beyond the expected benign `[umami] sendUmamiEvent failed: fetch failed` lines (UMAMI_SITE_ID was intentionally unset for this throwaway run).

## User Setup Required

None - no external service configuration required. All containers, images, and the Docker network created for this investigation were torn down (`docker rm -f`, `docker network rm`, `docker rmi`) before this summary was written.

## Next Phase Readiness
- STAB-02's success criteria are met independently of this plan's verdict: the fallback (01-03), telemetry (01-04), and this bounded reproduction attempt (01-05) together close out the plan-level requirement; #503 stays open with actionable findings rather than closing prematurely
- The homeworld-only/active-attack-event map state is the one named next step if #503 is revisited — watch the `api-og-fallback` Umami event's `stage: 'rasterisation'` data field (shipped in 01-04) for a real-world correlation with an active homeworld attack event before spending further investigation time
- No blockers identified for the remaining phase 01 plans

---
*Phase: 01-stability-fixes-release*
*Completed: 2026-08-31*

## Self-Check: PASSED

- FOUND: .planning/phases/01-stability-fixes-release/01-OG-SHARP-REPRO.md
- FOUND commit: 278b295b
- FOUND commit: 854f354d
