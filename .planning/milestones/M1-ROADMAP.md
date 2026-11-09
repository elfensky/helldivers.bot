# Milestone M1: The first site caches the war and draws the map

**Status:** ✅ SHIPPED 2025-12-09
**Phases:** 0.1–0.4
**Versions:** 0.1.0–0.8.0 (2025-05-10 to 2025-12-09); 24 release tags, the last v0.8.0

## Overview

**Milestone goal:** The first site caches the Helldivers 1 API in Postgres, serves it again in the game's format, and shows the map, stats and timeline.

This milestone predates the GSD plan, which started on 2026-08-29. It was recorded on 2026-11-09 from CHANGELOG.md and
GitHub milestone "Phase 0: Initial Release", so it has no plan, summary or requirements files.

## Phases

- [x] **Phase 0.1: Base app** - Next.js and Prisma run from a Docker image, with sign-in and an API-key dashboard (0.1.0–0.3.3) (completed 2025-05-19)
- [x] **Phase 0.2: Rebroadcast API** - `POST /api/h1/rebroadcast` serves `get_campaign_status` and `get_snapshots` in the game's format, with Swagger docs (0.4.0–0.4.1) (completed 2025-05-20)
- [x] **Phase 0.3: Map, stats and timeline** - A worker polls the HD1 API every 20 seconds, and players see the galaxy map, the stats and the war timeline (0.4.2–0.7.3) (completed 2025-06-24)
- [x] **Phase 0.4: Landing page** - The layout and the navigation are rebuilt around a real landing page (0.7.4–0.8.0) (completed 2025-12-09)

---

## Milestone Summary

**Source:** CHANGELOG.md, versions 0.1.0–0.8.0; GitHub milestone "Phase 0: Initial Release".

---

_For current project status, see .planning/ROADMAP.md_
