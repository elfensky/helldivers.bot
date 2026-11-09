# Roadmap: helldivers.bot

## Milestones

- ✅ **M1 The first site caches the war and draws the map** — Phases 0.1–0.4 (shipped 2025-12-09)
- ✅ **M2 The rebuilt dashboard works on every screen** — Phases 0.5–0.8 (shipped 2026-04-08)
- ✅ **M3 The archive holds every season in five tables** — Phases 0.9–0.12 (shipped 2026-06-21)
- ✅ **M4 Developers can use a public API** — Phases 0.13–0.14 (shipped 2026-06-23)
- ✅ **M5 The archives tell each season's story** — Phases 0.15–0.16 (shipped 2026-07-27)
- ✅ **M6 The dashboard predicts the next events** — Phases 0.17–0.18 (shipped 2026-08-13)
- ✅ **M7 Production is stable on the Hetzner swarm** — Phases 1–1.1 (shipped 2026-10-25)
- 🚧 **M8 The site is documented, tested and findable** — Phases 2–6 (in progress)
- 📋 **M9 Players can build and share loadouts** — Phases 7–9 (planned)
- 📋 **M10 Players can explore season analytics** — Phases 10–12 (planned)
- 📋 **M11 The site is accessible and polished** — Phases 13–15 (planned)
- 📋 **M12 Staging runs on the Pi and live updates are decided** — Phases 16–18 (planned)

## Overview

Every open GitHub issue reaches a terminal state: fixed and released, shipped as a feature, or closed with a written decision.

The plan holds the project's history and its future as twelve milestones (decided 2026-11-09). M1–M7 record what shipped, from 0.1.0 (May 2025) to v0.96.4 (October 2026). M1–M6 predate the GSD plan and were recorded from CHANGELOG.md and the closed GitHub milestones; `milestone complete` archived M7. M8 is current: accurate docs, co-located tests and unattended dependency updates come first, then SEO and analytics, before any feature track. M9 to M12 follow in order: the Loadout Builder, Archive Analytics, accessibility and polish, then staging on the Pi swarm, the spike-gated SSE decision and a closing documentation pass. Each milestone from M8 on ends in a release to `main`. Every phase is a releasable vertical slice: a bug class eliminated and verified in production, a feature a player can use end to end, or a written terminal decision on an issue.

## Phases

**Phase Numbering:**

- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

Phases 0.1–0.18 belong to the shipped milestones M1–M6. They were recorded after the fact and predate the GSD plan.

<details>
<summary>✅ M1 · The first site caches the war and draws the map (Phases 0.1–0.4) — SHIPPED 2025-12-09</summary>

Versions 0.1.0–0.8.0 (2025-05-10 to 2025-12-09); 24 release tags, the last v0.8.0; recorded from CHANGELOG.md and GitHub milestone "Phase 0: Initial Release", before the GSD plan.

- Phase 0.1 — Base app, completed 2025-05-19
- Phase 0.2 — Rebroadcast API, completed 2025-05-20
- Phase 0.3 — Map, stats and timeline, completed 2025-06-24
- Phase 0.4 — Landing page, completed 2025-12-09

[Archived roadmap](milestones/M1-ROADMAP.md)

</details>

<details>
<summary>✅ M2 · The rebuilt dashboard works on every screen (Phases 0.5–0.8) — SHIPPED 2026-04-08</summary>

Versions 0.10.0–0.29.2 (2026-03-26 to 2026-04-08); 19 release tags, the last v0.24.1; recorded from CHANGELOG.md and GitHub milestones "Phase 1" to "Phase 8", before the GSD plan.

- Phase 0.5 — Relaunch, completed 2026-03-27
- Phase 0.6 — Responsive redesign, completed 2026-04-04
- Phase 0.7 — Live updates and notifications, completed 2026-04-08
- Phase 0.8 — Accounts, completed 2026-04-08

[Archived roadmap](milestones/M2-ROADMAP.md)

</details>

<details>
<summary>✅ M3 · The archive holds every season in five tables (Phases 0.9–0.12) — SHIPPED 2026-06-21</summary>

Versions 0.30.0–0.52.9 (2026-04-08 to 2026-06-21); 12 release tags, the last v0.52.6; recorded from CHANGELOG.md (no GitHub milestone), before the GSD plan.

- Phase 0.9 — Archives redesign, completed 2026-04-15
- Phase 0.10 — Normalized schema, completed 2026-04-16
- Phase 0.11 — Hardening, completed 2026-05-22
- Phase 0.12 — Cross-season stats, completed 2026-06-21

[Archived roadmap](milestones/M3-ROADMAP.md)

</details>

<details>
<summary>✅ M4 · Developers can use a public API (Phases 0.13–0.14) — SHIPPED 2026-06-23</summary>

