# Requirements: helldivers.bot

**Defined:** 2026-08-28
**Core Value:** The live dashboard and API are stable and correct — the poller never loses data across season transitions or replica handovers, and production error volume stays at zero known classes.

Scope decision: **every open GitHub issue reaches a terminal state** — shipped and released, or closed with a written reason on the issue. The only tolerated exceptions are the four data-gated prediction issues (see Out of Scope).

## v1 Requirements

Requirements for this milestone. Each maps to roadmap phases.

### Stability (STAB)

- [ ] **STAB-01**: #496 — React #418 hydration mismatch on `/` is fixed at the root (SSR/client value divergence identified per variant, not masked with mounted-flags), with a regression test per divergent value
- [ ] **STAB-02**: #503 — `/opengraph-image` never 500s: the Satori→resvg failure is root-caused, the route falls back to a static image on render failure, and edge-case map states (null slots, no active events, homeworld-only) have render coverage
- [ ] **STAB-03**: #485 — `NotificationToggle` cannot stay in `'loading'` forever: hung `serviceWorker.ready`/rejected `getSubscription()` resolve to an explicit error state with a visible retry, covered by a test
- [ ] **STAB-04**: #476 — `--font-mono` is resolved one way or the other (load Space Mono via `next/font` or drop it from the token) with before/after measurements of affected mono elements recorded on the issue
- [x] **STAB-05**: #459 — `getWarOutcome` tolerates null faction slots; regression test pins it
- [ ] **STAB-06**: After the stability release, GlitchTip shows zero new events for #496/#503/#485 classes on the new `dpl` id over a 48h window; residual classes get new issues
- [ ] **STAB-07**: `develop` is released to `main` (PR → `vX.Y.Z` tag on the merge commit → `main` merged back into `develop`) once STAB-01…05 land; thereafter the develop/main gap stays ≤ ~5 versions

### Dependencies & Automation (DEPS)

- [ ] **DEPS-01**: All 7 open Dependabot alerts (`nanoid` high, `mermaid` ×5, `dompurify`) are cleared via non-breaking lockfile bumps; `npm audit --audit-level=moderate` reports only the Prisma-chain `deepmerge-ts` advisory
- [ ] **DEPS-02**: The 5 open Dependabot PRs are resolved — minor/patch group #515 and #504 merged green, TypeScript 6→7 (#511) and `@types/node` 25 (#510) each explicitly accepted or closed with reason, actions group #514 merged
- [ ] **DEPS-03**: Repository settings: `allow_auto_merge` on; squash and rebase merge buttons disabled so only merge commits are possible on any PR
- [ ] **DEPS-04**: A branch ruleset on `develop` requires the CI status checks (names matched to `check-ci.yml` job ids) and does **not** require linear history
- [ ] **DEPS-05**: A workflow enables auto-merge (`gh pr merge --auto --merge`) on Dependabot PRs classified minor/patch by `dependabot/fetch-metadata`; major bumps are left for manual review; verified by observing one real Dependabot PR merge unattended
- [ ] **DEPS-06**: CLAUDE.md § Git Workflow states the exemption: Dependabot merges into `develop` carry no version bump / CHANGELOG move; the next real release folds them in. `check-version.yml` does not block Dependabot PRs

### Housekeeping (HOUSE)

- [ ] **HOUSE-01**: #466 — unit tests are co-located as `*.test.*` next to their modules; `src/__tests__/` keeps only `_meta`, contract and integration tests; `mirrorTree.test.mjs` is replaced by a co-location guard; `.dockerignore` / `output: 'standalone'` / `pageExtensions` verified to exclude tests from the image; CLAUDE.md § Test Layout rewritten. Lands before any feature phase adds tests
- [ ] **HOUSE-02**: #389 — Rich Results, Schema.org validator, Search Console and SERP previews for `/`, `/archives`, `/docs/about` verified on production; findings fixed or recorded (checks absorbed into SEO-05)
- [ ] **HOUSE-03**: #502 — once GlitchTip symbolication is proven on ≥1 release, sourcemaps are uploaded at build time and stripped from the shipped image (~24 MB saved); verified by image size and a symbolicated production stack trace
- [ ] **HOUSE-04**: #501 — the seed-refresh workflow's PR path is verified end-to-end at the next season transition (or via a controlled simulation if the transition hasn't happened by the phase's end); issue records the run
- [ ] **HOUSE-05**: `docs/roadmap.md` is retired to a short pointer at `.planning/ROADMAP.md`; one source of truth for execution order

