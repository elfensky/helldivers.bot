---
phase: 01-stability-fixes-release
reviewed: 2026-10-21T00:00:00Z
depth: standard
files_reviewed: 12
files_reviewed_list:
  - next.config.mjs
  - scripts/generate-og-fallback.mjs
  - scripts/hydration-sweep.mjs
  - src/__tests__/unit/app/opengraph-image.test.jsx
  - src/__tests__/unit/features/archives/buildWarNarrative.test.mjs
  - src/__tests__/unit/features/notifications/NotificationToggle.test.jsx
  - src/__tests__/unit/shared/utils/game/getWarOutcome.test.mjs
  - src/app/layout.css
  - src/app/layout.jsx
  - src/app/opengraph-image.jsx
  - src/features/notifications/NotificationToggle.jsx
  - src/shared/utils/game/getWarOutcome.mjs
findings:
  critical: 0
  warning: 11
  info: 6
  total: 17
status: issues_found
---

# Phase 01: Code Review Report

**Reviewed:** 2026-10-21
**Depth:** standard
**Files Reviewed:** 12
**Status:** issues_found

## Summary

Scope was 12 source files read by hand. Dependencies are not installed in this worktree, so no tests, lint or build ran.

`public/og-fallback.png` is also in the phase scope. It is a binary asset and was not reviewed. Only the embedded `TRANSPARENT_PIXEL_PNG` constant was checked: it decodes to a valid PNG (IHDR, IDAT and IEND CRCs all match).

The phase fixes are mostly sound in their narrow targets: the OG fallback split, the `serviceWorker.ready` timeout, the VAPID error path and the `?.status` guards. Several of them are half-applied, though:

- The null-slot guard in `opengraph-image.jsx` does not cover the real `computeMapState`, which the test mocks away.
- `NotificationToggle` handles `ready` hanging, but not the other ways enable/disable can fail.
- STAB-04 repointed only `--font-mono`; Inter and Space Grotesk are still unreferenced.

No finding is a proven data-loss or security break, so there are no BLOCKERs. WR-01, WR-02 and WR-03 are the ones to fix before release.

## Warnings

### WR-01: A fresh or empty database is reported to GlitchTip as an incident

**File:** `src/app/opengraph-image.jsx:217-224`
**Issue:** `getCampaign()` documents `null` as its normal return value when no season row exists. The guard `error || !data || !data.status` treats `null` as "malformed result", calls `reportError(..., level: 'error')`, and serves the fallback with `stage: 'query-failure'`. The comment at 208-216 says a freshly seeded database must NOT be reported, but it only protects the "empty `status` array" shape. A fresh database has no season row, so it hits the report path on every crawler hit. This works against the phase goal of zero known error classes. The unit tests never resolve `getCampaign` to `null`, so this is uncovered.
**Fix:**
```js
if (!error && data === null) return fallbackImage('empty-data');
if (error || !data.status) {
    reportError(error ?? new Error('getCampaign() returned a malformed result'), {
        route: 'opengraph-image', stage: 'data-fetch', level: 'error',
    });
    return fallbackImage('query-failure');
}
```
Add a test with `getCampaign.mockResolvedValue(null)` that asserts `reportError` is not called.

### WR-02: The null-slot guard is incomplete; the real `computeLiveMapState` still throws, and the test hides it

**File:** `src/app/opengraph-image.jsx:234-241`, `src/app/layout.jsx:81`, `src/shared/utils/game/computeMapState.mjs:30-33` (callee)
**Issue:** The route now tolerates a `null` entry in `data.status` through `.filter(Boolean)` and `f?.status`. But line 234 calls `computeLiveMapState(data)` first. It reaches `computeMapState`, which runs `for (const campaign of factionStates) { campaign.enemy ... }` and throws a TypeError on a null slot. That call, `buildMapSvg`, and the status derivation all sit outside `tryCatch`, so a throw becomes an uncaught 500, which is exactly the #503 failure the fallback exists to prevent.

The test "a null faction slot ... still renders a real card" mocks `computeLiveMapState` and feeds it a null-free map. It therefore proves nothing about the real path, and its own comment admits `computeMapState` "also assumes non-null entries".

The same unguarded call sits in `layout.jsx:81`: `data ? computeLiveMapState(data) : null`, outside `tryCatch`. A throw there breaks every page, not just the OG card.

Note that `getCampaign` builds `status` from a DB `map()`, so it cannot currently emit `null`. The guard is therefore either unnecessary, or it needs to hold end to end.
**Fix:** Pick one.
- (a) Make `computeLiveMap` robust: `computeMapState((data?.status ?? []).filter(Boolean), activeEvents)`. Then the OG test can use the real function.
- (b) Wrap the render pipeline in the route in `tryCatch` and fall back with `stage: 'render-setup'`.
- Either way, wrap `computeLiveMapState` in `layout.jsx` (for example via `tryCatch(Promise.resolve().then(...))` or a safe helper).

