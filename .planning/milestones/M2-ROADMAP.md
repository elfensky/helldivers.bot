# Milestone M2: The rebuilt dashboard works on every screen

**Status:** ✅ SHIPPED 2026-04-08
**Phases:** 0.5–0.8
**Versions:** 0.10.0–0.29.2 (2026-03-26 to 2026-04-08); 19 release tags, the last v0.24.1

## Overview

**Milestone goal:** The relaunched site makes the live war dashboard its homepage and works on phone, tablet and desktop, with notifications and accounts.

This milestone predates the GSD plan, which started on 2026-08-29. It was recorded on 2026-11-09 from CHANGELOG.md and
GitHub milestones "Phase 1" to "Phase 8", so it has no plan, summary or requirements files.

## Phases

- [x] **Phase 0.5: Relaunch** - The homepage becomes the live war dashboard, on a rewritten schema with seeded seasons, an API-key gate and war outcomes (0.10.0–0.14.0; GitHub Phases 1–4) (completed 2026-03-27)
- [x] **Phase 0.6: Responsive redesign** - Design tokens and a mobile-first layout scale the dashboard to tablet and desktop (0.15.0–0.22.3; GitHub Phases 5–7; #167, #168, #186) (completed 2026-04-04)
- [x] **Phase 0.7: Live updates and notifications** - Toasts, web push and the PWA ship; live data arrives by SSE in 0.24.0 and by 10 s polling from 0.27.0 (GitHub Phase 8; #24, #41, #229) (completed 2026-04-08)
- [x] **Phase 0.8: Accounts** - Players sign in through BetterAuth and get a profile page, and admins get a panel (0.25.0–0.26.0; #198, #248) (completed 2026-04-08)

---

## Milestone Summary

**Source:** CHANGELOG.md, versions 0.10.0–0.29.2; GitHub milestones "Phase 1" to "Phase 8".

**Notes:** GitHub milestone "Phase 8: WebSocket Real-Time" shipped as SSE, not WebSocket, and 0.27.0 replaced SSE with polling. The snapshot tables of 0.10.0 gave way to the normalized schema of M3 in 0.41.0.

---

_For current project status, see .planning/ROADMAP.md_