### Documentation Accuracy (DOCS)

- [ ] **DOCS-01**: CLAUDE.md § Architecture describes the lease/`worker_heartbeat` model, `WORKER_ENABLED`, and the multi-replica web tier — no mention of module-level `lastSeasonObserved` state
- [ ] **DOCS-02**: Public `/docs` pages (`architecture`, `data-flow`, `infrastructure`, `database`, `testing`) match the code — lease, replica topology, CI/CD workflow names, test layout — verified page-by-page against `.planning/codebase/`
- [ ] **DOCS-03**: A final docs pass after all feature tracks ship covers Loadout Builder, Archive Analytics, staging, and the SSE outcome, so docs describe what shipped

### SEO & Analytics (SEO)

Goal: rank highly for Helldivers 1 queries ("helldivers 1 galactic war status/map/stats/api/loadout", "helldivers war archive"…). Patterns copied from `../euraikaweb` (llms.txt, `robots.js`/`sitemap.js` via the Metadata API, `createPageMetadata` helper, typed JSON-LD components). Google Search Console already has the property.

- [ ] **SEO-01**: `/llms.txt` served (euraikaweb pattern): one-paragraph site summary, core pages with one-line descriptions, the public API, data facts (160 seasons, factions, telemetry reach), contact/author — kept current by the same registry as the sitemap
- [ ] **SEO-02**: `sitemap.js` is registry-driven and covers every public route (all `/docs/**` incl. `predict/*`, `/stats`, `/legal`, `/archives` per-season URLs, `/loadout` when it ships) with truthful `lastModified` (not `new Date()` on every request); a test fails when a public `page.*` is missing from the registry
- [ ] **SEO-03**: `robots.js` via the Metadata API (replacing the static file), consistent with the sitemap, AI crawlers explicitly allowed, private routes (`/profile`, `/sign-in`, `/sandbox`, `/api`) disallowed; `/robots.txt` and `/sitemap.xml` are in the uptime monitor (an intermittent 520 was observed on 2026-08-28)
- [ ] **SEO-04**: every public page has a unique `title` (template `%s — Helldivers Bot`), `description`, self-canonical and page-specific OpenGraph/Twitter via a shared `createPageMetadata()` helper; private pages (`/profile`, `/sign-in`, `/sandbox/*`) carry `robots: noindex`
- [ ] **SEO-05**: JSON-LD is typed components (euraikaweb pattern) and covers `WebSite`, `WebApplication`, `VideoGame` main entity, `BreadcrumbList` on every page, `FAQPage` on `/docs/faq`, `Dataset` for the historic war archive, `Event` per active event; every type passes the Rich Results Test and schema.org validator (absorbs #389's checks)
- [ ] **SEO-06**: Keyword-to-page map written (target queries above → owning page) and each owning page has server-rendered H1 + intro copy covering its queries; archives seasons are indexable at unique URLs with per-season titles ("Helldivers 1 — War 160 archive") and metadata; docs pages get descriptive titles instead of generic ones
- [ ] **SEO-07**: Google Search Console is wired into the workflow: verification token in metadata, sitemap submitted, an agent-accessible path (GSC API or an MCP server) to pull performance (queries/impressions/CTR/position) and coverage; a recurring review turns findings into GitHub issues, and the first review's fixes ship in this milestone
- [ ] **SEO-08**: Lighthouse SEO ≥ 95 and Performance/Accessibility ≥ 90 on `/`, `/archives`, `/docs` measured against production (the `scheduled-pagespeed.yml` report on the `metrics` branch is the record); Core Web Vitals pass in GSC's report
- [ ] **SEO-09**: Umami (umami.drunik.be) is fully wired: `UMAMI_SITE_ID`/`UMAMI_SITE_URL` present in production and staging runtime env, tracker loads via the `/stats.js` proxy and events flow through `/api/send`→`/api/umami` (verified by a real event in the Umami dashboard), `umami.identify()` on login, and `umamiTrackEvent` called via `after()` on every public API route (`/api/v1/**`, `/api/h1/campaign`, `/api/h1/rebroadcast`) — currently zero routes do
- [ ] **SEO-10**: Every interactive element carries `data-umami-event` (or `useTrack`), enforced by a lint rule or test rather than review; Umami event names follow `category-action` and the category list in CLAUDE.md is complete

### Loadout Builder (LOAD) — milestone #19

- [ ] **LOAD-01**: #339 — static JSON catalogs for stratagems, weapons, perks with string IDs (never indices), stats fields, and stratagem input codes; schema-validated by a test
- [ ] **LOAD-02**: #340 — loadout design tokens added to `layout.css` `@theme`
- [ ] **LOAD-03**: #341 — versioned URL codec (version marker + bit-packed base64url, no new deps) that round-trips solo, partial (nulls) and 4-player squad loadouts; solo hash stays short; golden-fixture tests pin the v1 format; hash-vs-query placement decided against OG/SSR reachability before anything encodes against it
- [ ] **LOAD-04**: #342 — `/loadout` route with editor mode and read-only shared mode (“Edit copy” never mutates the shared link), mobile-first
- [ ] **LOAD-05**: #343 — compact item stats display in the builder
- [ ] **LOAD-06**: #344 — curated per-faction guide page(s) linking to pre-built loadouts
- [ ] **LOAD-07**: #345 — localStorage favorites, no account required
- [ ] **LOAD-08**: #346 — optional account sync of favorites via the existing BetterAuth/server-action pattern; additive, never required
- [ ] **LOAD-09**: #347 — `/loadout` in navigation with Umami tracking
- [ ] **LOAD-10**: #348 — per-loadout OG image rendering the selected items, built with the STAB-02 fallback pattern from day one
- [ ] **LOAD-11**: #349 — accessibility and polish pass (keyboard, ARIA, contrast) on the builder
- [ ] **LOAD-12**: #350 — squad mode: one shareable URL holding four loadouts, editable per slot; first cut budgets for post-launch iteration

### Archive Analytics (ARCH) — milestone #16

- [ ] **ARCH-01**: #179/#180/#270 issue bodies rewritten against the real `h1_*` schema, each recording data reach (all 160 vs 157+), the explicit-empty-state rule, and the mixed-coverage rule for comparisons — before any Track D code
- [ ] **ARCH-02**: #179 — Momentum Tracker (works on all 160 seasons) ships first
- [ ] **ARCH-03**: #179 — Season Report Card, Season Fingerprint radar, Player Attrition Curve, Peak Hour Heatmap; each telemetry-backed component hides when empty, pinned by a test; Report Card degrades gracefully on partial data
- [ ] **ARCH-04**: #180 — Clutch Factor, Perfect Storm, Coordination Paradox, Planet Heartbeat with thresholds brainstormed and documented before implementation
- [ ] **ARCH-05**: #270 — War Playback: scrub a season chronologically with the map evolving, play/pause/speed
- [ ] **ARCH-06**: #269 — second season selector + side-by-side key stats; mixed-coverage rows dropped for both sides
- [ ] **ARCH-07**: #462 — season stats vs all-season averages with delta badges; baseline population decided and written on the issue
- [ ] **ARCH-08**: #453 — war narrative phrasing variety + sequential decorrelation + `defendWon` grammar fix
- [ ] **ARCH-09**: #247 — event progress surfaced in the region tab and/or persistent active-event toasts (option chosen on the issue)
- [ ] **ARCH-10**: Closed-season aggregates are cached (not recomputed per request); every new Recharts chart is verified in a production build (`npm run build && npm run start`) because of the React-Compiler/`ResponsiveContainer` production-only bug

### Accessibility & Design (A11Y) — milestone #10

- [ ] **A11Y-01**: #42 — `@media (prefers-contrast: more)` token overrides pass WCAG AA on their surfaces; default aesthetic unchanged; verified via DevTools `getComputedStyle()`
- [ ] **A11Y-02**: #148 — WAI-ARIA patterns for FactionTabs (tabs), BottomNav (active state + landmark), alerts/toasts (live region), map (accessible name/description); keyboard navigation verified programmatically
- [ ] **A11Y-03**: #124 — footer `href=""` links fixed, footer responsive on mobile, sitemap links point at real pages, active nav styling
- [ ] **A11Y-04**: #124 — decorative flourishes (dividers, wings, logo hover) time-boxed and delivered only where they don't disturb visual-regression baselines
- [ ] **A11Y-05**: #184 — ultrawide: max-width released at 3xl, capped and centered beyond 21:9; tested at 2560×1080, 3440×1440, 2560×1440

### Site Features (SITE) — milestone #18

- [ ] **SITE-01**: #238 — admin can compose and send a custom notification with a toast-only / push (+toast) channel toggle; admin-only
- [ ] **SITE-02**: #392 — Ministry of Truth toggle swaps redacted telemetry cards for in-character propaganda answers; toggle placement and persistence decided
- [ ] **SITE-03**: #471 — faction vernacular (infest / siege / threat) applied across user-facing copy from one vocabulary source shared with the war narrative (#453)
- [ ] **SITE-04**: #27 — API key shown once at creation, per-key usage tracked and displayed, dashboard styling fixed

### Map Visuals (MAP) — unshelved Icebox items

- [ ] **MAP-01**: #43 re-scoped — no three.js; a CSS 3D perspective effect where the SVG map tilts/rotates around its center following the mouse, with `prefers-reduced-motion` respected and no hydration regressions
- [ ] **MAP-02**: #145 — capture-progress overlay (radial or linear) on contested regions
- [ ] **MAP-03**: #145 — subtle CSS/SVG battle animations on contested regions (explosions, ship flyovers, drop-ins) layered over existing rendering; measured for frame cost; `prefers-reduced-motion` respected
- [ ] **MAP-04**: #147 — faction nebula clouds behind territories using an approach not among the three failed attempts documented on the issue; no viewBox clipping, no hydration mismatch

### Icebox Disposition (ICE)

- [ ] **ICE-01**: #139 Discord bot — closed with reason (stale scope; re-file with concrete commands against the v1 API when wanted)
- [ ] **ICE-02**: #140 SwiftUI app — closed with reason (PWA is the mobile story)
- [ ] **ICE-03**: #28 Reviews system — closed with reason (loadout favorites cover the want)
- [ ] **ICE-04**: #141 Helmet avatar — closed with reason (ad-hoc asset, not a tracked feature)
- [ ] **ICE-05**: #189 CrowdSec verification — closed with the existing reason and a reopen trigger (reverse-proxy change)
- [ ] **ICE-06**: #233 — time-boxed spike probing the official API for leaderboard/undocumented endpoints; findings written on the issue; terminal decision (build follow-up issue or close)
- [ ] **ICE-07**: #444 — cert-pinning spike first (does the console accept a DNS-redirected host?); if not pinned, a custom campaign server serving authored campaign state through the existing rebroadcast wire format; if pinned, closed with the finding. ToS/impersonation exposure is noted on the issue as an accepted risk

### Staging (STAGE) — #474

- [ ] **STAGE-01**: Swarm secrets, Cloudflare Tunnel, and GitHub Actions secrets configured; a `develop` push deploys to the Pi swarm via the self-hosted runner
- [ ] **STAGE-02**: Self-hosted-runner trigger audit: no workflow runs fork-controlled `pull_request` code on the self-hosted label
- [ ] **STAGE-03**: Uptime Kuma maintenance banner toggles around each deploy (verified once for real)
- [ ] **STAGE-04**: Staging validated end-to-end: dashboard live on the staging URL, exactly one poller across 3 nodes (lease holder visible in `worker_heartbeat`), OG route renders on arm64, docker-smoke covers it

### SSE (SSE) — #298

- [ ] **SSE-01**: Throwaway spike (branch discarded) answers the four gating questions — proxy/CrowdSec/idle-timeout survival, backgrounded/sleeping/offline behavior, per-tab vs leader stream, measured latency win over 10s polling — with answers written on #298
- [ ] **SSE-02**: If the spike says yes: SSE replaces polling with Postgres `LISTEN/NOTIFY` fan-out across replicas, `useLiveData`'s public return shape preserved, reconnect-and-catch-up contract, verified on staging. If the spike says no: #298 closed with the findings

## v2 Requirements

None deferred — everything tracked is in v1 by decision. Follow-ups that emerge get new GitHub issues.

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| #481 / #484 / #487 / #477 prediction follow-ups | Gated on the game reaching ~S165–S172+; stay open and parked in Engineering Health by decision |
| `npm audit fix --force` for `deepmerge-ts` | Would downgrade Prisma 7 → 6.12; wait for an upstream non-breaking fix |
| Closing milestone #17 Engineering Health | Permanent catch-all by decision |
| Real 3D / three.js map | Replaced by the CSS 3D tilt effect (MAP-01) |
| Native iOS app, standalone reviews system, Discord bot in this milestone | Closed with reasons (ICE-01…03) |
| Loadout build optimizer / damage simulator | HD1's ~90-item pool doesn't justify it; curated guides cover the need |
| Server-stored loadout database / discovery pages | Hash-in-URL is the design; no moderation surface |
| Real-time collaborative squad editing | Async share-a-link only (#350 spec) |
| Estimating or backfilling missing historical telemetry | Fabricated history; hide-when-empty policy forecloses it |
| Full CMS for admin announcements | #238 is a compose-and-send form |
| New player-facing features without a GitHub issue | The backlog is the scope; ideas get an issue first |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| STAB-01 | Phase 1 | Pending |
| STAB-02 | Phase 1 | Pending |
| STAB-03 | Phase 1 | Pending |
| STAB-04 | Phase 1 | Pending |
| STAB-05 | Phase 1 | Complete |
| STAB-06 | Phase 1 | Pending |
| STAB-07 | Phase 1 | Pending |
| DOCS-01 | Phase 2 | Pending |
| DOCS-02 | Phase 2 | Pending |
| HOUSE-03 | Phase 2 | Pending |
| HOUSE-04 | Phase 2 | Pending |
| HOUSE-05 | Phase 2 | Pending |
| HOUSE-01 | Phase 3 | Pending |
| DEPS-01 | Phase 4 | Pending |
| DEPS-02 | Phase 4 | Pending |
| DEPS-03 | Phase 4 | Pending |
| DEPS-04 | Phase 4 | Pending |
| DEPS-05 | Phase 4 | Pending |
| DEPS-06 | Phase 4 | Pending |
| SEO-01 | Phase 5 | Pending |
| SEO-02 | Phase 5 | Pending |
| SEO-03 | Phase 5 | Pending |
| SEO-04 | Phase 5 | Pending |
| SEO-05 | Phase 5 | Pending |
| SEO-06 | Phase 5 | Pending |
| SEO-07 | Phase 5 | Pending |
| SEO-08 | Phase 5 | Pending |
| SEO-09 | Phase 5 | Pending |
| SEO-10 | Phase 5 | Pending |
| HOUSE-02 | Phase 5 | Pending |
| ICE-01 | Phase 6 | Pending |
| ICE-02 | Phase 6 | Pending |
| ICE-03 | Phase 6 | Pending |
| ICE-04 | Phase 6 | Pending |
| ICE-05 | Phase 6 | Pending |
| LOAD-01 | Phase 7 | Pending |
| LOAD-02 | Phase 7 | Pending |
| LOAD-03 | Phase 7 | Pending |
| LOAD-04 | Phase 8 | Pending |
| LOAD-05 | Phase 8 | Pending |
| LOAD-09 | Phase 8 | Pending |
| LOAD-10 | Phase 8 | Pending |
| LOAD-06 | Phase 9 | Pending |
| LOAD-07 | Phase 9 | Pending |
| LOAD-08 | Phase 9 | Pending |
| LOAD-11 | Phase 9 | Pending |
| LOAD-12 | Phase 9 | Pending |
| ARCH-01 | Phase 10 | Pending |
| ARCH-02 | Phase 11 | Pending |
| ARCH-03 | Phase 11 | Pending |
| ARCH-04 | Phase 11 | Pending |
| ARCH-05 | Phase 11 | Pending |
| ARCH-06 | Phase 12 | Pending |
| ARCH-07 | Phase 12 | Pending |
| ARCH-08 | Phase 12 | Pending |
| ARCH-09 | Phase 12 | Pending |
| ARCH-10 | Phase 12 | Pending |
| A11Y-01 | Phase 13 | Pending |
| A11Y-02 | Phase 13 | Pending |
| A11Y-03 | Phase 13 | Pending |
| A11Y-04 | Phase 13 | Pending |
| A11Y-05 | Phase 13 | Pending |
| SITE-01 | Phase 14 | Pending |
| SITE-02 | Phase 14 | Pending |
| SITE-03 | Phase 14 | Pending |
| SITE-04 | Phase 14 | Pending |
| MAP-01 | Phase 15 | Pending |
| MAP-02 | Phase 15 | Pending |
| MAP-03 | Phase 15 | Pending |
| MAP-04 | Phase 15 | Pending |
| ICE-06 | Phase 15 | Pending |
| ICE-07 | Phase 15 | Pending |
| STAGE-01 | Phase 16 | Pending |
| STAGE-02 | Phase 16 | Pending |
| STAGE-03 | Phase 16 | Pending |
| STAGE-04 | Phase 16 | Pending |
| SSE-01 | Phase 17 | Pending |
| SSE-02 | Phase 17 | Pending |
| DOCS-03 | Phase 18 | Pending |

**Coverage:**

- v1 requirements: 79 total
- Mapped to phases: 79
- Unmapped: 0 ✓

---
*Requirements defined: 2026-08-28*
*Last updated: 2026-08-29 after roadmap revision (18 phases, full coverage — SEO & Analytics Foundation inserted as Phase 5, HOUSE-02 absorbed into it)*