### WR-03: enable() and disable() have no failure handling, so the button can stay busy forever

**File:** `src/features/notifications/NotificationToggle.jsx:193-224` (and `35-75`)
**Issue:** The phase only handled the `ready` hang in the mount effect and the missing VAPID key. The click handlers are still unprotected:
- `Notification.requestPermission()` and `registration.pushManager.subscribe()` can reject. This happens on a push-service failure, an `AbortError`, or a blocked `gcm`/`fcm` endpoint.
- `subscribeToPush`'s `await navigator.serviceWorker.ready` can hang for ever.
- `unsubscribeFromPush` can reject.

When any of these happens, the async handler rejects (an unhandled promise rejection) and `setBusy(false)` is never reached. The button stays on "..." and disabled until reload. Retry only exists in the `error` state. The 5000 ms timeout protects only `init`, not `subscribeToPush`.
**Fix:** Wrap the handler bodies with the project wrapper and always clear busy:
```js
async function enable() {
    setBusy(true);
    const { data: permission, error: permError } = await tryCatch(Notification.requestPermission());
    const { error } = permError ? { error: permError } : permission === 'granted' ? await subscribeToPush() : { error: null };
    // ...report + setState('error') on error
    setBusy(false);
}
```
Make `subscribeToPush` return `{ error }` for rejections as well, and use the same race-with-timeout for its `ready` wait. Add tests for `subscribe` rejecting and for `unsubscribe` rejecting.

### WR-04: A non-2xx response from `/api/notifications/subscribe` is treated as success

**File:** `src/features/notifications/NotificationToggle.jsx:53-59`, `70-74`
**Issue:** The `fetch` result is never checked (`res.ok`). If the server answers 401, 429 or 500, `subscribeToPush` still returns `{ error: null }`. The UI shows "Notifications on" and fires `push-subscribe`, but no row exists in `push_subscription`, so the user never receives pushes. This is a silent functional failure, the same class as the D-15 fix. The test helper even defines a `fetchOk` option (`NotificationToggle.test.jsx:30,79`) and never uses it with `false`, so the case has no coverage.
**Fix:**
```js
const res = await fetch('/api/notifications/subscribe', { ... });
if (!res.ok) {
    await subscription.unsubscribe();
    return { error: new Error(`subscribe endpoint returned ${res.status}`) };
}
```
Add a test with `fetchOk: false`.

### WR-05: The 5 s `serviceWorker.ready` timeout reports a GlitchTip warning for users who are not broken

**File:** `src/features/notifications/NotificationToggle.jsx:113-129`
**Issue:** `navigator.serviceWorker.ready` never resolves when no service worker is registered. That is the case in dev, when `sw.js` registration fails, in some private-browsing modes, and for users who block service workers. For these users with permission `granted`, the 5000 ms timeout calls `reportError`, and then fires `notification-error`, on every mount. The constant is documented as "not measured". This adds a steady stream of warning-level events, which works against the phase goal of reaching zero known error classes. Retry cannot fix the cause.
**Fix:** Decide before release whether a timeout is an error at all. Either skip `reportError` for the timeout path and keep only the Umami event, or first check `await navigator.serviceWorker.getRegistration()` and treat "no registration" as `'unsupported'`, not as an error.

### WR-06: STAB-04 fixed `--font-mono` only; Inter and Space Grotesk are loaded but never applied

**File:** `src/app/layout.css:47-48,99-100`, `src/app/layout.jsx:24-34`
**Issue:** `next/font/google` emits a mangled family name, for example `__Inter_abc123`, and exposes it through the `--font-inter` and `--font-space-grotesk` variables. Nothing in `src/` reads those two variables (a grep finds only their definitions in `layout.jsx`).
- `--font-body` is still the literal `'Inter', Arial, ...`.
- `--font-display` and `h1..h6` use the literal `'Space Grotesk'`, `'Impact'`.

Those literals will not match the next/font faces. Unless the user has the font installed locally, the body falls back to Arial, and the two next/font downloads are dead weight. The Space Mono commit fixed the same defect class for one of the three fonts only.
**Fix:**
```css
--font-body: var(--font-inter), Arial, Helvetica, sans-serif;
--font-display: 'Insignia', var(--font-space-grotesk), 'Impact', sans-serif;
```
Apply it in both blocks (`:root` at 47-48 and `@theme` at 99-100). Also change the `h1..h6` rule (about line 260) to use `var(--font-display)`. Alternatively, drop the two unused font loads. Verify with `getComputedStyle(document.body).fontFamily`.

