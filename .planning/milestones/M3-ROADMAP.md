# Milestone M3: The archive holds every season in five tables

**Status:** ✅ SHIPPED 2026-06-21
**Phases:** 0.9–0.12
**Versions:** 0.30.0–0.52.9 (2026-04-08 to 2026-06-21); 12 release tags, the last v0.52.6

## Overview

**Milestone goal:** Every season sits in a normalized five-table schema with bucket upserts, and the archives and the new /stats page read it.

This milestone predates the GSD plan, which started on 2026-08-29. It was recorded on 2026-11-09 from CHANGELOG.md
(no GitHub milestone), so it has no plan, summary or requirements files.

## Phases

- [x] **Phase 0.9: Archives redesign** - The archives show each season with per-faction analytics, closest calls and a unified event log (0.30.0–0.40.7; #279) (completed 2026-04-15)
- [x] **Phase 0.10: Normalized schema** - Ten tables become the five `h1_*` tables, and polls upsert into time buckets (0.41.0–0.41.1) (completed 2026-04-16)
- [x] **Phase 0.11: Hardening** - The image moves to Chainguard, the stale-version reload ships, and ESLint with strict checkJs gates the code (0.42.0–0.47.17) (completed 2026-05-22)
- [x] **Phase 0.12: Cross-season stats** - `/stats` compares every season, the Ministry of Truth effect runs sitewide, and cascades are tracked (0.48.0–0.52.9; #394, #272) (completed 2026-06-21)

---

## Milestone Summary

**Source:** CHANGELOG.md, versions 0.30.0–0.52.9; no GitHub milestone.

**Notes:** This milestone's schema is the one in use today (AGENTS.md § Architecture invariants).

---

_For current project status, see .planning/ROADMAP.md_
