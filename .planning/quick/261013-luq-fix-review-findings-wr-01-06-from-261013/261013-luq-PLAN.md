---
phase: quick-261013-luq
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
    - src/shared/utils/umami.mjs
    - src/app/stats.js/route.js
    - src/app/recorder.js/route.js
    - next.config.mjs
    - src/__tests__/unit/app/stats.js/route.test.mjs
    - src/__tests__/unit/app/recorder.js/route.test.mjs
    - src/shared/components/AnalyticsOptOut.jsx
    - src/__tests__/unit/shared/components/AnalyticsOptOut.test.jsx
    - src/shared/components/RecorderScript.jsx
    - src/__tests__/unit/shared/components/RecorderScript.test.jsx
    - src/app/layout.jsx
    - src/app/legal/page.jsx
    - src/app/docs/infrastructure/page.mdx
    - CHANGELOG.md
autonomous: true
requirements: [WR-01, WR-02, WR-03, WR-04, WR-05, WR-06]

estimate:
    tokens: 95000
    raw_tokens: 95000
    tasks: 3
    confidence: low # estimate-calibration: factor 1, 0 samples

must_haves:
    truths:
        - A GET on /stats.js or /recorder.js that carries a session cookie makes exactly one upstream fetch, called with the URL alone (no init object), so no visitor header reaches the Umami host (WR-01)
        - /stats.js and /recorder.js answer with Content-Type application/javascript and Cache-Control public, max-age=3600; 404 when UMAMI_SITE_URL is unset; 502 when the upstream fetch fails or returns a non-OK status; 405 for non-GET methods (WR-01)
        - next.config.mjs has no rewrite for the two script paths; the /api/send, /api/record and /api/websites/:id/recorder rewrites stay, and the comment above the recorder rewrites says recorder.js calls them with credentials omit and makes no unverified claim about the recorder's authentication or X-Forwarded-For (WR-01)
        - The production build registers /stats.js and /recorder.js as dynamic route handlers (listed in app-path-routes-manifest, absent from prerender-manifest) (WR-01)
        - The recorder script is never rendered for a browser whose localStorage umami.disabled value is non-empty, or whose storage throws; without the flag it renders after mount; the server render is empty (WR-02)
        - readOptOut resolves to null, never false, when localStorage.getItem throws, so the recorder gate fails closed (WR-02)
        - When localStorage.setItem throws and getItem works, pressing the switch shows the blocked-storage message instead of the old state (WR-05)
        - /legal lists umami.disabled as browser storage, says Umami's only browser storage is the opt-out flag, says heatmaps are collected apart from recordings, says the opt-out applies per browser until its site data is cleared, names the contact route for requests, and says clearing local storage re-enables analytics (WR-03, WR-04, WR-06)
        - Every new or changed /legal sentence states only shipped behavior or a fact checked at planning time; the Citizen Rights paragraph no longer contains its hash claim (WR-06)
        - lint (0 errors, no new warnings in touched files), typecheck, test:unit and build pass; CHANGELOG.md has a Fixed section under Unreleased; package.json version stays 0.95.0
    artifacts:
        - src/shared/utils/umami.mjs
        - src/app/stats.js/route.js
        - src/app/recorder.js/route.js
        - next.config.mjs
        - src/__tests__/unit/app/stats.js/route.test.mjs
        - src/__tests__/unit/app/recorder.js/route.test.mjs
        - src/shared/components/AnalyticsOptOut.jsx
        - src/__tests__/unit/shared/components/AnalyticsOptOut.test.jsx
        - src/shared/components/RecorderScript.jsx
        - src/__tests__/unit/shared/components/RecorderScript.test.jsx
        - src/app/layout.jsx
        - src/app/legal/page.jsx
        - src/app/docs/infrastructure/page.mdx
        - CHANGELOG.md
    key_links:
        - src/app/stats.js/route.js and src/app/recorder.js/route.js GET -> proxyUmamiScript(file) in src/shared/utils/umami.mjs -> fetch(`https://${UMAMI_SITE_URL}/${file}`) with no second argument
        - next.config.mjs headers() soft-cache rule excludes stats.js and recorder.js -> the handler's own Cache-Control reaches the browser (a config header overrides a route handler header)
        - src/app/layout.jsx (server) -> RecorderScript (client) -> readOptOut exported from AnalyticsOptOut.jsx -> localStorage[OPT_OUT_KEY] <- the Umami tracker reads the same key before every send
        - AnalyticsOptOut writeOptOut returns false -> toggle sets optedOut to null -> the existing blocked-storage message renders
---

<objective>
Fix the six warnings WR-01..WR-06 from `261013-hu0-REVIEW.md` on branch `bugfix/umami-review-fixes`.

Purpose: the script rewrites send the visitor's cookies (the auth session token included) to the Umami
host. The recorder loads for visitors who opted out. A failed opt-out save is silent. The /legal text
states four things that are not true.

Output: two route handlers that serve the Umami scripts with no visitor headers. A client gate for the
recorder. An opt-out switch that reports a failed save. Corrected /legal and infrastructure docs.
CHANGELOG entries under `## Unreleased`. No version bump: the orchestrator adds it as the PR's last
commit.