Versions 0.53.0–0.59.0 (2026-06-21 to 2026-06-23); 1 release tag, v0.59.0; recorded from CHANGELOG.md and GitHub milestone "Public API & Config", before the GSD plan.

- Phase 0.13 — Versioned endpoints, completed 2026-06-21
- Phase 0.14 — Limits and docs, completed 2026-06-23

[Archived roadmap](milestones/M4-ROADMAP.md)

</details>

<details>
<summary>✅ M5 · The archives tell each season's story (Phases 0.15–0.16) — SHIPPED 2026-07-27</summary>

Versions 0.59.1–0.67.6 (2026-06-24 to 2026-07-27); 5 release tags, the last v0.67.1; recorded from CHANGELOG.md (no GitHub milestone), before the GSD plan.

- Phase 0.15 — Season stories, completed 2026-06-29
- Phase 0.16 — Test rigour, completed 2026-07-27

[Archived roadmap](milestones/M5-ROADMAP.md)

</details>

<details>
<summary>✅ M6 · The dashboard predicts the next events (Phases 0.17–0.18) — SHIPPED 2026-08-13</summary>

Versions 0.68.0–0.91.1 (2026-07-27 to 2026-08-13); 3 release tags, the last v0.90.14; recorded from CHANGELOG.md (no GitHub milestone), before the GSD plan.

- Phase 0.17 — Event predictions, completed 2026-08-04
- Phase 0.18 — Release and CI, completed 2026-08-13

[Archived roadmap](milestones/M6-ROADMAP.md)

</details>

<details>
<summary>✅ M7 · Production is stable on the Hetzner swarm (Phases 1–1.1) — SHIPPED 2026-10-25</summary>

Versions 0.92.0–0.96.4. Phase 1 fixed or tracked the five known production bug classes and released v0.95.2.
Phase 1.1 moved production to the Hetzner swarm and released v0.96.4.

- Phase 1 — Stability Fixes & Release (9/9 plans), completed 2026-10-21
- Phase 1.1 — Production on the Hetzner Swarm (inserted, no plans), completed 2026-10-25

[Archived roadmap](milestones/M7-ROADMAP.md) · [requirements](milestones/M7-REQUIREMENTS.md) · [phase evidence](milestones/M7-phases/)

</details>

## 🚧 M8 · The site is documented, tested and findable (in progress)

**Milestone goal:** The docs match the code, tests sit beside their modules, dependency updates merge themselves, and search and analytics are wired in. The five decided Icebox issues close with written reasons, and the milestone ends in a release to `main`.

- [ ] **Phase 2: Docs Accuracy & Operational Housekeeping** - AGENTS.md and `/docs` describe the lease model as it actually works, and outstanding operational verification chores close out
- [ ] **Phase 3: Test Co-location** - Unit tests move next to their modules before any later phase adds more tests
- [ ] **Phase 4: Dependency Cleanup & Auto-merge Automation** - The Dependabot backlog clears and minor/patch updates merge unattended thereafter
- [ ] **Phase 5: SEO & Analytics Foundation** - The site is structurally primed to rank for Helldivers 1 search queries and every interaction is tracked in Umami, before any feature page can drift from the convention
- [ ] **Phase 6: Icebox Quick Closures** - The five already-decided Icebox issues close with written reasons

### Phase 2: Docs Accuracy & Operational Housekeeping

**Goal**: Documentation matches deployed reality and the small outstanding operational verification chores close out
**Mode:** mvp
**Depends on**: Phase 1 (HOUSE-03 needs a release to prove symbolication; DOCS-01/02 describe the current, already-shipped lease model)
**Requirements**: DOCS-01, DOCS-02, HOUSE-03, HOUSE-04, HOUSE-05
**Success Criteria** (what must be TRUE):

  1. AGENTS.md § Architecture invariants describes the lease/`worker_heartbeat` model, `WORKER_ENABLED`, and the multi-replica web tier, with poller state in the lease row, not module memory (DOCS-01)
  2. Each public `/docs` page (architecture, data-flow, infrastructure, database, testing) matches the code when checked page-by-page against `.planning/codebase/` (DOCS-02)
  3. Sourcemaps are uploaded at build time and stripped from the shipped image once GlitchTip symbolication is proven on at least one release, verified by image size and a symbolicated production stack trace (HOUSE-03)
  4. The seed-refresh workflow's PR path is verified end-to-end (a real season transition, or a controlled simulation), with the run recorded on #501 (HOUSE-04)
  5. `docs/roadmap.md` is deleted and its live items are carried into `.planning/` (ARCH-11 and § Carried over), leaving `.planning/ROADMAP.md` as the one roadmap file (HOUSE-05, done 2026-11-02)

**Plans**: 1/12 plans executed

Plans:
**Wave 1**

- [ ] 02-01-PLAN.md — Release develop 0.95.7 to main (tag, release build with sourcemap upload, merge-back; production pull handed to Andrei) (HOUSE-03 input, D-21)

