# Codebase Concerns

**Analysis Date:** 2026-08-28

## Known Bugs (open GitHub issues)

**React #418 hydration mismatch on `/` — #496 (bug, frontend):**
- Symptoms: single largest production error in GlitchTip (~266 events).
- Likely surface: `src/app/page.jsx` / `src/features/dashboard/DashboardClient.jsx` — any server-rendered value that differs between SSR and first client render (timestamps, `Date.now()`, random IDs, locale-dependent formatting) is a hydration mismatch candidate. `formatTimeAgo` (`src/shared/utils/format/formatTimeAgo.mjs`) and `useLiveData` (`src/shared/hooks/useLiveData.mjs`) are the two most likely offenders since both are time-sensitive and both run on the dashboard's first paint.
- Priority: highest — largest single error class in production telemetry.

**OG image 500s in production — #503 (bug):**
- Symptoms: `sharp` rejects the rasterised buffer on `/opengraph-image`.
- Files: `src/app/opengraph-image.jsx` (339 lines) — builds a `next/og` `ImageResponse` from `computeLiveMapState`, `evaluateProgress`, and hand-rolled SVG path data (`bugPaths`, `cyborgPaths`, `illuminatePaths` from `src/features/galaxy/mapPaths.mjs`, 289 lines).
- Cause hypothesis: `next/og`'s Satori→sharp pipeline is sensitive to malformed/edge-case SVG or unsupported CSS in the JSX tree; a null or edge-case map state (see #459 below) could produce a shape sharp can't rasterize.
- Impact: broken social-share previews, silent 500s not visible to end users but visible in crawlers/Slack/Discord unfurls.