Scope: 14 files, under the 15-file limit. The two `.planning/codebase/` map lines that name the old
`/stats.js` rewrite (`INTEGRATIONS.md:68`, `STACK.md:70`) are not in this plan. They are GSD context
docs, not shipped code or public docs, and the orchestrator corrects them in its own docs commit.

Task split: Task 1 is the tracer. It proves the dotted route folders (`src/app/stats.js/`) work through
lint, tests and the production build before anything depends on them. Task 2 changes the client side
(opt-out switch, recorder gate, layout). Task 3 corrects the copy and docs and runs the full gate.
</objective>

<execution_context>
@~/.claude/gsd-core/workflows/execute-plan.md
@~/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/quick/261013-hu0-finish-pr-532-umami-replay-and-prepare-t/261013-hu0-REVIEW.md
@CLAUDE.md
@src/app/api/umami/route.js
@src/__tests__/unit/app/api/umami/route.test.mjs
@src/shared/utils/umami.mjs
@src/shared/components/AnalyticsOptOut.jsx
@src/__tests__/unit/shared/components/AnalyticsOptOut.test.jsx

## Ground rules for the executor

- Work only in the worktree root `/Users/andrei/Developer/helldivers.bot/.worktrees/umami-review-fixes`. All paths below are relative to it. Never touch the main checkout.
- Run every Node tool through `mise exec --` (plain `node` on PATH is v26). Never read or create `.env*` files.
- Before each commit: run `mise exec -- npm run lint:fix`, run `git -C /Users/andrei/Developer/helldivers.bot/.worktrees/umami-review-fixes branch --show-current` and confirm `bugfix/umami-review-fixes`, then stage explicit paths only (no `git add -A`).
- Use `tryCatch`, never try/catch. Tests go at the mirrored path (`src/__tests__/unit/<same dir>/<Base>.test.*`).
- Scope is WR-01..WR-06. Do not refactor `tryCatch`. Do not merge the `ready`/`optedOut` state (IN-04). Do not change the host or `:id` pattern of the remaining rewrites (IN-01). Do not edit the CSP paragraph of the infrastructure docs (IN-05).

## Planning-time observations (verified 2026-10-13, do not re-derive)

- Next 16 docs (`node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/route.md`, "Non-UI Responses") show a dotted segment folder for a route handler (`app/rss.xml/route.js`).
- `next.config.mjs` does not enable `cacheComponents`. GET route handlers are therefore dynamic and uncached by default (`01-app/01-getting-started/15-route-handlers.md`, "Caching"; route.md version table: v15 changed the GET default from static to dynamic).
- Next's `lib/recursive-readdir.js` checks `isDirectory()` before the page-extension filter, so a folder named `stats.js` is walked as a route segment.
- `mirrorTree.test.mjs` accepts `unit/app/stats.js/route.test.mjs`: the base is `route`, and `src/app/stats.js/route.js` will exist.
- Upstream `https://umami.drunik.be/script.js` and `/recorder.js` return `content-type: application/javascript; charset=UTF-8` and `cache-control: public, max-age=86400, must-revalidate`.
- `script.js` reads storage only as `g?.getItem("umami.disabled")` (a truthy check) and never writes. `recorder.js` has no `localStorage`, `sessionStorage`, `document.cookie` or `indexedDB` reference. Both recorder fetches use `credentials:"omit"`.
- `next.config.mjs` `headers()`: no rule names `/stats.js` or `/recorder.js`, but the last rule (soft CDN cache, negative-lookahead source) matches both paths. Its own comment records that a config-level Cache-Control overrides a route handler's header (the opengraph-image entry).
- `src/sw.js` and `serwist.config.js` do not name either path. Serwist's `defaultCache` already caches same-origin `.js` files with StaleWhileRevalidate, before and after this change. No service worker change is needed.
- `.claude/CLAUDE.md` is not tracked in the worktree. `AGENTS.md` (`CLAUDE.md` links to it) and `src/app/docs/utilities/page.mdx` mention only the `/api/send` rewrite and the `/stats.js` "proxy", and both stay true. Stale rewrite wording exists only in `src/app/docs/infrastructure/page.mdx:361-363`, `.planning/codebase/INTEGRATIONS.md:68` and `.planning/codebase/STACK.md:70`. This plan changes only the first; do not edit `.planning/codebase/` (see Scope above).
- The existing `next.config.mjs` comment above the recorder rewrites (four lines, starting `// Session replay + heatmaps.`) makes two claims nobody checked: how the recorder authenticates, and that the rewrites need no forwarded-IP handling. These are the only two places the file names that token header and X-Forwarded-For.
- `readOptOut` in `AnalyticsOptOut.jsx` already returns `error ? null : data`, so it returns `null` when `getItem` throws.
- The /legal Operational Analytics sentence to change reads, in full: "It sets no cookies and writes nothing to your device — sessions are identified by a one-way hash of your IP address, browser user-agent, and hostname, which cannot be reversed and is never reused on another site."
- Baseline ESLint warnings in files this plan modifies: `src/app/layout.jsx` 1, `src/app/docs/infrastructure/page.mdx` 1, every other modified file 0.
</context>

<tasks>