**Wave 2** *(blocked on Wave 1 completion)*

- [ ] 02-02-PLAN.md — DOCS-01: AGENTS.md lease model, #516-era code comments, codebase maps (DOCS-01)

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 02-03-PLAN.md — #469 as ARCH-11 in Phase 11, then `docs/roadmap.md` retired: deleted, not a pointer (HOUSE-05, done 2026-11-02, see 02-03-SUMMARY.md)

**Wave 4** *(blocked on Wave 3 completion)*

- [ ] 02-04-PLAN.md — #501 closed on the season-160 run; seed-refresh gaps, WR-07 and WR-08 filed as issues (HOUSE-04)
- [ ] 02-05-PLAN.md — Rendered-diagram pages (architecture, overview, notifications) with a browser render check (DOCS-02)

**Wave 5** *(blocked on Wave 4 completion)*

- [ ] 02-06-PLAN.md — Mermaid fence parse check script and the data-flow page (DOCS-02)

**Wave 6** *(blocked on Wave 5 completion)*

- [ ] 02-07-PLAN.md — Database and testing pages (DOCS-02)

**Wave 7** *(blocked on Wave 6 completion)*

- [ ] 02-08-PLAN.md — Infrastructure page: topology, images, workflows, init flow, env table (DOCS-02)
- [ ] 02-09-PLAN.md — Production pull of 0.95.7 (Task 1 precondition), Sentry-11 symbolication proof on a 0.95.7 production event, #502 gate record (HOUSE-03, D-24)

**Wave 8** *(blocked on Wave 7 completion)*

- [ ] 02-10-PLAN.md — Sourcemap strip in next.config.mjs, documented Sentry block, D-15 check 1 on the staging image (HOUSE-03)

**Wave 9** *(blocked on Wave 8 completion)*

- [ ] 02-11-PLAN.md — Phase-end release (tag, release build with upload lines, merge-back, production pull) (HOUSE-03, DOCS-02)

**Wave 10** *(blocked on Wave 9 completion)*

- [ ] 02-12-PLAN.md — D-15 checks 2 and 3 in production, #502 closed, `.claude/CLAUDE.md` regenerated (HOUSE-03, DOCS-01)

### Phase 3: Test Co-location

**Goal**: Unit tests live next to the modules they test, so every later phase that adds tests lands on the new convention instead of the old one
**Mode:** mvp
**Depends on**: Nothing (parallelizable with Phase 2 and Phase 4; must complete before Phase 5, 7, 8, 9, 10, 11, 12, 13, 15, 17)
**Requirements**: HOUSE-01
**Success Criteria** (what must be TRUE):

  1. Every unit test file sits at `*.test.*` beside the module it covers; `src/__tests__/` retains only `_meta`, contract, and integration tests
  2. A co-location guard replaces `mirrorTree.test.mjs` and fails CI when a test is misplaced
  3. `.dockerignore`, `output: 'standalone'`, and `pageExtensions` are verified to still exclude test files from the production image
  4. AGENTS.md's test-placement rule describes the co-located convention, not the mirrored tree

**Plans**: TBD

### Phase 4: Dependency Cleanup & Auto-merge Automation

**Goal**: The Dependabot backlog clears, and minor/patch updates merge unattended thereafter while majors still require a human — without breaking the repo's no-squash/no-rebase rule
**Mode:** mvp
**Depends on**: Nothing (parallelizable with Phase 3; CI/config only)
**Requirements**: DEPS-01, DEPS-02, DEPS-03, DEPS-04, DEPS-05, DEPS-06
**Success Criteria** (what must be TRUE):

  1. `npm audit --audit-level=moderate` reports only the known Prisma-chain `deepmerge-ts` advisory, with all 7 originally-open Dependabot alerts (`nanoid`, `mermaid` ×5, `dompurify`) cleared via non-breaking bumps (DEPS-01)
  2. Each of the 5 open Dependabot PRs is resolved — #515 and #504 merged green, #511 and #510 explicitly accepted or closed with reason, #514 merged (DEPS-02)
  3. `allow_auto_merge` is on and the squash/rebase merge buttons are disabled repo-wide, so only merge commits are possible on any PR (DEPS-03)
  4. A branch ruleset on `develop` requires the named CI status checks and does not require linear history (DEPS-04)
  5. A real Dependabot minor/patch PR is observed merging unattended via `gh pr merge --auto --merge` classified by `dependabot/fetch-metadata`, while a major bump is left for manual review (DEPS-05)
  6. AGENTS.md § This repo's own rules states the Dependabot exemption (no version bump/CHANGELOG move on those merges — folded in at the next real release), and `check-version.yml` does not block Dependabot PRs (DEPS-06)

**Plans**: TBD

### Phase 5: SEO & Analytics Foundation

