# Milestones

## M7 Production is stable on the Hetzner swarm (Shipped: 2026-10-25)

**Delivered:** production on the Hetzner swarm, released as v0.96.4; the stability release v0.95.2.

**Phases completed:** 2 phases, 9 plans, 22 tasks

**Key accomplishments:**
- Both `getWarOutcome` victory-signal `.every` checks now optional-chain faction-slot access instead of dereferencing bare, closing the STAB-05 crash; `buildPlayerBeats`' pre-existing zero-baseline and single-sample guards are now pinned by dedicated regression tests.
- Playwright timezone-sweep + per-variant disposition doc prove STAB-01's date/timezone hydration mismatches on `/` are already fixed on `develop`; a validated Server-vs-Client-Component canary confirmed the harness itself works; the sweep's one real finding (`UserSection.jsx`'s auth-session hydration race) is a different bug class, filed as issue #526.
- Replaced the OG route's Satori-rendered crash fallback with a committed static PNG served as raw bytes, split Cache-Control by render outcome, and fixed a next.config.mjs header rule that was silently overriding both — a real "frozen fallback" bug caught only by testing against a production standalone build.
- One outcome-labelled Umami event per real /opengraph-image invocation, a getCampaign() failure-mode audit that splits query failures (reported) from legitimately empty seasons (silent), and a genuine null-faction-slot crash found and fixed while pinning three previously-untested map-state shapes against the real route.
- Built and booted the app image from local source against a real 159-season seeded database on the same linux/arm64 architecture as staging, drove three distinct map states through the real Satori/sharp pipeline, reproduced nothing, ruled out two of three standing hypotheses by inspection, and posted the findings to #503 while leaving it open.
- Added a fifth `'error'` state to `NotificationToggle`'s state machine reached via a `Promise.race` against a 5s timer plus rejection handling, gave it a working Retry that re-runs a single extracted `init()`, made `subscribeToPush()` return a discriminated `{error}` result so a missing VAPID key surfaces instead of faking success, and confirmed by a real `docker build` that the VAPID public key is currently ABSENT from the release image.
- Space Mono is now fetched through `next/font/google` and `--font-mono` resolves through the generated `var(--font-space-mono)` in both `layout.css` declarations, proven via real dev-server before/after measurements (not the project's visual-regression harness, which turned out to be structurally blind to `next/font`) and posted to #476.
- GlitchTip re-count on release 0.95.2 shows all three classes (#496 hydration, #503 OG sharp rejection, #485 notification toggle) still firing, so all three issues stay open with numbers attached and three residual classes became issues #565, #566, #567.

**Archive:** [roadmap](milestones/M7-ROADMAP.md), [requirements](milestones/M7-REQUIREMENTS.md), [phase evidence](milestones/M7-phases/).

---

## M6 The dashboard predicts the next events (Shipped: 2026-08-13)

**Delivered:** The dashboard forecasts the next wave, the assault timing and the counterattack clock, and the develop backlog ships as v0.90.4.

**Phases completed:** 0.17–0.18 (2 phases, recorded after the fact; no plans)

**Key accomplishments:**
- Event predictions: The next-wave card, the assault ETA, the counterattack clock and published verdicts, with `/docs/predict` (0.68.0–0.88.3; #472, #482, #483)
- Release and CI: Visual regression tests, sourcemap upload, the browser-floor lint, CI hardening and the AGPL licence (0.89.0–0.91.1)

**Archive:** [roadmap](milestones/M6-ROADMAP.md).

---

## M5 The archives tell each season's story (Shipped: 2026-07-27)

**Delivered:** The archives and `/stats` explain each season through combat telemetry, engagement, a written war narrative and faction markers.

**Phases completed:** 0.15–0.16 (2 phases, recorded after the fact; no plans)

**Key accomplishments:**
- Season stories: Combat telemetry on `/stats`, the Player Engagement chart and the War Narrative on `/archives`, and faction markers (0.59.1–0.64.1; #178, #275, #274, #157)
- Test rigour: Mutation testing finds four bugs that no test caught, and the v1 handlers get their own tests (0.65.0–0.67.6)

**Archive:** [roadmap](milestones/M5-ROADMAP.md).

---

## M4 Developers can use a public API (Shipped: 2026-06-23)

**Delivered:** Developers query versioned `/api/v1/h1` endpoints with API keys, rate limits and an OpenAPI document, released to `main` as v0.59.0.

**Phases completed:** 0.13–0.14 (2 phases, recorded after the fact; no plans)

**Key accomplishments:**
- Versioned endpoints: A config module and the `/api/v1/h1` status, stats, season and map endpoints (0.53.0–0.56.0; #29, #30, #31, #33)
- Limits and docs: ETags, a Postgres rate limiter and the OpenAPI spec for the v1 endpoints (0.57.0–0.59.0; #435, #436, #438)

**Archive:** [roadmap](milestones/M4-ROADMAP.md).

---

## M3 The archive holds every season in five tables (Shipped: 2026-06-21)

**Delivered:** Every season sits in a normalized five-table schema with bucket upserts, and the archives and the new /stats page read it.

**Phases completed:** 0.9–0.12 (4 phases, recorded after the fact; no plans)

**Key accomplishments:**
- Archives redesign: The archives show each season with per-faction analytics, closest calls and a unified event log (0.30.0–0.40.7; #279)
- Normalized schema: Ten tables become the five `h1_*` tables, and polls upsert into time buckets (0.41.0–0.41.1)
- Hardening: The image moves to Chainguard, the stale-version reload ships, and ESLint with strict checkJs gates the code (0.42.0–0.47.17)
- Cross-season stats: `/stats` compares every season, the Ministry of Truth effect runs sitewide, and cascades are tracked (0.48.0–0.52.9; #394, #272)

**Archive:** [roadmap](milestones/M3-ROADMAP.md).

---

## M2 The rebuilt dashboard works on every screen (Shipped: 2026-04-08)

**Delivered:** The relaunched site makes the live war dashboard its homepage and works on phone, tablet and desktop, with notifications and accounts.

**Phases completed:** 0.5–0.8 (4 phases, recorded after the fact; no plans)

**Key accomplishments:**
- Relaunch: The homepage becomes the live war dashboard, on a rewritten schema with seeded seasons, an API-key gate and war outcomes (0.10.0–0.14.0; GitHub Phases 1–4)
- Responsive redesign: Design tokens and a mobile-first layout scale the dashboard to tablet and desktop (0.15.0–0.22.3; GitHub Phases 5–7; #167, #168, #186)
- Live updates and notifications: Toasts, web push and the PWA ship; live data arrives by SSE in 0.24.0 and by 10 s polling from 0.27.0 (GitHub Phase 8; #24, #41, #229)
- Accounts: Players sign in through BetterAuth and get a profile page, and admins get a panel (0.25.0–0.26.0; #198, #248)

**Archive:** [roadmap](milestones/M2-ROADMAP.md).

---

## M1 The first site caches the war and draws the map (Shipped: 2025-12-09)

**Delivered:** The first site caches the Helldivers 1 API in Postgres, serves it again in the game's format, and shows the map, stats and timeline.

**Phases completed:** 0.1–0.4 (4 phases, recorded after the fact; no plans)

**Key accomplishments:**
- Base app: Next.js and Prisma run from a Docker image, with sign-in and an API-key dashboard (0.1.0–0.3.3)
- Rebroadcast API: `POST /api/h1/rebroadcast` serves `get_campaign_status` and `get_snapshots` in the game's format, with Swagger docs (0.4.0–0.4.1)
- Map, stats and timeline: A worker polls the HD1 API every 20 seconds, and players see the galaxy map, the stats and the war timeline (0.4.2–0.7.3)
- Landing page: The layout and the navigation are rebuilt around a real landing page (0.7.4–0.8.0)

**Archive:** [roadmap](milestones/M1-ROADMAP.md).

---
