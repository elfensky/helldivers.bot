# Roadmap: helldivers.bot

## Overview

This milestone drains every open GitHub issue to a terminal state: stability bugs fixed and released first, then three prerequisite gates — docs accuracy, test co-location (before any phase adds more tests), and dependency cleanup — followed by an SEO & Analytics foundation locked in before any feature page can accrue ranking drift, then the independent feature tracks — Icebox disposition, Loadout Builder, Archive Analytics, Accessibility, Site Features, Map Visuals — and finally the two infrastructure bets (Pi Swarm staging, then a spike-gated SSE rewrite) before a closing documentation pass — including a Search Console findings review — describes what actually shipped. Every phase is a releasable vertical slice: a bug class eliminated and verified in production, a feature a player can use end to end, or a written terminal decision on an issue.

## Phases

**Phase Numbering:**

- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Stability Fixes & Release** - The five known production bug classes are fixed at root cause, verified live, and `develop` is released to `main`
- [ ] **Phase 2: Docs Accuracy & Operational Housekeeping** - CLAUDE.md and `/docs` describe the lease model as it actually works, and outstanding operational verification chores close out
- [ ] **Phase 3: Test Co-location** - Unit tests move next to their modules before any later phase adds more tests
- [ ] **Phase 4: Dependency Cleanup & Auto-merge Automation** - The Dependabot backlog clears and minor/patch updates merge unattended thereafter
- [ ] **Phase 5: SEO & Analytics Foundation** - The site is structurally primed to rank for Helldivers 1 search queries and every interaction is tracked in Umami, before any feature page can drift from the convention
- [ ] **Phase 6: Icebox Quick Closures** - The five already-decided Icebox issues close with written reasons
- [ ] **Phase 7: Loadout Foundation (Catalogs + Codec)** - Item catalogs and the versioned shareable-URL hash format lock before any UI encodes against them
- [ ] **Phase 8: Loadout Builder Core** - A player can build a loadout, see its stats, and share a link with a custom preview image
- [ ] **Phase 9: Loadout Enhancements & Squad Mode** - Guides, favorites, account sync, accessibility, and a 4-player shareable squad loadout
- [ ] **Phase 10: Archive Analytics Spec Refresh** - The analytics issues are rewritten against the real schema before any Track D code
- [ ] **Phase 11: Archive Analytics Feature Build** - Season-level analytics and storytelling insights ship, working across all 160 seasons
- [ ] **Phase 12: Archive Analytics — Comparison, Narrative & Caching** - Season comparison, delta badges, narrative variety, and cached aggregates
- [ ] **Phase 13: Accessibility & Design Polish** - WCAG contrast, ARIA patterns, and scoped visual fixes
- [ ] **Phase 14: Site Features & Easter Eggs** - Admin broadcasts, the Ministry of Truth toggle, faction vernacular, and API dashboard hygiene
- [ ] **Phase 15: Map Visuals & Icebox Investigative Spikes** - CSS 3D map depth and animation, plus the two open-ended Icebox spikes reach terminal decisions
- [ ] **Phase 16: Staging on the Pi Swarm** - `develop` pushes deploy automatically to a validated staging environment
- [ ] **Phase 17: SSE Spike & Conditional Implementation** - The four SSE gating questions are answered empirically; polling is replaced only if the spike says yes
- [ ] **Phase 18: Final Documentation Pass** - All public docs describe the system as it shipped across this entire milestone

## Phase Details

### Phase 1: Stability Fixes & Release

**Goal**: The five known production bug classes are fixed at root cause, verified in production, and `develop` is released to `main`
**Mode:** mvp
**Depends on**: Nothing (first phase)
**Requirements**: STAB-01, STAB-02, STAB-03, STAB-04, STAB-05, STAB-06, STAB-07
**Success Criteria** (what must be TRUE):

  1. Loading `/` in any timezone produces no React #418 hydration warning, with the SSR/client divergence identified per variant (not masked with a mounted-flag) and a regression test per divergent value (STAB-01)
  2. `/opengraph-image` never 500s — it falls back to a static image on render failure, and null-slot, no-active-event, and homeworld-only map states have render coverage (STAB-02)
  3. The notification toggle resolves to an explicit error state with a visible retry when `serviceWorker.ready` hangs or `getSubscription()` rejects, instead of spinning forever (STAB-03)
  4. `--font-mono` is resolved one way or the other (loaded via `next/font`, or dropped from the token) with before/after measurements of affected elements recorded on the issue (STAB-04)
  5. `getWarOutcome` tolerates a null faction slot instead of throwing, pinned by a regression test (STAB-05)
  6. GlitchTip shows zero new events for the #496/#503/#485 classes on the new deployment id over a 48-hour window after `develop` is tagged and released to `main`, with `main` merged back into `develop` (STAB-06, STAB-07)

**Plans**: 5/9 plans executed

Plans:
**Wave 1**

- [x] 01-01-PLAN.md — Tracer: getWarOutcome null-slot guard + buildPlayerBeats zero-baseline coverage (STAB-05)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 01-02-PLAN.md — Hydration sweep, per-variant fixes and regression tests on `/` (STAB-01)
- [x] 01-03-PLAN.md — OG static crash fallback served as raw bytes, per-outcome cache headers (STAB-02)
- [x] 01-06-PLAN.md — NotificationToggle error state, 5s timeout, Retry and VAPID surfacing (STAB-03)
- [x] 01-07-PLAN.md — Space Mono via next/font, token repoint, before/after measurements (STAB-04)