**Goal**: The site is structurally primed to rank highly for Helldivers 1 queries (galactic war status/map/stats/api/loadout, war archive) and every interactive element and public API route is tracked in Umami — locked in before any later feature page can drift from the convention
**Mode:** mvp
**Depends on**: Phase 1 (STAB-02 hardens the `/opengraph-image` fallback that per-page OG metadata relies on), Phase 3 (adds tests)
**Requirements**: SEO-01, SEO-02, SEO-03, SEO-04, SEO-05, SEO-06, SEO-07, SEO-08, SEO-09, SEO-10, HOUSE-02
**Success Criteria** (what must be TRUE):

  1. `/llms.txt`, `sitemap.js`, and `robots.js` are registry-driven off one source of public routes — covering every `/docs/**` page, `/stats`, `/legal`, per-season `/archives` URLs, and `/loadout` once it ships — with truthful `lastModified`, AI crawlers explicitly allowed, private routes disallowed, and `/robots.txt`/`/sitemap.xml` in the uptime monitor; a test fails when a public page is missing from the registry (SEO-01, SEO-02, SEO-03)
  2. Every public page has a unique title/description/canonical/OpenGraph/Twitter via `createPageMetadata()`, private pages carry `robots: noindex`, and typed JSON-LD (WebSite, WebApplication, VideoGame, BreadcrumbList, FAQPage, Dataset, Event) passes the Rich Results Test and schema.org validator on production — the same Rich Results/Schema.org/Search-Console/SERP checks HOUSE-02 tracked, now closed out here (SEO-04, SEO-05, HOUSE-02)
  3. Each target query (e.g. "helldivers 1 galactic war status/map/stats/api/loadout", "helldivers war archive") maps to one owning page with server-rendered H1 + intro copy addressing it; archive seasons are indexable at unique per-season URLs with per-season titles, and docs pages carry descriptive titles instead of generic ones (SEO-06)
  4. Google Search Console is wired in — verification token in metadata, sitemap submitted, an agent-accessible path to pull performance/coverage — with a recurring review that files findings as GitHub issues and ships this milestone's first round of fixes; Lighthouse SEO ≥ 95 and Performance/Accessibility ≥ 90 hold on `/`, `/archives`, `/docs` in production, and Core Web Vitals pass in GSC (SEO-07, SEO-08)
  5. Umami tracks a real event end-to-end in production and staging via the `/stats.js` → `/api/send` → `/api/umami` proxy, `identify()` fires on login, `umamiTrackEvent` runs via `after()` on every public API route (`/api/v1/**`, `/api/h1/campaign`, `/api/h1/rebroadcast`), and every interactive element's `data-umami-event`/`useTrack` coverage is enforced by a lint rule or test (SEO-09, SEO-10)

**Plans**: TBD
**UI hint**: no

### Phase 6: Icebox Quick Closures

**Goal**: The five already-decided Icebox issues reach a terminal, written state
**Mode:** mvp
**Depends on**: Nothing
**Requirements**: ICE-01, ICE-02, ICE-03, ICE-04, ICE-05
**Success Criteria** (what must be TRUE):

  1. #139 (Discord bot), #140 (SwiftUI app), #28 (reviews system), and #141 (helmet avatar) are each closed on GitHub with a written reason (ICE-01, ICE-02, ICE-03, ICE-04)
  2. #189 (CrowdSec verification) is closed with the existing reason plus a written reopen trigger tied to any reverse-proxy change (ICE-05)

**Plans**: TBD

## 📋 M9 · Players can build and share loadouts (planned)

**Milestone goal:** A player builds a loadout, sees its stats and shares it as a link with its own preview image, up to a full four-player squad. The URL format is fixed first, because shared links cannot be migrated. The milestone ends in a release to `main`.

- [ ] **Phase 7: Loadout Foundation (Catalogs + Codec)** - Item catalogs and the versioned shareable-URL hash format lock before any UI encodes against them
- [ ] **Phase 8: Loadout Builder Core** - A player can build a loadout, see its stats, and share a link with a custom preview image
- [ ] **Phase 9: Loadout Enhancements & Squad Mode** - Guides, favorites, account sync, accessibility, and a 4-player shareable squad loadout

### Phase 7: Loadout Foundation (Catalogs + Codec)

**Goal**: The static item data and the shareable-URL hash format — this milestone's one true one-way door — are locked before any UI is built against them
**Mode:** mvp
**Depends on**: Phase 3 (adds tests)
**Requirements**: LOAD-01, LOAD-02, LOAD-03
**Success Criteria** (what must be TRUE):

  1. Static JSON catalogs for stratagems, weapons, and perks exist with string IDs (never indices), stats fields, and stratagem input codes, schema-validated by a test (LOAD-01)
  2. Loadout-specific design tokens are added to the `layout.css` `@theme` block (LOAD-02)
  3. A versioned URL codec (version marker + bit-packed base64url, no new deps) round-trips solo, partial, and 4-player-squad loadouts through golden-fixture tests; the solo hash stays short; hash-vs-query placement is decided against OG/SSR reachability before anything encodes against it (LOAD-03)

