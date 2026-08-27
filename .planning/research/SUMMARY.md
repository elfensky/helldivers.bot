# Project Research Summary

**Project:** helldivers.bot
**Domain:** Brownfield feature milestone on a mature Next.js 16 / React 19 / Prisma 7 game-companion web app (live HD1 war dashboard, 160-season archive, public API) — six target tracks: stability bugfixes, Dependabot automation, SSE live feed, Loadout Builder, Archive Analytics, Pi Swarm staging, plus Accessibility, Site Features, and Icebox disposition
**Researched:** 2026-08-28
**Confidence:** HIGH

## Executive Summary

This milestone is almost entirely additive integration work on a codebase that already has the right shape for it: every one of the six target features attaches to exactly one or two of the six existing architectural layers (worker/lease, ingestion, data access, API, presentation, CI/config), none of them share mutable state with each other, and zero new npm runtime dependencies are required. Recharts, native Web Streams/EventSource, native btoa/atob, and GitHub-native tooling (Actions, dependabot/fetch-metadata, rulesets) cover the whole feature list. The strongest signal from research is that this is a "wire it correctly" milestone, not a "choose a library" milestone.

The recommended approach is risk-front-loaded: fix the five known production bugs first (hydration mismatch, OG 500s, notification-toggle hang, font token, null-slot crash) since every later phase re-renders the same dashboard tree; lock the Loadout Builder's hash codec early since it is the project's one true one-way door (shared URLs can't migrate, must anticipate squad shape and OG/SSR reachability from day one); and run SSE last and spike-gated, since it's the only feature touching the shared live-read path used by dashboard, notifications, PWA, and OG SSR simultaneously.

The key risks are all about half-measures: patching the symptom GlitchTip reported rather than the bug class, designing Dependabot auto-merge against GitHub's defaults instead of this repo's hard --no-ff + version-bump rule, and validating SSE/Recharts changes only in dev rather than against production builds and the real multi-replica/CrowdSec topology (two documented landmines: React Compiler breaking Recharts' ResponsiveContainer detection in production-only builds; SSE fan-out silently failing across replicas). Mitigation is consistent: test against the real target before calling a fix done, and make policy decisions explicit and written.

## Key Findings

### Recommended Stack

No new runtime dependencies. Native ReadableStream+EventSource for SSE; hand-rolled bit-packed + base64url codec for the loadout hash (no lz-string/pako — no redundancy to compress); already-installed recharts@3.10.1 for archive charts; GitHub-native dependabot/fetch-metadata@v3.1.0 + repository ruleset + `gh pr merge --auto --merge` for auto-merge. Confirmed: next/og's ImageResponse pipeline is Satori → resvg, not Satori → sharp — #503's OG bug is a Satori/CSS-subset problem, not a sharp/arm64 issue.

**Core technologies:**
- Native `ReadableStream` + `EventSource` — SSE transport for #1, zero new dependencies
- Hand-rolled bit-packed codec + base64url — loadout hash (#341), must ship a version-byte header from day one
- `recharts@3.10.1` (installed) — Archive Analytics, reusing existing Chart/ChartLoader split
- `dependabot/fetch-metadata@v3.1.0` + GitHub ruleset (first on this repo) — Dependabot PR gating
- `next/og` `ImageResponse` — fix, don't replace; #503 fix is a rasterization-catch problem

### Expected Features

**Must have:** Loadout item picker, shareable URL with no account required, read-only shared view, item stats, stratagem input codes; Archive Analytics per-season summaries, two-season comparison, graceful empty states (never zeros); WCAG contrast + ARIA patterns; admin broadcast + API dashboard hygiene.

**Should have (differentiators):** 4-player squad mode with one shareable URL (no reference implementation anywhere — budget iteration); custom OG image per shared loadout (exceeds DIM/PoB/Overframe); Momentum Tracker (works on all 160 seasons) and War Playback (no genre precedent); local-first favorites with optional account sync.

**Defer:** Build optimizer/solver, server-stored loadout database, individual player leaderboards (gated on #233 spike), full CMS for broadcasts.

### Architecture Approach

Six existing layers (worker/scheduling, lease/coordination, ingestion, data access, API, presentation); every target feature is additive to one or two with no shared mutable state across features. The one component no feature besides SSE should touch is `src/update/lease.mjs`.

**Major components:**
1. `src/update/liveNotify.mjs` + Postgres LISTEN/NOTIFY — multi-replica SSE fan-out
2. `src/features/loadout/{data/*.json, hashCodec.mjs}` — pure, DB-free catalog + versioned codec; must decide hash-vs-query placement based on OG/SSR reachability
3. `src/db/queries/get<Metric>.mjs` + Chart/ChartLoader split — extends established Archive Analytics pattern; needs new `withSeasonCache.mjs` for closed-season caching
4. `.github/workflows/dependabot-automerge.yml` + new branch ruleset on `develop` — CI-only

### Critical Pitfalls

1. Fixing hydration/OG/notification bugs by silencing the symptom instead of the bug class — root-cause value divergence and build an edge-case test matrix.
2. Dependabot auto-merge designed against GitHub defaults, not this repo's --no-ff + version-bump rule — exempt explicitly or build a privileged workflow; always pass `--merge` explicitly.
3. Loadout hash codec without a version byte, or in a hash fragment when OG/SSR need server access — both are one-way doors, must be resolved in #341 before #347/#348.
4. SSE validated only in dev/single-replica — needs curl `--no-buffer` verification and testing against real Swarm topology (LISTEN/NOTIFY fan-out or explicit reconnect-and-catch-up contract).
5. Recharts + React Compiler breaks `ResponsiveContainer` detection only in production builds — every new chart's "done" checklist needs `npm run build && npm run start`.

## Implications for Roadmap

### Phase 1: Stability bugfixes (Track A)
**Rationale:** Every later dashboard-touching phase re-renders the same first-paint tree; fix known bugs first.
**Delivers:** #496, #503, #485, #476, #459 fixed at root cause with edge-case coverage.
**Avoids:** Pitfalls 1-4.

### Phase 2: Housekeeping — test co-location + Dependabot cleanup
**Rationale:** #466's test migration must land before any phase adds more tests; must be sequenced as its own non-parallel phase.
**Delivers:** Co-located test convention, alerts/PRs backlog cleared.
**Avoids:** Pitfall 6.

### Phase 3: Dependabot auto-merge
**Rationale:** No code dependencies; establishes the first ruleset on this repo early.
**Delivers:** Ruleset, `enable-automerge` workflow, written version-bump-exemption decision.
**Avoids:** Pitfall 5.

### Phase 4: Loadout Builder — catalogs + hash codec
**Rationale:** Front-load the one true one-way door in this milestone; must resolve hash-vs-query placement against OG/SSR needs before finalizing.
**Delivers:** Static catalogs, versioned bit-packed codec supporting squad shape, v1 golden fixture.
**Avoids:** Pitfalls 9-10.

### Phase 5: Loadout Builder — page, stats, guides, favorites, nav+OG, a11y
**Rationale:** Parallelizable with Archive Analytics once codec lands (disjoint files).
**Delivers:** Builder page, stats, guides, favorites (+ optional account sync), nav+OG (#503 fix applied from day one), a11y pass.

### Phase 6: Archive Analytics — spec refresh, then Core/Storytelling/Playback
**Rationale:** Existing issues reference dead schema; refresh first. Momentum Tracker first (best reach-to-effort ratio).
**Delivers:** New query files, `withSeasonCache.mjs`, Loader/Chart components, hide-when-empty enforcement with pinned tests.
**Avoids:** Pitfalls 11-12.

### Phase 7: Accessibility & design polish
**Rationale:** WCAG tokens → ARIA → separately-scoped design polish; keep structural and visual changes in separate commits.
**Delivers:** Contrast tokens, ARIA patterns, scoped polish fixes.
**Avoids:** Pitfall 13.

### Phase 8: Site Features & Icebox disposition
**Rationale:** Independent of other tracks; verdicts largely pre-determined by research (6 close, 1 build, 1 partial, 1 close-and-respec, 1 close-with-reason, 1 spike).
**Delivers:** Admin broadcast, easter eggs, faction vernacular, all 11 Icebox issues terminal.

### Phase 9: Staging on the Pi Swarm
**Rationale:** Gated on hardware, not code; should be well along before the SSE spike tests against it.
**Delivers:** Self-hosted runner audited, Kuma banner verified, Cloudflare Tunnel IP-forwarding traced, docker-smoke covers the sharp-dependent OG route.
**Avoids:** Pitfalls 14-16.

### Phase 10: SSE spike, then conditional implementation
**Rationale:** Last, by design — highest blast radius against a shared live-read path; "don't do it" is a valid terminal outcome.
**Delivers:** Answers to the four gating questions in docs/roadmap.md § Track F; conditional implementation preserving useLiveData's public return shape.
**Avoids:** Pitfalls 7-8.

### Phase 11: Docs accuracy (full pass)
**Rationale:** Lagging indicator — describe what shipped, not what was planned.
**Delivers:** docs/**, CLAUDE.md § Architecture updated for lease model, multi-replica tier, and actual milestone outcomes.

### Phase Ordering Rationale

- Bugfixes first because every later phase re-renders shared surfaces that would otherwise compound the same failures.
- The hash codec is sequenced earliest within its track as the milestone's only one-way door.
- SSE is last because it's the only feature touching a component boundary shared by four subsystems, and its risk profile is best tested against a mature staging topology.
- Dependabot auto-merge, Archive Analytics, and most of Loadout Builder are architecturally independent and can run in parallel worktrees.
- Docs accuracy is last (aside from an early lease-drift fix) so it describes what shipped.

### Research Flags

Needs research: SSE spike (Phase 10) — multi-replica/CrowdSec interaction is MEDIUM confidence, spike is the research vehicle; Dependabot auto-merge (Phase 3) — ruleset/no-squash interaction is this research's own synthesis; Loadout squad mode (end of Phase 5) — no reference implementation exists; Staging Pi Swarm (Phase 9) — self-hosted-runner + CrowdSec + Tunnel combination is MEDIUM confidence.

Standard patterns (skip research-phase): Stability bugfixes (Phase 1) — well-documented root causes; Archive Analytics (Phase 6) — extends an established pattern with 5 precedent files; Housekeeping (Phase 2) — mechanical; Site Features & Icebox (Phase 8) — verdicts already determined.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Verified against Context7 official docs, live npm/GitHub API queries; two MEDIUM sub-areas flagged (Dependabot+ruleset interaction, arm64 sharp specifics) |
| Features | MEDIUM-HIGH | Primary source is 27 read GitHub issues (HIGH); ecosystem precedent is MEDIUM (public docs/wikis) |
| Architecture | HIGH | Grounded directly in codebase map and source files read in this pass |
| Pitfalls | HIGH for React/Next/Recharts/CI mechanics; MEDIUM for Docker Swarm/CrowdSec/self-hosted-runner combination and hash codec sizing |

**Overall confidence:** HIGH

### Gaps to Address

- Dependabot auto-merge's interaction with the --no-ff+version-bump rule has no directly-sourced precedent — resolve as an explicit written PROJECT.md decision before Phase 3.
- SSE's multi-replica/CrowdSec behavior can only be validated empirically — the Phase 10 spike itself is the research step; "don't implement" is a fully successful outcome.
- Squad-mode UX has no reference implementation anywhere in the genre — budget explicit post-launch iteration.
- Whether #503's fix has already landed on `develop` by the time the Loadout OG route starts needs a git-log check at planning time.

## Sources

### Primary (HIGH confidence)
- `/vercel/next.js`, `/recharts/recharts` (Context7)
- GitHub Issues #162, #339-#350, #179/#180/#270/#269/#462/#453/#247, #238/#392/#471/#27, #42/#148/#124, all 11 Icebox issues
- `.planning/codebase/ARCHITECTURE.md`, `STRUCTURE.md`, `.planning/PROJECT.md`, `docs/roadmap.md`, `deploy/README.md`
- `gh api repos/elfensky/helldivers.bot/rulesets` (zero rulesets confirmed)
- npm registry + GitHub API live queries (2026-08-28)

### Secondary (MEDIUM confidence)
- DIM, Path of Building, Overframe, Democracy Hub, HelldiversCompanion.com wikis/sites
- Dependabot auto-merge blog-tier guides
- Sharp/Next.js standalone-mode GitHub discussions
- nginx/Caddy SSE buffering guides, self-hosted-runner security guidance

### Tertiary (LOW confidence)
- None flagged separately.

---
*Research completed: 2026-08-28*
*Ready for roadmap: yes*