<task type="tracer" tdd="true">
  <name>Task 1: Serve /stats.js and /recorder.js from route handlers that forward no visitor headers (WR-01)</name>
  <files>src/shared/utils/umami.mjs, src/app/stats.js/route.js, src/app/recorder.js/route.js, next.config.mjs, src/__tests__/unit/app/stats.js/route.test.mjs, src/__tests__/unit/app/recorder.js/route.test.mjs</files>
  <read_first>src/app/api/umami/route.js, src/__tests__/unit/app/api/umami/route.test.mjs, src/shared/utils/umami.mjs, next.config.mjs (rewrites and the last headers rule with its comment)</read_first>
  <behavior>
    - stats route: GET with an incoming `cookie: better-auth.session_token=secret` header calls fetch exactly once, with the single argument `https://analytics.example.com/script.js` (fetch.mock.calls[0] has length 1)
    - stats route: a 200 response has the upstream body, `Content-Type: application/javascript; charset=utf-8` and `Cache-Control: public, max-age=3600`
    - stats route: UMAMI_SITE_URL set to an empty string gives 404 and fetch is not called
    - stats route: a rejected fetch gives 502
    - stats route: an upstream 404 with an HTML body gives 502 (an error page is never served as a script)
    - stats route: POST gives 405
    - recorder route: GET with the same cookie calls fetch once with the single argument `https://analytics.example.com/recorder.js`, responds with the JavaScript content type, and POST gives 405
  </behavior>
  <action>
Per WR-01 (orchestrator-decided approach: route handlers, no forwarded headers, one small shared helper).

1. Write both test files first (they fail until steps 2-4 exist). Follow `src/__tests__/unit/app/api/umami/route.test.mjs`: replace `global.fetch` with `vi.fn` that resolves a `new Response(...)` in `beforeEach` and restore it in `afterEach`. Stub the host with `vi.stubEnv('UMAMI_SITE_URL', 'analytics.example.com')` in `beforeEach` and call `vi.unstubAllEnvs()` in `afterEach`. Import the route with an explicit extension: `@/app/stats.js/route.js` and `@/app/recorder.js/route.js`. Build the incoming request as a `new Request('http://localhost:3000/stats.js', ...)` with a `cookie` header and pass it to `GET`. Prove the no-header rule with two assertions together: `toHaveBeenCalledWith(<url>)` and `fetch.mock.calls[0]` has length 1. Cover every bullet in `<behavior>`.

2. In `src/shared/utils/umami.mjs` add an exported async function `proxyUmamiScript(file)` with JSDoc (`@param {string} file - Upstream file name, script.js or recorder.js.`, `@returns {Promise<Response>}`). It must:
   - Read `process.env.UMAMI_SITE_URL` inside the function, not at module top (the tests change it per test). When it is empty, return `new Response('Not Found', { status: 404 })`.
   - Call `fetch` with the URL `https://${host}/${file}` as its only argument. Do not pass an init object. This is the whole fix: Node's fetch has no cookie jar, and nothing from the visitor's request is passed on.
   - Put the fetch, an `ok` check and the body read in one `tryCatch` promise chain. On a non-OK status, throw an Error that names the file and the status. A network error, a non-OK status and a body read error then share one error path.
   - On error, call `reportError(error, { source: 'proxyUmamiScript', file, stage: 'fetch', level: 'warning' })` (import from `@/shared/utils/observability.mjs`). Then return `new Response('Bad Gateway', { status: 502 })`, as `src/app/api/umami/route.js` does.
   - On success, return `new Response(body, ...)` with headers `Content-Type: application/javascript; charset=utf-8` and `Cache-Control: public, max-age=3600`. Add a one-line comment above the return: a public cache is safe because no visitor header goes upstream, and one hour lets an Umami upgrade reach browsers within the hour. The content type is required because the global `X-Content-Type-Options: nosniff` header makes browsers refuse any other type.

3. Create `src/app/stats.js/route.js`. Add one comment line: a route handler, not a rewrite, because an external rewrite forwards every visitor header, cookies included, to the Umami host. Export `GET` as an arrow function that returns `proxyUmamiScript('script.js')`. Export `POST`, `PUT`, `DELETE`, `PATCH` and `OPTIONS` as `methodNotAllowed`, as the existing umami route does. Do not add `umamiTrackEvent`: this route serves a first-party script asset, not an API for external consumers.

4. Create `src/app/recorder.js/route.js` the same way, with `proxyUmamiScript('recorder.js')`.

5. In `next.config.mjs` `rewrites()`, delete the two rewrite objects that send the tracker script path and the recorder script path to external `.js` destinations. Keep the `/api/send`, `/api/record` and `/api/websites/:id/recorder` entries unchanged. Delete the whole four-line comment that starts `// Session replay + heatmaps.` and put this content in its place, in short lines: the two script files are served by the route handlers in `src/app/stats.js/` and `src/app/recorder.js/`, because a rewrite forwards the visitor's cookies; the remaining recorder rewrites carry no cookie, because recorder.js calls them with `credentials: "omit"`. Write nothing else in this comment: no statement about how the recorder authenticates and none about forwarded client IPs, because nobody checked either against Umami or against Next's proxy code.