**Plans**: TBD
**UI hint**: yes

### Phase 8: Loadout Builder Core

**Goal**: A player can build a loadout, see its stats, and share a link that renders a custom preview image
**Mode:** mvp
**Depends on**: Phase 7, Phase 1 (LOAD-10's OG image reuses the STAB-02 fallback pattern)
**Requirements**: LOAD-04, LOAD-05, LOAD-09, LOAD-10
**Success Criteria** (what must be TRUE):

  1. A player can open `/loadout`, pick items in editor mode (mobile-first), and open a shared link in read-only mode where "Edit copy" never mutates the shared link (LOAD-04)
  2. Selected items show a compact stats display in the builder (LOAD-05)
  3. `/loadout` appears in site navigation with Umami click tracking (LOAD-09)
  4. Sharing a loadout link produces a per-loadout OG image rendering the selected items, built with the STAB-02 fallback pattern from day one (LOAD-10)

**Plans**: TBD
**Note**: `/loadout` registers in the sitemap/llms.txt/metadata registry per the SEO-02/04 convention established in Phase 5.
**UI hint**: yes

### Phase 9: Loadout Enhancements & Squad Mode

**Goal**: Players can save loadouts across visits or devices, follow curated guides, use the builder accessibly, and share a full 4-player squad loadout as one link
**Mode:** mvp
**Depends on**: Phase 8
**Requirements**: LOAD-06, LOAD-07, LOAD-08, LOAD-11, LOAD-12
**Success Criteria** (what must be TRUE):

  1. Curated per-faction guide pages link to pre-built loadouts (LOAD-06)
  2. A player can favorite a loadout to localStorage with no account required (LOAD-07)
  3. A signed-in player's favorites can optionally sync to their account, additive and never required (LOAD-08)
  4. The builder passes a keyboard/ARIA/contrast accessibility and polish pass (LOAD-11)
  5. A player can share one URL holding four loadouts, each editable per slot, with the first cut budgeted for post-launch iteration (LOAD-12)

**Plans**: TBD
**UI hint**: yes

## 📋 M10 · Players can explore season analytics (planned)

**Milestone goal:** Players read season-level analytics, stories and comparisons across all 160 seasons, and charts hide when a season has no telemetry. The issues are rewritten against the real schema first. The milestone ends in a release to `main`.

- [ ] **Phase 10: Archive Analytics Spec Refresh** - The analytics issues are rewritten against the real schema before any Track D code
- [ ] **Phase 11: Archive Analytics Feature Build** - Season-level analytics and storytelling insights ship, working across all 160 seasons
- [ ] **Phase 12: Archive Analytics — Comparison, Narrative & Caching** - Season comparison, delta badges, narrative variety, and cached aggregates

### Phase 10: Archive Analytics Spec Refresh

**Goal**: The Archive Analytics issues describe the real schema and data reach before any implementation starts
**Mode:** mvp
**Depends on**: Nothing
**Requirements**: ARCH-01
**Success Criteria** (what must be TRUE):

  1. #179, #180, and #270 no longer reference the retired `h1_live_snapshot`/`h1_snapshot`/`h1_event_snapshot` tables — they reference the real `h1_season`/`h1_status`/`h1_statistic`/`h1_event`/`h1_event_progress` schema (ARCH-01)
  2. Each rewritten issue records its data reach (all 160 seasons vs. the 157+ telemetry window), the explicit-empty-state rule, and the mixed-coverage rule for comparisons (ARCH-01)

**Plans**: TBD

### Phase 11: Archive Analytics Feature Build

**Goal**: Players can see season-level analytics and story-driven insights that work across the full 160-season archive, with playback of a season's evolution
**Mode:** mvp
**Depends on**: Phase 10, Phase 3 (adds tests)
**Requirements**: ARCH-02, ARCH-03, ARCH-04, ARCH-05, ARCH-11
**Success Criteria** (what must be TRUE):

  1. The Momentum Tracker renders for any of the 160 seasons, and ships first among the new charts (ARCH-02)
  2. Season Report Card, Season Fingerprint radar, Player Attrition Curve, and Peak Hour Heatmap each hide (rather than render zeros) when their season lacks telemetry, pinned by a test, with the Report Card degrading gracefully on partial data (ARCH-03)
  3. Clutch Factor, Perfect Storm, Coordination Paradox, and Planet Heartbeat classify historic seasons against thresholds documented before implementation (ARCH-04)
  4. A player can scrub a season's timeline with the map evolving and control play/pause/speed (ARCH-05)
  5. On the archives map a faction stays hidden until its introduction point in the season, and the live map is unchanged (ARCH-11)

**Plans**: TBD
**Note**: New season-level analytics pages register in the sitemap/llms.txt/metadata registry per the SEO-02/04 convention established in Phase 5.
**UI hint**: yes

### Phase 12: Archive Analytics — Comparison, Narrative & Caching

**Goal**: Players can compare seasons meaningfully, read varied and grammatically correct war narrative, and see the archive respond quickly for closed seasons
**Mode:** mvp
**Depends on**: Phase 11
**Requirements**: ARCH-06, ARCH-07, ARCH-08, ARCH-09, ARCH-10
**Success Criteria** (what must be TRUE):

  1. A player can select a second season and see key stats side-by-side, with mixed-coverage rows dropped from both sides (ARCH-06)
  2. Season stats display delta badges against all-season averages, with the baseline population documented on the issue (ARCH-07)
  3. War narrative text shows phrasing variety, avoids sequential repetition, and the `defendWon` grammar bug is fixed (ARCH-08)
  4. Event progress is visible in the region tab and/or as persistent active-event toasts, per the option chosen on the issue (ARCH-09)
  5. Closed-season aggregate queries are served from a cache instead of recomputed per request, and every new chart is verified against a production build (`npm run build && npm run start`) (ARCH-10)

**Plans**: TBD
**Note**: Any new comparison-view routes register in the sitemap/llms.txt/metadata registry per the SEO-02/04 convention established in Phase 5.
**UI hint**: yes

## 📋 M11 · The site is accessible and polished (planned)

**Milestone goal:** The site meets WCAG contrast and ARIA rules, admins can broadcast, and the map gains depth; the two Icebox spikes reach a decision. The milestone ends in a release to `main`.

- [ ] **Phase 13: Accessibility & Design Polish** - WCAG contrast, ARIA patterns, and scoped visual fixes
- [ ] **Phase 14: Site Features & Easter Eggs** - Admin broadcasts, the Ministry of Truth toggle, faction vernacular, and API dashboard hygiene
- [ ] **Phase 15: Map Visuals & Icebox Investigative Spikes** - CSS 3D map depth and animation, plus the two open-ended Icebox spikes reach terminal decisions

### Phase 13: Accessibility & Design Polish

**Goal**: The site meets WCAG contrast and ARIA expectations and has had its rough visual edges scoped and fixed
**Mode:** mvp
**Depends on**: Phase 3 (adds tests)
**Requirements**: A11Y-01, A11Y-02, A11Y-03, A11Y-04, A11Y-05
**Success Criteria** (what must be TRUE):

  1. `prefers-contrast: more` token overrides pass WCAG AA on their surfaces without changing the default aesthetic, verified via DevTools `getComputedStyle()` (A11Y-01)
  2. FactionTabs, BottomNav, alerts/toasts, and the map expose correct WAI-ARIA patterns (tabs, landmark + active state, live region, accessible name/description), with keyboard navigation verified programmatically (A11Y-02)
  3. Footer `href=""` links are fixed, the footer is responsive on mobile, sitemap links point at real pages, and active nav styling is correct (A11Y-03)
  4. Scoped decorative polish (dividers, wings, logo hover) ships time-boxed and without disturbing visual-regression baselines (A11Y-04)
  5. The layout stays readable, capped, and centered past 21:9, tested at 2560×1080, 3440×1440, and 2560×1440 (A11Y-05)

**Plans**: TBD
**UI hint**: yes

### Phase 14: Site Features & Easter Eggs

**Goal**: Admins can broadcast custom notifications, players can toggle an in-character propaganda view, faction vernacular reads consistently, and the API dashboard is trustworthy
**Mode:** mvp
**Depends on**: Phase 12 (SITE-03 shares a vocabulary source with ARCH-08's narrative phrasing; whichever lands second consumes the other's source)
**Requirements**: SITE-01, SITE-02, SITE-03, SITE-04
**Success Criteria** (what must be TRUE):

  1. An admin can compose and send a custom notification with a toast-only or push(+toast) channel toggle, gated to admins (SITE-01)
  2. A player can toggle a Ministry of Truth view that swaps redacted telemetry cards for in-character propaganda answers, with placement and persistence decided (SITE-02)
  3. Faction vernacular (infest/siege/threat) appears consistently across user-facing copy, sourced from one vocabulary shared with the war narrative (SITE-03)
  4. A user sees their API key exactly once at creation, per-key usage is tracked and displayed, and dashboard styling is fixed (SITE-04)

**Plans**: TBD
**UI hint**: yes

### Phase 15: Map Visuals & Icebox Investigative Spikes

**Goal**: The galaxy map gains subtle visual depth and animation without regressing performance or hydration, and the two open-ended Icebox spikes reach a written, terminal decision
**Mode:** mvp
**Depends on**: Phase 3 (adds tests)
**Requirements**: MAP-01, MAP-02, MAP-03, MAP-04, ICE-06, ICE-07
**Success Criteria** (what must be TRUE):

  1. The galaxy map tilts/rotates in CSS 3D around its center following the mouse, respecting `prefers-reduced-motion`, with no hydration regressions (MAP-01)
  2. Contested regions show a capture-progress overlay and subtle CSS/SVG battle animations layered over existing rendering, measured for frame cost and respecting `prefers-reduced-motion` (MAP-02, MAP-03)
  3. Faction nebula clouds render behind territories using an approach not among the three previously-failed attempts, with no viewBox clipping or hydration mismatch (MAP-04)
  4. #233's leaderboard/undocumented-endpoint spike ends with findings written on the issue and a terminal decision — a follow-up issue or a close (ICE-06)
  5. #444's cert-pinning spike ends with either a closed issue (console pins the cert) or a working custom campaign server serving the existing rebroadcast wire format (console doesn't pin), with the ToS/impersonation risk noted on the issue as accepted (ICE-07)

**Plans**: TBD
**UI hint**: yes

## 📋 M12 · Staging runs on the Pi and live updates are decided (planned)

**Milestone goal:** A push to `develop` deploys to staging on the Pi swarm, a spike decides on SSE against polling, and the public docs describe what shipped. The milestone ends in a release to `main`.

- [ ] **Phase 16: Staging on the Pi Swarm** - `develop` pushes deploy automatically to a validated staging environment
- [ ] **Phase 17: SSE Spike & Conditional Implementation** - The four SSE gating questions are answered empirically; polling is replaced only if the spike says yes
- [ ] **Phase 18: Final Documentation Pass** - All public docs describe the system as it shipped across M8 to M12

### Phase 16: Staging on the Pi Swarm

**Goal**: A push to `develop` deploys automatically to a validated staging environment on the Pi swarm
**Mode:** mvp
**Depends on**: Nothing (hardware-gated, ready now; scheduled before Phase 17 so the SSE spike can test against real staging topology)
**Requirements**: STAGE-01, STAGE-02, STAGE-03, STAGE-04
**Success Criteria** (what must be TRUE):

  1. Swarm secrets, the Cloudflare Tunnel, and GitHub Actions secrets are configured, and a `develop` push deploys to the Pi swarm via the self-hosted runner (STAGE-01)
  2. No self-hosted-runner-labeled workflow runs fork-controlled `pull_request` code (STAGE-02)
  3. The Uptime Kuma maintenance banner toggles around a real deploy (STAGE-03)
  4. The staging dashboard is live, exactly one poller holds the lease across 3 nodes (visible in `worker_heartbeat`), the OG route renders on arm64, and docker-smoke covers it (STAGE-04)

**Plans**: TBD

### Phase 17: SSE Spike & Conditional Implementation

**Goal**: The four gating questions about replacing polling with SSE are answered empirically, and polling is replaced only if the spike says it should be
**Mode:** mvp
**Depends on**: Phase 16 (spike tests against real staging topology), Phase 3 (adds tests)
**Requirements**: SSE-01, SSE-02
**Success Criteria** (what must be TRUE):

  1. #298 records written answers to all four gating questions — proxy/CrowdSec/idle-timeout survival, backgrounded/sleeping/offline behavior, per-tab vs. leader stream, and measured latency win over 10s polling — from a throwaway spike branch that is discarded regardless of outcome (SSE-01)
  2. If the spike says yes: SSE replaces polling via Postgres `LISTEN/NOTIFY` fan-out across replicas, `useLiveData`'s public return shape is preserved, and a reconnect-and-catch-up contract is verified on staging. If the spike says no: #298 is closed with the findings (SSE-02)

**Plans**: TBD

### Phase 18: Final Documentation Pass

**Goal**: All public documentation describes the system as it actually shipped across M8 to M12
**Mode:** mvp
**Depends on**: Phase 9, Phase 12, Phase 16, Phase 17 (describes what shipped, so it runs after every feature track lands)
**Requirements**: DOCS-03
**Success Criteria** (what must be TRUE):

  1. `/docs` and AGENTS.md describe the Loadout Builder, Archive Analytics, staging on the Pi swarm, and the SSE outcome as they actually shipped, not as originally planned (DOCS-03)
  2. No public doc references superseded architecture (pre-lease model, single-replica assumptions, or a schema that M8 to M12 changed) (DOCS-03)

**Plans**: TBD
**Note**: This pass also runs SEO-07's recurring Google Search Console review; findings become GitHub issues rather than being fixed inline here.

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9 → 10 → 11 → 12 → 13 → 14 → 15 → 16 → 17 → 18

Phases 2 and 4 are parallelizable with Phase 3 (Test Co-location) — none of them add unit tests. Phase 7 (Loadout) and Phase 10 (Archive spec refresh) touch disjoint files once Phase 3 lands and can run in separate worktrees, per research finding.

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Stability Fixes & Release | 9/9 | Complete    | 2026-10-21 |
| 1.1. Production on the Hetzner Swarm (INSERTED) | - | Complete    | 2026-10-25 |
| 2. Docs Accuracy & Operational Housekeeping | 1/12 | In Progress | - |
| 3. Test Co-location | 0/TBD | Not started | - |
| 4. Dependency Cleanup & Auto-merge Automation | 0/TBD | Not started | - |
| 5. SEO & Analytics Foundation | 0/TBD | Not started | - |
| 6. Icebox Quick Closures | 0/TBD | Not started | - |
| 7. Loadout Foundation (Catalogs + Codec) | 0/TBD | Not started | - |
| 8. Loadout Builder Core | 0/TBD | Not started | - |
| 9. Loadout Enhancements & Squad Mode | 0/TBD | Not started | - |
| 10. Archive Analytics Spec Refresh | 0/TBD | Not started | - |
| 11. Archive Analytics Feature Build | 0/TBD | Not started | - |
| 12. Archive Analytics — Comparison, Narrative & Caching | 0/TBD | Not started | - |
| 13. Accessibility & Design Polish | 0/TBD | Not started | - |
| 14. Site Features & Easter Eggs | 0/TBD | Not started | - |
| 15. Map Visuals & Icebox Investigative Spikes | 0/TBD | Not started | - |
| 16. Staging on the Pi Swarm | 0/TBD | Not started | - |
| 17. SSE Spike & Conditional Implementation | 0/TBD | Not started | - |
| 18. Final Documentation Pass | 0/TBD | Not started | - |

---
*Roadmap created: 2026-08-29*
*Revised: 2026-08-29 — inserted Phase 5 (SEO & Analytics Foundation, SEO-01…10 + HOUSE-02) after Test Co-location and Dependency Cleanup; renumbered Phases 5-17 to 6-18*
*Revised: 2026-11-02 — `docs/roadmap.md` deleted (HOUSE-05); #469 scheduled as ARCH-11 in Phase 11; its other live items carried over below*
*Granularity: fine (18 phases) · Mode: mvp*

## Carried over from docs/roadmap.md (2026-11-02)

Live items of the former `docs/roadmap.md` that no phase or requirement held. The file was deleted on 2026-11-02 (HOUSE-05); its last full version is at commit [`bb01517d`](https://github.com/elfensky/helldivers.bot/blob/bb01517d560cc7ec1d673a280628ce5e86f00dc4/docs/roadmap.md). Everything else it held lives in the phases above, in REQUIREMENTS.md or in PROJECT.md.

**Prediction follow-ups, parked on data.** Out of scope for this milestone (REQUIREMENTS.md § Out of Scope). Check the gate before you pick one up; if it is not met, leave the issue parked. `docs/superpowers/predictions-handoff.md` is the living record.

| Issue | Unblocks when |
|-------|---------------|
| #481 Attack ETA attempt 4b | ~S165+ reached |
| #484 Sector ETA measured range | script 13's gate becomes evaluable |
| #487 Defend attempt 6 | ~30+ progress-tracked assaults exist |
| #477 Assault ETA band width (Icebox) | ~S172 |

**Archive Analytics data reach, input for Phase 10 (ARCH-01).** Measured 2026-07-27 with season 160 active: `h1_season`, `h1_status` and `h1_event` cover seasons 1–160; `h1_statistic` covers seasons 157–160 only. Re-run the count before relying on it; telemetry grows by one season per war.

| Reach | Features |
|-------|----------|
| All seasons | Momentum Tracker, Clutch Factor, Planet Heartbeat, Perfect Storm, event win rates, cascade severity, war duration |
| Telemetry seasons only (157+) | Season Fingerprint (4 of 6 axes are telemetry), Peak Hour Heatmap, Player Attrition Curve |
| Partial | Season Report Card: event win rate is universal, mission/kill efficiency is not |

**Phase 11 notes that no requirement records.**

- ARCH-03 (#179): the Season Fingerprint radar carries #269's old overlay requirement ("compare up to 3 seasons"); that is why #269 was narrowed to ARCH-06, not closed.
- ARCH-02/03 (#179): the debate synthesis that #177 cites (`docs/debates/2026-03-30-archive-analytics/`) is not in the repo. The issue bodies are the surviving record.
- ARCH-05 (#270): War Playback brings back the horizontal timeline scrubber that the archives redesign removed. Find that commit in git history first.

**Prep ladder.** Before code, stop at the first rung that applies:

1. None: the issue body is the spec (most chores, single-call-site bugfixes).
2. Plan (`superpowers:writing-plans`): the shape is settled, but the work spans 5+ files or its order matters.
3. Brainstorm (`superpowers:brainstorming`), then plan: the issue describes an outcome (new UI surfaces count), has open design questions, says "explore", or lists alternatives.
4. Spec refresh: the issue body is wrong, not only thin. Rewrite the issue against current reality first (Phase 10 is this rung for Archive Analytics).
