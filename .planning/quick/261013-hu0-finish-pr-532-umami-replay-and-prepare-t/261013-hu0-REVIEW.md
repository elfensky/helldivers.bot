---
phase: 261013-hu0-finish-pr-532-umami-replay-and-prepare-t
reviewed: 2026-10-13T00:00:00Z
depth: quick
files_reviewed: 8
files_reviewed_list:
  - src/shared/components/AnalyticsOptOut.jsx
  - src/__tests__/unit/shared/components/AnalyticsOptOut.test.jsx
  - src/app/layout.jsx
  - src/app/legal/page.jsx
  - next.config.mjs
  - src/app/docs/infrastructure/page.mdx
  - src/app/docs/utilities/page.mdx
  - AGENTS.md
findings:
  critical: 0
  warning: 6
  info: 5
  total: 11
status: issues_found
---

# Phase 261013-hu0: Code Review Report

**Reviewed:** 2026-10-13
**Depth:** quick (patterns plus targeted verification against the real upstream `script.js` and `recorder.js` downloaded from umami.drunik.be, and against `node_modules/next` proxy code)
**Files Reviewed:** 8
**Status:** issues_found

## Summary

The opt-out does stop all analytics sends. It works indirectly, not the way the code comment says. The tracker (`script.js`) checks `localStorage.umami.disabled` in `U()` before every send. `recorder.js` never reads `localStorage`. It sends only when `window.umami.getSession().cache` is set, and the cache comes from a tracker response. An opted-out tracker never gets a cache. The recorder polls for 5 s (`re()`, 50 x 100 ms), then gives up. No recording is sent.

The component is hydration-safe: server render and first client render are both "Checking…". No try/catch is used. No blocker was found. The main problems are:
- The rewrites forward cookies to the Umami host.
- The recorder is not gated for opted-out visitors.
- Several legal statements are wrong or contradict the new behavior.

## Warnings

### WR-01: Rewrites forward the visitor's cookies (session token) to umami.drunik.be

**File:** `next.config.mjs:68-80` (and the existing `/stats.js` rewrite at line 56; `src/app/layout.jsx:253-258`)
**Issue:** Next's external rewrite proxy (`httpxy`, `next/dist/server/lib/router-utils/proxy-request.js`) forwards all request headers and only adds `x-forwarded-host`. `<Script src="/recorder.js">` is a same-origin request, so the browser attaches `better-auth.session_token` for signed-in users. The rewrite then sends that cookie to the Umami host. The recorder's own `fetch` calls use `credentials: "omit"`, so only the script file request leaks. The leak is not new for `/stats.js`, but this PR adds a second path. The legal page says the session cookie is "HttpOnly, Secure" and that no data goes to third parties. The Umami host is operator-owned but is a separate service with its own proxy and logs. A session token should not reach it.
**Fix:** Serve the two scripts through a route handler that fetches upstream without forwarding headers, or vendor the files. For example, add `src/app/recorder.js/route.js` (and one for the stats script) that does `fetch('https://${process.env.UMAMI_SITE_URL}/recorder.js')` with no cookie, and caches the result. At least document the leak and drop the "plain rewrite is enough" comment.

### WR-02: Recorder is not gated by the opt-out; the code comment and legal text overstate the mechanism

**File:** `src/shared/components/AnalyticsOptOut.jsx:38-43`, `src/app/layout.jsx:252-258`, `src/app/legal/page.jsx:~250` ("this browser transmits no analytics")
**Issue:** The doc comment says that flipping the key "is the whole mechanism". For the recorder that is wrong. The recorder has no `umami.disabled` check (verified: zero `localStorage` references in `recorder.js`). It depends on the undocumented coupling through `getSession().cache`. For an opted-out visitor the page still downloads about 190 KB of `recorder.js`, then runs `fetch('/api/websites/<id>/recorder')`, which goes to the Umami host and exposes the IP address. The page then waits 5 s for a cache that never arrives. Both the 5 s poll and the config request happen after opt-out, so "transmits no analytics" is not strictly true. After the switch is clicked on the current page, the recorder keeps its in-memory cache and keeps uploading until navigation. The text does say "from the next page load".
**Fix:** Do not render the recorder `<Script>` for opted-out visitors, and rewrite the comment to name the real mechanism. Because `layout.jsx` is a server component, use a small client wrapper, for example `<RecorderScript nonce siteId />`, that checks `localStorage` before rendering `<Script>`. Add a test for it. Alternatively, state the coupling in the comment and soften the legal wording.

### WR-03: Legal page contradicts itself and omits the new storage key

**File:** `src/app/legal/page.jsx:398-399` and `:346-361` (Local Storage table)
**Issue:** The cookies section still says "The operational analytics system (Umami) is entirely cookieless. It does not store any data in your browser." The PR text at line 164 says "writes nothing to your device", and the new `AnalyticsOptOut` writes `umami.disabled` to `localStorage`. The "Local Storage Requisitions" inventory lists only `hd1-live-cache-v1`. The component's own docstring calls `umami.disabled` the only value the analytics stack writes. The legal page does not list it. "Citizen Override Controls" (~line 406) says clearing local storage "removes the offline campaign cache" and does not mention that it also resets the opt-out.
**Fix:** Add a `umami.disabled` row to the table ("Records your analytics opt-out; set only when you press the switch"). Change line 398 to "sets no cookies; its only browser storage is the opt-out flag". Mention in Citizen Override Controls that clearing storage re-enables analytics.

### WR-04: "Heatmaps are aggregates built from these recordings" is false

