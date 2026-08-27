# Pitfalls Research

**Domain:** Brownfield Next.js 16 / React 19 companion web app (live-polling dashboard + public API), Docker Swarm on arm64 Raspberry Pis, GitHub-Issues-driven workflow with a hard `--no-ff` + version-bump merge discipline
**Researched:** 2026-08-28
**Confidence:** HIGH for React/Next/Recharts/CI mechanics (cross-checked against maintainer discussions and official docs); MEDIUM for the Docker Swarm/CrowdSec/self-hosted-runner combination (fewer authoritative sources combine all three); MEDIUM for URL-hash codec sizing (no single canonical spec, synthesized from browser behavior + practitioner writeups)

## Critical Pitfalls

### Pitfall 1: Fixing the hydration mismatch by hiding it instead of removing the SSR/client divergence

**What goes wrong:**
The fix for #496 gets implemented as `useEffect` + `mounted` state that renders `null` (or a skeleton) on the server and the real value on the client. This "fixes" the console error but produces a double-render flash on every page load, defeats the purpose of SSR for the dashboard's first paint (the whole point of `computeLiveMapState`/`formatTimeAgo` running server-side), and — critically — doesn't fix the mismatch for `suppressHydrationWarning`-adjacent siblings; React still discards and re-renders the surrounding subtree per React error #418's actual mechanism (client throws away server output and re-renders from that node down), so nearby SSR'd content (map state, stat grid numbers) can flicker too.

**Why it happens:**
`useEffect`-gating is the fastest pattern to reach for and it does silence the specific console error, so it looks "done" in local testing where server and client run in the same locale/timezone and the mismatch may not even reproduce locally.

**How to avoid:**
Root-cause each SSR/client divergence individually rather than blanket-gating: (1) for `formatTimeAgo`, compute relative time using a stable, timezone-independent input (server-supplied absolute timestamp) and format it identically on both sides, or explicitly defer only the *relative* portion to the client with `suppressHydrationWarning` scoped to that one text node, not a whole subtree; (2) for `useLiveData`'s first poll result, make sure the value used for SSR (server-rendered initial state) is *exactly* what the client's first render also uses before its own `useEffect`-driven poll fires — don't let the client render "fresher" data than what was sent down; (3) for any `toLocaleString`/`Intl` formatting, pin an explicit locale (e.g. `'en-US'`) on both server and client rather than relying on runtime default locale, which differs between a Node server and a browser.

**Warning signs:**
- Fix PR touches `DashboardClient.jsx` but the diff is dominated by `useState(false)` "mounted" flags and `typeof window !== 'undefined'` checks rather than value-normalization.
- GlitchTip event count for #496 drops to zero but a *new* CLS/flash-of-content complaint or a different hydration warning (different component) appears post-release.
- Local dev never reproduces the bug (server and client share timezone/locale in dev) — this is expected, not a sign the fix works; only production/GlitchTip re-verification counts, per PROJECT.md's own note ("verified against GlitchTip after release, not just locally").