### WR-07: Unconditional rewrites turn every deployment into an open proxy for a hardcoded Umami host

**File:** `next.config.mjs:60-74`
**Issue:** `/api/record` and `/api/websites/:id/recorder` are rewritten to the fixed host `https://umami.lav.ren` on every deployment. This holds even when `UMAMI_SITE_ID` and `UMAMI_SITE_URL` are unset (local, CI, third-party forks) and for any `:id`, not only this site's id. Any client can use the app origin to reach those Umami endpoints for arbitrary website ids. Next rewrites to external hosts forward the incoming headers, including a `Cookie` header if the caller sends one. The comment correctly says the recorder sends `credentials: "omit"`, but nothing enforces that for other callers. The hostname is also now embedded in two places (here and the `UMAMI_SITE_URL` env).
**Fix:** Build the rewrites only when Umami is configured, pin the id, and keep the host in one place:
```js
const UMAMI_HOST = process.env.UMAMI_SITE_URL; // must be present at build time
...(UMAMI_HOST && process.env.UMAMI_SITE_ID ? [{ source: '/api/websites/:id/recorder', has: [...], destination: ... }] : [])
```
If a build-time host is truly required, document that `UMAMI_SITE_URL` must be a build arg. Otherwise switch to a route handler, as already done for `/stats.js`, which can validate `:id` against `UMAMI_SITE_ID`.

### WR-08: Shared-cache headers are set on HTML whose content depends on the session

**File:** `next.config.mjs:167-199`, `src/app/layout.jsx:87-91,237`
**Issue:** The catch-all rule gives every page outside `/profile` the header `public, s-maxage=30, stale-while-revalidate=60`. The root layout reads the session cookie and renders `<MinistryTriggerWidget isAdmin={isAdmin} />`. So an admin's HTML (and its RSC payload with `isAdmin: true`) is eligible for shared-cache storage, and the cache key does not include the cookie. Result:
- Within the 30 s window, anonymous visitors may get the admin-only widget and the admin flag.
- Equally, an admin may get an anonymous copy without the widget.

The effect is limited because the widget is a client-side easter-egg trigger with no privileged server action. But it is an authorization-dependent response being shared. The exclusion list already carries `profile` for exactly this class of problem, and the layout makes the whole site session-dependent.
**Fix:** Either stop rendering session-dependent output in the root layout (resolve the admin flag on the client from the auth client), or add `Vary: Cookie`. The simplest option is to send `Cache-Control: private` when a session cookie is present. Next headers config can do this with a `has: [{ type: 'cookie', key: <session cookie name> }]` rule placed before the catch-all.

### WR-09: hydration-sweep can report a clean sweep when it should not

**File:** `scripts/hydration-sweep.mjs:47-71`
**Issue:**
1. `page.goto()` does not throw on HTTP 500 or 404. The script then sweeps the error page, finds no hydration messages and exits 0, which means "clean". The header says a launch or navigation failure must crash loudly, but only transport failures do.
2. The `console` handler is async (`await Promise.all(args...)`) and the matches are pushed after that await. A message received close to `browser.close()` can be lost, or the handler can throw into an unhandled rejection after the browser is gone.
3. `/hydrat/i` also matches unrelated text, such as "dehydrated" from data libraries, so this is a source of false failures.
**Fix:**
```js
const response = await page.goto(url, { waitUntil: 'networkidle' });
if (!response?.ok()) { console.error(`hydration-sweep: ${url} returned ${response?.status()}`); process.exit(2); }
```
Track pending handlers in a `Set` of promises and `await Promise.all([...pending])` before `browser.close()`. Narrow the pattern to `/\bhydrat(?:ion|ing|e)\b/i`, or to the `Hydration failed` and `error #4(18|23|25)` strings.

### WR-10: The getWarOutcome null guard covers only faction `.status`, not events or snapshots; the sort ignores nulls

**File:** `src/shared/utils/game/getWarOutcome.mjs:53-55,68-69,84-86`
**Issue:** STAB-05 added `f?.status`. The same null-slot defect class is still open elsewhere in this function:
- `events.filter((e) => e.type ...)` at lines 54 and 85 throws on a `null` event.
- `snapshots.some((snap) => snap.data ...)` at line 69 throws on a `null` snapshot.
- Line 86 sorts with `a.end_time - b.end_time`, with no `?? 0`, although line 55 does use `?? 0`. A null `end_time` gives `NaN` comparisons and a non-deterministic "last region-0 defend", which then drives the defeat/faction attribution.

The tests only cover null inside the faction arrays.
**Fix:** Use `e?.type`, `snap?.data`, and `(a.end_time ?? 0) - (b.end_time ?? 0)` consistently. Add one test per case.