6. In `next.config.mjs` `headers()`, the last rule (soft CDN cache) matches both script paths, and a config-level Cache-Control overrides the handler's header. Add `stats\\.js|recorder\\.js` to its negative-lookahead alternation, next to `sw\\.js`. Add one line to its "Excludes" comment: the two Umami script handlers set their own Cache-Control.

7. Run the Task 1 verify commands. If `.next/prerender-manifest.json` lists either path, add `export const dynamic = 'force-dynamic'` to both route files and run the build again. A prerendered handler would bake in a 404, because `UMAMI_SITE_URL` is a runtime variable. If ESLint, tsc, Vitest or `next build` rejects the dotted folders, use this fallback. Put the handlers at `src/app/api/umami/script/route.js` and `src/app/api/umami/recorder/route.js`. Point the two script rewrites at those internal paths instead of deleting them: an internal rewrite reaches the handler, and the handler drops the headers. Mirror the tests at `src/__tests__/unit/app/api/umami/script/route.test.mjs` and `.../recorder/route.test.mjs`. Change the manifest checks to the `/api/umami/...` paths, and record the fallback in the SUMMARY.

8. Commit: `fix(analytics): serve Umami scripts without forwarding visitor cookies`.
  </action>
  <verify>
    <automated>mise exec -- npx vitest run src/__tests__/unit/app/stats.js src/__tests__/unit/app/recorder.js src/__tests__/unit/app/api/umami src/__tests__/unit/shared/utils/umami.test.mjs src/__tests__/unit/_meta/mirrorTree.test.mjs && mise exec -- npx eslint --max-warnings 0 next.config.mjs src/shared/utils/umami.mjs src/app/stats.js/route.js src/app/recorder.js/route.js src/__tests__/unit/app/stats.js/route.test.mjs src/__tests__/unit/app/recorder.js/route.test.mjs && ! grep -v '^[[:space:]]*//' next.config.mjs | grep -q "source: '/stats.js'" && ! grep -v '^[[:space:]]*//' next.config.mjs | grep -q "source: '/recorder.js'" && grep -q "source: '/api/record'" next.config.mjs && grep -q 'credentials: "omit"' next.config.mjs && grep -qF 'stats\\.js|recorder\\.js' next.config.mjs && ! grep -qi 'x-forwarded-for' next.config.mjs && ! grep -qi 'x-umami-cache' next.config.mjs</automated>
    <automated>POSTGRES_URL='postgresql://ci:ci@localhost:5432/ci' UPDATE_KEY=ci-stub-key UPDATE_INTERVAL=20 mise exec -- npm run build && grep -q '"/stats.js"' .next/app-path-routes-manifest.json && grep -q '"/recorder.js"' .next/app-path-routes-manifest.json && ! grep -q '"/stats.js"' .next/prerender-manifest.json && ! grep -q '"/recorder.js"' .next/prerender-manifest.json</automated>
  </verify>
  <acceptance_criteria>
    - Both new test files pass and cover every `<behavior>` bullet; the mirror-tree meta test passes
    - `proxyUmamiScript` calls `fetch` with one argument, uses `tryCatch` (no try/catch) and reads the env inside the function
    - `next.config.mjs` has no rewrite source for the two script paths, keeps the three API rewrites, and its soft-cache rule excludes both script paths
    - The recorder-rewrite comment states only the route-handler reason and the `credentials: "omit"` fact; the file no longer names the recorder's token header or X-Forwarded-For
    - The build lists `/stats.js` and `/recorder.js` as app routes, and neither path is in the prerender manifest
  </acceptance_criteria>
  <done>A request for /stats.js or /recorder.js that carries a session cookie is served from a route handler. The handler fetches upstream with the URL alone, returns JavaScript with a one-hour public cache, returns 404 without a host and 502 on upstream failure. The build routes both paths dynamically. One commit is on the branch.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Do not load the recorder for opted-out browsers, and report a failed opt-out save (WR-02, WR-05)</name>
  <files>src/shared/components/AnalyticsOptOut.jsx, src/__tests__/unit/shared/components/AnalyticsOptOut.test.jsx, src/shared/components/RecorderScript.jsx, src/__tests__/unit/shared/components/RecorderScript.test.jsx, src/app/layout.jsx</files>
  <read_first>src/shared/components/AnalyticsOptOut.jsx, src/__tests__/unit/shared/components/AnalyticsOptOut.test.jsx, src/app/layout.jsx (lines 230-262, the Umami Script block), src/__tests__/unit/shared/components/Header/Header.test.jsx (lines 1-30, the next/script mock)</read_first>
  <behavior>
    - AnalyticsOptOut: the exported `OPT_OUT_KEY` equals `'umami.disabled'`, the key the tracker reads
    - AnalyticsOptOut: a stored value of `'true'` starts the switch opted out (any non-empty value counts, as in the tracker)
    - AnalyticsOptOut: in the existing throwing-`getItem` test, `readOptOut()` resolves to exactly `null` (`toBeNull()`, so a `false` fails the test)
    - AnalyticsOptOut: with `setItem` throwing and `getItem` returning null, pressing "Disable transponder" shows the blocks-local-storage message and no button
    - AnalyticsOptOut: the five existing tests still pass; only their key constant now comes from the component
    - RecorderScript: `renderToString` gives an empty string (server render and first client render match)
    - RecorderScript: with no flag, after mount it renders the next/script element with src `/recorder.js`, the given nonce, `data-website-id` equal to `siteId`, and strategy `afterInteractive`
    - RecorderScript: with the flag `'1'`, with `'true'`, and with a throwing `getItem`, it renders nothing
  </behavior>
  <action>