**File:** `src/app/legal/page.jsx:198-199`
**Issue:** In `recorder.js`, heatmaps and replays are separate pipelines. Heatmap events (click x/y, scroll percent, URL, viewport) are sent as `W("heatmap", ...)` and sampled by their own `heatmapSampleRate`. They do not need a replay (`s&&te()` and `r&&ee()` are independent). A visitor can be heatmap-tracked without being recorded, and the other way round. The text understates what is collected and when.
**Fix:** Reword, for example: "Click and scroll heatmaps are collected separately from recordings: pointer positions and scroll depth per page, sampled independently."

### WR-05: Failed write is silent; the docstring claims otherwise

**File:** `src/shared/components/AnalyticsOptOut.jsx:23-34`, `:60-63`
**Issue:** `writeOptOut` ignores the result with the comment "the `readOptOut` after the write reports a failure". That holds only when `getItem` also throws. If `setItem` throws (quota exceeded, some locked-down browsers) while `getItem` works, the read returns the old value. The button flips nowhere, the text stays "Currently counted.", and the visitor is never told the opt-out was not saved. The test suite stubs only a throwing `getItem`, so this path is untested.
**Fix:** Make `writeOptOut` return `!error`, and in `toggle` set a tri-state or error flag when the write failed. Show the same "blocks local storage" message. Add a test with a throwing `setItem`.

### WR-06: Opt-out is not durable, but the legal text calls it "the dependable remedy"

**File:** `src/app/legal/page.jsx:263-267`, `src/shared/components/AnalyticsOptOut.jsx:91`
**Issue:** The flag is script-writable `localStorage` for one origin and browser profile. Safari ITP deletes script-writable storage after 7 days without interaction. Clearing site data, private windows, and other browsers or devices all drop it silently. The page calls this switch "the dependable remedy rather than a request". Right after removing a request path, that overstates it. The data-subject-rights sentence also offers no contact route in the same paragraph.
**Fix:** Say "per browser, until you clear site data" next to the switch. Keep the request route (the Contact section) mentioned as the durable option. Drop "dependable".

## Info

### IN-01: Rewrite host is hardcoded, but docs and proxy route use `UMAMI_SITE_URL`

**File:** `next.config.mjs:56-79`, `src/app/docs/infrastructure/page.mdx:366`
**Issue:** `src/app/api/umami/route.js` builds its target from `process.env.UMAMI_SITE_URL`. The rewrites hardcode `umami.drunik.be` for the stats script and the three recorder rewrites. The docs state that `UMAMI_SITE_URL` configures the host. Changing the env var moves `/api/send` only. Also, the rewrites are active in development and staging and ignore `isProduction`. `:id` matches any website UUID, so anyone can read recorder config for any site on that Umami through this origin (the endpoint is public upstream anyway).
**Fix:** Read the host once from `process.env.UMAMI_SITE_URL` at the top of `next.config.mjs` and build all four destinations from it. Pin the `:id` pattern to the site UUID if it is known at build time.

### IN-02: Expected "storage blocked" case is reported to GlitchTip on every visit to /legal

**File:** `src/shared/components/AnalyticsOptOut.jsx:14-20`
**Issue:** `tryCatch` calls `reportError(..., level: 'warning')` for each caught error. A visitor with blocked storage generates one report per page view (and one per click). This is an expected condition and not a defect to track. Wrapping a synchronous call in `Promise.resolve().then(...)` only to satisfy `tryCatch` is also convoluted.
**Fix:** Accept the noise, or add a quiet option to `tryCatch`. At minimum add a one-line comment that the report is intentional.

### IN-03: Test gaps

**File:** `src/__tests__/unit/shared/components/AnalyticsOptOut.test.jsx`
**Issue:** There is no test for a throwing `setItem` (see WR-05). No test checks that the key equals the string the tracker reads (`'umami.disabled'` is duplicated in the test, so a rename in the component and test together passes). `reportError` is not mocked, so the tests rely on its real behavior in jsdom. The `data-umami-event` test is a one-assertion check on an attribute and adds little.
**Fix:** Add the `setItem` failure test. Export `KEY` from the component, or keep one shared constant, and import it in the test. Mock `@/shared/utils/observability.mjs`.

### IN-04: Minor component simplification and accessibility

**File:** `src/shared/components/AnalyticsOptOut.jsx:50-51`, `:79-85`
**Issue:** `ready` and `optedOut` can be one state (`undefined` = loading, `null` = blocked, boolean = value). The button label flips between "Disable" and "re-enable", which is acceptable, but a toggle is more robust as `aria-pressed` with a fixed label. The `aria-live` region is mounted only after `ready`, so the first announcement may be missed; this is cosmetic. A stored value other than `'1'` (for example `'true'`) disables the tracker, but the UI says "Currently counted".
**Fix:** Optional. Collapse the states; compare with truthiness (`!!getItem(KEY)`) to match the tracker's check.

### IN-05: Docs wording and unverifiable claim

**File:** `src/app/docs/infrastructure/page.mdx:365`
**Issue:** "The app sets no Content-Security-Policy header and the production edge sets one." The first half is accurate (no CSP in `src`, `next.config.mjs` or `deploy/`). The edge claim cannot be checked from the repo, and "and" should be "but". The recorder also spawns a blob Worker (rrweb image-bitmap worker); if the edge CSP uses a strict `worker-src` it would be blocked. This was not verified. Separately, session replay with unmasked page text and no consent banner relies on the legitimate-interest basis. Whether that holds under ePrivacy Art. 5(3) is a legal decision for the operator, not a code finding.
**Fix:** Reword, and note which CSP directives the recorder needs (`worker-src blob:`).

---

_Reviewed: 2026-10-13_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: quick_