### WR-11: generate-og-fallback.mjs claims deterministic output but depends on the machine, and writes to a cwd-relative path

**File:** `scripts/generate-og-fallback.mjs:19-21,65,75,84,103`
**Issue:**
- The header says fonts are "referenced by name with a system fallback stack" and that this keeps regeneration deterministic. That is the opposite: `'Space Grotesk'`, `Inter` and `'Space Mono'` are only used if installed locally. Otherwise Chromium falls back to Impact, Arial or generic monospace, so the committed PNG changes with the developer's machine.
- `page.screenshot({ path: 'public/og-fallback.png' })` is relative to the current directory. Run from anywhere else, it fails or writes a stray file.
- `HOST` from the environment is interpolated into the HTML without escaping. This is low risk because it is a developer-run script.

**Fix:** Resolve the output path from the script location: `new URL('../public/og-fallback.png', import.meta.url)` (convert with `fileURLToPath`). Either embed the fonts through `@font-face` from the repo's `node_modules/@fontsource` or `public/fonts` files, or correct the comment to say that output depends on locally installed fonts.

## Info

### IN-01: The getWarOutcome JSDoc is attached to the `import`, not to the function

**File:** `src/shared/utils/game/getWarOutcome.mjs:1-42`
**Issue:** The whole doc block comes before `import { ... }`, so the `@param` and `@returns` tags are not bound to `getWarOutcome`. `checkJs` therefore sees the function without its declared types.
**Fix:** Move the `import` to the top of the file, above the doc comment.

### IN-02: Stale comments in the buildWarNarrative test

**File:** `src/__tests__/unit/features/archives/buildWarNarrative.test.mjs:306-310,424-425`
**Issue:** The comments say that `getWarOutcome`'s snapshot check has "no null-guard, so a null slot throws". Plan 01-01 added that guard (`f?.status`), and `getWarOutcome.test.mjs` pins it. The comments now describe behaviour that no longer exists and misdirect the next reader.
**Fix:** Reword them to say the placeholders keep the fixture realistic, or remove the comments.

### IN-03: next.config.mjs details

**File:** `next.config.mjs:1,15`
**Issue:**
- Line 1 imports `withSentryConfig` from `@sentry/nextjs` (the diff against `origin/develop` shows develop uses `@sentry/nextjs/config`). Loading the whole SDK from the config file does more work at config time and may initialise instrumentation. Confirm which import is intended.
- `productionBrowserSourceMaps: true` serves source maps publicly. `.claude/CLAUDE.md` says sourcemaps leave the image only once symbolication is proven (#502). No `sourcemaps.deleteSourcemapsAfterUpload` is set for the Sentry plugin.

**Fix:** Align the import with develop. Delete the maps after upload, or record why they must stay public.

### IN-04: The comment in hydration-sweep mislabels the React error codes

**File:** `scripts/hydration-sweep.mjs:32-35`
**Issue:** The comment says 418 is "text content does not match" and 425 "text content does not match server-rendered HTML". As I recall, 418 is the general "hydration failed because the server rendered HTML didn't match the client" message, 423 is a recoverable client re-render, and 425 is the text-content mismatch. I could not verify the numbers against the installed React docs in this worktree.
**Fix:** Correct the comment, or cite the `react.dev/errors/<n>` pages.

### IN-05: Arbitrary-value classes instead of theme tokens, and a late-failure telemetry gap

**File:** `src/features/notifications/NotificationToggle.jsx:165,180,185,231,242`; `94-98`
**Issue:**
- The classes use `text-[var(--color-text-muted)]` and `hover:text-[var(--color-text)]`. The project has `text-text-muted` and `text-text` tokens (see `layout.css` `@theme`), and CLAUDE.md says to prefer them.
- `enterError` calls `reportError` and `track` even after the effect was cleaned up (`cancelled === true`); only `setState` is guarded. A rejection after unmount or after Retry still reports.

**Fix:** Switch to the tokens. In `enterError`, add `if (cancelled) return;` at the top.

### IN-06: The OG route no longer has any origin-side cache

**File:** `src/app/opengraph-image.jsx:31,39`
**Issue:** The previous `revalidate = 300` is gone and the segment is `force-dynamic`. Each uncached request now runs the DB queries behind `getCampaign` and rasterises a 1200x630 image. The 5-minute cache exists only as `s-maxage` for a shared cache, and the response path has no `.png` extension. If the CDN does not cache that URL (for example under Cloudflare's default rules, which cache by extension), every crawler or bot hit reaches the origin, and the route is unauthenticated. The phase notes say the split was verified in a standalone build, but not behind the CDN.
**Fix:** Confirm CDN caching for `/opengraph-image` in production. Optionally add a small in-process TTL cache around the successful buffer.

---

_Reviewed: 2026-10-21_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