**`getWarOutcome` crashes on null faction slots — #459 (bug, latent):**
- Symptoms: crash on null faction slots in snapshot data; currently unreachable via the live `getCampaign` path but reachable via raw snapshot data.
- Files: `src/shared/utils/game/getWarOutcome.mjs:38`, consumed by `src/features/archives/buildWarNarrative.mjs:377` and `src/features/ministry/warTone.mjs`.
- Risk: archive/narrative pages read historical snapshots directly (not through `getCampaign`'s guards), so a season with an unusual snapshot shape could 500 an archive page. Same shape of bug as the `defend_event`/`attack_events` lagged-slot handling CLAUDE.md calls out — faction slot data has multiple call paths with inconsistent null-guarding.

**Notification toggle invisible in production — #485 (bug, frontend):**
- Symptoms: component stuck in `'loading'` state, never renders visible UI.
- Files: `src/features/notifications/NotificationToggle.jsx` — `useState('loading')` (line 51) with `useEffect`-driven state transitions to `unsupported | denied | enabled | disabled`; line 80 `if (state === 'loading') return null` means any effect that fails to resolve (permission API missing, `serviceWorker.ready` never resolving, an unhandled promise rejection in the effect) renders nothing with no fallback/error state or timeout.
- Fix approach: the `'loading'` branch has no escape hatch on effect failure — needs a caught-error state or timeout, not just success/failure branches on the happy path.

**Space Mono never loads — #476 (bug, frontend):**
- Symptoms: `--font-mono` falls back to a system mono font site-wide.
- Files: font loading is configured in `src/app/layout.jsx` (325 lines) and the CSS custom property lives in the `@theme` block, `src/app/layout.css`. Likely a `next/font` config/self-hosting mismatch (missing `variable` wiring, wrong `display` strategy, or the fallback font stack matching too closely to be visually diagnosable without DevTools).
- Impact: cosmetic only, but the design system explicitly calls out `--font-mono` (Space Mono) as a first-class token in CLAUDE.md — the token is silently unfulfilled.

## Architecture vs. Documentation Drift

**Worker poller state: CLAUDE.md describes module-level state that code no longer has (#517 landed after this doc's architecture section was last written):**
- CLAUDE.md's Architecture section says: *"`src/app/api/h1/update/route.js` tracks the season from the previous poll in module-level state (`lastSeasonObserved`)... module state resets on worker restart (the only edge case being a restart during the tiny transition window, recoverable via the admin refresh button)."*
- Actual code (as of `2c4a5d29`/`c69af9b4`/`b5788406`, merged into `develop` per recent history): that state has moved into Postgres, in the `worker_heartbeat` row, via `src/update/lease.mjs`. `claimLease()` returns `{ prevEvents, lastSeasonObserved }` read from the DB row; `persistPollerState()` writes them back. `src/app/api/h1/update/route.js` no longer holds this in a module-level variable — it's lease-scoped and DB-backed specifically so a poller handover doesn't lose it (see the comment block at `src/app/api/h1/update/route.js:29-33`, which directly contradicts CLAUDE.md's older description).
- Impact: CLAUDE.md's stated edge case ("restart during the transition window" causing data loss, "recoverable via admin refresh button") is now stale — the lease design was built specifically to eliminate that edge case across restarts and multi-replica deploys. `CLAUDE.md`'s Architecture — Stack section needs a rewrite of the "Season transition closing pass" and "Worker thread" bullets to describe the lease/`worker_heartbeat` model instead of "module-level state."
- The remaining true module-level mutable state in the update path is narrower than CLAUDE.md implies: `lastRateLimitCleanup` (`src/app/api/h1/update/route.js:38`, a simple throttle timestamp, low risk) and `configured` in `src/update/pushNotifier.mjs:10` (a one-time init guard, also low risk). Neither carries cross-poll application state anymore — that's now all in `worker_heartbeat`.
- This is exactly the kind of architecture-documentation gap `/gsd-map-codebase` exists to catch; CLAUDE.md should be updated in a follow-up chore alongside or after this mapping pass.

## Tech Debt

**Seed-refresh workflow unverified end-to-end — #501 (chore, testing, infrastructure):**
- Issue: the scheduled season-close backfill path (`.github/workflows/scheduled-seed-refresh.yml`, `src/update/season.mjs`) has not been observed running through its full PR-opening path against a real season transition.
- Files: `.github/workflows/scheduled-seed-refresh.yml`, `src/update/season.mjs` (136 lines).
- Impact: unverified automation is a silent-failure risk — if it breaks, nothing alerts until someone notices archives are missing a season.
- Fix approach: issue is explicitly gated on "when season 160 ends" — needs a live season transition to validate, not something fixable in isolation today.

**Sourcemaps shipped in production image — #502 (chore, infrastructure):**
- Issue: production Docker image currently ships JS sourcemaps to support GlitchTip stack-trace symbolication.
- Impact: sourcemaps expose original source structure/paths to anyone with the built bundle; acceptable short-term trade-off but flagged for removal once GlitchTip's alternative symbolication path (upload-then-strip) is proven stable.
- Fix approach: switch to uploading sourcemaps to GlitchTip at build time and stripping them from the shipped image, per the issue.

**Test tree not co-located with source (#466, chore, testing):**
- Current state: `src/__tests__/unit/` contains 190 test files, fully mirroring the source tree per the documented convention (`src/__tests__/unit/_meta/mirrorTree.test.mjs` enforces this). Zero co-located tests exist outside `__tests__/` today (`find src -name "*.test.*" -not -path "*__tests__*"` returns none).
- Issue: the mirrored-tree convention was a deliberate choice, but #466 proposes co-locating unit tests next to their modules and shrinking `src/__tests__/` to genuinely cross-cutting tests only (contract/integration tests, `_meta` repo-level tests).
- Impact: this is a large mechanical migration (190 files) that also requires rewriting `mirrorTree.test.mjs`'s enforcement logic and the "Test Layout" section of CLAUDE.md. Any other in-flight branch that adds tests under `src/__tests__/unit/` will conflict with this migration if both land around the same time — sequence carefully.

**Large files approaching CLAUDE.md's 500-800 LOC guidance:**
CLAUDE.md sets file-size guidance at ~500–800 LOC (soft) / 1000 LOC (hard split threshold) and function size at ~100 lines (soft) / 200 lines (hard). No file in `src/` currently exceeds 500 lines by a wide margin and none approach the 1000-line hard limit, but several sit close enough to the soft threshold that the next feature addition should trigger a split rather than more growth:
- `src/shared/utils/api/openapiRegistry.mjs` — 454 lines. Registry-style file; growth is proportional to endpoint count, so it will keep growing linearly with the public API surface (`docs/api`). Consider splitting by resource/tag before it crosses 600.
- `src/features/galaxy/EventCard.jsx` — 445 lines.
- `src/app/docs/brandkit/page.jsx` — 436 lines (docs page, lower priority — not on the runtime critical path).
- `src/features/stats/StatGrid.jsx` — 408 lines.
- `src/app/legal/page.jsx` — 402 lines (static legal copy, not a maintainability risk despite size).
- `src/shared/enums/map.mjs` — 394 lines (enum data, size is inherent to the domain, not a code-smell).
- `src/features/archives/buildWarNarrative.mjs` — 391 lines — narrative-generation logic with the highest branching complexity of the list (feeds `getWarOutcome`, per #459 above); a good candidate to split by narrative-section before the next feature (#453, phrasing variety expansion) lands on top of it.
- `src/features/dashboard/DashboardClient.jsx` — 378 lines — also the prime suspect for the #496 hydration mismatch since it's the client entry component for the dashboard's first paint.
- No individual function was found exceeding the 100-line soft limit in a repo-wide scan of `export function` / `export const ... = (...) =>` declarations (the longest, `register()` in `src/instrumentation.js`, is 94 lines) — function-level size is currently healthy across the codebase.

## Dependency & Security Posture

**`npm audit --audit-level=moderate` reports 6 vulnerabilities (2 moderate, 4 high), none with a same-semver fix:**
- `nanoid` <3.3.18 — **high** — custom generators can loop indefinitely when size is zero (GHSA-2v37-7h3g-55p8). Fixable via `npm audit fix` (non-breaking) — low-risk, should be applied promptly.
- `dompurify` <=3.4.12 — **moderate** — `IN_PLACE` hook removal leaves a detached subtree executable, causing XSS (GHSA-55q2-fjhq-7xh7). Fixable via `npm audit fix`. Worth checking where DOMPurify is used in this codebase (likely a transitive dependency of a markdown/diagram renderer) to confirm the vulnerable API path (`IN_PLACE`) isn't actually invoked.
- `mermaid` 11.0.0-alpha.1–11.16.0 — **moderate**, five separate advisories (prototype pollution ×2, CSS injection, XY-chart infinite-loop DoS, radar-diagram DoS). Directly relevant: `src/shared/components/MermaidDiagram/MermaidDiagram.jsx` (304 lines) renders Mermaid diagrams dynamically from string definitions across `/docs/architecture`, `/docs/api`, and other doc pages. Diagram definitions are currently developer-authored config objects (not user input), which limits blast radius today, but any future user-generated-diagram feature must not skip this. Fixable via `npm audit fix`.
- `deepmerge-ts` (transitive, via `@prisma/config` → `prisma`) — stack exhaustion on recursive object graphs (GHSA-ggr8-5vv4-36mx). Fix requires `npm audit fix --force`, which pulls in `prisma@6.12.0` as a breaking change — **do not** run `--force` casually; this needs its own migration pass (Prisma 7 is the documented baseline per CLAUDE.md, so downgrading to 6.12.0 to satisfy the audit would itself be a regression). Track via Dependabot instead and wait for a non-breaking upstream fix.
- Net: 3 of 4 vulnerabilities (`nanoid`, `dompurify`, `mermaid`) are safe to clear immediately with `npm audit fix`; the Prisma-chain one needs deliberate handling, not `--force`.

**Dependabot configured, CodeQL enabled:**
- `.github/dependabot.yml` covers `npm` (weekly, grouped minor/patch, capped at 10 open PRs, labeled `dependencies`/`npm`) and `github-actions` ecosystems, targeting `develop`. Reasonable baseline coverage — nothing missing here.
- `.github/workflows/check-codeql.yml` present — static analysis security scanning is wired into CI.
- `.github/workflows/check-dependencies.yml` present alongside Dependabot — worth confirming this doesn't duplicate `npm audit` work Dependabot already covers.

## Fragile Areas

**`opengraph-image.jsx` — dependency chain from live map state to sharp rasterization (#503):**
- Files: `src/app/opengraph-image.jsx` → `computeLiveMapState` (`src/shared/utils/game/computeMapState.mjs`) → `evaluateProgress` (`src/features/stats/evaluateProgress.mjs`) → hand-authored SVG path arrays in `src/features/galaxy/mapPaths.mjs`.
- Why fragile: `next/og`'s Satori-to-sharp pipeline has no documented tolerance for malformed or edge-case JSX/SVG; a shape the map-state computation hasn't been tested against (e.g., an all-null-slot season per #459, or a homeworld region 11 state with no active attack events) can silently 500 instead of degrading gracefully.
- Safe modification: any change to `computeMapState.mjs`, `evaluateProgress.mjs`, or the faction path data should be paired with a manual check of `/opengraph-image` render output (or a smoke test) before merge — there is currently no automated coverage asserting the OG image renders successfully for edge-case map states.

**Cross-season lagged event slots (documented in CLAUDE.md, worth flagging as an ongoing fragility, not just a solved problem):**
- Files: `getSeasonFromStatus` and `queryUpsertEvent` (paths not enumerated in CLAUDE.md by file, worth confirming exact location on next touch — likely under `src/update/status.mjs` given its role in `get_campaign_status` processing, 143 lines).
- Why fragile: the guard (`if (event.season !== season) skip`) is a manually-maintained invariant, not something the type system or schema enforces. Any new code path that reads `defend_event`/`attack_events` without going through the same season-filtering logic risks re-introducing the stale-season leak CLAUDE.md documents as already-fixed once.

**Notification state machine has an unguarded terminal state (#485):**
- Files: `src/features/notifications/NotificationToggle.jsx`.
- Why fragile: `useState('loading')` transitions only forward through `useEffect` on success; there is no `catch`/timeout branch, so any effect failure (permission API absent in a browser context that isn't cleanly `'unsupported'`, a hung `serviceWorker.ready` promise, a thrown error in the subscription flow) leaves the component permanently rendering `null` (line 80) with no user-visible error and no retry affordance.
- Safe modification: fixing #485 should add an explicit `error` state (not silently fold errors into `'unsupported'`) so future debugging doesn't face the same "component just doesn't render, no clue why" symptom in production.

## Missing / Deferred Coverage

**Defend-prediction analytical work is intentionally blocked, not broken (#487):**
- "Defend attempt 6: verdict-conditioned P(fail)" is blocked on ~30+ progress-tracked assaults accumulating in `h1_event_progress` — this is a data-volume gate, not a code defect. Per the user's own memory notes, this line of work has had 5 prior attempts (#472/#480/#486) with an inconclusive free-wave verdict; the mechanical counterattack pattern (assault start + 48h) already shipped. Revisit only once enough seasons have passed — do not attempt to force a verdict early with insufficient sample size.

**CrowdSec rate-limiting coverage verification shelved (#189, security, shelved):**
- Issue: "Verify CrowdSec rate limiting covers all API endpoints" is explicitly labeled `shelved`. Not urgent per current triage, but represents an unverified security control — the app has rate-limiting infrastructure (`src/shared/utils/api/rateLimit.mjs`, referenced from `src/app/api/h1/update/route.js`) whose coverage across all public API routes has not been audited end-to-end.

---

*Concerns audit: 2026-08-28*