Two commits. Write each commit's tests first and see them fail.

Commit A, per WR-05 (plus the shared key the WR-02 gate needs):
1. In `AnalyticsOptOut.jsx`, rename the key constant to an exported `OPT_OUT_KEY` (same value) and update every use. Export `readOptOut`. Change its read to `Boolean(localStorage.getItem(OPT_OUT_KEY))`, because the tracker skips a send for any non-empty value (planning-time read of script.js). Keep its return statement `error ? null : data` unchanged: when `getItem` throws, `readOptOut` must return `null`, never `false`, because the RecorderScript gate in step 6 treats only `false` as "allowed". Update its JSDoc and state there that `null` means storage threw.
2. Make `writeOptOut` return `Promise<boolean>`: `true` when the write succeeded (`!error` from `tryCatch`). Replace its JSDoc sentence about the follow-up read with a statement of the return value.
3. In `toggle`, keep the result of `writeOptOut`. When it is `false`, call `setOptedOut(null)` so the existing blocked-storage message renders. When it is `true`, call `setOptedOut(await readOptOut())` as now. Add no new state, and keep every visible string as it is.
4. In the test file, import `OPT_OUT_KEY` and `readOptOut` as named imports alongside the default export and delete the local key constant. Add the three new AnalyticsOptOut cases from `<behavior>`. In the existing test "shows the blocked-storage message and no button when storage throws", add `await expect(readOptOut()).resolves.toBeNull()` after its current assertions; the global stub is still active there. For the save failure, use `vi.stubGlobal('localStorage', ...)` with an object whose `getItem` returns null, whose `setItem` throws `new Error('QuotaExceededError')`, and whose `removeItem` does nothing. Press the button with `userEvent`, then expect `findByText(/blocks local storage/)` and `queryByRole('button')` to be null.
5. Commit: `fix(analytics): tell the visitor when the opt-out cannot be saved`.

Commit B, per WR-02:
6. Create `src/shared/components/RecorderScript.jsx` with `'use client'`, as a flat file next to `AnalyticsOptOut.jsx`. Its props are `{ nonce, siteId }`. Hold `allowed` in `useState(false)`. In a `useEffect` with `[]`, `await readOptOut()` (imported from `@/shared/components/AnalyticsOptOut`) inside an async inner function, then set `allowed` to `result === false` on the awaited value. A `null` result (storage throws) therefore keeps the recorder off: the gate fails closed. Return `null` until `allowed` is true. Then return the `next/script` `Script` element with the attributes the layout passes today: `nonce`, the recorder path `/recorder.js` as its source, `data-website-id={siteId}` and strategy `afterInteractive`. Write a JSDoc with these points: recorder.js has no opt-out check of its own; the key is read after mount, so the server render and the first client render are both empty; blocked storage keeps the recorder off; a change made on the current page applies from the next full page load. Give every `@param` a description (`require-param-description` warns).
7. In `src/app/layout.jsx`, import `RecorderScript`. Replace the recorder `Script` element and its JSX comment with `<RecorderScript nonce={nonce} siteId={process.env.UMAMI_SITE_ID} />`. Add a short comment: session replay and heatmaps, served same-origin by `src/app/recorder.js/route.js`, rendered only for browsers that have not opted out, inert until they are turned on in Umami. Keep the stats `Script` element unchanged. `layout.jsx` stays a server component.
8. Rewrite the component JSDoc of `AnalyticsOptOut` to name the real mechanism, per WR-02. (a) The tracker checks `OPT_OUT_KEY` before every send and sends nothing while the key is set. (b) `RecorderScript` does not render recorder.js for an opted-out browser, because recorder.js has no check of its own. (c) A change made on the current page applies fully from the next page load: a recorder that is already running keeps its session in memory until then. (d) This key is the only value the analytics stack writes to the visitor's device. Keep the paragraph about `null`.
9. Create `src/__tests__/unit/shared/components/RecorderScript.test.jsx`. The first line is `// @vitest-environment jsdom`. Mock `next/script` as `Header.test.jsx` does: render a `<script data-testid="next-script">` that exposes `data-src`, `data-nonce`, `data-strategy` and the rest props. Cover every RecorderScript bullet in `<behavior>`. Take the key from `OPT_OUT_KEY`, not from a string literal. Before each "renders nothing" assertion, flush the effect with `await act(() => new Promise((r) => setTimeout(r, 0)))`. Then expect `screen.queryByTestId('next-script')` to be null. Clear `localStorage` in `beforeEach` and call `vi.unstubAllGlobals()` in `afterEach`.
10. Commit: `fix(analytics): do not load the recorder for opted-out browsers`.
  </action>
  <verify>
    <automated>mise exec -- npx vitest run src/__tests__/unit/shared/components/AnalyticsOptOut.test.jsx src/__tests__/unit/shared/components/RecorderScript.test.jsx src/__tests__/unit/_meta/mirrorTree.test.mjs && mise exec -- npx eslint --max-warnings 0 src/shared/components/AnalyticsOptOut.jsx src/shared/components/RecorderScript.jsx src/__tests__/unit/shared/components/AnalyticsOptOut.test.jsx src/__tests__/unit/shared/components/RecorderScript.test.jsx && mise exec -- npx eslint --max-warnings 1 src/app/layout.jsx && mise exec -- npm run typecheck && grep -q '<RecorderScript' src/app/layout.jsx && ! grep -q 'src="/recorder.js"' src/app/layout.jsx && grep -q 'export const OPT_OUT_KEY' src/shared/components/AnalyticsOptOut.jsx && ! grep -q 'whole mechanism' src/shared/components/AnalyticsOptOut.jsx</automated>
  </verify>
  <acceptance_criteria>
    - Every `<behavior>` bullet has a passing test; the five existing AnalyticsOptOut tests pass
    - `layout.jsx` renders `RecorderScript` and no longer contains the recorder `Script` element; it stays a server component
    - `RecorderScript` renders the recorder only when `readOptOut()` resolves to exactly `false`
    - `readOptOut()` resolves to `null` when `getItem` throws, and a test asserts it with `toBeNull()`
    - Both files read storage through `tryCatch` only (no try/catch); no new ESLint warnings
  </acceptance_criteria>
  <done>An opted-out browser, or a browser whose storage throws, never loads recorder.js. A failed opt-out save shows the blocked-storage message. Two commits are on the branch.</done>
