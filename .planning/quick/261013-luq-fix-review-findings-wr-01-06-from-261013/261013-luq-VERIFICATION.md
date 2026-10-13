---
phase: quick-261013-luq
verified: 2026-10-13T16:30:00Z
status: human_needed
score: 10/10 must-haves verified
covered_files:
    - .planning/quick/261013-luq-fix-review-findings-wr-01-06-from-261013/261013-luq-PLAN.md
    - .planning/quick/261013-luq-fix-review-findings-wr-01-06-from-261013/261013-luq-SUMMARY.md
    - CHANGELOG.md
    - next.config.mjs
    - src/app/docs/infrastructure/page.mdx
    - src/app/layout.jsx
    - src/app/legal/page.jsx
    - src/app/recorder.js/route.js
    - src/app/stats.js/route.js
    - src/shared/components/AnalyticsOptOut.jsx
    - src/shared/components/RecorderScript.jsx
    - src/shared/utils/umami.mjs
covered_digest: "v3:sha256:a658a7cc4ac657d9e8478df493042b349acc89e9557096b5dc106bc0328ac73e"
behavior_unverified: 0
human_verification:
    - test: "Open the deployed (staging) site with DevTools Network. Load / and check /stats.js and /recorder.js."
      expected: "Both answer 200 with Content-Type application/javascript and Cache-Control public, max-age=3600 (not the soft CDN cache value). The tracker runs and no script is blocked by nosniff."
      why_human: "Needs a real browser and the live Umami host. Unit tests mock fetch. The headers() cache override and nosniff interaction is only proven by the unit tests and config reading."
    - test: "While signed in (session cookie present), request /stats.js and look at the Umami host logs or proxy."
      expected: "The upstream request to umami.drunik.be carries no Cookie header."
      why_human: "Needs the live Umami host. Unit tests prove fetch(url) is called with one argument, not what the host receives."
    - test: "On /legal press 'Disable transponder', then hard-reload any page. Then clear site data and reload."
      expected: "After opt-out and reload: no /recorder.js request and no /api/record or recorder config request. After clearing site data: recorder.js loads again."
      why_human: "RecorderScript gating after mount in a real browser (Next Script with nonce) is only covered by a mocked next/script in jsdom."
---

# Quick 261013-luq: Fix review findings WR-01..06 Verification Report

**Goal:** Fix review findings WR-01..WR-06 from 261013-hu0-REVIEW.md
**Verified:** 2026-10-13
**Status:** human_needed (all code checks pass; browser and live-host checks remain)
**Re-verification:** No, initial verification

## Goal Achievement

### Observable Truths

| #  | Truth | Status | Evidence |
| -- | ----- | ------ | -------- |
| 1  | Script routes fetch upstream with the URL alone (WR-01) | VERIFIED | `proxyUmamiScript` in `src/shared/utils/umami.mjs` calls `fetch(\`https://${host}/${file}\`)` with one argument. Route tests assert `toHaveBeenCalledWith(url)` and `mock.calls[0]` length 1 with a cookie on the request. Re-ran: pass. |
| 2  | Content-Type, Cache-Control, 404/502/405 behavior (WR-01) | VERIFIED | Code reads as specified. Tests cover 200 headers, empty-host 404 with no fetch, rejected fetch 502, upstream 404 gives 502, POST 405. Both route files (`stats.js`, `recorder.js`) use the same helper and `methodNotAllowed`. |
| 3  | No script rewrites; API rewrites stay; comment is accurate (WR-01) | VERIFIED | `git diff` shows both script rewrites removed. `/api/send`, `/api/record`, `/api/websites/:id/recorder` unchanged. New comment states only the route-handler reason and `credentials: "omit"`. No X-Forwarded-For or x-umami-cache wording left in the file. |
| 4  | Build registers both as dynamic route handlers (WR-01) | VERIFIED | `.next/app-path-routes-manifest.json` maps `/stats.js/route` to `/stats.js` and `/recorder.js/route` to `/recorder.js`. Neither appears in `.next/prerender-manifest.json`. Manifest is newer than the last commit. I did not re-run the build. |
| 5  | Recorder is never rendered for an opted-out or storage-throwing browser (WR-02) | VERIFIED | `RecorderScript.jsx` sets `allowed` only when `readOptOut() === false`. Tests: server render is empty, renders with flag unset (src, nonce, site id, strategy), nothing for `'1'`, `'true'`, throwing `getItem`. Pass. `layout.jsx` renders `<RecorderScript>` and no longer holds the recorder Script. |
| 6  | `readOptOut` returns `null`, never `false`, on throw (WR-02) | VERIFIED | `return error ? null : data`. Test asserts `resolves.toBeNull()`. |
| 7  | Failed `setItem` shows the blocked-storage message (WR-05) | VERIFIED | `writeOptOut` returns `!error`. `toggle` sets `null` on failure. Test with throwing `setItem` passes. |
| 8  | /legal lists `umami.disabled`, heatmap, per-browser scope, contact route, clearing storage (WR-03, WR-04, WR-06) | VERIFIED | Table row added. Cookie paragraph reworded. Heatmap sentence reworded. Citizen Rights says "this browser only, until you clear its site data" and points to the contact routes (Contact the Operator section follows the switch). Clearing local storage sentence added. |
| 9  | New /legal text states only shipped behavior; hash claim gone from Citizen Rights (WR-06) | VERIFIED | Old phrases ("dependable", "entirely cookieless", "aggregates built from these recordings", "writes nothing to your device", "irreversible hash") are all absent. The Operational Analytics sentence matches the plan text. The existing "one-way hash" clause there is accepted pre-existing text. |
| 10 | Lint, typecheck, tests pass; CHANGELOG Fixed under Unreleased; version unchanged | VERIFIED | `eslint --max-warnings 0` on the plan's touched list: exit 0. `npm run typecheck`: exit 0. Targeted vitest (stats.js, recorder.js, api/umami, AnalyticsOptOut, RecorderScript, `_meta`): 11 files, 56 tests pass. CHANGELOG has `### Fixed` with 4 bullets. `package.json` is 0.95.0. Worktree clean except the new quick dir. |