**Wave 3** *(blocked on Wave 2 completion)*

- [ ] 01-04-PLAN.md — OG render telemetry, getCampaign failure-mode audit, edge-case map-state coverage (STAB-02)

**Wave 4** *(blocked on Wave 3 completion)*

- [ ] 01-05-PLAN.md — Time-boxed sharp-rejection reproduction against the standalone image (STAB-02)

**Wave 5** *(blocked on Wave 4 completion)*

- [ ] 01-08-PLAN.md — Symbolication gate, single develop→main release, tag and merge-back (STAB-07)

**Wave 6** *(blocked on Wave 5 completion)*

- [ ] 01-09-PLAN.md — 48h GlitchTip re-count on the new deployment id, issue disposition (STAB-06)

**UI hint**: yes

### Phase 2: Docs Accuracy & Operational Housekeeping

**Goal**: Documentation matches deployed reality and the small outstanding operational verification chores close out
**Mode:** mvp
**Depends on**: Phase 1 (HOUSE-03 needs a release to prove symbolication; DOCS-01/02 describe the current, already-shipped lease model)
**Requirements**: DOCS-01, DOCS-02, HOUSE-03, HOUSE-04, HOUSE-05
**Success Criteria** (what must be TRUE):

  1. CLAUDE.md § Architecture describes the lease/`worker_heartbeat` model, `WORKER_ENABLED`, and the multi-replica web tier, with no mention of the retired module-level `lastSeasonObserved` state (DOCS-01)
  2. Each public `/docs` page (architecture, data-flow, infrastructure, database, testing) matches the code when checked page-by-page against `.planning/codebase/` (DOCS-02)
  3. Sourcemaps are uploaded at build time and stripped from the shipped image once GlitchTip symbolication is proven on at least one release, verified by image size and a symbolicated production stack trace (HOUSE-03)
  4. The seed-refresh workflow's PR path is verified end-to-end (a real season transition, or a controlled simulation), with the run recorded on #501 (HOUSE-04)
  5. `docs/roadmap.md` is retired to a short pointer at `.planning/ROADMAP.md`, leaving one source of truth for execution order (HOUSE-05)

**Plans**: TBD

### Phase 3: Test Co-location

**Goal**: Unit tests live next to the modules they test, so every later phase that adds tests lands on the new convention instead of the old one
**Mode:** mvp
**Depends on**: Nothing (parallelizable with Phase 2 and Phase 4; must complete before Phase 5, 7, 8, 9, 10, 11, 12, 13, 15, 17)
**Requirements**: HOUSE-01
**Success Criteria** (what must be TRUE):

  1. Every unit test file sits at `*.test.*` beside the module it covers; `src/__tests__/` retains only `_meta`, contract, and integration tests
  2. A co-location guard replaces `mirrorTree.test.mjs` and fails CI when a test is misplaced
  3. `.dockerignore`, `output: 'standalone'`, and `pageExtensions` are verified to still exclude test files from the production image
  4. CLAUDE.md § Test Layout describes the co-located convention, not the mirrored tree

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
  6. CLAUDE.md § Git Workflow states the Dependabot exemption (no version bump/CHANGELOG move on those merges — folded in at the next real release), and `check-version.yml` does not block Dependabot PRs (DEPS-06)

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
**Requirements**: ARCH-02, ARCH-03, ARCH-04, ARCH-05
**Success Criteria** (what must be TRUE):

  1. The Momentum Tracker renders for any of the 160 seasons, and ships first among the new charts (ARCH-02)
  2. Season Report Card, Season Fingerprint radar, Player Attrition Curve, and Peak Hour Heatmap each hide (rather than render zeros) when their season lacks telemetry, pinned by a test, with the Report Card degrading gracefully on partial data (ARCH-03)
  3. Clutch Factor, Perfect Storm, Coordination Paradox, and Planet Heartbeat classify historic seasons against thresholds documented before implementation (ARCH-04)
  4. A player can scrub a season's timeline with the map evolving and control play/pause/speed (ARCH-05)

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

**Goal**: All public documentation describes the system as it actually shipped across this entire milestone
**Mode:** mvp
**Depends on**: Phase 9, Phase 12, Phase 16, Phase 17 (describes what shipped, so it runs after every feature track lands)
**Requirements**: DOCS-03
**Success Criteria** (what must be TRUE):

  1. `/docs` and CLAUDE.md describe the Loadout Builder, Archive Analytics, staging on the Pi swarm, and the SSE outcome as they actually shipped, not as originally planned (DOCS-03)
  2. No public doc references superseded architecture (pre-lease model, single-replica assumptions, or a schema this milestone changed) (DOCS-03)

**Plans**: TBD
**Note**: This pass also runs SEO-07's recurring Google Search Console review; findings become GitHub issues rather than being fixed inline here.

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9 → 10 → 11 → 12 → 13 → 14 → 15 → 16 → 17 → 18

Phases 2 and 4 are parallelizable with Phase 3 (Test Co-location) — none of them add unit tests. Phase 7 (Loadout) and Phase 10 (Archive spec refresh) touch disjoint files once Phase 3 lands and can run in separate worktrees, per research finding.

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Stability Fixes & Release | 5/9 | In Progress|  |
| 2. Docs Accuracy & Operational Housekeeping | 0/TBD | Not started | - |
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
*Granularity: fine (18 phases) · Mode: mvp*