</task>

<task type="auto">
  <name>Task 3: Correct the /legal analytics statements, the docs and the changelog, then run the full gate (WR-03, WR-04, WR-06)</name>
  <files>src/app/legal/page.jsx, src/app/docs/infrastructure/page.mdx, CHANGELOG.md</files>
  <read_first>src/app/legal/page.jsx (lines 155-300 and 355-415), src/app/docs/infrastructure/page.mdx (lines 355-368), CHANGELOG.md (lines 1-40)</read_first>
  <action>
Keep the page's voice ("terminal", "Ministry", "citizen") and plain Simplified English: short sentences, active voice. In JSX text, write an apostrophe as `&apos;`, as the file already does. Prettier may rewrap the lines; that is fine.

1. Operational Analytics paragraph (about line 163), per WR-03: its second sentence is quoted in full in the planning-time observations. Replace the span that starts with the space after "cookies" and ends with the word "device" (six words, wrapped across two source lines; the space and em dash after "device" stay) with ", and its only storage in your browser is the opt-out flag described under Citizen Rights". Change no other word. The full sentence then reads: "It sets no cookies, and its only storage in your browser is the opt-out flag described under Citizen Rights — sessions are identified by a one-way hash of your IP address, browser user-agent, and hostname, which cannot be reversed and is never reused on another site."
2. Session Recording Protocols paragraph (about line 193), per WR-04: replace the heatmap sentence (it starts "Click and scroll heatmaps are") with: "Click and scroll heatmaps are collected separately from recordings: pointer positions and scroll depth per page, sampled on their own, so a visit can add to a heatmap without being recorded." At the end of the same paragraph, per WR-02, add: "A browser that has opted out (see Citizen Rights) does not load the recorder."
3. Citizen Rights paragraph (about line 259), per WR-06: replace the text from "Under the GDPR" to the end of the paragraph with: "Under the GDPR you may also request access to data concerning you, request its erasure, or object to its collection. The switch below stops analytics collection in this browser only, until you clear its site data, and does not carry over to other browsers or devices. For a request that does not depend on your browser, contact the operator through the routes below." Each sentence traces to shipped behavior: the tracker skips every send while the flag is set (review summary, planning-time read of script.js); `RecorderScript` keeps the recorder off (Task 2); the flag is per-browser `localStorage` that clearing site data removes; the "Contact the Operator" section follows the switch. Add no sentence about hashing or identification here.
4. Local Storage Requisitions table (about line 375), per WR-03: add a second `<tr>`, with the same classes as the `hd1-live-cache-v1` row. Designation: `umami.disabled`. Purpose: "Records your analytics opt-out. Set only when you press the transponder switch under Citizen Rights; removed when you re-enable analytics."
5. The paragraph after the "What This Terminal Does Not Deploy" list (about line 397), per WR-03: replace both of its sentences with: "The operational analytics system (Umami) sets no cookies. Its only browser storage is the opt-out flag listed above."
6. Citizen Override Controls paragraph (about line 406), per WR-03: after the sentence that ends "on your next visit.", add: "It also removes the analytics opt-out, so analytics resume until you press the switch again."
7. Commit: `docs(legal): correct the analytics storage, heatmap and opt-out statements`.
8. In `src/app/docs/infrastructure/page.mdx`, edit the "Analytics proxy" list (lines 361-363). Item 1 becomes: "**Script proxy:** `/stats.js` and `/recorder.js` are route handlers (`src/app/stats.js/route.js`, `src/app/recorder.js/route.js`, shared code `proxyUmamiScript` in `src/shared/utils/umami.mjs`). Each fetches `script.js` or `recorder.js` from `UMAMI_SITE_URL` with no visitor headers, so visitor cookies, the auth session cookie included, never reach the Umami host. A Next.js rewrite would forward them." Item 3 becomes: "**Recorder data:** `/api/record` and `/api/websites/:id/recorder` are Next.js rewrites to `umami.drunik.be`. The recorder calls them with `credentials: "omit"`, so the browser attaches no cookie. `RecorderScript` renders the recorder only for browsers without the `umami.disabled` opt-out flag. Replays and heatmaps stay inert until they are turned on for the site in Umami." Leave item 2 and the CSP paragraph unchanged.
9. In `CHANGELOG.md`, add a `### Fixed` section under `## Unreleased`. Wrap the bullets at about 78 columns, as in the 0.95.0 section. Add four bullets:
   (a) `/stats.js` and `/recorder.js` are now route handlers that fetch the Umami scripts without forwarding request headers. The old rewrites passed the visitor's cookies, the auth session cookie included, to the Umami host.
   (b) The session recorder no longer loads in a browser that has opted out of analytics. Before, it still downloaded and requested its config from the Umami host.
   (c) The `/legal` opt-out switch reports a failed save (storage full or blocked) instead of showing the old state.
   (d) `/legal` lists the `umami.disabled` opt-out flag as browser storage, says heatmaps are collected apart from recordings, and says the opt-out lasts per browser until its site data is cleared.
   Do not change `package.json` and do not add a version heading. The orchestrator adds the version bump as the PR's last commit.