**Phase to address:**
Stability/bugfix phase (Track A, #496) — must ship before any other dashboard-touching work in this milestone, since every later dashboard change (Recharts, a11y ARIA on FactionTabs/Map, notification toggle) re-renders the same first-paint tree and risks re-triggering or masking the same class of mismatch.

---

### Pitfall 2: OG image fix addresses the one reproduced edge case, not the whole Satori/sharp fragility class

**What goes wrong:**
#503 gets "fixed" by patching whatever specific null-slot or path-data shape currently 500s, without addressing that `next/og`'s Satori renderer silently ignores unsupported CSS (grid, `calc()`, CSS custom properties don't resolve) and has no tolerance for malformed SVG — so the next time `computeMapState.mjs`, `evaluateProgress.mjs`, or `mapPaths.mjs` produces a shape nobody tested (a new region state, a homeworld-only season, a null faction slot per #459), it 500s again under a different trigger.

**Why it happens:**
There is currently no automated coverage asserting `/opengraph-image` renders successfully for edge-case map states (explicitly called out in CONCERNS.md), so the fix loop is "reproduce in prod → patch → ship" rather than "enumerate the state space → test all of it." Satori's `display: flex` requirement on every element (including `<span>`) and its silent ignoring of unsupported CSS mean a change elsewhere in the JSX tree (e.g. a Tailwind class added for a different reason) can pass lint/typecheck/build and still 500 only at render time, because Satori failures aren't caught by static analysis.
Font format is a second, independent trap: Satori supports TTF/WOFF but not WOFF2, so if the OG route (or a future one) reaches for a Google Fonts URL directly, it fails at the font-parsing step with an unhelpful "Empty reply from server" style error rather than a clear font error — a different failure mode than the current #503 but the same class of "Satori pipeline has no graceful degradation."

**How to avoid:**
- Add a smoke/unit test that renders `/opengraph-image` for a small enumerated matrix of map states (all-null slots, homeworld-only, mid-campaign, season-boundary) and asserts a 200 + non-empty buffer, not just "doesn't throw" — this is the concrete gap CONCERNS.md already names.
- Wrap the `ImageResponse` construction in `tryCatch` (per the project's error-handling convention) and fall back to a static pre-rendered PNG on any render failure, so a *new* edge case degrades to a stale-but-valid image instead of a 500 — this converts an unbounded fragility into a bounded one.
- If any font is loaded for the OG image, confirm it's TTF/WOFF (not WOFF2) and fetched inside the function for edge/serverless compatibility, not at module scope.
- Check the `ImageResponse` payload (JSX + inlined SVG paths + any fonts) against the ~500KB bundle ceiling `next/og` enforces — `mapPaths.mjs` at 289 lines of hand-authored path data is a plausible contributor if it grows.

**Warning signs:**
- Fix PR's test coverage is a single new fixture matching the exact bug report shape, not a matrix.
- No `tryCatch`/fallback path added — a future 500 will look identical to this one in GlitchTip (same file, same "sharp rejects buffer" signature) even though the trigger differs.
- Any future change to `computeMapState.mjs` or `mapPaths.mjs` ships without someone manually hitting `/opengraph-image`.

**Phase to address:**
Stability/bugfix phase (Track A, #503), same phase as Pitfall 1 — but the *test matrix + fallback* work should be treated as a distinct sub-task from "make the currently-reported case stop 500ing," because the latter alone will recur.

---

### Pitfall 3: Notification toggle fix adds an error state but no timeout, leaving the original symptom reachable via a hung promise

**What goes wrong:**
#485's root cause is `useState('loading')` with no escape hatch when an effect fails to *resolve* (as opposed to explicitly rejecting) — a hung `serviceWorker.ready` promise, a permission API that exists but never settles in some browser context, or a silently swallowed rejection. A fix that only adds a `.catch()` branch handles explicit rejections but not the hang case, so the component can still get stuck in `'loading'` forever under a slightly different failure mode, and the CONCERNS.md-documented symptom ("component just doesn't render, no clue why") recurs.

**Why it happens:**
The natural first read of the bug is "missing catch block," which is necessary but not sufficient — `Promise` rejection handling doesn't help against a promise that never settles at all (e.g. a browser that reports `serviceWorker` support but whose `ready` promise never resolves due to a registration edge case).

**How to avoid:**
Add both: (1) an explicit `error` state (not folded into `'unsupported'` — CONCERNS.md flags this distinction as important for future debugging) reached via `.catch()`/`tryCatch` around every async step in the effect chain, and (2) a hard timeout (`Promise.race` against a several-second timer) that transitions to `error` with a distinguishable message ("taking too long — retry?") if nothing resolves. Render a visible retry affordance from the `error` state rather than `null`.

**Warning signs:**
- Fix PR adds a `catch` clause but no `setTimeout`/`Promise.race` — the hang path is still open.
- Manual test only covers "permission denied" and "permission granted," not "permission API present but never responds" (harder to simulate but the actual reported production symptom, per CONCERNS.md's framing that the bug is specifically about a *hang*, not just an error).
- No Umami event fires from the new `error` state — since this file is user-interactive, CLAUDE.md's tracking convention requires a `data-umami-event` / `useTrack()` call on the retry action, and its absence will get flagged in code review anyway.

**Phase to address:**
Stability/bugfix phase (Track A, #485).

---

### Pitfall 4: Font fix wires `next/font` but the CSS token (`--font-mono`) and the loader's `variable` never actually connect

**What goes wrong:**
#476 gets "fixed" by adding a `next/font/local` or `next/font/google` import for Space Mono, but the loader's generated CSS variable (e.g. `--font-space-mono` from `next/font`'s auto-generated class) doesn't get wired into the `--font-mono` custom property already declared in the Tailwind v4 `@theme` block — so the token still resolves to the fallback stack, just via a different code path than before. Since the fallback font is visually close to a generic monospace, this can pass a casual visual check.

**Why it happens:**
`next/font`'s idiomatic pattern is `className`/`variable` applied at a layout/root level, but this app's design tokens are consumed as a raw CSS custom property (`--font-mono`) referenced across components — the two systems (Next's font loader output and the project's `@theme` token convention) don't wire together automatically; someone has to explicitly set `--font-mono: var(--font-space-mono)` (or equivalent) somewhere the cascade reaches all consumers.

**How to avoid:**
After adding the `next/font` loader, verify with DevTools (per CLAUDE.md's mandatory post-CSS-change check) that `getComputedStyle(el).fontFamily` on an element using `font-mono` Tailwind utility actually resolves to "Space Mono", not the fallback — don't rely on visual inspection alone, since Space Mono and common monospace fallbacks (`ui-monospace`, `SFMono-Regular`) can look similar at a glance. Confirm the loader's `variable` option target matches exactly what `@theme` expects, and that the loader is applied at a scope (root layout `className`) that reaches every element using `font-mono`.

**Warning signs:**
- Fix PR adds the `next/font` import/config but has no corresponding edit to `layout.css`'s `@theme` block or `layout.jsx`'s root className — the two files should almost always move together for this bug.
- No DevTools `getComputedStyle` verification step is described in the PR/commit — per CLAUDE.md this is a hard requirement after any frontend/CSS change, not optional.

**Phase to address:**
Stability/bugfix phase (Track A, #476) — cosmetic, so it's fine for this to ship after #496/#503/#485 but should still land before the a11y/design-polish work in Accessibility & Design Polish (milestone #10), since that work will do broader visual review and any lingering font drift muddies the baseline.

---

### Pitfall 5: Dependabot auto-merge is designed against GitHub's defaults, not against this repo's explicit `--no-ff`-only + version-bump-per-merge rules

**What goes wrong:**
Auto-merge as GitHub implements it performs the merge itself (via the API) once required checks pass — there is no hook for "also bump `package.json` and move the CHANGELOG entry in the same commit" unless something is built to do that. Left as default GitHub auto-merge, dependency-bump PRs either (a) merge via GitHub's default merge-commit method without the version bump, silently violating the repo's own hard rule ("Version on merge to develop... Do not defer this to a separate commit or ask — it is part of the merge step"), or (b) get blocked forever because a required "version bump present" check (if one exists) never passes on a bot-authored PR that doesn't know about the convention.

Separately, GitHub Actions workflows triggered by pushes/PRs that were themselves created by `dependabot[bot]` using the default `GITHUB_TOKEN` do not trigger *further* workflows via that same token's actions (e.g., if a workflow used `GITHUB_TOKEN` to push the version-bump commit, downstream required-check workflows listening for `push`/`pull_request` won't fire off that push) — this is documented GitHub Actions behavior to prevent infinite workflow loops, not a bug, but it's a very easy trap when the auto-merge automation itself needs to trigger CI.

**Why it happens:**
Dependabot's own security model deliberately runs Dependabot PR workflows with only `contents: read` / no secrets access by default (to prevent a malicious dependency from exfiltrating secrets via CI), so any automation this repo builds around Dependabot PRs must itself run in a separate, appropriately-scoped workflow (usually a `pull_request_target`-triggered or repo-owned workflow reacting to the Dependabot PR) rather than assuming the Dependabot-triggered workflow run can do privileged things like push commits or use a PAT.

**How to avoid:**
- Do not rely on GitHub's built-in "auto-merge" checkbox alone for this repo. Build a dedicated workflow (triggered on `pull_request` with `dependabot[bot]` as actor, or on a schedule) that: waits for required checks green → performs the version bump + CHANGELOG move as a commit *on the Dependabot branch* → then merges with `--no-ff` semantics. Note GitHub's auto-merge feature itself cannot do `--no-ff` merge commits with custom content; a scripted `gh pr merge --merge` after a bot-pushed commit is closer, but the safest approach is a workflow that checks out the PR branch, does `git merge --no-ff` into `develop` locally (matching the exact human workflow), and pushes — using a PAT or GitHub App token, not the default `GITHUB_TOKEN`, because a `GITHUB_TOKEN`-authored push won't re-trigger the branch-protection-required workflows on `develop`, and because Dependabot workflows default to read-only permissions.
- Explicitly decide (per PROJECT.md's own open decision) whether to exempt Dependabot merges from the version-bump-in-the-merge-commit rule and document that exemption in CLAUDE.md, or build the automation to satisfy it — don't leave it ambiguous, since ambiguity here is exactly what causes real merges to silently violate the stated rule.
- If using a branch ruleset (not just classic branch protection) on `develop`, verify ruleset "required status checks" match by exact job/check name — renaming a CI job (e.ch., splitting a matrix, renaming `lint` → `lint-and-format`) silently orphans the old required-check name, and PRs (including Dependabot's) will show "Expected — Waiting for status to be reported" forever with no error, blocking auto-merge silently. This is a generic GitHub gotcha, not Dependabot-specific, but it's exactly the kind of thing that breaks quietly right after a CI refactor and then makes every subsequent Dependabot PR look "stuck."

**Warning signs:**
- A Dependabot PR shows all checks green in the PR UI but auto-merge never fires, with no error visible in the PR timeline — check whether the *required* check name in ruleset settings still matches; renamed jobs are the most common cause.
- A merged Dependabot PR lands on `develop` without a corresponding `package.json` version bump / CHANGELOG move — the rule was silently skipped.
- Any workflow meant to run automatically "after" a bot-authored push never fires — check whether the push used `GITHUB_TOKEN` (won't cascade) vs. a PAT/App token (will).

**Phase to address:**
Dependency posture phase (housekeeping/Active item "Steady state = Dependabot auto-merge") — should be spiked/prototyped on a low-stakes PR before being trusted for the backlog of 5 open Dependabot PRs, and the exemption-or-automation decision should be made explicit in CLAUDE.md before turning it on repo-wide.

---

### Pitfall 6: The 190-test mirrored-to-colocated migration (#466) is treated as a pure file-move, breaking `output: 'standalone'`, `.dockerignore`, and `mirrorTree.test.mjs` simultaneously

**What goes wrong:**
Moving `src/__tests__/unit/features/galaxy/Map.test.jsx` to `src/features/galaxy/Map.test.jsx` (co-located) is mechanically simple per file, but at 190 files it interacts with several things that aren't obviously test-related:
1. **`mirrorTree.test.mjs` itself enforces the *old* convention** — it must be rewritten (or replaced with a "no stray tests in `__tests__/unit`" check) in the *same* migration wave, not after, or CI fails on every PR touching a moved test during the transition.
2. **`.dockerignore` / production build globbing** — if the Docker build's `next build` (with `output: 'standalone'`) or any file-copy step in `Dockerfile.app` excludes `*.test.*` via a pattern scoped to `src/__tests__/`, co-located `*.test.jsx` files sitting directly next to production source will need a *new* exclude pattern (e.g. `**/*.test.*`) or they get bundled into the standalone output, bloating the image and potentially leaking test fixtures/mocks into production.
3. **`pageExtensions`** in `next.config.mjs` — if this project's Next config restricts `pageExtensions` to include test-adjacent extensions for any reason, or conversely if co-located test files under `src/app/**` (route segments) get picked up as accidental route files by Next's file-system router (Next only treats specific filenames as special, but a stray `page.test.jsx` sitting next to `page.jsx` needs confirming it's never treated as a route), routing could silently break for App Router segments.
4. **In-flight branches** — CONCERNS.md explicitly flags that any other branch adding tests under the old `src/__tests__/unit/` path during the migration window will conflict; this migration should be sequenced as a *blocking* first step before other test-adding feature work in this milestone, not interleaved with it.

**Why it happens:**
A mechanical rename-and-move looks low-risk because "it's just tests," so it's easy to underestimate that the *enforcement* mechanism, the *build/packaging* config, and *in-flight work* all have a dependency on the old layout, not just the test runner's file discovery.

**How to avoid:**
- Do the migration as its own sequenced, non-parallel phase (already noted in PROJECT.md: "do before feature work adds more test files").
- Before starting, grep `.dockerignore`, `Dockerfile.app`, `Dockerfile.migrate`, and `next.config.mjs` for any pattern referencing `__tests__` specifically (vs. a general `*.test.*` glob) — patterns anchored to the old directory name are the actual risk, not the test framework config.
- Rewrite `mirrorTree.test.mjs`'s enforcement logic (or its replacement) in the same commit/PR wave that starts moving files, and run the full migration in batches with `npm run test:unit` green after each batch — don't do all 190 in one commit if it can be avoided, so a bisect is possible if something breaks.
- After migration, run `npm run build` and inspect the actual `output: 'standalone'` artifact (`.next/standalone`) to confirm no `*.test.*` files made it into the traced output — this is the concrete verification step that "it built" doesn't already prove, since standalone tracing follows imports, and `.dockerignore` only governs what gets `COPY`'d into the build context, not what Next's file tracer includes.

**Warning signs:**
- Docker image size increases measurably after the migration with no corresponding source growth.
- `docker-smoke` CI job (already gating per PROJECT.md) starts failing intermittently or the standalone server throws on an unexpected file post-migration.
- A concurrently open PR's `git merge` conflicts heavily in `src/__tests__/unit/**` — sign the sequencing didn't hold.

**Phase to address:**
Housekeeping/Track A phase, sequenced **first**, before any other phase in this milestone that adds new tests (SSE, Recharts, a11y, loadout hash codec all add tests) — every one of those phases should target the *new* co-located convention if #466 lands first, or the *old* mirrored convention if it doesn't, but must not straddle both.

---

### Pitfall 7: SSE route handler returns before starting the stream, or the Response resolves fully before any bytes are flushed — silently defeating streaming even before the proxy is involved

**What goes wrong:**
Next.js route handlers wait for the handler function to fully resolve before the platform sends the `Response` — a naive implementation that does `await` on the async generator/loop *inside* the function body before constructing the `Response` will buffer the entire stream server-side and send it as one chunk (defeating SSE's purpose) or time out. This failure is invisible in local dev against a fast loopback connection and becomes visible only in production behind the reverse proxy + CrowdSec, at which point it's indistinguishable from a proxy-buffering problem — wasting debugging time on the wrong layer.

**Why it happens:**
The idiomatic pattern is to return a `new Response(stream, {...})` immediately, and start writing to the stream's controller *after* the return — this is not how a typical async function is structured, so it's an easy structural mistake, and Node's `fetch`/`Response` streaming API in a route handler doesn't fail loudly when done wrong, it just behaves like a non-streaming response.

**How to avoid:**
Verify locally with `curl --no-buffer` (not the browser, which can mask buffering) that bytes arrive incrementally, not all at once at connection close, *before* deploying and blaming the proxy. Structure the handler to construct and return the `ReadableStream`-backed `Response` synchronously, feeding it from an interval/generator that runs after the return. Set response headers explicitly: `Content-Type: text/event-stream`, `Connection: keep-alive`, `Cache-Control: no-cache, no-transform`, and `X-Accel-Buffering: no` (required for the reverse proxy specifically — Nginx-class proxies buffer by default and this header is the standard opt-out; confirm the actual reverse proxy in front of production is Nginx-class and honors this header, since Caddy has had different behavior historically).

**Warning signs:**
- `curl` against the route in dev shows one chunk at connection end, not incremental output — this is a code-level bug, not deployable-and-see.
- Production behind the proxy shows updates arriving in bursts on reconnect/timeout rather than continuously — could be proxy buffering (needs the header) *or* the app-level bug above; test the app-level behavior in isolation (direct to the Next server, bypassing the proxy) first to isolate which layer is at fault.

**Phase to address:**
SSE spike (#298), first stage — the four throwaway-spike questions in `docs/roadmap.md` § Track F should explicitly include "does a minimal SSE route stream incrementally when curl'd directly against the Next server, with no proxy in the path" as a gating sub-question before testing proxy behavior, isolating the two failure classes.

---

### Pitfall 8: SSE + CrowdSec + multi-replica web tier interact in ways a single-replica local spike won't reveal

**What goes wrong:**
This app already runs N app replicas behind a service VIP with a Postgres-backed lease for the *poller* (per the recent lease work, `2c4a5d29`/`c69af9b4`/`b5788406`), but SSE client connections are a different concern from the poller lease: an SSE connection is *sticky* to whichever replica accepted it, and if that replica restarts (deploy, OOM, Swarm rebalancing) the client's `EventSource` must reconnect and the *new* replica must be able to resume sending relevant events without the client missing anything — but nothing in this app's current lease design solves that, because the lease coordinates who polls the upstream API, not who talks to which SSE client. A spike that validates SSE against one replica proves nothing about multi-replica fan-out (does replica B know to push if the write/event originated while a client was connected to replica A? Swarm's routing mesh doesn't guarantee session affinity for a new connection after disconnect, so a naive design either needs Postgres LISTEN/NOTIFY or Redis pub/sub to fan events out to whichever replica currently holds the client, or must accept "reconnect and skip missed events" as the model).

Separately, CrowdSec's idle-timeout and per-origin HTTP/1.1 connection limits interact badly with long-lived SSE connections at scale: browsers cap concurrent HTTP/1.1 connections per origin (historically 6), so multiple SSE tabs/components to the same origin can exhaust that budget and starve other requests (regular API calls, polling) on the same origin, especially since `useLiveData` already opens its own polling connection pattern.

**Why it happens:**
SSE's mental model ("just keep a connection open and push") looks deceptively simple in a single-process/single-replica dev environment; the actual complexity is entirely in the "N replicas + a stateful proxy layer + a security appliance with its own timeout policy" combination, none of which is visible until tested against the real topology.

**How to avoid:**
Make the spike (#298) explicitly test against the staging multi-replica topology (not just `localhost`), covering: replica restart mid-connection (does the client reconnect and does it miss/duplicate events), CrowdSec idle timeout duration (does it kill idle-but-alive SSE connections that have long gaps between events — the dashboard's event stream could plausibly go minutes without a new event), and HTTP/1.1 connection budget if the browser is also polling something else on the same origin concurrently. If fan-out across replicas is needed, decide up front whether to add Postgres `LISTEN/NOTIFY` (already have Postgres, no new infra) vs. accepting a "sticky, best-effort" model where a client polls a `/last-event-id` catch-up endpoint on reconnect instead of guaranteeing zero gaps.

**Warning signs:**
- Spike is validated only against `npm run dev` or a single Docker container, never against the actual staging Swarm stack with its reverse-proxy + CrowdSec layer.
- No test covers "kill the replica the client is connected to mid-stream."
- The four throwaway-spike questions don't explicitly include CrowdSec idle-timeout behavior even though it's named as a known constraint in PROJECT.md.

**Phase to address:**
SSE spike (#298) — the whole point of gating this as a spike is to let "don't do it" be a legitimate outcome if these interactions turn out to be too costly relative to the polling approach that already works; the spike's design should therefore *specifically target* these multi-replica/proxy/CrowdSec risks rather than a happy-path single-connection demo, or the spike will falsely conclude "yes, feasible" based on an untested topology.

---

### Pitfall 9: Loadout hash codec ships without a version byte/field, so the *next* schema change breaks every link already shared

**What goes wrong:**
PROJECT.md already flags this as a named risk ("Hash codec (#341) designed for squad mode from day one... a second format later would break every link in the wild") — the generic version of the mistake is encoding the loadout state directly (e.g., a bare JSON-to-base64 of the current shape) without a leading version discriminator, so when a field is added/renamed/removed in a later phase (a near-certainty for a "table stakes → differentiators" feature like this), there is no way to distinguish an old-format hash from a new one, and decoding either throws on old links or silently produces wrong loadouts.

**Why it happens:**
Version-prefixing a compact format feels like premature complexity for a "just ship the MVP" mentality, especially when the format is small and the team controls both encoder and decoder — but shared URLs are the one artifact this team doesn't control after the fact (they live in Discord messages, bookmarks, etc.), so "we'll migrate it later" isn't actually available as an option the way it is for a database column.

**How to avoid:**
Reserve the first byte/char (or a short fixed prefix) of the encoded string as a format version from the very first shipped version, even though only one version exists at launch. Decoders should switch on the version byte and either decode with the matching schema or fail gracefully (redirect to an empty builder with a toast, not a crash) for an unrecognized version — this also covers hostile/malformed input from someone hand-editing the URL. Since PROJECT.md already commits to designing the codec "for squad mode from day one" (i.e., must hold 4 loadouts at launch, not 1, to avoid a *structural* breaking change later), the version byte covers the *field-level* changes that squad-mode-day-one won't: adding a new loadout slot type, changing how a stratagem is encoded, etc.

**Warning signs:**
- The codec's encode/decode functions have no `version` concept anywhere in their signature or output format.
- A schema change to the loadout data model (new gear category, new stat) is proposed as a phase and nobody asks "what happens to already-shared links."
- No test exercises "decode a hash produced by an earlier, differently-shaped encoder" — this test is only possible to write *after* the fact unless the version scheme exists from day one and a "v1 golden fixture" is committed alongside the codec's initial implementation specifically so v2's decoder can be tested against it later.

**Phase to address:**
Loadout Builder milestone (#19), hash codec phase (#341) specifically — this is the one piece of this milestone that is expensive to retrofit later (every other part of the feature can be iterated on freely), so it should be the most conservatively designed piece even though it looks like the "easy" phase.

---

### Pitfall 10: URL hash vs. query-string choice made without accounting for SSR/OG needing server-side access to the encoded state

**What goes wrong:**
The URL fragment (`#...`) is never sent to the server — it's purely client-side, invisible to any server component, route handler, or `generateMetadata`/`opengraph-image` function. If the loadout hash is stored in `location.hash` (a natural choice since it doesn't trigger a server round-trip and keeps URLs "clean" from a routing perspective), then SSR of the loadout page (initial paint showing the right loadout server-rendered) and a dynamic OG image reflecting the shared loadout (a very plausible want — "share your loadout" cards) are both structurally impossible without a client-side re-render after hydration, which reintroduces a flash-of-wrong-content pattern similar to Pitfall 1.

**Why it happens:**
"Hash" and "query string" are often treated as interchangeable "URL state" options during design, when they have fundamentally different reachability: query strings are visible to the server on the very first request; hash fragments are not, ever, by design (a legacy privacy/history mechanism, not just a styling choice).

**How to avoid:**
Decide this explicitly and early, driven by what OG/SSR needs: if a shared loadout must render server-side (for SSR correctness and for a per-loadout OG image), the encoded state must be a **query parameter or path segment**, not a hash fragment — accept the (cosmetically) longer/uglier URL. Reserve the hash fragment only for state that's genuinely client-only and never needs SSR (e.g., which tab is active in a client-only view). If the visual preference for a hash-style URL is strong, it can still work but only with an explicit tradeoff decision documented: OG image reflects a generic "build your own loadout" card, not a live snapshot of the shared build, and the page shows a loading state before the real loadout renders — pick this consciously up front, don't discover the limitation mid-build when the OG ticket (#347/#348) starts.

**Warning signs:**
- The hash codec (#341) is designed and merged before the OG/nav integration ticket (#347/#348) is scoped — the encoding choice should be made *with* the OG requirement in view, not after, since retrofitting from hash to query changes the URL format users are already sharing (compounding Pitfall 9).
- Any design note that says "loadout state lives in the hash" without an accompanying answer to "how does the OG image for a shared loadout get generated."

**Phase to address:**
Loadout Builder milestone (#19), during hash codec (#341) design — cross-reference against OG/nav (#347/#348) requirements *before* finalizing the encoding location (hash vs. query), even though #347/#348 is sequenced later; the encoding location is a decision #341 must get right the first time.

---

### Pitfall 11: Recharts + React Compiler in production silently breaks `ResponsiveContainer`'s internal chart-type detection

**What goes wrong:**
There is a documented, specific interaction bug: `ComposedChart`'s `displayName` evaluates to `"Component"` instead of `"CategoricalChart"` in a React-Compiler-enabled production build (vs. development, where it evaluates correctly), which causes Recharts' internal `isChart` check inside `ResponsiveContainer` to evaluate false — so a chart that renders correctly in `next dev` (and even in a non-compiled production build) can render as an empty container in the actual production build with the compiler enabled, which is exactly this project's configuration (React Compiler is "enabled experimentally in `next.config.mjs`," per CLAUDE.md). This is the single most concrete, version-specific landmine identified for this milestone's Recharts work: it will not show up in dev testing, and it will not show up in a quick manual "does the chart render" check unless that check is against an actual production build (`npm run build && npm run start`), not the dev server.

**Why it happens:**
React Compiler's memoization transform can affect how component `displayName`/identity metadata comes through minification differently than a standard Babel/SWC production build, and Recharts' internal type-detection logic (used to decide whether a child of `ResponsiveContainer` is a chart it needs to measure/size) relies on that metadata rather than a more robust mechanism (e.g., a Symbol tag or context). This is a known upstream Recharts GitHub issue, not something fixable in application code beyond working around it.

**How to avoid:**
Test every new Recharts component against an actual production build locally (`npm run build && npm run start`, not `npm run dev`) before considering it done — this is the only environment that reproduces the bug. If it reproduces, the workaround is typically to avoid relying on Recharts' auto-detection by giving `ResponsiveContainer` an explicit fixed-size fallback (e.g., wrapping with an explicit width/height container and disabling `ResponsiveContainer`'s aspect-detection magic, or pinning to a specific Recharts patch version known to not have display-name-dependent detection) — check the installed Recharts version against the linked upstream issue for whether it's fixed there before architecting around it. Given the "hide when empty" pattern already established for telemetry-backed components (per PROJECT.md's constraint that `h1_statistic` only covers seasons 157+), an empty-looking chart could be misdiagnosed as "correctly hiding due to no data" rather than "broken by the compiler" — make sure the empty-state and broken-render paths are visually/structurally distinguishable (e.g., a broken render literally shows nothing including no "empty" messaging, while the intentional hidden-when-empty pattern should always show *something*, even if it's a "no data yet" message) so this bug doesn't get silently absorbed into the existing hide-when-empty convention.

**Warning signs:**
- A Recharts chart works in `npm run dev` and in code review (visual screenshot from dev) but is reported as "not showing" in staging/production.
- The chart component's "isn't rendering" symptom is indistinguishable at first glance from the intentional "hidden because season has no telemetry" behavior already used elsewhere in the app — conflating the two delays diagnosis.
- Nobody on the milestone actually ran `npm run build && npm run start` locally against the new chart before merging.

**Phase to address:**
Archive Analytics milestone (#16) phases that introduce new Recharts usage (Core Analytics #179, Storytelling #180, War Playback #270) — each phase's "done" checklist should explicitly include a production-build render check, not just dev-server + unit test.

---

### Pitfall 12: SSR-related Recharts limitations get "fixed" by disabling SSR broadly, reintroducing a hydration mismatch of exactly the Pitfall-1 flavor

**What goes wrong:**
`ResponsiveContainer` cannot know its pixel dimensions during server rendering (the container's size depends on the browser layout, which doesn't exist yet on the server) — so the straightforward instinct is to wrap the whole chart in a client-only dynamic import (`next/dynamic` with `ssr: false`). This works, but if done at too coarse a granularity (wrapping an entire analytics *section* rather than just the chart), it silently kills SSR for surrounding content that didn't need to be client-only (headings, static context, any server-fetched summary stats shown alongside the chart), hurting both the first-paint experience and, ironically, reintroducing hydration-mismatch risk at the boundary if the dynamically-imported component's parent renders differently before/after the import resolves.

**Why it happens:**
`ssr: false` is the fastest way to make "SSR doesn't work with ResponsiveContainer" go away, and it's technically correct for the chart itself — the mistake is scope creep, wrapping more of the tree than strictly necessary because it's easier than carefully isolating just the measurement-dependent piece.

**How to avoid:**
Scope `dynamic(..., { ssr: false })` to the smallest possible unit — ideally just the `<ResponsiveContainer>` + its children, with a fixed-size skeleton/placeholder as the loading state so layout doesn't shift, not the whole analytics card or section. Keep any server-fetched data (season stats, labels, headings) as regular SSR'd props passed into the client-only chart component, rather than re-fetching client-side inside the dynamically-imported component — this preserves the "hide when empty" server-side check (already an established pattern per PROJECT.md) instead of duplicating that logic on the client.

**Warning signs:**
- A whole analytics page/section becomes a single `'use client'` component with `dynamic(..., {ssr:false})` at the top, rather than isolating just the chart.
- Layout shift (CLS) is visible on page load where the chart's skeleton placeholder doesn't match the eventual chart's dimensions.

**Phase to address:**
Archive Analytics milestone (#16), same phases as Pitfall 11.

---

### Pitfall 13: ARIA retrofit on FactionTabs/BottomNav/Map changes DOM structure enough to break committed visual-regression baselines, and the failure gets treated as "test is wrong" rather than "check the actual render"

**What goes wrong:**
Correct ARIA tab/nav patterns often require DOM changes beyond adding attributes — e.g., a proper ARIA tabs pattern needs `role="tablist"`/`role="tab"`/`role="tabpanel"` and typically a wrapping element structure that may not match the current markup, and visually-hidden labels (`sr-only` text) for icon-only nav items add DOM nodes that don't change visual appearance but do change the DOM the visual-regression tool captures if it's comparing more than pixels (or even just pixel-diffing, if the added text somehow affects layout/reflow at edge viewport widths). Since visual regression baselines are committed PNGs compared via Vitest browser mode (per CLAUDE.md), and this milestone explicitly asks to retrofit a11y "without regressing visual-regression baselines," the risk is that legitimate, necessary DOM/structural changes get either (a) skipped/watered down specifically to avoid touching baselines (defeating the a11y work's purpose), or (b) baseline diffs get rubber-stamp-updated (`test:visual:update`) without actually confirming the visual output is *unchanged*, just that it's the new normal — silently accepting an unintended visual regression alongside the accessibility fix.

**Why it happens:**
"Don't regress visual baselines" is easy to over-read as "don't touch markup that visual tests capture," which is in tension with doing ARIA retrofits properly, since some ARIA patterns genuinely require new wrapper elements or visually-hidden text nodes.

**How to avoid:**
Treat "baseline changed" and "visual regression" as different things: expect and accept some baseline updates from this work (new `sr-only` spans, changed wrapper structure) as long as a human visually confirms the rendered pixels are unchanged before running `test:visual:update` — never run the update command reflexively on a failing diff without first opening the diff image and confirming it's a false positive (e.g., anti-aliasing noise) vs. `sr-only` text that's supposed to be invisible but leaked visible styling. Keep a11y changes and any *simultaneous* visual polish (#124, explicitly scoped separately per PROJECT.md's "#124 design polish (scope first)") in separate commits/PRs so a baseline diff's cause is unambiguous.

**Warning signs:**
- A PR touching `FactionTabs`/`BottomNav`/Alerts/Map ARIA also updates several visual baseline PNGs, and the PR description doesn't explain *why* each one changed.
- `test:visual:update` is run as a blanket "make CI pass" step rather than reviewed diff-by-diff.
- Icon-only nav items gain `aria-label` but no test verifies the label is actually announced correctly (e.g., via an automated a11y check like `axe`, not just "attribute is present in the DOM").

**Phase to address:**
Accessibility & Design Polish milestone (#10) — ARIA patterns phase (#148), following WCAG design tokens (#42) per PROJECT.md's stated order; design polish (#124) should stay a genuinely separate, later phase so its visual changes don't get conflated with #148's structural ones.

---

### Pitfall 14: Docker Swarm arm64 builds pass CI on the self-hosted runner's native architecture but silently produce broken images if any dependency lacks an arm64 prebuilt binary

**What goes wrong:**
"Multi-arch images already built" (per PROJECT.md's constraints) suggests this is solved, but the specific risk for *this* milestone's work is native/binary dependencies introduced or upgraded incidentally — `sharp` (already implicated in #503!) is exactly the kind of package that ships architecture-specific prebuilt binaries and has historically had arm64/musl (Alpine) rough edges; if the base image is Alpine-based (`node:XX-alpine`, common for small images) and the runner or a dependency bump pulls in a `sharp` version without a matching `linux-musl-arm64` binary, the build either fails loudly (good) or, worse, falls back to a slow from-source compile on the Pi hardware that times out or silently produces a broken binary that only fails at request time — which would look identical to, and get misdiagnosed as, the existing #503 OG-image bug rather than an infra regression.

**Why it happens:**
CI running on a self-hosted runner that's presumably itself arm64 (matching the Pi target) means "the build succeeded on CI" is a *stronger* signal than it would be on an x86 CI runner cross-compiling — but this can create false confidence that *any* build success in CI implies production correctness, when the actual risk (a package with no arm64 binary at all, or a runtime-only failure) can still slip through if CI doesn't also run the smoke test / OG-image-render check against the built image.

**How to avoid:**
Ensure the `docker-smoke` CI gate (already present per PROJECT.md's CI list) specifically exercises `/opengraph-image` (a `sharp`-dependent route) and not just a health-check endpoint, so an arm64 `sharp` regression is caught in CI on the actual target architecture before deploy, not discovered in production. When bumping `sharp` or any other native-binary dependency (a plausible Dependabot PR, tying back to Pitfall 5), don't auto-merge it purely on "CI green" if CI's smoke coverage doesn't include the OG route — this is a concrete argument for keeping `sharp`-family updates out of the "safe to auto-merge" bucket, or at minimum ensuring the smoke test covers it before turning on auto-merge for that dependency group.

**Warning signs:**
- `docker-smoke` only checks a generic health/status endpoint, never a route that exercises `sharp`/`next/og`.
- A `sharp` version bump PR (Dependabot) merges with only unit-test coverage, no image-level smoke test.
- Production OG image starts 500ing again shortly after a dependency bump, with a signature that looks like #503 but wasn't preceded by any application-code change — worth checking `npm ls sharp` / the image's installed binary against what shipped before, not just re-debugging the map-state logic from scratch.

**Phase to address:**
Staging-on-Pi-swarm phase (#474) for the base validation (confirm the smoke test covers sharp/OG today), and it becomes a standing guard for Dependabot auto-merge (Pitfall 5) once that's live — the smoke-coverage-includes-sharp check should exist before, not after, auto-merge is turned on for dependency groups that could include `sharp`/`@resvg/resvg-js`/similar native packages.

---

### Pitfall 15: Self-hosted runner on a public repository accepts workflow runs triggered by external contributors' pull requests

**What goes wrong:**
This is a well-documented, severe class of mistake: self-hosted runners should almost never run workflows triggered by `pull_request` events on a public repository, because any external contributor can open a PR that modifies the workflow file itself (or just runs arbitrary code in a step) with `runs-on` pointed at the self-hosted label, executing arbitrary code on the Pi hardware with whatever access that runner has (repo secrets if misconfigured, network access to the local Swarm, disk access to other checked-out repos on the same host, and — since runners are non-ephemeral by default — persistence across subsequent jobs). Given this repo is explicitly public (helldivers.bot is public-facing and portfolio-oriented, and CONCERNS.md discusses CodeQL/Dependabot on a public repo), this is a live risk, not a hypothetical, if any workflow currently or in the future triggers on `pull_request` (rather than `pull_request_target` with careful checkout discipline, or is restricted to internal/`push`-only triggers) and runs on the self-hosted runner label.

**Why it happens:**
Self-hosted runners are typically adopted for a legitimate reason (arm64-native builds, cost, hardware access) without re-deriving the security model from scratch — the GitHub-hosted-runner assumption ("ephemeral, isolated, fine for public-repo PRs") doesn't hold once the runner is self-hosted, and this is easy to miss because the *workflow YAML* looks identical either way; only the `runs-on:` label and the runner's registration differentiate the risk.

**How to avoid:**
Audit every workflow file for `runs-on:` referencing the self-hosted label and cross-reference its trigger: workflows that build/deploy to the arm64 target should trigger only on `push` to `develop`/`main` (or manual `workflow_dispatch`) — never on `pull_request` from forks. If PR-triggered CI (lint/typecheck/test/build) needs arm64-specific validation, either run that subset on GitHub-hosted runners (accepting the arch mismatch for CI-only, non-deploy checks) or require manual "Approve and run" for workflows on PRs from non-collaborators (a repo setting: "Require approval for all outside collaborators"), and prefer ephemeral/containerized runner execution so a compromised job can't persist into the next one. This is a repo settings + workflow-trigger audit, not a one-time code fix — it should be re-checked any time a new workflow is added.

**Warning signs:**
- Any `.github/workflows/*.yml` has both `on: pull_request` (not `pull_request_target`) and `runs-on: [self-hosted, ...]` in the same job, with no "require approval for first-time contributors" setting enabled at the repo level.
- The self-hosted runner is long-lived (not spun up per-job) and shared across workflow runs without a re-image/clean step between them.

**Phase to address:**
Staging-on-Pi-swarm phase (#474) — this should be an explicit checklist item in that phase's "done" criteria (audit workflow triggers vs. `runs-on` labels), since #474 is exactly the phase introducing/hardening the self-hosted-runner-based deploy path.

---

### Pitfall 16: Cloudflare Tunnel + CrowdSec see different "real" client IPs, breaking rate-limiting and CrowdSec's own decision engine without either side erroring

**What goes wrong:**
When traffic flows Client → Cloudflare → Tunnel → reverse proxy → CrowdSec bouncer → app, the app-visible IP (and whatever IP CrowdSec's bouncer evaluates) can end up being Cloudflare's edge IP or the tunnel daemon's local address rather than the real client IP, unless `CF-Connecting-IP` (or equivalent) is explicitly trusted and propagated through every hop. If this isn't wired correctly, CrowdSec's per-IP rate limiting/ban decisions apply to the wrong IP (effectively rate-limiting "Cloudflare" as a single client, or never triggering at all because the apparent client is a rotating tunnel IP), and this app's own `rateLimit.mjs`-based limits (already flagged in CONCERNS.md as "unverified end-to-end across all API endpoints," #189) inherit the same blind spot — both layers can silently pass every request as "different client, first request" even under an actual abuse pattern.

**Why it happens:**
Cloudflare Tunnel is often adopted specifically to avoid exposing an origin IP/port, and its setup guides focus on getting traffic flowing, not on the header-forwarding chain needed for downstream IP-based logic — it's easy to get a fully working, publicly-reachable site through a tunnel while the client-IP-dependent security controls behind it are quietly non-functional.

**How to avoid:**
Explicitly trace the client-IP header through every hop for this specific topology (Cloudflare → Tunnel → reverse proxy → CrowdSec → Next.js): confirm the reverse proxy is configured to trust and forward `CF-Connecting-IP` (not just `X-Forwarded-For`, which Cloudflare also sets but which can be spoofed/appended-to by intermediate hops if not carefully validated), confirm CrowdSec's bouncer/log-parser reads the correct header for the actual client IP rather than the tunnel's local endpoint, and confirm the app's own `rateLimit.mjs` reads whichever header the trusted chain actually delivers. Test this concretely — hit a rate-limited endpoint from two different real client IPs through the full production path and confirm they're rate-limited independently, and hit it enough from one IP to confirm CrowdSec actually engages against that IP specifically (not a shared upstream IP).

**Warning signs:**
- The already-shelved issue #189 ("verify CrowdSec rate limiting covers all endpoints") stays shelved through this milestone despite Cloudflare Tunnel work landing — the Tunnel change is exactly the kind of topology shift that should un-shelve that verification, not leave it stale.
- Rate-limit testing (if any) is done by hitting the app directly (bypassing Cloudflare Tunnel) rather than through the full public path — this validates the app's logic but not the IP the app actually sees in production.

**Phase to address:**
Staging-on-Pi-swarm phase (#474), specifically the Cloudflare Tunnel sub-task — should include a concrete IP-forwarding verification step, and should be the trigger to reconsider (not necessarily un-shelve immediately, but re-evaluate) #189's shelved status given the topology is changing.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|--------------------|-----------------|------------------|
| `useEffect`-gate hydration mismatches instead of fixing value divergence (Pitfall 1) | Fast, silences console error | Flash-of-content, masks future mismatches in same subtree | Never for the dashboard's primary first-paint content; maybe acceptable for a genuinely browser-only widget with no SSR value (e.g., a client-only timezone display with no server equivalent) |
| GitHub's built-in auto-merge checkbox with no custom workflow (Pitfall 5) | Zero build effort | Silently violates the version-bump-per-merge rule, or blocks forever on required-check name drift | Never in this repo, given the explicit hard rule — only acceptable if the team formally decides to exempt Dependabot merges and documents it |
| `dynamic(..., {ssr:false})` wrapped around an entire analytics section instead of just the chart (Pitfall 12) | One-line fix for the ResponsiveContainer SSR limitation | Loses SSR for content that didn't need it, layout shift, harder to reason about hide-when-empty logic | Acceptable only for genuinely tiny/isolated chart widgets where the surrounding content truly has nothing to SSR |
| Encoding loadout state without a version prefix (Pitfall 9) | Slightly smaller/simpler hash string | Every future schema change breaks all previously-shared links, no way to detect old vs. new format | Never — the cost of adding a version byte up front is near zero |
| Skipping the arm64 production-build render check for Recharts changes (Pitfall 11) | Faster iteration using `npm run dev` only | Ships a component that renders empty in production due to the Compiler/displayName bug, discovered by users, not CI | Never for chart components; acceptable to skip for pure-text/table components with no Recharts dependency |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|-----------------|-------------------|
| `next/og` (Satori → sharp) | Assuming any valid-looking JSX/CSS renders — Satori silently ignores `grid`, `calc()`, and unresolved CSS variables rather than erroring | Stick to explicit `display: flex` on every element, avoid CSS features Satori doesn't document support for, and test render output for every meaningfully different data shape, not just the happy path |
| Recharts + React Compiler | Assuming dev-server behavior matches production compiled behavior | Always validate new/changed charts against `npm run build && npm run start`, not just `npm run dev` |
| Dependabot + branch rulesets | Assuming the Dependabot PR workflow can push commits or use secrets like a normal workflow | Dependabot-triggered workflow runs default to read-only permissions/no secrets by design; any privileged step (version bump commit, custom merge) needs a separately-triggered workflow with an explicit PAT/App token |
| Reverse proxy + SSE | Assuming default proxy config passes streaming responses through untouched | Explicitly disable buffering (`X-Accel-Buffering: no`, `proxy_buffering off` server-side) and verify with `curl --no-buffer`, not the browser |
| Cloudflare Tunnel + CrowdSec | Assuming the app/CrowdSec sees the real client IP once Cloudflare is in front | Explicitly trace and trust `CF-Connecting-IP` end-to-end through every proxy hop; verify with real distinct-IP testing, not just functional reachability |
| Self-hosted runner + public repo | Assuming a workflow file is equally safe on self-hosted vs. GitHub-hosted runners | Audit every `runs-on: [self-hosted]` job's trigger; never allow fork/external `pull_request` triggers to reach it |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|-----------------|
| SSE fan-out with no pub/sub across replicas | Clients connected to different replicas see inconsistent/missing events after any deploy or replica cycling | Decide up front: Postgres LISTEN/NOTIFY for true fan-out, or an explicit "reconnect and catch up via last-event-id" contract if sticking with per-replica delivery | As soon as there's more than one active replica behind the VIP, i.e., immediately in this app's current topology |
| Browser's per-origin HTTP/1.1 connection cap (~6) shared between SSE and polling | Regular API calls/asset loads stall while an SSE connection (or several, across tabs/components) holds a slot | Consolidate to a single SSE connection per tab if adopted, don't open one per component; consider whether polling (`useLiveData`) and SSE should coexist or SSE fully replaces polling | Multiple tabs open, or multiple independent SSE-consuming components on one page |
| Recharts re-render on every 10s live poll tick even when chart-relevant data hasn't changed | Wasted CPU on Pi-class hardware serving many concurrent dashboard viewers; potential jank on low-end client devices too | Memoize chart-input data derivation (already a React Compiler concern — verify the Compiler's auto-memoization actually applies to the specific chart-data-shaping function, since Compiler bails out on some patterns) and confirm with React DevTools Profiler that unrelated poll ticks don't re-render charts | Once any Recharts component consumes data from the same `useLiveData` poll cycle as the rest of the live dashboard |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Self-hosted runner accepting fork PR triggers on a public repo (Pitfall 15) | Arbitrary code execution on production-adjacent Pi hardware, potential secret/credential theft, lateral access to the Swarm | Audit trigger/runs-on pairing on every workflow; require approval for external contributors; never `pull_request` (only `pull_request_target` with disciplined checkout, or `push`/`workflow_dispatch`) for self-hosted jobs |
| IP-forwarding blind spot through Cloudflare Tunnel breaking CrowdSec/rate-limit accuracy (Pitfall 16) | Abuse traffic bypasses rate limiting entirely, or legitimate shared-IP users get incorrectly banned | Explicit end-to-end header-trust verification with real distinct-IP tests before considering the Tunnel migration "done" |
| Dependabot automation granted a broadly-scoped PAT/App token to work around `GITHUB_TOKEN` limitations (Pitfall 5) | Overly broad token scope on an automation triggered by (indirectly) external dependency-update content increases blast radius if the automation workflow itself has a bug | Scope the token to the minimum needed (contents:write on `develop` only, no admin/org scope); keep the version-bump-and-merge workflow's logic minimal and reviewed, since it runs with elevated privileges Dependabot's own workflow deliberately lacks |
| Sourcemaps shipped in the production image while symbolication proof is still pending (#502, already tracked) | Exposes original source structure to anyone with the built image; compounds if the image is ever pulled from a public GHCR without auth review | Already tracked in Active scope — resolve before/alongside this milestone's infra work, not deferred indefinitely |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|--------------|-------------------|
| Notification toggle fix adds an error state that's just as silent as `null` (e.g., a tiny icon change with no text) | Users still can't tell why notifications didn't enable, support burden unchanged | Explicit, readable error message + retry button, tracked via Umami so the team can see how often it fires in production |
| Loadout share links break silently for old links after a future format change (Pitfall 9) | Shared links people already posted stop working or (worse) silently show a *wrong* loadout | Version byte + graceful "this link uses an older format" fallback UI, never a hard crash or silent wrong-data render |
| ARIA retrofit changes tab/focus order without checking real keyboard navigation, only automated `axe`-style checks | Passes automated a11y audit but is still unusable via keyboard for the actual FactionTabs/BottomNav flow | Manual keyboard-only walkthrough (Tab/Shift+Tab/Arrow keys per the ARIA tabs spec) as part of `#148`'s verification, not just an automated linter pass |
| Chart appears to "correctly hide because no data" but is actually broken by the Compiler bug (Pitfall 11) | Users lose confidence that stats update, no visible error to report | Distinguish "no data yet" (explicit message) from a render failure (should never be visually silent) |

## "Looks Done But Isn't" Checklist

- [ ] **Hydration mismatch fix (#496):** Verify against GlitchTip in production after release, not just a clean local `npm run dev` session with matching server/client locale and timezone.
- [ ] **OG image fix (#503):** Verify against an enumerated matrix of map states (all-null, homeworld-only, mid-campaign, boundary), not just the one shape from the original bug report — plus a `tryCatch` fallback path exists for the *next* unenumerated shape.
- [ ] **Notification toggle fix (#485):** Verify the timeout/hang path, not just the explicit-rejection path — the reported symptom is a hang, and a `.catch()`-only fix doesn't cover that.
- [ ] **Space Mono fix (#476):** Verify with `getComputedStyle()` that `--font-mono` resolves to "Space Mono," not a visually-similar fallback that passes a glance-test.
- [ ] **Dependabot auto-merge:** Verify a real merged PR actually carries the version bump + CHANGELOG move in the merge commit — don't just verify "the PR merged."
- [ ] **Test co-location migration (#466):** Verify the `output: 'standalone'` build artifact contains zero `*.test.*` files, not just that `npm run build` exits 0.
- [ ] **SSE spike (#298):** Verify against the actual multi-replica staging topology with the real reverse proxy + CrowdSec in the path, and against a mid-stream replica restart — not a single-process localhost demo.
- [ ] **Loadout hash codec (#341):** Verify a "future format" golden-fixture decode test exists (even trivially, decoding v1 with the v1 decoder) so a real v2 later has something concrete to test backward-compatibility against.
- [ ] **Recharts charts (#179/#180/#270):** Verify against an actual `npm run build && npm run start` production run, not only `npm run dev`.
- [ ] **ARIA retrofit (#148):** Verify with an actual keyboard-only walkthrough and confirm every changed visual baseline was manually eyeballed before `test:visual:update`, not blanket-regenerated.
- [ ] **Staging Pi Swarm (#474):** Verify `docker-smoke` actually exercises `/opengraph-image` (the one `sharp`-dependent route) and that no self-hosted-runner workflow is reachable from an external PR trigger.

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|-----------------|------------------|
| Loadout hash codec ships without a version byte, discovered after links are shared (Pitfall 9) | HIGH | Add a version-sniffing heuristic to the decoder (best-effort detect "no version prefix" as implicitly v1) going forward for all *new* encodes; old links remain correctly decodable only if the heuristic is reliable — expensive and imperfect, which is exactly why prevention is cheaper here than recovery |
| Recharts silently broken in production by the Compiler bug, discovered post-release (Pitfall 11) | LOW–MEDIUM | Pin the workaround (explicit sizing instead of relying on `ResponsiveContainer` auto-detection, or a Recharts version bump once upstream fixes it) and re-deploy; low recovery cost because it's a rendering bug, not a data-integrity one |
| Dependabot auto-merge lands a PR without the version bump (Pitfall 5) | LOW | Follow-up chore commit doing the deferred version bump + CHANGELOG move immediately; annoying but not damaging since it's just process hygiene, not a functional regression |
| Self-hosted runner compromised via a malicious fork PR (Pitfall 15) | HIGH | Immediately revoke/rotate any secrets the runner had access to, re-image the runner host from a known-clean state (don't trust a "cleaned" persistent runner), audit Swarm/network for lateral movement, then fix the trigger/runs-on misconfiguration before re-enabling |
| SSE spike concludes multi-replica fan-out doesn't work cleanly (Pitfall 8) | LOW | This is a valid, cheap "no" outcome by design (per PROJECT.md's own framing) — close #298 with the documented findings and keep the existing 10s polling model; the cost is only the spike's own time, not a rollback |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|--------------------|----------------|
| Hydration mismatch masked, not fixed (1) | Stability/bugfix phase (#496) | GlitchTip event count for #496 at zero post-release, plus no new hydration warning in a different component |
| OG image fix too narrow (2) | Stability/bugfix phase (#503) | Automated test renders 200 for an enumerated map-state matrix; `tryCatch` fallback exists |
| Notification toggle hang not covered (3) | Stability/bugfix phase (#485) | Manual test of a hung-promise scenario transitions to visible `error` state within the timeout window |
| Font token never actually wired (4) | Stability/bugfix phase (#476) | `getComputedStyle()` confirms `--font-mono` resolves to Space Mono |
| Dependabot auto-merge violates merge rules (5) | Dependency posture / auto-merge phase | A real auto-merged PR's merge commit contains the version bump + CHANGELOG move |
| Test migration breaks build/Docker (6) | Housekeeping phase (#466), sequenced first | `output: 'standalone'` artifact contains no `*.test.*` files; `docker-smoke` still green |
| SSE buffering bug at the app layer (7) | SSE spike (#298), stage 1 | `curl --no-buffer` shows incremental bytes directly against the Next server, no proxy involved |
| SSE multi-replica/proxy/CrowdSec interactions untested (8) | SSE spike (#298), stage 2 | Spike explicitly tests replica restart mid-connection and CrowdSec idle timeout against staging topology |
| Loadout hash codec has no version byte (9) | Loadout Builder, hash codec phase (#341) | Codec has a version field/byte from its first commit; a golden v1 fixture exists |
| Hash vs. query chosen without OG/SSR in view (10) | Loadout Builder, hash codec phase (#341), cross-referenced against #347/#348 | Design doc for #341 explicitly answers "how does a shared loadout's OG image get generated" before merge |
| Recharts + Compiler production-only breakage (11) | Archive Analytics phases (#179/#180/#270) | Every new chart validated against `npm run build && npm run start`, not just dev |
| Overbroad `ssr:false` around Recharts (12) | Archive Analytics phases (#179/#180/#270) | `dynamic(ssr:false)` scoped to the chart only; surrounding content still SSR'd |
| ARIA retrofit vs. visual baselines (13) | Accessibility milestone, ARIA phase (#148) | Baseline diffs manually eyeballed before `test:visual:update`; keyboard-only walkthrough performed |
| arm64/sharp regression slips through CI (14) | Staging Pi Swarm phase (#474); ongoing guard for Dependabot auto-merge | `docker-smoke` exercises `/opengraph-image` specifically |
| Self-hosted runner exposed to fork PRs (15) | Staging Pi Swarm phase (#474) | Explicit audit: every `runs-on: [self-hosted]` job's trigger excludes external `pull_request` |
| Cloudflare Tunnel breaks real-IP visibility for CrowdSec/rate-limit (16) | Staging Pi Swarm phase (#474), Cloudflare Tunnel sub-task | Real distinct-IP test confirms independent rate-limiting through the full public path |

## Sources

- [React error #418 reference](https://react.dev/errors/418) — HIGH confidence, official React docs
- [toLocaleString() inconsistent behavior causing #418 — Next.js discussion #79397](https://github.com/vercel/next.js/discussions/79397) — HIGH confidence, maintainer-adjacent discussion
- [How to Debug Hydration Errors in React SSR Applications](https://oneuptime.com/blog/post/2026-01-15-debug-react-hydration-errors/view) — MEDIUM confidence, practitioner writeup, cross-checked against React docs
- [Dynamic OG Images in Next.js Without @vercel/og — WOFF2/font and bundle-size limits](https://dev.to/accreditly/dynamic-og-images-in-nextjs-without-vercelog-1200x630-30ic) — MEDIUM confidence, practitioner writeup
- [Generate Dynamic OG Images with Next.js 16 — Satori CSS limitations](https://makerkit.dev/blog/tutorials/dynamic-og-image) — MEDIUM confidence
- [Recharts React 19 issue: ResponsiveContainer + Compiler displayName bug (#5173)](https://github.com/recharts/recharts/issues/5173) — HIGH confidence, upstream maintainer issue tracker, directly names the React Compiler / production displayName mechanism
- [Recharts SSR issue — ResponsiveContainer needs client-known dimensions (#38)](https://github.com/recharts/recharts/issues/38) — HIGH confidence, upstream issue tracker
- [Automating Dependabot with GitHub Actions — GitHub official docs](https://docs.github.com/en/code-security/tutorials/secure-your-dependencies/automate-dependabot-with-actions) — HIGH confidence, official docs; source for Dependabot's restricted default permissions and merge-queue/GITHUB_TOKEN limitation
- [DevOps Interview KB — required status check stuck "Expected — Waiting"](https://devopsinterviewkb.com/questions/github/branch-protection/required-status-check-stuck-expected-forever) — MEDIUM confidence, practitioner writeup, consistent with GitHub's own troubleshooting docs
- [GitHub Docs — Troubleshooting required status checks](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/collaborating-on-repositories-with-code-quality-features/troubleshooting-required-status-checks) — HIGH confidence, official docs
- [Self-hosted runner security with public repositories — GitHub community discussion #26722](https://github.com/orgs/community/discussions/26722) — HIGH confidence, official community/support channel
- [StepSecurity — Defend Your GitHub Actions CI/CD Environment in Public Repositories](https://www.stepsecurity.io/blog/defend-your-github-actions-ci-cd-environment-in-public-repositories) — MEDIUM-HIGH confidence, specialist security vendor writeup consistent with GitHub's own guidance
- [oneuptime — How to Configure Server-Sent Events Through Nginx](https://oneuptime.com/blog/post/2025-12-16-server-sent-events-nginx/view) — MEDIUM confidence, practitioner writeup; `X-Accel-Buffering`/`proxy_buffering off` guidance is consistent across multiple independent sources found
- [Vercel/Next.js discussion #48427 — SSE don't work in Next API routes](https://github.com/vercel/next.js/discussions/48427) — HIGH confidence, maintainer-adjacent discussion; source for the "return the Response immediately, stream after" pattern
- [codegenes.net — Maximum length of URL fragments](https://www.codegenes.net/blog/maximum-length-of-url-fragments-hash/) — LOW-MEDIUM confidence, no canonical spec exists for fragment length; treat the ~2000-character practical ceiling as a rule of thumb, not a hard limit
- Project-internal sources (HIGH confidence, primary): `/Users/andrei/Developer/helldivers.bot/.planning/codebase/CONCERNS.md`, `/Users/andrei/Developer/helldivers.bot/.planning/PROJECT.md`, `/Users/andrei/Developer/helldivers.bot/CLAUDE.md`

---
*Pitfalls research for: Helldivers 1 companion app — subsequent milestone (stability fixes, Dependabot automation, test migration, SSE spike, loadout hash codec, Recharts analytics, accessibility retrofit, Docker Swarm/arm64 infra)*
*Researched: 2026-08-28*
</content>