**Score:** 10/10 truths verified. I did not re-run the full `test:unit` suite or the build. I rely on the SUMMARY for those two, backed by the manifest check above.

### Per-finding check

| Finding | Fix achieved | Note |
| ------- | ------------ | ---- |
| WR-01 cookies forwarded | Yes | Script paths no longer use external rewrites. Remaining rewrites are cookie-free per `credentials: "omit"` (a fact from the plan's script.js/recorder.js read, not re-checked here). |
| WR-02 recorder not gated | Yes | Gate fails closed. `AnalyticsOptOut` doc comment now names the tracker check and the `RecorderScript` gate. "whole mechanism" is gone. |
| WR-03 legal contradictions | Yes | Storage table, cookie paragraph and override-controls paragraph consistent. |
| WR-04 heatmap claim | Yes | Reworded to "collected separately from recordings". |
| WR-05 silent failed write | Yes | Tested. |
| WR-06 "dependable remedy" | Yes | Replaced with per-browser scope and contact route. |

### Key Links

| From | To | Status |
| ---- | -- | ------ |
| route GET to `proxyUmamiScript(file)` to `fetch(url)` | single argument | WIRED |
| `headers()` soft-cache rule excludes `stats\.js` and `recorder\.js` | handler Cache-Control survives | WIRED in config (runtime header outcome is a human check) |
| `layout.jsx` (server) to `RecorderScript` (client) to `readOptOut` to `OPT_OUT_KEY` | shared key | WIRED |
| `writeOptOut` false to `setOptedOut(null)` to blocked message | tested | WIRED |

### Anti-patterns

No TBD/FIXME/XXX markers in the changed source. No try/catch added. No stubs found.

### Gaps Summary

No code gaps. Out-of-scope items accepted per the brief: `.planning/codebase/INTEGRATIONS.md` and `STACK.md` still mention the old rewrite; the version bump is pending.

One note, not a gap: the SUMMARY's lint line says 323 warnings repo-wide. That is existing and not checked here. Warnings in touched files are 0, which I confirmed.

### Human Verification Required

1. **Script headers in a browser.** Load the staging site with DevTools. Check `/stats.js` and `/recorder.js`: 200, `application/javascript`, `public, max-age=3600`, tracker runs. Why human: needs a browser and the live Umami host.
2. **No cookie reaches Umami.** With a signed-in session, check the Umami side for a Cookie header on the script fetch. Why human: needs the live host.
3. **Opt-out gate in a real browser.** Press the switch on /legal, reload, confirm no recorder requests; clear site data, confirm the recorder loads. Why human: the Next `Script` component is mocked in the unit test.

---

_Verified: 2026-10-13_
_Verifier: Claude (gsd-verifier)_