10. Commit: `docs(analytics): describe the cookie-free script routes and the recorder gate`.
11. Run the full gate in `<verification>` and copy each command's result line into the SUMMARY.
  </action>
  <verify>
    <automated>! tr -s '[:space:]' ' ' < src/app/legal/page.jsx | grep -q 'dependable' && ! tr -s '[:space:]' ' ' < src/app/legal/page.jsx | grep -q 'entirely cookieless' && ! tr -s '[:space:]' ' ' < src/app/legal/page.jsx | grep -q 'aggregates built from these recordings' && ! tr -s '[:space:]' ' ' < src/app/legal/page.jsx | grep -q 'writes nothing to your device' && ! tr -s '[:space:]' ' ' < src/app/legal/page.jsx | grep -q 'irreversible hash' && tr -s '[:space:]' ' ' < src/app/legal/page.jsx | grep -q 'umami.disabled' && tr -s '[:space:]' ' ' < src/app/legal/page.jsx | grep -qF 'It sets no cookies, and its only storage in your browser is the opt-out flag described under Citizen Rights — sessions are identified by a one-way hash of your IP address' && tr -s '[:space:]' ' ' < src/app/legal/page.jsx | grep -qF 'The switch below stops analytics collection in this browser only, until you clear its site data' && tr -s '[:space:]' ' ' < src/app/legal/page.jsx | grep -q 'analytics resume until you press the switch again' && tr -s '[:space:]' ' ' < src/app/legal/page.jsx | grep -q 'collected separately from recordings' && tr -s '[:space:]' ' ' < src/app/legal/page.jsx | grep -q 'does not load the recorder' && grep -q 'route handlers' src/app/docs/infrastructure/page.mdx && sed -n '/^## Unreleased/,/^## 0\.95\.0/p' CHANGELOG.md | grep -q '^### Fixed' && grep -q '"version": "0.95.0"' package.json && mise exec -- npx eslint --max-warnings 0 src/app/legal/page.jsx && mise exec -- npx eslint --max-warnings 1 src/app/docs/infrastructure/page.mdx</automated>
  </verify>
  <acceptance_criteria>
    - /legal no longer says Umami stores nothing in the browser, no longer calls the switch the dependable remedy, and no longer says heatmaps are built from recordings
    - /legal lists `umami.disabled` in the Local Storage table, states the per-browser scope next to the switch, names the contact route for requests, and says clearing storage re-enables analytics
    - The Operational Analytics sentence matches the full text in step 1 word for word, and the Citizen Rights paragraph has no hash claim
    - The infrastructure docs describe the route handlers and the cookie-free recorder rewrites
    - CHANGELOG.md has a `### Fixed` section under `## Unreleased`, and `package.json` is still 0.95.0
    - All four gate commands in `<verification>` pass
  </acceptance_criteria>
  <done>The /legal text matches the shipped behavior. The docs and the changelog describe the fix. Two commits are on the branch, and the full gate is green.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| browser → app (`/stats.js`, `/recorder.js`) | The same-origin request carries every visitor cookie, `better-auth.session_token` included |
