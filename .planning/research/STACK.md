# Stack Research

**Domain:** Feature additions to an existing Next.js 16 / React 19 / Prisma 7 monolith (Dependabot automation, SSE live feed, client-side loadout builder, archive analytics charts, hydration/OG bug fixes, Raspberry Pi Swarm staging)
**Researched:** 2026-08-28
**Confidence:** HIGH (verified against Context7 official Next.js/Recharts docs, npm registry, and GitHub's own fetch-metadata repo) with two MEDIUM-confidence areas flagged below (Dependabot+ruleset interaction, arm64 sharp specifics)

## Headline recommendation: add ZERO new runtime npm dependencies

Every one of the six target features is buildable with what's already installed (`recharts`, native Web Streams, native `EventSource`, native `btoa`/`atob`) plus GitHub-native tooling (Actions, `dependabot/fetch-metadata`, branch rulesets) that lives in `.github/`, not `package.json`. This is a strong KISS signal: the roadmap should budget phases for *wiring*, not *evaluating libraries*.

The only new "dependency" of any kind is a GitHub Action pinned by SHA (`dependabot/fetch-metadata@v3`) — not an npm package.

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Web Streams API (`ReadableStream`, native to Next.js route handlers) | Next.js 16.2.12 (already installed) | SSE endpoint for feature 2 | Next's own docs (`docs/01-app/02-guides/streaming.mdx`) show `ReadableStream` + `TextEncoder` as *the* supported pattern for hand-rolled SSE in a Route Handler — no framework SSE primitive exists or is needed. `req.signal` (AbortSignal) is wired through Next's `pipeToNodeResponse` internals specifically so a client disconnect aborts the stream server-side — exactly the cleanup hook an SSE handler needs. |
| Browser `EventSource` (native) | N/A (Web API) | SSE client for feature 2 | Built into every browser back to IE non-existent-but-irrelevant; handles reconnection, `Last-Event-ID`, and the `text/event-stream` framing automatically. No client library needed — `eventsource-parser`, `sse.js` etc. exist for *non-browser* (Node) SSE clients or custom transports, neither of which applies here. |
| `dependabot/fetch-metadata@v3.1.0` (GitHub Action, not npm) | v3.1.0 (current release, verified via GitHub API) | Classify Dependabot PR update-type (patch/minor/major) inside a workflow | This is GitHub's own action, purpose-built for exactly this gate. Outputs `steps.metadata.outputs.update-type` and `dependency-group` for conditional `if:` gating — it is the standard, not "a" standard. |
| `gh pr merge --auto --merge` (GitHub CLI, already available on any Actions runner) | n/a (CLI subcommand) | Perform the actual auto-merge | `--merge` forces a merge-commit strategy explicitly, independent of what merge buttons the repo UI exposes. This is the piece that must be pinned to `--merge` (not left to default) because CLAUDE.md forbids squash/rebase/ff — see "What NOT to Use." |
| GitHub repository ruleset (`develop` branch), not a legacy branch-protection rule | n/a (GitHub platform feature) | Require the four CI checks (lint/typecheck/test:unit/build) green before any merge (human or auto) lands on `develop` | Rulesets are GitHub's current recommended mechanism (branch protection rules are the legacy API); `gh pr merge --auto` *composes with* required-status-check rulesets — the auto-merge request queues until checks pass, it does not bypass them. |
| `recharts` 3.10.1 (already installed) | 3.10.1 | Archive analytics charts (feature 4) | Already the project's chart library (`ProgressExplainer`, dashboard stat visualizations) — no reason to introduce a second charting library for archives. Recharts 3.9+ ships `matchByDataKey`/`animationMatchBy` specifically for streaming/appending timeseries so points don't jitter when the dataset grows, plus a built-in `throttleDelay`/`throttledEvents` API (default `requestAnimationFrame`) for pointer-heavy interactions over dense series. |
| `next/og` `ImageResponse` (already used for `opengraph-image.jsx`) | bundled with `next@16.2.12` | Fix, not replace, the OG image pipeline (feature 5) | Confirmed via Next's own docs: the pipeline is **Satori → resvg**, not Satori → sharp. `sharp` is unrelated to `next/og` — it only powers `next/image`'s on-demand optimizer. This reframes the #503 bug: it is not a native-binding/arch problem, it's a Satori JSX/CSS-subset problem (see Pitfalls below). |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| None (see below) | — | Loadout hash codec (feature 3) | Deliberately no library — see "What NOT to Use" and "Stack Patterns by Variant." |
| `web-push` 3.6.7 (already installed) | 3.6.7 | Not new, but relevant: if the Loadout Builder ever needs "notify me of build changes," push infra already exists | Only if favorites/account-sync grows a notification angle later — out of scope for the committed feature list, flagging for awareness only. |
| `better-auth` 1.6.25 (already installed) | 1.6.25 | Optional account sync for loadout favorites (feature 3) | Already wired (`src/auth.js`); a new Prisma table (e.g. `loadout`) keyed to the existing user/session model is additive schema work, not a new auth integration. |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| `docker buildx` multi-platform build (already in CI per PROJECT.md "multi-arch images already built") | Produce `linux/amd64` + `linux/arm64` images from one `Dockerfile.app` | Verify (don't assume) that the build stage running `npm ci` executes *per target platform* inside buildx, not once on the runner's native arch with `node_modules` copied across stages — this is the #1 cause of `sharp`/other native-binding breakage on arm64 targets. Confirm `Dockerfile.app`'s builder stage is inside the `--platform`-scoped build, not a shared cross-arch layer. |
| Self-hosted GitHub Actions runner (feature 6) | Native arm64 builds for the Pi Swarm, avoiding QEMU emulation | Register with `runs-on: [self-hosted, linux, ARM64]` (labels, not a magic keyword) matching the exact labels set at runner registration. **Security-critical**: self-hosted runners must never be reachable from `pull_request` events on forks — restrict the workflow trigger to `push`/`workflow_dispatch` on `develop`/tags, since this is otherwise a known RCE vector (arbitrary fork PR can execute code on your Pi). This repo's workflows should already be `push`-triggered for deploy, so this is a "verify," not a "build." |

## Installation

```bash
# No npm installs required for features 1-5.
# Feature 6 (self-hosted runner) is a machine-level install on the Pi, not a repo dependency:
#   Follow GitHub's own runner registration flow (Settings > Actions > Runners > New self-hosted runner)
#   and run the generated ./config.sh / ./run.sh as a systemd service (not a foreground shell).

# The one repo-level addition is a workflow file referencing a pinned Action version:
#   uses: dependabot/fetch-metadata@v3.1.0
# (or better: pin by commit SHA per your existing supply-chain posture, with the version as a comment)
```

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|--------------------------|
| Hand-rolled `ReadableStream` SSE in a Route Handler | `ai` SDK's `resumable-stream` package, or a generic SSE library (`better-sse`, `sse.js` server-side) | If the SSE endpoint needed multi-instance resumability with `Last-Event-ID` replay from a durable log (e.g. Redis stream) across the 3-replica web tier. Given this app's live payload is "latest snapshot," not an append-only event log, a client that reconnects can just re-fetch state on connect — no resumable-stream infra needed. Revisit only if the spike (#298) surfaces a hard requirement for gapless replay. |
| Custom bit-packed codec + hand-rolled base64url (`btoa`/`atob`) | `lz-string` (1.5.0, general-purpose string compression) | If loadout payloads were free-form or highly repetitive text (e.g. full JSON with long key names) rather than a handful of enum indices into static catalogs. LZ-family compression pays off on redundancy; a 4-player × ~6-slot loadout made of catalog indices has no redundancy to exploit — bit-packing already beats compressed-JSON on size and has zero decode ambiguity. |
| Custom bit-packed codec + hand-rolled base64url | Native `Uint8Array.prototype.toBase64()`/`fromBase64()` (ES2025/Baseline 2025) | Once the project's `browserslist` floor moves past ~Chrome 133/Firefox 133/Safari 18.2 (all 2025+). Today the floor is Chrome ≥109/Firefox ≥115/Safari ≥15.6 (2022-2023 vintage) — the native API predates none of those and would be an `eslint-plugin-compat` lint failure, the same class of issue that already blocks `Map.groupBy`. |
| `recharts` for archive analytics | `visx`, `nivo`, `d3` directly, `uPlot` | `uPlot` specifically is the standard answer *if* archive charts need to render tens of thousands of raw points with pan/zoom at 60fps (true virtualized rendering). Recharts renders SVG per-point and will not scale past low-thousands of points smoothly. Given 160 seasons of *bucketed* (15-min default) timeseries, per-season point counts are in the hundreds to low-thousands, not tens of thousands — well within Recharts' documented comfort zone once basic aggregation/downsampling is applied (see Pitfalls). Introducing a second charting library for one feature would violate KISS for a problem Recharts' own performance guide already solves. |
| GitHub ruleset + `gh pr merge --auto --merge` | Third-party "auto-merge bot" GitHub Apps (Mergify, Kodiak, etc.) | If the team wanted merge-queue features beyond what native GitHub offers (batch testing of stacked PRs, complex approval routing). For "minor/patch auto-merge, majors manual" this is solved natively; adding a GitHub App is unnecessary surface area and another vendor to trust with repo write access. |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|--------------|
| `gh pr merge --auto` with no explicit strategy flag, or relying on the repo's "default" merge button | GitHub's CLI/API default merge strategy is whatever the repo UI has enabled *first* in Settings > General > Pull Requests, which is easy to leave on "Allow squash merging" (GitHub's own default-enabled option) — a silent violation of the "never squash/rebase/ff" rule the moment someone runs a bare `gh pr merge` on any PR, not just Dependabot's. | Always pass `--merge` explicitly in the auto-merge workflow, **and** go to Settings > General > Pull Requests and disable "Allow squash merging" + "Allow rebase merging" at the repo level so the *only* available strategy is merge commit — this makes the rule impossible to violate by accident, not just by convention. |
| A branch ruleset with "Require linear history" enabled | This is the opposite of what this repo wants — linear history *forbids* merge commits, which is the repo's only allowed strategy. Conflating "protect develop" with "require linear history" is an easy checkbox mistake when setting up a new ruleset. | Configure the ruleset with "Require a pull request before merging" + "Require status checks to pass" only. Leave linear history off. |
| `lz-string`, `json-url`, `pako`, `js-base64`, or any compression/base64 npm package for the loadout hash | None of these problems exist at this data size: the payload is a handful of small-integer indices into closed, versioned catalogs (weapon/armor/stratagem lists that ship with the app, not user text). Adding a dependency for what is, at most, 40 lines of bit-packing + a 10-line base64url helper is the textbook "abstraction for a hypothetical future need" CLAUDE.md's KISS rule warns against. | Hand-write the codec: pack each slot as a fixed-width integer (catalog size determines bit width) into a `Uint8Array`, then `btoa(String.fromCharCode(...bytes))` with `+`/`/`/`=` swapped to `-`/`_`/stripped for URL-safety. Version the format with a 1-byte header so squad mode (4 loadouts) and any future slot additions can be read unambiguously — this is the "hold 4 loadouts from day one" requirement from PROJECT.md, satisfied by header design, not by a library. |
| A WebSocket library (`socket.io`, `ws`) for the live-data replacement | The live dashboard is one-directional (server → client) "here is the latest snapshot" data — SSE's exact use case. WebSockets add bidirectional complexity (upgrade handshake, ping/pong framing, a different reverse-proxy config surface) for a problem that doesn't need bidirectionality. It would also complicate the CrowdSec/idle-timeout survival story this milestone already flags as risky for *SSE* — WebSocket has the same proxy-timeout problem plus more. | Native `EventSource` + `ReadableStream`, as recommended above. |
| `sharp` version bump or reconfiguration as "the fix" for the #503 OG 500 | Per Next's own docs, `next/og`'s `ImageResponse` pipeline is Satori → resvg — `sharp` is not in this code path at all. Chasing a sharp/arm64 native-binding theory for this specific bug is very likely a dead end that burns a debugging session without result. | Treat #503 as a Satori/CSS-subset bug: check the OG JSX for CSS Grid (Satori supports flexbox only — this codebase's own map/dashboard layout leans on CSS Grid per ARCHITECTURE.md, and reusing Grid-based layout components inside `opengraph-image.jsx` is the most likely root cause), unsupported CSS shorthand, or a missing/absolute-positioned font fetch under the Node (not Edge) runtime. Keep the `sharp`-is-arm64-fragile knowledge for the **separate**, legitimate `next/image` optimizer concern under multi-arch Docker builds (feature 6), where it does apply. |
| Squash-merging or `gh pr merge --auto --squash`/`--rebase` for Dependabot PRs "just to keep history clean" | Directly violates CLAUDE.md's hard "never squash/rebase/ff" rule — dependency PRs are not exempt by default; any exemption must be an explicit, written decision (per PROJECT.md's Key Decisions table), not an incidental default. | `--merge` only, as above. |

## Stack Patterns by Variant

**If the SSE spike (#298) proceeds to implementation:**
- Emit a `: heartbeat\n\n` SSE comment line (or an empty named event) every 15-20s from the server-side interval inside the `ReadableStream`'s `start()`, independent of real data pushes.
- Because this is a comment (`:`-prefixed), `EventSource` ignores it as data but the reverse proxy/CrowdSec sees continuous bytes on the wire and won't treat the connection as idle — this directly targets the "surviving reverse proxy / idle timeouts" requirement.
- Set `X-Accel-Buffering: no` on the response headers regardless of which reverse proxy fronts it (nginx-compatible header, harmless if ignored elsewhere) in addition to whatever the actual proxy's own buffering-off directive is (`proxy_buffering off` for nginx, equivalent for Caddy).
- Reuse `useLiveData.mjs`'s existing module-level-singleton + `visibilitychange` + BroadcastChannel-leader patterns wholesale — swap only the transport (`EventSource` in place of `setInterval`+`fetch`); the tri-state status model, offline fallback via localStorage, and leader election for Web Notifications all carry over unchanged. This is the single biggest scope-reducer for that feature.
- For backgrounded/suspended tabs: `EventSource` connections are *not* exempt from browser tab-suspension/throttling in the same way `setInterval` isn't — keep the existing `visibilitychange`-triggered "resync on focus" logic (call a one-shot `fetch` for current state, or reconnect the `EventSource`) rather than assuming the stream silently caught up.
- For PWA offline: Serwist/service-worker fetch interception does not apply to `EventSource` (it's not a `fetch()` call) — the existing "last poll payload cached in localStorage" offline fallback stays exactly as-is and becomes the *only* offline story, which is fine since it already is today.

**If archive analytics charts hit real performance limits (unlikely per season, possible for "all 160 seasons at once" views):**
- Apply data reduction *before* Recharts ever sees the array — e.g., a server-side or `useMemo`'d LTTB-style or simple every-Nth-bucket downsample keyed to the rendered pixel width — per Recharts' own performance guide's explicit "does your chart truly need 50,000 points" guidance.
- Set `isAnimationActive={false}` on chart series once dataset size crosses a threshold (animations recompute per point on data change and are the first thing to feel janky, per Recharts' documented defaults of a 1500ms animation duration).
- Leave `throttleDelay`/`throttledEvents` at Recharts' defaults (`'raf'`, mousemove/touchmove/pointermove/scroll/wheel) unless profiling shows pointer interaction is the bottleneck — don't pre-optimize this knob.

**If Dependabot auto-merge and the version-bump/CHANGELOG rule turn out to conflict in practice:**
- The clean resolution (flag for the roadmap/planning phase, not decided here) is to **exempt** Dependabot-only merges from the per-merge version bump, and instead fold accumulated dependency bumps into the version bump of the next feature/chore merge — since bumping a patch version and rewriting CHANGELOG for every single dependency PR is itself a KISS violation (loses signal, adds commit noise) even where it's technically automatable. This must be a written Key Decision in PROJECT.md, not a silent workflow behavior, per the milestone's own framing ("or explicitly exempt deps PRs and record why").

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|------------------|-------|
| `next@16.2.12` (installed) → `next@16.3.3` (latest) | React 19.2.8, current `next.config.mjs` | Not required for any of these 6 features — flagging only because `npm run update:safe` will surface it; no SSE/OG API changed between these minor versions per Next's changelog conventions (16.2 → 16.3 is a feature/perf release, not a breaking one) but this project's own CLAUDE.md rule ("read `node_modules/next/dist/docs/` before writing Next code") still applies before bumping. |
| `recharts@3.10.1` (installed) | `matchByDataKey`/`animationMatchBy` (available since Recharts 3.9) | Already satisfied — no version bump needed for the streaming-safe animation matcher used in Alternatives/Patterns above. |
| `dependabot/fetch-metadata@v3.1.0` | GitHub-hosted and self-hosted runners alike | No interaction with this repo's Node/npm versions — it inspects PR metadata via the GitHub API, doesn't touch the checkout. |
| Self-hosted arm64 runner | Must match the `runs-on` labels used in workflow YAML *exactly* as registered | A mismatch (e.g. runner registered with label `arm64` but workflow requests `ARM64`) silently leaves the job queued forever rather than erroring — worth an explicit smoke-test job in the roadmap for feature 6. |
| `sharp` (transitive, pinned `^0.35.3` in `package.json` overrides) | Platform-specific optional binary (`@img/sharp-linux-arm64` vs `-x64`) | Relevant only to `next/image`'s optimizer, not to `next/og` (see What NOT to Use). Verify multi-arch Docker builds install per-target-platform inside `Dockerfile.app`'s builder stage rather than reusing a cross-arch `node_modules` layer. |

## Sources

- `/vercel/next.js` (Context7) — streaming.mdx, route.mdx, image-response.mdx, opengraph-image.mdx, metadata-and-og-images.mdx: confirmed `ReadableStream`-based SSE pattern, `req.signal` abort-on-disconnect plumbing, and that `ImageResponse` uses "@vercel/og, satori, and resvg" (not sharp) — HIGH confidence, official docs.
- `/recharts/recharts` (Context7) — Performance.tsx guide, `Line.tsx` defaults, `matchBy.ts`, `types.ts` (`EventThrottlingProps`) — HIGH confidence, source-of-truth repo docs/source.
- npm registry (`npm view`) — `next@16.3.3` latest, `sharp@0.35.4` latest, `lz-string@1.5.0` — HIGH confidence, live registry query, 2026-08-28.
- GitHub API (`api.github.com/repos/dependabot/fetch-metadata/releases/latest`) — `v3.1.0` — HIGH confidence, live query, 2026-08-28.
- Web search: GitHub `dependabot/fetch-metadata` issue #346, various Dependabot auto-merge guides (lethain.com, nickyt.co, statox.fr) — MEDIUM confidence (blog-tier corroboration of the fetch-metadata + `gh pr merge --auto` pattern; the specific ruleset/no-squash interaction is this research's own synthesis, not directly sourced, hence flagged MEDIUM in the body).
- Web search: sharp/Next.js standalone-mode GitHub discussions (vercel/next.js#59460, lovell/sharp#3967) — HIGH confidence for the general "sharp needs platform-matched binary in standalone/Docker" fact; MEDIUM confidence applied to this specific repo's exposure since its actual Docker build process for multi-arch was not directly inspected in this research pass.
- Web search: MDN/TC39 `Uint8Array.prototype.toBase64` Baseline 2025 status, cross-checked against this repo's own `browserslist` config (`package.json`, read directly) — HIGH confidence.
- Web search: nginx/Caddy SSE buffering and timeout guides (oneuptime.com, codetodeploy) — MEDIUM confidence (consistent across multiple independent sources but not GitHub/Next-official).
- Web search: self-hosted GitHub Actions runner arm64 security guidance (multiple sources) — HIGH confidence on the "never expose self-hosted runners to fork PRs" point; this is well-established GitHub security guidance, not a niche opinion.
- Direct codebase reads: `.planning/codebase/STACK.md`, `.planning/codebase/ARCHITECTURE.md`, `src/shared/hooks/useLiveData.mjs`, `package.json` — HIGH confidence, ground truth for what's already installed and how live-polling currently works.

---
*Stack research for: Dependabot auto-merge, SSE live feed, Loadout Builder codec, archive analytics, OG/hydration bugfixes, Pi Swarm staging*
*Researched: 2026-08-28*