| app → Umami host (`UMAMI_SITE_URL`) | A separate operator-owned service with its own proxy and logs; it must not receive visitor credentials |
| browser localStorage → `AnalyticsOptOut` / `RecorderScript` | Script-writable storage that can throw (private mode, quota, blocked site data) |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-luq-01 | Information disclosure | external script rewrites in `next.config.mjs` | high | mitigate | Task 1 deletes both script rewrites. `proxyUmamiScript` calls `fetch` with the URL alone. The route tests assert one fetch argument while the incoming request carries a session cookie |
| T-luq-02 | Information disclosure | recorder.js load for an opted-out browser (`layout.jsx`) | medium | mitigate | Task 2 `RecorderScript` renders the recorder only when `readOptOut()` is exactly `false`. Tests cover `'1'`, `'true'` and throwing storage (fail closed) |
| T-luq-03 | Tampering | upstream error page served as a script | low | mitigate | A non-OK upstream status gives 502. The JavaScript content type is set only on success (Task 1 test) |
| T-luq-04 | Spoofing (SSRF) | `proxyUmamiScript` | low | mitigate | The file name is a literal in each route file. No request input reaches the URL. The host comes only from the env |
| T-luq-05 | Information disclosure | public caching of the script responses | low | accept | No visitor header goes upstream, so a response holds no per-visitor data. `public, max-age=3600` is safe for shared caches |
| T-luq-06 | Denial of service | upstream fetch per request | low | accept | The browser cache and the edge cache (public, one hour) absorb repeat loads. The exposure is the same as the old rewrite |
| T-luq-07 | Repudiation | /legal statements that contradict behavior | medium | mitigate | Task 3 rewrites the four statements. Its verify step greps the old wording out and the new wording in |
| T-luq-08 | Information disclosure | silent failed opt-out save | low | mitigate | Task 2 `writeOptOut` returns success, and a failure shows the blocked-storage message (test with a throwing `setItem`) |
| T-luq-SC | Tampering | npm/pip/cargo installs | low | accept | This plan installs no packages |
</threat_model>

<verification>
Run from the worktree root after Task 3. All four must pass:

1. `mise exec -- npm run lint` gives 0 errors. Then `mise exec -- npx eslint --max-warnings 0 next.config.mjs src/shared/utils/umami.mjs src/app/stats.js/route.js src/app/recorder.js/route.js src/shared/components/AnalyticsOptOut.jsx src/shared/components/RecorderScript.jsx src/app/legal/page.jsx src/__tests__/unit/app/stats.js/route.test.mjs src/__tests__/unit/app/recorder.js/route.test.mjs src/__tests__/unit/shared/components/AnalyticsOptOut.test.jsx src/__tests__/unit/shared/components/RecorderScript.test.jsx`, and `--max-warnings 1` for `src/app/layout.jsx` and for `src/app/docs/infrastructure/page.mdx` (the baselines).
2. `mise exec -- npm run typecheck`
3. `mise exec -- npm run test:unit` (includes the mirror-tree meta test)
4. `POSTGRES_URL='postgresql://ci:ci@localhost:5432/ci' UPDATE_KEY=ci-stub-key UPDATE_INTERVAL=20 mise exec -- npm run build`, then the Task 1 manifest checks again.

Then check that `git -C /Users/andrei/Developer/helldivers.bot/.worktrees/umami-review-fixes status --short` is empty, and that `git log --oneline origin/develop..HEAD` includes the five commits of this plan (one from Task 1, two from Task 2, two from Task 3).
</verification>

<success_criteria>
- WR-01: no visitor header reaches the Umami host through the script paths; the build routes both paths dynamically
- WR-02: an opted-out browser never loads recorder.js; the component doc comment names the real mechanism
- WR-03, WR-04, WR-06: /legal states the opt-out storage, the separate heatmap collection and the per-browser scope, and names the request route
- WR-05: a failed save shows the blocked-storage message
- The four-command gate is green, the tree is clean, CHANGELOG.md has `### Fixed` under `## Unreleased`, and the version is not bumped
</success_criteria>

## Source Audit

| SOURCE | ID | Item | Task | Status |
|--------|----|------|------|--------|
| GOAL | — | Fix review findings WR-01..06 from 261013-hu0-REVIEW.md | 1-3 | COVERED |
| CONTEXT (brief) | WR-01 | Route handlers, no forwarded headers, tryCatch + reportError + 502, 404 without host, JS content type, cache, 405 | 1 | COVERED |
| CONTEXT (brief) | WR-01 | Keep the three API rewrites and fix their comment; check `headers()` and the service worker; update docs; mirrored tests | 1, 3 | COVERED (headers rule excluded; the service worker needs no change, see observations; public docs in Task 3. The two `.planning/codebase/` map lines go to the orchestrator's docs commit, see Scope) |
| CONTEXT (brief) | WR-02 | Client gate after mount via tryCatch; shared exported key; layout renders the wrapper; doc comment rewrite; test | 2 | COVERED |
| CONTEXT (brief) | WR-02 | Replay/opt-out text accurate | 3 (step 2) | COVERED |
| CONTEXT (brief) | WR-03 | Storage table row, cookie-section wording, override-controls note | 3 | COVERED |
| CONTEXT (brief) | WR-04 | Heatmap sentence | 3 | COVERED |
| CONTEXT (brief) | WR-05 | `writeOptOut` returns success; toggle shows the blocked message; throwing-`setItem` test | 2 | COVERED |
| CONTEXT (brief) | WR-06 | Per-browser wording, drop "dependable", keep the contact route | 3 | COVERED |
| CONTEXT (brief) | — | CHANGELOG under Unreleased, no version bump | 3 | COVERED |
| CONTEXT (brief) | IN-03 (part) | `setItem` test and shared key | 2 | COVERED (free with WR-05/WR-02) |
| CONTEXT (brief) | IN-01, IN-02, IN-04, IN-05 | — | — | OUT OF SCOPE (per brief) |

<output>
Create `.planning/quick/261013-luq-fix-review-findings-wr-01-06-from-261013/261013-luq-SUMMARY.md` when done.
</output>
